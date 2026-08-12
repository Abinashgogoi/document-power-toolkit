import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileImage, LoaderCircle } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { fileBytes, humanBytes } from '../lib/files';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export function FilePreviewGallery({ files }: { files: File[] }) {
  return (
    <section className="file-preview-section" aria-label="Uploaded file previews">
      <div className="preview-section-head">
        <div><span className="eyebrow">Visual check before processing</span><h2>Preview every uploaded file</h2></div>
        <span>{files.length} preview{files.length === 1 ? '' : 's'}</span>
      </div>
      <div className="file-preview-grid">
        {files.map((file, index) => (
          <article className="file-preview-card" key={`${file.name}-${file.lastModified}-${index}`} data-preview-file={file.name}>
            {isPdf(file) ? <PdfFilePreview file={file} /> : <ImageFilePreview file={file} />}
            <div className="preview-file-meta">
              <span className="preview-order">{index + 1}</span>
              <div><strong title={file.name}>{file.name}</strong><span>{humanBytes(file.size)}</span></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PdfFilePreview({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef<Awaited<ReturnType<typeof pdfjs.getDocument>['promise']> | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPageNumber(1);
    setPageCount(0);
    setError('');
    void (async () => {
      try {
        const document = await pdfjs.getDocument({ data: await fileBytes(file) }).promise;
        if (cancelled) return;
        documentRef.current = document;
        setPageCount(document.numPages);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to preview PDF.');
      }
    })();
    return () => {
      cancelled = true;
      documentRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    if (!pageCount || !documentRef.current) return;
    setLoading(true);
    void (async () => {
      try {
        const page = await documentRef.current!.getPage(pageNumber);
        const natural = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(1, 250 / natural.width, 280 / natural.height) });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas is unavailable.');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!cancelled) setLoading(false);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Unable to render preview.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pageCount, pageNumber]);

  return (
    <div className="compact-pdf-preview">
      <div className="compact-preview-stage">
        {loading && !error && <LoaderCircle className="spin preview-spinner" size={21} />}
        {error ? <span className="preview-error">Preview unavailable</span> : <canvas ref={canvasRef} aria-label={`${file.name} page ${pageNumber} preview`} />}
      </div>
      <div className="compact-page-controls">
        <button className="icon-button" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => value - 1)} aria-label={`Previous page of ${file.name}`}><ChevronLeft size={15} /></button>
        <span>Page {pageNumber} of {pageCount || '—'}</span>
        <button className="icon-button" disabled={!pageCount || pageNumber >= pageCount} onClick={() => setPageNumber((value) => value + 1)} aria-label={`Next page of ${file.name}`}><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

function ImageFilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return <div className="compact-image-preview">{url ? <img src={url} alt={`Preview of ${file.name}`} /> : <FileImage size={30} />}</div>;
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
