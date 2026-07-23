#!/usr/bin/env bun

import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parse } from 'yaml';
import { MerchantMatcher } from '../../packages/core/src/categorizer/matcher.js';
import {
  buildCategoryKey,
  cardRuleSetSchema,
  CategoryRegistry,
  collectUnmodeledRuleRestrictions,
  rewardConditionSignature,
  sharedPerformanceTiers,
  type CardRuleSet,
  type CategoryNode,
  type RewardRule,
} from '../../packages/rules/src/index.js';

const ROOT = resolve(import.meta.dir, '../..');
const CARD_GLOB = new Bun.Glob('packages/rules/data/cards/**/*.yaml');
const write = process.argv.includes('--write');
const check = process.argv.includes('--check') || !write;

const categoriesDocument = parse(
  await readFile(resolve(ROOT, 'packages/rules/data/categories.yaml'), 'utf8'),
) as { categories: CategoryNode[] };
const merchantMatcher = new MerchantMatcher(categoriesDocument.categories, {
  strict: true,
});
const categoryRegistry = new CategoryRegistry(categoriesDocument.categories);

if (write && process.argv.includes('--check')) {
  throw new Error('Choose either --check or --write');
}

interface CategoryRef {
  category: string;
  subcategory?: string;
}

const CATEGORY_MIGRATIONS: Readonly<Record<string, CategoryRef>> = {
  beauty: { category: 'offline_shopping', subcategory: 'beauty' },
  'health.beauty': { category: 'offline_shopping', subcategory: 'beauty' },
  'grocery.department_store': {
    category: 'offline_shopping',
    subcategory: 'department_store',
  },
  'grocery.home_shopping': {
    category: 'online_shopping',
    subcategory: 'home_shopping',
  },
  mart: { category: '*' },
  'shopping.daiso': { category: 'offline_shopping', subcategory: 'daiso' },
  'transportation.taxi': { category: 'public_transit', subcategory: 'taxi' },
  'travel.accommodation': { category: 'travel', subcategory: 'hotel' },
};

const GENERAL_SPEND_PATTERN =
  /(전\s*가맹점|모든\s*가맹점|전체\s*가맹점|일반\s*(?:온라인|오프라인)?\s*가맹점|국내외?\s*(?:온라인|오프라인)?\s*(?:가맹점|이용|결제)|해외\s*(?:온라인|오프라인)?\s*(?:가맹점|이용|결제)|기본\s*(?:적립|할인|캐시백)|모든\s*결제|전월실적 없이|전국\s*가맹점|어디서나)/;
const UNVERIFIED_MERCHANT_SCOPE_REASON = 'unverified_merchant_scope';
const UNMODELED_REWARD_VALUE_REASON = 'unmodeled_reward_value';
const UNMODELED_GLOBAL_CONSTRAINTS_REASON = 'unmodeled_global_constraints';

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function replaceCategory(block: string, ref: CategoryRef): string {
  let next = block.replace(
    /^  - category:.*$/m,
    `  - category: ${ref.category === '*' ? "'*'" : ref.category}`,
  );
  const subcategoryPattern = /^    subcategory:.*$\n?/m;
  if (ref.subcategory) {
    if (subcategoryPattern.test(next)) {
      next = next.replace(subcategoryPattern, `    subcategory: ${ref.subcategory}\n`);
    } else {
      next = next.replace(
        /^(  - category:.*)$/m,
        `$1\n    subcategory: ${ref.subcategory}`,
      );
    }
  } else {
    next = next.replace(subcategoryPattern, '');
  }
  return next;
}

function setCondition(block: string, key: string, value: string): string {
  const existing = new RegExp(`^      ${key}:`, 'm');
  if (existing.test(block)) return block;

  if (/^    conditions:\s*$/m.test(block)) {
    return block.replace(
      /^    conditions:\s*$/m,
      `    conditions:\n      ${key}: ${value}`,
    );
  }

  const trailing = block.match(/\n+$/)?.[0] ?? '';
  const body = trailing ? block.slice(0, -trailing.length) : block;
  return `${body}\n    conditions:\n      ${key}: ${value}${trailing}`;
}

function markUnsupported(block: string, reason: string): string {
  if (/^    support:\n      status: unsupported/m.test(block)) return block;
  if (/^    support:\n(?:      .*\n?)*/m.test(block)) {
    return block.replace(
      /^    support:\n(?:      .*\n?)*/m,
      `    support:\n      status: unsupported\n      reason: "${reason}"\n`,
    );
  }
  const trailing = block.match(/\n+$/)?.[0] ?? '';
  const body = trailing ? block.slice(0, -trailing.length) : block;
  return `${body}\n    support:\n      status: unsupported\n      reason: "${reason}"${trailing}`;
}

