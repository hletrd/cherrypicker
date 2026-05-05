import { describe, expect, test } from 'bun:test';
import { ParseError } from '../src/lib/parser/types.js';

describe('ParseError (web-side)', () => {
  test('extends Error (instanceof compatible)', () => {
    const err = new ParseError('test message');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ParseError);
    expect(err.name).toBe('ParseError');
    expect(err.message).toBe('test message');
  });

  test('accepts line, raw, file, and format options', () => {
    const err = new ParseError('bad data', {
      line: 42,
      raw: 'raw input',
      file: 'statement.csv',
      format: 'csv',
    });
    expect(err.line).toBe(42);
    expect(err.raw).toBe('raw input');
    expect(err.file).toBe('statement.csv');
    expect(err.format).toBe('csv');
  });

  test('omitted options are undefined', () => {
    const err = new ParseError('simple error');
    expect(err.line).toBeUndefined();
    expect(err.raw).toBeUndefined();
    expect(err.file).toBeUndefined();
    expect(err.format).toBeUndefined();
  });
});
