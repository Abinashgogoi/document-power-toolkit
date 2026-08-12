import { beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import {
  addBlankPages, addPageNumbers, addWatermark, cleanPdfMetadata, deletePdfPages,
  duplicatePdfPages, extractPdfPages, mergePdfs, reorderPdfPages, rotatePdf, splitPdf,
} from './pdf-engine';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

async function fixture(name: string, pageCount: number): Promise<File> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([300 + index, 400 + index]);
  }
  return new File([await pdf.save() as BlobPart], name, { type: 'application/pdf' });
}

describe('PDF engine', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('merges every source page and verifies the result', async () => {
    const result = await mergePdfs([await fixture('one.pdf', 2), await fixture('two.pdf', 3)]);
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(output.getPageCount()).toBe(5);
    expect(result.verification.passed).toBe(true);
    expect(result.fileName).toBe('merged-document.pdf');
  });

  it('splits every page into a separate PDF archive entry', async () => {
    const result = await splitPdf(await fixture('source.pdf', 3));
    const archive = await JSZip.loadAsync(await result.blob.arrayBuffer());
    expect(Object.keys(archive.files)).toHaveLength(3);
    expect(Object.keys(archive.files)).toContain('source-page-1.pdf');
    expect(result.verification.passed).toBe(true);
  });

  it('rotates pages without changing the page count', async () => {
    const result = await rotatePdf(await fixture('source.pdf', 2), 90);
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(output.getPageCount()).toBe(2);
    expect(output.getPages().every((page) => page.getRotation().angle === 90)).toBe(true);
    expect(result.verification.passed).toBe(true);
  });

  it('extracts exactly the requested pages', async () => {
    const result = await extractPdfPages(await fixture('source.pdf', 5), [1, 3, 5]);
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(output.getPageCount()).toBe(3);
    expect(result.verification.passed).toBe(true);
  });

  it('rejects unsupported rotation values safely', async () => {
    await expect(rotatePdf(await fixture('source.pdf', 1), 45)).rejects.toThrow('Rotation must be');
  });

  it('deletes only selected pages and refuses to delete all pages', async () => {
    const source = await fixture('source.pdf', 4);
    const result = await deletePdfPages(source, [2, 4]);
    expect((await PDFDocument.load(await result.blob.arrayBuffer())).getPageCount()).toBe(2);
    await expect(deletePdfPages(source, [1, 2, 3, 4])).rejects.toThrow('At least one page');
  });

  it('reorders every page exactly once', async () => {
    const source = await fixture('source.pdf', 3);
    const result = await reorderPdfPages(source, [3, 1, 2]);
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(output.getPages().map((page) => page.getWidth())).toEqual([302, 300, 301]);
    await expect(reorderPdfPages(source, [1, 1, 2])).rejects.toThrow('every page exactly once');
  });

  it('duplicates selected pages beside their originals', async () => {
    const result = await duplicatePdfPages(await fixture('source.pdf', 3), [2]);
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(output.getPageCount()).toBe(4);
    expect(output.getPages().map((page) => page.getWidth())).toEqual([300, 301, 301, 302]);
  });

  it('adds verified blank pages in a selected size', async () => {
    const result = await addBlankPages(await fixture('source.pdf', 2), 2, 'a4');
    const output = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(output.getPageCount()).toBe(4);
    expect(Math.round(output.getPages()[3].getWidth())).toBe(595);
  });

  it('applies watermark and page numbers without changing page count', async () => {
    const source = await fixture('source.pdf', 2);
    const watermarked = await addWatermark(source, 'PRIVATE');
    const numbered = await addPageNumbers(source, 5);
    expect((await PDFDocument.load(await watermarked.blob.arrayBuffer())).getPageCount()).toBe(2);
    expect((await PDFDocument.load(await numbered.blob.arrayBuffer())).getPageCount()).toBe(2);
    expect(watermarked.verification.passed).toBe(true);
    expect(numbered.verification.passed).toBe(true);
  });

  it('removes standard metadata fields', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.setTitle('Secret title');
    pdf.setAuthor('Private author');
    const source = new File([await pdf.save() as BlobPart], 'metadata.pdf', { type: 'application/pdf' });
    const result = await cleanPdfMetadata(source);
    const output = await PDFDocument.load(await result.blob.arrayBuffer(), { updateMetadata: false });
    expect(output.getTitle()).toBe('');
    expect(output.getAuthor()).toBe('');
    expect(result.verification.passed).toBe(true);
  });
});
