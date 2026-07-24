import { describe, expect, test } from 'bun:test';
import ts from 'typescript';
import type { CategoryNode } from '../../packages/rules/src/index.js';
import {
  buildFallbackCategoryLabelsModule,
  fallbackCategoryLabelEntries,
} from '../category-label-publication.js';

describe('fallback category label publication', () => {
  test('serializes labels as data and round-trips source-significant text', async () => {
    const rootId = "root'\\\n\u2028${template}</script>";
    const rootLabel = "루트'\\\n\u2029${label}</script>";
    const childId = "child'\\\n\u2029${child}</script>";
    const childLabel = "하위'\\\n\u2028${label}</script>";
    const duplicateLabel = '중복 키의 마지막 값';
    const categories: CategoryNode[] = [
      {
        id: rootId,
        labelKo: rootLabel,
        labelEn: 'Root',
        keywords: [],
        subcategories: [
          {
            id: childId,
            labelKo: childLabel,
            labelEn: 'Child',
            keywords: [],
          },
        ],
      },
      {
        id: childId,
        labelKo: duplicateLabel,
        labelEn: 'Duplicate key',
        keywords: [],
      },
    ];
    const expected: ReturnType<typeof fallbackCategoryLabelEntries> = [
      [rootId, rootLabel],
      [childId, childLabel],
      [`${rootId}.${childId}`, childLabel],
      [childId, duplicateLabel],
    ];
    const source = buildFallbackCategoryLabelsModule(categories);

    expect(fallbackCategoryLabelEntries(categories)).toEqual(expected);
    expect(source).not.toContain('\u2028');
    expect(source).not.toContain('\u2029');
    expect(source).toContain('\\u2028');
    expect(source).toContain('\\u2029');

    const fileName = '/generated/category-labels-fallback.ts';
    const compilerOptions: ts.CompilerOptions = {
      lib: ['lib.es2022.d.ts'],
      module: ts.ModuleKind.ESNext,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      types: [],
    };
    const defaultHost = ts.createCompilerHost(compilerOptions);
    const host: ts.CompilerHost = {
      ...defaultHost,
      fileExists: (path) =>
        path === fileName || defaultHost.fileExists(path),
      getSourceFile: (path, languageVersion) =>
        path === fileName
          ? ts.createSourceFile(
              fileName,
              source,
              languageVersion,
              true,
              ts.ScriptKind.TS,
            )
          : defaultHost.getSourceFile(path, languageVersion),
      readFile: (path) =>
        path === fileName ? source : defaultHost.readFile(path),
      writeFile: () => {},
    };
    const program = ts.createProgram(
      [fileName],
      compilerOptions,
      host,
    );
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      ),
    ).toEqual([]);

    const javascript = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const generated = await import(
      `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
    ) as {
      FALLBACK_CATEGORY_LABELS: ReadonlyMap<string, string>;
    };

    expect(generated.FALLBACK_CATEGORY_LABELS).toBeInstanceOf(Map);
    expect([...generated.FALLBACK_CATEGORY_LABELS]).toEqual([
      ...new Map(expected),
    ]);
  });
});
