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
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
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

/**
 * Red "Save" / green "✓ Saved" backup button. onBackup returns the share
 * status; on 'unsupported' an inline line is shown.
 * @param {{saved: boolean, onBackup: () => Promise<string>, full?: boolean}} props
 */
export function BackupButton({ saved, onBackup, full }) {
  const [unsupported, setUnsupported] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handle(e) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setUnsupported(false);
    let res;
    try {
      res = await onBackup();
    } finally {
      setBusy(false);
    }
    if (res === 'unsupported') setUnsupported(true);
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
        aria-label={saved ? 'Backed up — tap to re-save' : 'Save backup'}
      >
        {saved ? (
          <>
            <SmallTick /> Saved
          </>
        ) : (
          'Save'
        )}
      </button>
      {unsupported && <span className="backup-unsupported">{UNSUPPORTED_MSG}</span>}
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
  const [status, setStatus] = useState(''); // '', 'exported', 'unsupported'

  async function onExport() {
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
    const res = await shareFiles([file]);
    if (res === 'done') {
      setStatus('exported');
      setTimeout(() => setStatus(''), 2000);
    } else if (res === 'unsupported') {
      setStatus('unsupported');
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
    </div>
  );
}
