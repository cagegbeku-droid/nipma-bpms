const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Google Drive utilities
const { createGoogleDriveFolder, uploadFileToDrive } = require('../utils/googleDrive');

// Initialize the Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. RELATIONAL FETCH FUNCTIONS
// ==========================================
const getPermits = async (req, res) => {
  try {
    // Supabase JOIN syntax to pull data from all 3 tables at once
    const { data, error } = await supabase
      .from('permits')
      .select(`
        *,
        applicants ( first_name, last_name, phone ),
        properties ( plot_number, community, building_type )
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    // Flatten data structures so your React frontend remains cleanly decoupled
    const formattedData = data.map(permit => ({
      id: permit.id,
      permit_number: permit.permit_number,
      date_issued: permit.date_issued,
      first_name: permit.applicants?.first_name,
      last_name: permit.applicants?.last_name,
      phone: permit.applicants?.phone,
      plot_number: permit.properties?.plot_number,
      community: permit.properties?.community,
      building_type: permit.properties?.building_type,
      
      // Document mapping strings
      certificate_link: permit.file_permit_certificate,
      drawings_links: permit.file_architectural_drawings,
      indenture_link: permit.file_indenture,
      receipts_links: permit.file_receipts,
      georef_link: permit.file_geo_reference,
      
      // Background status tracker for frontend loading state mapping
      upload_status: permit.upload_status || 'pending'
    }));

    res.status(200).json({ success: true, data: formattedData });
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch permits" });
  }
};

const getPermitStats = async (req, res) => {
  try {
    const { data, error } = await supabase.from('permits').select('id');
    if (error) throw error;
    res.status(200).json({ success: true, total: data.length });
  } catch (error) {
    console.error("Critical Stats Error:", error); 
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
};

const getMonthlyStats = async (req, res) => {
  res.status(200).json({ success: true, data: [] });
};

// ==========================================
// 2. BACKGROUND WORKER (Nested Folder Architecture)
// ==========================================
const processFilesInBackground = async (files, permitId, permitNumber, lastName) => {
  try {
    console.log(`Starting background upload pipeline for Permit ID: ${permitId}`);
    
    // 1. Create the Main Applicant Folder in the root vault
    const mainFolderName = `${permitNumber.replace(/\//g, '_')} - ${lastName}`;
    const mainFolderId = await createGoogleDriveFolder(mainFolderName); 

    // 2. New Helper: Creates a subfolder and uploads files into it
    const processAndUpload = async (fileArray, subFolderName) => {
      // If the user didn't upload files for this category, skip it. No empty folders!
      if (!fileArray || fileArray.length === 0) return [];
      
      // Create the specific subfolder INSIDE the main folder
      const subFolderId = await createGoogleDriveFolder(subFolderName, mainFolderId);

      // Upload the files to the new subfolder
      const uploadTasks = fileArray.map(file => uploadFileToDrive(file, subFolderId));
      return await Promise.all(uploadTasks);
    };

    // 3. Fire all document pipelines simultaneously with custom folder names
    const [
      certificateLinks, 
      drawingLinks, 
      indentureLinks, 
      receiptLinks, 
      geoRefLinks
    ] = await Promise.all([
      processAndUpload(files['certificate'], '1. Permit Certificate'),
      processAndUpload(files['drawings'], '2. Architectural Drawings'),
      processAndUpload(files['indenture'], '3. Indenture Documents'),
      processAndUpload(files['receipts'], '4. Receipts'),
      processAndUpload(files['geoReference'], '5. Geo-Reference Data')
    ]);

    // 4. Update the database with the links
    const { error: updateError } = await supabase
      .from('permits')
      .update({
        file_permit_certificate: certificateLinks[0] || null,
        file_architectural_drawings: drawingLinks.join(', ') || null,
        file_indenture: indentureLinks.join(', ') || null,
        file_receipts: receiptLinks.join(', ') || null,
        file_geo_reference: geoRefLinks[0] || null,
        upload_status: 'completed' 
      })
      .eq('id', permitId);

    if (updateError) throw updateError;
    console.log(`Background upload execution completed successfully for Permit ID: ${permitId}`);

  } catch (error) {
    console.error(`Background Processing Failed for Permit ID: ${permitId}. Gracefully falling back.`, error);
    
    // Explicit mutation tracking fallback to keep state errors visible inside the app context
    await supabase
      .from('permits')
      .update({ upload_status: 'failed' })
      .eq('id', permitId);
  }
};

// ==========================================
// 3. THE INSTANT ARCHIVE ROUTE HANDLE
// ==========================================
const archivePermit = async (req, res) => {
  try {
    const { permitNumber, dateIssued, firstName, lastName, phone, plotNumber, community, buildingType } = req.body;

    // STEP 1: Fast sequence relational insertion (Applicant entity context)
    const { data: applicantData, error: applicantError } = await supabase
      .from('applicants')
      .insert([{ first_name: firstName, last_name: lastName, phone: phone }])
      .select().single();
    if (applicantError) throw applicantError;

    // STEP 2: Fast sequence relational insertion (Property entity context)
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .insert([{ plot_number: plotNumber, community: community, building_type: buildingType }])
      .select().single();
    if (propertyError) throw propertyError;

    // STEP 3: Shell structural creation (Omits blocking links, seeds 'pending' tracking status)
    const { data: permitData, error: permitError } = await supabase
      .from('permits')
      .insert([{
        permit_number: permitNumber,
        applicant_id: applicantData.id,
        property_id: propertyData.id,
        date_issued: dateIssued,
        upload_status: 'pending'
      }])
      .select().single(); 
    if (permitError) throw permitError;

    // STEP 4: Immediately offload HTTP network frame back to frontend consumer context
    res.status(200).json({ 
      success: true, 
      message: "Permit record instantiated. Documents are archiving securely in the background." 
    });

    // STEP 5: Fire-and-forget hook deployment. No 'await' keeps thread non-blocking.
    processFilesInBackground(req.files, permitData.id, permitNumber, lastName);

  } catch (error) {
    console.error("Fatal routing interception on Archive execution:", error);
    res.status(500).json({ success: false, message: "Failed to construct initial permit archive structural record" });
  }
};

module.exports = {
  archivePermit,
  getPermits,
  getPermitStats,
  getMonthlyStats
};