import { useEffect, useRef, useState } from 'react';
import DocViewer from './DocViewer.jsx';
import { BackupButton } from './ExportButton.jsx';

function TickIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KindIcon({ kind }) {
  if (kind === 'photo') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect x="3" y="6" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="9" cy="11" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M5 19l5-4 3 2 3-3 3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'pdf') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M14 3v5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function BackupSheet({ blocks, files, onBackupFiles, onClose }) {
  const [viewerId, setViewerId] = useState(null);
  const viewerOpenRef = useRef(false);
  viewerOpenRef.current = viewerId !== null;

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (viewerOpenRef.current) return; // viewer closes itself first
      onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const unsaved = files.filter((f) => f.syncState !== 'saved');
  const total = unsaved.length;

  // Group: receipt files first, then one group per block (in block order).
  const receiptFiles = unsaved.filter((f) => f.receiptId);
  const groups = [];
  if (receiptFiles.length) groups.push({ key: 'receipts', title: 'Receipts', items: receiptFiles });
  for (const b of blocks) {
    const items = unsaved.filter((f) => f.blockId === b.id);
    if (items.length) groups.push({ key: b.id, title: b.title, items });
  }

  const viewerFile = viewerId ? files.find((f) => f.id === viewerId) : null;

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Back up files"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2 className="sheet-title">
            {total === 0 ? 'All files backed up' : `${total} files not backed up`}
          </h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="sheet-body">
          {total === 0 ? (
            <div className="all-clear">
              <span className="all-clear-tick">
                <TickIcon size={28} />
              </span>
              <span>All files backed up.</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary save-all-btn"
                onClick={() => onBackupFiles(unsaved)}
              >
                Save all ({total})
              </button>

              {groups.map((g) => (
                <div className="backup-group" key={g.key}>
                  <div className="backup-group-title">{g.title}</div>
                  <ul className="backup-list">
                    {g.items.map((f) => (
                      <li key={f.id} className="backup-row">
                        <button
                          type="button"
                          className="backup-row-open"
                          onClick={() => setViewerId(f.id)}
                          aria-label={`Open ${f.name}`}
                        >
                          <span className="backup-row-icon">
                            <KindIcon kind={f.kind} />
                          </span>
                          <span className="backup-row-name">{f.name}</span>
                        </button>
                        <BackupButton saved={false} onBackup={() => onBackupFiles([f])} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>

        {viewerFile && (
          <DocViewer
            file={viewerFile}
            saved={viewerFile.syncState === 'saved'}
            onBackup={() => onBackupFiles([viewerFile])}
            onClose={() => setViewerId(null)}
          />
        )}
      </div>
    </div>
  );
}
