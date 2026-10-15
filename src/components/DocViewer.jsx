import { Component, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { BackupButton } from './ExportButton.jsx';

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

export default function DocViewer({ file, onClose, onBackup, saved }) {
  const [url, setUrl] = useState('');
  const [pdfFailed, setPdfFailed] = useState(false);

  // Reset the PDF-failure state whenever a different file is opened.
  useEffect(() => {
    setPdfFailed(false);
  }, [file]);

  // Object URL from the stored blob; revoked on close/unmount.
  useEffect(() => {
    if (!file || !file.blob) return undefined;
    const u = URL.createObjectURL(file.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Escape closes.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isImage = (file?.mimeType || '').startsWith('image/');
  const isPdf = (file?.mimeType || '') === 'application/pdf';

  // Can we hand this file to the OS share / save sheet?
  const canShare = useMemo(() => {
    if (!file || !file.blob) return false;
    if (typeof navigator === 'undefined' || !navigator.canShare) return false;
    try {
      const f = new File([file.blob], file.name || 'document', {
        type: file.mimeType || 'application/octet-stream',
      });
      return navigator.canShare({ files: [f] });
    } catch {
      return false;
    }
  }, [file]);

  async function onShare() {
    try {
      const f = new File([file.blob], file.name || 'document', {
        type: file.mimeType || 'application/octet-stream',
      });
      await navigator.share({ files: [f] });
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user cancelled the sheet
      // Any other failure: fail quietly, the viewer stays open.
    }
  }

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

      {(canShare || onBackup) && (
        <div className="doc-viewer-bottom">
          {canShare && (
            <button type="button" className="btn btn-primary doc-viewer-share" onClick={onShare}>
              Share / Save to Files
            </button>
          )}
          {onBackup && <BackupButton saved={saved} onBackup={onBackup} />}
        </div>
      )}
    </div>
  );
}
