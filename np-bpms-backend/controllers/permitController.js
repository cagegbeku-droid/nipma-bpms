const db = require('../config/db');
const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');

// 1. AUTHENTICATE WITH GOOGLE (The Master Key)
const KEYFILEPATH = path.join(process.cwd(), 'google-credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const driveService = google.drive({ version: 'v3', auth });

// 2. THE CLOUD UPLOADER HELPER
const uploadToDrive = async (fileObject) => {
  if (!fileObject) return null;

  // Turn the memory buffer into a readable data stream for Google
  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileObject.buffer);

  try {
    const response = await driveService.files.create({
      requestBody: {
        name: Date.now() + '_' + fileObject.originalname,
        parents: ['14ci4aw5WbtkbVb9-Gm7OaqP1z1WHjmWm'], // Your exact NiPMA Folder ID!
      },
      media: {
        mimeType: fileObject.mimetype,
        body: bufferStream,
      },
      // Ask Google to return the viewable web link!
      fields: 'id, webViewLink', 
    });
    
    return response.data.webViewLink; // Returns a secure "https://drive..." URL
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

    // 3. PARALLEL CLOUD UPLOADS
    // This array holds the 8 potential file slots
    const fileFields = ['certificate', 'drawings', 'sitePlan', 'permitForm', 'receipts', 'jacket', 'indenture', 'geoReference'];
    const uploadedLinks = {};

    // Fire off all uploads at the exact same time
    await Promise.all(fileFields.map(async (field) => {
      if (files[field] && files[field][0]) {
        uploadedLinks[field] = await uploadToDrive(files[field][0]);
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
        // Now we save the Google Drive links into the database!
        uploadedLinks['certificate'], uploadedLinks['drawings'], uploadedLinks['sitePlan'],
        uploadedLinks['permitForm'], uploadedLinks['receipts'], uploadedLinks['jacket'],
        uploadedLinks['indenture'], uploadedLinks['geoReference']
      ]
    );

    res.json({ success: true, message: 'Permit successfully archived to Google Drive!' });
  } catch (error) {
    console.error('Error archiving permit:', error);
    res.status(500).json({ success: false, message: 'Failed to archive permit' });
  }
};

module.exports = { getPermitStats, getMonthlyStats, getPermits, archivePermit };