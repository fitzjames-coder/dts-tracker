// Parse a CSV that THIS app exported (see lib/csv.js for the exact layout) back
// into the pieces needed to rebuild a trip. The export is UTF-8 with a BOM,
// CRLF line endings, every text field quoted with doubled "" quotes, and
// amounts written as plain 2-decimal numbers. We never try to understand a
// foreign CSV — anything that isn't this app's own export is rejected with a
// clear message.

const IMPORT_ERROR =
  'This file doesn’t look like a DTS Tracker export. Export a trip from this app, then import that CSV.';

/**
 * Split raw CSV text into an array of rows, each an array of cell strings.
 * Handles BOM, CRLF/LF, quoted fields and doubled "" quotes (including commas
 * and newlines inside quotes).
 */
function parseCsv(text) {
  let s = String(text || '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // strip BOM

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = s.length;

  while (i < n) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += c;
        i += 1;
      }
    } else if (c === '"') {
      inQuotes = true;
      i += 1;
    } else if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
    } else if (c === '\r') {
      // swallow a following \n (CRLF)
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += s[i + 1] === '\n' ? 2 : 1;
    } else if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
    } else {
      field += c;
      i += 1;
    }
  }
  // Flush the last field/row if the text didn't end on a newline.
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Plain money string ("123.45") -> integer cents. Blank -> null. */
function moneyToCents(text) {
  const t = String(text == null ? '' : text).trim();
  if (t === '') return null;
  const n = Number(t.replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

const TAG_FROM_LABEL = { Food: 'food', Fuel: 'fuel', Other: 'other' };

function cell(row, i) {
  return row && row[i] != null ? row[i] : '';
}

function isBlankRow(row) {
  return !row || row.every((c) => String(c).trim() === '');
}

/**
 * Parse an exported trip CSV.
 * @param {string} text raw file text
 * @returns {{
 *   trip: {name:string,startDate:string|null,endDate:string|null,
 *          voucherCents:number,perDiemCents:number,fuelCents:number},
 *   receipts: Array<{date:string,title:string,tag:string,
 *          amountCents:number|null,location:string,photoFile:string}>,
 *   blocks: Array<{title:string,lines:string[],
 *          todos:Array<{text:string,done:boolean}>,
 *          files:Array<{name:string,date:string,location:string}>}>,
 * }}
 * @throws {Error} with a user-facing message when the file isn't this format.
 */
export function parseTripCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length || cell(rows[0], 0).trim() !== 'DTS Tracker export') {
    throw new Error(IMPORT_ERROR);
  }

  const trip = {
    name: '',
    startDate: null,
    endDate: null,
    voucherCents: 0,
    perDiemCents: 0,
    fuelCents: 0,
  };
  const receipts = [];
  const blocks = [];

  let i = 1;

  // --- Trip header (Trip / From / To / Exported), until the Budget table. ---
  for (; i < rows.length; i += 1) {
    const key = cell(rows[i], 0).trim();
    if (key === 'Budget') break;
    if (key === 'Trip') trip.name = cell(rows[i], 1);
    else if (key === 'From') trip.startDate = cell(rows[i], 1) || null;
    else if (key === 'To') trip.endDate = cell(rows[i], 1) || null;
  }

  // --- Budget totals: the Total column (index 1) as cents. Used/Remaining ignored. ---
  for (; i < rows.length; i += 1) {
    const key = cell(rows[i], 0).trim();
    if (key === 'Voucher') trip.voucherCents = moneyToCents(cell(rows[i], 1)) || 0;
    // Accept the current "M&IE" label and the old "Per diem" one (older exports).
    else if (key === 'M&IE' || key === 'Per diem')
      trip.perDiemCents = moneyToCents(cell(rows[i], 1)) || 0;
    else if (key === 'Fuel') trip.fuelCents = moneyToCents(cell(rows[i], 1)) || 0;
    else if (key === 'Date' && cell(rows[i], 1).trim() === 'Title') break; // receipts header
    else if (key === 'Blocks') break;
  }

  // --- Receipts: header row was `Date,Title,Tag,Amount,...`. ---
  if (cell(rows[i], 0).trim() === 'Date' && cell(rows[i], 1).trim() === 'Title') {
    i += 1; // skip header
    for (; i < rows.length; i += 1) {
      const row = rows[i];
      if (isBlankRow(row)) break;
      const first = cell(row, 0).trim();
      if (first === 'Receipts total' || first === 'Blocks') break;
      const title = cell(row, 1);
      receipts.push({
        date: cell(row, 0),
        title: title === 'Untitled receipt' ? '' : title,
        tag: TAG_FROM_LABEL[cell(row, 2).trim()] || 'other',
        amountCents: moneyToCents(cell(row, 3)),
        location: cell(row, 5),
        photoFile: cell(row, 6),
      });
    }
  }

  // --- Blocks: find the `Blocks` marker, then its `Block,Type,...` header. ---
  for (; i < rows.length; i += 1) {
    if (cell(rows[i], 0).trim() === 'Blocks') {
      i += 1;
      break;
    }
  }
  if (cell(rows[i], 0).trim() === 'Block' && cell(rows[i], 1).trim() === 'Type') {
    i += 1; // skip header
    let current = null;
    const pushCurrent = () => {
      if (current) blocks.push(current);
      current = null;
    };
    const newBlock = (title) => ({ title, lines: [], todos: [], files: [] });

    for (; i < rows.length; i += 1) {
      const row = rows[i];
      if (isBlankRow(row)) continue;
      const title = cell(row, 0);
      const type = cell(row, 1).trim();

      if (type === '(empty)') {
        // An empty block is complete on its own row.
        pushCurrent();
        blocks.push(newBlock(title));
        continue;
      }
      // Group consecutive rows of the same title into one block (CSV order).
      if (!current || current.title !== title) {
        pushCurrent();
        current = newBlock(title);
      }
      if (type === 'Line') {
        current.lines.push(cell(row, 2));
      } else if (type === 'To do') {
        current.todos.push({ text: cell(row, 2), done: cell(row, 3).trim() === 'Done' });
      } else if (type === 'File') {
        current.files.push({
          name: cell(row, 2),
          date: cell(row, 4),
          location: cell(row, 5),
        });
      }
    }
    pushCurrent();
  }

  if (!trip.name) trip.name = 'Imported trip';
  return { trip, receipts, blocks };
}
