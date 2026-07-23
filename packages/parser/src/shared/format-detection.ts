export const STATEMENT_FORMAT_SNIFF_BYTES = 1024;

export type BrowserSafeStatementFormat =
  | 'csv'
  | 'xlsx'
  | 'pdf'
  | 'json'
  | 'ofx'
  | 'html';

export interface StatementFormatHint {
  format: BrowserSafeStatementFormat;
  requiresCompleteJsonValidation: boolean;
  invalidJsonFallback?: 'csv';
}

export function detectStatementFormatFromExtension(
  fileName: string,
): BrowserSafeStatementFormat | null {
  const leaf = fileName.replaceAll('\\', '/').split('/').at(-1) ?? fileName;
  const dot = leaf.lastIndexOf('.');
  const extension = dot === -1 ? '' : leaf.slice(dot).toLowerCase();
  if (extension === '.csv' || extension === '.tsv') return 'csv';
  if (extension === '.xlsx' || extension === '.xls') return 'xlsx';
  if (extension === '.pdf') return 'pdf';
  if (extension === '.json') return 'json';
  if (extension === '.ofx' || extension === '.qfx') return 'ofx';
  if (extension === '.html' || extension === '.htm') return 'html';
  return null;
}

function resolvedHint(format: BrowserSafeStatementFormat): StatementFormatHint {
  return { format, requiresCompleteJsonValidation: false };
}

export function detectStatementFormatHint(
  fileName: string,
  prefix: Uint8Array,
): StatementFormatHint {
  const extensionFormat = detectStatementFormatFromExtension(fileName);
  if (extensionFormat && extensionFormat !== 'csv') {
    return resolvedHint(extensionFormat);
  }

  const header = prefix.subarray(0, 8);
  if (
    header[0] === 0x25
    && header[1] === 0x50
    && header[2] === 0x44
    && header[3] === 0x46
  ) {
    return resolvedHint('pdf');
  }
  if (
    (header[0] === 0x50 && header[1] === 0x4b)
    || (header[0] === 0xd0 && header[1] === 0xcf)
  ) {
    return resolvedHint('xlsx');
  }

  const head = new TextDecoder('utf-8')
    .decode(prefix.subarray(0, STATEMENT_FORMAT_SNIFF_BYTES))
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (/^<\?OFX/i.test(head) || /<OFX/i.test(head)) {
    return resolvedHint('ofx');
  }
  if (
    /^<!doctype\s+html/i.test(head)
    || /^<html/i.test(head)
    || /<table[\s>]/i.test(head)
  ) {
    return resolvedHint('html');
  }
  if (head.startsWith('[') || head.startsWith('{')) {
    if (extensionFormat === 'csv') {
      return {
        format: 'json',
        requiresCompleteJsonValidation: true,
        invalidJsonFallback: 'csv',
      };
    }
    return resolvedHint('json');
  }
  if (/^<\?xml/i.test(head) && /<OFX|<BANKTRANLIST|<STMTTRN/i.test(head)) {
    return resolvedHint('ofx');
  }
  return resolvedHint('csv');
}

export function finalizeStatementFormatHint(
  hint: StatementFormatHint,
  completeBytes?: Uint8Array,
): BrowserSafeStatementFormat {
  if (!hint.requiresCompleteJsonValidation) return hint.format;
  if (!completeBytes) {
    throw new Error('Complete bytes are required to validate a JSON format hint');
  }

  try {
    JSON.parse(
      new TextDecoder('utf-8')
        .decode(completeBytes)
        .replace(/^\uFEFF/, ''),
    );
    return 'json';
  } catch {
    return hint.invalidJsonFallback ?? hint.format;
  }
}
