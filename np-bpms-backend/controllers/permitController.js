const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Keep your Google Drive imports exactly as they are in your actual project
const { createGoogleDriveFolder, uploadFileToDrive } = require('../utils/googleDrive');

// Re-establish the Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);


// ==========================================
// 2. THE 3-STEP RELAY ARCHIVE FUNCTION (Optimized with Promise.all)
// ==========================================
const archivePermit = async (req, res) => {
  try {
    const { permitNumber, dateIssued, firstName, lastName, phone, plotNumber, community, buildingType } = req.body;

    // --- DRIVE UPLOAD LOGIC ---
    const folderName = `${permitNumber.replace(/\//g, '_')} - ${lastName}`;
    const permitFolderId = await createGoogleDriveFolder(folderName); 

    // Helper to process arrays of files concurrently
    const processAndUpload = async (fileArray) => {
      if (!fileArray || fileArray.length === 0) return [];
      
      // We map the files to upload tasks, then run them all at once!
      const uploadTasks = fileArray.map(file => uploadFileToDrive(file, permitFolderId));
      const uploadedLinks = await Promise.all(uploadTasks);
      return uploadedLinks;
    };

    // --- PARALLEL UPLOAD BATCHING ---
    // Instead of awaiting these one by one, we fire them all simultaneously
    const [
      certificateLinks,
      drawingLinks,
      indentureLinks,
      receiptLinks,
      geoRefLinks
    ] = await Promise.all([
      processAndUpload(req.files['certificate']),
      processAndUpload(req.files['drawings']),
      processAndUpload(req.files['indenture']),
      processAndUpload(req.files['receipts']),
      processAndUpload(req.files['geoReference'])
    ]);

    // --- STEP 1: INSERT APPLICANT ---
    const { data: applicantData, error: applicantError } = await supabase
      .from('applicants')
      .insert([{ first_name: firstName, last_name: lastName, phone: phone }])
      .select() // Grabs the newly generated ID
      .single();
    
    if (applicantError) throw applicantError;

    // --- STEP 2: INSERT PROPERTY ---
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .insert([{ plot_number: plotNumber, community: community, building_type: buildingType }])
      .select() 
      .single();
    
    if (propertyError) throw propertyError;

    // --- STEP 3: INSERT PERMIT (Tying it all together) ---
    const { error: permitError } = await supabase
      .from('permits')
      .insert([{
        permit_number: permitNumber,
        applicant_id: applicantData.id,
        property_id: propertyData.id,
        date_issued: dateIssued,
        file_permit_certificate: certificateLinks[0] || null,
        file_architectural_drawings: drawingLinks.join(', ') || null,
        file_indenture: indentureLinks.join(', ') || null,
        file_receipts: receiptLinks.join(', ') || null,
        file_geo_reference: geoRefLinks[0] || null
      }]);

    if (permitError) throw permitError;

    res.status(200).json({ success: true, message: "Archived successfully across all tables" });

  } catch (error) {
    console.error("Archive Error:", error);
    res.status(500).json({ success: false, message: "Failed to archive permit" });
  }
};

module.exports = {
  archivePermit,
  getPermits,
  getPermitStats,
  getMonthlyStats
};