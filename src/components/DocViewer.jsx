import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BackupButton } from './ExportButton.jsx';
import CropScreen from './CropScreen.jsx';

function CropIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M7 2v15a1 1 0 001 1h15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 7h14a1 1 0 011 1v14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Full-screen viewer for a stored document/photo. Everything comes from the
// blob held in IndexedDB, so it works fully offline — no network.

// The pdf.js renderer is a separate chunk, loaded only when a PDF is opened.
const PdfPages = lazy(() => import('./PdfPages.jsx'));

// Catches a failed chunk load or a render error from the lazy PDF subtree.
class PdfErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    if (this.props.onError) this.props.onError();
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export default function DocViewer({ file, onClose, onBackup, saved, onCrop }) {
  const [url, setUrl] = useState('');
  const [pdfFailed, setPdfFailed] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const cropOpenRef = useRef(false);
  cropOpenRef.current = cropOpen;

  // Reset transient state whenever a different file is opened.
  useEffect(() => {
    setPdfFailed(false);
    setCropOpen(false);
  }, [file]);

  // Object URL from the stored blob; revoked on close/unmount.
  useEffect(() => {
    if (!file || !file.blob) return undefined;
    const u = URL.createObjectURL(file.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Escape closes the viewer — unless the crop overlay is open (it closes first).
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (cropOpenRef.current) return;
      onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isImage = (file?.mimeType || '').startsWith('image/');
  const isPdf = (file?.mimeType || '') === 'application/pdf';

  if (!file) return null;

  return (
    <div className="doc-viewer" role="dialog" aria-modal="true" aria-label={file.name || 'Document'}>
      <div className="doc-viewer-top">
        <span className="doc-viewer-title">{file.name || 'Document'}</span>
        <button type="button" className="doc-viewer-close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className={'doc-viewer-body' + (isPdf && !pdfFailed ? ' doc-viewer-body-pdf' : '')}>
        {url &&
          (isImage ? (
            <img src={url} alt={file.name || 'Document'} className="doc-viewer-img" />
          ) : isPdf && !pdfFailed ? (
            <PdfErrorBoundary
              onError={() => setPdfFailed(true)}
              fallback={
                <div className="pdf-fallback">
                  <iframe title={file.name || 'Document'} src={url} className="doc-viewer-frame" />
                  <p className="pdf-fallback-note">
                    Couldn’t render all pages — use Share / Save to Files.
                  </p>
                </div>
              }
            >
              <Suspense fallback={<div className="pdf-loading">Loading PDF…</div>}>
                <PdfPages blob={file.blob} onError={() => setPdfFailed(true)} />
              </Suspense>
            </PdfErrorBoundary>
          ) : isPdf && pdfFailed ? (
            <div className="pdf-fallback">
              <iframe title={file.name || 'Document'} src={url} className="doc-viewer-frame" />
              <p className="pdf-fallback-note">
                Couldn’t render all pages — use Share / Save to Files.
              </p>
            </div>
          ) : (
            <iframe title={file.name || 'Document'} src={url} className="doc-viewer-frame" />
          ))}
      </div>

      {(onBackup || (onCrop && isImage)) && (
        <div className="doc-viewer-bottom">
          {onCrop && isImage && (
            <button
              type="button"
              className="crop-btn"
              onClick={() => setCropOpen(true)}
              aria-label="Crop image"
            >
              <CropIcon />
            </button>
          )}
          {onBackup && <BackupButton saved={saved} onBackup={onBackup} full />}
        </div>
      )}

      {cropOpen && onCrop && isImage && (
        <CropScreen
          source={file.blob}
          onDone={async (blob) => {
            await onCrop(blob);
            setCropOpen(false);
          }}
          onCancel={() => setCropOpen(false)}
        />
      )}
    </div>
  );
}
