import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import type { ProcessingResult, VerificationCheck } from '../types';
import { baseName, fileBytes } from '../lib/files';
import { report } from '../lib/verification';

export async function pdfToText(file: File): Promise<ProcessingResult> {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: await fileBytes(file) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(`--- Page ${pageNumber} ---\n${text}`);
  }
  const output = pages.join('\n\n');
  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  const checks: VerificationCheck[] = [
    { label: 'Text file created', passed: blob.size > 0, detail: `${blob.size} bytes` },
    { label: 'Pages processed', passed: pages.length === document.numPages, detail: `${pages.length} of ${document.numPages}` },
    { label: 'Text detected', passed: output.replace(/--- Page \d+ ---/g, '').trim().length > 0, detail: output.trim() ? 'Extractable text found' : 'No extractable text found' },
  ];
  return {
    blob,
    fileName: `${baseName(file.name)}.txt`,
    verification: report(checks),
    inputBytes: file.size,
    outputBytes: blob.size,
    note: checks[2].passed ? 'Text was extracted from the existing PDF text layer.' : 'This document appears scanned. Use OCR instead.',
  };
}

export async function inspectPdf(file: File): Promise<ProcessingResult> {
  const bytes = await fileBytes(file);
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: false });
  const pages = pdf.getPages().map((page, index) => ({
    page: index + 1,
    widthPoints: round(page.getWidth()),
    heightPoints: round(page.getHeight()),
    rotation: page.getRotation().angle,
  }));
  const output = {
    file: { name: file.name, bytes: file.size, type: file.type || 'application/pdf' },
    pdf: {
      pages: pdf.getPageCount(),
      title: safeCall(() => pdf.getTitle()),
      author: safeCall(() => pdf.getAuthor()),
      subject: safeCall(() => pdf.getSubject()),
      creator: safeCall(() => pdf.getCreator()),
      producer: safeCall(() => pdf.getProducer()),
      creationDate: safeCall(() => pdf.getCreationDate()?.toISOString()),
      modificationDate: safeCall(() => pdf.getModificationDate()?.toISOString()),
      pageGeometry: pages,
    },
    inspectedAt: new Date().toISOString(),
  };
  const blob = jsonBlob(output);
  return {
    blob,
    fileName: `${baseName(file.name)}-inspection.json`,
    verification: report([
      { label: 'PDF parsed', passed: true, detail: `${pdf.getPageCount()} pages` },
      { label: 'Inspection report', passed: blob.size > 0, detail: `${blob.size} bytes` },
    ]),
    inputBytes: file.size,
    outputBytes: blob.size,
  };
}

interface SignatureRange {
  index: number;
  byteRange: [number, number, number, number];
  structurallyValid: boolean;
  signedThroughByte: number;
  coversCurrentFile: boolean;
  unsignedTrailingBytes: number;
  signedContentSha256?: string;
  subFilter?: string;
  signerNameHint?: string;
  signingTimeHint?: string;
}

export async function inspectPdfSignatures(file: File): Promise<ProcessingResult> {
  const bytes = await fileBytes(file);
  await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: false });
  const source = bytesToLatin1(bytes);
  const expression = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const signatures: SignatureRange[] = [];
  let match: RegExpExecArray | null;
  while ((match = expression.exec(source)) !== null) {
    const range = match.slice(1, 5).map(Number) as [number, number, number, number];
    const [start1, length1, start2, length2] = range;
    const firstEnd = start1 + length1;
    const signedEnd = start2 + length2;
    const valid = start1 === 0 && length1 >= 0 && start2 > firstEnd && signedEnd <= bytes.length;
    const context = source.slice(Math.max(0, match.index - 1800), Math.min(source.length, match.index + 1800));
    const signature: SignatureRange = {
      index: signatures.length + 1,
      byteRange: range,
      structurallyValid: valid,
      signedThroughByte: signedEnd,
      coversCurrentFile: valid && signedEnd === bytes.length,
      unsignedTrailingBytes: valid ? bytes.length - signedEnd : bytes.length,
      subFilter: capture(context, /\/SubFilter\s*\/([^\s/>]+)/),
      signerNameHint: decodePdfString(capture(context, /\/Name\s*\(([^)]*)\)/)),
      signingTimeHint: decodePdfString(capture(context, /\/M\s*\((D:[^)]*)\)/)),
    };
    if (valid) {
      const signed = new Uint8Array(length1 + length2);
      signed.set(bytes.slice(start1, firstEnd), 0);
      signed.set(bytes.slice(start2, signedEnd), length1);
      signature.signedContentSha256 = await sha256(signed);
    }
    signatures.push(signature);
  }

  const validRanges = signatures.filter((signature) => signature.structurallyValid).length;
  const latestCoversFile = signatures.length > 0 && signatures.some((signature) => signature.coversCurrentFile);
  const output = {
    file: { name: file.name, bytes: file.size },
    embeddedSignaturesFound: signatures.length,
    structurallyValidByteRanges: validRanges,
    latestSignatureCoversCurrentFile: latestCoversFile,
    signatures,
    scope: {
      performed: ['embedded signature marker detection', 'ByteRange boundary validation', 'signed-content SHA-256 calculation', 'unsigned trailing-byte detection'],
      notPerformed: ['CMS cryptographic signature verification', 'certificate-chain trust validation', 'OCSP/CRL revocation checking', 'trusted-root validation'],
    },
    conclusion: signatures.length === 0
      ? 'No embedded certificate-based PDF signature was detected.'
      : validRanges !== signatures.length
        ? 'At least one embedded signature has an invalid ByteRange structure.'
        : latestCoversFile
          ? 'Embedded signature ranges are structurally consistent and the latest range covers the current file. Cryptographic trust is not yet verified.'
          : 'Embedded signature ranges were found, but none covers the complete current file; unsigned changes may exist after signing.',
  };
  const blob = jsonBlob(output);
  const checks: VerificationCheck[] = [
    { label: 'PDF parsed', passed: true, detail: 'Document structure opened successfully' },
    { label: 'Embedded signature found', passed: signatures.length > 0, detail: `${signatures.length} detected` },
    { label: 'ByteRange structure', passed: signatures.length > 0 && validRanges === signatures.length, detail: `${validRanges} of ${signatures.length} structurally valid` },
    { label: 'Current-file coverage', passed: latestCoversFile, detail: latestCoversFile ? 'A signature range reaches the current end of file' : 'Unsigned trailing content may exist or no signature was found' },
  ];
  return {
    blob,
    fileName: `${baseName(file.name)}-signature-inspection.json`,
    verification: report(checks),
    inputBytes: file.size,
    outputBytes: blob.size,
    note: 'Basic integrity inspection only. This milestone does not claim certificate trust or cryptographic signature validity.',
  };
}

function jsonBlob(value: unknown): Blob {
  return new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
}

function safeCall<T>(reader: () => T): T | null {
  try { return reader() ?? null; } catch { return null; }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function capture(source: string, expression: RegExp): string | undefined {
  return expression.exec(source)?.[1];
}

function decodePdfString(value?: string): string | undefined {
  return value?.replace(/\\([()\\])/g, '$1').trim() || undefined;
}

function bytesToLatin1(bytes: Uint8Array): string {
  const decoder = new TextDecoder('latin1');
  const chunkSize = 1024 * 1024;
  let output = '';
  for (let start = 0; start < bytes.length; start += chunkSize) output += decoder.decode(bytes.slice(start, start + chunkSize), { stream: start + chunkSize < bytes.length });
  return output;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
