import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { jsPDF } from 'jspdf';

const styles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', width: '90%', maxWidth: '500px', textAlign: 'center' },
  camera: { width: '100%', borderRadius: '8px', marginBottom: '15px' },
  buttonRow: { display: 'flex', justifyContent: 'space-between' },
  captureBtn: { backgroundColor: '#007bff', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' },
  saveBtn: { backgroundColor: '#28a745', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' },
  cancelBtn: { backgroundColor: '#dc3545', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }
};

const DocumentScanner = ({ onSave, onCancel, documentTitle }) => {
  const webcamRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setCapturedImage(imageSrc);
  }, [webcamRef]);

  const confirmAndSaveToPDF = () => {
    setIsConverting(true);
    
    // Create an A4 PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const imgProps = pdf.getImageProperties(capturedImage);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    // Place image on the PDF
    pdf.addImage(capturedImage, 'JPEG', 0, 0, pdfWidth, pdfHeight);

    // Convert to a File object for the backend
    const pdfBlob = pdf.output('blob');
    const file = new File([pdfBlob], `${documentTitle.replace(/\s+/g, '_')}_Scan.pdf`, { 
        type: "application/pdf" 
    });
    
    setIsConverting(false);
    onSave(file);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3>Scanning: {documentTitle}</h3>
        
        {!capturedImage ? (
          <div>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "environment" }}
              style={styles.camera}
            />
            <div style={styles.buttonRow}>
              <button type="button" onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
              <button type="button" onClick={capture} style={styles.captureBtn}>📸 Capture</button>
            </div>
          </div>
        ) : (
          <div>
            <img src={capturedImage} alt="Scanned Document" style={styles.camera} />
            <div style={styles.buttonRow}>
              <button type="button" onClick={() => setCapturedImage(null)} style={styles.cancelBtn} disabled={isConverting}>Retake</button>
              <button type="button" onClick={confirmAndSaveToPDF} style={styles.saveBtn} disabled={isConverting}>
                {isConverting ? 'Converting...' : '✅ Convert to PDF & Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentScanner;