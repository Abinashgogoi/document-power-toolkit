import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import { inflate } from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const origin = 'http://127.0.0.1:4173';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.on('data', () => undefined);
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

let browser;
try {
  await waitForServer(`${origin}/`);
  await mkdir('tests/artifacts', { recursive: true });
  const first = await createPdf('tests/artifacts/first.pdf', 1);
  const second = await createPdf('tests/artifacts/second.pdf', 2);
  const ocrFixture = path.resolve('tests/fixtures/ocr-hello.png');
  const libraryScreenshot = path.resolve('tests/artifacts/tool-library.png');
  chromium.setGraphicsMode = false;
  const executablePath = await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/chromium.br'));
  browser = await playwright.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const failures = [];
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') failures.push(`console: ${message.text()}`); });

  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.getByText('20 working document operations').waitFor();
  if (await page.locator('.tool-card').count() !== 20) throw new Error('Tool library did not render exactly 20 working tools.');
  await page.screenshot({ path: 'tests/artifacts/tool-library.png', fullPage: true });

  const toolNames = [
    'Merge PDFs', 'Split PDF', 'Rotate pages', 'Extract pages', 'Delete pages',
    'Reorder pages', 'Duplicate pages', 'Add blank pages', 'Images to PDF',
    'PDF to images', 'PDF to text', 'Compress PDF', 'Compress image', 'Resize image',
    'Add watermark', 'Add page numbers', 'Clean metadata', 'Inspect PDF',
    'OCR text recognition', 'Inspect PDF signatures',
  ];
  for (const name of toolNames) {
    await openTool(page, name);
    await page.getByRole('heading', { name, exact: true }).waitFor();
    await page.getByRole('button', { name: 'All tools', exact: true }).click();
  }

  await openTool(page, 'Merge PDFs');
  const input = page.getByLabel('Select files for Merge PDFs');
  const selectedFiles = page.locator('.file-list');
  await input.setInputFiles(first);
  await selectedFiles.getByText('first.pdf').waitFor();
  await input.setInputFiles(second);
  await selectedFiles.getByText('second.pdf').waitFor();
  if (await selectedFiles.getByText('first.pdf').count() !== 1 || await selectedFiles.getByText('second.pdf').count() !== 1) {
    throw new Error('Sequential Merge selection did not preserve both PDFs.');
  }
  const mergePreviews = page.locator('[data-preview-file]');
  await mergePreviews.filter({ hasText: 'first.pdf' }).locator('canvas').waitFor();
  await mergePreviews.filter({ hasText: 'second.pdf' }).locator('canvas').waitFor();
  if (await mergePreviews.count() !== 2) throw new Error('Merge did not provide one visual preview per uploaded PDF.');
  await page.getByRole('button', { name: 'Next page of second.pdf' }).click();
  await page.getByLabel('second.pdf page 2 preview').waitFor();
  await page.getByRole('button', { name: 'Create PDF' }).click();
  await waitForText(page, 'Verified output', { timeout: 15_000 });
  await page.screenshot({ path: 'tests/artifacts/merge-verified.png', fullPage: true });

  await page.getByLabel('Open account profile').click();
  await page.getByText('Personal workspace').waitFor();
  await page.getByText(/ACC-LOCAL-/).waitFor();
  await page.getByText(/DEV-WEB-/).waitFor();
  await page.getByRole('button', { name: 'Close account profile' }).click();

  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await openTool(page, 'Delete pages');
  await page.getByLabel('Select files for Delete pages').setInputFiles(second);
  await page.locator('.pdf-page-thumb').nth(1).waitFor();
  if (await page.locator('.pdf-page-thumb').count() !== 2) throw new Error('Delete pages did not render every page thumbnail.');
  await page.getByRole('button', { name: /Page 1 selected for deletion/ }).click();
  await page.getByRole('button', { name: 'Page 2', exact: true }).click();
  await page.getByRole('button', { name: /Page 2 selected for deletion/ }).waitFor();
  await page.screenshot({ path: 'tests/artifacts/delete-page-previews.png', fullPage: true });
  await page.getByRole('button', { name: 'Create PDF' }).click();
  await waitForText(page, 'Verified output', { timeout: 30_000 });

  await runSingleFileTool(page, 'Split PDF', first, 'Create ZIP');
  await runSingleFileTool(page, 'Rotate pages', first, 'Create PDF');
  await runSingleFileTool(page, 'Extract pages', second, 'Create PDF');

  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await openTool(page, 'Reorder pages');
  await page.getByLabel('Select files for Reorder pages').setInputFiles(second);
  await page.getByLabel('Complete new page order').waitFor();
  for (let attempt = 0; attempt < 30 && await page.getByLabel('Complete new page order').inputValue() !== '1-2'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (await page.getByLabel('Complete new page order').inputValue() !== '1-2') throw new Error('Reorder page order was not initialized from the uploaded PDF.');
  await page.getByRole('button', { name: 'Create PDF' }).click();
  await waitForText(page, 'Verified output', { timeout: 30_000 });

  await runSingleFileTool(page, 'Duplicate pages', second, 'Create PDF');
  await runSingleFileTool(page, 'Add blank pages', first, 'Create PDF');
  await runSingleFileTool(page, 'Compress PDF', first, 'Create PDF');
  await runSingleFileTool(page, 'Add watermark', first, 'Create PDF');
  await runSingleFileTool(page, 'Add page numbers', second, 'Create PDF');
  await runSingleFileTool(page, 'Clean metadata', first, 'Create PDF');
  await runSingleFileTool(page, 'Inspect PDF', first, 'Create JSON');

  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await openTool(page, 'Images to PDF');
  const imageInput = page.getByLabel('Select files for Images to PDF');
  await imageInput.setInputFiles(ocrFixture);
  await imageInput.setInputFiles(libraryScreenshot);
  if (await page.locator('.file-list .file-row').count() !== 2) throw new Error('Sequential image selection did not preserve both images.');
  if (await page.locator('[data-preview-file] img').count() !== 2) throw new Error('Images to PDF did not provide one visual preview per uploaded image.');
  await page.getByRole('button', { name: 'Create PDF' }).click();
  await waitForText(page, 'Verified output', { timeout: 30_000 });

  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await openTool(page, 'PDF to images');
  await page.getByLabel('Select files for PDF to images').setInputFiles(second);
  await page.getByRole('button', { name: 'Create ZIP' }).click();
  await waitForText(page, 'Verified output', { timeout: 30_000 });

  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await openTool(page, 'PDF to text');
  await page.getByLabel('Select files for PDF to text').setInputFiles(second);
  await page.getByRole('button', { name: 'Create TXT' }).click();
  await waitForText(page, 'Verified output', { timeout: 30_000 });

  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await openTool(page, 'Resize image');
  await page.getByLabel('Select files for Resize image').setInputFiles(ocrFixture);
  await page.getByLabel('Width (px)').fill('320');
  await page.getByLabel('Height (px)').fill('120');
  await page.getByRole('button', { name: 'Create Image' }).click();
  await waitForText(page, 'Verified output', { timeout: 30_000 });

  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await openTool(page, 'Compress image');
  await page.getByLabel('Select files for Compress image').setInputFiles(libraryScreenshot);
  await page.getByLabel('Maximum output size').fill('40');
  await page.getByRole('button', { name: 'Create Image' }).click();
  await waitForText(page, 'Verified output', { timeout: 30_000 });

  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await openTool(page, 'OCR text recognition');
  await page.getByLabel('Select files for OCR text recognition').setInputFiles(ocrFixture);
  await page.getByRole('button', { name: 'Create TXT' }).click();
  await waitForText(page, 'Verified output', { timeout: 120_000 });

  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await openTool(page, 'Inspect PDF signatures');
  await page.getByLabel('Select files for Inspect PDF signatures').setInputFiles(first);
  await page.getByRole('button', { name: 'Create JSON' }).click();
  await waitForText(page, 'Output needs attention', { timeout: 30_000 });
  if (await page.getByText('Verified output').count()) throw new Error('Unsigned PDF was incorrectly shown as verified.');

  if (failures.length) throw new Error(`Browser emitted errors:\n${failures.join('\n')}`);
  process.stdout.write('Browser acceptance passed: all 20 tools processed in real Chromium; every uploaded PDF/image previewed; independent multipage Merge previews; page-thumbnail deletion; OCR and signature-warning gates passed.\n');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

async function waitForServer(url) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Preview server did not start: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
}

async function createPdf(target, pages) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index += 1) {
    const page = pdf.addPage([300 + index, 400 + index]);
    page.drawText(`Document page ${index + 1}`, { x: 28, y: 350, size: 18, font });
  }
  const absolute = path.resolve(target);
  await writeFile(absolute, await pdf.save());
  return absolute;
}

