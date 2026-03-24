import type { BankId, ParseResult } from '../types.js';
import { detectBank } from '../detect.js';
import { parseGenericCSV } from './generic.js';
import { hyundaiAdapter } from './hyundai.js';
import { kbAdapter } from './kb.js';
import { ibkAdapter } from './ibk.js';
import { wooriAdapter } from './woori.js';
import { samsungAdapter } from './samsung.js';
import { shinhanAdapter } from './shinhan.js';
import { lotteAdapter } from './lotte.js';
import { hanaAdapter } from './hana.js';
import { nhAdapter } from './nh.js';
import { bcAdapter } from './bc.js';
import type { BankAdapter } from '../types.js';

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
];

export function parseCSV(content: string, bank?: BankId): ParseResult {
  // Determine bank
  let resolvedBank: BankId | null = bank ?? null;

  if (!resolvedBank) {
    const { bank: detected } = detectBank(content);
    resolvedBank = detected;
  }

  // Try bank-specific adapter first
  if (resolvedBank) {
    const adapter = ADAPTERS.find((a) => a.bankId === resolvedBank);
    if (adapter?.parseCSV) {
      try {
        return adapter.parseCSV(content);
      } catch (err) {
        // Fall through to generic parser
      }
    }
  }

  // Detect by content signature
  for (const adapter of ADAPTERS) {
    if (adapter.detect(content) && adapter.parseCSV) {
      try {
        return adapter.parseCSV(content);
      } catch (err) {
        // Try next
      }
    }
  }

  // Fall back to generic parser
  return parseGenericCSV(content, resolvedBank);
}
