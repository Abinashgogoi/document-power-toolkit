import JSZip from 'jszip';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import type { CompressionOptions, ProcessingResult, VerificationCheck } from '../types';
import { baseName, fileBytes } from '../lib/files';
import { report, verifyPdf } from '../lib/verification';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export async function pdfPageCount(file: File): Promise<number> {
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  return pdf.getPageCount();
}

export async function mergePdfs(files: File[]): Promise<ProcessingResult> {
  if (files.length < 2) throw new Error('Select at least two PDF files to merge.');
  const output = await PDFDocument.create();
  let expectedPages = 0;
  for (const file of files) {
    const source = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    expectedPages += source.getPageCount();
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }
  const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false });
  const blob = pdfBlob(bytes);
  return {
    blob,
    fileName: 'merged-document.pdf',
    verification: await verifyPdf(blob, expectedPages),
    inputBytes: totalSize(files),
    outputBytes: blob.size,
  };
}

export async function splitPdf(file: File): Promise<ProcessingResult> {
  const source = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const zip = new JSZip();
  let verifiedPageFiles = 0;
  for (let index = 0; index < source.getPageCount(); index += 1) {
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [index]);
    output.addPage(page);
    const pageBytes = await output.save();
    const reopened = await PDFDocument.load(pageBytes, { updateMetadata: false });
    if (reopened.getPageCount() === 1) verifiedPageFiles += 1;
    zip.file(`${baseName(file.name)}-page-${index + 1}.pdf`, pageBytes);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const checks: VerificationCheck[] = [
    { label: 'Archive created', passed: blob.size > 0, detail: `${blob.size} bytes` },
    {
      label: 'Page files open',
      passed: verifiedPageFiles === source.getPageCount(),
      detail: `Expected ${source.getPageCount()}, reopened ${verifiedPageFiles}`,
    },
  ];
  return {
    blob,
    fileName: `${baseName(file.name)}-split.zip`,
    verification: report(checks),
    inputBytes: file.size,
    outputBytes: blob.size,
  };
}

export async function rotatePdf(file: File, rotation: number): Promise<ProcessingResult> {
  if (![90, 180, 270].includes(rotation)) throw new Error('Rotation must be 90, 180, or 270 degrees.');
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  pdf.getPages().forEach((page) => {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + rotation) % 360));
  });
  const blob = pdfBlob(await pdf.save({ useObjectStreams: true }));
  return {
    blob,
    fileName: `${baseName(file.name)}-rotated.pdf`,
    verification: await verifyPdf(blob, pdf.getPageCount()),
    inputBytes: file.size,
    outputBytes: blob.size,
  };
}

export async function extractPdfPages(file: File, pageNumbers: number[]): Promise<ProcessingResult> {
  const source = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  if (!pageNumbers.length) throw new Error('Select at least one page.');
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, pageNumbers.map((page) => page - 1));
  pages.forEach((page) => output.addPage(page));
  const blob = pdfBlob(await output.save({ useObjectStreams: true }));
  return {
    blob,
    fileName: `${baseName(file.name)}-extracted.pdf`,
    verification: await verifyPdf(blob, pageNumbers.length),
    inputBytes: file.size,
    outputBytes: blob.size,
  };
}

export async function deletePdfPages(file: File, pageNumbers: number[]): Promise<ProcessingResult> {
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const selected = [...new Set(pageNumbers)].sort((a, b) => b - a);
  if (selected.length >= pdf.getPageCount()) throw new Error('At least one page must remain in the PDF.');
  selected.forEach((page) => pdf.removePage(page - 1));
  const blob = pdfBlob(await pdf.save({ useObjectStreams: true }));
  return pdfResult(file, blob, `${baseName(file.name)}-pages-removed.pdf`, pdf.getPageCount());
}

