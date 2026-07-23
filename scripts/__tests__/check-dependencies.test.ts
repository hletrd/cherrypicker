import { describe, expect, test } from 'bun:test';
import {
  checkDependencies,
  digest,
  findPeerDependencyMismatches,
  findPeerDependencyMismatchesInLock,
  findRemoteDependencyReferences,
  findUndeclaredProductionImports,
  findVendorDigestMismatches,
  findVendorReferenceMismatches,
} from '../check-dependencies.js';

const EXPECTED_XLSX_SHA256 =
  '8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8';
const EXPECTED_XLSX_SHA512 =
  'a0b0eade3c3b01c2ea2961f60210a9553665f267fa5f661178ff8d7a1d12254cd5fc1759623b61f78b46e6da22301d4f3eb62dc4e09f6a850292fb6e1fedc024';

interface LockMetadata {
  optionalPeers?: string[];
  peerDependencies?: Record<string, string>;
}

interface WorkspaceLockEntry extends LockMetadata {
  name: string;
  version?: string;
}

function packageRow(locator: string, metadata: LockMetadata = {}): unknown[] {
  return [locator, '', metadata, 'sha512-test'];
}

function lockFixture(
  packages: Record<string, unknown>,
  workspaces: Record<string, WorkspaceLockEntry> = {},
): string {
  return JSON.stringify({
    lockfileVersion: 1,
    configVersion: 0,
    workspaces,
    packages,
  });
}

describe('dependency policy', () => {
  test('every production package import is declared by its workspace', async () => {
    expect(await findUndeclaredProductionImports()).toEqual([]);
  });

  test('does not resolve packages from unauthenticated remote URLs', async () => {
    expect(await findRemoteDependencyReferences()).toEqual([]);
  });

  test('authenticates the vendored SheetJS archive', async () => {
    expect(await digest('sha256', 'vendor/xlsx-0.20.3.tgz')).toBe(
      EXPECTED_XLSX_SHA256,
    );
    expect(await digest('sha512', 'vendor/xlsx-0.20.3.tgz')).toBe(
      EXPECTED_XLSX_SHA512,
    );
    expect(await findVendorDigestMismatches()).toEqual([]);
    expect(await findVendorReferenceMismatches()).toEqual([]);
  });

  test('passes the combined blocking dependency policy', async () => {
    expect(await checkDependencies()).toEqual([]);
  });
});

