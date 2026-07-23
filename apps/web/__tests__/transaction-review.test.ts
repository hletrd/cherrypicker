import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

interface TaxonomyNode {
  id: string;
  labelKo: string;
  subcategories?: TaxonomyNode[];
}

interface TaxonomyState {
  options: { id: string; label: string }[];
  groups: { label: string; options: { id: string; label: string }[] }[];
  labels: Map<string, string>;
  subcategoryToParent: Map<string, string>;
  canonicalize(selection: string): {
    category: string;
    subcategory: string | undefined;
  };
}

interface TransactionReviewModule {
  FALLBACK_TRANSACTION_CATEGORIES: TaxonomyNode[];
  buildTransactionTaxonomy(nodes: readonly TaxonomyNode[]): TaxonomyState;
}

const componentUrl = new URL(
  '../src/components/dashboard/TransactionReview.svelte',
  import.meta.url,
);
const componentSource = await readFile(componentUrl, 'utf8');
const moduleScript = componentSource.match(
  /<script module lang="ts">([\s\S]*?)<\/script>/,
)?.[1];

if (!moduleScript) {
  throw new Error('TransactionReview module script was not found');
}

const javascriptModule = ts.transpileModule(moduleScript, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const transactionReviewModule = new Function(
  `${javascriptModule.replace(/\bexport\s+/g, '')}
   return { FALLBACK_TRANSACTION_CATEGORIES, buildTransactionTaxonomy };`,
)() as TransactionReviewModule;

const categoriesArtifact = JSON.parse(
  await readFile(new URL('../public/data/categories.json', import.meta.url), 'utf8'),
) as { categories: TaxonomyNode[] };

function labelsOnly(nodes: readonly TaxonomyNode[]): TaxonomyNode[] {
  return nodes.map(node => ({
    id: node.id,
    labelKo: node.labelKo,
    ...(node.subcategories
      ? { subcategories: labelsOnly(node.subcategories) }
      : {}),
  }));
}

describe('TransactionReview taxonomy and keyboard contracts', () => {
  test('fallback labels stay complete and canonical with the fetched taxonomy', () => {
    const { FALLBACK_TRANSACTION_CATEGORIES, buildTransactionTaxonomy } =
      transactionReviewModule;

    expect(FALLBACK_TRANSACTION_CATEGORIES).toEqual(
      labelsOnly(categoriesArtifact.categories),
    );

    const fallback = buildTransactionTaxonomy(
      FALLBACK_TRANSACTION_CATEGORIES,
    );
    const fetched = buildTransactionTaxonomy(categoriesArtifact.categories);

    expect(fallback.options).toEqual(fetched.options);
    expect(fallback.groups).toEqual(fetched.groups);
    expect([...fallback.labels]).toEqual([...fetched.labels]);
    expect([...fallback.subcategoryToParent]).toEqual([
      ...fetched.subcategoryToParent,
    ]);
    expect(fallback.subcategoryToParent.get('dining.cafe')).toBe('dining');
    expect(fallback.canonicalize('dining.cafe')).toEqual({
      category: 'dining',
      subcategory: 'cafe',
    });
    expect(fetched.canonicalize('dining.cafe')).toEqual(
      fallback.canonicalize('dining.cafe'),
    );
    expect(fallback.canonicalize('convenience_store')).toEqual({
      category: 'convenience_store',
      subcategory: undefined,
    });
    expect(fallback.subcategoryToParent.has('grocery.convenience_store')).toBe(
      false,
    );
    expect(fallback.options).toContainEqual({
      id: 'convenience_store',
      label: '편의점',
    });
  });

  test('closed parent choices use qualified labels and options exist synchronously', () => {
    const taxonomy = transactionReviewModule.buildTransactionTaxonomy(
      transactionReviewModule.FALLBACK_TRANSACTION_CATEGORIES,
    );

    expect(taxonomy.groups.find(group => group.label === '외식')?.options[0])
      .toEqual({ id: 'dining', label: '외식 전체' });
    expect(taxonomy.groups.find(group => group.label === '기타')?.options[0])
      .toEqual({ id: 'uncategorized', label: '기타' });
    expect(componentSource).toContain(
      'let taxonomy = $state<TransactionTaxonomy>(fallbackTaxonomy)',
    );
    expect(componentSource).not.toContain(
      'let categoryGroups = $state<CategoryGroup[]>([])',
    );
  });

  test('filtered-row focus has ordered fallbacks and the table scroller is named', () => {
    expect(componentSource).toContain('await tick()');
    expect(componentSource).toContain('if (!selectElement.isConnected)');
    expect(componentSource).toContain(
      "panel.querySelector<HTMLButtonElement>('[data-testid=\"tx-apply-edits\"]')",
    );
    expect(componentSource).toContain('data-tx-category-select');
    expect(componentSource).toContain('data-tx-id={tx.id}');

    expect(componentSource).toContain('data-testid="tx-review-scroll-region"');
    expect(componentSource).toContain('role="region"');
    expect(componentSource).toContain('aria-label="거래 내역 분류 표"');
    expect(componentSource).toContain(
      'aria-describedby="tx-review-scroll-hint"',
    );
    expect(componentSource).toContain('tabindex="0"');
    expect(componentSource).toContain(
      'focus:ring-inset focus:ring-[var(--color-focus)]',
    );
    expect(componentSource).toContain('표를 좌우로 스크롤할 수 있어요');
  });
});
