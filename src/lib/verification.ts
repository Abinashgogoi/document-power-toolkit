import { PDFDocument } from 'pdf-lib';
import type { VerificationCheck, VerificationReport } from '../types';

export function report(checks: VerificationCheck[]): VerificationReport {
  return { passed: checks.every((check) => check.passed), checks };
}

export async function verifyPdf(
  blob: Blob,
  expectedPages: number,
  maximumBytes?: number,
): Promise<VerificationReport> {
  const checks: VerificationCheck[] = [
    { label: 'Output created', passed: blob.size > 0, detail: `${blob.size} bytes` },
    { label: 'PDF type', passed: blob.type === 'application/pdf', detail: blob.type || 'unknown' },
  ];

  try {
    const pdf = await PDFDocument.load(await blob.arrayBuffer(), {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    checks.push({
      label: 'PDF opens',
      passed: true,
      detail: 'Parser loaded the output successfully',
    });
    checks.push({
      label: 'Page count',
      passed: pdf.getPageCount() === expectedPages,
      detail: `Expected ${expectedPages}, found ${pdf.getPageCount()}`,
    });
  } catch (error) {
    checks.push({ label: 'PDF opens', passed: false, detail: errorMessage(error) });
    checks.push({ label: 'Page count', passed: false, detail: 'Could not inspect pages' });
  }

  if (maximumBytes !== undefined) {
    checks.push({
      label: 'Maximum size',
      passed: blob.size <= maximumBytes,
      detail: `${blob.size} / ${maximumBytes} bytes`,
    });
  }
  return report(checks);
}

export async function verifyImage(blob: Blob, maximumBytes?: number): Promise<VerificationReport> {
  const checks: VerificationCheck[] = [
    { label: 'Output created', passed: blob.size > 0, detail: `${blob.size} bytes` },
    { label: 'Image type', passed: blob.type.startsWith('image/'), detail: blob.type || 'unknown' },
  ];
  try {
    await createImageBitmap(blob);
    checks.push({ label: 'Image opens', passed: true, detail: 'Browser decoded the output' });
  } catch (error) {
    checks.push({ label: 'Image opens', passed: false, detail: errorMessage(error) });
  }
  if (maximumBytes !== undefined) {
    checks.push({
      label: 'Maximum size',
      passed: blob.size <= maximumBytes,
      detail: `${blob.size} / ${maximumBytes} bytes`,
    });
  }
  return report(checks);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown processing error';
}
