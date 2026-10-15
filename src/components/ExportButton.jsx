import { useState } from 'react';
import { shareFiles, getShareLog } from '../lib/share.js';
import { buildReceiptsCsv, csvFilename } from '../lib/csv.js';

// This file is the shared, dependency-cycle-free home for the backup controls
// as well as the CSV export button. Keeping BackupButton/BackupDot here lets
// DocViewer and BackupSheet both import them without a circular import
// (BackupSheet imports DocViewer, DocViewer imports these).

const UNSUPPORTED_MSG = 'This browser can’t save files — update Chrome.';

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

// DEBUG-SHARE: format one share-log record for the on-screen diagnostics line.
function diagLine(taps, rec) {
  if (!rec) return `taps=${taps}`;
  return `taps=${taps} #${rec.seq} invoked=${rec.invoked ? 'yes' : 'no'} status=${rec.status} err=${rec.errorName || '-'} ${rec.ms}ms`;
}

/**
 * The single save/share control. Tapping it ALWAYS opens the share sheet
 * (saved or not). Red "Save" when not backed up, green "Saved" with a tick
 * once backed up. Status only flips to saved when the share completes.
 *
 * onBackup resolves to { status, errorName }. There is deliberately no local
 * busy flag — serialisation lives in shareFiles so a button can never get
 * stuck "in flight" after a re-render.
 * @param {{saved: boolean, onBackup: () => Promise<{status:string,errorName:string}>, full?: boolean}} props
 */
export function BackupButton({ saved, onBackup, full }) {
  const [note, setNote] = useState(null); // null | 'unsupported' | {failed: errorName}
  const [taps, setTaps] = useState(0); // DEBUG-SHARE
  const [diag, setDiag] = useState(null); // DEBUG-SHARE

  async function handle(e) {
    setTaps((t) => t + 1); // DEBUG-SHARE: count raw taps before anything else
    e.stopPropagation();
    setNote(null); // clears on every tap
    const res = (await onBackup()) || {};
    const log = getShareLog(); // DEBUG-SHARE
    setDiag(log[log.length - 1] || null); // DEBUG-SHARE
    if (res.status === 'unsupported') setNote('unsupported');
    else if (res.status === 'failed') setNote({ failed: res.errorName || 'error' });
    // 'done' / 'cancelled' leave no note.
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
      {note === 'unsupported' && <span className="backup-unsupported">{UNSUPPORTED_MSG}</span>}
      {note && note.failed && (
        <span className="backup-unsupported">
          Couldn’t open the share sheet ({note.failed}) — tap again.
        </span>
      )}
      {/* DEBUG-SHARE */}
      <span className="share-diag">{diagLine(taps, diag)}</span>
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
 * page. Builds the CSV and hands it to the share sheet (so it can go straight
 * to Save to Files). Shows "Exported" briefly on success.
 */
export default function ExportButton({
  trip,
  receipts,
  fileById,
  voucherUsed,
  perDiemUsed,
  fuelUsed,
}) {
  const [status, setStatus] = useState(''); // '', 'exported', 'unsupported', 'failed'
  const [errName, setErrName] = useState('');
  const [taps, setTaps] = useState(0); // DEBUG-SHARE
  const [diag, setDiag] = useState(null); // DEBUG-SHARE

  async function onExport() {
    setTaps((t) => t + 1); // DEBUG-SHARE: count raw taps before anything else
    setStatus(''); // clears any prior message on each tap (sync; keeps activation)
    const csv = buildReceiptsCsv({
      trip,
      receipts,
      voucherUsed,
      perDiemUsed,
      fuelUsed,
      fileById,
    });
    const name = csvFilename(trip?.name);
    let file;
    try {
      file = { blob: new Blob([csv], { type: 'text/csv' }), name, mimeType: 'text/csv' };
    } catch {
      return;
    }
    const res = (await shareFiles([file])) || {};
    const log = getShareLog(); // DEBUG-SHARE
    setDiag(log[log.length - 1] || null); // DEBUG-SHARE
    if (res.status === 'done') {
      setStatus('exported');
      setTimeout(() => setStatus((s) => (s === 'exported' ? '' : s)), 2000);
    } else if (res.status === 'unsupported') {
      setStatus('unsupported');
    } else if (res.status === 'failed') {
      setErrName(res.errorName || 'error');
      setStatus('failed');
    }
  }

  return (
    <div className="export-wrap">
      <button type="button" className="export-btn" onClick={onExport}>
        {status === 'exported' ? 'Exported' : 'Export numbers (CSV)'}
      </button>
      {status === 'unsupported' && (
        <span className="backup-unsupported">{UNSUPPORTED_MSG}</span>
      )}
      {status === 'failed' && (
        <span className="backup-unsupported">
          Couldn’t open the share sheet ({errName}) — tap again.
        </span>
      )}
      {/* DEBUG-SHARE */}
      <span className="share-diag">{diagLine(taps, diag)}</span>
    </div>
  );
}
