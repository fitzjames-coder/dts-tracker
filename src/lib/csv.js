import { slugify } from './filenames.js';

// Build the CSV export of a trip's numbers. UTF-8 with a BOM so Excel opens
// it cleanly; comma separated; every text field quoted; amounts are plain
// numbers with 2 decimals derived from the integer cents in the db.

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
const COUNTS_AGAINST = {
  food: 'Per diem + Voucher',
  fuel: 'Fuel + Voucher',
  other: 'Voucher only',
};

/**
 * @param {{
 *   trip: {name: string, voucherCents: number, perDiemCents: number, fuelCents: number},
 *   receipts: Array<object>,
 *   voucherUsed: number, perDiemUsed: number, fuelUsed: number,
 *   fileById: Record<string, {syncState?: string}>,
 * }} data
 * @returns {string} CSV text (with BOM)
 */
export function buildReceiptsCsv({
  trip,
  receipts,
  voucherUsed,
  perDiemUsed,
  fuelUsed,
  fileById = {},
}) {
  const rows = [];

  rows.push([q('DTS Tracker export')]);
  rows.push([q('Trip'), q(trip?.name || '')]);
  rows.push([q('Exported'), q(nowStamp())]);
  rows.push([]);

  rows.push([q('Budget'), q('Total'), q('Used'), q('Remaining')]);
  rows.push([
    q('Voucher'),
    money(trip?.voucherCents),
    money(voucherUsed),
    money((trip?.voucherCents || 0) - (voucherUsed || 0)),
  ]);
  rows.push([
    q('Per diem'),
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

  rows.push([
    q('Date'),
    q('Title'),
    q('Tag'),
    q('Amount'),
    q('Counts against'),
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
      q(COUNTS_AGAINST[r.tag] || 'Voucher only'),
      q(backedUp),
    ]);
  }

  rows.push([]);
  rows.push([q('Receipts total'), money(total)]);

  return BOM + rows.map((cells) => cells.join(',')).join(EOL) + EOL;
}

/** DTS_<trip-name-slug>_<YYYY-MM-DD_HHMM>.csv */
export function csvFilename(tripName) {
  const slug = slugify(tripName) || 'trip';
  return `DTS_${slug}_${fileStamp()}.csv`;
}
