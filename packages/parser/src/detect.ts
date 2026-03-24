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
];

export function detectBank(content: string): { bank: BankId | null; confidence: number } {
  let bestMatch: BankId | null = null;
  let bestScore = 0;

  for (const sig of BANK_SIGNATURES) {
    let score = 0;
    for (const pattern of sig.patterns) {
      if (pattern.test(content)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = sig.bankId;
    }
  }

  const maxPatterns = Math.max(...BANK_SIGNATURES.map((s) => s.patterns.length));
  const confidence = bestScore > 0 ? bestScore / maxPatterns : 0;

  return { bank: bestMatch, confidence };
}

export function detectCSVDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const pipeCount = (firstLine.match(/\|/g) ?? []).length;

  if (tabCount >= commaCount && tabCount >= pipeCount) return '\t';
  if (pipeCount > commaCount) return '|';
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
