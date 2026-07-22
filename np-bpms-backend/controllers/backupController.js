const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { uploadFileToDrive } = require('../utils/googleDrive');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const triggerBackup = async (req, res) => {
  // SECURITY: Reject the request if it doesn't have the exact secret password
  const providedKey = req.headers['x-backup-key'];
  if (providedKey !== process.env.BACKUP_SECRET) {
    console.warn("Unauthorized backup attempt blocked!");
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  console.log("⏰ Starting external-triggered database backup...");
  
  let filePath = null;

  try {
    // 1. Pull data from all tables
    const { data: applicants, error: err1 } = await supabase.from('applicants').select('*');
    const { data: properties, error: err2 } = await supabase.from('properties').select('*');
    const { data: permits, error: err3 } = await supabase.from('permits').select('*');

    if (err1 || err2 || err3) {
      console.error("Supabase fetch warning:", err1 || err2 || err3);
    }

    const backupData = {
      backup_date: new Date().toISOString(),
      data: { 
        applicants: applicants || [], 
        properties: properties || [], 
        permits: permits || [] 
      }
    };

    // 2. Save locally as a temporary file
    const dateString = new Date().toISOString().split('T')[0];
    const fileName = `NP_BPMS_DB_Backup_${dateString}.json`;
    
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

    // 3. Upload directly to your main 5TB Google Drive Folder ID
    const targetFolderId = process.env.GOOGLE_FOLDER_ID;
    if (!targetFolderId) {
      throw new Error("GOOGLE_FOLDER_ID is missing from environment variables!");
    }

    const mockFile = {
      path: filePath,
      originalname: fileName,
      filename: fileName,
      mimetype: 'application/json'
    };
    
    await uploadFileToDrive(mockFile, targetFolderId);

    // 4. Cleanup temporary file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    console.log(`✅ Backup successful! Saved ${fileName} to Drive folder.`);
    
    // Return a tiny success string so cron-job.org stays happy
    return res.status(200).send("OK");
    
  } catch (error) {
    console.error("❌ Backup failed:", error.message || error);
    
    // Ensure temporary file cleanup on failure
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
    
    // Return a tiny error string to prevent large output crashes
    return res.status(500).send("Failed");
  }
};

module.exports = { triggerBackup };