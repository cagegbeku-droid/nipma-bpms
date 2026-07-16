
import React, { useState } from 'react';

const NewPermit = () => {
  const [formData, setFormData] = useState({
    permitNumber: '', dateIssued: '', firstName: '', lastName: '', phone: '', plotNumber: '', community: '', buildingType: 'Residential'
  });
  const [files, setFiles] = useState({});
  const [message, setMessage] = useState('');

  const handleTextChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e) => setFiles({ ...files, [e.target.name]: e.target.files[0] });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Uploading files to Archive Vault...");
    
    // We use FormData to send physical files over the network
    const submitData = new FormData();
    Object.keys(formData).forEach(key => submitData.append(key, formData[key]));
    Object.keys(files).forEach(key => submitData.append(key, files[key]));

    try {
      const response = await fetch("http://192.168.242.218:5000/api/permits/archive", {
        method: "POST",
        body: submitData
      });
      const data = await response.json();
      if (data.success) {
        setMessage("Success! Record and all documents archived securely.");
        setFormData({ permitNumber: '', dateIssued: '', firstName: '', lastName: '', phone: '', plotNumber: '', community: '', buildingType: 'Residential' });
        setFiles({});
        e.target.reset(); // Clears out the file input buttons visually
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
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">1. Permit Metadata</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Original Permit Number</label><input type="text" name="permitNumber" value={formData.permitNumber} onChange={handleTextChange} required className="w-full p-2 border rounded-md" placeholder="e.g. NPDA-2015-001"/></div>
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
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">3. Document Vault (Upload Files)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Permit Certificate (PDF/Img)</label><input type="file" name="certificate" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Architectural Drawings (.dwg/PDF)</label><input type="file" name="drawings" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Site / Plot Plan</label><input type="file" name="sitePlan" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Permit Form</label><input type="file" name="permitForm" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Receipts</label><input type="file" name="receipts" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Jacket File</label><input type="file" name="jacket" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Indenture</label><input type="file" name="indenture" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Geo Reference</label><input type="file" name="geoReference" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
          </div>
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-4 rounded-md hover:bg-blue-700 transition">Securely Save to Archives</button>
      </form>
    </div>
  );
};

export default NewPermit;
