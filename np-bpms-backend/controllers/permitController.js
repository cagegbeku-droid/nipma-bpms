require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { createGoogleDriveFolder, uploadFileToDrive } = require('../utils/googleDrive');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_KEY in .env file.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. GET ALL PERMITS
// ==========================================
const getPermits = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('permits')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;

    const formattedData = (data || []).map(permit => ({
      id: permit.id,
      permit_number: permit.permit_number,
      date_issued: permit.date_issued,
      purpose: permit.purpose || 'RESIDENTIAL',
      applicant_name: permit.applicant_name,
      phone: permit.phone || '',
      address: permit.address || '',
      location: permit.location || '',
      certificate_link: permit.certificate_link || null,
      drawings_links: permit.drawings_links || null,
      permit_form_link: permit.permit_form_link || null,
      receipts_links: permit.receipts_links || null,
      upload_status: permit.upload_status || 'completed',
      status: permit.status || 'Synced'
    }));

    res.status(200).json({ success: true, data: formattedData });
  } catch (error) {
    console.error("Fetch Permits Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch permits." });
  }
};

// ==========================================
// 2. STATS ENDPOINTS
// ==========================================
const getPermitStats = async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('permits')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
    res.status(200).json({ success: true, total: count || 0 });
  } catch (error) {
    console.error("Get Stats Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats." });
  }
};

const getMonthlyStats = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('permits')
      .select('date_issued');

    if (error) throw error;

    const monthlyCounts = {};
    (data || []).forEach(item => {
      if (item.date_issued) {
        const monthKey = String(item.date_issued).substring(0, 7); // YYYY-MM
        monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
      }
    });

    const formattedStats = Object.keys(monthlyCounts)
      .sort()
      .map(month => ({ month, count: monthlyCounts[month] }));

    res.status(200).json({ success: true, data: formattedStats });
  } catch (error) {
    console.error("Monthly Stats Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch monthly stats." });
  }
};