export async function reorderPdfPages(file: File, orderedPages: number[]): Promise<ProcessingResult> {
  const source = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const expected = source.getPageCount();
  if (orderedPages.length !== expected || new Set(orderedPages).size !== expected) {
    throw new Error(`Page order must contain every page exactly once (1 to ${expected}).`);
  }
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, orderedPages.map((page) => page - 1));
  copied.forEach((page) => output.addPage(page));
  const blob = pdfBlob(await output.save({ useObjectStreams: true }));
  return pdfResult(file, blob, `${baseName(file.name)}-reordered.pdf`, expected);
}

export async function duplicatePdfPages(file: File, pageNumbers: number[]): Promise<ProcessingResult> {
  const source = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const duplicates = new Set(pageNumbers);
  const order: number[] = [];
  for (let page = 1; page <= source.getPageCount(); page += 1) {
    order.push(page - 1);
    if (duplicates.has(page)) order.push(page - 1);
  }
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, order);
  copied.forEach((page) => output.addPage(page));
  const blob = pdfBlob(await output.save({ useObjectStreams: true }));
  return pdfResult(file, blob, `${baseName(file.name)}-duplicated-pages.pdf`, order.length);
}

export async function addBlankPages(
  file: File,
  count: number,
  pageSize: 'a4' | 'letter' | 'match',
): Promise<ProcessingResult> {
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('Blank-page count must be between 1 and 50.');
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const last = pdf.getPages().at(-1);
  const dimensions = pageSize === 'a4' ? [595.28, 841.89] : pageSize === 'letter' ? [612, 792] : last ? [last.getWidth(), last.getHeight()] : [595.28, 841.89];
  for (let index = 0; index < count; index += 1) pdf.addPage(dimensions as [number, number]);
  const blob = pdfBlob(await pdf.save({ useObjectStreams: true }));
  return pdfResult(file, blob, `${baseName(file.name)}-with-blank-pages.pdf`, pdf.getPageCount());
}

export async function addWatermark(file: File, text: string): Promise<ProcessingResult> {
  const normalized = text.trim();
  if (!normalized) throw new Error('Enter watermark text.');
  if (normalized.length > 120) throw new Error('Watermark text must be 120 characters or fewer.');
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.getPages().forEach((page) => {
    const size = Math.max(22, Math.min(54, page.getWidth() / Math.max(7, normalized.length * 0.55)));
    const width = font.widthOfTextAtSize(normalized, size);
    page.drawText(normalized, {
      x: (page.getWidth() - width * 0.72) / 2,
      y: page.getHeight() / 2,
      size,
      font,
      color: rgb(0.35, 0.4, 0.45),
      opacity: 0.18,
      rotate: degrees(-35),
    });
  });
  const blob = pdfBlob(await pdf.save({ useObjectStreams: true }));
  return pdfResult(file, blob, `${baseName(file.name)}-watermarked.pdf`, pdf.getPageCount());
}

export async function addPageNumbers(file: File, startAt: number): Promise<ProcessingResult> {
  if (!Number.isInteger(startAt) || startAt < 0 || startAt > 999999) throw new Error('Starting page number must be between 0 and 999999.');
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.getPages().forEach((page, index) => {
    const value = String(startAt + index);
    const size = 10;
    page.drawText(value, {
      x: (page.getWidth() - font.widthOfTextAtSize(value, size)) / 2,
      y: 18,
      size,
      font,
      color: rgb(0.25, 0.29, 0.34),
      opacity: 0.9,
    });
  });
  const blob = pdfBlob(await pdf.save({ useObjectStreams: true }));
  return pdfResult(file, blob, `${baseName(file.name)}-numbered.pdf`, pdf.getPageCount());
}

export async function cleanPdfMetadata(file: File): Promise<ProcessingResult> {
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  pdf.setTitle('');
  pdf.setAuthor('');
  pdf.setSubject('');
  pdf.setKeywords([]);
  pdf.setCreator('');
  pdf.setProducer('Document Power Toolkit');
  const blob = pdfBlob(await pdf.save({ useObjectStreams: true }));
  return {
    ...(await pdfResult(file, blob, `${baseName(file.name)}-metadata-cleaned.pdf`, pdf.getPageCount())),
    note: 'Standard document-info metadata was removed. Embedded file content and annotations were not altered.',
  };
}

