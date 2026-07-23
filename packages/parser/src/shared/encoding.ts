export type SupportedTextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'cp949';
export type StatementTextFormat = 'json' | 'ofx' | 'html';

export class UnsupportedTextEncodingError extends Error {
  readonly code = 'UNSUPPORTED_TEXT_ENCODING';
  readonly encoding: string;
  readonly format: StatementTextFormat;

  constructor(format: StatementTextFormat, encoding: string) {
    super(
      `${format.toUpperCase()} text encoding is unsupported: ${encoding}. `
      + 'Use UTF-8, BOM-marked UTF-16, or CP949 where the format permits it.',
    );
    this.name = 'UnsupportedTextEncodingError';
    this.encoding = encoding;
    this.format = format;
  }
}

function tryDecodeUTF8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .replace(/^﻿/, '');
  } catch {
    return null;
  }
}

function isValidUTF8(bytes: Uint8Array): boolean {
  return tryDecodeUTF8(bytes) !== null;
}

/**
 * CP949 uses 0x81-0xFE lead bytes followed by one of three trail ranges.
 * Only classify bytes as CP949 when every non-ASCII byte participates in a
 * valid pair. This avoids treating UTF-8 continuation bytes in valid
 * multibyte sequences as an encoding signal.
 */
function isPlausibleCP949(bytes: Uint8Array): boolean {
  let pairs = 0;
  for (let i = 0; i < bytes.length; i++) {
    const lead = bytes[i]!;
    if (lead < 0x80) continue;
    if (lead < 0x81 || lead > 0xFE || i + 1 >= bytes.length) return false;
    const trail = bytes[++i]!;
    const validTrail =
      (trail >= 0x41 && trail <= 0x5A)
      || (trail >= 0x61 && trail <= 0x7A)
      || (trail >= 0x81 && trail <= 0xFE);
    if (!validTrail) return false;
    pairs++;
  }
  return pairs > 0;
}

function detectBOMEncoding(bytes: Uint8Array): SupportedTextEncoding | null {
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return 'utf-16le';
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return 'utf-16be';
  if (
    bytes.length >= 3
    && bytes[0] === 0xEF
    && bytes[1] === 0xBB
    && bytes[2] === 0xBF
  ) return 'utf-8';
  return null;
}

function detectUnsupportedBOM(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 4
    && bytes[0] === 0xFF
    && bytes[1] === 0xFE
    && bytes[2] === 0x00
    && bytes[3] === 0x00
  ) return 'utf-32le';
  if (
    bytes.length >= 4
    && bytes[0] === 0x00
    && bytes[1] === 0x00
    && bytes[2] === 0xFE
    && bytes[3] === 0xFF
  ) return 'utf-32be';
  return null;
}

function asciiByteView(bytes: Uint8Array, maxBytes = 8_192): string {
  let result = '';
  const limit = Math.min(bytes.length, maxBytes);
  for (let index = 0; index < limit; index++) {
    const byte = bytes[index]!;
    result += byte < 0x80 ? String.fromCharCode(byte) : ' ';
  }
  return result;
}

function normalizeEncodingLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveEncodingLabel(label: string): SupportedTextEncoding | null {
  switch (normalizeEncodingLabel(label)) {
    case 'utf8':
    case 'unicode11utf8':
    case 'ascii':
    case 'usascii':
      return 'utf-8';
    case 'utf16':
    case 'utf16le':
    case 'unicode':
      return 'utf-16le';
    case 'utf16be':
      return 'utf-16be';
    case 'cp949':
    case '949':
    case 'ms949':
    case 'windows949':
    case 'uhc':
    case 'euckr':
    case 'ksc5601':
    case 'ksc56011987':
      return 'cp949';
    default:
      return null;
  }
}

