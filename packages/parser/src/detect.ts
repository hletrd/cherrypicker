import { open, readFile } from 'fs/promises';
import { extname } from 'path';
import type { BankId, DetectionResult, FileFormat } from './types.js';
import { ParseError } from './types.js';
import { decodeTextBytes, detectTextEncoding } from './shared/encoding.js';

/** Detect text encoding from raw bytes using BOM and byte-pattern heuristics.
 *  Returns the detected encoding string suitable for TextDecoder.
 *  Order: UTF-16 LE BOM (FF FE) > UTF-16 BE BOM (FE FF) > UTF-8 BOM (EF BB BF)
 *  > CP949 byte-pattern heuristic > default UTF-8 (C7-02). */
export function detectEncoding(buffer: Buffer): string {
  return detectTextEncoding(buffer);
}

/** Decode a buffer using detected or specified encoding, stripping BOM.
 *  Handles UTF-16 LE/BE BOMs, UTF-8 BOM, and falls back to CP949 (C7-02). */
export function decodeBuffer(buffer: Buffer, encoding?: string): string {
  const detected = encoding ?? detectEncoding(buffer);
  const supported =
    detected === 'utf-16le'
    || detected === 'utf-16be'
    || detected === 'cp949'
    || detected === 'utf-8'
      ? detected
      : 'utf-8';
  return decodeTextBytes(buffer, supported);
}

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

export function detectCSVDelimiter(content: string): string {
  // Limit to first 30 lines — delimiter patterns are always visible at the top
  // and scanning the entire file is O(n) for no benefit (C1-02, matches web-side C83-05).
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

export const FILE_FORMAT_SNIFF_BYTES = 1024;

export interface FileFormatHint {
  format: FileFormat;
  requiresCompleteJsonValidation: boolean;
}

export interface FinalizedFileFormat {
  format: FileFormat;
  errors: ParseError[];
}

export function detectFormatFromExtension(filePath: string): FileFormat | null {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.csv' || ext === '.tsv') return 'csv';
  if (ext === '.xlsx' || ext === '.xls') return 'xlsx';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.json') return 'json';
  if (ext === '.ofx' || ext === '.qfx') return 'ofx';
  if (ext === '.html' || ext === '.htm') return 'html';
  return null;
}

/**
 * Determine a format from an extension and a bounded prefix. JSON-looking
 * unknown extensions require one later validation against the already-loaded
 * complete bytes so malformed JSON keeps the existing CSV fallback contract.
 */
export function detectFileFormatHint(
  filePath: string,
  prefix: Uint8Array,
): FileFormatHint {
  const extensionFormat = detectFormatFromExtension(filePath);
  if (extensionFormat) {
    return {
      format: extensionFormat,
      requiresCompleteJsonValidation: false,
    };
  }

  const header = prefix.subarray(0, 8);
  if (
    header[0] === 0x25
    && header[1] === 0x50
    && header[2] === 0x44
    && header[3] === 0x46
  ) {
    return { format: 'pdf', requiresCompleteJsonValidation: false };
  }
  if (header[0] === 0x50 && header[1] === 0x4b) {
    return { format: 'xlsx', requiresCompleteJsonValidation: false };
  }
  if (header[0] === 0xd0 && header[1] === 0xcf) {
    return { format: 'xlsx', requiresCompleteJsonValidation: false };
  }

  const head = Buffer.from(prefix.subarray(0, FILE_FORMAT_SNIFF_BYTES))
    .toString('utf-8')
    .replace(/^﻿/, '')
    .trimStart();
  if (/^<\?OFX/i.test(head)) {
    return { format: 'ofx', requiresCompleteJsonValidation: false };
  }
  if (
    /^<!doctype\s+html/i.test(head)
    || /^<html/i.test(head)
    || /<table[\s>]/i.test(head)
  ) {
    return { format: 'html', requiresCompleteJsonValidation: false };
  }
  if (head.startsWith('[') || head.startsWith('{')) {
    return { format: 'json', requiresCompleteJsonValidation: true };
  }
  if (/^<\?xml/i.test(head) && /<OFX|<BANKTRANLIST|<STMTTRN/i.test(head)) {
    return { format: 'ofx', requiresCompleteJsonValidation: false };
  }
  return { format: 'csv', requiresCompleteJsonValidation: false };
}

export function finalizeFileFormatHint(
  filePath: string,
  hint: FileFormatHint,
  completeBytes?: Uint8Array,
): FinalizedFileFormat {
  if (!hint.requiresCompleteJsonValidation) {
    return { format: hint.format, errors: [] };
  }
  if (!completeBytes) {
    throw new Error('Complete bytes are required to validate a JSON format hint');
  }

  try {
    JSON.parse(Buffer.from(completeBytes).toString('utf-8').replace(/^﻿/, ''));
    return { format: 'json', errors: [] };
  } catch (error) {
    return {
      format: 'csv',
      errors: [
        new ParseError(
          `JSON 형식이 아닙니다: ${error instanceof Error ? error.message : String(error)}`,
          { file: filePath, format: 'json' },
        ),
      ],
    };
  }
}

export async function readFilePrefix(
  filePath: string,
  maxBytes = FILE_FORMAT_SNIFF_BYTES,
): Promise<Buffer> {
  const handle = await open(filePath, 'r');
  try {
    const prefix = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(prefix, 0, maxBytes, 0);
    return prefix.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function detectFormat(filePath: string): Promise<DetectionResult> {
  const extensionFormat = detectFormatFromExtension(filePath);
  const prefix = extensionFormat
    ? Buffer.alloc(0)
    : await readFilePrefix(filePath);
  const hint = detectFileFormatHint(filePath, prefix);
  let completeBuffer: Buffer | null = null;
  if (hint.requiresCompleteJsonValidation) {
    completeBuffer = await readFile(filePath);
  }
  const { format, errors } = finalizeFileFormatHint(
    filePath,
    hint,
    completeBuffer ?? undefined,
  );

  // CSV bank and encoding detection necessarily use the complete contents.
  // This function performs one complete read at most; the statement dispatcher
  // uses the same bytes for parsing rather than invoking this I/O wrapper.
  if (format === 'csv') {
    const csvBuffer = completeBuffer ?? await readFile(filePath);
    const encoding = detectEncoding(csvBuffer);
    const content = decodeBuffer(csvBuffer, encoding);
    const { bank, confidence } = detectBank(content);
    return { format, bank, confidence, encoding, errors };
  }

  return { format, bank: null, confidence: 0, errors };
}
