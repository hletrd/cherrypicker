import type { RewardRule } from './types.js';

export type UnmodeledRestrictionReason =
  | 'transaction_amount'
  | 'weekday'
  | 'occurrence_limit'
  | 'payment_channel'
  | 'payment_geography'
  | 'payment_method'
  | 'time_of_day'
  | 'user_choice'
  | 'country'
  | 'account_or_autopay';

const AMOUNT_RESTRICTION =
  /(?:건당|회당)[^ ]*(?:\s*[\d,.]+\s*(?:천|만)?원|\s*(?:이상|이하|미만|초과))|[\d,.]+\s*(?:천|만)?원\s*(?:이상|이하|미만|초과)/;
const WEEKDAY_RESTRICTION =
  /(?:평일|주말|주중|월요일|화요일|수요일|목요일|금요일|토요일|일요일|[월화수목금토일]\s*요일)/;
const OCCURRENCE_RESTRICTION =
  /(?:월|일)\s*(?:최대\s*)?\d+\s*(?:회|건)|(?:1일|하루)\s*(?:최대\s*)?\d+\s*(?:회|건)/;
const CHANNEL_RESTRICTION =
  /(?:온라인|오프라인)\s*(?:결제|가맹점|전용|이용|승인|매출|제외)/;
const PAYMENT_METHOD_RESTRICTION =
  /(?:네이버|카카오|삼성|애플|SOL|KB|NH|BC|페이코|토스)\s*(?:Pay|페이)|간편결제|QR\s*결제|실물카드/iu;
const TIME_RESTRICTION =
  /(?:(?:오전|오후)?\s*\d{1,2}\s*(?:시\s*)?(?:~|-)\s*(?:오전|오후)?\s*\d{1,2}\s*시|(?:오전|오후)?\s*\d{1,2}\s*시\s*(?:부터|이전|이후)|점심시간|시간대)/;
const USER_CHOICE_RESTRICTION =
  /(?:택\s*\d|선택\s*(?:서비스|혜택|업종)|월별\s*선택)/;
const COUNTRY_RESTRICTION =
  /(?:일본|미국|중국|유럽|동남아|베트남|태국)\s*(?:내|현지|가맹점|이용|결제)/;
const ACCOUNT_RESTRICTION =
  /(?:자동이체|결제계좌|급여이체|카드\s*등록)/;

function hasAmountPredicate(rule: RewardRule): boolean {
  return (
    rule.conditions?.minTransaction !== undefined ||
    rule.conditions?.maxTransaction !== undefined
  );
}

export function collectUnmodeledRuleRestrictions(
  rule: RewardRule,
): UnmodeledRestrictionReason[] {
  const text = `${rule.label ?? ''} ${rule.conditions?.note ?? ''}`;
  const reasons: UnmodeledRestrictionReason[] = [];

  if (AMOUNT_RESTRICTION.test(text) && !hasAmountPredicate(rule)) {
    reasons.push('transaction_amount');
  }
  if (WEEKDAY_RESTRICTION.test(text) && !rule.conditions?.weekdays) {
    reasons.push('weekday');
  }
  if (
    OCCURRENCE_RESTRICTION.test(text) &&
    (rule.conditions?.maxUses === undefined ||
      rule.conditions.usePeriod === undefined)
  ) {
    reasons.push('occurrence_limit');
  }
  if (CHANNEL_RESTRICTION.test(text) && !rule.conditions?.channel) {
    reasons.push('payment_channel');
  }
  if (
    !/국내외/.test(text) &&
    /(?:국내|해외)\s*(?:이용|가맹점|결제|승인|매출)/.test(text) &&
    !rule.conditions?.paymentType
  ) {
    reasons.push('payment_geography');
  }
  if (PAYMENT_METHOD_RESTRICTION.test(text)) {
    reasons.push('payment_method');
  }
  if (TIME_RESTRICTION.test(text)) {
    reasons.push('time_of_day');
  }
  if (USER_CHOICE_RESTRICTION.test(text)) {
    reasons.push('user_choice');
  }
  if (COUNTRY_RESTRICTION.test(text)) {
    reasons.push('country');
  }
  if (ACCOUNT_RESTRICTION.test(text)) {
    reasons.push('account_or_autopay');
  }

  return [...new Set(reasons)];
}

export function rewardConditionSignature(rule: RewardRule): string {
  const conditions = rule.conditions;
  return JSON.stringify({
    minTransaction: conditions?.minTransaction,
    maxTransaction: conditions?.maxTransaction,
    specificMerchants: [...(conditions?.specificMerchants ?? [])].sort(),
    weekdays: [...(conditions?.weekdays ?? [])].sort(
      (left, right) => left - right,
    ),
    maxUses: conditions?.maxUses,
    usePeriod: conditions?.usePeriod,
    channel: conditions?.channel,
    paymentType: conditions?.paymentType,
  });
}

export function sharedPerformanceTiers(
  left: RewardRule,
  right: RewardRule,
): boolean {
  const leftTiers = new Set(left.tiers.map((tier) => tier.performanceTier));
  return right.tiers.some((tier) => leftTiers.has(tier.performanceTier));
}
