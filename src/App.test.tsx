// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/PdfViewer', () => ({ PdfViewer: () => <div data-testid="pdf-preview" /> }));
vi.mock('./components/FilePreviewGallery', () => ({ FilePreviewGallery: ({ files }: { files: File[] }) => <div data-testid="file-preview-gallery">{files.map((file) => <span key={file.name}>{file.name}</span>)}</div> }));
vi.mock('./components/PdfPageGrid', () => ({ PdfPageGrid: () => <div data-testid="pdf-page-grid" /> }));
vi.mock('./lib/history', () => ({
  getHistory: vi.fn(async () => []),
  clearHistory: vi.fn(async () => undefined),
  saveHistory: vi.fn(async () => undefined),
  getLocalProfile: vi.fn(async () => ({
    name: 'Abinash Gogoi', email: '', accountId: 'ACC-LOCAL-TEST', deviceId: 'DEV-WEB-TEST',
    releaseChannel: 'developer', syncHistory: false, syncDiagnostics: false,
    createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
  })),
  saveLocalProfile: vi.fn(async () => undefined),
}));
vi.mock('./engine/pdf-engine', () => ({
  addBlankPages: vi.fn(), addPageNumbers: vi.fn(), addWatermark: vi.fn(), cleanPdfMetadata: vi.fn(),
  compressPdf: vi.fn(), deletePdfPages: vi.fn(), duplicatePdfPages: vi.fn(), extractPdfPages: vi.fn(),
  imagesToPdf: vi.fn(), mergePdfs: vi.fn(), pdfPageCount: vi.fn(async () => 2), pdfToImages: vi.fn(),
  reorderPdfPages: vi.fn(), rotatePdf: vi.fn(), splitPdf: vi.fn(),
}));
vi.mock('./engine/image-engine', () => ({ compressImage: vi.fn(), resizeImage: vi.fn() }));
vi.mock('./engine/document-engine', () => ({ inspectPdf: vi.fn(), inspectPdfSignatures: vi.fn(), pdfToText: vi.fn() }));
vi.mock('./engine/ocr-engine', () => ({ runOcr: vi.fn() }));

describe('real tool interaction flows', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('keeps the first PDF when a second PDF is selected later for Merge', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Merge PDFs/i }));
    const input = screen.getByLabelText('Select files for Merge PDFs');
    const first = new File(['first'], 'first.pdf', { type: 'application/pdf' });
    const second = new File(['second'], 'second.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [first] } });
    expect(await screen.findByText('first.pdf')).toBeTruthy();

    fireEvent.change(input, { target: { files: [second] } });
    await waitFor(() => {
      expect(screen.getAllByText('first.pdf').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('second.pdf').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/2 files/)).toBeTruthy();
      expect(screen.getByTestId('file-preview-gallery')).toBeTruthy();
    });
  });

  it('exposes the scalable searchable tool library and profile entry', async () => {
    render(<App />);
    expect(screen.getByText('20 working document operations')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Search tools/), { target: { value: 'Assamese' } });
    expect(screen.getByRole('button', { name: /OCR text recognition/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Merge PDFs/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Open account profile/i }));
    expect(await screen.findByText('Personal workspace')).toBeTruthy();
    expect(screen.getByText('ACC-LOCAL-TEST')).toBeTruthy();
    expect(screen.getByText('DEV-WEB-TEST')).toBeTruthy();
  });
});
