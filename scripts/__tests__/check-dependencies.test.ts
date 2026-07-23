import { describe, expect, test } from 'bun:test';
import {
  checkDependencies,
  digest,
  findRemoteDependencyReferences,
  findUndeclaredProductionImports,
  findVendorDigestMismatches,
  findVendorReferenceMismatches,
} from '../check-dependencies.js';

const EXPECTED_XLSX_SHA256 =
  '8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8';
const EXPECTED_XLSX_SHA512 =
  'a0b0eade3c3b01c2ea2961f60210a9553665f267fa5f661178ff8d7a1d12254cd5fc1759623b61f78b46e6da22301d4f3eb62dc4e09f6a850292fb6e1fedc024';

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
