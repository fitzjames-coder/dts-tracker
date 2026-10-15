// Share files through the OS share sheet (iOS "Save to Files", etc.).
// No network of our own — the share sheet is the platform's.

// Single-flight guard. On iOS/WebKit (especially the Home Screen standalone
// app) invoking navigator.share() again before the previous call has fully
// settled leaves the share controller stuck, and every later share then
// rejects with InvalidStateError ("an earlier share has not yet completed")
// until the page is reloaded. We serialise shares so a second tap can never
// overlap the first, and the guard is always cleared in finally.
let inFlight = null;

/**
 * @param {Array<{blob: Blob, name: string, mimeType: string}>} fileRows
 * @returns {Promise<{status: 'done'|'cancelled'|'failed'|'unsupported', errorName: string}>}
 *   Only 'done' means the user completed the share (files then count as saved).
 *   Errors are never swallowed: errorName carries the DOMException name.
 *
 * Call this synchronously from a user gesture — do not await anything before
 * it, or iOS drops the transient activation navigator.share needs.
 */
export async function shareFiles(fileRows) {
  if (!fileRows || !fileRows.length) return { status: 'failed', errorName: 'NoFiles' };

  // Never start a share while one is still settling (see note above).
  if (inFlight) return { status: 'failed', errorName: 'ShareInProgress' };

  let files;
  try {
    files = fileRows.map(
      (r) =>
        new File([r.blob], r.name || 'file', {
          type: r.mimeType || 'application/octet-stream',
        })
    );
  } catch (err) {
    return { status: 'failed', errorName: (err && err.name) || 'FileError' };
  }

  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return { status: 'unsupported', errorName: '' };
  }
  try {
    if (!navigator.canShare({ files })) return { status: 'unsupported', errorName: '' };
  } catch {
    return { status: 'unsupported', errorName: '' };
  }

  // Invoke synchronously (nothing awaited above) so the tap's activation holds.
  let promise;
  try {
    promise = navigator.share({ files });
  } catch (err) {
    // Some WebKit builds throw synchronously instead of rejecting.
    if (err && err.name === 'AbortError') return { status: 'cancelled', errorName: 'AbortError' };
    return { status: 'failed', errorName: (err && err.name) || 'ShareError' };
  }

  inFlight = promise;
  try {
    await promise;
    return { status: 'done', errorName: '' };
  } catch (err) {
    if (err && err.name === 'AbortError') return { status: 'cancelled', errorName: 'AbortError' };
    return { status: 'failed', errorName: (err && err.name) || 'ShareError' };
  } finally {
    inFlight = null; // always clear, so the guard can never stick
  }
}