function addRuleContract(block: string, ruleIndex: number): string {
  const id = `reward-${String(ruleIndex + 1).padStart(3, '0')}`;
  const fields: string[] = [];
  if (!/^    id:/m.test(block)) fields.push(`    id: ${id}`);
  if (!/^    priority:/m.test(block)) {
    fields.push(`    priority: ${ruleIndex + 1}`);
  }
  if (!/^    combination:/m.test(block)) {
    fields.push('    combination: exclusive');
  }
  if (!/^    stackingGroup:/m.test(block)) {
    fields.push('    stackingGroup: base');
  }
  if (!/^    capGroup:/m.test(block)) fields.push(`    capGroup: ${id}`);
  if (fields.length === 0) return block;
  return block.replace(/^(  - category:.*)$/m, `$1\n${fields.join('\n')}`);
}

function markSupported(block: string): string {
  if (/^    support:/m.test(block)) return block;
  const trailing = block.match(/\n+$/)?.[0] ?? '';
  const body = trailing ? block.slice(0, -trailing.length) : block;
  return `${body}\n    support:\n      status: supported${trailing}`;
}

function removeGenericMerchantConditions(block: string): string {
  return block.replace(
    /^      specificMerchants:\n((?:        - .*\n?)*)/gm,
    (_match, merchantLines: string) => {
      const retained = merchantLines
        .split('\n')
        .filter(Boolean)
        .filter((line) => {
          const merchant = unquote(line.replace(/^\s*-\s*/, ''));
          return !/^(?:해외가맹점|국내가맹점|해외|국내)$/.test(merchant);
        });
      return retained.length > 0
        ? `      specificMerchants:\n${retained.join('\n')}\n`
        : '';
    },
  );
}

function addWeekdayCondition(block: string, description: string): string {
  if (/주중\s*\(?월\s*~\s*목\)?/.test(description)) {
    return setCondition(block, 'weekdays', '[1, 2, 3, 4]');
  }
  if (/주말\s*\(?금\s*~\s*일\)?/.test(description)) {
    return setCondition(block, 'weekdays', '[5, 6, 0]');
  }
  if (/평일/.test(description)) {
    return setCondition(block, 'weekdays', '[1, 2, 3, 4, 5]');
  }
  if (/주말/.test(description)) {
    return setCondition(block, 'weekdays', '[0, 6]');
  }
  const namedWeekdays: Array<[RegExp, number]> = [
    [/일요일/, 0],
    [/월요일/, 1],
    [/화요일/, 2],
    [/수요일/, 3],
    [/목요일/, 4],
    [/금요일/, 5],
    [/토요일/, 6],
  ];
  const matched = namedWeekdays
    .filter(([pattern]) => pattern.test(description))
    .map(([, weekday]) => weekday);
  return matched.length > 0
    ? setCondition(block, 'weekdays', `[${matched.join(', ')}]`)
    : block;
}

