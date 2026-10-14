import { useState } from 'react';

function RemoveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Inline form to create or edit a block.
 * @param initial { title, lines } for edit mode, or undefined for new.
 */
export default function BlockForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [lines, setLines] = useState(
    initial?.lines && initial.lines.length ? [...initial.lines] : ['']
  );
  const [error, setError] = useState('');

  function setLine(i, v) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? v : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, '']);
  }
  function removeLine(i) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  function save() {
    const t = title.trim();
    if (!t) {
      setError('A title is required.');
      return;
    }
    const cleanLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);
    onSave({ title: t, lines: cleanLines });
  }

  return (
    <div className="block-form">
      <label className="field">
        <span className="field-label">Title</span>
        <input
          className="text-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError('');
          }}
          placeholder="e.g. Hotel in Augusta"
          autoFocus
        />
      </label>

      <div className="field">
        <span className="field-label">Lines</span>
        {lines.map((line, i) => (
          <div className="line-row" key={i}>
            <input
              className="text-input"
              value={line}
              onChange={(e) => setLine(i, e.target.value)}
              placeholder="e.g. Confirmation: ABC123"
            />
            {lines.length > 1 && (
              <button
                type="button"
                className="line-remove"
                onClick={() => removeLine(i)}
                aria-label="Remove line"
              >
                <RemoveIcon />
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-subtle add-line-btn" onClick={addLine}>
          + Add another line
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={save}>
          Save block
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
