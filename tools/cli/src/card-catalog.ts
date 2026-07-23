import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  loadAllCardRules,
  loadOptimizerCatalogArtifact,
} from '@cherrypicker/rules';
import type { CardRuleSet } from '@cherrypicker/rules';

export const DEFAULT_OPTIMIZER_CATALOG_PATH = resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
  'apps/web/public/data/cards-optimizer.json',
);

export type LoadedCliCardCatalog =
  | {
      mode: 'compiled';
      cards: CardRuleSet[];
      sourceHash: string;
      path: string;
    }
  | {
      mode: 'authoring';
      cards: CardRuleSet[];
      path: string;
    };

export async function loadCliCardCatalog(
  authoringCardsDirectory?: string,
): Promise<LoadedCliCardCatalog> {
  if (authoringCardsDirectory !== undefined) {
    const cards = await loadAllCardRules(authoringCardsDirectory);
    if (cards.length === 0) {
      throw new Error(
        '카드 규칙 파일을 찾을 수 없습니다. --cards 옵션으로 규칙 디렉토리를 지정하세요.',
      );
    }
    return {
      mode: 'authoring',
      cards,
      path: authoringCardsDirectory,
    };
  }

  const artifact = await loadOptimizerCatalogArtifact(
    DEFAULT_OPTIMIZER_CATALOG_PATH,
  );
  return {
    mode: 'compiled',
    cards: artifact.cards,
    sourceHash: artifact.sourceHash,
    path: DEFAULT_OPTIMIZER_CATALOG_PATH,
  };
}

export function authoringCatalogDisclosure(
  catalog: LoadedCliCardCatalog,
): string | undefined {
  if (catalog.mode !== 'authoring') return undefined;
  return (
    `작성용 카드 규칙 모드: --cards로 지정한 ${catalog.path}의 YAML을 ` +
    '재귀 검증하여 사용합니다. 배포된 컴파일 최적화 카탈로그와 결과가 다를 수 있습니다.'
  );
}
