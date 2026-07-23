import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { ACCEPTED_STATEMENT_EXTENSIONS } from '../../apps/web/src/lib/supported-formats.js';
import {
  escapeMarkdownTableCell,
  ISSUER_INDEX_BEGIN,
  ISSUER_INDEX_END,
  loadReadmeCatalog,
  planReadmeUpdates,
  renderIssuerIndexSection,
  renderRootCatalogSection,
  replaceGeneratedSection,
  repositoryRoot,
  validateDocumentedCardExample,
  validateAstroMajorClaims,
  validateGeneratorInstructions,
  validateIssuerFreshnessMetadata,
  validateRootReadmeClaims,
  type ReadmeCatalog,
  type ReadmeCatalogIssuer,
} from '../readme-catalog.js';

function issuerFixture(
  overrides: Partial<ReadmeCatalogIssuer> = {},
): ReadmeCatalogIssuer {
  return {
    meta: {
      id: 'fixture',
      nameKo: '픽스처 카드',
      nameEn: 'Fixture Card',
      website: 'https://example.com',
    },
    cards: [
      {
        fileName: 'second.yaml',
        id: 'fixture-second',
        issuer: 'fixture',
        nameKo: '나 카드',
        type: 'check',
        lastUpdated: '2026-07-22',
      },
      {
        fileName: 'first.yaml',
        id: 'fixture-first',
        issuer: 'fixture',
        nameKo: '가 카드',
        type: 'credit',
        lastUpdated: '2026-07-23',
      },
    ],
    ...overrides,
  };
}

