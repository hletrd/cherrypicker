import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function visibleBindingClasses(
  componentPath: string,
  binding: string,
): Promise<string[]> {
  const source = await readFile(resolve(testDir, componentPath), 'utf8');
  const element = new RegExp(
    `<([a-z][\\w-]*)\\b([^>]*)>\\s*${escapeRegExp(binding)}\\s*</\\1>`,
  ).exec(source);
  expect(element, `${componentPath} must render ${binding}`).not.toBeNull();

  const classAttribute = /\bclass="([^"]*)"/.exec(element![2]);
  expect(
    classAttribute,
    `${componentPath} ${binding} must have a static class contract`,
  ).not.toBeNull();
  return classAttribute![1].split(/\s+/);
}

describe('long Korean name wrapping contracts', () => {
  test('keeps card and category names on word boundaries with overflow fallback', async () => {
    const fixtures = [
      {
        componentPath: '../src/components/cards/CardGrid.svelte',
        binding: '{card.nameKo}',
        longName: '신한카드대한민국국가대표생활비절약플래티넘체크카드',
      },
      {
        componentPath: '../src/components/dashboard/CategoryBreakdown.svelte',
        binding: '{cat.labelKo}',
        longName: '온라인쇼핑정기결제및생활밀착형구독서비스카테고리',
      },
    ] as const;

    for (const fixture of fixtures) {
      expect([...fixture.longName].length).toBeGreaterThan(20);
      const classes = await visibleBindingClasses(
        fixture.componentPath,
        fixture.binding,
      );
      expect(classes).toContain('break-keep');
      expect(classes).toContain('[overflow-wrap:anywhere]');
    }
  });
});
