// Image handling. Photos captured by the camera are re-encoded to JPEG at a
// sane size; PDFs and plain uploads are kept byte-for-byte (handled by callers).

const MAX_EDGE = 2400;
const QUALITY = 0.85;

function loadBitmap(file) {
  // Prefer createImageBitmap (fast, handles orientation on modern browsers).
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => loadViaImg(file));
  }
  return loadViaImg(file);
}

function loadViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
    img._url = url;
  });
}

/**
 * Re-encode a captured photo to JPEG, longest edge <= 2400px, quality 0.85.
 * Falls back to the original blob if the canvas pipeline is unavailable.
 * @param {File|Blob} file
 * @returns {Promise<Blob>}
 */
export async function reencodeToJpeg(file) {
  try {
    const bmp = await loadBitmap(file);
    const w0 = bmp.width;
    const h0 = bmp.height;
    if (!w0 || !h0) throw new Error('empty image');

    const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);

    if (bmp.close) bmp.close();
    if (bmp._url) URL.revokeObjectURL(bmp._url);

    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', QUALITY)
    );
    if (!blob) throw new Error('toBlob failed');
    return blob;
  } catch {
    // Last resort: store the original bytes so nothing is lost.
    return file;
  }
}
