import type { BankId, ParseResult, BankAdapter } from '../types.js';
import { detectBank } from '../detect.js';
import { parseGenericCSV } from './generic.js';
import {
  hyundaiAdapter,
  kbAdapter,
  ibkAdapter,
  wooriAdapter,
  samsungAdapter,
  shinhanAdapter,
  lotteAdapter,
  hanaAdapter,
  nhAdapter,
  bcAdapter,
  kakaoAdapter,
  tossAdapter,
  kbankAdapter,
  bnkAdapter,
  dgbAdapter,
  suhyupAdapter,
  jbAdapter,
  kwangjuAdapter,
  jejuAdapter,
  scAdapter,
  mgAdapter,
  cuAdapter,
  kdbAdapter,
  epostAdapter,
} from './adapter-factory.js';

const ADAPTERS: BankAdapter[] = [
  hyundaiAdapter,
  kbAdapter,
  ibkAdapter,
  wooriAdapter,
  samsungAdapter,
  shinhanAdapter,
  lotteAdapter,
  hanaAdapter,
  nhAdapter,
  bcAdapter,
  kakaoAdapter,
  tossAdapter,
  kbankAdapter,
  bnkAdapter,
  dgbAdapter,
  suhyupAdapter,
  jbAdapter,
  kwangjuAdapter,
  jejuAdapter,
  scAdapter,
  mgAdapter,
  cuAdapter,
  kdbAdapter,
  epostAdapter,
];

export function parseCSV(content: string, bank?: BankId): ParseResult {
  // Strip UTF-8 BOM if present — Windows-generated CSV exports commonly
  // include a BOM character (U+FEFF) that causes header detection to fail
  // because indexOf('이용일') won't match '﻿이용일'. Uses explicit unicode
  // escape for robustness against source file encoding changes. Matches the
  // web-side BOM stripping in apps/web/src/lib/parser/csv.ts (C1-05).
  const cleanContent = content.replace(/^\uFEFF/, '');

  // Determine bank
  let resolvedBank: BankId | null = bank ?? null;

  if (!resolvedBank) {
    const { bank: detected } = detectBank(cleanContent);
    resolvedBank = detected;
  }

  // Try bank-specific adapter first
  if (resolvedBank) {
    const adapter = ADAPTERS.find((a) => a.bankId === resolvedBank);
    if (adapter?.parseCSV) {
      try {
        return adapter.parseCSV(cleanContent);
      } catch (err) {
        // Fall through to generic parser, but record the failure
        const fallbackResult = parseGenericCSV(cleanContent, resolvedBank);
        fallbackResult.errors.unshift({
          message: `${resolvedBank} 어댑터 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
        });
        return fallbackResult;
      }
    }
  }

  // Detect by content signature
  const signatureFailures: string[] = [];
  for (const adapter of ADAPTERS) {
    if (adapter.detect(cleanContent) && adapter.parseCSV) {
      try {
        return adapter.parseCSV(cleanContent);
      } catch (err) {
        // Track the failure so it can be reported in the result
        const msg = `${adapter.bankId} 어댑터(자동 감지) 파싱 실패: ${err instanceof Error ? err.message : String(err)}`;
        console.warn(`[cherrypicker] Bank adapter ${adapter.bankId} (detect) failed:`, err);
        signatureFailures.push(msg);
        continue;
      }
    }
  }

  // Fall back to generic parser — wrap in try/catch for defensive consistency
  // with the bank-specific adapter path above and the web-side parser (C30-02/C32-03).
  try {
    const result = parseGenericCSV(cleanContent, resolvedBank);
    // Collect any signature-detection adapter failures into the result
    for (const msg of signatureFailures) {
      result.errors.unshift({ message: msg });
    }
    return result;
  } catch (err) {
    return {
      bank: resolvedBank,
      format: 'csv',
      transactions: [],
      errors: [
        ...signatureFailures.map(msg => ({ message: msg })),
        { message: `제네릭 파서 실패: ${err instanceof Error ? err.message : String(err)}` },
      ],
    };
  }
}