// ==========================================
// 3. SILENT BACKGROUND FILE WORKER (PARALLEL & FAST)
// ==========================================
const processFilesInBackground = async (files, permitId, permitNumber, applicantName) => {
  if (!files || Object.keys(files).length === 0) return;

  try {
    const safeName = (applicantName || 'APPLICANT').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanNum = (permitNumber || '').replace(/[\/\\]/g, '_');
    const mainFolderName = `${cleanNum} - ${safeName}`;

    // Create Root Master Folder
    const mainFolderId = await createGoogleDriveFolder(mainFolderName);

    // Parallel Subfolder Creation & Uploads
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

    // Update Supabase Record with Drive Links
    const { error: updateError } = await supabase
      .from('permits')
      .update({
        certificate_link: certificateLinks[0] || null,
        drawings_links: drawingLinks.filter(Boolean).join(', ') || null,
        permit_form_link: permitFormLinks.filter(Boolean).join(', ') || null,
        receipts_links: receiptLinks.filter(Boolean).join(', ') || null,
        upload_status: 'completed'
      })
      .eq('id', permitId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Background Processing Failed for Permit ID ${permitId}:`, error);
    await supabase.from('permits').update({ upload_status: 'failed' }).eq('id', permitId);
  }
};

// ==========================================
// 4. ARCHIVE ROUTE (INSTANT SAVE)
// ==========================================
const archivePermit = async (req, res) => {
  try {
    const { permitNumber, dateIssued, purpose, applicantName, phone, address, location } = req.body;

    if (!permitNumber || !applicantName) {
      return res.status(400).json({ success: false, message: "Permit Number and Applicant Name are required." });
    }

    const hasFiles = req.files && Object.keys(req.files).length > 0;

    // STEP 1: Instant Database Insert (< 0.5s)
    const { data: permitData, error: permitError } = await supabase
      .from('permits')
      .insert([{
        permit_number: permitNumber.trim().toUpperCase(),
        date_issued: dateIssued,
        purpose: (purpose || 'RESIDENTIAL').trim().toUpperCase(),
        applicant_name: applicantName.trim().toUpperCase(),
        phone: phone ? phone.trim() : null,
        address: (address || location || 'N/A').trim().toUpperCase(),
        location: (location || 'N/A').trim().toUpperCase(),
        upload_status: hasFiles ? 'processing' : 'completed',
        status: 'Synced'
      }])
      .select()
      .single();

    if (permitError) throw permitError;

    // STEP 2: Respond immediately to user
    res.status(200).json({ 
      success: true, 
      message: "Permit record archived successfully.",
      data: permitData 
    });

    // STEP 3: Kick off Google Drive processing asynchronously in background
    if (hasFiles) {
      processFilesInBackground(req.files, permitData.id, permitNumber, applicantName);
    }
  } catch (error) {
    console.error("Archive Error:", error);
    res.status(500).json({ success: false, message: `Failed to archive record: ${error.message}` });
  }
};

// ==========================================
// 5. DELETE PERMIT ROUTE
// ==========================================
const deletePermit = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('permits').delete().eq('id', id);

    if (error) throw error;
    res.status(200).json({ success: true, message: "Permit record deleted successfully." });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete permit record." });
  }
};

// ==========================================
// 6. UPDATE PERMIT ROUTE (FLEXIBLE FULL & PARTIAL UPDATES)
// ==========================================
const updatePermit = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      permit_number, date_issued, purpose, applicant_name, 
      phone, address, location, status,
      certificate_link, drawings_links, permit_form_link, receipts_links, upload_status 
    } = req.body;

    // Build update object dynamically to support both text edits and document uploads
    const updatePayload = {};
    if (permit_number !== undefined) updatePayload.permit_number = permit_number;
    if (date_issued !== undefined) updatePayload.date_issued = date_issued;
    if (purpose !== undefined) updatePayload.purpose = purpose;
    if (applicant_name !== undefined) updatePayload.applicant_name = applicant_name;
    if (phone !== undefined) updatePayload.phone = phone || null;
    if (address !== undefined) updatePayload.address = address;
    if (location !== undefined) updatePayload.location = location;
    if (status !== undefined) updatePayload.status = status;
    if (certificate_link !== undefined) updatePayload.certificate_link = certificate_link;
    if (drawings_links !== undefined) updatePayload.drawings_links = drawings_links;
    if (permit_form_link !== undefined) updatePayload.permit_form_link = permit_form_link;
    if (receipts_links !== undefined) updatePayload.receipts_links = receipts_links;
    if (upload_status !== undefined) updatePayload.upload_status = upload_status;

    const { data: updatedData, error: updateError } = await supabase
      .from('permits')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({ 
      success: true, 
      message: "Permit updated successfully.", 
      data: updatedData 
    });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ success: false, message: `Failed to update record: ${error.message}` });
  }
};

// ==========================================
// 7. REMOVE SPECIFIC FILE ROUTE
// ==========================================
const removePermitFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { column_name, file_url } = req.body;

    if (!column_name || !file_url) {
      return res.status(400).json({ success: false, message: "Column name and file URL are required." });
    }

    const { data: permit, error: fetchError } = await supabase
      .from('permits')
      .select(column_name)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const currentLinks = permit[column_name] || '';
    const linksArray = currentLinks
      .split(',')
      .map(l => l.trim())
      .filter(l => l !== '' && l !== file_url.trim());
      
    const newLinksString = linksArray.length > 0 ? linksArray.join(', ') : null;

    const { error: updateError } = await supabase
      .from('permits')
      .update({ [column_name]: newLinksString })
      .eq('id', id);

    if (updateError) throw updateError;

    res.status(200).json({ success: true, new_links: newLinksString });
  } catch (error) {
    console.error("Remove File Error:", error);
    res.status(500).json({ success: false, message: "Failed to remove file." });
  }
};

module.exports = { 
  archivePermit, 
  getPermits, 
  getPermitStats, 
  getMonthlyStats, 
  deletePermit, 
  updatePermit, 
  removePermitFile 
};