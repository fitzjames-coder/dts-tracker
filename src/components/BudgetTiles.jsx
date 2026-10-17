import { useEffect, useRef, useState } from 'react';
import { formatCents, formatSignedCents, centsToInput, parseAmountToCents } from '../lib/money.js';

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" className="tile-icon">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="2.5" y1="9.5" x2="21.5" y2="9.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// A single budget tile. The inline amount editor stays local to the tile; a
// committed change doesn't save straight away — it asks the parent to open the
// shared confirm panel (rendered once, below the whole row) so a confirm can
// never be trapped inside one narrow tile.
function Tile({ label, icon, totalCents, usedCents, onSaveTotal, onRequestConfirm, onClearConfirm }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const remaining = totalCents - usedCents;
  const over = remaining < 0;
  const frac = totalCents > 0 ? Math.min(1, Math.max(0, usedCents / totalCents)) : usedCents > 0 ? 1 : 0;

  function startEdit() {
    setDraft(centsToInput(totalCents));
    setEditing(true);
  }

  // Enter/blur: don't save yet — ask the parent to open the confirm panel.
  function commit() {
    const cents = parseAmountToCents(draft);
    const next = cents == null ? 0 : cents;
    setEditing(false);
    if (next === totalCents) {
      // No change: just close the editor, and drop any confirm still showing
      // for this tile.
      onClearConfirm(label);
      return;
    }
    onRequestConfirm({ label, cents: next, save: onSaveTotal });
  }

  return (
    <div className={'tile' + (over ? ' tile-over' : '')}>
      <div className="tile-label">
        {icon}
        {label}
      </div>
      <div className={'tile-remaining' + (over ? ' tile-remaining-over' : '')}>
        {formatSignedCents(remaining)}
      </div>
      <div className="tile-of">
        {over ? 'over, of ' : 'left of '}
        {editing ? (
          <input
            ref={inputRef}
            className="tile-total-input"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            aria-label={`${label} total`}
          />
        ) : (
          <button type="button" className="tile-total" onClick={startEdit} title="Tap to edit total">
            {formatCents(totalCents)}
          </button>
        )}
      </div>
      <div className="tile-bar">
        <div
          className={'tile-bar-fill' + (over ? ' tile-bar-fill-over' : '')}
          style={{ width: Math.round(frac * 100) + '%' }}
        />
      </div>
    </div>
  );
}

export default function BudgetTiles({ trip, gtcUsed, voucherUsed, perDiemUsed, fuelUsed, onSaveTotals }) {
  // Only one total-change confirm can be open at a time; opening another
  // replaces it. { label, cents, save } or null.
  const [confirm, setConfirm] = useState(null);

  if (!trip) return null;

  const requestConfirm = (c) => setConfirm(c);
  // Clear only if the confirm currently showing belongs to this tile.
  const clearConfirm = (label) =>
    setConfirm((cur) => (cur && cur.label === label ? null : cur));
  const saveConfirm = () => {
    if (confirm) confirm.save(confirm.cents);
    setConfirm(null);
  };
  const cancelConfirm = () => setConfirm(null);

  const tileProps = { onRequestConfirm: requestConfirm, onClearConfirm: clearConfirm };

  return (
    <>
      <div className="tiles">
        <Tile
          label="GTC"
          icon={<CardIcon />}
          totalCents={trip.gtcLimitCents || 0}
          usedCents={gtcUsed}
          onSaveTotal={(c) => onSaveTotals({ gtcLimitCents: c })}
          {...tileProps}
        />
        <Tile
          label="Voucher"
          totalCents={trip.voucherCents}
          usedCents={voucherUsed}
          onSaveTotal={(c) => onSaveTotals({ voucherCents: c })}
          {...tileProps}
        />
        <Tile
          label="M&IE"
          totalCents={trip.perDiemCents}
          usedCents={perDiemUsed}
          onSaveTotal={(c) => onSaveTotals({ perDiemCents: c })}
          {...tileProps}
        />
        <Tile
          label="Fuel"
          totalCents={trip.fuelCents}
          usedCents={fuelUsed}
          onSaveTotal={(c) => onSaveTotals({ fuelCents: c })}
          {...tileProps}
        />
      </div>

      {confirm && (
        <div
          className="tile-confirm tile-confirm-panel"
          role="alertdialog"
          aria-label={`Change ${confirm.label} total`}
        >
          <span className="tile-confirm-msg">
            Change {confirm.label} total to {formatCents(confirm.cents)}?
          </span>
          <div className="tile-confirm-actions">
            <button type="button" className="btn btn-ghost tile-confirm-btn" onClick={cancelConfirm}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary tile-confirm-btn" onClick={saveConfirm}>
              Save
            </button>
          </div>
        </div>
      )}
    </>
  );
}
