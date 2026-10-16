import { useEffect, useRef } from 'react';
import ConfirmInline from './ConfirmInline.jsx';

/**
 * Bottom sheet for importing a trip from a CSV. Three phases:
 *  - 'error'   : the picked file wasn't a DTS Tracker export.
 *  - 'confirm' : the current trip has data — Replace / Cancel.
 *  - 'done'    : import finished; show a summary and offer to reattach files.
 *
 * No window.confirm / alert anywhere; the Replace confirm is inline.
 *
 * @param {{
 *   phase: 'error'|'confirm'|'done',
 *   message?: string,
 *   summary?: {receipts:number, blocks:number, files:number},
 *   pendingCount?: number,
 *   reattachResult?: {matched:number, unmatched:number}|null,
 *   onReplace: () => void,
 *   onReattach: (fileList: FileList) => void,
 *   onClose: () => void,
 * }} props
 */
export default function ImportSheet({
  phase,
  message,
  summary,
  pendingCount = 0,
  reattachResult,
  onReplace,
  onReattach,
  onClose,
}) {
  const reattachInputRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title =
    phase === 'error'
      ? 'Can’t import this file'
      : phase === 'confirm'
        ? 'Import trip from CSV'
        : 'Trip imported';

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="sheet-body">
          {phase === 'error' && (
            <>
              <p className="import-error">{message}</p>
              <button type="button" className="btn btn-ghost import-done-btn" onClick={onClose}>
                OK
              </button>
            </>
          )}

          {phase === 'confirm' && (
            <ConfirmInline
              message="Replace the current trip with this CSV? Current data will be deleted."
              confirmLabel="Replace"
              cancelLabel="Cancel"
              onConfirm={onReplace}
              onCancel={onClose}
            />
          )}

          {phase === 'done' && (
            <>
              <p className="import-summary">
                Imported: {summary?.receipts ?? 0}{' '}
                {summary?.receipts === 1 ? 'receipt' : 'receipts'}, {summary?.blocks ?? 0}{' '}
                {summary?.blocks === 1 ? 'block' : 'blocks'}. {summary?.files ?? 0}{' '}
                {summary?.files === 1 ? 'file' : 'files'} listed.
              </p>

              {pendingCount > 0 && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary import-reattach-btn"
                    onClick={() => reattachInputRef.current && reattachInputRef.current.click()}
                  >
                    Reattach files from Files
                  </button>
                  <input
                    ref={reattachInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    hidden
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length) onReattach(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </>
              )}

              {reattachResult && (
                <p className="import-result">
                  Matched {reattachResult.matched} · Not matched {reattachResult.unmatched}
                </p>
              )}

              <button type="button" className="btn btn-ghost import-done-btn" onClick={onClose}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
