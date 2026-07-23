import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { rewardConditionsSchema } from '@cherrypicker/rules';
import { CARD_RULE_EXTRACTION_TOOL } from '../src/prompts/schemas.js';
import { SYSTEM_PROMPT } from '../src/prompts/system.js';
import { getCanonicalScraperRuleContract } from '../src/rule-contract.js';

interface SchemaNode {
  type?: string;
  enum?: unknown[];
  additionalProperties?: boolean;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  required?: string[];
}

function requiredProperties(
  schema: SchemaNode | undefined,
  label: string,
): Record<string, SchemaNode> {
  if (!schema?.properties) {
    throw new Error(`${label} has no schema properties`);
  }
  return schema.properties;
}

describe('scraper schema derives from canonical rules', () => {
  const contract = getCanonicalScraperRuleContract();
  const root = CARD_RULE_EXTRACTION_TOOL.input_schema as SchemaNode;
  const rewards = requiredProperties(root, 'tool')['rewards']?.items;
  const card = requiredProperties(
    requiredProperties(root, 'tool')['card'],
    'card',
  );
  const rewardProperties = requiredProperties(rewards, 'reward');
  const conditions = rewardProperties['conditions'];
  const conditionProperties = requiredProperties(conditions, 'conditions');

  test('uses taxonomy-derived parent and subcategory enums', () => {
    expect(rewardProperties['category']?.enum).toEqual(contract.categoryIds);
    expect(rewardProperties['subcategory']?.enum).toEqual(
      contract.subcategoryIds,
    );
    expect(rewardProperties['category']?.enum).toContain('transportation');
    expect(rewardProperties['subcategory']?.enum).toContain('fuel');
    for (const staleParent of [
      'transport',
      'shopping',
      'department',
      'overseas',
      'leisure',
      'auto',
      'fuel',
    ]) {
      expect(rewardProperties['category']?.enum).not.toContain(staleParent);
    }
    expect(SYSTEM_PROMPT).toContain('transportation.fuel');
  });

  test('uses the production condition fields and enum values', () => {
    const canonical = z.toJSONSchema(rewardConditionsSchema, {
      io: 'input',
    }) as SchemaNode;
    expect(Object.keys(conditionProperties)).toEqual(
      Object.keys(requiredProperties(canonical, 'canonical conditions')),
    );
    expect(conditions?.additionalProperties).toBe(false);
    expect(conditionProperties).not.toHaveProperty('excludeOnline');
    expect(conditionProperties['channel']?.enum).toEqual([
      'online',
      'offline',
    ]);
    expect(conditionProperties['paymentType']?.enum).toEqual([
      'domestic',
      'overseas',
    ]);
    expect(SYSTEM_PROMPT).not.toContain('excludeOnline');
  });

  test('exposes canonical rule metadata and support disclosure', () => {
    for (const field of [
      'id',
      'priority',
      'combination',
      'stackingGroup',
      'capGroup',
      'support',
    ]) {
      expect(rewardProperties).toHaveProperty(field);
      expect(rewards?.required).toContain(field);
    }
    expect(rewards?.additionalProperties).toBe(false);
    expect(SYSTEM_PROMPT).toContain('status": "unsupported');
  });

  test('keeps trusted issuer and provenance outside the model-authored contract', () => {
    for (const field of ['issuer', 'source', 'lastUpdated']) {
      expect(card).not.toHaveProperty(field);
      expect(
        requiredProperties(root, 'tool')['card']?.required,
      ).not.toContain(field);
    }
    expect(SYSTEM_PROMPT).toContain(
      'issuer, source, lastUpdated는 스크래퍼가 신뢰 경계에서 기록',
    );
  });
});
