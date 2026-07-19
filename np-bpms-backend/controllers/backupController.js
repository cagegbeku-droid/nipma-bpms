const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createGoogleDriveFolder, uploadFileToDrive } = require('../utils/googleDrive');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const triggerBackup = async (req, res) => {
  // SECURITY: Reject the request if it doesn't have the exact secret password
  const providedKey = req.headers['x-backup-key'];
  if (providedKey !== process.env.BACKUP_SECRET) {
    console.warn("Unauthorized backup attempt blocked!");
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  console.log("⏰ Starting external-triggered database backup...");
  
  try {
    // 1. Pull data from all tables
    const { data: applicants } = await supabase.from('applicants').select('*');
    const { data: properties } = await supabase.from('properties').select('*');
    const { data: permits } = await supabase.from('permits').select('*');

    const backupData = {
      backup_date: new Date().toISOString(),
      data: { applicants, properties, permits }
    };

    // 2. Save locally as a temporary file
    const dateString = new Date().toISOString().split('T')[0];
    const fileName = `NP_BPMS_DB_Backup_${dateString}.json`;
    const filePath = path.join(__dirname, '..', 'uploads', fileName);
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

    // 3. Upload to Drive
    const backupFolderId = await createGoogleDriveFolder('Database_Backups');
    const mockFile = {
      path: filePath,
      originalname: fileName,
      filename: fileName,
      mimetype: 'application/json'
    };
    await uploadFileToDrive(mockFile, backupFolderId);

    // 4. Cleanup temporary file
    fs.unlinkSync(filePath);
    
    console.log(`✅ Backup successful! Saved ${fileName} to Drive.`);
    
    // Return a tiny success string so cron-job.org doesn't crash
    return res.status(200).send("OK");
    
  } catch (error) {
    console.error("❌ Backup failed:", error);
    
    // Return a tiny error string
    return res.status(500).send("Failed");
  }
};

module.exports = { triggerBackup };