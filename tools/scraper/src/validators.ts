import { cardRuleSetSchema } from '@cherrypicker/rules';
import type { CardRuleSet } from '@cherrypicker/rules';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  result?: CardRuleSet;
}

/**
 * Validate extracted card rules using the Zod schema from @cherrypicker/rules
 * plus additional business logic checks.
 */
export function validateExtractedRules(rules: unknown): ValidationResult {
  const errors: string[] = [];

  // 1. Zod schema validation
  let parsed: CardRuleSet;
  try {
    parsed = cardRuleSetSchema.parse(rules);
  } catch (err) {
    if (err !== null && typeof err === 'object' && 'issues' in err && Array.isArray((err as { issues: unknown[] }).issues)) {
      for (const issue of (err as { issues: { path: unknown[]; message: string }[] }).issues) {
        errors.push(`[스키마] ${issue.path.join('.')}: ${issue.message}`);
      }
    } else {
      errors.push(`[스키마] 알 수 없는 오류: ${String(err)}`);
    }
    return { valid: false, errors };
  }

  // 2. Business logic validation

  // 2a. Reward rates should be 0 < rate <= 1
  for (const reward of parsed.rewards) {
    for (const tier of reward.tiers) {
      if (tier.rate <= 0) {
        errors.push(
          `[비즈니스] rewards[${reward.category}].tiers[${tier.performanceTier}].rate: 혜택률은 0보다 커야 합니다 (현재: ${tier.rate})`,
        );
      }
      if (tier.rate > 1) {
        errors.push(
          `[비즈니스] rewards[${reward.category}].tiers[${tier.performanceTier}].rate: 혜택률은 1(100%) 이하여야 합니다 (현재: ${tier.rate}). 퍼센트를 소수로 변환하세요.`,
        );
      }
      if (tier.monthlyCap !== null && tier.monthlyCap !== undefined && tier.monthlyCap <= 0) {
        errors.push(
          `[비즈니스] rewards[${reward.category}].tiers[${tier.performanceTier}].monthlyCap: 한도는 양수여야 합니다`,
        );
      }
      if (
        tier.perTransactionCap !== null &&
        tier.perTransactionCap !== undefined &&
        tier.perTransactionCap <= 0
      ) {
        errors.push(
          `[비즈니스] rewards[${reward.category}].tiers[${tier.performanceTier}].perTransactionCap: 한도는 양수여야 합니다`,
        );
      }
    }
  }

  // 2b. performanceTiers minSpending should be strictly ascending
  const tiers = parsed.performanceTiers;
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i]!.minSpending <= tiers[i - 1]!.minSpending) {
      errors.push(
        `[비즈니스] performanceTiers[${i}].minSpending: 전월실적 구간이 오름차순이어야 합니다 ` +
          `(${tiers[i - 1]!.id}=${tiers[i - 1]!.minSpending} >= ${tiers[i]!.id}=${tiers[i]!.minSpending})`,
      );
    }
  }

  // 2c. All reward tier references must exist in performanceTiers
  const tierIds = new Set(parsed.performanceTiers.map((t) => t.id));
  for (const reward of parsed.rewards) {
    for (const tier of reward.tiers) {
      if (!tierIds.has(tier.performanceTier)) {
        errors.push(
          `[비즈니스] rewards[${reward.category}].tiers: 존재하지 않는 전월실적 구간 참조: "${tier.performanceTier}"`,
        );
      }
    }
  }

  // 2d. Annual fees should be non-negative
  if (parsed.card.annualFee.domestic < 0) {
    errors.push('[비즈니스] card.annualFee.domestic: 연회비는 0 이상이어야 합니다');
  }
  if (parsed.card.annualFee.international < 0) {
    errors.push('[비즈니스] card.annualFee.international: 연회비는 0 이상이어야 합니다');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], result: parsed };
}
