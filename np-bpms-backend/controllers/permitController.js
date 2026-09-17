require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { createGoogleDriveFolder, getOrCreateGoogleDriveFolder, uploadFileToDrive, deleteFileFromDrive } = require('../utils/googleDrive');

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
// 3. ARCHIVE ROUTE (WITH DIRECT STREAMING FILE UPLOADS)
// ==========================================
const archivePermit = async (req, res) => {
  try {
    const { permitNumber, dateIssued, purpose, applicantName, phone, address, location } = req.body;

    if (!permitNumber || !applicantName) {
      return res.status(400).json({ success: false, message: "Permit Number and Applicant Name are required." });
    }

    const cleanNum = permitNumber.trim().toUpperCase();
    const cleanApplicant = applicantName.trim().toUpperCase();
    const hasFiles = req.files && Object.keys(req.files).length > 0;

    let certificate_link = null;
    let drawings_links = null;
    let permit_form_link = null;

    if (hasFiles) {
      const safeName = cleanApplicant.replace(/[^a-zA-Z0-9]/g, '_');
      const safeNum = cleanNum.replace(/[\/\\]/g, '_');
      const mainFolderName = `${safeNum} - ${safeName}`;

      const masterFolderId = await getOrCreateGoogleDriveFolder(mainFolderName);

      const processAndUpload = async (fileArray, subFolderName) => {
        if (!fileArray || fileArray.length === 0) return [];
        const subFolderId = await getOrCreateGoogleDriveFolder(subFolderName, masterFolderId);
        const uploadTasks = fileArray.map(file => uploadFileToDrive(file, subFolderId));
        return await Promise.all(uploadTasks);
      };

      const [certLinks, drawLinks, formLinks] = await Promise.all([
        processAndUpload(req.files['certificate'], '1. Permit Certificates'),
        processAndUpload(req.files['drawings'], '2. Architectural Drawings'),
        processAndUpload(req.files['permitForm'], '3. Permit Forms')
      ]);

      certificate_link = certLinks[0] || null;
      drawings_links = drawLinks.filter(Boolean).join(', ') || null;
      permit_form_link = formLinks.filter(Boolean).join(', ') || null;
    }

    // Insert Permit Record into Supabase
    const { data: permitData, error: permitError } = await supabase
      .from('permits')
      .insert([{
        permit_number: cleanNum,
        date_issued: dateIssued,
        purpose: (purpose || 'RESIDENTIAL').trim().toUpperCase(),
        applicant_name: cleanApplicant,
        phone: phone ? phone.trim() : null,
        address: (address || location || 'N/A').trim().toUpperCase(),
        location: (location || 'N/A').trim().toUpperCase(),
        certificate_link,
        drawings_links,
        permit_form_link,
        upload_status: 'completed',
        status: 'Synced'
      }])
      .select()
      .single();

    if (permitError) throw permitError;

    res.status(200).json({ 
      success: true, 
      message: "Permit record and documents archived successfully.",
      data: permitData 
    });

  } catch (error) {
    console.error("Archive Error:", error);
    res.status(500).json({ success: false, message: `Failed to archive record: ${error.message}` });
  }
};

// ==========================================
// 4. DIRECT MULTIPART DOCUMENT ATTACHMENT ROUTE (SUPPORTS 1, 2, OR ALL 3 AT ONCE)
// ==========================================
const uploadPermitDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;
    const files = req.files || {};

    // 1. Fetch current permit record
    const { data: permit, error: fetchError } = await supabase
      .from('permits')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !permit) {
      return res.status(404).json({ success: false, message: "Permit record not found." });
    }

    // Determine files per category
    let certFiles = [];
    let drawingFiles = [];
    let formFiles = [];

    if (Array.isArray(files)) {
      if (category === 'certificate') certFiles = files;
      else if (category === 'drawings') drawingFiles = files;
      else if (category === 'permitForm') formFiles = files;
    } else {
      if (files['certificate']) certFiles = files['certificate'];
      if (files['drawings']) drawingFiles = files['drawings'];
      if (files['permitForm']) formFiles = files['permitForm'];
      if (files['files']) {
        if (category === 'certificate') certFiles = files['files'];
        else if (category === 'drawings') drawingFiles = files['files'];
        else if (category === 'permitForm') formFiles = files['files'];
      }
    }

    const totalFiles = certFiles.length + drawingFiles.length + formFiles.length;
    if (totalFiles === 0) {
      return res.status(400).json({ success: false, message: "No files received for upload." });
    }

    const cleanNum = (permit.permit_number || `PERMIT_${id}`).replace(/[\/\\]/g, '_').trim();
    const cleanApplicant = (permit.applicant_name || 'APPLICANT').replace(/[^a-zA-Z0-9]/g, '_').trim();
    const masterFolderName = `${cleanNum} - ${cleanApplicant}`;

    const masterFolderId = await getOrCreateGoogleDriveFolder(masterFolderName);

    const updatePayload = {
      upload_status: 'completed'
    };

    // 1. Process Certificate
    if (certFiles.length > 0) {
      const subFolderId = await getOrCreateGoogleDriveFolder('1. Permit Certificates', masterFolderId);
      const link = await uploadFileToDrive(certFiles[0], subFolderId);
      updatePayload.certificate_link = link;
    }

    // 2. Process Drawings
    if (drawingFiles.length > 0) {
      const subFolderId = await getOrCreateGoogleDriveFolder('2. Architectural Drawings', masterFolderId);
      const uploadTasks = drawingFiles.map(f => uploadFileToDrive(f, subFolderId));
      const newLinks = await Promise.all(uploadTasks);
      const existing = (permit.drawings_links && permit.drawings_links !== 'null')
        ? permit.drawings_links.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      updatePayload.drawings_links = [...existing, ...newLinks.filter(Boolean)].join(', ');
    }

    // 3. Process Permit Form
    if (formFiles.length > 0) {
      const subFolderId = await getOrCreateGoogleDriveFolder('3. Permit Forms', masterFolderId);
      const uploadTasks = formFiles.map(f => uploadFileToDrive(f, subFolderId));
      const newLinks = await Promise.all(uploadTasks);
      const existing = (permit.permit_form_link && permit.permit_form_link !== 'null')
        ? permit.permit_form_link.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      updatePayload.permit_form_link = [...existing, ...newLinks.filter(Boolean)].join(', ');
    }

    // 4. Update Supabase record in one single query
    const { data: updatedPermit, error: updateError } = await supabase
      .from('permits')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      message: "Documents uploaded and archived to Google Drive successfully.",
      permit: updatedPermit,
      certificate_link: updatedPermit.certificate_link,
      drawings_links: updatedPermit.drawings_links,
      permit_form_link: updatedPermit.permit_form_link,
      new_links: updatePayload.certificate_link || updatePayload.drawings_links || updatePayload.permit_form_link
    });

  } catch (error) {
    console.error("Document Upload Error:", error);
    res.status(500).json({ success: false, message: `Failed to upload document: ${error.message}` });
  }
};

