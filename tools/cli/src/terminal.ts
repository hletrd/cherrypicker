import { sanitizeTerminalText } from '@cherrypicker/viz';

export { sanitizeTerminalText } from '@cherrypicker/viz';

export function formatParseWarning(error: {
  line?: number;
  message: string;
}): string {
  const line = error.line ? `[${error.line}행] ` : '';
  return `  ${line}${sanitizeTerminalText(error.message)}`;
}
