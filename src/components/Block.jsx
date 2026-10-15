import { useState } from 'react';
import TodoList from './TodoList.jsx';
import DocCapture from './DocCapture.jsx';
import BlockForm from './BlockForm.jsx';
import ConfirmInline from './ConfirmInline.jsx';
import DocViewer from './DocViewer.jsx';
import CropScreen from './CropScreen.jsx';
import { BackupButton } from './ExportButton.jsx';
import { fileDate } from '../db.js';

const CODE_PREFIXES = ['Confirmation:', 'TANUM:', 'SATO ticket:'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-15" -> "15 Oct" (parsed locally, no timezone shift). */
function shortDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mon = MONTHS[Number(m[2]) - 1] || '';
  return `${Number(m[3])} ${mon}`.trim();
}

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

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d="M16.5 7.5l-7 7a2.5 2.5 0 103.5 3.5l7-7a4.5 4.5 0 10-6.5-6.5l-7 7a6.5 6.5 0 109 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocKindIcon({ kind }) {
  if (kind === 'pdf') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M14 3v5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'photo') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <rect x="3" y="6" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="9" cy="11" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M5 19l5-4 3 2 3-3 3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
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

function renderLine(line, i) {
  const prefix = CODE_PREFIXES.find((p) =>
    line.toLowerCase().startsWith(p.toLowerCase())
  );
  if (prefix) {
    const value = line.slice(prefix.length).trim();
    return (
      <li key={i} className="block-line">
        <span className="line-label">{prefix}</span>{' '}
        <code className="code-chip">{value}</code>
      </li>
    );
  }
  return (
    <li key={i} className="block-line">
      {line}
    </li>
  );
}

