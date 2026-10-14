import { useEffect } from 'react';

function TickIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function TodoSheet({ blocks, openTodos, onToggle, onDelete, onNavigateBlock, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Group open to-dos by their block, preserving block order.
  const byBlock = new Map();
  for (const t of openTodos) {
    if (!byBlock.has(t.blockId)) byBlock.set(t.blockId, []);
    byBlock.get(t.blockId).push(t);
  }
  const groups = blocks
    .filter((b) => byBlock.has(b.id))
    .map((b) => ({ block: b, items: byBlock.get(b.id) }));

  const total = openTodos.length;

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Open to-dos"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2 className="sheet-title">{total} open to-dos</h2>
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
              <span>All clear.</span>
            </div>
          ) : (
            groups.map(({ block, items }) => (
              <div className="todo-group" key={block.id}>
                <button
                  type="button"
                  className="todo-group-title"
                  onClick={() => onNavigateBlock(block.id)}
                >
                  {block.title}
                </button>
                <ul className="todo-items">
                  {items.map((t) => (
                    <li key={t.id} className="todo-item">
                      <button
                        type="button"
                        className="todo-check"
                        onClick={() => onToggle(t.id, true)}
                        aria-label="Mark done"
                      />
                      <span className="todo-text">{t.text}</span>
                      <button
                        type="button"
                        className="todo-del"
                        onClick={() => onDelete(t.id)}
                        aria-label="Delete to-do"
                      >
                        <DeleteIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
