interface CatalogRewardLike {
  category: string;
  subcategory?: string;
  support:
    | { status: 'supported' }
    | { status: 'unsupported'; reason: string };
}

export function partitionCatalogRewards<T extends CatalogRewardLike>(
  rewards: readonly T[],
): { supported: T[]; unsupported: T[] } {
  const supported: T[] = [];
  const unsupported: T[] = [];
  for (const reward of rewards) {
    (reward.support.status === 'supported' ? supported : unsupported).push(
      reward,
    );
  }
  return { supported, unsupported };
}

export function catalogRewardCategoryKey(
  reward: Pick<CatalogRewardLike, 'category' | 'subcategory'>,
): string {
  return reward.subcategory
    ? `${reward.category}.${reward.subcategory}`
    : reward.category;
}
