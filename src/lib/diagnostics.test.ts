import { describe, expect, it } from 'vitest';
import { classifyProcessingError } from './diagnostics';

function fakeFile(type: string, size = 10): File {
  return new File(['x'.repeat(size)], 'private-name-is-not-sent.pdf', { type });
}

describe('classifyProcessingError', () => {
  it('classifies OCR worker failures without including file names', () => {
    const result = classifyProcessingError({
      tool: 'ocr',
      error: new Error('Tesseract worker WASM failed to load'),
      files: [fakeFile('application/pdf')],
      online: true,
    });
    expect(result.code).toBe('OCR_WORKER_LOAD_FAILED');
    expect(result.context.inputTypes).toEqual(['application/pdf']);
    expect(JSON.stringify(result.context)).not.toContain('private-name');
  });

  it('creates a stable fingerprint for equivalent errors', () => {
    const first = classifyProcessingError({
      tool: 'merge',
      error: new Error('Invalid PDF object 12345'),
      files: [fakeFile('application/pdf')],
    });
    const second = classifyProcessingError({
      tool: 'merge',
      error: new Error('Invalid PDF object 98765'),
      files: [fakeFile('application/pdf')],
    });
    expect(first.code).toBe('PDF_PARSE_FAILED');
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it('uses a safe fallback for unknown failures', () => {
    const result = classifyProcessingError({
      tool: 'resize-image',
      error: new Error('Something unusual happened'),
      files: [fakeFile('image/png')],
    });
    expect(result.code).toBe('UNKNOWN_RUNTIME_ERROR');
  });
});
