import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { inspectPdf, inspectPdfSignatures } from './document-engine';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

async function pdfFixture(): Promise<File> {
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 600]);
  pdf.setTitle('Fixture');
  return new File([await pdf.save() as BlobPart], 'fixture.pdf', { type: 'application/pdf' });
}

describe('document inspection engine', () => {
  it('exports real PDF metadata and page geometry', async () => {
    const result = await inspectPdf(await pdfFixture());
    const json = JSON.parse(await result.blob.text());
    expect(json.pdf.pages).toBe(1);
    expect(json.pdf.title).toBe('Fixture');
    expect(json.pdf.pageGeometry[0].widthPoints).toBe(400);
    expect(result.verification.passed).toBe(true);
  });

  it('does not claim an unsigned PDF has a valid signature', async () => {
    const result = await inspectPdfSignatures(await pdfFixture());
    const json = JSON.parse(await result.blob.text());
    expect(json.embeddedSignaturesFound).toBe(0);
    expect(result.verification.passed).toBe(false);
    expect(result.note).toContain('does not claim certificate trust');
  });

  it('detects a structurally invalid embedded ByteRange marker', async () => {
    const source = await pdfFixture();
    const modified = new File(
      [await source.arrayBuffer(), '\n% /Type /Sig /ByteRange [0 10 5 20] /SubFilter /adbe.pkcs7.detached'],
      'invalid-signature.pdf',
      { type: 'application/pdf' },
    );
    const result = await inspectPdfSignatures(modified);
    const json = JSON.parse(await result.blob.text());
    expect(json.embeddedSignaturesFound).toBe(1);
    expect(json.structurallyValidByteRanges).toBe(0);
    expect(result.verification.passed).toBe(false);
  });
});
