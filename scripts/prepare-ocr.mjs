import { cp, mkdir } from 'node:fs/promises';

await mkdir('public/ocr', { recursive: true });

for (const language of ['eng', 'hin', 'asm']) {
  await cp(
    `node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`,
    `public/ocr/${language}.traineddata.gz`,
  );
}

await cp('node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/worker.min.js');
await cp('node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'public/ocr/tesseract-core-simd-lstm.wasm.js');
await cp('node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'public/ocr/tesseract-core-simd-lstm.wasm');
