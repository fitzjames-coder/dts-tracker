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
