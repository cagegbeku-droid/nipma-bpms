// ==========================================
// 1. KEEP YOUR GOOGLE DRIVE & SUPABASE SETUP HERE
// (Do not delete your require('supabase') or google auth stuff)
// ==========================================

// ==========================================
// 2. THE FETCH FUNCTIONS (Restored)
// ==========================================
const getPermits = async (req, res) => {
  try {
    const { data, error } = await supabase.from('permits').select('*').order('id', { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch permits" });
  }
};

const getPermitStats = async (req, res) => {
  try {
    // Bulletproof method: Just grab the IDs and count the array
    const { data, error } = await supabase.from('permits').select('id');
    
    if (error) throw error;
    
    // Return the length of the array as the total count
    res.status(200).json({ success: true, total: data.length });
    
  } catch (error) {
    // ENTERPRISE UPGRADE: This prints the exact error to your Render dashboard!
    console.error("Critical Stats Error:", error); 
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
};
const getMonthlyStats = async (req, res) => {
  // Placeholder for monthly stats logic
  res.status(200).json({ success: true, data: [] });
};

// ==========================================
// 3. YOUR UPGRADED ARCHIVE FUNCTION
// ==========================================
const archivePermit = async (req, res) => {
  try {
    const { permitNumber, dateIssued, firstName, lastName, phone, plotNumber, community, buildingType } = req.body;

    const folderName = `${permitNumber.replace(/\//g, '_')} - ${lastName}`;
    
    // NOTE: Make sure these match your actual function names at the top of the file!
    const permitFolderId = await createGoogleDriveFolder(folderName); 

    const processAndUpload = async (fileArray) => {
      if (!fileArray || fileArray.length === 0) return [];
      const uploadedLinks = [];
      
      for (const file of fileArray) {
        const link = await uploadFileToDrive(file, permitFolderId);
        uploadedLinks.push(link);
      }
      return uploadedLinks;
    };

    const certificateLinks = await processAndUpload(req.files['certificate']);
    const drawingLinks = await processAndUpload(req.files['drawings']);
    const indentureLinks = await processAndUpload(req.files['indenture']);
    const receiptLinks = await processAndUpload(req.files['receipts']);
    const geoRefLinks = await processAndUpload(req.files['geoReference']);

    const { data, error } = await supabase
      .from('permits')
      .insert([{
        permit_number: permitNumber,
        date_issued: dateIssued,
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        plot_number: plotNumber,
        community: community,
        building_type: buildingType,
        certificate_link: certificateLinks[0] || null,
        drawings_links: drawingLinks.join(', ') || null,
        indenture_link: indentureLinks.join(', ') || null,
        receipts_links: receiptLinks.join(', ') || null,
        georef_link: geoRefLinks[0] || null
      }]);

    if (error) throw error;

    res.status(200).json({ success: true, message: "Archived successfully" });

  } catch (error) {
    console.error("Archive Error:", error);
    res.status(500).json({ success: false, message: "Failed to archive permit" });
  }
};

// ==========================================
// 4. THE CRITICAL EXPORT BLOCK (Do not delete!)
// ==========================================
module.exports = {
  archivePermit,
  getPermits,
  getPermitStats,
  getMonthlyStats
};