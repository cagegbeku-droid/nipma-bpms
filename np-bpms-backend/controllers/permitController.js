const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { createGoogleDriveFolder, uploadFileToDrive } = require('../utils/googleDrive');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. RELATIONAL FETCH FUNCTIONS
// ==========================================
const getPermits = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('permits')
      .select(`
        *,
        applicants ( first_name, last_name, phone ),
        properties ( address, location )
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    const formattedData = data.map(permit => ({
      id: permit.id,
      permit_number: permit.permit_number,
      date_issued: permit.date_issued,
      first_name: permit.applicants?.first_name,
      last_name: permit.applicants?.last_name,
      phone: permit.applicants?.phone,
      
      // Updated property fields
      address: permit.properties?.address,
      location: permit.properties?.location,
      
      // Updated file links
      certificate_link: permit.file_permit_certificate,
      drawings_links: permit.file_architectural_drawings,
      permit_form_link: permit.file_permit_form, // <-- Changed from indenture
      receipts_links: permit.file_receipts,
      georef_link: permit.file_geo_reference,
      
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
// 2. BACKGROUND WORKER 
// ==========================================
const processFilesInBackground = async (files, permitId, permitNumber, lastName) => {
  try {
    console.log(`Starting background upload pipeline for Permit ID: ${permitId}`);
    
    const mainFolderName = `${permitNumber.replace(/\//g, '_')} - ${lastName}`;
    const mainFolderId = await createGoogleDriveFolder(mainFolderName); 

    const processAndUpload = async (fileArray, subFolderName) => {
      if (!fileArray || fileArray.length === 0) return [];
      const subFolderId = await createGoogleDriveFolder(subFolderName, mainFolderId);
      const uploadTasks = fileArray.map(file => uploadFileToDrive(file, subFolderId));
      return await Promise.all(uploadTasks);
    };

    // Swapped indenture for permitForm
    const [
      certificateLinks, 
      drawingLinks, 
      permitFormLinks, 
      receiptLinks, 
      geoRefLinks
    ] = await Promise.all([
      processAndUpload(files['certificate'], '1. Permit Certificate'),
      processAndUpload(files['drawings'], '2. Architectural Drawings'),
      processAndUpload(files['permitForm'], '3. Permit Form'), // <-- Updated
      processAndUpload(files['receipts'], '4. Receipts'),
      processAndUpload(files['geoReference'], '5. Geo-Reference Data')
    ]);

    const { error: updateError } = await supabase
      .from('permits')
      .update({
        file_permit_certificate: certificateLinks[0] || null,
        file_architectural_drawings: drawingLinks.join(', ') || null,
        file_permit_form: permitFormLinks.join(', ') || null, // <-- Updated
        file_receipts: receiptLinks.join(', ') || null,
        file_geo_reference: geoRefLinks[0] || null,
        upload_status: 'completed' 
      })
      .eq('id', permitId);

    if (updateError) throw updateError;
    console.log(`Background upload execution completed successfully for Permit ID: ${permitId}`);

  } catch (error) {
    console.error(`Background Processing Failed for Permit ID: ${permitId}.`, error);
    await supabase.from('permits').update({ upload_status: 'failed' }).eq('id', permitId);
  }
};

// ==========================================
// 3. THE INSTANT ARCHIVE ROUTE
// ==========================================
const archivePermit = async (req, res) => {
  try {
    // Extracted the new address and location fields from req.body
    const { permitNumber, dateIssued, firstName, lastName, phone, address, location } = req.body;

    const { data: applicantData, error: applicantError } = await supabase
      .from('applicants')
      .insert([{ first_name: firstName, last_name: lastName, phone: phone }])
      .select().single();
    if (applicantError) throw applicantError;

    // Insert new property data
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .insert([{ address: address, location: location }]) // <-- Updated
      .select().single();
    if (propertyError) throw propertyError;

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

    res.status(200).json({ 
      success: true, 
      message: "Permit record instantiated. Documents are archiving securely in the background." 
    });

    processFilesInBackground(req.files, permitData.id, permitNumber, lastName);

  } catch (error) {
    console.error("Fatal routing interception on Archive execution:", error);
    res.status(500).json({ success: false, message: "Failed to construct initial permit archive structural record" });
  }
};

module.exports = { archivePermit, getPermits, getPermitStats, getMonthlyStats };