async function openTool(page, name) {
  await page.locator('.tool-card').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
}

async function waitForText(page, text, options = {}) {
  const timeout = options.timeout || 30_000;
  try {
    await page.getByText(text).waitFor({ timeout });
  } catch (error) {
    // Capture diagnostics on timeout
    const visibleText = await page.locator('.result-panel').textContent().catch(() => 'N/A');
    const consoleMessages = [];
    const allMessages = [];
    page.on('console', (msg) => allMessages.push(`${msg.type()}: ${msg.text()}`));
    await page.screenshot({ path: `tests/artifacts/failure-${Date.now()}.png` }).catch(() => {});
    const errorDetails = `
Expected text not found: "${text}"
Timeout: ${timeout}ms
Visible result panel text: ${visibleText}
Result eyebrow: ${await page.locator('.section-heading .eyebrow').textContent().catch(() => 'N/A')}
All result checks visible: ${await page.locator('.verification-check').count().catch(() => 'N/A')}
Page errors captured: ${allMessages.length > 0 ? allMessages.join('\n') : 'none'}
`;
    throw new Error(`${error.message}\nDiagnostics:${errorDetails}`);
  }
}

async function runSingleFileTool(page, name, file, createButton) {
  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await openTool(page, name);
  await page.getByLabel(`Select files for ${name}`).setInputFiles(file);
  await page.getByRole('button', { name: createButton }).click();
  await waitForText(page, 'Verified output', { timeout: 30_000 });
}
