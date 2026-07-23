import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

function inlineSVGTags(source: string): string[] {
  return source.match(/<svg\b[^>]*>/g) ?? [];
}

describe('decorative inline SVG accessibility semantics', () => {
  test('upload states expose no unnamed SVG image nodes', async () => {
    const source = await readFile(
      new URL('../src/components/upload/FileDropzone.svelte', import.meta.url),
      'utf8',
    );
    const svgTags = inlineSVGTags(source);

    expect(svgTags).toHaveLength(7);
    for (const tag of svgTags) {
      expect(tag).toContain('aria-hidden="true"');
      expect(tag).toContain('focusable="false"');
    }

    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('{uploadStatusMessage}');
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-label={`${file.name} 제거`}');
    expect(source).toContain('파일 추가');
    expect(source).toContain('분석하는 중');
    expect(source).toContain('문제가 생겼어요');
  });

  test('the official-card link keeps its text name without an exposed SVG', async () => {
    const source = await readFile(
      new URL('../src/components/cards/CardDetail.svelte', import.meta.url),
      'utf8',
    );
    const svgTags = inlineSVGTags(source);

    expect(svgTags).toHaveLength(1);
    expect(svgTags[0]).toContain('aria-hidden="true"');
    expect(svgTags[0]).toContain('focusable="false"');
    expect(source).toContain('공식 카드 페이지');
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
  });
});
