import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { fileBytes } from '../lib/files';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  file: File;
}

export function PdfViewer({ file }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPage(1);
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const document = await pdfjs.getDocument({ data: await fileBytes(file) }).promise;
        if (cancelled) return;
        setPageCount(document.numPages);
        const selectedPage = await document.getPage(page);
        const unscaled = selectedPage.getViewport({ scale: 1 });
        const scale = Math.min(1.35, 560 / unscaled.width);
        const viewport = selectedPage.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas is unavailable.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await selectedPage.render({ canvas, canvasContext: context, viewport }).promise;
        if (!cancelled) setLoading(false);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Unable to preview this PDF.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, page]);

  return (
    <section className="viewer" aria-label="PDF preview">
      <div className="viewer-head">
        <div>
          <span className="eyebrow">Local preview</span>
          <strong>{file.name}</strong>
        </div>
        <div className="page-controls">
          <button className="icon-button" onClick={() => setPage((value) => value - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft size={18} />
          </button>
          <span>{page} / {pageCount || '—'}</span>
          <button className="icon-button" onClick={() => setPage((value) => value + 1)} disabled={!pageCount || page >= pageCount} aria-label="Next page">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="canvas-wrap">
        {loading && <div className="viewer-state"><LoaderCircle className="spin" size={22} /> Rendering locally…</div>}
        {error && <div className="viewer-error">{error}</div>}
        <canvas ref={canvasRef} className={loading || error ? 'hidden' : ''} />
      </div>
    </section>
  );
}
