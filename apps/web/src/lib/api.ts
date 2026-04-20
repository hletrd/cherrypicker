import { getCardList, getCardById } from './cards.js';

// Re-export types that components currently import
export type { CardSummary, CardDetail, PerformanceTier, RewardTier, RewardEntry } from './cards.js';

// Legacy type kept for any remaining references
export interface UploadResult {
  success: boolean;
  fileName: string;
  size: number;
  type: string;
  detection: {
    format: string;
    bank: string | null;
    confidence: number;
    encoding?: string;
  };
}

export async function getCards(filters?: {
  issuer?: string;
  type?: string;
}, options?: { signal?: AbortSignal }) {
  return getCardList(filters, options);
}

export async function getCardDetail(cardId: string, options?: { signal?: AbortSignal }) {
  const card = await getCardById(cardId, options);
  if (!card) throw new Error('카드를 찾을 수 없어요');
  return card;
}