// ==========================================
// 5. DELETE PERMIT ROUTE
// ==========================================
const deletePermit = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch existing permit files to clean up Drive
    const { data: permit } = await supabase
      .from('permits')
      .select('certificate_link, drawings_links, permit_form_link, receipts_links')
      .eq('id', id)
      .single();

    if (permit) {
      const allLinks = [
        ...(permit.certificate_link ? [permit.certificate_link] : []),
        ...(permit.drawings_links ? permit.drawings_links.split(',') : []),
        ...(permit.permit_form_link ? permit.permit_form_link.split(',') : []),
        ...(permit.receipts_links ? permit.receipts_links.split(',') : [])
      ];
      allLinks.forEach(link => {
        if (link && link.trim()) deleteFileFromDrive(link.trim()).catch(() => {});
      });
    }

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
    if (certificate_link !== undefined) updatePayload.certificate_link = (certificate_link && String(certificate_link).trim() !== '' && certificate_link !== 'null') ? String(certificate_link).trim() : null;
    if (drawings_links !== undefined) updatePayload.drawings_links = (drawings_links && String(drawings_links).trim() !== '' && drawings_links !== 'null') ? String(drawings_links).trim() : null;
    if (permit_form_link !== undefined) updatePayload.permit_form_link = (permit_form_link && String(permit_form_link).trim() !== '' && permit_form_link !== 'null') ? String(permit_form_link).trim() : null;
    if (receipts_links !== undefined) updatePayload.receipts_links = (receipts_links && String(receipts_links).trim() !== '' && receipts_links !== 'null') ? String(receipts_links).trim() : null;
    if (upload_status !== undefined) updatePayload.upload_status = upload_status;

    // Clean up Google Drive files if document columns were explicitly cleared
    const docCols = ['certificate_link', 'drawings_links', 'permit_form_link', 'receipts_links'];
    const colsToClean = docCols.filter(col => updatePayload[col] === null);
    if (colsToClean.length > 0) {
      const { data: oldRecord } = await supabase
        .from('permits')
        .select(colsToClean.join(','))
        .eq('id', id)
        .single();
      if (oldRecord) {
        colsToClean.forEach(col => {
          if (oldRecord[col]) {
            oldRecord[col].split(',').forEach(link => {
              if (link && link.trim()) deleteFileFromDrive(link.trim()).catch(() => {});
            });
          }
        });
      }
    }

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
      .filter(l => l !== '' && l !== 'null' && l !== file_url.trim());
      
    const newLinksString = linksArray.length > 0 ? linksArray.join(', ') : null;

    const { error: updateError } = await supabase
      .from('permits')
      .update({ [column_name]: newLinksString })
      .eq('id', id);

    if (updateError) throw updateError;

    // Delete file from Google Drive in background
    try {
      await deleteFileFromDrive(file_url);
    } catch (dErr) {
      console.warn("Drive cleanup warning:", dErr.message);
    }

    res.status(200).json({ success: true, new_links: newLinksString });
  } catch (error) {
    console.error("Remove File Error:", error);
    res.status(500).json({ success: false, message: "Failed to remove file." });
  }
};

module.exports = { 
  archivePermit, 
  uploadPermitDocument,
  getPermits, 
  getPermitStats, 
  getMonthlyStats, 
  deletePermit, 
  updatePermit, 
  removePermitFile 
};