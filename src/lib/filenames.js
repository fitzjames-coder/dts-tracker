// Builds the future Google Drive filename for a receipt. Drive upload itself
// lands in a later PR; here the name is only shown to the user ("Saves as …").
//
// Format: YYYY-MM-DD_tag_amount_title-slug.jpg
// The amount and title parts are omitted when empty.

/** lower-case, spaces/punctuation collapsed to single dashes, trimmed. */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * @param {{date?: string, tag?: string, amountCents?: number|null, title?: string}} r
 * @returns {string} filename ending in .jpg
 */
export function receiptFilename({ date, tag, amountCents, title } = {}) {
  const parts = [];
  parts.push(date || 'undated');
  parts.push(tag || 'other');

  if (amountCents != null) parts.push((amountCents / 100).toFixed(2));

  const slug = slugify(title);
  if (slug) parts.push(slug);

  return parts.join('_') + '.jpg';
}

/**
 * The first word of a block title, letters and digits only, original case
 * kept ("Flights out" -> "Flights"). Falls back to "Block".
 */
export function blockWord(title) {
  const first = String(title || '').trim().split(/\s+/)[0] || '';
  const cleaned = first.replace(/[^A-Za-z0-9]/g, '');
  return cleaned || 'Block';
}

/** Split a filename into [base, ext] where ext includes the leading dot. */
function splitExt(name) {
  const i = name.lastIndexOf('.');
  if (i <= 0) return [name, ''];
  return [name.slice(0, i), name.slice(i)];
}

/**
 * Return `name` if it is not already in `existing`; otherwise append
 * `<sep>2`, `<sep>3`, … before the extension until it is unique.
 * @param {string} name
 * @param {Set<string>} existing
 * @param {string} sep separator before the number ("-" uploads, "_" receipts)
 */
export function uniqueName(name, existing, sep = '-') {
  if (!existing || !existing.has(name)) return name;
  const [base, ext] = splitExt(name);
  let i = 2;
  let candidate = `${base}${sep}${i}${ext}`;
  while (existing.has(candidate)) {
    i += 1;
    candidate = `${base}${sep}${i}${ext}`;
  }
  return candidate;
}
