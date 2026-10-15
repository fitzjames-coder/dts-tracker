import { useState } from 'react';
import { shareFiles } from '../lib/share.js';

// This file is the shared, dependency-cycle-free home for the backup controls
// as well as the CSV export button. Keeping BackupButton/BackupDot here lets
// DocViewer and BackupSheet both import them without a circular import
// (BackupSheet imports DocViewer, DocViewer imports these).

const UNSUPPORTED_MSG = 'This browser can’t save files — update Chrome.';

// sessionStorage key used to restore scroll position across an unlock reload.
// App.jsx reads it on start. Shared here so there is a single source of truth.
export const UNLOCK_SCROLL_KEY = 'dts-unlock-scroll';

// iOS blocks navigator.share after the first completed Save to Files until the
// page reloads. Unlock reloads, preserving the scroll position.
export function unlockSharing() {
  try {
    sessionStorage.setItem(UNLOCK_SCROLL_KEY, String(window.scrollY || 0));
  } catch {
    /* ignore */
  }
  location.reload();
}

function SmallTick() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// One glyph combining the iOS share symbol (open-top box + up arrow, left)
// and a download arrow (down arrow + baseline, right).
function SaveShareIcon() {
  return (
    <svg viewBox="0 0 30 22" width="24" height="18" aria-hidden="true">
      {/* iOS share: open-top box + up arrow */}
      <path d="M4 11v5a2 2 0 002 2h4a2 2 0 002-2v-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 13V3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 6l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* download: down arrow + baseline */}
      <path d="M22 3v9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 9l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 18h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Open padlock (shackle swung clear of the body).
function UnlockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect x="4" y="11" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 017.9-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UnlockButton() {
  return (
    <button
      type="button"
      className="backup-btn backup-btn-icon unlock-btn"
      onClick={(e) => {
        e.stopPropagation();
        unlockSharing();
      }}
      aria-label="Unlock sharing"
    >
      <UnlockIcon />
    </button>
  );
}

/**
 * The single save/share control, icon only. Tapping it ALWAYS opens the share
 * sheet. Red when not backed up, green with a tick once backed up. Status only
 * flips to saved when the share completes ("done"). When iOS blocks the share
 * ("blocked"), an Unlock button appears next to it.
 *
 * onBackup resolves to { status, errorName }. No local busy flag — serialisation
 * lives in shareFiles so a button can never get stuck "in flight".
 * @param {{saved: boolean, onBackup: () => Promise<{status:string,errorName:string}>, full?: boolean}} props
 */
export function BackupButton({ saved, onBackup, full }) {
  const [note, setNote] = useState(null); // null | 'unsupported' | 'blocked' | {failed}

  async function handle(e) {
    e.stopPropagation();
    setNote(null); // clears on every tap
    const res = (await onBackup()) || {};
    if (res.status === 'unsupported') setNote('unsupported');
    else if (res.status === 'blocked') setNote('blocked');
    else if (res.status === 'done') setNote('unlock'); // refresh before the next save
    else if (res.status === 'failed') setNote({ failed: res.errorName || 'error' });
    // 'cancelled' leaves no note.
  }

  return (
    <>
      <button
        type="button"
        className={
          'backup-btn backup-btn-icon ' +
          (saved ? 'backup-btn-saved' : 'backup-btn-unsaved') +
          (full ? ' backup-btn-full' : '')
        }
        onClick={handle}
        aria-label={saved ? 'Saved — tap to share again' : 'Save to Files'}
      >
        <SaveShareIcon />
        {saved && (
          <span className="backup-tick" aria-hidden="true">
            <SmallTick />
          </span>
        )}
      </button>
      {(note === 'blocked' || note === 'unlock') && <UnlockButton />}
      {note === 'unsupported' && <span className="backup-unsupported">{UNSUPPORTED_MSG}</span>}
      {note && note.failed && (
        <span className="backup-unsupported">
          Couldn’t open the share sheet ({note.failed}) — tap again.
        </span>
      )}
    </>
  );
}

/** Small red/green dot that also backs up on tap (used on receipt rows). */
export function BackupDot({ saved, onBackup }) {
  async function handle(e) {
    e.stopPropagation();
    await onBackup();
  }
  return (
    <button
      type="button"
      className={'backup-dot ' + (saved ? 'backup-dot-saved' : 'backup-dot-unsaved')}
      onClick={handle}
      aria-label={saved ? 'Backed up — tap to re-save' : 'Not backed up — tap to save'}
    />
  );
}

/**
 * Full-width "Export numbers (CSV)" button that sits at the very bottom of the
 * page. Builds the CSV (via makeCsvFile) and hands it to the share sheet.
 * Shows "Exported" briefly on success.
 */
export default function ExportButton({ makeCsvFile, onSaved }) {
  const [status, setStatus] = useState(''); // '', 'exported', 'unsupported', 'blocked', 'failed'
  const [errName, setErrName] = useState('');
  const [unlock, setUnlock] = useState(false); // show Unlock until a reload

  async function onExport() {
    setStatus(''); // clears any prior message on each tap (sync; keeps activation)
    let file;
    try {
      file = makeCsvFile();
    } catch {
      return;
    }
    const res = (await shareFiles([file])) || {};
    if (res.status === 'done') {
      setStatus('exported');
      setTimeout(() => setStatus((s) => (s === 'exported' ? '' : s)), 2000);
      setUnlock(true); // refresh before the next save
      if (onSaved) onSaved();
    } else if (res.status === 'unsupported') {
      setStatus('unsupported');
    } else if (res.status === 'blocked') {
      setStatus('blocked');
    } else if (res.status === 'failed') {
      setErrName(res.errorName || 'error');
      setStatus('failed');
    }
  }

  return (
    <div className="export-wrap">
      <div className="export-row">
        <button type="button" className="export-btn" onClick={onExport}>
          {status === 'exported' ? 'Exported' : 'Export numbers (CSV)'}
        </button>
        {(status === 'blocked' || unlock) && <UnlockButton />}
      </div>
      {status === 'unsupported' && (
        <span className="backup-unsupported">{UNSUPPORTED_MSG}</span>
      )}
      {status === 'failed' && (
        <span className="backup-unsupported">
          Couldn’t open the share sheet ({errName}) — tap again.
        </span>
      )}
    </div>
  );
}
