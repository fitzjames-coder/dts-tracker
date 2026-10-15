import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Vite emits the worker as a same-origin asset and hands back its URL.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Cap canvas pixels so iOS never hits its per-canvas dimension limit.
const MAX_PX = 4096;

/**
 * Warm the service-worker cache with the worker file so PDFs render offline
 * even if one was never opened while online. Errors are swallowed.
 */
export function warm() {
  try {
    return fetch(workerUrl).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

/**
 * Render every page of a PDF blob, each to its own <canvas>, in order.
 * @param {Blob} blob
 * @param {() => void} onError called if pdf.js fails fatally.
 */
export default function PdfPages({ blob, onError }) {
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef(null);
  const canvasRefs = useRef([]);
  const docRef = useRef(null);

  // Load the document, then render pages one after another.
  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;
    let doc = null;
    canvasRefs.current = [];

    async function run() {
      try {
        const data = await blob.arrayBuffer();
        if (cancelled) return;

        loadingTask = pdfjsLib.getDocument({ data });
        doc = await loadingTask.promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);

        const dpr = Math.min(window.devicePixelRatio || 1, 3);

        // Render each page in order; the first paints without waiting on the rest.
        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelled) return;
          const page = await doc.getPage(n);
          if (cancelled) return;

          // A canvas for this page may not have mounted yet; wait a frame.
          let canvas = canvasRefs.current[n - 1];
          if (!canvas) {
            await new Promise((r) => requestAnimationFrame(r));
            canvas = canvasRefs.current[n - 1];
          }
          if (cancelled || !canvas) return;

          const cssWidth =
            (containerRef.current && containerRef.current.clientWidth) || 300;
          const base = page.getViewport({ scale: 1 });
          let scale = (cssWidth * dpr) / base.width;
          const probe = page.getViewport({ scale });
          if (probe.width > MAX_PX || probe.height > MAX_PX) {
            scale *= Math.min(MAX_PX / probe.width, MAX_PX / probe.height);
          }
          const viewport = page.getViewport({ scale });

          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (page.cleanup) page.cleanup();
        }
      } catch (err) {
        if (cancelled) return;
        if (onError) onError(err);
      }
    }

    run();

    return () => {
      cancelled = true;
      // Destroy the document and loading task so no work outlives the view.
      if (doc) {
        try {
          doc.destroy();
        } catch {
          /* ignore */
        }
      }
      if (loadingTask && loadingTask.destroy) {
        try {
          loadingTask.destroy();
        } catch {
          /* ignore */
        }
      }
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  return (
    <div className="pdf-pages" ref={containerRef}>
      {Array.from({ length: numPages }).map((_, i) => (
        <div className="pdf-page" key={i}>
          <canvas
            className="pdf-page-canvas"
            ref={(el) => {
              canvasRefs.current[i] = el;
            }}
          />
          <div className="pdf-page-label">
            Page {i + 1} of {numPages}
          </div>
        </div>
      ))}
    </div>
  );
}
