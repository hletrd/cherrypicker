import { describe, expect, test } from 'bun:test';
import {
  MAX_PARSE_DIAGNOSTICS,
  MAX_PARSE_DIAGNOSTIC_MESSAGE_LENGTH,
  MAX_PARSE_DIAGNOSTIC_RAW_LENGTH,
  PARSE_DIAGNOSTICS_OMITTED_ERROR_CODE,
} from '../src/shared/diagnostics.js';
import { createParseErrorCollector, ParseError } from '../src/types.js';

describe('bounded parser diagnostics', () => {
  test('keeps 99 examples and one exact counted summary', () => {
    const errors = createParseErrorCollector();
    for (let index = 0; index < 150; index += 1) {
      errors.push(new ParseError(`row ${index}`));
    }

    expect(errors).toHaveLength(MAX_PARSE_DIAGNOSTICS);
    expect(errors.slice(0, 99).map(({ message }) => message))
      .toEqual(Array.from({ length: 99 }, (_, index) => `row ${index}`));
    expect(errors.at(-1)).toMatchObject({
      code: PARSE_DIAGNOSTICS_OMITTED_ERROR_CODE,
      count: 51,
    });
  });

  test('bounds retained message and raw payloads at creation time', () => {
    const errors = createParseErrorCollector();
    errors.push(new ParseError('m'.repeat(2_000), {
      raw: 'r'.repeat(4_000),
    }));

    expect(errors[0]?.message.length)
      .toBe(MAX_PARSE_DIAGNOSTIC_MESSAGE_LENGTH);
    expect(errors[0]?.raw?.length).toBe(MAX_PARSE_DIAGNOSTIC_RAW_LENGTH);
    expect(errors[0]?.message.endsWith('…')).toBe(true);
    expect(errors[0]?.raw?.endsWith('…')).toBe(true);
  });
});
