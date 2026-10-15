// Share files through the OS share sheet (iOS "Save to Files", etc.).
// No network of our own — the share sheet is the platform's.

// Single-flight guard. On iOS/WebKit (especially the Home Screen standalone
// app) invoking navigator.share() again before the previous call has fully
// settled leaves the share controller stuck, and every later share then
// rejects instantly with AbortError until the page is reloaded. We serialise
// shares so a second tap can never overlap the first, and the guard is always
// cleared in finally.
let inFlight = null;

const nowMs = () => (typeof performance !== 'undefined' ? performance : Date).now();

// A genuine user cancel takes far longer than this; a sub-threshold AbortError
// is iOS's post-first-share block, not a cancel.
const BLOCK_THRESHOLD_MS = 300;

function classify(err, elapsedMs) {
  const errorName = (err && err.name) || 'ShareError';
  if (errorName === 'AbortError') {
    return { status: elapsedMs < BLOCK_THRESHOLD_MS ? 'blocked' : 'cancelled', errorName };
  }
  return { status: 'failed', errorName };
}

/**
 * @param {Array<{blob: Blob, name: string, mimeType: string}>} fileRows
 * @returns {Promise<{status: 'done'|'cancelled'|'blocked'|'failed'|'unsupported', errorName: string}>}
 *   Only 'done' means the user completed the share (files then count as saved).
 *   'blocked' is iOS rejecting instantly after a prior share (needs a reload).
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
    // Build each File from a synchronous copy of the bytes. WebKit can leave the
    // original IndexedDB-backed Blob unreadable after navigator.share, so we
    // never hand that original to the share sheet. slice() is sync, so the
    // tap's user activation is preserved.
    files = fileRows.map(
      (r) =>
        new File([r.blob.slice()], r.name || 'file', {
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
  const started = nowMs();
  let promise;
  try {
    promise = navigator.share({ files });
  } catch (err) {
    // Some WebKit builds throw synchronously instead of rejecting.
    return classify(err, nowMs() - started);
  }

  inFlight = promise;
  try {
    await promise;
    return { status: 'done', errorName: '' };
  } catch (err) {
    return classify(err, nowMs() - started);
  } finally {
    inFlight = null; // always clear, so the guard can never stick
  }
}
