const { google } = require('googleapis');
const { Readable } = require('stream');
require('dotenv').config();

// 1. Authenticate with Google OAuth2 (This bypasses the 0-byte quota limit!)
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

// Hand the Refresh Token to the client so it can act on your behalf
oauth2Client.setCredentials({ 
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN 
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// This is the ID of the main folder where all permits will go
const MAIN_VAULT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// 2. Create a Subfolder (either in the Main Vault, or inside another folder)
const createGoogleDriveFolder = async (folderName, parentId = null) => {
  try {
    // NEW: If a parentId is provided, nest it there. Otherwise, default to the Main Vault.
    const targetParentId = parentId || MAIN_VAULT_FOLDER_ID;

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [targetParentId]
    };

    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    });
    
    return folder.data.id;
  } catch (error) {
    console.error("Drive Folder Creation Error:", error);
    throw error;
  }
};

// 3. Upload a file (like an image or PDF) into that subfolder
const uploadFileToDrive = async (file, folderId) => {
  try {
    // Convert the buffer coming from Multer into a stream
    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);

    const fileMetadata = {
      name: file.originalname,
      parents: [folderId]
    };

    const media = {
      mimeType: file.mimetype,
      body: bufferStream
    };

    const uploadedFile = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    // We make the file readable by anyone with the link so your React app can show it
    await drive.permissions.create({
      fileId: uploadedFile.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    return uploadedFile.data.webViewLink;
  } catch (error) {
    console.error("Drive File Upload Error:", error);
    throw error;
  }
};

module.exports = { createGoogleDriveFolder, uploadFileToDrive };