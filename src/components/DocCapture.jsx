import { useRef } from 'react';

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 7l1.5-2h5L16 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 8V5a1 1 0 011-1h3M20 8V5a1 1 0 00-1-1h-3M4 16v3a1 1 0 001 1h3M20 16v3a1 1 0 01-1 1h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 16V5M8 9l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The three capture buttons revealed under a block's "Add document".
 * @param onPick (file, source) where source is "photo" | "upload"
 */
export default function DocCapture({ onPick, onCancel }) {
  const photoRef = useRef(null);
  const uploadRef = useRef(null);

  function handle(ref, source) {
    const file = ref.current && ref.current.files && ref.current.files[0];
    if (file) onPick(file, source);
    if (ref.current) ref.current.value = '';
  }

  return (
    <div className="doc-capture">
      <div className="doc-capture-row">
        <button
          type="button"
          className="capture-btn"
          onClick={() => photoRef.current && photoRef.current.click()}
        >
          <PhotoIcon />
          <span>Photo</span>
        </button>

        <button type="button" className="capture-btn capture-btn-disabled" disabled>
          <ScanIcon />
          <span>Scan → PDF (soon)</span>
        </button>

        <button
          type="button"
          className="capture-btn"
          onClick={() => uploadRef.current && uploadRef.current.click()}
        >
          <UploadIcon />
          <span>Upload file</span>
        </button>
      </div>

      <button type="button" className="btn btn-ghost capture-cancel" onClick={onCancel}>
        Cancel
      </button>

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={() => handle(photoRef, 'photo')}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={() => handle(uploadRef, 'upload')}
      />
    </div>
  );
}
