import Dexie from 'dexie';
import { blockWord, uniqueName } from './lib/filenames.js';

// ---------------------------------------------------------------------------
// Dexie database "dts-tracker", version 1.
// Money is stored as integer cents. Budget "remaining" values are derived in
// the UI and never stored. Every id is a crypto.randomUUID().
// ---------------------------------------------------------------------------

export const db = new Dexie('dts-tracker');

db.version(1).stores({
  // Only index what we query/sort by; all other fields live on the object.
  trips: 'id, createdAt',
  blocks: 'id, tripId, order, createdAt',
  todos: 'id, blockId, order',
  receipts: 'id, tripId, date',
  files: 'id, tripId, blockId, receiptId, createdAt',
});

const uid = () => crypto.randomUUID();
const now = () => Date.now();

// --- Trip -----------------------------------------------------------------

/** Ensure exactly one trip exists; create it on first launch. Returns it. */
export async function ensureTrip() {
  const existing = await db.trips.orderBy('createdAt').first();
  if (existing) return existing;
  const trip = {
    id: uid(),
    name: 'New trip',
    voucherCents: 0,
    perDiemCents: 0,
    fuelCents: 0,
    createdAt: now(),
  };
  await db.trips.add(trip);
  return trip;
}

export async function getTrip() {
  return db.trips.orderBy('createdAt').first();
}

export async function updateTrip(id, changes) {
  await db.trips.update(id, changes);
}

// --- Blocks ---------------------------------------------------------------

