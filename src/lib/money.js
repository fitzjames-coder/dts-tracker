// Money is stored as integer cents everywhere. These helpers convert to and
// from the integer-cents representation and format it for display.

/**
 * Parse a user-entered amount ("12.40", "$1,234.56", "12") into integer cents.
 * Returns null for empty/blank input and for anything that is not a number.
 */
export function parseAmountToCents(input) {
  if (input == null) return null;
  const s = String(input).trim().replace(/[$,\s]/g, '');
  if (s === '') return null;
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Integer cents -> an editable plain string like "150.00" (or "" for null). */
export function centsToInput(cents) {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

/** Integer cents -> "$1,234.56" (always non-negative; sign handled elsewhere). */
export function formatCents(cents) {
  const v = Math.abs(cents || 0) / 100;
  return (
    '$' +
    v.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Integer cents -> "$12.40" or, when negative, "–$12.40" (en dash). */
export function formatSignedCents(cents) {
  const c = cents || 0;
  if (c < 0) return '–' + formatCents(c);
  return formatCents(c);
}
