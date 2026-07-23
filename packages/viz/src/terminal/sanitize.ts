const OSC_SEQUENCE = /(?:\u001b\]|\u009d)[\s\S]*?(?:\u0007|\u001b\\)/g;
const CSI_SEQUENCE = /(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]/g;
const ESCAPE_SEQUENCE = /\u001b[ -/]*[@-~]/g;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;
const BIDI_CONTROLS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Convert untrusted display text into one terminal-safe visible line.
 *
 * Terminal output may still contain formatting emitted by the table library,
 * but caller-controlled OSC/CSI/escape, control, and bidi sequences are
 * removed before the value reaches that renderer.
 */
export function sanitizeTerminalText(value: unknown): string {
  return String(value)
    .replace(OSC_SEQUENCE, '')
    .replace(CSI_SEQUENCE, '')
    .replace(ESCAPE_SEQUENCE, '')
    .replace(BIDI_CONTROLS, '')
    .replace(CONTROL_CHARACTERS, ' ');
}