/** Create a block at the top of the list (lowest order value). */
export async function addBlock(tripId, { title, lines }) {
  const min = await db.blocks.where('tripId').equals(tripId).toArray();
  const minOrder = min.reduce((m, b) => Math.min(m, b.order), 0);
  const block = {
    id: uid(),
    tripId,
    title: title || '',
    lines: Array.isArray(lines) ? lines : [],
    order: minOrder - 1,
    open: true,
    todoOpen: true,
    docsOpen: false,
    nextFileNo: 1,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.blocks.add(block);
  return block;
}

export async function updateBlock(id, changes) {
  await db.blocks.update(id, { ...changes, updatedAt: now() });
}

/**
 * Delete a block together with its to-dos and files (and the file blobs,
 * which live inside the file rows) — all in one transaction so nothing is
 * left orphaned in IndexedDB.
 */
export async function deleteBlock(id) {
  await db.transaction('rw', db.blocks, db.todos, db.files, async () => {
    await db.todos.where('blockId').equals(id).delete();
    await db.files.where('blockId').equals(id).delete();
    await db.blocks.delete(id);
  });
}

// --- To-dos ---------------------------------------------------------------

export async function addTodo(blockId, text) {
  const items = await db.todos.where('blockId').equals(blockId).toArray();
  const maxOrder = items.reduce((m, t) => Math.max(m, t.order), -1);
  const todo = {
    id: uid(),
    blockId,
    text,
    done: false,
    order: maxOrder + 1,
  };
  await db.todos.add(todo);
  return todo;
}

export async function updateTodo(id, changes) {
  await db.todos.update(id, changes);
}

export async function deleteTodo(id) {
  await db.todos.delete(id);
}

// --- Receipts -------------------------------------------------------------

/**
 * Create a receipt and its backing file row in one transaction.
 * @param tripId
 * @param fields { title, tag, amountCents, date }
 * @param fileRow a file record (without id/receiptId) or null
 */
export async function addReceipt(tripId, fields, fileRow) {
  const receiptId = uid();
  await db.transaction('rw', db.receipts, db.files, async () => {
    let fileId = null;
    if (fileRow) {
      // Receipt photos keep the date_tag_amount_title.jpg pattern; if that name
      // is taken, append _2, _3, … before .jpg so Files never asks to replace.
      const existing = await db.files.toArray();
      const names = new Set(existing.map((f) => f.name));
      const name = uniqueName(fileRow.name, names, '_');
      fileId = uid();
      await db.files.add({
        id: fileId,
        tripId,
        blockId: null,
        receiptId,
        kind: fileRow.kind,
        name,
        mimeType: fileRow.mimeType,
        size: fileRow.size,
        blob: fileRow.blob,
        createdAt: now(),
        syncState: 'local',
        savedAt: null,
        driveFileId: null,
      });
    }
    await db.receipts.add({
      id: receiptId,
      tripId,
      title: fields.title || '',
      tag: fields.tag || 'other',
      amountCents: fields.amountCents ?? null,
      date: fields.date,
      fileId,
    });
  });
  return receiptId;
}

export async function updateReceipt(id, changes) {
  await db.receipts.update(id, changes);
}

/** Delete a receipt and its backing file (and blob). */
export async function deleteReceipt(id) {
  await db.transaction('rw', db.receipts, db.files, async () => {
    const r = await db.receipts.get(id);
    if (r && r.fileId) await db.files.delete(r.fileId);
    // Belt and braces: remove any file still pointing at this receipt.
    await db.files.where('receiptId').equals(id).delete();
    await db.receipts.delete(id);
  });
}

// --- Files (documents) ----------------------------------------------------

/**
 * Attach a document to a block. Assigns a unique name:
 *  - numbered (photos/scans): <BlockWord>-<n>.<ext> using the block's
 *    nextFileNo counter, which only ever counts up (numbers never reused);
 *  - uploads: keep the original name, appending -2, -3, … if already taken.
 * Returns the stored file row.
 */
export async function addFile(tripId, blockId, fileRow) {
  return db.transaction('rw', db.files, db.blocks, async () => {
    const existing = await db.files.toArray();
    const names = new Set(existing.map((f) => f.name));

    let name;
    if (fileRow.numbered) {
      const block = blockId ? await db.blocks.get(blockId) : null;
      const word = blockWord(block?.title);
      const ext = fileRow.ext || (fileRow.kind === 'pdf' ? 'pdf' : 'jpg');
      let n = block && Number.isFinite(block.nextFileNo) ? block.nextFileNo : 1;
      // Skip any number already taken (e.g. a same-named word on another block)
      // so the clean <Word>-<n> format never collides with an existing file.
      while (names.has(`${word}-${n}.${ext}`)) n += 1;
      name = `${word}-${n}.${ext}`;
      if (block) await db.blocks.update(block.id, { nextFileNo: n + 1 });
    } else {
      name = uniqueName(fileRow.originalName || 'upload', names, '-');
    }

    const file = {
      id: uid(),
      tripId,
      blockId: blockId ?? null,
      receiptId: null,
      kind: fileRow.kind,
      name,
      mimeType: fileRow.mimeType,
      size: fileRow.size,
      blob: fileRow.blob,
      createdAt: now(),
      syncState: 'local',
      savedAt: null,
      driveFileId: null,
    };
    await db.files.add(file);
    return file;
  });
}

/** Delete a single document (file row and its blob). */
export async function deleteFile(id) {
  await db.files.delete(id);
}

/** Read one file row fresh from IndexedDB (used to recover a poisoned blob). */
export async function getFile(id) {
  return db.files.get(id);
}

/**
 * Replace a file's image with a cropped JPEG. Because the bytes changed, the
 * file is marked not-backed-up again (syncState 'local', savedAt null). If the
 * name doesn't already end in .jpg, switch the extension to .jpg and keep it
 * unique among the other files.
 */
export async function replaceFileBlob(id, blob) {
  return db.transaction('rw', db.files, async () => {
    const f = await db.files.get(id);
    if (!f) return;
    let name = f.name;
    if (!/\.jpg$/i.test(name)) {
      const base = name.replace(/\.[^.]+$/, '');
      const others = await db.files.toArray();
      const names = new Set(others.filter((x) => x.id !== id).map((x) => x.name));
      name = uniqueName(base + '.jpg', names, '-');
    }
    await db.files.update(id, {
      blob,
      size: blob.size,
      mimeType: 'image/jpeg',
      name,
      syncState: 'local',
      savedAt: null,
    });
  });
}

/**
 * Mark files as backed up ("saved") in one transaction, stamping savedAt.
 * @param {string[]} ids
 */
export async function markFilesSaved(ids) {
  if (!ids || !ids.length) return;
  const savedAt = now();
  await db.transaction('rw', db.files, async () => {
    for (const id of ids) {
      await db.files.update(id, { syncState: 'saved', savedAt });
    }
  });
}

// --- Bulk loaders ---------------------------------------------------------

export async function loadAll(tripId) {
  const [blocks, receipts, files] = await Promise.all([
    db.blocks.where('tripId').equals(tripId).sortBy('order'),
    db.receipts.where('tripId').equals(tripId).toArray(),
    db.files.where('tripId').equals(tripId).toArray(),
  ]);
  const blockIds = blocks.map((b) => b.id);
  let todos = [];
  if (blockIds.length) {
    todos = await db.todos.where('blockId').anyOf(blockIds).sortBy('order');
  }
  // Newest receipts first.
  receipts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { blocks, todos, receipts, files };
}
