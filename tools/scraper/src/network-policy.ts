import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type DnsResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export interface ValidatedTarget {
  url: URL;
  hostname: string;
  addresses: readonly ResolvedAddress[];
  canonicalAddresses: ReadonlySet<string>;
}

export interface IssuerNetworkTarget {
  baseUrl: string;
  cardListUrl?: string;
  allowedHosts?: readonly string[];
}

export interface IssuerNetworkPolicy {
  url: string;
  allowedHosts: readonly string[];
}

function stripIpv6Brackets(value: string): string {
  return value.startsWith('[') && value.endsWith(']')
    ? value.slice(1, -1)
    : value;
}

function parseIpv4(address: string): [number, number, number, number] | undefined {
  if (isIP(address) !== 4) return undefined;
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
    return undefined;
  }
  return octets as [number, number, number, number];
}

function expandIpv6(address: string): number[] | undefined {
  let value = stripIpv6Brackets(address).toLowerCase();
  const zoneIndex = value.indexOf('%');
  if (zoneIndex !== -1) value = value.slice(0, zoneIndex);

  const ipv4Match = value.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (ipv4Match) {
    const ipv4 = parseIpv4(ipv4Match[1]!);
    if (!ipv4) return undefined;
    const high = (ipv4[0] << 8) | ipv4[1];
    const low = (ipv4[2] << 8) | ipv4[3];
    value = `${value.slice(0, -ipv4Match[1]!.length)}${high.toString(16)}:${low.toString(16)}`;
  }

  const pieces = value.split('::');
  if (pieces.length > 2) return undefined;
  const parseSide = (side: string): number[] | undefined => {
    if (side === '') return [];
    const words = side.split(':').map((word) => Number.parseInt(word, 16));
    if (words.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffff)) {
      return undefined;
    }
    return words;
  };

  const head = parseSide(pieces[0] ?? '');
  const tail = parseSide(pieces[1] ?? '');
  if (!head || !tail) return undefined;
  if (pieces.length === 1) return head.length === 8 ? head : undefined;

  const missing = 8 - head.length - tail.length;
  if (missing < 1) return undefined;
  return [...head, ...Array.from({ length: missing }, () => 0), ...tail];
}

function ipv4FromWords(high: number, low: number): string {
  return [
    high >> 8,
    high & 0xff,
    low >> 8,
    low & 0xff,
  ].join('.');
}

function isPublicIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return false;
  const [a, b, c] = octets;

  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  const words = expandIpv6(address);
  if (!words || words.length !== 8) return false;

  const allZeroPrefix = words.slice(0, 6).every((word) => word === 0);
  if (allZeroPrefix) {
    if (words[6] === 0 && (words[7] === 0 || words[7] === 1)) return false;
    return isPublicIpv4(ipv4FromWords(words[6]!, words[7]!));
  }
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    return isPublicIpv4(ipv4FromWords(words[6]!, words[7]!));
  }

  const first = words[0]!;
  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80) return false;
  if ((first & 0xffc0) === 0xfec0) return false;
  if ((first & 0xff00) === 0xff00) return false;
  if (first === 0x2001 && words[1] === 0x0db8) return false;
  if (first === 0x2001 && words[1] === 0) return false;
  if (first === 0x2001 && words[1] === 2 && words[2] === 0) return false;
  if (first === 0x2001 && (words[1] & 0xfff0) === 0x0010) return false;
  if (first === 0x2001 && (words[1] & 0xfff0) === 0x0020) return false;
  if (first === 0x2002) return false;
  if (first === 0x3fff && (words[1] & 0xf000) === 0) return false;

  // Current globally routable unicast allocations are within 2000::/3.
  return (first & 0xe000) === 0x2000;
}

export function isPublicIpAddress(address: string): boolean {
  const normalized = stripIpv6Brackets(address);
  const family = isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family === 6) return isPublicIpv6(normalized);
  return false;
}

export function canonicalizeIpAddress(address: string): string {
  const normalized = stripIpv6Brackets(address);
  if (isIP(normalized) === 4) return normalized;
  const words = expandIpv6(normalized);
  if (!words) throw new Error(`유효하지 않은 IP 주소입니다: ${address}`);
  if (
    words.slice(0, 5).every((word) => word === 0) &&
    (words[5] === 0 || words[5] === 0xffff)
  ) {
    return ipv4FromWords(words[6]!, words[7]!);
  }
  return words.map((word) => word.toString(16).padStart(4, '0')).join(':');
}

