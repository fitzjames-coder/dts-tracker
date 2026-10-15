// Share files through the OS share sheet (iOS "Save to Files", etc.).
// No network of our own — the share sheet is the platform's.

// Single-flight guard. On iOS/WebKit (especially the Home Screen standalone
// app) invoking navigator.share() again before the previous call has fully
// settled leaves the share controller stuck, and every later share then
// rejects with InvalidStateError ("an earlier share has not yet completed")
// until the page is reloaded. We serialise shares so a second tap can never
// overlap the first, and the guard is always cleared in finally.
let inFlight = null;

// DEBUG-SHARE: ring buffer of the last 5 share attempts for on-screen diags.
let shareSeq = 0; // DEBUG-SHARE
const shareLog = []; // DEBUG-SHARE
function recordShare(partial) {
  // DEBUG-SHARE
  shareSeq += 1;
  const rec = { seq: shareSeq, ...partial };
  shareLog.push(rec);
  if (shareLog.length > 5) shareLog.shift();
  return rec;
}
export function getShareLog() {
  // DEBUG-SHARE
  return shareLog.slice();
}

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
  if (!fileRows || !fileRows.length) {
    recordShare({ invoked: false, status: 'failed', errorName: 'NoFiles', ms: 0 }); // DEBUG-SHARE
    return { status: 'failed', errorName: 'NoFiles' };
  }

  // Never start a share while one is still settling (see note above).
  if (inFlight) {
    recordShare({ invoked: false, status: 'failed', errorName: 'ShareInProgress', ms: 0 }); // DEBUG-SHARE
    return { status: 'failed', errorName: 'ShareInProgress' };
  }

  let files;
  try {
    files = fileRows.map(
      (r) =>
        new File([r.blob], r.name || 'file', {
          type: r.mimeType || 'application/octet-stream',
        })
    );
  } catch (err) {
    const errorName = (err && err.name) || 'FileError';
    recordShare({ invoked: false, status: 'failed', errorName, ms: 0 }); // DEBUG-SHARE
    return { status: 'failed', errorName };
  }

  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    recordShare({ invoked: false, status: 'unsupported', errorName: '', ms: 0 }); // DEBUG-SHARE
    return { status: 'unsupported', errorName: '' };
  }
  try {
    if (!navigator.canShare({ files })) {
      recordShare({ invoked: false, status: 'unsupported', errorName: '', ms: 0 }); // DEBUG-SHARE
      return { status: 'unsupported', errorName: '' };
    }
  } catch {
    recordShare({ invoked: false, status: 'unsupported', errorName: '', ms: 0 }); // DEBUG-SHARE
    return { status: 'unsupported', errorName: '' };
  }

  // Invoke synchronously (nothing awaited above) so the tap's activation holds.
  const started = (typeof performance !== 'undefined' ? performance : Date).now(); // DEBUG-SHARE
  let promise;
  try {
    promise = navigator.share({ files });
  } catch (err) {
    // Some WebKit builds throw synchronously instead of rejecting.
    const ms = Math.round((typeof performance !== 'undefined' ? performance : Date).now() - started); // DEBUG-SHARE
    const status = err && err.name === 'AbortError' ? 'cancelled' : 'failed';
    const errorName = (err && err.name) || 'ShareError';
    recordShare({ invoked: true, status, errorName, ms }); // DEBUG-SHARE
    return { status, errorName };
  }

  inFlight = promise;
  try {
    await promise;
    const ms = Math.round((typeof performance !== 'undefined' ? performance : Date).now() - started); // DEBUG-SHARE
    recordShare({ invoked: true, status: 'done', errorName: '', ms }); // DEBUG-SHARE
    return { status: 'done', errorName: '' };
  } catch (err) {
    const ms = Math.round((typeof performance !== 'undefined' ? performance : Date).now() - started); // DEBUG-SHARE
    const status = err && err.name === 'AbortError' ? 'cancelled' : 'failed';
    const errorName = (err && err.name) || 'ShareError';
    recordShare({ invoked: true, status, errorName, ms }); // DEBUG-SHARE
    return { status, errorName };
  } finally {
    inFlight = null; // always clear, so the guard can never stick
  }
}
