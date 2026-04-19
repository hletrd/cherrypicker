import { readFile } from 'fs/promises';
import { extname } from 'path';
import type { BankId, DetectionResult, FileFormat } from './types.js';

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
  const confidence = bestScore > 0 ? bestScore / bestBankPatterns : 0;

  return { bank: bestMatch, confidence };
}

export function detectCSVDelimiter(content: string): string {
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  let totalComma = 0;
  let totalTab = 0;
  let totalPipe = 0;

  for (const line of lines) {
    totalComma += (line.match(/,/g) ?? []).length;
    totalTab += (line.match(/\t/g) ?? []).length;
    totalPipe += (line.match(/\|/g) ?? []).length;
  }

  if (totalComma === 0 && totalTab === 0 && totalPipe === 0) return ',';
  if (totalTab > totalComma && totalTab >= totalPipe) return '\t';
  if (totalPipe > totalComma) return '|';
  return ',';
}

export async function detectFormat(filePath: string): Promise<DetectionResult> {
  const ext = extname(filePath).toLowerCase();

  // Determine format from extension
  let format: FileFormat;
  if (ext === '.csv' || ext === '.tsv') {
    format = 'csv';
  } else if (ext === '.xlsx' || ext === '.xls') {
    format = 'xlsx';
  } else if (ext === '.pdf') {
    format = 'pdf';
  } else {
    // Try to sniff from first bytes
    const buffer = await readFile(filePath);
    const header = buffer.slice(0, 8);

    // PDF magic bytes: %PDF
    if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
      format = 'pdf';
    }
    // XLSX/ZIP magic bytes: PK (0x50 0x4B)
    else if (header[0] === 0x50 && header[1] === 0x4b) {
      format = 'xlsx';
    }
    // Legacy XLS: D0 CF 11 E0
    else if (header[0] === 0xd0 && header[1] === 0xcf) {
      format = 'xlsx';
    }
    // Default to CSV for text-like content
    else {
      format = 'csv';
    }
  }

  // For CSV/XLSX, also try to detect bank from content
  if (format === 'csv') {
    const buffer = await readFile(filePath);
    const content = buffer.toString('utf-8');
    const { bank, confidence } = detectBank(content);
    return { format, bank, confidence, encoding: 'utf-8' };
  }

  return { format, bank: null, confidence: 0 };
}
