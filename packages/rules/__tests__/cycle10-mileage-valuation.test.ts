import { beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  CategoryRegistry,
  collectCardRuleIssues,
  isOptimizationExecutableCard,
  loadAllCardRules,
  loadCategories,
  type CardRuleSet,
} from '../src/index.js';

const MILEAGE_VALUATION_REASON =
  'mileage reward valuation contract is not modeled';

let cards: CardRuleSet[];
let registry: CategoryRegistry;

beforeAll(async () => {
  const dataDirectory = join(import.meta.dir, '../data');
  cards = await loadAllCardRules(join(dataDirectory, 'cards'));
  registry = new CategoryRegistry(
    await loadCategories(join(dataDirectory, 'categories.yaml')),
  );
});

describe('Cycle 10 mileage valuation boundary', () => {
  test('the authored catalog fails closed every previously executable mileage rule', () => {
    const quarantined = cards.flatMap((card) =>
      card.rewards
        .filter(
          (rule) =>
            rule.type === 'mileage' &&
            rule.support.status === 'unsupported' &&
            rule.support.reason === MILEAGE_VALUATION_REASON,
        )
        .map((rule) => `${card.card.id}:${rule.id}`),
    );

    expect(quarantined).toHaveLength(32);
    expect(
      cards.flatMap((card) =>
        card.rewards
          .filter(
            (rule) =>
              rule.type === 'mileage' &&
              rule.support.status === 'supported',
          )
          .map((rule) => `${card.card.id}:${rule.id}`),
      ),
    ).toEqual([]);

    const samsung = cards.find(
      (card) => card.card.id === 'samsung-and-mileage-platinum',
    )!;
    expect(isOptimizationExecutableCard(samsung)).toBe(false);
  });

  test('semantic validation rejects a supported mileage rule even without a unit', () => {
    const invalid = structuredClone(
      cards.find(
        (card) => card.card.id === 'samsung-and-mileage-platinum',
      )!,
    );
    invalid.rewards[0]!.support = { status: 'supported' };

    expect(
      collectCardRuleIssues(invalid, registry),
    ).toContainEqual(
      expect.objectContaining({
        code: 'unexecutable_reward_tier',
        cardId: 'samsung-and-mileage-platinum',
        path: 'rewards.0',
      }),
    );
  });
});
