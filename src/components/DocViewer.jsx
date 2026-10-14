import { useEffect, useMemo, useState } from 'react';

// Full-screen viewer for a stored document/photo. Everything comes from the
// blob held in IndexedDB, so it works fully offline — no network.

export default function DocViewer({ file, onClose }) {
  const [url, setUrl] = useState('');

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

      <div className="doc-viewer-body">
        {url &&
          (isImage ? (
            <img src={url} alt={file.name || 'Document'} className="doc-viewer-img" />
          ) : (
            <iframe title={file.name || 'Document'} src={url} className="doc-viewer-frame" />
          ))}
      </div>

      {canShare && (
        <div className="doc-viewer-bottom">
          <button type="button" className="btn btn-primary doc-viewer-share" onClick={onShare}>
            Share / Save to Files
          </button>
        </div>
      )}
    </div>
  );
}
