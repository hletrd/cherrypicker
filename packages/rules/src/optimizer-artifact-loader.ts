import { readFile } from 'node:fs/promises';
import { parseOptimizerCatalogArtifact } from './optimizer-artifact.js';
import type { OptimizerCatalogArtifact } from './optimizer-artifact.js';

export async function loadOptimizerCatalogArtifact(
  filePath: string,
): Promise<OptimizerCatalogArtifact> {
  let serialized: string;
  try {
    serialized = await readFile(filePath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to read compiled optimizer artifact at ${filePath}: ${message}`,
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Invalid JSON in compiled optimizer artifact at ${filePath}: ${message}`,
    );
  }

  return parseOptimizerCatalogArtifact(
    value,
    `Invalid compiled optimizer artifact at ${filePath}`,
  );
}
