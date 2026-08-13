import type { ToolId } from '../types';

export type DiagnosticCode =
  | 'OCR_WORKER_LOAD_FAILED'
  | 'OCR_LANGUAGE_DATA_FAILED'
  | 'PDF_WORKER_FAILED'
  | 'PDF_PARSE_FAILED'
  | 'SIGNATURE_PARSE_FAILED'
  | 'OUTPUT_VERIFICATION_FAILED'
  | 'NETWORK_ASSET_FAILED'
  | 'MEMORY_LIMIT'
  | 'UNSUPPORTED_FILE'
  | 'PROCESSING_TIMEOUT'
  | 'UNKNOWN_RUNTIME_ERROR';

export interface DiagnosticClassification {
  code: DiagnosticCode;
  message: string;
  fingerprint: string;
  context: {
    tool: ToolId;
    stage: 'processing';
    online: boolean;
    inputCount: number;
    inputBytes: number;
    inputTypes: string[];
    errorName: string;
  };
}

function normalizedError(error: unknown): { name: string; message: string; lower: string } {
  if (error instanceof Error) {
    const message = error.message.trim() || 'Unknown processing error';
    return { name: error.name || 'Error', message, lower: `${error.name} ${message}`.toLowerCase() };
  }
  const message = String(error || 'Unknown processing error').trim();
  return { name: 'Error', message, lower: message.toLowerCase() };
}

function classifyCode(tool: ToolId, lower: string): DiagnosticCode {
  if (lower.includes('unsupported') || lower.includes('file type') || lower.includes('mime')) return 'UNSUPPORTED_FILE';
  if (lower.includes('out of memory') || lower.includes('allocation failed') || lower.includes('memory limit')) return 'MEMORY_LIMIT';
  if (lower.includes('timeout') || lower.includes('timed out')) return 'PROCESSING_TIMEOUT';
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('fetch failed') || lower.includes('404')) return 'NETWORK_ASSET_FAILED';

  if (tool === 'ocr') {
    if (lower.includes('language') || lower.includes('traineddata') || lower.includes('langpath')) return 'OCR_LANGUAGE_DATA_FAILED';
    if (lower.includes('worker') || lower.includes('wasm') || lower.includes('tesseract')) return 'OCR_WORKER_LOAD_FAILED';
  }

  if (tool === 'signature-inspect') return 'SIGNATURE_PARSE_FAILED';
  if (lower.includes('verification') || lower.includes('verify')) return 'OUTPUT_VERIFICATION_FAILED';
  if (lower.includes('pdf.worker') || lower.includes('pdf worker')) return 'PDF_WORKER_FAILED';

  const pdfTools: ToolId[] = [
    'merge','split','rotate','extract','delete-pages','reorder-pages','duplicate-pages',
    'add-blank-page','images-to-pdf','pdf-to-images','pdf-to-text','compress-pdf',
    'watermark','page-numbers','clean-metadata','inspect-pdf','signature-inspect',
  ];
  if (pdfTools.includes(tool) && (lower.includes('pdf') || lower.includes('parse') || lower.includes('invalid'))) {
    return 'PDF_PARSE_FAILED';
  }

  return 'UNKNOWN_RUNTIME_ERROR';
}

function hashFingerprint(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `dpt-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function classifyProcessingError(input: {
  tool: ToolId;
  error: unknown;
  files: File[];
  online?: boolean;
}): DiagnosticClassification {
  const details = normalizedError(input.error);
  const code = classifyCode(input.tool, details.lower);
  const inputTypes = [...new Set(input.files.map((file) => file.type || 'unknown'))].slice(0, 8);
  const stableErrorShape = details.lower
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<uuid>')
    .replace(/\b\d{3,}\b/g, '<n>')
    .slice(0, 240);

  return {
    code,
    message: details.message.slice(0, 1000),
    fingerprint: hashFingerprint(`${input.tool}|${code}|${stableErrorShape}`),
    context: {
      tool: input.tool,
      stage: 'processing',
      online: input.online ?? (typeof navigator === 'undefined' ? true : navigator.onLine),
      inputCount: input.files.length,
      inputBytes: input.files.reduce((sum, file) => sum + file.size, 0),
      inputTypes,
      errorName: details.name.slice(0, 80),
    },
  };
}
