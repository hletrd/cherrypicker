import { describe, expect, test } from 'bun:test';
import { ParseError } from '../src/types.js';
import { parseJSON } from '../src/json/index.js';
import { parseOFX } from '../src/ofx/index.js';
import { parseHTML } from '../src/html/index.js';

describe('ParseError', () => {
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

  test('JSON parser constructs ParseError for invalid input', () => {
    const result = parseJSON('not valid json');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toBeInstanceOf(ParseError);
    expect(result.errors[0].message).toContain('JSON');
  });

  test('OFX parser constructs ParseError for invalid input', () => {
    const result = parseOFX('not valid ofx');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toBeInstanceOf(ParseError);
    expect(result.errors[0].message).toContain('OFX');
  });

  test('HTML parser constructs ParseError for invalid input', () => {
    const result = parseHTML('not valid html');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toBeInstanceOf(ParseError);
  });
});
