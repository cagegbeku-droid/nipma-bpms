const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Keep your Google Drive imports exactly as they are in your actual project
const { createGoogleDriveFolder, uploadFileToDrive } = require('../utils/googleDrive');

// Re-establish the Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);


// ==========================================
// 1. RELATIONAL FETCH FUNCTION
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

    // We flatten the data here so your React frontend doesn't break!
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
      // Map the new SQL column names back to what React expects
      certificate_link: permit.file_permit_certificate,
      drawings_links: permit.file_architectural_drawings,
      indenture_link: permit.file_indenture,
      receipts_links: permit.file_receipts,
      georef_link: permit.file_geo_reference
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
// 2. THE 3-STEP RELAY ARCHIVE FUNCTION
// ==========================================
const archivePermit = async (req, res) => {
  try {
    const { permitNumber, dateIssued, firstName, lastName, phone, plotNumber, community, buildingType } = req.body;

    // --- DRIVE UPLOAD LOGIC ---
    const folderName = `${permitNumber.replace(/\//g, '_')} - ${lastName}`;
    const permitFolderId = await createGoogleDriveFolder(folderName); 

    const processAndUpload = async (fileArray) => {
      if (!fileArray || fileArray.length === 0) return [];
      const uploadedLinks = [];
      for (const file of fileArray) {
        const link = await uploadFileToDrive(file, permitFolderId);
        uploadedLinks.push(link);
      }
      return uploadedLinks;
    };

    const certificateLinks = await processAndUpload(req.files['certificate']);
    const drawingLinks = await processAndUpload(req.files['drawings']);
    const indentureLinks = await processAndUpload(req.files['indenture']);
    const receiptLinks = await processAndUpload(req.files['receipts']);
    const geoRefLinks = await processAndUpload(req.files['geoReference']);

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