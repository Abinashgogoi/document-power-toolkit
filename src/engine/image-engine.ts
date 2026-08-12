import type { CompressionOptions, ProcessingResult, QualityFloor } from '../types';
import { baseName } from '../lib/files';
import { verifyImage } from '../lib/verification';

const LIMITS: Record<QualityFloor, { minQuality: number; minScale: number }> = {
  high: { minQuality: 0.76, minScale: 0.82 },
  balanced: { minQuality: 0.52, minScale: 0.55 },
  aggressive: { minQuality: 0.3, minScale: 0.28 },
};

interface Candidate {
  blob: Blob;
  quality: number;
  scale: number;
}

export async function compressImage(
  file: File,
  options: CompressionOptions,
  onProgress?: (message: string, percent: number) => void,
): Promise<ProcessingResult> {
  if (!file.type.startsWith('image/')) throw new Error('Select an image file.');
  if (options.targetBytes < 5 * 1024) throw new Error('Target must be at least 5 KB.');
  const internalTarget = Math.floor(options.targetBytes * (1 - options.safetyMarginPercent / 100));
  if (file.size <= internalTarget) {
    return {
      blob: file,
      fileName: file.name,
      verification: await verifyImage(file, options.targetBytes),
      inputBytes: file.size,
      outputBytes: file.size,
      note: 'The source image was already within the requested limit.',
    };
  }

  onProgress?.('Decoding image locally…', 8);
  const bitmap = await createImageBitmap(file);
  const limits = LIMITS[options.qualityFloor];
  const outputType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  let scale = 1;
  let best: Candidate | undefined;
  let targetCandidate: Candidate | undefined;

  while (scale >= limits.minScale - 0.001 && !targetCandidate) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let low = limits.minQuality;
    let high = 0.94;
    for (let iteration = 0; iteration < 7; iteration += 1) {
      const quality = iteration === 0 ? high : (low + high) / 2;
      onProgress?.('Optimizing toward the size target…', 20 + iteration * 8);
      const blob = await toBlob(canvas, outputType, quality);
      const candidate = { blob, quality, scale };
      if (!best || blob.size < best.blob.size) best = candidate;
      if (blob.size <= internalTarget) {
        targetCandidate = candidate;
        low = quality;
      } else {
        high = quality;
      }
    }
    canvas.width = 1;
    canvas.height = 1;
    if (!targetCandidate) scale = Math.max(limits.minScale, scale * 0.78 - 0.01);
    if (scale === limits.minScale && best?.scale === limits.minScale) break;
  }
  bitmap.close();

  const chosen = targetCandidate ?? best;
  if (!chosen) throw new Error('Compression engine could not create an output.');
  onProgress?.('Verifying output…', 94);
  const extension = outputType === 'image/jpeg' ? 'jpg' : 'webp';
  const hitTarget = chosen.blob.size <= options.targetBytes;
  return {
    blob: chosen.blob,
    fileName: `${baseName(file.name)}-compressed.${extension}`,
    verification: await verifyImage(chosen.blob, options.targetBytes),
    inputBytes: file.size,
    outputBytes: chosen.blob.size,
    note: hitTarget
      ? `Target achieved at ${Math.round(chosen.scale * 100)}% dimensions and ${Math.round(chosen.quality * 100)}% quality.`
      : 'The target cannot be safely achieved at the selected quality floor. The smallest safe output is provided.',
  };
}

export async function resizeImage(
  file: File,
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp',
): Promise<ProcessingResult> {
  if (!file.type.startsWith('image/')) throw new Error('Select an image file.');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 12000 || height > 12000) {
    throw new Error('Width and height must be whole pixels between 1 and 12000.');
  }
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: format !== 'jpeg' });
  if (!context) throw new Error('Canvas rendering is unavailable.');
  if (format === 'jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const mime = `image/${format}`;
  const blob = await toBlob(canvas, mime, 0.92);
  canvas.width = 1;
  canvas.height = 1;
  return {
    blob,
    fileName: `${baseName(file.name)}-${width}x${height}.${format === 'jpeg' ? 'jpg' : format}`,
    verification: await verifyImage(blob),
    inputBytes: file.size,
    outputBytes: blob.size,
    note: `Output dimensions: ${width} × ${height} pixels.`,
  };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Unable to encode the image.'))),
      type,
      quality,
    );
  });
}