export async function imagesToPdf(files: File[]): Promise<ProcessingResult> {
  if (!files.length) throw new Error('Select at least one image.');
  const pdf = await PDFDocument.create();
  for (const file of files) {
    const normalized = await normalizeImage(file);
    const bytes = await fileBytes(normalized);
    const embedded = normalized.type === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const { width, height } = embedded.scale(1);
    const maxSide = 842;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const page = pdf.addPage([width * scale, height * scale]);
    page.drawImage(embedded, { x: 0, y: 0, width: width * scale, height: height * scale });
  }
  const blob = pdfBlob(await pdf.save({ useObjectStreams: true }));
  return {
    blob,
    fileName: 'images.pdf',
    verification: await verifyPdf(blob, files.length),
    inputBytes: totalSize(files),
    outputBytes: blob.size,
  };
}

export async function pdfToImages(file: File): Promise<ProcessingResult> {
  const source = await pdfjs.getDocument({ data: await fileBytes(file) }).promise;
  const zip = new JSZip();
  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
    const page = await source.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = requiredContext(canvas);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const image = await canvasBlob(canvas, 'image/png');
    zip.file(`${baseName(file.name)}-page-${pageNumber}.png`, image);
    canvas.width = 1;
    canvas.height = 1;
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return {
    blob,
    fileName: `${baseName(file.name)}-images.zip`,
    verification: report([
      { label: 'Archive created', passed: blob.size > 0, detail: `${blob.size} bytes` },
      {
        label: 'Rendered pages',
        passed: Object.keys(zip.files).length === source.numPages,
        detail: `Expected ${source.numPages}, rendered ${Object.keys(zip.files).length}`,
      },
    ]),
    inputBytes: file.size,
    outputBytes: blob.size,
  };
}

interface RasterPage {
  canvas: HTMLCanvasElement;
  widthPoints: number;
  heightPoints: number;
}

interface CompressionCandidate {
  blob: Blob;
  scale: number;
  quality: number;
}

const QUALITY_LIMITS = {
  high: { minQuality: 0.72, minScale: 1.25 },
  balanced: { minQuality: 0.5, minScale: 0.9 },
  aggressive: { minQuality: 0.3, minScale: 0.58 },
} as const;

export async function compressPdf(
  file: File,
  options: CompressionOptions,
  onProgress?: (message: string, percent: number) => void,
): Promise<ProcessingResult> {
  validateCompressionOptions(options);
  const requestedMaximum = options.targetBytes;
  const internalTarget = Math.floor(requestedMaximum * (1 - options.safetyMarginPercent / 100));
  if (file.size <= internalTarget) {
    const blob = file.slice(0, file.size, 'application/pdf');
    const pages = await pdfPageCount(file);
    return {
      blob,
      fileName: `${baseName(file.name)}-within-target.pdf`,
      verification: await verifyPdf(blob, pages, requestedMaximum),
      inputBytes: file.size,
      outputBytes: blob.size,
      note: 'The source was already within the requested limit; no recompression was applied.',
    };
  }

  const sourceBytes = await fileBytes(file);
  const source = await pdfjs.getDocument({ data: sourceBytes }).promise;
  const limits = QUALITY_LIMITS[options.qualityFloor];
  let scale = 1.9;
  let best: CompressionCandidate | undefined;
  let targetCandidate: CompressionCandidate | undefined;

  while (scale >= limits.minScale - 0.001 && !targetCandidate) {
    onProgress?.(`Rendering ${source.numPages} page${source.numPages === 1 ? '' : 's'}…`, 12);
    const pages = await rasterizeDocument(source, scale, onProgress);
    let low: number = limits.minQuality;
    let high: number = 0.92;
    for (let iteration = 0; iteration < 6; iteration += 1) {
      const quality = iteration === 0 ? high : (low + high) / 2;
      onProgress?.('Optimizing toward the size target…', 55 + iteration * 5);
      const blob = await buildRasterPdf(pages, quality);
      const candidate = { blob, quality, scale };
      if (!best || candidate.blob.size < best.blob.size) best = candidate;
      if (blob.size <= internalTarget) {
        targetCandidate = candidate;
        low = quality;
      } else {
        high = quality;
      }
    }
    releasePages(pages);
    if (!targetCandidate) scale = Math.max(limits.minScale, scale * 0.78 - 0.01);
    if (scale === limits.minScale && best?.scale === limits.minScale) break;
  }

  const chosen = targetCandidate ?? best;
  if (!chosen) throw new Error('Compression engine could not create an output.');
  onProgress?.('Verifying output integrity…', 94);
  const verification = await verifyPdf(chosen.blob, source.numPages, requestedMaximum);
  const hitTarget = chosen.blob.size <= requestedMaximum;
  return {
    blob: chosen.blob,
    fileName: `${baseName(file.name)}-compressed.pdf`,
    verification,
    inputBytes: file.size,
    outputBytes: chosen.blob.size,
    note: hitTarget
      ? `Target achieved at ${Math.round(chosen.scale * 72)} DPI-equivalent and ${Math.round(chosen.quality * 100)}% JPEG quality.`
      : 'The requested target cannot be safely achieved at the selected quality floor. The smallest safe result is provided and marked as not verified.',
  };
}

