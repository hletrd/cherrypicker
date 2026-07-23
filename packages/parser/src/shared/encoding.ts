export type SupportedTextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'cp949';

function isValidUTF8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
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

export function detectTextEncoding(bytes: Uint8Array): SupportedTextEncoding {
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return 'utf-16le';
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return 'utf-16be';
  if (
    bytes.length >= 3
    && bytes[0] === 0xEF
    && bytes[1] === 0xBB
    && bytes[2] === 0xBF
  ) return 'utf-8';

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
