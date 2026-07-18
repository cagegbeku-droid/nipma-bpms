const { google } = require('googleapis');
const { Readable } = require('stream');
require('dotenv').config();

// 1. Authenticate with Google Service Account
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  },
  scopes: ['https://www.googleapis.com/auth/drive.file']
});

const drive = google.drive({ version: 'v3', auth });
// This is the ID of the main folder where all permits will go
const MAIN_VAULT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// 2. Create a Subfolder for a specific permit
const createGoogleDriveFolder = async (folderName) => {
  try {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [MAIN_VAULT_FOLDER_ID]
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