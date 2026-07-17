import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';

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

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setCapturedImage(imageSrc);
  }, [webcamRef]);

  const confirmAndSave = async () => {
    const res = await fetch(capturedImage);
    const blob = await res.blob();
    
    const file = new File([blob], `${documentTitle.replace(/\s+/g, '_')}_Scan.jpg`, { 
        type: "image/jpeg" 
    });
    
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
              <button type="button" onClick={() => setCapturedImage(null)} style={styles.cancelBtn}>Retake</button>
              <button type="button" onClick={confirmAndSave} style={styles.saveBtn}>✅ Save Scan</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentScanner;