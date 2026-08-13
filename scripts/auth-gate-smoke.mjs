import { spawn } from 'node:child_process';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import { inflate } from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';

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
  chromium.setGraphicsMode = false;
  const executablePath = process.platform === 'win32'
    ? playwright.executablePath()
    : await inflate(path.resolve('node_modules/@sparticuz/chromium/bin/chromium.br'));

  browser = await playwright.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(origin, { waitUntil: 'networkidle' });

  const gateVisible = await page.locator('.auth-card, .status-card').first().isVisible().catch(() => false);
  if (!gateVisible) throw new Error('Authentication gate did not render.');
  const toolCount = await page.locator('.tool-card').count();
  if (toolCount !== 0) throw new Error(`Authentication gate leaked ${toolCount} tool cards.`);

  process.stdout.write('Authentication gate acceptance passed: unauthenticated visitors cannot access document tools.\n');
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
