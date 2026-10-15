import { useEffect, useRef, useState } from 'react';
import { formatCents, formatSignedCents, centsToInput, parseAmountToCents } from '../lib/money.js';

function Tile({ label, totalCents, usedCents, onSaveTotal }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingCents, setPendingCents] = useState(null); // confirm in progress
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
  const confirming = pendingCents !== null;

  function startEdit() {
    setDraft(centsToInput(totalCents));
    setEditing(true);
  }

  // Enter/blur: don't save yet — ask for confirmation first.
  function commit() {
    const cents = parseAmountToCents(draft);
    const next = cents == null ? 0 : cents;
    setEditing(false);
    if (next === totalCents) {
      // No change: just close the editor, no prompt.
      setPendingCents(null);
      return;
    }
    setPendingCents(next);
  }

  function confirmSave() {
    onSaveTotal(pendingCents);
    setPendingCents(null);
  }

  function cancel() {
    // Restore the old value; save nothing.
    setPendingCents(null);
  }

  return (
    <div className={'tile' + (over ? ' tile-over' : '')}>
      <div className="tile-label">{label}</div>
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

      {confirming && (
        <div className="tile-confirm" role="alertdialog" aria-label={`Change ${label} total`}>
          <span className="tile-confirm-msg">
            Change {label} total to {formatCents(pendingCents)}?
          </span>
          <div className="tile-confirm-actions">
            <button type="button" className="btn btn-ghost tile-confirm-btn" onClick={cancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary tile-confirm-btn" onClick={confirmSave}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BudgetTiles({ trip, voucherUsed, perDiemUsed, fuelUsed, onSaveTotals }) {
  if (!trip) return null;
  return (
    <div className="tiles">
      <Tile
        label="Voucher"
        totalCents={trip.voucherCents}
        usedCents={voucherUsed}
        onSaveTotal={(c) => onSaveTotals({ voucherCents: c })}
      />
      <Tile
        label="Per diem"
        totalCents={trip.perDiemCents}
        usedCents={perDiemUsed}
        onSaveTotal={(c) => onSaveTotals({ perDiemCents: c })}
      />
      <Tile
        label="Fuel"
        totalCents={trip.fuelCents}
        usedCents={fuelUsed}
        onSaveTotal={(c) => onSaveTotals({ fuelCents: c })}
      />
    </div>
  );
}
