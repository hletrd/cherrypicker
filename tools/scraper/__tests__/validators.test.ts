import { describe, expect, test } from 'bun:test';
import { validateExtractedRules } from '../src/validators.js';
import { makeCardRule } from './fixtures.js';

describe('validateExtractedRules security boundary', () => {
  test('accepts a canonical rule for the expected issuer', () => {
    const result = validateExtractedRules(makeCardRule(), 'shinhan');
    expect(result.valid).toBe(true);
    expect(result.result?.card.issuer).toBe('shinhan');
  });

  test('rejects a different model-produced issuer', () => {
    const result = validateExtractedRules(
      makeCardRule({ issuer: 'kb' }),
      'shinhan',
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('요청한 카드사');
  });

  test('rejects impossible and future provenance dates at validation', () => {
    const impossible = validateExtractedRules(
      makeCardRule({ lastUpdated: '2026-02-29' }),
      'shinhan',
      undefined,
      new Date('2026-07-23T12:00:00.000Z'),
    );
    expect(impossible.valid).toBe(false);
    expect(impossible.errors.join('\n')).toContain('real ISO 8601 calendar date');

    const future = validateExtractedRules(
      makeCardRule({ lastUpdated: '2026-07-24' }),
      'shinhan',
      undefined,
      new Date('2026-07-23T23:59:59.999Z'),
    );
    expect(future.valid).toBe(false);
    expect(future.errors.join('\n')).toContain(
      'lastUpdated "2026-07-24" is after validation date "2026-07-23"',
    );
  });

  test('uses the shared invalid-clock and duplicate-tier diagnostics', () => {
    const invalidClock = validateExtractedRules(
      makeCardRule(),
      'shinhan',
      undefined,
      new Date(Number.NaN),
    );
    expect(invalidClock.valid).toBe(false);
    expect(invalidClock.errors.join('\n')).toContain(
      'catalog validation clock must return a valid Date',
    );

    const duplicate = makeCardRule();
    duplicate.rewards[0]!.tiers.push({
      ...duplicate.rewards[0]!.tiers[0]!,
    });
    const duplicateResult = validateExtractedRules(duplicate, 'shinhan');
    expect(duplicateResult.valid).toBe(false);
    expect(duplicateResult.errors.join('\n')).toContain(
      'duplicate performance tier reference',
    );
  });

  test('rejects traversal before returning a CardRuleSet', () => {
    const result = validateExtractedRules(
      makeCardRule({ id: '../../../../.github/workflows/pwn' }),
      'shinhan',
    );
    expect(result.valid).toBe(false);
    expect(result.result).toBeUndefined();
    expect(result.errors.join('\n')).toContain('card.id');
  });

  test('rejects stale or leaf-only category values', () => {
    for (const category of [
      'transport',
      'shopping',
      'department',
      'overseas',
      'leisure',
      'auto',
      'fuel',
    ]) {
      const rule = makeCardRule();
      rule.rewards[0]!.category = category;
      const result = validateExtractedRules(rule, 'shinhan');
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toContain('도메인');
    }
  });

  test('accepts only a canonical parent and subcategory pair', () => {
    const canonical = makeCardRule();
    canonical.rewards[0]!.category = 'transportation';
    canonical.rewards[0]!.subcategory = 'fuel';
    expect(validateExtractedRules(canonical, 'shinhan').valid).toBe(true);

    const invalid = makeCardRule();
    invalid.rewards[0]!.category = 'transportation';
    invalid.rewards[0]!.subcategory = 'cafe';
    const result = validateExtractedRules(invalid, 'shinhan');
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('invalid category');
  });

  test('accepts supported typed conditions and rejects unknown fields', () => {
    const supported = makeCardRule();
    supported.rewards[0]!.conditions = {
      minTransaction: 1_000,
      maxTransaction: 50_000,
      weekdays: [1, 2, 3, 4, 5],
      maxUses: 2,
      usePeriod: 'month',
      channel: 'online',
      paymentType: 'domestic',
      note: '테스트 조건',
    };
    expect(validateExtractedRules(supported, 'shinhan').valid).toBe(true);

    for (const conditions of [
      { excludeOnline: true },
      { arbitraryCondition: 'unsafe' },
      { channel: 'mobile' },
    ]) {
      const invalid = makeCardRule();
      invalid.rewards[0]!.conditions = conditions as never;
      const result = validateExtractedRules(invalid, 'shinhan');
      expect(result.valid).toBe(false);
      expect(result.result).toBeUndefined();
    }
  });

  test('preserves an explicit unsupported-rule disclosure', () => {
    const rule = makeCardRule();
    rule.rewards[0]!.support = {
      status: 'unsupported',
      reason: '거래별 리터 수가 필요함',
    };
    const result = validateExtractedRules(rule, 'shinhan');
    expect(result.valid).toBe(true);
    expect(result.result?.rewards[0]?.support).toEqual({
      status: 'unsupported',
      reason: '거래별 리터 수가 필요함',
    });
  });

  test('rejects supported annual caps through the shared semantic validator', () => {
    const rule = makeCardRule();
    rule.rewards[0]!.tiers[0]!.annualCap = 100_000;

    const unsupported = structuredClone(rule);
    unsupported.rewards[0]!.support = {
      status: 'unsupported',
      reason: '연간 누적 사용액이 필요함',
    };

    const result = validateExtractedRules(rule, 'shinhan');
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('trusted year-to-date usage facts');
    expect(validateExtractedRules(unsupported, 'shinhan').valid).toBe(true);
  });

  test('rejects model output that omits required rule metadata', () => {
    for (const field of [
      'id',
      'priority',
      'combination',
      'stackingGroup',
      'capGroup',
      'support',
    ] as const) {
      const rule = makeCardRule();
      delete (rule.rewards[0]! as unknown as Record<string, unknown>)[field];
      const result = validateExtractedRules(rule, 'shinhan');
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toContain(field);
    }
  });
});