function declaredOFXEncoding(bytes: Uint8Array): {
  encoding: SupportedTextEncoding | null;
  unsupportedLabel: string | null;
} {
  const header = asciiByteView(bytes);
  const xmlLabel = header.match(/<\?xml[^>]*\bencoding\s*=\s*["']([^"']+)["']/i)?.[1];
  const encodingLabel = header.match(/(?:^|[\r\n])\s*ENCODING\s*:\s*([^\r\n]+)/i)?.[1];
  const charsetLabel = header.match(/(?:^|[\r\n])\s*CHARSET\s*:\s*([^\r\n]+)/i)?.[1];

  if (xmlLabel) {
    return {
      encoding: resolveEncodingLabel(xmlLabel),
      unsupportedLabel: resolveEncodingLabel(xmlLabel) ? null : xmlLabel.trim(),
    };
  }

  // OFX 1.x commonly declares ENCODING:USASCII plus a more specific
  // CHARSET. Prefer a supported CHARSET (notably 949) over the generic
  // container label.
  if (charsetLabel) {
    const charsetEncoding = resolveEncodingLabel(charsetLabel);
    if (charsetEncoding) {
      return { encoding: charsetEncoding, unsupportedLabel: null };
    }
  }
  if (encodingLabel) {
    const encoding = resolveEncodingLabel(encodingLabel);
    if (encoding) return { encoding, unsupportedLabel: null };
  }

  const unsupportedLabel = charsetLabel ?? encodingLabel;
  return {
    encoding: null,
    unsupportedLabel: unsupportedLabel?.trim() || null,
  };
}

