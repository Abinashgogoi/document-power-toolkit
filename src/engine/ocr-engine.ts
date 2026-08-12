import * as pdfjs from 'pdfjs-dist';
import { OEM, createWorker } from 'tesseract.js';
import type { ProcessingResult, VerificationCheck } from '../types';
import { baseName, fileBytes } from '../lib/files';
import { report } from '../lib/verification';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export type OcrLanguage = 'eng' | 'hin' | 'asm';

export async function runOcr(
  file: File,
  language: OcrLanguage,
  onProgress?: (message: string, percent: number) => void,
): Promise<ProcessingResult> {
  onProgress?.('Loading local OCR engine…', 3);
  const worker = await createWorker(language, OEM.LSTM_ONLY, {
    langPath: '/ocr',
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/tesseract-core-simd-lstm.wasm.js',
    gzip: true,
    legacyCore: false,
    legacyLang: false,
    logger: (message) => {
      const progress = typeof message.progress === 'number' ? message.progress : 0;
      onProgress?.(`${humanStatus(message.status)}…`, 8 + progress * 82);
    },
  });

  const inputs: Blob[] = [];
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdf = await pdfjs.getDocument({ data: await fileBytes(file) }).promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress?.(`Rendering PDF page ${pageNumber} of ${pdf.numPages}…`, 5 + (pageNumber / pdf.numPages) * 10);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas rendering is unavailable.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      inputs.push(await canvasBlob(canvas));
      canvas.width = 1;
      canvas.height = 1;
    }
  } else if (file.type.startsWith('image/')) {
    inputs.push(file);
  } else {
    await worker.terminate();
    throw new Error('OCR supports PDF and image files.');
  }

  const pages: Array<{ page: number; text: string; confidence: number }> = [];
  try {
    for (let index = 0; index < inputs.length; index += 1) {
      onProgress?.(`Recognizing page ${index + 1} of ${inputs.length}…`, 16 + (index / inputs.length) * 74);
      const result = await worker.recognize(inputs[index]);
      pages.push({
        page: index + 1,
        text: result.data.text.trim(),
        confidence: Math.round(result.data.confidence * 10) / 10,
      });
    }
  } finally {
    await worker.terminate();
  }

  const text = pages.map((page) => `--- Page ${page.page} · confidence ${page.confidence}% ---\n${page.text}`).join('\n\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const textCharacters = pages.reduce((sum, page) => sum + page.text.length, 0);
  const checks: VerificationCheck[] = [
    { label: 'OCR pages processed', passed: pages.length === inputs.length, detail: `${pages.length} of ${inputs.length}` },
    { label: 'Recognized text', passed: textCharacters > 0, detail: `${textCharacters} characters` },
    { label: 'Output created', passed: blob.size > 0, detail: `${blob.size} bytes` },
  ];
  return {
    blob,
    fileName: `${baseName(file.name)}-ocr-${language}.txt`,
    verification: report(checks),
    inputBytes: file.size,
    outputBytes: blob.size,
    note: `OCR used the bundled ${language.toUpperCase()} model locally. Confidence is an engine estimate and should be reviewed for official documents.`,
  };
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to render OCR input.')), 'image/png'));
}

function humanStatus(status: string): string {
  return status.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}
