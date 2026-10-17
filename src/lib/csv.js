import { slugify } from './filenames.js';
import { fileDate } from '../db.js';

// Build the CSV export of a trip. UTF-8 with a BOM so Excel opens it cleanly;
// comma separated; every text field quoted; amounts are plain numbers with 2
// decimals derived from the integer cents in the db. Images can't go in a CSV,
// so file names are listed instead.

const BOM = '﻿';
const EOL = '\r\n';

/** Quote a text cell, doubling any embedded quotes. */
function q(text) {
  return '"' + String(text == null ? '' : text).replace(/"/g, '""') + '"';
}

/** Integer cents -> plain number string with 2 decimals (no $). */
function money(cents) {
  return ((cents || 0) / 100).toFixed(2);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Local "YYYY-MM-DD HH:MM". */
function nowStamp() {
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Local "YYYY-MM-DD_HHMM" for filenames. */
function fileStamp() {
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

const TAG_LABEL = { food: 'Food', fuel: 'Fuel', other: 'Other' };

/** The budget tiles a receipt reduces, e.g. "GTC; Voucher; M&IE". */
function countsAgainst(r) {
  const parts = [];
  if (r.onGtc !== false) parts.push('GTC');
  if (r.onVoucher !== false) parts.push('Voucher');
  if (r.tag === 'food') parts.push('M&IE');
  else if (r.tag === 'fuel') parts.push('Fuel');
  return parts.join('; ');
}

/**
 * @param {{
 *   trip: object,
 *   receipts: Array<object>,
 *   voucherUsed: number, perDiemUsed: number, fuelUsed: number,
 *   fileById: Record<string, object>,
 *   blocks: Array<object>,                 in on-screen order
 *   todosByBlock: Record<string, Array>,   to-dos per block, in order
 *   filesByBlock: Record<string, Array>,   files per block, in order
 * }} data
 * @returns {string} CSV text (with BOM)
 */
export function buildReceiptsCsv({
  trip,
  receipts,
  gtcUsed,
  voucherUsed,
  perDiemUsed,
  fuelUsed,
  fileById = {},
  blocks = [],
  todosByBlock = {},
  filesByBlock = {},
}) {
  const rows = [];

  rows.push([q('DTS Tracker export')]);
  rows.push([q('Trip'), q(trip?.name || '')]);
  rows.push([q('From'), q(trip?.startDate || '')]);
  rows.push([q('To'), q(trip?.endDate || '')]);
  rows.push([q('Exported'), q(nowStamp())]);
  rows.push([]);

  rows.push([q('Budget'), q('Total'), q('Used'), q('Remaining')]);
  rows.push([
    q('GTC'),
    money(trip?.gtcLimitCents),
    money(gtcUsed),
    money((trip?.gtcLimitCents || 0) - (gtcUsed || 0)),
  ]);
  rows.push([
    q('Voucher'),
    money(trip?.voucherCents),
    money(voucherUsed),
    money((trip?.voucherCents || 0) - (voucherUsed || 0)),
  ]);
  rows.push([
    q('M&IE'),
    money(trip?.perDiemCents),
    money(perDiemUsed),
    money((trip?.perDiemCents || 0) - (perDiemUsed || 0)),
  ]);
  rows.push([
    q('Fuel'),
    money(trip?.fuelCents),
    money(fuelUsed),
    money((trip?.fuelCents || 0) - (fuelUsed || 0)),
  ]);
  rows.push([]);

  // --- Receipts ---
  rows.push([
    q('Date'),
    q('Title'),
    q('Tag'),
    q('Amount'),
    q('GTC'),
    q('Voucher'),
    q('Counts against'),
    q('Location'),
    q('Photo file'),
    q('Backed up'),
  ]);

  // Oldest first.
  const ordered = [...(receipts || [])].sort((a, b) =>
    (a.date || '') < (b.date || '') ? -1 : (a.date || '') > (b.date || '') ? 1 : 0
  );

  let total = 0;
  for (const r of ordered) {
    const hasAmount = r.amountCents != null;
    if (hasAmount) total += r.amountCents;
    const file = r.fileId ? fileById[r.fileId] : null;
    const backedUp = file && file.syncState === 'saved' ? 'Yes' : 'No';
    rows.push([
      q(r.date || ''),
      q(r.title ? r.title : 'Untitled receipt'),
      q(TAG_LABEL[r.tag] || 'Other'),
      hasAmount ? money(r.amountCents) : '', // blank cell when empty
      q(r.onGtc !== false ? 'Yes' : 'No'),
      q(r.onVoucher !== false ? 'Yes' : 'No'),
      q(countsAgainst(r)),
      q(r.location || ''),
      q(file ? file.name : ''),
      q(backedUp),
    ]);
  }

  rows.push([]);
  rows.push([q('Receipts total'), money(total)]);
  rows.push([]);

  // --- Blocks ---
  rows.push([q('Blocks')]);
  rows.push([q('Block'), q('Type'), q('Item'), q('Status'), q('Date'), q('Location')]);

  for (const b of blocks) {
    const title = b.title || '';
    const lines = b.lines || [];
    const todos = todosByBlock[b.id] || [];
    const bfiles = filesByBlock[b.id] || [];

    if (!lines.length && !todos.length && !bfiles.length) {
      rows.push([q(title), q('(empty)'), '', '', '', '']);
      continue;
    }
    for (const line of lines) {
      rows.push([q(title), q('Line'), q(line), '', '', '']);
    }
    for (const t of todos) {
      rows.push([q(title), q('To do'), q(t.text), q(t.done ? 'Done' : 'Open'), '', '']);
    }
    for (const f of bfiles) {
      rows.push([
        q(title),
        q('File'),
        q(f.name),
        q(f.syncState === 'saved' ? 'Backed up' : 'Not backed up'),
        q(fileDate(f)),
        q(f.location || ''),
      ]);
    }
  }

  return BOM + rows.map((cells) => cells.join(',')).join(EOL) + EOL;
}

/** DTS_<trip-name-slug>_<YYYY-MM-DD_HHMM>.csv */
export function csvFilename(tripName) {
  const slug = slugify(tripName) || 'trip';
  return `DTS_${slug}_${fileStamp()}.csv`;
}
