const archivePermit = async (req, res) => {
  try {
    // 1. Extract the text data from the form
    const { permitNumber, dateIssued, firstName, lastName, phone, plotNumber, community, buildingType } = req.body;

    // --- GOOGLE DRIVE LOGIC ---
    
    // 2. Create the master folder for this specific permit in Google Drive
    const folderName = `${permitNumber.replace(/\//g, '_')} - ${lastName}`;
    // NOTE: Replace 'createGoogleDriveFolder' and 'uploadFileToDrive' with your exact function names
    const permitFolderId = await createGoogleDriveFolder(folderName); 

    // 3. Helper function to upload arrays of files into that folder
    const processAndUpload = async (fileArray) => {
      if (!fileArray || fileArray.length === 0) return [];
      const uploadedLinks = [];
      
      for (const file of fileArray) {
        // Uploads the file to Google Drive and grabs the view link
        const link = await uploadFileToDrive(file, permitFolderId);
        uploadedLinks.push(link);
      }
      return uploadedLinks;
    };

    // 4. Safely loop through and upload every file, whether it's 1 or 20!
    const certificateLinks = await processAndUpload(req.files['certificate']);
    const drawingLinks = await processAndUpload(req.files['drawings']);
    const indentureLinks = await processAndUpload(req.files['indenture']);
    const receiptLinks = await processAndUpload(req.files['receipts']);
    const geoRefLinks = await processAndUpload(req.files['geoReference']);

    // --- SUPABASE LOGIC ---

    // 5. Save the text data AND the Google Drive links to your Supabase database
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
        // Save the first link for single files, and join arrays with commas for multiple files
        certificate_link: certificateLinks[0] || null,
        drawings_links: drawingLinks.join(', ') || null,
        indenture_link: indentureLinks.join(', ') || null,
        receipts_links: receiptLinks.join(', ') || null,
        georef_link: geoRefLinks[0] || null
      }]);

    if (error) throw error;

    // 6. Tell the frontend it was a complete success!
    res.status(200).json({ success: true, message: "Archived successfully" });

  } catch (error) {
    console.error("Archive Error:", error);
    res.status(500).json({ success: false, message: "Failed to archive permit" });
  }
};