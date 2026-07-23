import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parse } from 'yaml';
import {
  categoriesFileSchema,
  CategoryRegistry,
  rewardRuleSchema,
} from '@cherrypicker/rules';
import type { CategoryNode } from '@cherrypicker/rules';

export type JsonSchemaObject = Record<string, unknown>;

export interface ScraperRuleContract {
  registry: CategoryRegistry;
  categoryIds: readonly string[];
  subcategoryIds: readonly string[];
  taxonomyPromptLines: readonly string[];
  conditionPromptLines: readonly string[];
  rewardInputSchema: JsonSchemaObject;
}

function schemaProperties(
  schema: JsonSchemaObject,
  label: string,
): Record<string, JsonSchemaObject> {
  const properties = schema['properties'];
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new Error(`${label} JSON schema has no object properties.`);
  }
  return properties as Record<string, JsonSchemaObject>;
}

function nestedSchema(
  schema: JsonSchemaObject,
  key: string,
  label: string,
): JsonSchemaObject {
  const value = schema[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} JSON schema is missing "${key}".`);
  }
  return value as JsonSchemaObject;
}

function enumValues(schema: JsonSchemaObject): string[] {
  const values = schema['enum'];
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string')
    : [];
}

function buildRewardInputSchema(
  categoryIds: readonly string[],
  subcategoryIds: readonly string[],
): {
  schema: JsonSchemaObject;
  conditionPromptLines: string[];
} {
  const schema = structuredClone(
    z.toJSONSchema(rewardRuleSchema, { io: 'input' }),
  ) as JsonSchemaObject;
  delete schema['$schema'];

  const rewardProperties = schemaProperties(schema, 'reward rule');
  const requiredRuleFields = [
    'id',
    'category',
    'type',
    'tiers',
    'priority',
    'combination',
    'stackingGroup',
    'capGroup',
    'support',
  ];
  const canonicalRequired = Array.isArray(schema['required'])
    ? schema['required'].filter(
        (value): value is string => typeof value === 'string',
      )
    : [];
  schema['required'] = [
    ...new Set([...canonicalRequired, ...requiredRuleFields]),
  ];
  rewardProperties['category'] = {
    type: 'string',
    enum: [...categoryIds],
    description: '정규 최상위 카테고리 ID 또는 전 가맹점(*)',
  };
  rewardProperties['subcategory'] = {
    type: 'string',
    enum: [...subcategoryIds],
    description: '선택한 category 아래의 정규 하위 카테고리 ID',
  };

  // fixedAmountPerLiter is accepted only as a legacy YAML migration input.
  // A new model extraction must use fixedAmount + unit: won_per_liter.
  const tiers = nestedSchema(rewardProperties['tiers']!, 'items', 'reward tiers');
  const tierProperties = schemaProperties(tiers, 'reward tier');
  delete tierProperties['fixedAmountPerLiter'];

  const conditions = rewardProperties['conditions'];
  if (!conditions) {
    throw new Error('Canonical reward schema has no conditions schema.');
  }
  const conditionProperties = schemaProperties(conditions, 'reward conditions');
  const conditionPromptLines = Object.entries(conditionProperties).map(
    ([name, conditionSchema]) => {
      const values = enumValues(conditionSchema);
      return values.length > 0
        ? `- ${name}: ${values.join(' / ')}`
        : `- ${name}`;
    },
  );

  return { schema, conditionPromptLines };
}

export function buildScraperRuleContract(
  nodes: CategoryNode[],
): ScraperRuleContract {
  const registry = new CategoryRegistry(nodes);
  const categoryIds = ['*', ...registry.parentIds()];
  const subcategoryIds = [
    ...new Set(
      registry
        .canonicalKeys()
        .filter((key) => key.includes('.'))
        .map((key) => key.slice(key.indexOf('.') + 1)),
    ),
  ];
  const taxonomyPromptLines = [
    '- *: 전 가맹점',
    ...nodes.flatMap((node) => [
      `- ${node.id}: ${node.labelKo}`,
      ...(node.subcategories ?? []).map(
        (child) => `  - ${node.id}.${child.id}: ${child.labelKo}`,
      ),
    ]),
  ];
  const { schema, conditionPromptLines } = buildRewardInputSchema(
    categoryIds,
    subcategoryIds,
  );

  return {
    registry,
    categoryIds,
    subcategoryIds,
    taxonomyPromptLines,
    conditionPromptLines,
    rewardInputSchema: schema,
  };
}

let canonicalContract: ScraperRuleContract | undefined;

export function getCanonicalScraperRuleContract(): ScraperRuleContract {
  if (canonicalContract) return canonicalContract;

  const categoriesPath = fileURLToPath(
    new URL('../../../packages/rules/data/categories.yaml', import.meta.url),
  );
  const parsed = categoriesFileSchema.parse(
    parse(readFileSync(categoriesPath, 'utf8')),
  );
  canonicalContract = buildScraperRuleContract(
    parsed.categories as CategoryNode[],
  );
  return canonicalContract;
}
