/**
 * Browser AI categorization is intentionally disabled until the runtime can be
 * fully self-hosted. The previous implementation loaded executable code from a
 * public CDN, which is not acceptable for a statement-analysis surface.
 */

const DISABLED_MESSAGE =
  '브라우저 AI 분류는 자체 호스팅된 런타임이 준비될 때까지 비활성화되어 있습니다.';

export interface AICategoryResult {
  category: string;
  confidence: number;
  method: 'ai-embedding';
}

export function isAvailable(): boolean {
  return false;
}

export function getLoadingState(): { loading: boolean; error: string | null } {
  return { loading: false, error: DISABLED_MESSAGE };
}

export async function initialize(
  _onProgress?: (progress: { status: string; progress?: number }) => void,
): Promise<void> {
  throw new Error(DISABLED_MESSAGE);
}

export async function categorize(_merchantName: string): Promise<AICategoryResult> {
  throw new Error(DISABLED_MESSAGE);
}

export async function categorizeBatch(
  _merchants: { id: string; name: string }[],
  _onProgress?: (done: number, total: number) => void,
): Promise<Map<string, AICategoryResult>> {
  throw new Error(DISABLED_MESSAGE);
}