async function rasterizeDocument(
  source: Awaited<ReturnType<typeof pdfjs.getDocument>>['promise'] extends Promise<infer T> ? T : never,
  scale: number,
  onProgress?: (message: string, percent: number) => void,
): Promise<RasterPage[]> {
  const pages: RasterPage[] = [];
  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
    const page = await source.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const natural = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = requiredContext(canvas);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push({ canvas, widthPoints: natural.width, heightPoints: natural.height });
    onProgress?.(`Rendered page ${pageNumber} of ${source.numPages}`, 12 + (pageNumber / source.numPages) * 38);
  }
  return pages;
}

async function buildRasterPdf(pages: RasterPage[], quality: number): Promise<Blob> {
  const pdf = await PDFDocument.create();
  for (const page of pages) {
    const imageBlob = await canvasBlob(page.canvas, 'image/jpeg', quality);
    const image = await pdf.embedJpg(await imageBlob.arrayBuffer());
    const targetPage = pdf.addPage([page.widthPoints, page.heightPoints]);
    targetPage.drawImage(image, { x: 0, y: 0, width: page.widthPoints, height: page.heightPoints });
  }
  return pdfBlob(await pdf.save({ useObjectStreams: true, addDefaultPage: false }));
}

async function normalizeImage(file: File): Promise<Blob> {
  if (file.type === 'image/jpeg' || file.type === 'image/png') return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  requiredContext(canvas).drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasBlob(canvas, 'image/png');
}

function releasePages(pages: RasterPage[]): void {
  pages.forEach(({ canvas }) => {
    canvas.width = 1;
    canvas.height = 1;
  });
}

function requiredContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas rendering is unavailable in this browser.');
  return context;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Unable to encode output image.'))),
      type,
      quality,
    );
  });
}

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

function totalSize(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}

async function pdfResult(file: File, blob: Blob, fileName: string, expectedPages: number): Promise<ProcessingResult> {
  return {
    blob,
    fileName,
    verification: await verifyPdf(blob, expectedPages),
    inputBytes: file.size,
    outputBytes: blob.size,
  };
}

function validateCompressionOptions(options: CompressionOptions): void {
  if (!Number.isFinite(options.targetBytes) || options.targetBytes < 10 * 1024) {
    throw new Error('Target must be at least 10 KB.');
  }
  if (options.safetyMarginPercent < 0 || options.safetyMarginPercent > 25) {
    throw new Error('Safety margin must be between 0% and 25%.');
  }
}
