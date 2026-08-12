export type ToolId =
  | 'merge'
  | 'split'
  | 'rotate'
  | 'extract'
  | 'delete-pages'
  | 'reorder-pages'
  | 'duplicate-pages'
  | 'add-blank-page'
  | 'images-to-pdf'
  | 'pdf-to-images'
  | 'pdf-to-text'
  | 'compress-pdf'
  | 'compress-image'
  | 'resize-image'
  | 'watermark'
  | 'page-numbers'
  | 'clean-metadata'
  | 'inspect-pdf'
  | 'ocr'
  | 'signature-inspect';

export type ToolCategory = 'organize' | 'convert' | 'optimize' | 'edit' | 'security';

export type QualityFloor = 'high' | 'balanced' | 'aggressive';

export interface CompressionOptions {
  targetBytes: number;
  safetyMarginPercent: number;
  qualityFloor: QualityFloor;
}

export interface VerificationCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface VerificationReport {
  passed: boolean;
  checks: VerificationCheck[];
}

export interface ProcessingResult {
  blob: Blob;
  fileName: string;
  verification: VerificationReport;
  inputBytes: number;
  outputBytes: number;
  note?: string;
}

export interface HistoryEntry {
  id: string;
  tool: ToolId;
  toolName: string;
  timestamp: string;
  inputBytes: number;
  outputBytes: number;
  durationMs: number;
  passed: boolean;
  settings: Record<string, string | number | boolean>;
}

export interface ToolDefinition {
  id: ToolId;
  title: string;
  description: string;
  accepts: string;
  multiple: boolean;
  output: string;
  category: ToolCategory;
  keywords: string[];
}

export interface LocalProfile {
  name: string;
  email: string;
  accountId: string;
  deviceId: string;
  cloudDeviceId: string;
  releaseChannel: 'stable' | 'beta' | 'developer';
  syncHistory: boolean;
  syncDiagnostics: boolean;
  createdAt: string;
  updatedAt: string;
}
