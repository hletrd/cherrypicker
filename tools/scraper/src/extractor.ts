import Anthropic from '@anthropic-ai/sdk';
import type { CardRuleSet } from '@cherrypicker/rules';
import { SYSTEM_PROMPT } from './prompts/system.js';
import { CARD_RULE_EXTRACTION_TOOL } from './prompts/schemas.js';
import { validateExtractedRules } from './validators.js';

const MAX_CONTENT_CHARS = 40_000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n\n[... 내용이 너무 길어 잘렸습니다]';
}

/**
 * Use Claude to extract structured card rules from page content.
 */
export async function extractCardRules(
  pageContent: string,
  issuer: string,
): Promise<CardRuleSet> {
  const client = new Anthropic();

  const userMessage = `다음은 "${issuer}" 카드사의 카드 상품 페이지 내용입니다.
이 페이지에서 카드 혜택 규칙을 추출하여 extract_card_rules 도구를 호출하세요.

---
${truncate(pageContent, MAX_CONTENT_CHARS)}
---

위 내용을 분석하여 카드 혜택 정보를 extract_card_rules 도구로 반환하세요.
issuer 필드는 "${issuer}"로 설정하세요.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [CARD_RULE_EXTRACTION_TOOL as Anthropic.Tool],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userMessage }],
  });

  // Find the tool_use block
  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude가 도구 호출을 반환하지 않았습니다. 응답: ' + JSON.stringify(response.content));
  }

  if (toolUse.name !== 'extract_card_rules') {
    throw new Error(`예상치 못한 도구 호출: ${toolUse.name}`);
  }

  const raw = toolUse.input;
  const validation = validateExtractedRules(raw);

  if (!validation.valid || !validation.result) {
    throw new Error(
      `추출된 규칙 검증 실패:\n${validation.errors.join('\n')}`,
    );
  }

  return validation.result;
}
