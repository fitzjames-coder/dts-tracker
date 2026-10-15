import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BackupButton } from './ExportButton.jsx';
import CropScreen from './CropScreen.jsx';
import { getFile, fileDate } from '../db.js';

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

export default function DocViewer({ file, onClose, onBackup, saved, onCrop, onUpdateFile }) {
  const [url, setUrl] = useState('');
  const [pdfFailed, setPdfFailed] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const cropOpenRef = useRef(false);
  cropOpenRef.current = cropOpen;
  const urlRef = useRef(null);
  const retriedRef = useRef(false);

  // Editable date + location for block documents (seeded from the file).
  const editableMeta = !!(onUpdateFile && file && file.blockId);
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  useEffect(() => {
    setDate(fileDate(file));
    setLocation((file && file.location) || '');
  }, [file?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function setObjectUrl(blob) {
    if (urlRef.current) {
      try {
        URL.revokeObjectURL(urlRef.current);
      } catch {
        /* ignore */
      }
    }
    const u = URL.createObjectURL(blob);
    urlRef.current = u;
    setUrl(u);
  }

  // Reset transient state whenever a different file is opened.
  useEffect(() => {
    setPdfFailed(false);
    setCropOpen(false);
    setImgError(false);
    retriedRef.current = false;
  }, [file]);

  // Build the object URL from a FRESH read of the row when it has an id —
  // the blob held in props can be left unreadable by WebKit after a share.
  useEffect(() => {
    if (!file) return undefined;
    let cancelled = false;
    setUrl('');
    (async () => {
      let blob = file.blob;
      if (file.id) {
        try {
          const fresh = await getFile(file.id);
          if (fresh && fresh.blob) blob = fresh.blob;
        } catch {
          /* fall back to the passed blob */
        }
      }
      if (cancelled || !blob) return;
      setObjectUrl(blob);
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Revoke the last object URL on unmount.
  useEffect(
    () => () => {
      if (urlRef.current) {
        try {
          URL.revokeObjectURL(urlRef.current);
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  // <img> failed to decode: re-read from the db once and retry.
  async function onImgError() {
    if (imgError) return;
    if (file.id && !retriedRef.current) {
      retriedRef.current = true;
      try {
        const fresh = await getFile(file.id);
        if (fresh && fresh.blob) {
          setObjectUrl(fresh.blob);
          return;
        }
      } catch {
        /* fall through to error */
      }
    }
    setImgError(true);
  }

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

      {editableMeta && (
        <div className="doc-meta">
          <label className="doc-meta-field doc-meta-date">
            <span className="doc-meta-label">Date</span>
            <input
              type="date"
              className="text-input"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                onUpdateFile(file.id, { date: e.target.value });
              }}
              aria-label="Document date"
            />
          </label>
          <label className="doc-meta-field doc-meta-loc">
            <span className="doc-meta-label">Location</span>
            <input
              type="text"
              className="text-input"
              value={location}
              placeholder="Location"
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => onUpdateFile(file.id, { location })}
              aria-label="Document location"
            />
          </label>
        </div>
      )}

      <div className={'doc-viewer-body' + (isPdf && !pdfFailed ? ' doc-viewer-body-pdf' : '')}>
        {imgError ? (
          <p className="pdf-loading">Couldn’t load this file — pull down to refresh.</p>
        ) : !url ? (
          <div className="pdf-loading">Loading…</div>
        ) : isImage ? (
            <img
              src={url}
              alt={file.name || 'Document'}
              className="doc-viewer-img"
              onError={onImgError}
            />
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
          )}
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
          fileId={file.id}
          fromViewer
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
