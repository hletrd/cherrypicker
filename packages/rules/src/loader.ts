import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { parse } from 'yaml';
import { cardRuleSetSchema, categoriesFileSchema, issuersFileSchema } from './schema.js';
import type { CardRuleSet, CategoryNode, IssuerMeta } from './types.js';

export async function loadCardRule(filePath: string): Promise<CardRuleSet> {
  const content = await readFile(filePath, 'utf-8');
  const raw = parse(content) as unknown;
  const result = cardRuleSetSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid card rule at ${filePath}:\n${result.error.message}`);
  }
  return result.data;
}

async function collectYamlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectYamlFiles(fullPath);
      files.push(...nested);
    } else if (entry.isFile() && /\.ya?ml$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function loadAllCardRules(baseDir: string): Promise<CardRuleSet[]> {
  const yamlFiles = await collectYamlFiles(baseDir);
  const settled = await Promise.allSettled(
    yamlFiles.map((filePath) => loadCardRule(filePath)),
  );
  const results = [];
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    } else {
      console.warn(`[rules] Failed to load card rule: ${outcome.reason}`);
    }
  }
  return results;
}

export async function loadCategories(filePath: string): Promise<CategoryNode[]> {
  const content = await readFile(filePath, 'utf-8');
  const raw = parse(content) as unknown;
  const result = categoriesFileSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid categories file at ${filePath}:\n${result.error.message}`);
  }
  return result.data.categories as CategoryNode[];
}

export async function loadIssuers(filePath: string): Promise<IssuerMeta[]> {
  const content = await readFile(filePath, 'utf-8');
  const raw = parse(content) as unknown;
  const result = issuersFileSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid issuers file at ${filePath}:\n${result.error.message}`);
  }
  return result.data.issuers;
}
