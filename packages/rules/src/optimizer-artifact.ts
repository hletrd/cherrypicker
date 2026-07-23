import { z } from 'zod';
import { cardRuleSetSchema } from './schema.js';

const PUBLICATION_ID_PATTERN = /^[a-f0-9]{64}$/;

export const optimizerCatalogArtifactSchema = z
  .object({
    sourceHash: z.string().regex(
      PUBLICATION_ID_PATTERN,
      'sourceHash must be exactly 64 lowercase hexadecimal characters',
    ),
    cards: z.array(cardRuleSetSchema).min(1),
  })
  .strict()
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    artifact.cards.forEach((card, index) => {
      if (ids.has(card.card.id)) {
        context.addIssue({
          code: 'custom',
          path: ['cards', index, 'card', 'id'],
          message: `duplicate card id "${card.card.id}"`,
        });
      }
      ids.add(card.card.id);
    });
  });

export type OptimizerCatalogArtifact = z.output<
  typeof optimizerCatalogArtifactSchema
>;

function firstValidationIssue(
  error: z.ZodError,
): { path: string; message: string } {
  const issue = error.issues[0];
  return {
    path: issue?.path.length ? `.${issue.path.join('.')}` : '',
    message: issue?.message ?? 'invalid optimizer artifact',
  };
}

/**
 * Validate and normalize the compiled optimizer artifact without depending on
 * Node filesystem APIs, so browser and CLI consumers can share the contract.
 */
export function parseOptimizerCatalogArtifact(
  value: unknown,
  label = 'Compiled optimizer artifact',
): OptimizerCatalogArtifact {
  const result = optimizerCatalogArtifactSchema.safeParse(value);
  if (!result.success) {
    const issue = firstValidationIssue(result.error);
    throw new Error(`${label}${issue.path}: ${issue.message}`);
  }
  return result.data;
}