describe('Bun lock peer dependency policy', () => {
  test('accepts every peer contract in the current frozen lock', async () => {
    expect(await findPeerDependencyMismatches()).toEqual([]);
  });

  test('reports the pre-repair Astro optional-peer mismatch exactly', () => {
    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          astro: packageRow('astro@7.1.3', {
            peerDependencies: {
              '@astrojs/markdown-remark': '7.2.1',
            },
            optionalPeers: ['@astrojs/markdown-remark'],
          }),
          '@astrojs/markdown-remark': packageRow(
            '@astrojs/markdown-remark@7.2.0',
          ),
        }),
      ),
    ).toEqual([
      'bun.lock: astro@7.1.3 optional peer @astrojs/markdown-remark ' +
        'requires 7.2.1, resolved 7.2.0',
    ]);
  });

  test('allows compatible and absent optional peers but rejects a present mismatch', () => {
    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          compatible: packageRow('compatible@1.0.0', {
            peerDependencies: { host: '2.0.0' },
            optionalPeers: ['host'],
          }),
          host: packageRow('host@2.0.0'),
          absent: packageRow('absent@1.0.0', {
            peerDependencies: { missing: '^1.0.0' },
            optionalPeers: ['missing'],
          }),
        }),
      ),
    ).toEqual([]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          plugin: packageRow('plugin@1.0.0', {
            peerDependencies: { host: '2.0.0' },
            optionalPeers: ['host'],
          }),
          host: packageRow('host@1.9.0'),
        }),
      ),
    ).toEqual([
      'bun.lock: plugin@1.0.0 optional peer host requires 2.0.0, resolved 1.9.0',
    ]);
  });

  test('rejects missing and incompatible required peers', () => {
    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          incompatible: packageRow('incompatible@1.0.0', {
            peerDependencies: { host: '^2.0.0' },
          }),
          host: packageRow('host@1.9.0'),
          missing: packageRow('missing@1.0.0', {
            peerDependencies: { unavailable: '^3.0.0' },
          }),
        }),
      ),
    ).toEqual([
      'bun.lock: incompatible@1.0.0 required peer host requires ^2.0.0, resolved 1.9.0',
      'bun.lock: missing@1.0.0 required peer unavailable requires ^3.0.0, but it is missing',
    ]);
  });

  test('supports exact, caret, OR, and prerelease peer ranges', () => {
    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: packageRow('owner@1.0.0', {
            peerDependencies: {
              exact: '1.2.3',
              caret: '^2.1.0',
              or: '^3.0.0 || ^4.0.0',
              prerelease: '^5.0.0-beta.1',
            },
          }),
          exact: packageRow('exact@1.2.3'),
          caret: packageRow('caret@2.4.0'),
          or: packageRow('or@4.1.0'),
          prerelease: packageRow('prerelease@5.0.0-beta.2'),
        }),
      ),
    ).toEqual([]);
  });

  test('uses the nearest owner-child resolution before parent and root peers', () => {
    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          'parent/owner': packageRow('owner@1.0.0', {
            peerDependencies: { host: '^3.0.0' },
          }),
          'parent/owner/host': packageRow('host@3.1.0'),
          'parent/host': packageRow('host@2.1.0'),
          host: packageRow('host@1.1.0'),
        }),
      ),
    ).toEqual([]);
  });

  test('uses a parent-sibling peer before root in both compatibility directions', () => {
    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          'parent/owner': packageRow('owner@1.0.0', {
            peerDependencies: { host: '^2.0.0' },
          }),
          'parent/host': packageRow('host@2.1.0'),
          host: packageRow('host@1.1.0'),
        }),
      ),
    ).toEqual([]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          'parent/owner': packageRow('owner@1.0.0', {
            peerDependencies: { host: '^2.0.0' },
          }),
          'parent/host': packageRow('host@1.1.0'),
          host: packageRow('host@2.1.0'),
        }),
      ),
    ).toEqual([
      'bun.lock: owner@1.0.0 required peer host requires ^2.0.0, resolved 1.1.0',
    ]);
  });

  test('falls back to root without accepting unrelated nested packages', () => {
    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          'parent/owner': packageRow('owner@1.0.0', {
            peerDependencies: { host: '^2.0.0' },
          }),
          host: packageRow('host@2.1.0'),
        }),
      ),
    ).toEqual([]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: packageRow('owner@1.0.0', {
            peerDependencies: { host: '^2.0.0' },
          }),
          'unrelated/host': packageRow('host@2.1.0'),
        }),
      ),
    ).toEqual([
      'bun.lock: owner@1.0.0 required peer host requires ^2.0.0, but it is missing',
    ]);
  });

  test('treats scoped owner and peer names as atomic path segments', () => {
    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          '@scope/parent/@owner/plugin': packageRow('@owner/plugin@1.0.0', {
            peerDependencies: { '@peer/api': '^2.0.0' },
          }),
          '@scope/parent/@peer/api': packageRow('@peer/api@2.1.0'),
          '@peer/api': packageRow('@peer/api@1.0.0'),
        }),
      ),
    ).toEqual([]);
  });

  test('validates compatible, incompatible, and optional workspace peers', () => {
    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture(
          {
            '@repo/host': ['@repo/host@workspace:packages/host'],
            '@repo/plugin': ['@repo/plugin@workspace:packages/plugin'],
            '@repo/optional': ['@repo/optional@workspace:packages/optional'],
          },
          {
            'packages/host': {
              name: '@repo/host',
              version: '2.1.0',
            },
            'packages/plugin': {
              name: '@repo/plugin',
              version: '1.0.0',
              peerDependencies: {
                '@repo/host': '^2.0.0',
                external: '^3.0.0',
              },
            },
            'packages/optional': {
              name: '@repo/optional',
              version: '1.0.0',
              peerDependencies: { absent: '^1.0.0' },
              optionalPeers: ['absent'],
            },
          },
        ),
      ),
    ).toEqual([
      'bun.lock: @repo/plugin@1.0.0 required peer external requires ^3.0.0, but it is missing',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture(
          {
            '@repo/host': ['@repo/host@workspace:packages/host'],
            '@repo/plugin': ['@repo/plugin@workspace:packages/plugin'],
          },
          {
            'packages/host': {
              name: '@repo/host',
              version: '1.9.0',
            },
            'packages/plugin': {
              name: '@repo/plugin',
              version: '1.0.0',
              peerDependencies: { '@repo/host': '^2.0.0' },
            },
          },
        ),
      ),
    ).toEqual([
      'bun.lock: @repo/plugin@1.0.0 required peer @repo/host requires ^2.0.0, resolved 1.9.0',
    ]);
  });

  test('fails closed for invalid JSONC, malformed rows, and unsupported locators', () => {
    expect(findPeerDependencyMismatchesInLock('{')).toEqual([
      'bun.lock: invalid JSONC',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: packageRow('owner@1.0.0', {
            peerDependencies: { host: 'garbage' },
          }),
          host: packageRow('host@1.0.0'),
        }),
      ),
    ).toEqual([
      'bun.lock: owner@1.0.0 required peer host has unsupported range garbage',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: packageRow('owner@1.0.0', {
            peerDependencies: { absent: 'workspace:*' },
            optionalPeers: ['absent'],
          }),
        }),
      ),
    ).toEqual([
      'bun.lock: owner@1.0.0 optional peer absent has unsupported range workspace:*',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: packageRow('owner@1.0.0', {
            peerDependencies: { host: '^1.0.0' },
          }),
          host: packageRow('host@1.2.3 || 9.0.0'),
        }),
      ),
    ).toEqual([
      'bun.lock: owner@1.0.0 required peer host requires ^1.0.0, but host@1.2.3 || 9.0.0 is an unsupported locator',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: packageRow('owner@1.0.0', {
            peerDependencies: { host: '^1.0.0' },
          }),
          host: packageRow('host@1.2'),
        }),
      ),
    ).toEqual([
      'bun.lock: owner@1.0.0 required peer host requires ^1.0.0, but host@1.2 is an unsupported locator',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          broken: {},
        }),
      ),
    ).toEqual(['bun.lock: package broken has a malformed package row']);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: [
            'owner@../../vendor/owner.tgz',
            { peerDependencies: { host: '^2.0.0' } },
          ],
          host: packageRow('host@1.0.0'),
        }),
      ),
    ).toEqual([
      'bun.lock: owner@../../vendor/owner.tgz required peer host requires ^2.0.0, resolved 1.0.0',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: [
            'owner@npm:real-owner@1.0.0',
            '',
            { peerDependencies: { host: '^2.0.0' } },
          ],
          host: packageRow('host@1.0.0'),
        }),
      ),
    ).toEqual([
      'bun.lock: owner@npm:real-owner@1.0.0 required peer host requires ^2.0.0, resolved 1.0.0',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: packageRow('owner@1.0.0', {
            optionalPeers: ['undeclared'],
          }),
        }),
      ),
    ).toEqual([
      'bun.lock: owner@1.0.0 marks undeclared peer undeclared as optional',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture(
          {},
          {
            'packages/owner': {
              name: '@repo/owner',
              optionalPeers: ['undeclared'],
            },
          },
        ),
      ),
    ).toEqual([
      'bun.lock: @repo/owner marks undeclared peer undeclared as optional',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: packageRow('owner@1.0.0', {
            peerDependencies: { host: '^1.0.0' },
          }),
          host: {},
        }),
      ),
    ).toEqual([
      'bun.lock: owner@1.0.0 required peer host requires ^1.0.0, but host has a malformed package row',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: packageRow('owner@1.0.0', {
            peerDependencies: { host: '^1.0.0' },
          }),
          host: ['host@../../vendor/host.tgz'],
        }),
      ),
    ).toEqual([
      'bun.lock: owner@1.0.0 required peer host requires ^1.0.0, but host@../../vendor/host.tgz is an unsupported locator',
    ]);

    expect(
      findPeerDependencyMismatchesInLock(
        lockFixture({
          owner: packageRow('owner@1.0.0', {
            peerDependencies: { host: '^1.0.0' },
          }),
          host: ['host@npm:real-host@1.0.0'],
        }),
      ),
    ).toEqual([
      'bun.lock: owner@1.0.0 required peer host requires ^1.0.0, but host@npm:real-host@1.0.0 is an unsupported locator',
    ]);
  });
});
