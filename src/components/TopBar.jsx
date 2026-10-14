import { useEffect, useRef, useState } from 'react';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21V3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="9" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function TopBar({
  trip,
  localFileCount,
  persistWarn,
  search,
  onSearch,
  openTodoCount,
  onOpenTodos,
  onNewReceipt,
  onRenameTrip,
}) {
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(trip?.name || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  function startEdit() {
    setDraft(trip?.name || '');
    setEditingName(true);
  }

  function commit() {
    const name = draft.trim() || 'New trip';
    onRenameTrip(name);
    setEditingName(false);
  }

  const todoActive = openTodoCount > 0;

  return (
    <div className="topbar">
      <div className="trip-line">
        <span className="trip-label">TRIP</span>
        {editingName ? (
          <input
            ref={inputRef}
            className="trip-name-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditingName(false);
            }}
            aria-label="Trip name"
          />
        ) : (
          <button type="button" className="trip-name" onClick={startEdit} title="Tap to rename">
            {trip?.name || 'New trip'}
          </button>
        )}

        {localFileCount > 0 && (
          <span className="status-light" title="Files stored only on this phone">
            <span className="dot dot-amber" />
            {localFileCount} on phone only
          </span>
        )}
      </div>

      {persistWarn && (
        <div className="persist-warn" role="status">
          Storage is not persistent — the browser may clear this data.
        </div>
      )}

      <div className="search-row">
        <div className="search-field">
          <SearchIcon />
          <input
            type="search"
            inputMode="search"
            placeholder="Search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Search"
          />
        </div>

        <button
          type="button"
          className={'icon-btn todo-btn' + (todoActive ? ' todo-btn-active' : '')}
          onClick={onOpenTodos}
          aria-label={todoActive ? `${openTodoCount} to-dos open` : 'To-dos'}
        >
          {todoActive ? (
            <span className="todo-btn-content">
              <span className="todo-count">{openTodoCount}</span>
              <span className="todo-word">TO DO</span>
            </span>
          ) : (
            <CheckIcon />
          )}
        </button>

        <button
          type="button"
          className="icon-btn receipt-btn"
          onClick={onNewReceipt}
          aria-label="New receipt"
        >
          <ReceiptIcon />
        </button>
      </div>
    </div>
  );
}
