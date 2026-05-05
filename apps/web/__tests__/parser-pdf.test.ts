/**
 * Web-side PDF parser tests — focused on fallback amount pattern (T13-02, C13-04).
 *
 * The PDF parser's structured table path is tested indirectly through
 * integration tests. This file focuses on the fallback line scanner's
 * amount extraction, specifically the trailing-minus capture group fix.
 */
import { describe, it, expect } from 'bun:test';

// Reconstruct the fallbackAmountPattern to verify capture group semantics.
// The production pattern lives in apps/web/src/lib/parser/pdf.ts:565.
// Group 6 was fixed in C13-04 to include the trailing minus IN the capture.
const fallbackAmountPattern = /\(([\d,]+)\)|[₩￦]([\d,]+)원?|마이너스([\d,]+)원?|(－[\d,]+)원?|KRW([\d,]+)원?|([\d,]*(?:,|\d{5,})[\d,]*-)|([\d,]*(?:,|\d{5,})[\d,]*)원?/g;

describe('PDF fallback amount pattern (C13-04)', () => {
  it('group 6 captures trailing minus including the minus sign', () => {
    const line = '2024-01-15 스타벅스 1,234-';
    const matches = [...line.matchAll(fallbackAmountPattern)];
    expect(matches.length).toBeGreaterThan(0);

    const lastMatch = matches[matches.length - 1];
    // Group 6 should be the match (all other groups undefined)
    expect(lastMatch[6]).toBe('1,234-');
    // The minus must be present in the captured text
    expect(lastMatch[6]).toContain('-');
  });

  it('group 7 captures plain amounts (원 suffix is outside capture)', () => {
    const line = '2024-01-15 스타벅스 5,500원';
    const matches = [...line.matchAll(fallbackAmountPattern)];
    const lastMatch = matches[matches.length - 1];
    // Group 7 captures only digits; 원? is outside the capture
    expect(lastMatch[7]).toBe('5,500');
    expect(lastMatch[0]).toBe('5,500원');
  });

  it('group 1 captures parenthesized negatives', () => {
    const line = '2024-01-15 스타벅스 (1,234)';
    const matches = [...line.matchAll(fallbackAmountPattern)];
    const lastMatch = matches[matches.length - 1];
    expect(lastMatch[1]).toBe('1,234');
  });

  it('group 4 captures fullwidth minus amounts', () => {
    const line = '2024-01-15 스타벅스 －1,234원';
    const matches = [...line.matchAll(fallbackAmountPattern)];
    const lastMatch = matches[matches.length - 1];
    expect(lastMatch[4]).toBe('－1,234');
  });

  it('trailing-minus amount would be parsed as negative by parseAmount', () => {
    // Simulate what parseAmount does with the captured text
    function parseAmount(raw: string): number | null {
      let cleaned = raw
        .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48))
        .replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-')
        .replace(/^KRW\s*/i, '')
        .replace(/\s*원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
      const isManeuners = /^마이너스/.test(cleaned);
      if (isManeuners) cleaned = cleaned.replace(/^마이너스/, '');
      const hasTrailingMinus = /\d-$/.test(cleaned);
      if (hasTrailingMinus) cleaned = cleaned.replace(/-$/, '');
      const isNeg = (cleaned.startsWith('(') && cleaned.endsWith(')')) || isManeuners || hasTrailingMinus;
      if (cleaned.startsWith('(') && cleaned.endsWith(')')) cleaned = cleaned.slice(1, -1);
      if (!cleaned.trim()) return null;
      const n = Math.round(parseFloat(cleaned));
      if (Number.isNaN(n) || !Number.isFinite(n)) return null;
      return isNeg ? -n : n;
    }

    // With the fix, group 6 captures "1,234-" which parseAmount correctly handles
    const capturedText = '1,234-';
    const amount = parseAmount(capturedText);
    expect(amount).toBe(-1234);
  });
});
