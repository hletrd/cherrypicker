import { describe, expect, test } from 'bun:test';
import {
  assertConnectedAddress,
  buildIssuerNetworkPolicy,
  isPublicIpAddress,
  parseAllowedHosts,
  resolveValidatedTarget,
  validateTargetUrl,
} from '../src/network-policy.js';

const PUBLIC_V4 = { address: '93.184.216.34', family: 4 as const };
const PUBLIC_V6 = { address: '2606:4700:4700::1111', family: 6 as const };

describe('scraper network policy', () => {
  test('derives exact configured hosts and constrains URL overrides', () => {
    const target = {
      baseUrl: 'https://card.example.com/',
      cardListUrl: 'https://products.example.com/cards',
      allowedHosts: ['redirect.example.com'],
    };
    expect(
      buildIssuerNetworkPolicy(target, undefined, []).allowedHosts,
    ).toEqual([
      'card.example.com',
      'products.example.com',
      'redirect.example.com',
    ]);
    expect(() =>
      buildIssuerNetworkPolicy(
        target,
        'https://off-policy.example.test/card',
        [],
      ),
    ).toThrow('허용되지 않은');
    expect(
      buildIssuerNetworkPolicy(
        target,
        'https://extra.example.com/card',
        ['EXTRA.EXAMPLE.COM.'],
      ),
    ).toEqual({
      url: 'https://extra.example.com/card',
      allowedHosts: [
        'card.example.com',
        'products.example.com',
        'redirect.example.com',
        'extra.example.com',
      ],
    });
  });

  test('accepts representative public IPv4 and IPv6 addresses', () => {
    expect(isPublicIpAddress(PUBLIC_V4.address)).toBe(true);
    expect(isPublicIpAddress(PUBLIC_V6.address)).toBe(true);
  });

  test('rejects private, metadata, reserved, and mapped addresses', () => {
    for (const address of [
      '0.0.0.0',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.0.0.8',
      '192.168.1.1',
      '192.0.2.1',
      '198.18.0.1',
      '198.51.100.1',
      '203.0.113.1',
      '224.0.0.1',
      '240.0.0.1',
      '::',
      '::1',
      'fc00::1',
      'fe80::1',
      'fec0::1',
      '2001:2::1',
      '2001:db8::1',
      '2002::1',
      '3fff::1',
      '::ffff:127.0.0.1',
      '::ffff:192.168.1.1',
    ]) {
      expect(isPublicIpAddress(address)).toBe(false);
    }
  });

  test('requires HTTP(S), no credentials, and an exact allowed host', () => {
    const allowed = parseAllowedHosts(['card.example.com']);
    expect(validateTargetUrl('https://card.example.com/product', allowed).hostname)
      .toBe('card.example.com');
    expect(() => validateTargetUrl('file:///etc/passwd', allowed)).toThrow('HTTP(S)');
    expect(() => validateTargetUrl('ftp://card.example.com/product', allowed)).toThrow('HTTP(S)');
    expect(() => validateTargetUrl('https://[::1', allowed)).toThrow('유효하지 않은 URL');
    expect(() =>
      validateTargetUrl('https://user:secret@card.example.com/product', allowed),
    ).toThrow('사용자 이름');
    expect(() =>
      validateTargetUrl('https://evil-card.example.com/product', allowed),
    ).toThrow('허용되지 않은');
    expect(() =>
      validateTargetUrl('https://card.example.com.evil.test/product', allowed),
    ).toThrow('허용되지 않은');
    expect(() =>
      validateTargetUrl('https://card.example.com.evil.test./product', allowed),
    ).toThrow('허용되지 않은');
    expect(
      validateTargetUrl(
        'https://CARD.EXAMPLE.COM./product',
        parseAllowedHosts(['card.example.com']),
      ).hostname,
    ).toBe('card.example.com');
  });

  test('rejects a mixed public/private DNS answer set', async () => {
    const allowed = parseAllowedHosts(['card.example.com']);
    await expect(
      resolveValidatedTarget(
        'https://card.example.com/product',
        allowed,
        async () => [PUBLIC_V4, { address: '10.0.0.5', family: 4 }],
      ),
    ).rejects.toThrow('공개 네트워크가 아닌');
  });

  test('rejects empty, failed, and family-mismatched DNS answers', async () => {
    const allowed = parseAllowedHosts(['card.example.com']);
    await expect(
      resolveValidatedTarget(
        'https://card.example.com/product',
        allowed,
        async () => [],
      ),
    ).rejects.toThrow('IP 주소를 찾을 수 없습니다');
    await expect(
      resolveValidatedTarget(
        'https://card.example.com/product',
        allowed,
        async () => {
          throw new Error('DNS failed');
        },
      ),
    ).rejects.toThrow('DNS failed');
    await expect(
      resolveValidatedTarget(
        'https://card.example.com/product',
        allowed,
        async () => [{ address: PUBLIC_V4.address, family: 6 }],
      ),
    ).rejects.toThrow('패밀리가 일치하지 않습니다');
  });

  test('rejects literal private targets even when the host is explicitly allowed', async () => {
    const allowed = parseAllowedHosts(['127.0.0.1']);
    await expect(
      resolveValidatedTarget(
        'http://127.0.0.1/admin',
        allowed,
      ),
    ).rejects.toThrow('공개 네트워크가 아닌');
  });

  test('pins the connected socket to the validated DNS answer', async () => {
    const allowed = parseAllowedHosts(['card.example.com']);
    const target = await resolveValidatedTarget(
      'https://card.example.com/product',
      allowed,
      async () => [PUBLIC_V4],
    );

    expect(() => assertConnectedAddress(PUBLIC_V4.address, target)).not.toThrow();
    expect(() => assertConnectedAddress('10.0.0.5', target)).toThrow('안전하지 않은');
    expect(() => assertConnectedAddress('8.8.8.8', target)).toThrow('DNS 응답과 다릅니다');
  });
});
