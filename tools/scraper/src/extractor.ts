import Anthropic from '@anthropic-ai/sdk';
import type { CardRuleSet } from '@cherrypicker/rules';
import { SYSTEM_PROMPT } from './prompts/system.js';
import { CARD_RULE_EXTRACTION_TOOL } from './prompts/schemas.js';
import { validateExtractedRules } from './validators.js';
import type { ScraperIssuer } from './config.js';
import { getCanonicalScraperRuleContract } from './rule-contract.js';

export const CARD_EXTRACTION_MAX_INPUT_CHARS = 40_000;
export const CARD_EXTRACTION_MAX_OUTPUT_TOKENS = 8_192;

export interface CardExtractionInputSize {
  originalChars: number;
  sentChars: number;
  maxChars: number;
}

export class CardExtractionInputTooLargeError extends Error {
  readonly code = 'CARD_EXTRACTION_INPUT_TOO_LARGE';
  readonly originalChars: number;
  readonly sentChars = 0;
  readonly maxChars = CARD_EXTRACTION_MAX_INPUT_CHARS;

  constructor(originalChars: number) {
    super(
      '카드 상품 페이지가 LLM 입력 한도를 초과했습니다. ' +
      `originalChars=${originalChars}, sentChars=0, maxChars=${CARD_EXTRACTION_MAX_INPUT_CHARS}`,
    );
    this.name = 'CardExtractionInputTooLargeError';
    this.originalChars = originalChars;
  }
}

export function inspectCardExtractionInput(
  pageContent: string,
): CardExtractionInputSize {
  const originalChars = pageContent.length;
  if (originalChars > CARD_EXTRACTION_MAX_INPUT_CHARS) {
    throw new CardExtractionInputTooLargeError(originalChars);
  }
  return {
    originalChars,
    sentChars: originalChars,
    maxChars: CARD_EXTRACTION_MAX_INPUT_CHARS,
  };
}

export interface CardExtractionClient {
  messages: {
    create(
      request: Anthropic.MessageCreateParamsNonStreaming,
    ): Promise<Anthropic.Message>;
  };
}

export type ScraperClock = () => Date;

function stampTrustedProvenance(raw: unknown, lastUpdated: string): unknown {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  const card = (raw as { card?: unknown }).card;
  if (card === null || typeof card !== 'object' || Array.isArray(card)) {
    return raw;
  }
  return {
    ...raw,
    card: {
      ...card,
      lastUpdated,
    },
  };
}

/**
 * Use Claude to extract structured card rules from page content.
 */
export async function extractCardRules(
  pageContent: string,
  issuer: ScraperIssuer,
  client: CardExtractionClient = new Anthropic() as CardExtractionClient,
  clock: ScraperClock = () => new Date(),
): Promise<CardRuleSet> {
  const request = buildCardExtractionRequest(pageContent, issuer);
  const response = await client.messages.create(request);
  return parseCardExtractionResponse(response, issuer, clock);
}

export function buildCardExtractionRequest(
  pageContent: string,
  issuer: ScraperIssuer,
  model = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-5',
): Anthropic.MessageCreateParamsNonStreaming {
  inspectCardExtractionInput(pageContent);
  const userMessage = `다음은 "${issuer}" 카드사의 카드 상품 페이지 내용입니다.
이 페이지에서 카드 혜택 규칙을 추출하여 extract_card_rules 도구를 호출하세요.

---
${pageContent}
---

위 내용을 분석하여 카드 혜택 정보를 extract_card_rules 도구로 반환하세요.
issuer 필드는 "${issuer}"로 설정하세요.`;

  return {
    model,
    // Structured tool output needs the complete output budget. Do not let an
    // implicit/adaptive thinking allocation consume it.
    thinking: { type: 'disabled' },
    max_tokens: CARD_EXTRACTION_MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [CARD_RULE_EXTRACTION_TOOL as Anthropic.Tool],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userMessage }],
  };
}

export function parseCardExtractionResponse(
  response: Anthropic.Message,
  issuer: ScraperIssuer,
  clock: ScraperClock = () => new Date(),
): CardRuleSet {
  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      `Claude 카드 규칙 응답이 ${CARD_EXTRACTION_MAX_OUTPUT_TOKENS} 토큰 한도에서 잘렸습니다.`,
    );
  }
  // Find the tool_use block
  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude가 도구 호출을 반환하지 않았습니다. 응답: ' + JSON.stringify(response.content));
  }

  if (toolUse.name !== 'extract_card_rules') {
    throw new Error(`예상치 못한 도구 호출: ${toolUse.name}`);
  }

  const extractedAt = clock();
  if (!Number.isFinite(extractedAt.getTime())) {
    throw new Error('스크래퍼 추출 시각이 올바르지 않습니다.');
  }
  const lastUpdated = extractedAt.toISOString().slice(0, 10);
  const raw = stampTrustedProvenance(toolUse.input, lastUpdated);
  const validation = validateExtractedRules(
    raw,
    issuer,
    getCanonicalScraperRuleContract(),
    extractedAt,
  );

  if (!validation.valid || !validation.result) {
    throw new Error(
      `추출된 규칙 검증 실패:\n${validation.errors.join('\n')}`,
    );
  }

  return validation.result;
}
