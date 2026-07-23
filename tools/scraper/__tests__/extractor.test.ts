import { describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import {
  buildCardExtractionRequest,
  CARD_EXTRACTION_MAX_INPUT_CHARS,
  CARD_EXTRACTION_MAX_OUTPUT_TOKENS,
  CardExtractionInputTooLargeError,
  extractCardRules,
  inspectCardExtractionInput,
  parseCardExtractionResponse,
  type CardExtractionClient,
} from '../src/extractor.js';
import { CARD_RULE_EXTRACTION_TOOL } from '../src/prompts/schemas.js';
import { SYSTEM_PROMPT } from '../src/prompts/system.js';
import { makeCardRule } from './fixtures.js';

interface SchemaNode {
  type?: string;
  maximum?: number;
  anyOf?: SchemaNode[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
}

function message(
  content: Anthropic.ContentBlock[],
  stopReason: Anthropic.Message['stop_reason'] = 'end_turn',
): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content,
    model: 'claude-sonnet-5',
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as Anthropic.Message;
}

describe('card extraction Sonnet contract', () => {
  test('authors reward rates as canonical 0–100 percentage points', () => {
    const root = CARD_RULE_EXTRACTION_TOOL.input_schema as SchemaNode;
    const rateSchema = root.properties?.['rewards']?.items?.properties?.[
      'tiers'
    ]?.items?.properties?.['rate'];
    const numericRate = rateSchema?.anyOf?.find(
      (schema) => schema.type === 'number',
    );

    expect(numericRate?.maximum).toBe(100);
    expect(SYSTEM_PROMPT).toContain('5% → 5');
    expect(SYSTEM_PROMPT).not.toContain('5% → 0.05');
  });

  test('disables thinking and reserves an explicit structured-output budget', () => {
    const request = buildCardExtractionRequest(
      '카드 혜택 페이지',
      'shinhan',
      'claude-sonnet-5',
    );

    expect(request.model).toBe('claude-sonnet-5');
    expect(request.thinking).toEqual({ type: 'disabled' });
    expect(request.max_tokens).toBe(CARD_EXTRACTION_MAX_OUTPUT_TOKENS);
    expect(request.max_tokens).toBe(8192);
  });

  test.each([39_999, 40_000])(
    'sends a complete %i-character source without truncation',
    (size) => {
      const source = `TAIL-${'a'.repeat(size - 5)}`;
      const request = buildCardExtractionRequest(
        source,
        'shinhan',
        'claude-sonnet-5',
      );
      const content = request.messages[0]?.content;

      expect(inspectCardExtractionInput(source)).toEqual({
        originalChars: size,
        sentChars: size,
        maxChars: CARD_EXTRACTION_MAX_INPUT_CHARS,
      });
      expect(content).toContain(source);
      expect(content).toContain('TAIL-');
      expect(content).not.toContain('내용이 너무 길어 잘렸습니다');
    },
  );

  test('rejects 40,001 characters with machine-readable original and sent sizes', () => {
    const source = `${'a'.repeat(40_000)}Z`;
    let error: unknown;
    try {
      buildCardExtractionRequest(source, 'shinhan', 'claude-sonnet-5');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(CardExtractionInputTooLargeError);
    expect(error).toMatchObject({
      code: 'CARD_EXTRACTION_INPUT_TOO_LARGE',
      originalChars: 40_001,
      sentChars: 0,
      maxChars: 40_000,
    });
    expect((error as Error).message).toContain('originalChars=40001');
    expect((error as Error).message).toContain('sentChars=0');
  });

  test('fails before the model call when source completeness cannot be preserved', async () => {
    let modelCalls = 0;
    const client: CardExtractionClient = {
      messages: {
        create: async () => {
          modelCalls++;
          return message([]);
        },
      },
    };

    await expect(
      extractCardRules('a'.repeat(40_001), 'shinhan', client),
    ).rejects.toBeInstanceOf(CardExtractionInputTooLargeError);
    expect(modelCalls).toBe(0);
  });

  test('counts Unicode input in the same UTF-16 units used by the request boundary', () => {
    const exact = '😀'.repeat(20_000);
    expect(exact.length).toBe(40_000);
    expect(inspectCardExtractionInput(exact)).toEqual({
      originalChars: 40_000,
      sentChars: 40_000,
      maxChars: 40_000,
    });
    expect(() => inspectCardExtractionInput(`${exact}가`)).toThrow(
      CardExtractionInputTooLargeError,
    );
  });

  test('reports output truncation before tool parsing', () => {
    expect(() =>
      parseCardExtractionResponse(message([], 'max_tokens'), 'shinhan'),
    ).toThrow('토큰 한도에서 잘렸습니다');
  });

  test('validates a complete tool response against the expected issuer', () => {
    const result = parseCardExtractionResponse(
      message([
        {
          type: 'tool_use',
          id: 'tool_test',
          name: 'extract_card_rules',
          input: makeCardRule(),
        },
      ]),
      'shinhan',
    );
    expect(result.card.id).toBe('shinhan-security-test');
    expect(result.rewards[0]?.tiers[0]?.rate).toBe(5);
  });

  test('rejects a tool response that changes the expected issuer', () => {
    expect(() =>
      parseCardExtractionResponse(
        message([
          {
            type: 'tool_use',
            id: 'tool_test',
            name: 'extract_card_rules',
            input: makeCardRule({ issuer: 'kb' }),
          },
        ]),
        'shinhan',
      ),
    ).toThrow('요청한 카드사');
  });
});