function migrateRewardBlock(
  block: string,
  relativePath: string,
  ruleIndex: number,
): string {
  const categoryMatch = /^  - category:\s*(.+)$/m.exec(block);
  if (!categoryMatch) return block;
  const subcategoryMatch = /^    subcategory:\s*(.+)$/m.exec(block);
  const category = unquote(categoryMatch[1]!);
  const subcategory = subcategoryMatch ? unquote(subcategoryMatch[1]!) : undefined;
  const authoredKey = subcategory ? `${category}.${subcategory}` : category;
  const label = unquote(/^    label:\s*(.+)$/m.exec(block)?.[1] ?? '');
  const note = unquote(/^      note:\s*(.+)$/m.exec(block)?.[1] ?? '');
  const description = `${label} ${note}`;

  let next = block;
  const migrated = CATEGORY_MIGRATIONS[authoredKey];
  if (migrated) {
    next = replaceCategory(next, migrated);
  } else {
    const canonical = categoryRegistry.resolvePair(category, subcategory).value;
    if (
      canonical &&
      buildCategoryKey(canonical.category, canonical.subcategory) !==
        authoredKey
    ) {
      next = replaceCategory(next, canonical);
    }
  }

  if (authoredKey === 'health') {
    const ref = relativePath.endsWith('/bodyfriend.yaml')
      ? { category: 'transportation', subcategory: 'rental' }
      : { category: 'sports' };
    next = replaceCategory(next, ref);
  }

  const isMalltail =
    authoredKey === 'travel.overseas' && relativePath.endsWith('/malltail-plus.yaml');
  if (isMalltail) {
    next = replaceCategory(next, { category: 'online_shopping' });
  } else if (authoredKey === 'overseas' || authoredKey === 'travel.overseas') {
    next = replaceCategory(next, { category: '*' });
    next = setCondition(next, 'paymentType', 'overseas');
    if (/일본/.test(description)) {
      next = setCondition(next, 'channel', 'offline');
      next = markUnsupported(
        next,
        'country-specific eligibility requires country provenance',
      );
    }
  }

  if (category === 'uncategorized' && GENERAL_SPEND_PATTERN.test(description)) {
    next = replaceCategory(next, { category: '*' });
    const coversDomesticAndOverseas =
      /(국내외|국내\/해외|전\s*세계)/.test(description);
    if (!coversDomesticAndOverseas && /해외/.test(description) && !/국내/.test(description)) {
      next = setCondition(next, 'paymentType', 'overseas');
    } else if (!coversDomesticAndOverseas && /국내/.test(description) && !/해외/.test(description)) {
      next = setCondition(next, 'paymentType', 'domestic');
    }
  }

  next = addWeekdayCondition(next, description);
  if (/온라인\s*제외/.test(description)) {
    next = setCondition(next, 'channel', 'offline');
  } else if (/(?:오프라인)\s*(?:결제|가맹점|전용|이용)/.test(description)) {
    next = setCondition(next, 'channel', 'offline');
  } else if (/(?:온라인)\s*(?:결제|가맹점|전용|이용)/.test(description)) {
    next = setCondition(next, 'channel', 'online');
  }
  if (
    !/국내외/.test(description) &&
    /해외\s*(?:이용|가맹점|결제|승인|매출)/.test(description)
  ) {
    next = setCondition(next, 'paymentType', 'overseas');
    next = removeGenericMerchantConditions(next);
  } else if (
    !/국내외/.test(description) &&
    /국내\s*(?:이용|가맹점|결제|승인|매출)/.test(description)
  ) {
    next = setCondition(next, 'paymentType', 'domestic');
    next = removeGenericMerchantConditions(next);
  }

  if (/건당\s*10만원\s*미만/.test(description)) {
    next = replaceCategory(next, { category: '*' });
    next = setCondition(next, 'maxTransaction', '99999');
    next = next.replace(/^        perTransactionCap:\s*99999$/m, '        perTransactionCap: null');
  } else if (/건당\s*10만원\s*이상/.test(description)) {
    next = replaceCategory(next, { category: '*' });
    next = setCondition(next, 'minTransaction', '100000');
  }

  if (/SOL Pay 간편결제/.test(description)) {
    next = markUnsupported(next, 'selected-wallet eligibility is not available in statement facts');
  }

  next = addRuleContract(next, ruleIndex);
  return markSupported(next);
}

function ruleContainsMerchant(rule: RewardRule, merchant: string): boolean {
  if (rule.category === '*') return true;
  const resolved = merchantMatcher.match(merchant);
  if (resolved.category !== rule.category) return false;
  return (
    rule.subcategory === undefined ||
    resolved.subcategory === rule.subcategory
  );
}

function collectUnsupportedReasons(cardRule: CardRuleSet): Map<number, string> {
  const reasons = new Map<number, Set<string>>();
  const addReason = (index: number, reason: string) => {
    const current = reasons.get(index) ?? new Set<string>();
    current.add(reason);
    reasons.set(index, current);
  };

  cardRule.rewards.forEach((rule, index) => {
    if (rule.support.status === 'unsupported') return;
    const hasModeledReward = rule.tiers.some(
      (tier) => (tier.rate ?? 0) > 0 || (tier.fixedAmount ?? 0) > 0,
    );
    if (!hasModeledReward) {
      reasons.set(index, new Set([UNMODELED_REWARD_VALUE_REASON]));
      return;
    }
    const hasPositiveReward = rule.tiers.some(
      (tier) => (tier.rate ?? 0) > 0 || (tier.fixedAmount ?? 0) > 0,
    );
    if (
      rule.category === 'uncategorized' &&
      !rule.subcategory &&
      (rule.conditions?.specificMerchants?.length ?? 0) === 0 &&
      hasPositiveReward
    ) {
      // The source does not prove whether this is an unmatched-only benefit
      // or an all-merchant benefit. Move it to broad scope but fail closed so
      // relevant candidate transactions disclose the uncertainty.
      reasons.set(index, new Set([UNVERIFIED_MERCHANT_SCOPE_REASON]));
      return;
    }
    for (const reason of collectUnmodeledRuleRestrictions(rule)) {
      addReason(index, `unmodeled eligibility: ${reason}`);
    }
    if (
      rule.conditions?.specificMerchants?.some(
        (merchant) => !ruleContainsMerchant(rule, merchant),
      )
    ) {
      addReason(index, 'merchant category is not reachable by the canonical matcher');
    }
    if (rule.tiers.some((tier) => (tier.annualCap ?? 0) > 0)) {
      addReason(index, 'annual reward caps are not available in monthly statement facts');
    }
  });

  const hasUnmodeledGlobalConstraints =
    (cardRule.globalConstraints.minimumAnnualSpending ?? 0) > 0 ||
    (cardRule.globalConstraints.monthlyMileageCap ?? 0) > 0 ||
    (cardRule.globalConstraints.annualBonusMileage ?? 0) > 0 ||
    (cardRule.globalConstraints.note?.trim().length ?? 0) > 0;
  if (hasUnmodeledGlobalConstraints) {
    cardRule.rewards.forEach((rule, index) => {
      if (rule.support.status === 'supported') {
        reasons.set(
          index,
          new Set([UNMODELED_GLOBAL_CONSTRAINTS_REASON]),
        );
      }
    });
  }

  for (let leftIndex = 0; leftIndex < cardRule.rewards.length; leftIndex += 1) {
    const left = cardRule.rewards[leftIndex]!;
    if (left.support.status === 'unsupported') continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < cardRule.rewards.length;
      rightIndex += 1
    ) {
      const right = cardRule.rewards[rightIndex]!;
      if (
        right.support.status === 'unsupported' ||
        left.category !== right.category ||
        left.subcategory !== right.subcategory ||
        left.stackingGroup !== right.stackingGroup ||
        rewardConditionSignature(left) !== rewardConditionSignature(right) ||
        !sharedPerformanceTiers(left, right)
      ) {
        continue;
      }
      addReason(leftIndex, 'ambiguous overlapping reward rules');
      addReason(rightIndex, 'ambiguous overlapping reward rules');
    }
  }

  return new Map(
    [...reasons].map(([index, values]) => [index, [...values].join('; ')]),
  );
}

