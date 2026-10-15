import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ensureTrip,
  getTrip,
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
  updateFile,
  markFilesSaved,
  replaceFileBlob,
  wipeAll,
  importTrip,
  attachFiles,
} from './db.js';
import { reencodeToJpeg } from './lib/image.js';
import { formatCents, centsToInput } from './lib/money.js';
import { shareFiles } from './lib/share.js';
import { buildReceiptsCsv, csvFilename } from './lib/csv.js';
import { parseTripCsv } from './lib/csvImport.js';
import TopBar from './components/TopBar.jsx';
import BudgetTiles from './components/BudgetTiles.jsx';
import ReceiptsBlock from './components/ReceiptsBlock.jsx';
import Block from './components/Block.jsx';
import BlockForm from './components/BlockForm.jsx';
import ReceiptSheet from './components/ReceiptSheet.jsx';
import TodoSheet from './components/TodoSheet.jsx';
import BackupSheet from './components/BackupSheet.jsx';
import NewTripSheet from './components/NewTripSheet.jsx';
import ImportSheet from './components/ImportSheet.jsx';
import ExportButton, { UNLOCK_SCROLL_KEY } from './components/ExportButton.jsx';

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
  const [newTripOpen, setNewTripOpen] = useState(false);
  // Import: { phase:'error', message } | { phase:'confirm', parsed } | { phase:'done' }
  const [importSheet, setImportSheet] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [reattachResult, setReattachResult] = useState(null);
  const [navTodoBlockId, setNavTodoBlockId] = useState(null);
  // After any completed Save to Files, iOS needs a reload before the next
  // view/save. In-memory only, so it resets to false on reload.
  const [needsUnlock, setNeedsUnlock] = useState(false);

  const persistedRef = useRef(false);
  const scrollRestoredRef = useRef(false);
  const csvInputRef = useRef(null);
  const reattachInputRef = useRef(null);

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

  // After an unlock reload, restore the scroll position once data has loaded.
  useEffect(() => {
    if (loading || scrollRestoredRef.current) return;
    scrollRestoredRef.current = true;
    try {
      const v = sessionStorage.getItem(UNLOCK_SCROLL_KEY);
      if (v != null) {
        sessionStorage.removeItem(UNLOCK_SCROLL_KEY);
        const y = parseInt(v, 10);
        if (Number.isFinite(y)) requestAnimationFrame(() => window.scrollTo(0, y));
      }
    } catch {
      /* ignore */
    }
  }, [loading]);

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
        setNeedsUnlock(true); // iOS: must reload before the next view/save
      }
      return res; // { status, errorName }
    },
    [ensurePersist, refresh]
  );

  // Build the CSV file descriptor from the current trip (used by Export and by
  // Start new trip). Synchronous, so callers can share straight from the tap.
  const makeCsvFile = useCallback(() => {
    const csv = buildReceiptsCsv({
      trip,
      receipts,
      voucherUsed,
      perDiemUsed,
      fuelUsed,
      fileById,
      blocks,
      todosByBlock,
      filesByBlock,
    });
    return {
      blob: new Blob([csv], { type: 'text/csv' }),
      name: csvFilename(trip?.name),
      mimeType: 'text/csv',
    };
  }, [trip, receipts, voucherUsed, perDiemUsed, fuelUsed, fileById, blocks, todosByBlock, filesByBlock]);

  // Wipe everything and reload so ensureTrip() creates a fresh, empty trip.
  const onWipeAndReload = useCallback(async () => {
    await wipeAll();
    location.reload();
  }, []);

  // --- Import from CSV ------------------------------------------------------

  const pendingCount = (trip && trip.pendingFiles ? trip.pendingFiles.length : 0);

  // Is there anything in the current trip worth warning about before replacing?
  const tripHasData =
    blocks.length > 0 ||
    receipts.length > 0 ||
    files.length > 0 ||
    !!(trip &&
      ((trip.name && trip.name !== 'New trip' && trip.name !== 'Imported trip') ||
        trip.voucherCents ||
        trip.perDiemCents ||
        trip.fuelCents ||
        trip.startDate ||
        trip.endDate));

  // Rebuild the whole trip from a parsed CSV, then refresh and show the summary.
  const doImport = useCallback(
    async (parsed) => {
      await ensurePersist();
      await importTrip(parsed);
      const t = await getTrip();
      setTrip(t);
      await reload(t.id);
      setReattachResult(null);
      setImportSummary({
        receipts: parsed.receipts.length,
        blocks: parsed.blocks.length,
        files: t && t.pendingFiles ? t.pendingFiles.length : 0,
      });
      setImportSheet({ phase: 'done' });
    },
    [ensurePersist, reload]
  );

  // CSV picked: parse it, then either confirm a replace or import straight away.
  const onPickCsv = useCallback(
    async (file) => {
      if (!file) return;
      let parsed;
      try {
        const text = await file.text();
        parsed = parseTripCsv(text);
      } catch (err) {
        setImportSheet({ phase: 'error', message: err.message || 'Couldn’t read this file.' });
        return;
      }
      if (tripHasData) {
        setImportSheet({ phase: 'confirm', parsed });
      } else {
        await doImport(parsed);
      }
    },
    [tripHasData, doImport]
  );

  // Reattach picked files to the imported trip by exact name match.
  const onReattach = useCallback(
    async (fileList) => {
      const res = await attachFiles(fileList);
      const t = await getTrip();
      setTrip(t);
      await reload(t.id);
      setReattachResult(res);
    },
    [reload]
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
  const onSaveTripDates = (changes) =>
    act(() => updateTrip(trip.id, changes).then(() => setTrip((t) => ({ ...t, ...changes }))));

  const onAddBlock = (data) => act(async () => { await addBlock(trip.id, data); setAddingBlock(false); });
  const onUpdateBlock = (id, data) => act(() => updateBlock(id, data));
  const onDeleteBlock = (id) => act(() => deleteBlock(id));
  const onToggleBlockOpen = (id, open) => act(() => updateBlock(id, { open }));
  const onToggleDocsOpen = (id, docsOpen) => act(() => updateBlock(id, { docsOpen }));

  const onAddTodo = (blockId, text) => act(() => addTodo(blockId, text));
  const onToggleTodo = (id, done) => act(() => updateTodo(id, { done }));
  const onDeleteTodo = (id) => act(() => deleteTodo(id));

  const onAddDoc = (blockId, file, source) =>
    act(async () => {
      let fileRow;
      if (source === 'photo-processed') {
        // Already a finished JPEG from CropScreen — store as-is, don't re-encode.
        fileRow = {
          kind: 'photo',
          numbered: true,
          ext: 'jpg',
          mimeType: 'image/jpeg',
          size: file.size,
          blob: file,
        };
      } else if (source === 'photo') {
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
      // A newly added file opens the block's Documents section.
      await updateBlock(blockId, { docsOpen: true });
    });

  const onDeleteDoc = (id) => act(() => deleteFile(id));
  const onReplaceFileBlob = (id, blob) => act(() => replaceFileBlob(id, blob));
  const onUpdateFile = (id, changes) => act(() => updateFile(id, changes));

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
          onSaveTripDates={onSaveTripDates}
          needsUnlock={needsUnlock}
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
            {pendingCount > 0 && (
              <button
                type="button"
                className="reattach-line"
                onClick={() => reattachInputRef.current && reattachInputRef.current.click()}
              >
                {pendingCount} {pendingCount === 1 ? 'file' : 'files'} can be reattached
              </button>
            )}

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
                onToggleDocsOpen={onToggleDocsOpen}
                onUpdate={onUpdateBlock}
                onDelete={onDeleteBlock}
                onAddTodo={onAddTodo}
                onToggleTodo={onToggleTodo}
                onDeleteTodo={onDeleteTodo}
                onAddDoc={onAddDoc}
                onDeleteFile={onDeleteDoc}
                onBackupFiles={onBackupFiles}
                onReplaceFileBlob={onReplaceFileBlob}
                onUpdateFile={onUpdateFile}
              />
            ))}

            <ExportButton makeCsvFile={makeCsvFile} onSaved={() => setNeedsUnlock(true)} />

            <button
              type="button"
              className="new-trip-btn"
              onClick={() => setNewTripOpen(true)}
            >
              Start new trip
            </button>

            <button
              type="button"
              className="import-trip-btn"
              onClick={() => {
                ensurePersist();
                if (csvInputRef.current) csvInputRef.current.click();
              }}
            >
              Import trip from CSV
            </button>
          </>
        )}
      </main>

      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = '';
          onPickCsv(f);
        }}
      />
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
          onReplaceFileBlob={onReplaceFileBlob}
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

      {newTripOpen && (
        <NewTripSheet
          unsavedCount={unsavedCount}
          makeCsvFile={makeCsvFile}
          onWipe={onWipeAndReload}
          onClose={() => setNewTripOpen(false)}
        />
      )}

      {importSheet && (
        <ImportSheet
          phase={importSheet.phase}
          message={importSheet.message}
          summary={importSummary}
          pendingCount={pendingCount}
          reattachResult={reattachResult}
          onReplace={() => doImport(importSheet.parsed)}
          onReattach={onReattach}
          onClose={() => {
            setImportSheet(null);
            setReattachResult(null);
          }}
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
