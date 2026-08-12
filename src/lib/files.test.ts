import { describe, expect, it } from 'vitest';
import { appendSelectedFiles, humanBytes, parseOrderedPageSelection, parsePageSelection } from './files';

describe('file utilities', () => {
  it('parses, de-duplicates, and sorts page selections', () => {
    expect(parsePageSelection('5, 1, 2-4, 3', 8)).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects invalid or out-of-range pages', () => {
    expect(() => parsePageSelection('0, 2', 4)).toThrow('between 1 and 4');
    expect(() => parsePageSelection('4-2', 4)).toThrow('Invalid page range');
    expect(() => parsePageSelection('', 4)).toThrow('at least one page');
  });

  it('formats binary byte units', () => {
    expect(humanBytes(1024)).toBe('1.00 KB');
    expect(humanBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('preserves explicit page order and descending ranges', () => {
    expect(parseOrderedPageSelection('3, 1, 5-4, 2', 5)).toEqual([3, 1, 5, 4, 2]);
  });

  it('appends later multi-file selections instead of replacing earlier files', () => {
    const first = new File(['a'], 'first.pdf', { type: 'application/pdf' });
    const second = new File(['b'], 'second.pdf', { type: 'application/pdf' });
    expect(appendSelectedFiles([first], [second], true)).toEqual([first, second]);
    expect(appendSelectedFiles([first], [second], false)).toEqual([second]);
  });
});
