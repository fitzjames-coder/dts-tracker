import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cropToJpeg, reencodeToJpeg } from '../lib/image.js';

const MIN = 60; // minimum crop size in screen px
const HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function computeFit(box, nat) {
  const scale = Math.min(box.cw / nat.nw, box.ch / nat.nh) || 1;
  const dispW = nat.nw * scale;
  const dispH = nat.nh * scale;
  return {
    scale,
    dispW,
    dispH,
    offX: (box.cw - dispW) / 2,
    offY: (box.ch - dispH) / 2,
  };
}

// New rect from the drag start, by mode, clamped to the image and MIN size.
function applyDrag(mode, start, dx, dy, fit) {
  const bx = fit.offX;
  const by = fit.offY;
  const bX = fit.offX + fit.dispW;
  const bY = fit.offY + fit.dispH;

  if (mode === 'move') {
    return {
      x: clamp(start.x + dx, bx, bX - start.w),
      y: clamp(start.y + dy, by, bY - start.h),
      w: start.w,
      h: start.h,
    };
  }

  let L = start.x;
  let T = start.y;
  let R = start.x + start.w;
  let B = start.y + start.h;
  if (mode.includes('w')) L = clamp(start.x + dx, bx, R - MIN);
  if (mode.includes('e')) R = clamp(start.x + start.w + dx, L + MIN, bX);
  if (mode.includes('n')) T = clamp(start.y + dy, by, B - MIN);
  if (mode.includes('s')) B = clamp(start.y + start.h + dy, T + MIN, bY);
  return { x: L, y: T, w: R - L, h: B - T };
}

export default function CropScreen({ source, onDone, onCancel }) {
  const [url, setUrl] = useState('');
  const [box, setBox] = useState(null); // { cw, ch } of the body
  const [nat, setNat] = useState(null); // { nw, nh } natural image size
  const [rect, setRect] = useState(null); // crop rect in body coords
  const [busy, setBusy] = useState(false);

  const bodyRef = useRef(null);
  const dragRef = useRef(null);
  const fitRef = useRef(null);

  // Object URL for the source; revoked on unmount.
  useEffect(() => {
    const u = URL.createObjectURL(source);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [source]);

  // Measure the body; re-measure on resize/rotation.
  useLayoutEffect(() => {
    function measure() {
      const el = bodyRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        setBox({ cw: r.width, ch: r.height });
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const fit = box && nat ? computeFit(box, nat) : null;
  fitRef.current = fit;

  // (Re)initialise the crop rect to the full image whenever the fit changes.
  useEffect(() => {
    if (fit) setRect({ x: fit.offX, y: fit.offY, w: fit.dispW, h: fit.dispH });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, nat]);

  // Escape cancels (no Escape on iPhone, but keeps parity with other overlays).
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const onMove = useCallback((e) => {
    const d = dragRef.current;
    const f = fitRef.current;
    if (!d || !f) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    setRect(applyDrag(d.mode, d.start, dx, dy, f));
  }, []);

  const onEnd = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
  }, [onMove]);

  function onDown(mode, e) {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, sx: e.clientX, sy: e.clientY, start: { ...rect } };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }

  useEffect(() => () => onEnd(), [onEnd]);

  function reset() {
    if (fit) setRect({ x: fit.offX, y: fit.offY, w: fit.dispW, h: fit.dispH });
  }

  async function useCrop() {
    if (busy || !rect || !fit) return;
    setBusy(true);
    const natRect = {
      x: (rect.x - fit.offX) / fit.scale,
      y: (rect.y - fit.offY) / fit.scale,
      w: rect.w / fit.scale,
      h: rect.h / fit.scale,
    };
    const blob = await cropToJpeg(source, natRect);
    onDone(blob);
  }

  async function skip() {
    if (busy) return;
    setBusy(true);
    const blob = await reencodeToJpeg(source);
    onDone(blob);
  }

  return (
    <div className="crop-screen" role="dialog" aria-modal="true" aria-label="Crop photo">
      <div className="crop-top">
        <span className="crop-title">Crop</span>
        <button type="button" className="crop-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="crop-body" ref={bodyRef}>
        {url && fit && (
          <img
            src={url}
            alt=""
            draggable={false}
            className="crop-img"
            onLoad={(e) => setNat({ nw: e.target.naturalWidth, nh: e.target.naturalHeight })}
            style={{ left: fit.offX, top: fit.offY, width: fit.dispW, height: fit.dispH }}
          />
        )}
        {/* Hidden loader so natural size is known even before fit renders the img. */}
        {url && !nat && (
          <img
            src={url}
            alt=""
            style={{ display: 'none' }}
            onLoad={(e) => setNat({ nw: e.target.naturalWidth, nh: e.target.naturalHeight })}
          />
        )}

        {rect && (
          <div
            className="crop-rect"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            onPointerDown={(e) => onDown('move', e)}
          >
            {HANDLES.map((m) => (
              <div
                key={m}
                className={'crop-handle crop-handle-' + m}
                onPointerDown={(e) => onDown(m, e)}
              >
                <span className="crop-knob" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="crop-foot">
        <button type="button" className="btn btn-ghost" onClick={skip} disabled={busy}>
          Skip
        </button>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>
          Reset
        </button>
        <button type="button" className="btn btn-primary crop-use" onClick={useCrop} disabled={busy}>
          {busy ? 'Working…' : 'Use crop'}
        </button>
      </div>
    </div>
  );
}
