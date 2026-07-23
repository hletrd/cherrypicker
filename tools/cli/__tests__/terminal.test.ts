import { describe, expect, test } from 'bun:test';
import {
  formatParseWarning,
  sanitizeTerminalText,
} from '../src/terminal.js';

describe('terminal-safe rendering', () => {
  test.each([
    ['CSI color', '\u001b[31mspoof\u001b[0m'],
    ['OSC-8 hyperlink', '\u001b]8;;https://example.invalid\u0007spoof\u001b]8;;\u0007'],
    ['OSC-52 clipboard', '\u001b]52;c;Y29weQ==\u0007spoof'],
    ['carriage return', 'safe\rspoof'],
    ['bidi override', 'safe\u202espoof'],
  ])('%s contains no terminal controls', (_name, payload) => {
    const rendered = sanitizeTerminalText(payload);
    expect(rendered).not.toMatch(/[\u001b\u0007\r\u202e]/);
    expect(rendered).toContain('spoof');
  });

  test('keeps a parser warning on one visible line', () => {
    const rendered = formatParseWarning({
      line: 7,
      message: 'bad\r\nnext\u001b[31mred',
    });
    expect(rendered.startsWith('  [7행] ')).toBe(true);
    expect(rendered).not.toMatch(/[\r\n\u001b]/);
  });
});
