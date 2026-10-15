import { useState } from 'react';
import { shareFiles } from '../lib/share.js';
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

// Share arrow combined with a down arrow: "share this out / save to Files".
function SaveShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="M12 3v11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 10l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 14v3a2 2 0 002 2h10a2 2 0 002-2v-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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

  async function handle(e) {
    e.stopPropagation();
    setNote(null); // clears on every tap
    const res = (await onBackup()) || {};
    if (res.status === 'unsupported') setNote('unsupported');
    else if (res.status === 'failed') setNote({ failed: res.errorName || 'error' });
    // 'done' / 'cancelled' leave no note.
  }

  return (
    <>
      <button
        type="button"
        className={
          'backup-btn ' +
          (saved ? 'backup-btn-saved' : 'backup-btn-unsaved') +
          (full ? ' backup-btn-full' : '')
        }
        onClick={handle}
        aria-label={saved ? 'Backed up — tap to save again' : 'Save to Files'}
      >
        {saved ? <SmallTick /> : <SaveShareIcon />} {saved ? 'Saved' : 'Save'}
      </button>
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

  async function onExport() {
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
    </div>
  );
}