export default function Block({
  block,
  todos,
  files,
  expanded,
  forceTodoOpen,
  anchorId,
  onToggleOpen,
  onUpdate,
  onDelete,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onAddDoc,
  onDeleteFile,
  onBackupFiles,
  onToggleDocsOpen,
  onReplaceFileBlob,
  onUpdateFile,
}) {
  const [editing, setEditing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [confirmDeleteBlock, setConfirmDeleteBlock] = useState(false);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [cropSource, setCropSource] = useState(null); // raw camera file awaiting crop

  const openTodos = todos.filter((t) => !t.done).length;
  const allDone = todos.length > 0 && openTodos === 0;
  const lineCount = (block.lines || []).length;
  const unsavedDocs = files.filter((f) => f.syncState !== 'saved').length;
  const docsOpen = !!block.docsOpen;

  if (editing) {
    return (
      <section className="block" id={anchorId}>
        <BlockForm
          initial={{ title: block.title, lines: block.lines }}
          onSave={(data) => {
            onUpdate(block.id, data);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </section>
    );
  }

  const confirmFileTarget = files.find((f) => f.id === confirmDeleteFile);

  return (
    <section className="block" id={anchorId}>
      <button
        type="button"
        className="block-header"
        onClick={() => onToggleOpen(block.id, !block.open)}
        aria-expanded={expanded}
      >
        <Chevron open={expanded} />
        <span className="block-title">{block.title}</span>
        <span className="block-meta">
          {todos.length > 0 &&
            (allDone ? (
              <span className="pill pill-ok" title="All to-dos done">
                <TickIcon />
              </span>
            ) : openTodos > 0 ? (
              <span className="pill pill-danger" title={`${openTodos} to-dos open`}>
                {openTodos}
              </span>
            ) : null)}
          {files.length > 0 && (
            <span className="pill pill-neutral paperclip-pill" title={`${files.length} documents`}>
              <PaperclipIcon /> {files.length}
            </span>
          )}
          <span className="lines-count">{lineCount} lines</span>
        </span>
      </button>

      {expanded && (
        <div className="block-body">
          {lineCount > 0 && (
            <ul className="block-lines">{block.lines.map(renderLine)}</ul>
          )}

          <TodoList
            todos={todos}
            forceOpen={forceTodoOpen}
            onAdd={(text) => onAddTodo(block.id, text)}
            onToggle={onToggleTodo}
            onDelete={onDeleteTodo}
          />

          {files.length > 0 && (
            <div className={'todo-sub' + (unsavedDocs > 0 ? ' todo-sub-active' : '')}>
              <button
                type="button"
                className="todo-sub-header"
                onClick={() => onToggleDocsOpen(block.id, !docsOpen)}
                aria-expanded={docsOpen}
              >
                <Chevron open={docsOpen} />
                <span className="todo-sub-title">Documents</span>
                {unsavedDocs > 0 && (
                  <span className="pill pill-danger">{unsavedDocs} not saved</span>
                )}
                <span className="todo-sub-count">{files.length} files</span>
              </button>

              {docsOpen && (
                <div className="todo-sub-body">
                  <ul className="doc-chips">
                    {files.map((f) => (
                      <li key={f.id} className="doc-chip">
                        <button
                          type="button"
                          className="doc-chip-open"
                          onClick={() => setViewerFile(f)}
                          aria-label={`Open ${f.name}`}
                        >
                          <span className="doc-chip-icon">
                            <DocKindIcon kind={f.kind} />
                          </span>
                          <span className="doc-chip-text">
                            <span className="doc-chip-name">{f.name}</span>
                            <span className="doc-chip-meta">
                              {shortDate(fileDate(f))}
                              {f.location ? ` · ${f.location}` : ''}
                            </span>
                          </span>
                        </button>
                        <BackupButton
                          saved={f.syncState === 'saved'}
                          onBackup={() => onBackupFiles([f])}
                        />
                        <button
                          type="button"
                          className="doc-chip-del"
                          onClick={() => setConfirmDeleteFile(f.id)}
                          aria-label="Delete document"
                        >
                          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {confirmFileTarget && (
                    <ConfirmInline
                      message={`Delete document “${confirmFileTarget.name}”?`}
                      onConfirm={() => {
                        onDeleteFile(confirmFileTarget.id);
                        setConfirmDeleteFile(null);
                      }}
                      onCancel={() => setConfirmDeleteFile(null)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {capturing ? (
            <DocCapture
              onPick={(file, source) => {
                setCapturing(false);
                // Camera photos go through crop first; uploads/PDFs do not.
                if (source === 'photo') setCropSource(file);
                else onAddDoc(block.id, file, source);
              }}
              onCancel={() => setCapturing(false)}
            />
          ) : (
            <div className="block-actions">
              <button type="button" className="btn btn-primary" onClick={() => setCapturing(true)}>
                Add document
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                className="btn btn-trash"
                onClick={() => setConfirmDeleteBlock(true)}
                aria-label="Delete block"
              >
                <TrashIcon />
              </button>
            </div>
          )}

          {confirmDeleteBlock && (
            <ConfirmInline
              message={`Delete “${block.title}” and its ${files.length} documents?`}
              onConfirm={() => {
                onDelete(block.id);
                setConfirmDeleteBlock(false);
              }}
              onCancel={() => setConfirmDeleteBlock(false)}
            />
          )}
        </div>
      )}

      {viewerFile &&
        (() => {
          // Use the live file row so the viewer's backup state stays current.
          const live = files.find((f) => f.id === viewerFile.id) || viewerFile;
          const isImage = (live.mimeType || '').startsWith('image/');
          return (
            <DocViewer
              file={live}
              saved={live.syncState === 'saved'}
              onBackup={() => onBackupFiles([live])}
              onCrop={isImage ? (blob) => onReplaceFileBlob(live.id, blob) : undefined}
              onUpdateFile={onUpdateFile}
              onClose={() => setViewerFile(null)}
            />
          );
        })()}

      {cropSource && (
        <CropScreen
          source={cropSource}
          onDone={(blob) => {
            onAddDoc(block.id, blob, 'photo-processed');
            setCropSource(null);
          }}
          onCancel={() => setCropSource(null)}
        />
      )}
    </section>
  );
}
