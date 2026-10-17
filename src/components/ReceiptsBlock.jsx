import { useState } from 'react';
import { formatCents } from '../lib/money.js';
import { BackupDot } from './ExportButton.jsx';

function Chevron({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      className={'chevron' + (open ? ' chevron-open' : '')}
    >
      <path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function tagClass(tag) {
  return tag === 'food' ? 'tag-food' : tag === 'fuel' ? 'tag-fuel' : 'tag-other';
}

export default function ReceiptsBlock({ receipts, fileById, onOpenReceipt, onBackupFiles }) {
  const [open, setOpen] = useState(true);
  const sum = receipts.reduce((s, r) => s + (r.amountCents || 0), 0);

  return (
    <section className="block block-receipts">
      <button
        type="button"
        className="block-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Chevron open={open} />
        <span className="block-title">Receipts</span>
        <span className="block-meta">
          <span className="pill pill-neutral">{receipts.length}</span>
          <span className="receipts-sum">{formatCents(sum)}</span>
        </span>
      </button>

      {open && (
        <div className="block-body">
          {receipts.length === 0 ? (
            <p className="empty-note">No receipts yet. Tap the gold button to add one.</p>
          ) : (
            <ul className="receipt-list">
              {receipts.map((r) => {
                const g = r.onGtc !== false;
                const v = r.onVoucher !== false;
                const splitBadge = g && !v ? 'GTC' : v && !g ? 'Voucher' : null;
                return (
                <li key={r.id}>
                  <button
                    type="button"
                    className="receipt-row"
                    onClick={() => onOpenReceipt(r)}
                  >
                    <span className={'receipt-thumb ' + tagClass(r.tag)} aria-hidden="true" />
                    <span className="receipt-main">
                      <span className={'receipt-title' + (r.title ? '' : ' muted')}>
                        {r.title || 'Untitled receipt'}
                      </span>
                      <span className="receipt-sub">
                        <span className={'tag-chip ' + tagClass(r.tag)}>{r.tag}</span>
                        {splitBadge && <span className="split-badge">{splitBadge}</span>}
                        <span className="receipt-date">{r.date}</span>
                        {r.location && <span className="receipt-loc">· {r.location}</span>}
                      </span>
                    </span>
                    <span className="receipt-right">
                      <span className={'receipt-amount' + (r.amountCents == null ? ' muted' : '')}>
                        {r.amountCents == null ? 'no amount' : formatCents(r.amountCents)}
                      </span>
                      {r.fileId && fileById[r.fileId] && (
                        <BackupDot
                          saved={fileById[r.fileId].syncState === 'saved'}
                          onBackup={() => onBackupFiles([fileById[r.fileId]])}
                        />
                      )}
                    </span>
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