function applyUnsupportedDecisions(source: string): string {
  const parsed = cardRuleSetSchema.parse(parse(source));
  const reasons = collectUnsupportedReasons(parsed);
  if (reasons.size === 0) return source;

  const rewardsStart = source.indexOf('\nrewards:');
  const constraintsStart = source.indexOf('\nglobalConstraints:', rewardsStart);
  const end = constraintsStart < 0 ? source.length : constraintsStart;
  const section = source.slice(rewardsStart, end);
  const starts = [...section.matchAll(/^  - category:/gm)].map(
    (match) => match.index,
  );
  let migrated = section;
  for (let index = starts.length - 1; index >= 0; index -= 1) {
    const reason = reasons.get(index);
    if (!reason) continue;
    const start = starts[index]!;
    const finish = index + 1 < starts.length ? starts[index + 1]! : section.length;
    const block = section.slice(start, finish);
    const scopedBlock =
      reason === UNVERIFIED_MERCHANT_SCOPE_REASON
        ? replaceCategory(block, { category: '*' })
        : block;
    migrated =
      migrated.slice(0, start) +
      markUnsupported(scopedBlock, reason) +
      migrated.slice(finish);
  }
  return `${source.slice(0, rewardsStart)}${migrated}${source.slice(end)}`;
}

function migrateFile(source: string, relativePath: string): string {
  const rewardsStart = source.indexOf('\nrewards:');
  if (rewardsStart < 0) return source;
  const constraintsStart = source.indexOf('\nglobalConstraints:', rewardsStart);
  const end = constraintsStart < 0 ? source.length : constraintsStart;
  const section = source.slice(rewardsStart, end);
  const starts = [...section.matchAll(/^  - category:/gm)].map((match) => match.index);
  if (starts.length === 0) return source;

  let migrated = section;
  for (let index = starts.length - 1; index >= 0; index -= 1) {
    const start = starts[index]!;
    const finish = index + 1 < starts.length ? starts[index + 1]! : section.length;
    const block = section.slice(start, finish);
    const next = migrateRewardBlock(block, relativePath, index);
    migrated = `${migrated.slice(0, start)}${next}${migrated.slice(finish)}`;
  }

  return applyUnsupportedDecisions(
    `${source.slice(0, rewardsStart)}${migrated}${source.slice(end)}`,
  );
}

const changed: string[] = [];
for await (const file of CARD_GLOB.scan({ cwd: ROOT, absolute: true })) {
  const relativePath = relative(ROOT, file);
  const source = await readFile(file, 'utf8');
  const migrated = migrateFile(source, relativePath);
  if (migrated === source) continue;
  changed.push(relativePath);
  if (write) await writeFile(file, migrated, 'utf8');
}

if (changed.length === 0) {
  console.log('Domain contract migration is clean.');
} else if (write) {
  console.log(`Migrated ${changed.length} card files.`);
} else {
  console.error(`Domain contract migration required in ${changed.length} card files:`);
  for (const file of changed) console.error(`  ${file}`);
  process.exitCode = 1;
}

if (check && changed.length > 0) process.exitCode = 1;
