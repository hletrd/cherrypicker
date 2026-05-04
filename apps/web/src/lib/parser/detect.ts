import type { BankId } from './types.js';

interface BankSignature {
  bankId: BankId;
  patterns: RegExp[];
}

const BANK_SIGNATURES: BankSignature[] = [
  {
    bankId: 'hyundai',
    patterns: [/현대카드/, /HYUNDAICARD/, /hdcard/i],
  },
  {
    bankId: 'kb',
    patterns: [/KB국민카드/, /국민카드/, /kbcard/i],
  },
  {
    bankId: 'ibk',
    patterns: [/IBK기업은행/, /기업은행/],
  },
  {
    bankId: 'woori',
    patterns: [/우리카드/, /wooricard/i],
  },
  {
    bankId: 'samsung',
    patterns: [/삼성카드/, /SAMSUNG\s*CARD/i],
  },
  {
    bankId: 'shinhan',
    patterns: [/신한카드/, /SHINHAN/i],
  },
  {
    bankId: 'lotte',
    patterns: [/롯데카드/, /LOTTE\s*CARD/i],
  },
  {
    bankId: 'hana',
    patterns: [/하나카드/, /HANA\s*CARD/i],
  },
  {
    bankId: 'nh',
    patterns: [/NH농협/, /농협카드/],
  },
  {
    bankId: 'bc',
    patterns: [/BC카드/, /비씨카드/],
  },
  {
    bankId: 'kakao',
    patterns: [/카카오뱅크/, /kakaobank/i],
  },
  {
    bankId: 'toss',
    patterns: [/토스뱅크/, /tossbank/i],
  },
  {
    bankId: 'kbank',
    patterns: [/케이뱅크/, /K뱅크/, /kbank/i],
  },
  {
    bankId: 'bnk',
    patterns: [/BNK부산은행/, /BNK경남은행/, /부산은행/, /경남은행/],
  },
  {
    bankId: 'dgb',
    patterns: [/DGB대구은행/, /iM뱅크/, /대구은행/],
  },
  {
    bankId: 'suhyup',
    patterns: [/수협/, /Sh수협/, /suhyup/i],
  },
  {
    bankId: 'jb',
    patterns: [/전북은행/, /jbbank/i],
  },
  {
    bankId: 'kwangju',
    patterns: [/광주은행/, /kjbank/i],
  },
  {
    bankId: 'jeju',
    patterns: [/제주은행/, /jejubank/i],
  },
  {
    bankId: 'sc',
    patterns: [/SC제일/, /스탠다드차타드/, /scbank/i],
  },
  {
    bankId: 'mg',
    patterns: [/MG새마을금고/, /새마을금고/, /kfcc/i],
  },
  {
    bankId: 'cu',
    patterns: [/신협/],
  },
  {
    bankId: 'kdb',
    patterns: [/KDB산업은행/, /산업은행/, /kdbbank/i],
  },
  {
    bankId: 'epost',
    patterns: [/우체국/, /우정사업/, /epost/i],
  },
];

export function detectFormatFromFile(file: File): 'csv' | 'xlsx' | 'pdf' {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  return 'csv'; // default
}

/**
 * Detect which bank issued a statement based on keyword signatures.
 *
 * @param content - Full text content of the statement
 * @returns The detected bank ID and confidence score (0–1)
 *
 * Tie-breaking: When multiple banks have the same match count (score),
 * the bank that appears first in BANK_SIGNATURES wins. This means banks
 * with more specific patterns (more entries in the patterns array) are
 * naturally more likely to match multiple patterns and win ties. Banks
 * with only a single generic pattern (e.g., cu/신협) can score 1.0
 * confidence on a single match, which may be misleading — see D-65.
 */
export function detectBank(content: string): { bank: BankId | null; confidence: number } {
  let bestMatch: BankId | null = null;
  let bestScore = 0;
  let bestBank: BankSignature | null = null;

  for (const sig of BANK_SIGNATURES) {
    let score = 0;
    for (const pattern of sig.patterns) {
      // Reset lastIndex defensively — if a pattern ever uses the /g flag,
      // .test() would advance lastIndex on each call, causing subsequent
      // calls to start from the wrong position. Resetting is a no-op for
      // non-global regexes but prevents silent breakage with /g.
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = sig.bankId;
      bestBank = sig;
    }
  }

  const bestBankPatterns = bestBank ? bestBank.patterns.length : 1;
  let confidence = bestScore > 0 ? bestScore / bestBankPatterns : 0;

  // Cap confidence for single-pattern banks (C70-01). Banks with only one
  // generic pattern (e.g., cu/신협, kdb/산업은행) achieve 1.0 confidence on
  // a single match, which can cause false-positive bank detection when the
  // keyword appears in transaction text rather than statement headers.
  // Limiting to 0.5 ensures multi-pattern banks with higher scores win ties.
  if (bestBank && bestBank.patterns.length < 2 && bestScore < 2) {
    confidence = Math.min(confidence, 0.5);
  }

  return { bank: bestMatch, confidence };
}

export function detectBankFromText(content: string): BankId | null {
  const { bank } = detectBank(content);
  return bank;
}

export function detectCSVDelimiter(content: string): string {
  // Sample first 30 lines for delimiter detection -- the delimiter pattern
  // is consistent throughout a file, so scanning all lines is unnecessary
  // and slow for large files (C83-05). Matches the 30-line header scan limit.
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).slice(0, 30);

  let totalComma = 0;
  let totalTab = 0;
  let totalPipe = 0;
  let totalSemicolon = 0;

  for (const line of lines) {
    totalComma += (line.match(/,/g) ?? []).length;
    totalTab += (line.match(/\t/g) ?? []).length;
    totalPipe += (line.match(/\|/g) ?? []).length;
    totalSemicolon += (line.match(/;/g) ?? []).length;
  }

  if (totalComma === 0 && totalTab === 0 && totalPipe === 0 && totalSemicolon === 0) return ',';
  if (totalTab > totalComma && totalTab >= totalPipe && totalTab >= totalSemicolon) return '\t';
  if (totalPipe > totalComma && totalPipe >= totalSemicolon) return '|';
  if (totalSemicolon > totalComma) return ';';
  return ',';
}
