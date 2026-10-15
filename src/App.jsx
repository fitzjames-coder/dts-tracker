import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ensureTrip,
  loadAll,
  updateTrip,
  addBlock,
  updateBlock,
  deleteBlock,
  addTodo,
  updateTodo,
  deleteTodo,
  addReceipt,
  updateReceipt,
  deleteReceipt,
  addFile,
  deleteFile,
  markFilesSaved,
} from './db.js';
import { reencodeToJpeg } from './lib/image.js';
import { formatCents, centsToInput } from './lib/money.js';
import { shareFiles } from './lib/share.js';
import TopBar from './components/TopBar.jsx';
import BudgetTiles from './components/BudgetTiles.jsx';
import ReceiptsBlock from './components/ReceiptsBlock.jsx';
import Block from './components/Block.jsx';
import BlockForm from './components/BlockForm.jsx';
import ReceiptSheet from './components/ReceiptSheet.jsx';
import TodoSheet from './components/TodoSheet.jsx';
import BackupSheet from './components/BackupSheet.jsx';
import ExportButton from './components/ExportButton.jsx';

export default function App() {
  const [trip, setTrip] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [todos, setTodos] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [persistWarn, setPersistWarn] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  const [receiptSheet, setReceiptSheet] = useState(null); // { mode, receipt }
  const [todoSheetOpen, setTodoSheetOpen] = useState(false);
  const [backupSheetOpen, setBackupSheetOpen] = useState(false);
  const [navTodoBlockId, setNavTodoBlockId] = useState(null);

  const persistedRef = useRef(false);

  const reload = useCallback(async (tripId) => {
    const data = await loadAll(tripId);
    setBlocks(data.blocks);
    setTodos(data.todos);
    setReceipts(data.receipts);
    setFiles(data.files);
  }, []);

  useEffect(() => {
    (async () => {
      const t = await ensureTrip();
      setTrip(t);
      await reload(t.id);
      setLoading(false);
    })();
  }, [reload]);

  // Request persistent storage on the first user action.
  const ensurePersist = useCallback(async () => {
    if (persistedRef.current) return;
    persistedRef.current = true;
    if (navigator.storage && navigator.storage.persist) {
      try {
        const ok = await navigator.storage.persist();
        if (!ok) setPersistWarn(true);
      } catch {
        setPersistWarn(true);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    if (trip) await reload(trip.id);
  }, [trip, reload]);

  // Wrap a mutation so persistence is requested and data reloads afterwards.
  const act = useCallback(
    async (fn) => {
      await ensurePersist();
      await fn();
      await refresh();
    },
    [ensurePersist, refresh]
  );

  // --- Derived data ---------------------------------------------------------

  const todosByBlock = useMemo(() => {
    const map = {};
    for (const t of todos) (map[t.blockId] ||= []).push(t);
    return map;
  }, [todos]);

  const filesByBlock = useMemo(() => {
    const map = {};
    for (const f of files) {
      if (f.blockId) (map[f.blockId] ||= []).push(f);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.createdAt - b.createdAt);
    return map;
  }, [files]);

  const fileById = useMemo(() => {
    const map = {};
    for (const f of files) map[f.id] = f;
    return map;
  }, [files]);

  const openTodoCount = useMemo(() => todos.filter((t) => !t.done).length, [todos]);
  const openTodos = useMemo(() => todos.filter((t) => !t.done), [todos]);

  const voucherUsed = useMemo(
    () => receipts.reduce((s, r) => s + (r.amountCents || 0), 0),
    [receipts]
  );
  const perDiemUsed = useMemo(
    () => receipts.filter((r) => r.tag === 'food').reduce((s, r) => s + (r.amountCents || 0), 0),
    [receipts]
  );
  const fuelUsed = useMemo(
    () => receipts.filter((r) => r.tag === 'fuel').reduce((s, r) => s + (r.amountCents || 0), 0),
    [receipts]
  );

  const unsavedCount = useMemo(
    () => files.filter((f) => f.syncState !== 'saved').length,
    [files]
  );
  const allSaved = unsavedCount === 0;

  // Back up files through the OS share sheet. shareFiles must run straight from
  // the tap (no await before it) or iOS drops the activation navigator.share
  // needs — so ensurePersist is fired without awaiting.
  const onBackupFiles = useCallback(
    async (fileRows) => {
      ensurePersist();
      const res = await shareFiles(fileRows);
      if (res.status === 'done') {
        await markFilesSaved(fileRows.map((f) => f.id));
        await refresh();
      }
      return res; // { status, errorName }
    },
    [ensurePersist, refresh]
  );

  // --- Search ---------------------------------------------------------------

  const q = search.trim().toLowerCase();
  const searching = q.length > 0;

  const matchBlock = useCallback(
    (block) => {
      if (block.title.toLowerCase().includes(q)) return true;
      if ((block.lines || []).some((l) => l.toLowerCase().includes(q))) return true;
      if ((todosByBlock[block.id] || []).some((t) => t.text.toLowerCase().includes(q))) return true;
      if ((filesByBlock[block.id] || []).some((f) => (f.name || '').toLowerCase().includes(q)))
        return true;
      return false;
    },
    [q, todosByBlock, filesByBlock]
  );

  const matchReceipt = useCallback(
    (r) => {
      if ((r.title || '').toLowerCase().includes(q)) return true;
      if ((r.tag || '').toLowerCase().includes(q)) return true;
      if ((r.date || '').toLowerCase().includes(q)) return true;
      if (r.amountCents != null) {
        if (centsToInput(r.amountCents).includes(q)) return true;
        if (formatCents(r.amountCents).toLowerCase().includes(q)) return true;
      }
      return false;
    },
    [q]
  );

  const visibleBlocks = searching ? blocks.filter(matchBlock) : blocks;
  const visibleReceipts = searching ? receipts.filter(matchReceipt) : receipts;
  const nothingMatches = searching && visibleBlocks.length === 0 && visibleReceipts.length === 0;

  // --- Handlers -------------------------------------------------------------

  const onRenameTrip = (name) => act(() => updateTrip(trip.id, { name }).then(() => setTrip((t) => ({ ...t, name }))));
  const onSaveTotals = (changes) =>
    act(() => updateTrip(trip.id, changes).then(() => setTrip((t) => ({ ...t, ...changes }))));

  const onAddBlock = (data) => act(async () => { await addBlock(trip.id, data); setAddingBlock(false); });
  const onUpdateBlock = (id, data) => act(() => updateBlock(id, data));
  const onDeleteBlock = (id) => act(() => deleteBlock(id));
  const onToggleBlockOpen = (id, open) => act(() => updateBlock(id, { open }));

  const onAddTodo = (blockId, text) => act(() => addTodo(blockId, text));
  const onToggleTodo = (id, done) => act(() => updateTodo(id, { done }));
  const onDeleteTodo = (id) => act(() => deleteTodo(id));

  const onAddDoc = (blockId, file, source) =>
    act(async () => {
      let fileRow;
      if (source === 'photo') {
        // Camera capture -> numbered <BlockWord>-<n>.jpg (db assigns the name).
        const blob = await reencodeToJpeg(file);
        fileRow = {
          kind: 'photo',
          numbered: true,
          ext: 'jpg',
          mimeType: 'image/jpeg',
          size: blob.size,
          blob,
        };
      } else {
        // Uploaded file -> keep its original name (db dedupes if needed).
        const isPdf = file.type === 'application/pdf';
        fileRow = {
          kind: isPdf ? 'pdf' : 'upload',
          numbered: false,
          originalName: file.name || (isPdf ? 'document.pdf' : 'upload'),
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          blob: file,
        };
      }
      await addFile(trip.id, blockId, fileRow);
    });

  const onDeleteDoc = (id) => act(() => deleteFile(id));

  const onSaveNewReceipt = (fields, fileRow) =>
    act(async () => {
      await addReceipt(trip.id, fields, fileRow);
      setReceiptSheet(null);
    });
  const onSaveEditReceipt = (id, fields) =>
    act(async () => {
      await updateReceipt(id, fields);
      setReceiptSheet(null);
    });
  const onDeleteReceipt = (id) =>
    act(async () => {
      await deleteReceipt(id);
      setReceiptSheet(null);
    });

  const navigateToBlock = (blockId) =>
    act(async () => {
      await updateBlock(blockId, { open: true, todoOpen: true });
      setTodoSheetOpen(false);
      setNavTodoBlockId(blockId);
      setSearch('');
      setTimeout(() => {
        const el = document.getElementById('block-' + blockId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    });

  if (loading) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <TopBar
          trip={trip}
          allSaved={allSaved}
          unsavedCount={unsavedCount}
          persistWarn={persistWarn}
          search={search}
          onSearch={setSearch}
          openTodoCount={openTodoCount}
          onOpenTodos={() => setTodoSheetOpen(true)}
          onOpenBackup={() => setBackupSheetOpen(true)}
          onNewReceipt={() => {
            ensurePersist();
            setReceiptSheet({ mode: 'new', receipt: null });
          }}
          onRenameTrip={onRenameTrip}
        />
        <BudgetTiles
          trip={trip}
          voucherUsed={voucherUsed}
          perDiemUsed={perDiemUsed}
          fuelUsed={fuelUsed}
          onSaveTotals={onSaveTotals}
        />
      </header>

      <main className="body">
        {nothingMatches ? (
          <p className="nothing-matches">Nothing matches “{search.trim()}”.</p>
        ) : (
          <>
            <ReceiptsBlock
              receipts={visibleReceipts}
              fileById={fileById}
              onOpenReceipt={(r) => setReceiptSheet({ mode: 'edit', receipt: r })}
              onBackupFiles={onBackupFiles}
            />

            {!searching &&
              (addingBlock ? (
                <section className="block">
                  <BlockForm onSave={onAddBlock} onCancel={() => setAddingBlock(false)} />
                </section>
              ) : (
                <button
                  type="button"
                  className="add-block-btn"
                  onClick={() => {
                    ensurePersist();
                    setAddingBlock(true);
                  }}
                >
                  + Add a block
                </button>
              ))}

            {visibleBlocks.map((b) => (
              <Block
                key={b.id}
                block={b}
                anchorId={'block-' + b.id}
                todos={todosByBlock[b.id] || []}
                files={filesByBlock[b.id] || []}
                expanded={searching ? true : b.open}
                forceTodoOpen={navTodoBlockId === b.id}
                onToggleOpen={onToggleBlockOpen}
                onUpdate={onUpdateBlock}
                onDelete={onDeleteBlock}
                onAddTodo={onAddTodo}
                onToggleTodo={onToggleTodo}
                onDeleteTodo={onDeleteTodo}
                onAddDoc={onAddDoc}
                onDeleteFile={onDeleteDoc}
                onBackupFiles={onBackupFiles}
              />
            ))}

            <ExportButton
              trip={trip}
              receipts={receipts}
              fileById={fileById}
              voucherUsed={voucherUsed}
              perDiemUsed={perDiemUsed}
              fuelUsed={fuelUsed}
            />
          </>
        )}
      </main>

      {receiptSheet && (
        <ReceiptSheet
          mode={receiptSheet.mode}
          receipt={receiptSheet.receipt}
          existingFile={receiptSheet.receipt ? fileById[receiptSheet.receipt.fileId] : null}
          onClose={() => setReceiptSheet(null)}
          onSaveNew={onSaveNewReceipt}
          onSaveEdit={onSaveEditReceipt}
          onDelete={onDeleteReceipt}
          onBackupFiles={onBackupFiles}
        />
      )}

      {backupSheetOpen && (
        <BackupSheet
          blocks={blocks}
          files={files}
          onBackupFiles={onBackupFiles}
          onClose={() => setBackupSheetOpen(false)}
        />
      )}

      {todoSheetOpen && (
        <TodoSheet
          blocks={blocks}
          openTodos={openTodos}
          onToggle={onToggleTodo}
          onDelete={onDeleteTodo}
          onNavigateBlock={navigateToBlock}
          onClose={() => setTodoSheetOpen(false)}
        />
      )}
    </div>
  );
}
