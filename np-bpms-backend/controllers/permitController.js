const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { createGoogleDriveFolder, uploadFileToDrive } = require('../utils/googleDrive');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. GET PERMITS
// ==========================================
const getPermits = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('permits')
      .select(`*, applicants ( first_name, last_name, phone ), properties ( address, location )`)
      .order('id', { ascending: false });

    if (error) throw error;

    const formattedData = data.map(permit => ({
      id: permit.id,
      permit_number: permit.permit_number,
      date_issued: permit.date_issued,
      first_name: permit.applicants?.first_name,
      last_name: permit.applicants?.last_name,
      phone: permit.applicants?.phone,
      address: permit.properties?.address,
      location: permit.properties?.location,
      certificate_link: permit.file_permit_certificate,
      drawings_links: permit.file_architectural_drawings,
      permit_form_link: permit.file_permit_form,
      receipts_links: permit.file_receipts,
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
    const mainFolderName = `${permitNumber.replace(/\//g, '_')} - ${lastName}`;
    const mainFolderId = await createGoogleDriveFolder(mainFolderName); 

    const processAndUpload = async (fileArray, subFolderName) => {
      if (!fileArray || fileArray.length === 0) return [];
      const subFolderId = await createGoogleDriveFolder(subFolderName, mainFolderId);
      const uploadTasks = fileArray.map(file => uploadFileToDrive(file, subFolderId));
      return await Promise.all(uploadTasks);
    };

    const [certificateLinks, drawingLinks, permitFormLinks, receiptLinks] = await Promise.all([
      processAndUpload(files['certificate'], '1. Permit Certificate'),
      processAndUpload(files['drawings'], '2. Architectural Drawings'),
      processAndUpload(files['permitForm'], '3. Permit Form'),
      processAndUpload(files['receipts'], '4. Receipts')
    ]);

    const { error: updateError } = await supabase.from('permits').update({
      file_permit_certificate: certificateLinks[0] || null,
      file_architectural_drawings: drawingLinks.join(', ') || null,
      file_permit_form: permitFormLinks.join(', ') || null,
      file_receipts: receiptLinks.join(', ') || null,
      upload_status: 'completed' 
    }).eq('id', permitId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Background Processing Failed:`, error);
    await supabase.from('permits').update({ upload_status: 'failed' }).eq('id', permitId);
  }
};

// ==========================================
// 3. ARCHIVE ROUTE
// ==========================================
const archivePermit = async (req, res) => {
  try {
    const { permitNumber, dateIssued, firstName, lastName, phone, address, location } = req.body;

    const { data: applicantData, error: applicantError } = await supabase
      .from('applicants')
      .insert([{ first_name: firstName, last_name: lastName, phone: phone || null }])
      .select().single();
    if (applicantError) throw applicantError;

    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .insert([{ address: address, location: location }])
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

    res.status(200).json({ success: true, message: "Permit record instantiated." });

    processFilesInBackground(req.files, permitData.id, permitNumber, lastName);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to archive record" });
  }
};

// ==========================================
// 4. DELETE PERMIT ROUTE
// ==========================================
const deletePermit = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('permits').delete().eq('id', id);
    if (error) throw error;
    res.status(200).json({ success: true, message: "Permit record deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete permit record." });
  }
};

// ==========================================
// 5. UPDATE PERMIT ROUTE
// ==========================================
const updatePermit = async (req, res) => {
  try {
    const { id } = req.params;
    const { permit_number, date_issued, first_name, last_name, phone, address, location } = req.body;

    const { data: permitData, error: fetchError } = await supabase
      .from('permits').select('applicant_id, property_id').eq('id', id).single();
    if (fetchError) throw fetchError;

    await Promise.all([
      supabase.from('permits').update({ permit_number, date_issued }).eq('id', id),
      supabase.from('applicants').update({ first_name, last_name, phone: phone || null }).eq('id', permitData.applicant_id),
      supabase.from('properties').update({ address, location }).eq('id', permitData.property_id)
    ]);

    res.status(200).json({ success: true, message: "Permit updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update record" });
  }
};

// ==========================================
// 6. REMOVE SPECIFIC FILE ROUTE
// ==========================================
const removePermitFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { column_name, file_url } = req.body;

    const { data: permit, error: fetchError } = await supabase
      .from('permits').select(column_name).eq('id', id).single();
    if (fetchError) throw fetchError;

    const currentLinks = permit[column_name] || '';
    const linksArray = currentLinks
      .split(',')
      .map(l => l.trim())
      .filter(l => l !== '' && l !== file_url.trim());
      
    const newLinksString = linksArray.length > 0 ? linksArray.join(', ') : null;

    const { error: updateError } = await supabase
      .from('permits').update({ [column_name]: newLinksString }).eq('id', id);
    if (updateError) throw updateError;

    res.status(200).json({ success: true, new_links: newLinksString });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to remove file" });
  }
};

// EXPORT EVERY SINGLE FUNCTION
module.exports = { archivePermit, getPermits, getPermitStats, getMonthlyStats, deletePermit, updatePermit, removePermitFile };