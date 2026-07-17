const db = require('../config/db');
const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');

// 1. AUTHENTICATE WITH GOOGLE
const KEYFILEPATH = path.join(process.cwd(), 'google-credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const driveService = google.drive({ version: 'v3', auth });

const MASTER_FOLDER_ID = '14ci4aw5WbtkbVb9-Gm7OaqP1z1WHjmWm'; // NiPMA BPMS Archives

// 2. NEW: THE FOLDER CREATOR
// This robot creates a new folder inside the master folder and returns its specific ID
const createDriveFolder = async (folderName) => {
  try {
    const response = await driveService.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [MASTER_FOLDER_ID], 
      },
      fields: 'id',
    });
    return response.data.id; // Returns the ID of the brand new folder
  } catch (error) {
    console.error('Error creating folder:', error);
    return null;
  }
};

// 3. THE CLOUD UPLOADER (Updated to accept a specific folder ID)
const uploadToDrive = async (fileObject, targetFolderId) => {
  if (!fileObject || !targetFolderId) return null;

  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileObject.buffer);

  try {
    const response = await driveService.files.create({
      requestBody: {
        name: fileObject.originalname, // Keeps the original name (e.g., "site-plan.pdf")
        parents: [targetFolderId],     // Shoots it into the applicant's specific folder!
      },
      media: {
        mimeType: fileObject.mimetype,
        body: bufferStream,
      },
      fields: 'id, webViewLink', 
    });
    
    return response.data.webViewLink; 
  } catch (error) {
    console.error('Error uploading to Drive:', error);
    return null;
  }
};

const getPermitStats = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT COUNT(*) as total FROM permits`);
    res.json({ success: true, data: { total_archived: rows[0].total } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getMonthlyStats = async (req, res) => {
  try {
    const query = `
      SELECT strftime('%m', archived_at) as month_num,
             strftime('%Y', archived_at) as year,
             COUNT(*) as count 
      FROM permits 
      GROUP BY year, month_num 
      ORDER BY year ASC, month_num ASC
    `;
    const [rows] = await db.query(query);
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedData = rows.map(r => ({
      month: monthNames[parseInt(r.month_num, 10) - 1] + ' ' + r.year,
      Archived: r.count
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getPermits = async (req, res) => {
  try {
    const query = `
      SELECT p.permit_number, p.date_issued, p.archived_at,
             p.file_permit_certificate, p.file_architectural_drawings, p.file_site_plan, 
             p.file_permit_form, p.file_receipts, p.file_jacket, p.file_indenture, p.file_geo_reference,
             a.first_name, a.last_name,
             pr.plot_number, pr.building_type
      FROM permits p
      JOIN applicants a ON p.applicant_id = a.id
      JOIN properties pr ON p.property_id = pr.id
      ORDER BY p.archived_at DESC
    `;
    const [rows] = await db.query(query);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const archivePermit = async (req, res) => {
  try {
    const { permitNumber, dateIssued, firstName, lastName, phone, plotNumber, community, buildingType } = req.body;
    const files = req.files || {};

    // 4. CREATE THE APPLICANT'S FOLDER FIRST
    const folderName = `Permit ${permitNumber} - ${firstName} ${lastName}`;
    const applicantFolderId = await createDriveFolder(folderName);

    if (!applicantFolderId) {
      return res.status(500).json({ success: false, message: 'Failed to create Google Drive folder' });
    }

    // 5. UPLOAD ALL FILES INTO THE NEW FOLDER
    const fileFields = ['certificate', 'drawings', 'sitePlan', 'permitForm', 'receipts', 'jacket', 'indenture', 'geoReference'];
    const uploadedLinks = {};

    await Promise.all(fileFields.map(async (field) => {
      if (files[field] && files[field][0]) {
        // Pass the new specific folder ID to the uploader
        uploadedLinks[field] = await uploadToDrive(files[field][0], applicantFolderId);
      } else {
        uploadedLinks[field] = null;
      }
    }));

    const [appResult] = await db.query(
      `INSERT INTO applicants (first_name, last_name, phone) VALUES (?, ?, ?)`, [firstName, lastName, phone]
    );
    const [propResult] = await db.query(
      `INSERT INTO properties (plot_number, community, building_type) VALUES (?, ?, ?)`, [plotNumber, community, buildingType]
    );

    await db.query(
      `INSERT INTO permits (
        permit_number, applicant_id, property_id, date_issued,
        file_permit_certificate, file_architectural_drawings, file_site_plan, 
        file_permit_form, file_receipts, file_jacket, file_indenture, file_geo_reference
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        permitNumber, appResult.insertId, propResult.insertId, dateIssued,
        uploadedLinks['certificate'], uploadedLinks['drawings'], uploadedLinks['sitePlan'],
        uploadedLinks['permitForm'], uploadedLinks['receipts'], uploadedLinks['jacket'],
        uploadedLinks['indenture'], uploadedLinks['geoReference']
      ]
    );

    res.json({ success: true, message: 'Permit and folder successfully created in Google Drive!' });
  } catch (error) {
    console.error('Error archiving permit:', error);
    res.status(500).json({ success: false, message: 'Failed to archive permit' });
  }
};

module.exports = { getPermitStats, getMonthlyStats, getPermits, archivePermit };