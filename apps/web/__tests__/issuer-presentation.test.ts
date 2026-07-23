import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  UPLOAD_BANK_OPTIONS,
  formatCatalogIssuerNameKo,
  formatUploadBankName,
} from '../src/lib/issuer-presentation.js';
import { formatIssuerNameKo } from '../src/lib/formatters.js';

describe('issuer presentation identity', () => {
  test('distinguishes the shared BNK parser adapter from catalog identity', () => {
    expect(formatUploadBankName('bnk')).toBe('BNK부산·경남');
    expect(formatCatalogIssuerNameKo('bnk')).toBe('BNK부산은행');
    expect(formatIssuerNameKo('bnk')).toBe('BNK부산은행');
    expect(
      UPLOAD_BANK_OPTIONS.find(({ value }) => value === 'bnk')?.label,
    ).toBe('BNK부산·경남');
    expect(UPLOAD_BANK_OPTIONS).toHaveLength(24);
    expect(new Set(UPLOAD_BANK_OPTIONS.map(({ value }) => value)).size).toBe(
      UPLOAD_BANK_OPTIONS.length,
    );
  });

  test('prefers validated published metadata and has deterministic fallbacks', () => {
    expect(formatCatalogIssuerNameKo('bnk', ' BNK부산은행 ')).toBe(
      'BNK부산은행',
    );
    expect(formatCatalogIssuerNameKo('unknown')).toBe('unknown');
  });

  test('wires parser labels and published catalog identity into their surfaces', async () => {
    const [dropzone, grid, badge, dashboard] = await Promise.all([
      readFile(
        new URL('../src/components/upload/FileDropzone.svelte', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/components/cards/CardGrid.svelte', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/components/ui/IssuerBadge.svelte', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL(
          '../src/components/dashboard/SavingsComparison.svelte',
          import.meta.url,
        ),
        'utf8',
      ),
    ]);

    expect(dropzone).toContain('const ALL_BANKS = UPLOAD_BANK_OPTIONS');
    expect(dropzone).toContain('data-testid={`bank-pill-${b.value}`}');
    expect(grid).toContain(
      '<IssuerBadge issuer={card.issuer} label={card.issuerNameKo} compact />',
    );
    expect(badge).toContain('formatIssuerNameKo(issuer)');
    expect(dashboard).toContain('<IssuerBadge {issuer} />');
    expect(dropzone).not.toContain('BNK경남');
    expect(grid).not.toContain('BNK경남');
    expect(badge).not.toContain('BNK경남');
  });

  test('labels every shipped BNK catalog card with published Busan identity', async () => {
    const artifact = JSON.parse(
      await readFile(
        new URL('../public/data/cards-summary.json', import.meta.url),
        'utf8',
      ),
    ) as {
      issuers: Array<{ id: string; nameKo: string; cardCount: number }>;
      cards: Array<{ issuer: string }>;
    };
    const issuer = artifact.issuers.find(({ id }) => id === 'bnk');
    const cards = artifact.cards.filter((card) => card.issuer === 'bnk');

    expect(issuer).toMatchObject({
      id: 'bnk',
      nameKo: 'BNK부산은행',
      cardCount: cards.length,
    });
    expect(cards.length).toBeGreaterThan(0);
    expect(
      cards.every(
        ({ issuer: issuerId }) =>
          formatCatalogIssuerNameKo(issuerId, issuer?.nameKo) ===
          'BNK부산은행',
      ),
    ).toBe(true);
  });

  test('keeps every catalog fallback aligned with published issuer metadata', async () => {
    const artifact = JSON.parse(
      await readFile(
        new URL('../public/data/cards-summary.json', import.meta.url),
        'utf8',
      ),
    ) as {
      issuers: Array<{ id: string; nameKo: string }>;
    };

    for (const issuer of artifact.issuers) {
      expect(formatCatalogIssuerNameKo(issuer.id)).toBe(issuer.nameKo);
    }
  });
});
