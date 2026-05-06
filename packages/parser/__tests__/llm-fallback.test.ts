import { describe, test, expect } from 'bun:test';
import { parsePDFWithLLM } from '../src/pdf/llm-fallback.js';

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

  test('does not throw validation error for a well-formed key', async () => {
    // 90+ chars after the hyphen to match tightened regex (C36-SEC04)
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-api03-' + 'a'.repeat(95);
    // The function will proceed past validation and attempt an API call,
    // which will fail with a network/auth error. We verify the error is NOT about key format.
    await expect(parsePDFWithLLM('test')).rejects.not.toThrow('sk-ant-');
    restoreKey();
  });
});