function declaredHTMLEncoding(bytes: Uint8Array): {
  encoding: SupportedTextEncoding | null;
  unsupportedLabel: string | null;
} {
  const head = asciiByteView(bytes);
  const charsetLabel =
    head.match(/<meta\b[^>]*\bcharset\s*=\s*["']?\s*([^"'\s/>;]+)/i)?.[1]
    ?? head.match(
      /<meta\b[^>]*\bcontent\s*=\s*["'][^"']*\bcharset\s*=\s*([^"'\s;>]+)/i,
    )?.[1];
  if (!charsetLabel) return { encoding: null, unsupportedLabel: null };
  const encoding = resolveEncodingLabel(charsetLabel);
  return {
    encoding,
    unsupportedLabel: encoding ? null : charsetLabel.trim(),
  };
}

function containsOnlyASCII(bytes: Uint8Array): boolean {
  for (const byte of bytes) {
    if (byte >= 0x80) return false;
  }
  return true;
}

function detectBOMlessUTF16(
  bytes: Uint8Array,
): 'utf-16le' | 'utf-16be' | null {
  const pairCount = Math.floor(Math.min(bytes.length, 512) / 2);
  if (pairCount < 4) return null;

  let evenNuls = 0;
  let oddNuls = 0;
  for (let index = 0; index < pairCount * 2; index += 2) {
    if (bytes[index] === 0) evenNuls++;
    if (bytes[index + 1] === 0) oddNuls++;
  }

  const dominantThreshold = Math.ceil(pairCount * 0.6);
  const sparseThreshold = Math.floor(pairCount * 0.1);
  if (oddNuls >= dominantThreshold && evenNuls <= sparseThreshold) {
    return 'utf-16le';
  }
  if (evenNuls >= dominantThreshold && oddNuls <= sparseThreshold) {
    return 'utf-16be';
  }
  return null;
}

export function detectStatementTextEncoding(
  bytes: Uint8Array,
  format: StatementTextFormat,
): SupportedTextEncoding {
  return detectAndDecodeStatementTextBytes(bytes, format).encoding;
}

export interface StatementTextDecodeResult {
  encoding: SupportedTextEncoding;
  text: string;
}

/**
 * Resolve a statement encoding and decode the payload as one operation.
 *
 * The common UTF-8 path uses its fatal validation decode as the returned
 * string, avoiding a second validation pass and a third whole-input decode.
 */
export function detectAndDecodeStatementTextBytes(
  bytes: Uint8Array,
  format: StatementTextFormat,
): StatementTextDecodeResult {
  const unsupportedBOM = detectUnsupportedBOM(bytes);
  if (unsupportedBOM) {
    throw new UnsupportedTextEncodingError(format, unsupportedBOM);
  }
  const bomEncoding = detectBOMEncoding(bytes);
  if (bomEncoding) {
    if (bomEncoding === 'utf-8') {
      const text = tryDecodeUTF8(bytes);
      if (text === null) {
        throw new UnsupportedTextEncodingError(format, 'invalid UTF-8');
      }
      return { encoding: bomEncoding, text };
    }
    return {
      encoding: bomEncoding,
      text: decodeTextBytes(bytes, bomEncoding),
    };
  }
  const bomlessUTF16 = detectBOMlessUTF16(bytes);
  if (bomlessUTF16) {
    throw new UnsupportedTextEncodingError(format, bomlessUTF16);
  }

  if (format === 'json') {
    const text = tryDecodeUTF8(bytes);
    if (text !== null) return { encoding: 'utf-8', text };
    const detected = isPlausibleCP949(bytes) ? 'cp949' : 'unknown';
    throw new UnsupportedTextEncodingError(format, detected);
  }

  const declaration = format === 'ofx'
    ? declaredOFXEncoding(bytes)
    : declaredHTMLEncoding(bytes);
  if (
    declaration.encoding === 'utf-16le'
    || declaration.encoding === 'utf-16be'
  ) {
    throw new UnsupportedTextEncodingError(format, declaration.encoding);
  }
  if (declaration.encoding === 'utf-8') {
    const text = tryDecodeUTF8(bytes);
    if (text === null) {
      throw new UnsupportedTextEncodingError(format, 'invalid UTF-8');
    }
    return { encoding: declaration.encoding, text };
  }
  if (declaration.encoding === 'cp949') {
    return {
      encoding: declaration.encoding,
      text: decodeTextBytes(bytes, declaration.encoding),
    };
  }
  if (declaration.unsupportedLabel && !containsOnlyASCII(bytes)) {
    throw new UnsupportedTextEncodingError(format, declaration.unsupportedLabel);
  }

  const utf8Text = tryDecodeUTF8(bytes);
  if (utf8Text !== null) {
    return { encoding: 'utf-8', text: utf8Text };
  }
  if (isPlausibleCP949(bytes)) {
    return {
      encoding: 'cp949',
      text: decodeTextBytes(bytes, 'cp949'),
    };
  }
  throw new UnsupportedTextEncodingError(format, 'invalid UTF-8');
}

export function detectTextEncoding(bytes: Uint8Array): SupportedTextEncoding {
  const bomEncoding = detectBOMEncoding(bytes);
  if (bomEncoding) return bomEncoding;

  if (isValidUTF8(bytes)) return 'utf-8';
  return isPlausibleCP949(bytes) ? 'cp949' : 'utf-8';
}

export function decodeTextBytes(
  bytes: Uint8Array,
  encoding: SupportedTextEncoding = detectTextEncoding(bytes),
): string {
  // WHATWG exposes the CP949-compatible decoder under the canonical
  // "euc-kr" label. Bun 1.2.x does not ship that decoder, so server-side
  // consumers use iconv-lite while real browsers keep the native path.
  const decoderLabel = encoding === 'cp949' ? 'euc-kr' : encoding;
  try {
    return new TextDecoder(decoderLabel).decode(bytes).replace(/^﻿/, '');
  } catch (error) {
    if (encoding !== 'cp949') throw error;

    type RuntimeRequire = (specifier: string) => unknown;
    type RuntimeBuffer = {
      from(input: Uint8Array): Uint8Array;
    };
    type IconvLite = {
      decode(input: Uint8Array, targetEncoding: string): string;
    };
    const runtime = globalThis as typeof globalThis & {
      require?: RuntimeRequire;
      Buffer?: RuntimeBuffer;
    };
    const moduleRuntime = import.meta as ImportMeta & {
      require?: RuntimeRequire;
    };
    const runtimeRequire = moduleRuntime.require ?? runtime.require;
    if (!runtimeRequire || !runtime.Buffer) {
      throw new Error(
        'This runtime cannot decode CP949 text. Use a browser with the WHATWG euc-kr decoder.',
        { cause: error },
      );
    }
    const iconv = runtimeRequire('iconv-lite') as IconvLite;
    return iconv.decode(runtime.Buffer.from(bytes), 'cp949').replace(/^﻿/, '');
  }
}

export function decodeStatementTextBytes(
  bytes: Uint8Array,
  format: StatementTextFormat,
): string {
  return detectAndDecodeStatementTextBytes(bytes, format).text;
}
