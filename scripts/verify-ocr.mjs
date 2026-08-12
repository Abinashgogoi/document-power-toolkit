import path from 'node:path';
import { OEM, createWorker } from 'tesseract.js';

const worker = await createWorker('eng', OEM.LSTM_ONLY, {
  langPath: path.resolve('public/ocr'),
  cacheMethod: 'none',
  gzip: true,
  legacyCore: false,
  legacyLang: false,
});

try {
  const result = await worker.recognize(path.resolve('tests/fixtures/ocr-hello.png'));
  const normalized = result.data.text.replace(/\s+/g, ' ').trim().toUpperCase();
  if (!normalized.includes('HELLO DOCUMENT')) {
    throw new Error(`OCR acceptance fixture failed. Recognized: ${JSON.stringify(normalized)}`);
  }
  process.stdout.write(`OCR acceptance passed: ${normalized} (${result.data.confidence.toFixed(1)}% confidence)\n`);
} finally {
  await worker.terminate();
}