export function normalizeHostname(value: string): string {
  if (
    value === '' ||
    value !== value.trim() ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    value.includes('/') ||
    value.includes('@')
  ) {
    throw new Error(`유효하지 않은 호스트입니다: "${value}"`);
  }

  const unwrapped = stripIpv6Brackets(value);
  if (isIP(unwrapped) !== 0) return canonicalizeIpAddress(unwrapped);
  if (unwrapped.includes(':')) {
    throw new Error(`호스트에는 포트를 포함할 수 없습니다: "${value}"`);
  }

  const withoutTrailingDot = unwrapped.endsWith('.')
    ? unwrapped.slice(0, -1)
    : unwrapped;
  const ascii = domainToASCII(withoutTrailingDot).toLowerCase();
  if (
    ascii === '' ||
    ascii.length > 253 ||
    ascii.split('.').some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    throw new Error(`유효하지 않은 호스트입니다: "${value}"`);
  }
  return ascii;
}

export function parseAllowedHosts(values: readonly string[]): ReadonlySet<string> {
  const hosts = new Set(values.map(normalizeHostname));
  if (hosts.size === 0) {
    throw new Error('스크래퍼 네트워크 허용 호스트가 비어 있습니다.');
  }
  return hosts;
}

export function validateTargetUrl(
  value: string,
  allowedHosts: ReadonlySet<string>,
): { url: URL; hostname: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('유효하지 않은 URL입니다.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`HTTP(S) URL만 사용할 수 있습니다: "${url.protocol}"`);
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('URL에 사용자 이름이나 비밀번호를 포함할 수 없습니다.');
  }

  const hostname = normalizeHostname(url.hostname);
  if (!allowedHosts.has(hostname)) {
    throw new Error(`허용되지 않은 스크래퍼 호스트입니다: "${hostname}"`);
  }
  return { url, hostname };
}

export function buildIssuerNetworkPolicy(
  target: IssuerNetworkTarget,
  urlOverride: string | undefined,
  requestedAllowedHosts: readonly string[],
): IssuerNetworkPolicy {
  const configuredUrls = [target.baseUrl, target.cardListUrl].filter(
    (value): value is string => value !== undefined,
  );
  const configuredHosts = configuredUrls.map((value) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('카드사 네트워크 설정에 유효하지 않은 URL이 있습니다.');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('카드사 네트워크 설정에는 HTTP(S) URL만 사용할 수 있습니다.');
    }
    if (parsed.username !== '' || parsed.password !== '') {
      throw new Error('카드사 네트워크 설정 URL에는 자격 증명을 포함할 수 없습니다.');
    }
    return normalizeHostname(parsed.hostname);
  });
  const allowedHosts = parseAllowedHosts([
    ...configuredHosts,
    ...(target.allowedHosts ?? []),
    ...requestedAllowedHosts,
  ]);
  const selected = validateTargetUrl(
    urlOverride ?? target.baseUrl,
    allowedHosts,
  );

  return {
    url: selected.url.href,
    allowedHosts: [...allowedHosts],
  };
}

export const defaultDnsResolver: DnsResolver = async (hostname) => {
  if (isIP(hostname) !== 0) {
    return [{ address: hostname, family: isIP(hostname) as 4 | 6 }];
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address, family }) => ({
    address,
    family: family as 4 | 6,
  }));
};

export async function resolveValidatedTarget(
  value: string,
  allowedHosts: ReadonlySet<string>,
  resolver: DnsResolver = defaultDnsResolver,
): Promise<ValidatedTarget> {
  const { url, hostname } = validateTargetUrl(value, allowedHosts);
  const addresses = await resolver(hostname);
  if (addresses.length === 0) {
    throw new Error(`호스트의 IP 주소를 찾을 수 없습니다: "${hostname}"`);
  }

  const canonicalAddresses = new Set<string>();
  for (const entry of addresses) {
    if (!isPublicIpAddress(entry.address)) {
      throw new Error(`공개 네트워크가 아닌 IP 주소는 요청할 수 없습니다: ${entry.address}`);
    }
    const actualFamily = isIP(stripIpv6Brackets(entry.address));
    if (actualFamily !== entry.family) {
      throw new Error(`DNS 주소 패밀리가 일치하지 않습니다: ${entry.address}`);
    }
    canonicalAddresses.add(canonicalizeIpAddress(entry.address));
  }

  return {
    url,
    hostname,
    addresses,
    canonicalAddresses,
  };
}

export function assertConnectedAddress(
  connectedAddress: string | undefined,
  target: ValidatedTarget,
): void {
  if (!connectedAddress || !isPublicIpAddress(connectedAddress)) {
    throw new Error(`안전하지 않은 연결 대상 IP입니다: ${connectedAddress ?? 'unknown'}`);
  }
  const canonical = canonicalizeIpAddress(connectedAddress);
  if (!target.canonicalAddresses.has(canonical)) {
    throw new Error(
      `연결 대상 IP가 검증된 DNS 응답과 다릅니다: ${connectedAddress}`,
    );
  }
}
