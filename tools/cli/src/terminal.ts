const OSC_SEQUENCE = /(?:\u001b\]|\u009d)[\s\S]*?(?:\u0007|\u001b\\)/g;
const CSI_SEQUENCE = /(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]/g;
const ESCAPE_SEQUENCE = /\u001b[ -/]*[@-~]/g;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;
const BIDI_CONTROLS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Render untrusted statement/path data without letting it control a terminal.
 * Line-breaking controls become spaces so one logical diagnostic remains one
 * visible terminal line.
 */
export function sanitizeTerminalText(value: unknown): string {
  return String(value)
    .replace(OSC_SEQUENCE, '')
    .replace(CSI_SEQUENCE, '')
    .replace(ESCAPE_SEQUENCE, '')
    .replace(BIDI_CONTROLS, '')
    .replace(CONTROL_CHARACTERS, ' ');
}

export function formatParseWarning(error: {
  line?: number;
  message: string;
}): string {
  const line = error.line ? `[${error.line}행] ` : '';
  return `  ${line}${sanitizeTerminalText(error.message)}`;
}
