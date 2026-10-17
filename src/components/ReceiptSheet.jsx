import { useEffect, useRef, useState } from 'react';
import { receiptFilename } from '../lib/filenames.js';
import { parseAmountToCents, centsToInput } from '../lib/money.js';
import ConfirmInline from './ConfirmInline.jsx';
import DocViewer from './DocViewer.jsx';
import CropScreen from './CropScreen.jsx';
import { BackupButton } from './ExportButton.jsx';

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function PlateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function FuelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M5 21V5a2 2 0 012-2h5a2 2 0 012 2v16M4 21h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 8h2.5a1.5 1.5 0 011.5 1.5V16a1.5 1.5 0 003 0V9l-2.5-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="7" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function OtherIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21V3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const HINTS = {
  other: 'voucher only',
  food: 'M&IE + voucher',
  fuel: 'fuel + voucher',
};

export default function ReceiptSheet({ mode, receipt, existingFile, onClose, onSaveNew, onSaveEdit, onDelete, onBackupFiles, onReplaceFileBlob }) {
  const isEdit = mode === 'edit';
  const [title, setTitle] = useState(receipt?.title || '');
  const [tag, setTag] = useState(receipt?.tag || 'other');
  const [amount, setAmount] = useState(isEdit ? centsToInput(receipt?.amountCents) : '');
  const [date, setDate] = useState(receipt?.date || todayStr());
  const [location, setLocation] = useState(receipt?.location || '');
  // Which budgets this receipt counts against. Both on by default; missing
  // values on an older receipt read as on. At least one must stay ticked.
  const [onGtc, setOnGtc] = useState(receipt ? receipt.onGtc !== false : true);
  const [onVoucher, setOnVoucher] = useState(receipt ? receipt.onVoucher !== false : true);
  const [splitHint, setSplitHint] = useState(false);
  const [imageBlob, setImageBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [cropSource, setCropSource] = useState(null); // raw camera file awaiting crop

  const photoRef = useRef(null);
  const overlayOpenRef = useRef(false);
  overlayOpenRef.current = viewerOpen || cropSource != null;

  // New mode: open the camera immediately.
  useEffect(() => {
    if (!isEdit && photoRef.current) {
      photoRef.current.click();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preview an existing image in edit mode.
  useEffect(() => {
    if (isEdit && existingFile && existingFile.blob && existingFile.mimeType?.startsWith('image/')) {
      const url = URL.createObjectURL(existingFile.blob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [isEdit, existingFile]);

  // Clean up new-capture preview url.
  useEffect(() => {
    return () => {
      if (imageBlob && previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageBlob]);

  // Escape closes.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      // When an overlay (viewer or crop) is open, Escape closes it, not the sheet.
      if (overlayOpenRef.current) return;
      onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function onPhotoPicked() {
    const file = photoRef.current && photoRef.current.files && photoRef.current.files[0];
    if (photoRef.current) photoRef.current.value = '';
    if (!file) return;
    // The captured photo goes through crop first; the result becomes the photo.
    setCropSource(file);
  }

  function onCropDone(blob) {
    if (previewUrl && imageBlob) URL.revokeObjectURL(previewUrl);
    setImageBlob(blob);
    setPreviewUrl(URL.createObjectURL(blob));
    setCropSource(null);
  }

  const amountCents = parseAmountToCents(amount);
  const filename = receiptFilename({ date, tag, amountCents, title });

  // Tick/untick a budget box, but never let both end up off.
  function setGtc(next) {
    if (!next && !onVoucher) {
      setSplitHint(true);
      return;
    }
    setOnGtc(next);
    setSplitHint(false);
  }
  function setVoucher(next) {
    if (!next && !onGtc) {
      setSplitHint(true);
      return;
    }
    setOnVoucher(next);
    setSplitHint(false);
  }

  function save() {
    const fields = {
      title: title.trim(),
      tag,
      amountCents,
      date,
      location: location.trim(),
      onGtc,
      onVoucher,
    };
    if (isEdit) {
      onSaveEdit(receipt.id, fields);
    } else {
      const fileRow = imageBlob
        ? {
            kind: 'photo',
            name: filename,
            mimeType: 'image/jpeg',
            size: imageBlob.size,
            blob: imageBlob,
          }
        : null;
      onSaveNew(fields, fileRow);
    }
  }

  const showThumb = previewUrl && (imageBlob || (isEdit && existingFile));

  // The image to open full-screen: the fresh capture, else the saved file.
  const viewerFile = imageBlob
    ? { blob: imageBlob, name: filename, mimeType: 'image/jpeg', kind: 'photo' }
    : isEdit && existingFile
    ? existingFile
    : null;

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit receipt' : 'New receipt'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2 className="sheet-title">{isEdit ? 'Edit receipt' : 'New receipt'}</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="sheet-body">
          <div className="receipt-photo">
            {showThumb ? (
              <>
                <button
                  type="button"
                  className="receipt-photo-btn"
                  onClick={() => viewerFile && setViewerOpen(true)}
                  aria-label="Open photo full screen"
                >
                  <img src={previewUrl} alt="Receipt" className="receipt-photo-img" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost retake-btn"
                  onClick={() => photoRef.current && photoRef.current.click()}
                >
                  Retake
                </button>
              </>
            ) : (
              <button
                type="button"
                className="photo-placeholder"
                onClick={() => photoRef.current && photoRef.current.click()}
              >
                Take photo
              </button>
            )}

            {isEdit && existingFile && onBackupFiles && (
              <div className="receipt-backup">
                <BackupButton
                  full
                  saved={existingFile.syncState === 'saved'}
                  onBackup={() => onBackupFiles([existingFile])}
                />
              </div>
            )}
          </div>

          <label className="field">
            <span className="field-label">Title (optional)</span>
            <input
              className="text-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dinner"
            />
          </label>

          <label className="field">
            <span className="field-label">Location (optional)</span>
            <input
              className="text-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
            />
          </label>

          <label className="field">
            <span className="field-label">Date</span>
            <input
              type="date"
              className="text-input"
              value={date}
              onChange={(e) => setDate(e.target.value || todayStr())}
              aria-label="Receipt date"
            />
          </label>

          <div className="field">
            <span className="field-label">Tag</span>
            <div className="tag-buttons">
              <button
                type="button"
                className={'tag-button tag-other' + (tag === 'other' ? ' tag-button-active' : '')}
                onClick={() => setTag('other')}
              >
                <OtherIcon /> Other
              </button>
              <button
                type="button"
                className={'tag-button tag-food' + (tag === 'food' ? ' tag-button-active' : '')}
                onClick={() => setTag('food')}
              >
                <PlateIcon /> Food
              </button>
              <button
                type="button"
                className={'tag-button tag-fuel' + (tag === 'fuel' ? ' tag-button-active' : '')}
                onClick={() => setTag('fuel')}
              >
                <FuelIcon /> Fuel
              </button>
            </div>
          </div>

          <label className="field">
            <span className="field-label">Amount</span>
            <div className="amount-field">
              <span className="amount-prefix">$</span>
              <input
                className="text-input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <span className="amount-hint">{HINTS[tag]}</span>
          </label>

          <div className="field">
            <span className="field-label">Counts against</span>
            <div className="split-boxes">
              <label className="split-box">
                <input
                  type="checkbox"
                  checked={onGtc}
                  onChange={(e) => setGtc(e.target.checked)}
                />
                <span>GTC</span>
              </label>
              <label className="split-box">
                <input
                  type="checkbox"
                  checked={onVoucher}
                  onChange={(e) => setVoucher(e.target.checked)}
                />
                <span>Voucher</span>
              </label>
            </div>
            {splitHint && <span className="split-hint">Pick at least one</span>}
          </div>

          <p className="saves-as">Saves as {filename}</p>

          {confirmDel && receipt && (
            <ConfirmInline
              message={`Delete this receipt${receipt.fileId ? ' and its document' : ''}?`}
              onConfirm={() => onDelete(receipt.id)}
              onCancel={() => setConfirmDel(false)}
            />
          )}
        </div>

        <div className="sheet-foot">
          {isEdit && (
            <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDel(true)}>
              Delete
            </button>
          )}
          <button type="button" className="btn btn-gold save-receipt" onClick={save}>
            {isEdit ? 'Save changes' : 'Save receipt'}
          </button>
        </div>

        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onPhotoPicked}
        />

        {viewerOpen && viewerFile && (
          <DocViewer
            file={viewerFile}
            saved={viewerFile.id ? viewerFile.syncState === 'saved' : undefined}
            onBackup={
              viewerFile.id && onBackupFiles ? () => onBackupFiles([viewerFile]) : undefined
            }
            onCrop={
              viewerFile.id &&
              onReplaceFileBlob &&
              (viewerFile.mimeType || '').startsWith('image/')
                ? (blob) => onReplaceFileBlob(viewerFile.id, blob)
                : undefined
            }
            onClose={() => setViewerOpen(false)}
          />
        )}

        {cropSource && (
          <CropScreen
            source={cropSource}
            onDone={onCropDone}
            onCancel={() => setCropSource(null)}
          />
        )}
      </div>
    </div>
  );
}
