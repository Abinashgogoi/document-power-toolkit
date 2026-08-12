import type { ToolCategory, ToolDefinition } from './types';

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  organize: 'Organize PDF',
  convert: 'Convert & extract',
  optimize: 'Optimize media',
  edit: 'Edit & brand',
  security: 'Inspect & recognize',
};

export const TOOLS: ToolDefinition[] = [
  { id: 'merge', title: 'Merge PDFs', description: 'Combine multiple PDFs in your chosen order', accepts: 'application/pdf,.pdf', multiple: true, output: 'PDF', category: 'organize', keywords: ['combine', 'join', 'multiple'] },
  { id: 'split', title: 'Split PDF', description: 'Export every page as an individual PDF', accepts: 'application/pdf,.pdf', multiple: false, output: 'ZIP', category: 'organize', keywords: ['separate', 'pages', 'archive'] },
  { id: 'rotate', title: 'Rotate pages', description: 'Rotate every page without rasterizing', accepts: 'application/pdf,.pdf', multiple: false, output: 'PDF', category: 'organize', keywords: ['turn', 'orientation'] },
  { id: 'extract', title: 'Extract pages', description: 'Create a PDF from selected pages', accepts: 'application/pdf,.pdf', multiple: false, output: 'PDF', category: 'organize', keywords: ['select', 'range'] },
  { id: 'delete-pages', title: 'Delete pages', description: 'Remove selected pages while preserving the rest', accepts: 'application/pdf,.pdf', multiple: false, output: 'PDF', category: 'organize', keywords: ['remove', 'pages'] },
  { id: 'reorder-pages', title: 'Reorder pages', description: 'Define the exact new page order', accepts: 'application/pdf,.pdf', multiple: false, output: 'PDF', category: 'organize', keywords: ['arrange', 'sort', 'move'] },
  { id: 'duplicate-pages', title: 'Duplicate pages', description: 'Duplicate selected pages beside their originals', accepts: 'application/pdf,.pdf', multiple: false, output: 'PDF', category: 'organize', keywords: ['copy', 'repeat'] },
  { id: 'add-blank-page', title: 'Add blank pages', description: 'Append A4, Letter, or matching blank pages', accepts: 'application/pdf,.pdf', multiple: false, output: 'PDF', category: 'organize', keywords: ['insert', 'empty', 'append'] },
  { id: 'images-to-pdf', title: 'Images to PDF', description: 'Build one PDF from JPG, PNG, or WebP', accepts: 'image/*', multiple: true, output: 'PDF', category: 'convert', keywords: ['jpg', 'png', 'photo'] },
  { id: 'pdf-to-images', title: 'PDF to images', description: 'Render every PDF page to PNG', accepts: 'application/pdf,.pdf', multiple: false, output: 'ZIP', category: 'convert', keywords: ['png', 'render', 'picture'] },
  { id: 'pdf-to-text', title: 'PDF to text', description: 'Extract an existing searchable text layer', accepts: 'application/pdf,.pdf', multiple: false, output: 'TXT', category: 'convert', keywords: ['text', 'extract', 'searchable'] },
  { id: 'compress-pdf', title: 'Compress PDF', description: 'Target an exact maximum size safely', accepts: 'application/pdf,.pdf', multiple: false, output: 'PDF', category: 'optimize', keywords: ['reduce', 'kb', 'mb', 'size'] },
  { id: 'compress-image', title: 'Compress image', description: 'Target exact KB or MB locally', accepts: 'image/*', multiple: false, output: 'Image', category: 'optimize', keywords: ['photo', 'reduce', 'size'] },
  { id: 'resize-image', title: 'Resize image', description: 'Set exact pixel dimensions and output format', accepts: 'image/*', multiple: false, output: 'Image', category: 'optimize', keywords: ['width', 'height', 'pixels'] },
  { id: 'watermark', title: 'Add watermark', description: 'Place a subtle text watermark on every page', accepts: 'application/pdf,.pdf', multiple: false, output: 'PDF', category: 'edit', keywords: ['text', 'stamp', 'brand'] },
  { id: 'page-numbers', title: 'Add page numbers', description: 'Number every page from a chosen starting value', accepts: 'application/pdf,.pdf', multiple: false, output: 'PDF', category: 'edit', keywords: ['footer', 'number'] },
  { id: 'clean-metadata', title: 'Clean metadata', description: 'Remove standard title, author, and subject metadata', accepts: 'application/pdf,.pdf', multiple: false, output: 'PDF', category: 'security', keywords: ['privacy', 'author', 'sanitize'] },
  { id: 'inspect-pdf', title: 'Inspect PDF', description: 'Export metadata, geometry, rotation, and file facts', accepts: 'application/pdf,.pdf', multiple: false, output: 'JSON', category: 'security', keywords: ['metadata', 'information', 'report'] },
  { id: 'ocr', title: 'OCR text recognition', description: 'Recognize English, Hindi, or Assamese locally', accepts: 'application/pdf,.pdf,image/*', multiple: false, output: 'TXT', category: 'security', keywords: ['scan', 'english', 'hindi', 'assamese', 'search'] },
  { id: 'signature-inspect', title: 'Inspect PDF signatures', description: 'Detect embedded signatures and inspect signed byte ranges', accepts: 'application/pdf,.pdf', multiple: false, output: 'JSON', category: 'security', keywords: ['certificate', 'digital', 'government', 'integrity'] },
];
