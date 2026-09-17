const { google } = require('googleapis');
const { Readable } = require('stream');
require('dotenv').config();

// 1. Authenticate with Google OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "https://developers.google.com/oauthplayground"
);

// Hand the Refresh Token to the client so it can act on your behalf
oauth2Client.setCredentials({ 
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN 
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Main Vault Folder ID
const MAIN_VAULT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// 2. Get or Create Folder (avoids duplicates, sets reader permission)
const getOrCreateGoogleDriveFolder = async (folderName, parentId = null) => {
  try {
    const targetParentId = parentId || MAIN_VAULT_FOLDER_ID;
    const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = `mimeType='application/vnd.google-apps.folder' and name='${escapedName}' and '${targetParentId}' in parents and trashed=false`;

    try {
      const searchRes = await drive.files.list({
        q: q,
        fields: 'files(id, name)',
        spaces: 'drive',
        pageSize: 5
      });

      if (searchRes.data.files && searchRes.data.files.length > 0) {
        return searchRes.data.files[0].id;
      }
    } catch (searchErr) {
      console.warn("Folder search notice:", searchErr.message);
    }

    const folderRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [targetParentId]
      },
      fields: 'id'
    });

    const newFolderId = folderRes.data.id;

    // Ensure folder is readable by anyone with the link
    try {
      await drive.permissions.create({
        fileId: newFolderId,
        requestBody: { role: 'reader', type: 'anyone' }
      });
    } catch (pErr) {
      // Non-fatal if domain policies restrict
    }

    return newFolderId;
  } catch (error) {
    console.error("Drive Folder Get/Create Error:", error);
    throw error;
  }
};

const createGoogleDriveFolder = async (folderName, parentId = null) => {
  return await getOrCreateGoogleDriveFolder(folderName, parentId);
};

// 3. Upload a file buffer into a folder with public view permission
const uploadFileToDrive = async (file, folderId) => {
  try {
    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);

    const safeFilename = `${Date.now()}-${(file.originalname || 'document.pdf').replace(/[\/\\]/g, '_')}`;

    const fileMetadata = {
      name: safeFilename,
      parents: [folderId]
    };

    const media = {
      mimeType: file.mimetype || 'application/pdf',
      body: bufferStream
    };

    const uploadedFile = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    // Make file readable by anyone with the link
    try {
      await drive.permissions.create({
        fileId: uploadedFile.data.id,
        requestBody: { role: 'reader', type: 'anyone' }
      });
    } catch (permErr) {
      console.warn("Permission warning for file:", permErr.message);
    }

    return uploadedFile.data.webViewLink;
  } catch (error) {
    console.error("Drive File Upload Error:", error);
    throw error;
  }
};

// 4. Extract File ID from Google Drive URL
const extractDriveFileId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

// 5. Delete a file from Google Drive
const deleteFileFromDrive = async (fileUrlOrId) => {
  try {
    const fileId = extractDriveFileId(fileUrlOrId) || fileUrlOrId;
    if (!fileId || typeof fileId !== 'string' || fileId.length < 10) return false;
    await drive.files.delete({ fileId });
    return true;
  } catch (err) {
    console.warn("Drive file delete notice (non-fatal):", err.message);
    return false;
  }
};

module.exports = { 
  drive,
  MAIN_VAULT_FOLDER_ID,
  getOrCreateGoogleDriveFolder,
  createGoogleDriveFolder, 
  uploadFileToDrive,
  extractDriveFileId,
  deleteFileFromDrive
};