import React, { useState } from 'react';
import DocumentScanner from '../DocumentScanner';

const NewPermit = () => {
  const [formData, setFormData] = useState({
    permitNumber: '', dateIssued: '', firstName: '', lastName: '', phone: '', plotNumber: '', community: '', buildingType: 'Residential'
  });
  const [files, setFiles] = useState({});
  const [message, setMessage] = useState('');
  
  // Scanner State Variables
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanField, setCurrentScanField] = useState(null);

  const handleTextChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e) => setFiles({ ...files, [e.target.name]: e.target.files[0] });

  // Handle saving the PDF from the scanner directly into our form's file state
  const handleScanSave = (file) => {
    setFiles({ ...files, [currentScanField]: file });
    setIsScanning(false);
    setCurrentScanField(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Uploading files to Archive Vault...");
    
    const submitData = new FormData();
    Object.keys(formData).forEach(key => submitData.append(key, formData[key]));
    Object.keys(files).forEach(key => submitData.append(key, files[key]));

    try {
      const response = await fetch("https://nipma-bpms-backend.onrender.com/api/permits/archive", {
        method: "POST",
        body: submitData
      });
      const data = await response.json();
      if (data.success) {
        setMessage("Success! Record and all documents archived securely.");
        setFormData({ permitNumber: '', dateIssued: '', firstName: '', lastName: '', phone: '', plotNumber: '', community: '', buildingType: 'Residential' });
        setFiles({});
        e.target.reset();
      } else {
        setMessage("Failed to archive record.");
      }
    } catch (error) {
      setMessage("Server connection error.");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Archive Historical Permit</h1>
      {message && <div className={"p-4 mb-6 rounded-md font-medium " + (message.includes("Success") ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}> {message} </div>}
      
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-8">
        
        {/* Metadata Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">1. Permit Data</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Original Permit Number</label><input type="text" name="permitNumber" value={formData.permitNumber} onChange={handleTextChange} required className="w-full p-2 border rounded-md" placeholder="e.g. NiPDA/DAWH/20/001"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date Issued</label><input type="date" name="dateIssued" value={formData.dateIssued} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
          </div>
        </div>

        {/* Applicant Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">2. Applicant & Property</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><input type="text" name="firstName" value={formData.firstName} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><input type="text" name="lastName" value={formData.lastName} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" name="phone" value={formData.phone} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Plot Number</label><input type="text" name="plotNumber" value={formData.plotNumber} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Community</label><input type="text" name="community" value={formData.community} onChange={handleTextChange} required className="w-full p-2 border rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Building Type</label>
              <select name="buildingType" value={formData.buildingType} onChange={handleTextChange} className="w-full p-2 border rounded-md bg-white">
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Mixed-Use">Mixed-Use</option>
              </select>
            </div>
          </div>
        </div>

        {/* File Upload Section! */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">3. Document Vault (Upload or Scan)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
            
            {/* Certificate */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Permit Certificate</label>
              <input type="file" name="certificate" onChange={handleFileChange} className="w-full text-sm text-gray-500 mb-2" />
              <button type="button" onClick={() => { setCurrentScanField('certificate'); setIsScanning(true); }} className="text-sm bg-blue-100 text-blue-700 font-semibold py-1 px-3 rounded-full hover:bg-blue-200">📷 Scan with Camera</button>
              {files.certificate && <p className="text-sm text-green-600 mt-1 font-bold">✓ Attached: {files.certificate.name}</p>}
            </div>

            {/* Drawings */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Architectural Drawings</label>
              <input type="file" name="drawings" onChange={handleFileChange} className="w-full text-sm text-gray-500 mb-2" />
              <button type="button" onClick={() => { setCurrentScanField('drawings'); setIsScanning(true); }} className="text-sm bg-blue-100 text-blue-700 font-semibold py-1 px-3 rounded-full hover:bg-blue-200">📷 Scan with Camera</button>
              {files.drawings && <p className="text-sm text-green-600 mt-1 font-bold">✓ Attached: {files.drawings.name}</p>}
            </div>

            {/* Site Plan */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Site / Plot Plan</label>
              <input type="file" name="sitePlan" onChange={handleFileChange} className="w-full text-sm text-gray-500 mb-2" />
              <button type="button" onClick={() => { setCurrentScanField('sitePlan'); setIsScanning(true); }} className="text-sm bg-blue-100 text-blue-700 font-semibold py-1 px-3 rounded-full hover:bg-blue-200">📷 Scan with Camera</button>
              {files.sitePlan && <p className="text-sm text-green-600 mt-1 font-bold">✓ Attached: {files.sitePlan.name}</p>}
            </div>

            {/* Permit Form */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Permit Form</label>
              <input type="file" name="permitForm" onChange={handleFileChange} className="w-full text-sm text-gray-500 mb-2" />
              <button type="button" onClick={() => { setCurrentScanField('permitForm'); setIsScanning(true); }} className="text-sm bg-blue-100 text-blue-700 font-semibold py-1 px-3 rounded-full hover:bg-blue-200">📷 Scan with Camera</button>
              {files.permitForm && <p className="text-sm text-green-600 mt-1 font-bold">✓ Attached: {files.permitForm.name}</p>}
            </div>

            {/* Receipts */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Receipts</label>
              <input type="file" name="receipts" onChange={handleFileChange} className="w-full text-sm text-gray-500 mb-2" />
              <button type="button" onClick={() => { setCurrentScanField('receipts'); setIsScanning(true); }} className="text-sm bg-blue-100 text-blue-700 font-semibold py-1 px-3 rounded-full hover:bg-blue-200">📷 Scan with Camera</button>
              {files.receipts && <p className="text-sm text-green-600 mt-1 font-bold">✓ Attached: {files.receipts.name}</p>}
            </div>

            {/* Jacket */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Jacket File</label>
              <input type="file" name="jacket" onChange={handleFileChange} className="w-full text-sm text-gray-500 mb-2" />
              <button type="button" onClick={() => { setCurrentScanField('jacket'); setIsScanning(true); }} className="text-sm bg-blue-100 text-blue-700 font-semibold py-1 px-3 rounded-full hover:bg-blue-200">📷 Scan with Camera</button>
              {files.jacket && <p className="text-sm text-green-600 mt-1 font-bold">✓ Attached: {files.jacket.name}</p>}
            </div>

            {/* Indenture */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Indenture</label>
              <input type="file" name="indenture" onChange={handleFileChange} className="w-full text-sm text-gray-500 mb-2" />
              <button type="button" onClick={() => { setCurrentScanField('indenture'); setIsScanning(true); }} className="text-sm bg-blue-100 text-blue-700 font-semibold py-1 px-3 rounded-full hover:bg-blue-200">📷 Scan with Camera</button>
              {files.indenture && <p className="text-sm text-green-600 mt-1 font-bold">✓ Attached: {files.indenture.name}</p>}
            </div>

            {/* Geo Reference */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Geo Reference</label>
              <input type="file" name="geoReference" onChange={handleFileChange} className="w-full text-sm text-gray-500 mb-2" />
              <button type="button" onClick={() => { setCurrentScanField('geoReference'); setIsScanning(true); }} className="text-sm bg-blue-100 text-blue-700 font-semibold py-1 px-3 rounded-full hover:bg-blue-200">📷 Scan with Camera</button>
              {files.geoReference && <p className="text-sm text-green-600 mt-1 font-bold">✓ Attached: {files.geoReference.name}</p>}
            </div>

          </div>
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-4 rounded-md hover:bg-blue-700 transition">Save to Archives</button>
      </form>

      {/* Render the Scanner UI when active */}
      {isScanning && (
        <DocumentScanner 
          documentTitle={currentScanField} 
          onCancel={() => setIsScanning(false)} 
          onSave={handleScanSave} 
        />
      )}
    </div>
  );
};

export default NewPermit;