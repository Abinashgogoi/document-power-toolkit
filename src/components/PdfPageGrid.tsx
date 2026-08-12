import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { fileBytes, parsePageSelection } from '../lib/files';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Props {
  file: File;
  selection?: string;
  onSelectionChange?: (value: string) => void;
  mode: 'preview' | 'select';
  selectionLabel?: string;
}

export function PdfPageGrid({ file, selection = '', onSelectionChange, mode, selectionLabel = 'selected' }: Props) {
  const [pages, setPages] = useState<Array<{ number: number; url: string }>>([]);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState('');
  const selected = useMemo(() => {
    if (!pageCount || !selection.trim()) return new Set<number>();
    try { return new Set(parsePageSelection(selection, pageCount)); } catch { return new Set<number>(); }
  }, [selection, pageCount]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setPages([]);
    setPageCount(0);
    setError('');
    void (async () => {
      try {
        const document = await pdfjs.getDocument({ data: await fileBytes(file) }).promise;
        if (cancelled) return;
        setPageCount(document.numPages);
        for (let number = 1; number <= document.numPages; number += 1) {
          const page = await document.getPage(number);
          const natural = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(0.5, 170 / natural.width) });
          const canvas = documentOwner().createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d', { alpha: false });
          if (!context) throw new Error('Canvas is unavailable.');
          context.fillStyle = '#fff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          const blob = await canvasBlob(canvas);
          const url = URL.createObjectURL(blob);
          urls.push(url);
          if (!cancelled) setPages((current) => [...current, { number, url }]);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to render page previews.');
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [file]);

  function toggle(number: number) {
    if (mode !== 'select' || !onSelectionChange) return;
    const next = new Set(selected);
    if (next.has(number)) next.delete(number); else next.add(number);
    onSelectionChange([...next].sort((a, b) => a - b).join(', '));
  }

  return (
    <section className="page-grid-section" aria-label={`Page previews for ${file.name}`}>
      <div className="preview-section-head"><div><span className="eyebrow">All pages</span><h2>{mode === 'select' ? 'Click page previews to select them' : 'Document page preview'}</h2></div><span>{pages.length} / {pageCount || '—'} rendered</span></div>
      {error && <div className="error-box">{error}</div>}
      <div className="pdf-page-grid">
        {pages.map((page) => {
          const active = selected.has(page.number);
          return <button type="button" className={`pdf-page-thumb ${active ? 'selected' : ''}`} key={page.number} onClick={() => toggle(page.number)} disabled={mode === 'preview'} aria-label={`Page ${page.number}${active ? ` ${selectionLabel}` : ''}`} aria-pressed={mode === 'select' ? active : undefined}><span className="page-image-wrap"><img src={page.url} alt={`Page ${page.number} preview`} /></span><strong>Page {page.number}</strong>{mode === 'select' && <small>{active ? selectionLabel : 'Click to select'}</small>}</button>;
        })}
        {!error && pages.length < pageCount && <div className="page-grid-loading"><LoaderCircle className="spin" size={20} /> Rendering page {pages.length + 1}</div>}
      </div>
    </section>
  );
}

function documentOwner() { return globalThis.document; }
function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to encode preview.')), 'image/webp', 0.76));
}
