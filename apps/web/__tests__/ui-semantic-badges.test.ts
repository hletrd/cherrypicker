import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { getIssuerColor } from '../src/lib/formatters.js';

function cssBlock(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match?.[1]) throw new Error(`Missing CSS block: ${selector}`);
  return match[1];
}

function cssVariable(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6})`, 'i'));
  if (!match?.[1]) throw new Error(`Missing CSS variable: --${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722
  );
}

function contrast(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function composite(
  foreground: string,
  background: string,
  alpha: number,
): string {
  const channels = (hex: string) =>
    [1, 3, 5].map((index) =>
      Number.parseInt(hex.slice(index, index + 2), 16)
    );
  const foregroundChannels = channels(foreground);
  const backgroundChannels = channels(background);
  return `#${
    foregroundChannels.map((channel, index) =>
      Math.round(
        channel * alpha + backgroundChannels[index]! * (1 - alpha),
      ).toString(16).padStart(2, '0')
    ).join('')
  }`;
}

describe('semantic small-text badges', () => {
  test('all centralized light and dark pairs meet WCAG AA', async () => {
    const stylesheet = await readFile(
      new URL('../src/app.css', import.meta.url),
      'utf8',
    );
    const modes = [
      cssBlock(stylesheet, ':root'),
      cssBlock(stylesheet, 'html.dark'),
    ];

    for (const mode of modes) {
      for (const tone of ['credit', 'check', 'prepaid', 'success']) {
        const foreground = cssVariable(mode, `badge-${tone}-fg`);
        const background = cssVariable(mode, `badge-${tone}-bg`);
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('catalog, detail, and confidence badges consume semantic classes', async () => {
    const [grid, detail, transactions] = await Promise.all([
      readFile(
        new URL('../src/components/cards/CardGrid.svelte', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/components/cards/CardDetail.svelte', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL(
          '../src/components/dashboard/TransactionReview.svelte',
          import.meta.url,
        ),
        'utf8',
      ),
    ]);

    for (const source of [grid, detail]) {
      expect(source).toContain('semantic-badge-credit');
      expect(source).toContain('semantic-badge-check');
      expect(source).toContain('semantic-badge-prepaid');
      expect(source).not.toContain('dark:text-blue-400');
      expect(source).not.toContain('dark:text-violet-400');
    }
    expect(transactions).toContain('semantic-badge-confidence-high');
    expect(transactions).not.toContain(
      'bg-blue-100 dark:bg-blue-900 px-1.5',
    );
  });

  test('source host text meets AA over every issuer header tint', async () => {
    const [stylesheet, detail, catalog] = await Promise.all([
      readFile(new URL('../src/app.css', import.meta.url), 'utf8'),
      readFile(
        new URL('../src/components/cards/CardDetail.svelte', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../public/data/cards.json', import.meta.url),
        'utf8',
      ),
    ]);
    const issuers = (JSON.parse(catalog) as {
      issuers: Array<{ id: string }>;
    }).issuers;
    const modes = [
      {
        variables: cssBlock(stylesheet, ':root'),
        backgroundVariable: 'color-bg',
      },
      {
        variables: cssBlock(stylesheet, 'html.dark'),
        backgroundVariable: 'color-bg',
      },
    ];

    expect(issuers).toHaveLength(24);
    expect(detail).toContain('text-[var(--color-source-host)]');
    for (const mode of modes) {
      const foreground = cssVariable(mode.variables, 'color-source-host');
      const background = cssVariable(
        mode.variables,
        mode.backgroundVariable,
      );
      for (const issuer of issuers) {
        const tintedBackground = composite(
          getIssuerColor(issuer.id),
          background,
          0x22 / 0xff,
        );
        expect(
          contrast(foreground, tintedBackground),
          `${issuer.id}: ${foreground} on ${tintedBackground}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
