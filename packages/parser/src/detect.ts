import { readFile } from 'fs/promises';
import { extname } from 'path';
import type { BankId, DetectionResult, FileFormat } from './types.js';

/** Detect text encoding from raw bytes using BOM and byte-pattern heuristics.
 *  Returns the detected encoding string suitable for TextDecoder.
 *  Order: UTF-16 LE BOM (FF FE) > UTF-16 BE BOM (FE FF) > UTF-8 BOM (EF BB BF)
 *  > CP949 byte-pattern heuristic > default UTF-8 (C7-02). */
export function detectEncoding(buffer: Buffer): string {
  if (buffer.length >= 2) {
    // UTF-16 LE BOM: FF FE
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) return 'utf-16le';
    // UTF-16 BE BOM: FE FF
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) return 'utf-16be';
  }
  // UTF-8 BOM: EF BB BF (handled by TextDecoder automatically, but we
  // explicitly return utf-8 for clarity)
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf-8';
  }
  // Byte-pattern heuristic for CP949: scan first 4KB for bytes in the
  // CP949 lead-byte range (0x80-0xFE) that are NOT valid UTF-8 multi-byte
  // lead bytes. In UTF-8, lead bytes 0xC0-0xDF start 2-byte sequences,
  // 0xE0-0xEF start 3-byte sequences, 0xF0-0xF7 start 4-byte sequences.
  // CP949 lead bytes 0x80-0xBF are NOT valid UTF-8 lead bytes, so their
  // presence (outside of UTF-8 continuation byte context) signals CP949.
  const scanLen = Math.min(buffer.length, 4096);
  let cp949SignalBytes = 0;
  for (let i = 0; i < scanLen; i++) {
    const b = buffer[i]!;
    // Bytes 0x80-0xBF that are NOT UTF-8 continuation bytes in context
    // (i.e., they follow an ASCII byte or another 0x80-0xBF byte)
    if (b >= 0x80 && b <= 0xBF) {
      const prev = i > 0 ? buffer[i - 1]! : 0;
      // If previous byte is ASCII (< 0x80), this 0x80-0xBF byte cannot be
      // a UTF-8 continuation byte (which requires a lead byte 0xC0+)
      if (prev < 0x80) {
        cp949SignalBytes++;
      }
    }
  }
  // If more than 5 non-continuation high-bytes per KB, likely CP949
  if (cp949SignalBytes > 0 && (cp949SignalBytes / (scanLen / 1024)) > 5) {
    return 'cp949';
  }
  return 'utf-8';
}

/** Decode a buffer using detected or specified encoding, stripping BOM.
 *  Handles UTF-16 LE/BE BOMs, UTF-8 BOM, and falls back to CP949 (C7-02). */
export function decodeBuffer(buffer: Buffer, encoding?: string): string {
  const enc = encoding ?? detectEncoding(buffer);
  let decoder: TextDecoder;
  // UTF-16 decoders should ignore BOM (fatal:false is default)
  if (enc === 'utf-16le' || enc === 'utf-16be') {
    decoder = new TextDecoder(enc);
  } else if (enc === 'cp949') {
    decoder = new TextDecoder('cp949');
  } else {
    decoder = new TextDecoder('utf-8');
  }
  const decoded = decoder.decode(buffer);
  // Strip BOM if present (covers UTF-8 BOM and any residual UTF-16 BOM)
  return decoded.replace(/^﻿/, '');
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

export async function detectFormat(filePath: string): Promise<DetectionResult> {
  const ext = extname(filePath).toLowerCase();

  // Determine format from extension
  let format: FileFormat;
  let sniffBuffer: Buffer | null = null;

  if (ext === '.csv' || ext === '.tsv') {
    format = 'csv';
  } else if (ext === '.xlsx' || ext === '.xls') {
    format = 'xlsx';
  } else if (ext === '.pdf') {
    format = 'pdf';
  } else {
    // Try to sniff from first bytes
    sniffBuffer = await readFile(filePath);
    const header = sniffBuffer.slice(0, 8);

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

  // For CSV, detect bank from content. Reuse the already-read buffer when
  // available (from the unknown-extension sniff path) to avoid reading the
  // file a second time (C5-02). Detect encoding and decode accordingly
  // before bank detection so that CP949/UTF-16 Korean text is correctly
  // interpreted (C7-02/C7-03). Strip BOM before bank detection so that
  // patterns anchored to content start match correctly (C6-02).
  if (format === 'csv') {
    const csvBuffer = sniffBuffer ?? await readFile(filePath);
    const encoding = detectEncoding(csvBuffer);
    const content = decodeBuffer(csvBuffer, encoding);
    const { bank, confidence } = detectBank(content);
    return { format, bank, confidence, encoding };
  }

  return { format, bank: null, confidence: 0 };
}