describe('README catalog rendering', () => {
  test('documents every canonical statement format alias', async () => {
    const expectedFormats = 'CSV/TSV, XLS/XLSX, PDF, JSON, OFX/QFX, HTML/HTM';
    const [readme, parserEntry] = await Promise.all([
      readFile(`${repositoryRoot}/README.md`, 'utf8'),
      readFile(`${repositoryRoot}/packages/parser/src/statement.ts`, 'utf8'),
    ]);

    expect(readme).toContain(expectedFormats);
    expect(parserEntry).toContain(expectedFormats);
    const parserDocumentation = parserEntry.match(
      /\/\*\*[\s\S]*?\*\/\nexport async function parseStatement/,
    )?.[0];
    expect(parserDocumentation).toBeDefined();
    for (const extension of ACCEPTED_STATEMENT_EXTENSIONS) {
      const alias = extension.slice(1).toUpperCase();
      const aliasPattern = new RegExp(`(?:^|[^A-Z0-9])${alias}(?:$|[^A-Z0-9])`);
      expect(aliasPattern.test(readme)).toBe(true);
      expect(aliasPattern.test(parserDocumentation!)).toBe(true);
    }
  });

  test('escapes Markdown table syntax and untrusted HTML', () => {
    expect(escapeMarkdownTableCell('A | B\\C\n<D>&` [link](x) *_~')).toBe(
      'A &#124; B&#92;C<br>&lt;D&gt;&amp;&#96; &#91;link&#93;(x) &#42;&#95;&#126;',
    );
  });

  test('orders issuer cards deterministically and reports canonical metadata', () => {
    const section = renderIssuerIndexSection(issuerFixture());

    expect(section).toContain('YAML 기준 **2개** · 최신 업데이트: `2026-07-23`');
    expect(section.indexOf('가 카드')).toBeLessThan(section.indexOf('나 카드'));
    expect(section).toContain('| 가 카드 | 신용 | [first.yaml](./first.yaml) |');
    expect(section).toContain('| 나 카드 | 체크 | [second.yaml](./second.yaml) |');
  });

  test('replaces only the generated marker range', () => {
    const before = '# Hand-written title\n\nHand-written introduction.\n\n';
    const after = '\n\nHand-written footer.\n';
    const original =
      before +
      `${ISSUER_INDEX_BEGIN}\nstale\n${ISSUER_INDEX_END}` +
      after;
    const generated =
      `${ISSUER_INDEX_BEGIN}\nfresh\n${ISSUER_INDEX_END}`;

    expect(
      replaceGeneratedSection(
        original,
        ISSUER_INDEX_BEGIN,
        ISSUER_INDEX_END,
        generated,
      ),
    ).toBe(before + generated + after);
  });

  test('rejects hand-written issuer freshness outside the generated index', () => {
    const generated =
      `${ISSUER_INDEX_BEGIN}\n` +
      '> YAML 기준 **2개** · 최신 업데이트: `2026-07-23`\n' +
      ISSUER_INDEX_END;

    expect(() =>
      validateIssuerFreshnessMetadata(
        `# Fixture\n\n> 마지막 업데이트: 2026-07-22\n\n${generated}\n`,
        'fixture/README.md',
      ),
    ).toThrow(/single authoritative freshness value/);
    expect(() =>
      validateIssuerFreshnessMetadata(
        `# Fixture\n\n${generated}\n`,
        'fixture/README.md',
      ),
    ).not.toThrow();
  });

  test('locks the root README to truthful recommendation and Astro claims', async () => {
    const readme = await readFile(`${repositoryRoot}/README.md`, 'utf8');

    expect(() => validateRootReadmeClaims(readme, '^7.1.3')).not.toThrow();
    expect(() =>
      validateRootReadmeClaims(
        readme.replace('연회비 차감 전 월간 총혜택', '예상 절약액'),
        '^7.1.3',
      ),
    ).toThrow(/missing recommendation disclosure/);
    expect(() => validateRootReadmeClaims(readme, '^8.0.0')).toThrow(
      /only Astro 8/,
    );
  });

  test('locks every active agent guide to the manifest Astro major', async () => {
    const [architectureGuide, webPackageSource] = await Promise.all([
      readFile(`${repositoryRoot}/.claude/CLAUDE.md`, 'utf8'),
      readFile(`${repositoryRoot}/apps/web/package.json`, 'utf8'),
    ]);
    const webPackage = JSON.parse(webPackageSource) as {
      dependencies?: Record<string, string>;
    };
    const astroVersion = webPackage.dependencies?.astro;
    expect(astroVersion).toBeDefined();
    expect(() =>
      validateAstroMajorClaims(
        architectureGuide,
        astroVersion!,
        '.claude/CLAUDE.md',
      ),
    ).not.toThrow();
    expect(() =>
      validateAstroMajorClaims(
        architectureGuide.replaceAll('Astro 7', 'Astro 6'),
        astroVersion!,
        '.claude/CLAUDE.md',
      ),
    ).toThrow(/only Astro 7/);
  });

  test('locks generator and generated-source instructions to data:build', async () => {
    const [generatorSource, generatedSource, rootPackageSource] =
      await Promise.all([
        readFile(`${repositoryRoot}/scripts/build-json.ts`, 'utf8'),
        readFile(
          `${repositoryRoot}/apps/web/src/lib/category-labels-fallback.ts`,
          'utf8',
        ),
        readFile(`${repositoryRoot}/package.json`, 'utf8'),
      ]);
    const rootPackage = JSON.parse(rootPackageSource) as {
      scripts?: Record<string, string>;
    };
    const dataBuildScript = rootPackage.scripts?.['data:build'];

    expect(() =>
      validateGeneratorInstructions(
        generatorSource,
        generatedSource,
        dataBuildScript,
      ),
    ).not.toThrow();
    expect(() =>
      validateGeneratorInstructions(
        generatorSource.replace(
          'bun run data:build',
          'node --experimental-strip-types scripts/build-json.ts',
        ),
        generatedSource,
        dataBuildScript,
      ),
    ).toThrow(/unsupported Node command/);
    expect(() =>
      validateGeneratorInstructions(
        generatorSource,
        generatedSource.replace(
          'bun run data:build',
          'node --experimental-strip-types scripts/build-json.ts',
        ),
        dataBuildScript,
      ),
    ).toThrow(/unsupported Node command/);
  });

  test('renders every root issuer once with a count sum matching the total', () => {
    const catalog: ReadmeCatalog = {
      issuers: [
        issuerFixture(),
        issuerFixture({
          meta: {
            id: 'small',
            nameKo: '작은 카드사',
            nameEn: 'Small Issuer',
            website: 'https://small.example.com',
          },
          cards: [issuerFixture().cards[0]!],
        }),
      ],
      totalCards: 3,
    };
    const section = renderRootCatalogSection(catalog);

    expect(section.match(/\| `fixture` \|/g)).toHaveLength(1);
    expect(section.match(/\| `small` \|/g)).toHaveLength(1);
    const counts = [...section.matchAll(/\| `(?:fixture|small)` \| (\d+) \|/g)]
      .map((match) => Number(match[1]));
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  test('checked-in root and issuer indexes exactly match all YAML sources', async () => {
    const catalog = await loadReadmeCatalog(repositoryRoot);
    const updates = await planReadmeUpdates(catalog, repositoryRoot);

    expect(
      updates
        .filter(({ current, expected }) => current !== expected)
        .map(({ path }) => path),
    ).toEqual([]);

    const rootRows = [
      ...(updates[0]!.current ?? '').matchAll(
        /^\| [^|]+ \| `([^`]+)` \| (\d+) \|$/gm,
      ),
    ];
    expect(rootRows.map((match) => match[1]).sort()).toEqual(
      catalog.issuers.map(({ meta }) => meta.id).sort(),
    );
    expect(
      rootRows.reduce((total, match) => total + Number(match[2]), 0),
    ).toBe(catalog.totalCards);

    for (const [index, update] of updates.slice(1).entries()) {
      const issuer = catalog.issuers[index]!;
      const markdown = update.current ?? '';
      const section = markdown.slice(
        markdown.indexOf(ISSUER_INDEX_BEGIN),
        markdown.indexOf(ISSUER_INDEX_END) + ISSUER_INDEX_END.length,
      );
      const indexedFiles = [...section.matchAll(/\]\(\.\/([^)]+)\)/g)]
        .map((match) => decodeURIComponent(match[1]!))
        .sort();
      expect(indexedFiles).toEqual(
        issuer.cards.map(({ fileName }) => fileName).sort(),
      );
    }
  });

  test('keeps the documented CLI examples executable through root scripts', async () => {
    const readme = await readFile(`${repositoryRoot}/README.md`, 'utf8');

    expect(readme).toContain('bun run analyze -- ./statement.csv');
    expect(readme).toContain(
      'bun run analyze -- ./statement.pdf --allow-remote-llm',
    );
  });

  test('keeps README and agent-guide YAML examples canonical', async () => {
    const [readme, agentGuide] = await Promise.all([
      readFile(`${repositoryRoot}/README.md`, 'utf8'),
      readFile(`${repositoryRoot}/.claude/AGENTS.md`, 'utf8'),
    ]);
    expect(() =>
      validateDocumentedCardExample(readme, 'README.md'),
    ).not.toThrow();
    expect(() =>
      validateDocumentedCardExample(agentGuide, '.claude/AGENTS.md'),
    ).not.toThrow();
  });
});
