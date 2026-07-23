import { describe, test, expect } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import {
  buildPDFLLMRequest,
  parsePDFLLMResponse,
  parsePDFWithLLM,
  PDF_LLM_MAX_INPUT_CHARS,
  PDF_LLM_MAX_OUTPUT_TOKENS,
} from '../src/pdf/llm-fallback.js';

function message(
  text: string,
  stopReason: Anthropic.Message['stop_reason'] = 'end_turn',
): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text, citations: null }],
    model: 'claude-sonnet-5',
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as Anthropic.Message;
}

describe('parsePDFWithLLM API key validation', () => {
  const originalKey = process.env['ANTHROPIC_API_KEY'];

  function restoreKey(): void {
    if (originalKey !== undefined) {
      process.env['ANTHROPIC_API_KEY'] = originalKey;
    } else {
      delete process.env['ANTHROPIC_API_KEY'];
    }
  }

  test('throws when API key is missing', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    await expect(parsePDFWithLLM('test')).rejects.toThrow('API 키가 설정되지 않아');
    restoreKey();
  });

  test('throws when API key has invalid prefix', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'invalid-key-12345';
    await expect(parsePDFWithLLM('test')).rejects.toThrow('sk-ant-');
    restoreKey();
  });

  test('throws when API key is too short', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-short';
    await expect(parsePDFWithLLM('test')).rejects.toThrow('sk-ant-');
    restoreKey();
  });

  test('accepts a well-formed key without making a live API request', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-api03-' + 'a'.repeat(95);
    const result = await parsePDFWithLLM('test', {
      createMessage: async () =>
        message('[{"date":"2026-07-23","merchant":"테스트","amount":1000}]'),
    });
    expect(result).toEqual([
      { date: '2026-07-23', merchant: '테스트', amount: 1000 },
    ]);
    restoreKey();
  });
});

describe('PDF Sonnet output contract', () => {
  test('disables thinking and reserves the structured-output budget', () => {
    const request = buildPDFLLMRequest('statement text', 'claude-sonnet-5');
    expect(request.model).toBe('claude-sonnet-5');
    expect(request.thinking).toEqual({ type: 'disabled' });
    expect(request.max_tokens).toBe(PDF_LLM_MAX_OUTPUT_TOKENS);
    expect(request.max_tokens).toBe(8192);
  });

  test('reports truncation before JSON parsing', () => {
    expect(() =>
      parsePDFLLMResponse(message('[{"partial":', 'max_tokens')),
    ).toThrow('토큰 한도에서 잘렸습니다');
  });

  test('rejects a partial response instead of silently filtering malformed rows', () => {
    expect(() =>
      parsePDFLLMResponse(
        message(JSON.stringify([
          { date: '2026-07-23', merchant: '유효', amount: 1200 },
          { date: 'bad-date', merchant: '제외', amount: 500 },
        ])),
      ),
    ).toThrow('2개 행 중 1개');
  });

  test.each(['', '   '])('rejects a blank merchant value %j', (merchant) => {
    try {
      parsePDFLLMResponse(
        message(JSON.stringify([
          { date: '2026-07-23', merchant, amount: 1200 },
        ])),
      );
      throw new Error('blank merchant response should have been rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('1개 행 중 1개');
      expect((error as Error & { code?: string }).code)
        .toBe('missing_required_merchant');
    }
  });

  test('rejects input beyond the complete single-request ceiling', () => {
    expect(() =>
      buildPDFLLMRequest('가'.repeat(PDF_LLM_MAX_INPUT_CHARS + 1)),
    ).toThrow(`${PDF_LLM_MAX_INPUT_CHARS} 글자`);
    const request = buildPDFLLMRequest(
      '가'.repeat(PDF_LLM_MAX_INPUT_CHARS),
      'claude-sonnet-5',
    );
    const content = request.messages[0]!.content;
    expect(typeof content).toBe('string');
    expect(content).not.toContain('truncated');
  });
});
