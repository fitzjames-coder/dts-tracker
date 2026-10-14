import { useState } from 'react';
import ConfirmInline from './ConfirmInline.jsx';

function Chevron({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      className={'chevron' + (open ? ' chevron-open' : '')}
    >
      <path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
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

/**
 * The "To do" sub-block shown inside an expanded block.
 * @param forceOpen when true (e.g. navigated from the sheet), start expanded.
 */
export default function TodoList({ todos, forceOpen, onAdd, onToggle, onDelete }) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const effectiveOpen = open || forceOpen;
  const openCount = todos.filter((t) => !t.done).length;
  const hasOpen = openCount > 0;

  function submit() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  }

  const confirmTarget = todos.find((t) => t.id === confirmId);

  return (
    <div className={'todo-sub' + (hasOpen ? ' todo-sub-active' : '')}>
      <button
        type="button"
        className="todo-sub-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={effectiveOpen}
      >
        <Chevron open={effectiveOpen} />
        <span className="todo-sub-title">To do</span>
        <span className={'todo-sub-count' + (hasOpen ? ' todo-sub-count-open' : '')}>
          {hasOpen ? `${openCount} open` : 'all done'}
        </span>
      </button>

      {effectiveOpen && (
        <div className="todo-sub-body">
          <ul className="todo-items">
            {todos.map((t) => (
              <li key={t.id} className="todo-item">
                <button
                  type="button"
                  className={'todo-check' + (t.done ? ' todo-check-done' : '')}
                  onClick={() => onToggle(t.id, !t.done)}
                  aria-label={t.done ? 'Mark not done' : 'Mark done'}
                >
                  {t.done && <TickIcon />}
                </button>
                <span className={'todo-text' + (t.done ? ' todo-text-done' : '')}>{t.text}</span>
                <button
                  type="button"
                  className="todo-del"
                  onClick={() => setConfirmId(t.id)}
                  aria-label="Delete to-do"
                >
                  <DeleteIcon />
                </button>
              </li>
            ))}
          </ul>

          {confirmTarget && (
            <ConfirmInline
              message={`Delete to-do “${confirmTarget.text}”?`}
              onConfirm={() => {
                onDelete(confirmTarget.id);
                setConfirmId(null);
              }}
              onCancel={() => setConfirmId(null)}
            />
          )}

          <div className="todo-add">
            <input
              className="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="New to-do item"
              aria-label="New to-do item"
            />
            <button type="button" className="todo-add-btn" onClick={submit} aria-label="Add to-do">
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
