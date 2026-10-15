// Share files through the OS share sheet (iOS "Save to Files", etc.).
// No network of our own — the share sheet is the platform's.

/**
 * @param {Array<{blob: Blob, name: string, mimeType: string}>} fileRows
 * @returns {Promise<'done'|'cancelled'|'failed'|'unsupported'>}
 *   Only 'done' means the user completed the share (and files count as saved).
 *
 * Call this synchronously from a user gesture — do not await anything before
 * it, or iOS will drop the transient activation navigator.share needs.
 */
export async function shareFiles(fileRows) {
  if (!fileRows || !fileRows.length) return 'failed';

  let files;
  try {
    files = fileRows.map(
      (r) =>
        new File([r.blob], r.name || 'file', {
          type: r.mimeType || 'application/octet-stream',
        })
    );
  } catch {
    return 'failed';
  }

  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return 'unsupported';
  }
  try {
    if (!navigator.canShare({ files })) return 'unsupported';
  } catch {
    return 'unsupported';
  }

  try {
    await navigator.share({ files });
    return 'done';
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}
