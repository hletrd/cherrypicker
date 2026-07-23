import { describe, expect, test } from 'bun:test';
import {
  declaredBunVersion,
  verifyBunVersion,
} from '../check-toolchain.js';

describe('toolchain pin', () => {
  test('accepts an exact Bun version declaration', () => {
    expect(declaredBunVersion('bun@1.2.6')).toBe('1.2.6');
    expect(() => verifyBunVersion('1.2.6', '1.2.6')).not.toThrow();
  });

  test('rejects missing, ranged, or mismatched versions with an actionable error', () => {
    expect(() => declaredBunVersion(undefined)).toThrow('must declare');
    expect(() => declaredBunVersion('bun@^1.2.6')).toThrow('expected bun@<version>');
    expect(() => verifyBunVersion('1.2.6', '1.3.12')).toThrow(
      'repository requires 1.2.6',
    );
  });
});
