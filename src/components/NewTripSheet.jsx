import { useEffect, useState } from 'react';
import { shareFiles } from '../lib/share.js';
import { unlockSharing } from './ExportButton.jsx';
import ConfirmInline from './ConfirmInline.jsx';

const UNSUPPORTED_MSG = 'This browser can’t save files — update Chrome.';

function UnlockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect x="4" y="11" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 017.9-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * "Start a new trip?" bottom sheet: export the CSV then wipe, or delete
 * without exporting. Wiping is only done after the share completes ("done").
 */
export default function NewTripSheet({ unsavedCount, makeCsvFile, onWipe, onClose }) {
  const [msg, setMsg] = useState(null); // null | 'unsupported' | 'blocked' | {failed}
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function exportAndWipe() {
    setMsg(null); // sync — keeps the tap's activation for navigator.share
    let file;
    try {
      file = makeCsvFile();
    } catch {
      return;
    }
    const res = (await shareFiles([file])) || {};
    if (res.status === 'done') {
      await onWipe(); // wipes + reloads — only on a completed save
    } else if (res.status === 'blocked') {
      setMsg('blocked');
    } else if (res.status === 'unsupported') {
      setMsg('unsupported');
    } else if (res.status === 'failed') {
      setMsg({ failed: res.errorName || 'error' });
    }
    // 'cancelled': leave the sheet open, delete nothing.
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Start a new trip"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2 className="sheet-title">Start a new trip?</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="sheet-body">
          {unsavedCount > 0 && (
            <p className="new-trip-warn">
              {unsavedCount} {unsavedCount === 1 ? 'file is' : 'files are'} not saved to Files yet
              and will be lost.
            </p>
          )}

          <button type="button" className="btn btn-primary new-trip-primary" onClick={exportAndWipe}>
            Export CSV &amp; start new trip
          </button>

          {msg === 'blocked' && (
            <button type="button" className="unlock-bar" onClick={unlockSharing}>
              <UnlockIcon />
              <span>Tap to refresh, then try again</span>
            </button>
          )}
          {msg === 'unsupported' && <p className="backup-unsupported">{UNSUPPORTED_MSG}</p>}
          {msg && msg.failed && (
            <p className="backup-unsupported">
              Couldn’t open the share sheet ({msg.failed}) — tap again.
            </p>
          )}

          {confirmDelete ? (
            <ConfirmInline
              message="Delete everything? This can’t be undone."
              onConfirm={onWipe}
              onCancel={() => setConfirmDelete(false)}
            />
          ) : (
            <button
              type="button"
              className="btn btn-danger-outline new-trip-delete"
              onClick={() => setConfirmDelete(true)}
            >
              Delete without export
            </button>
          )}

          <button type="button" className="btn btn-ghost new-trip-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
