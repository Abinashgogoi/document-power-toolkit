export function humanBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 100 || exponent === 0 ? value.toFixed(0) : value.toFixed(2)} ${units[exponent]}`;
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function fileBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function parsePageSelection(input: string, pageCount: number): number[] {
  if (!input.trim()) throw new Error('Enter at least one page number.');
  const selected = new Set<number>();
  for (const token of input.split(',').map((part) => part.trim()).filter(Boolean)) {
    if (token.includes('-')) {
      const [startRaw, endRaw, extra] = token.split('-');
      if (extra !== undefined) throw new Error(`Invalid page range: ${token}`);
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
        throw new Error(`Invalid page range: ${token}`);
      }
      for (let page = start; page <= end; page += 1) selected.add(page);
    } else {
      const page = Number(token);
      if (!Number.isInteger(page)) throw new Error(`Invalid page number: ${token}`);
      selected.add(page);
    }
  }
  const pages = [...selected].sort((a, b) => a - b);
  if (pages.some((page) => page < 1 || page > pageCount)) {
    throw new Error(`Page selection must stay between 1 and ${pageCount}.`);
  }
  return pages;
}

export function parseOrderedPageSelection(input: string, pageCount: number): number[] {
  if (!input.trim()) throw new Error('Enter the complete page order.');
  const pages: number[] = [];
  for (const token of input.split(',').map((part) => part.trim()).filter(Boolean)) {
    if (token.includes('-')) {
      const [startRaw, endRaw, extra] = token.split('-');
      if (extra !== undefined) throw new Error(`Invalid page range: ${token}`);
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isInteger(start) || !Number.isInteger(end)) throw new Error(`Invalid page range: ${token}`);
      const direction = start <= end ? 1 : -1;
      for (let page = start; page !== end + direction; page += direction) pages.push(page);
    } else {
      const page = Number(token);
      if (!Number.isInteger(page)) throw new Error(`Invalid page number: ${token}`);
      pages.push(page);
    }
  }
  if (pages.some((page) => page < 1 || page > pageCount)) {
    throw new Error(`Page order must stay between 1 and ${pageCount}.`);
  }
  return pages;
}

export function appendSelectedFiles(current: File[], incoming: File[], multiple: boolean): File[] {
  return multiple ? [...current, ...incoming] : incoming.slice(0, 1);
}
