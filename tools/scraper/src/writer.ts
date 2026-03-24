import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import type { CardRuleSet } from '@cherrypicker/rules';

/**
 * Serialize CardRuleSet to YAML and write to {outputDir}/{issuer}/{card-id}.yaml.
 * Returns the written file path.
 */
export async function writeCardRule(
  rule: CardRuleSet,
  outputDir: string,
): Promise<string> {
  const issuerDir = join(outputDir, rule.card.issuer);
  await mkdir(issuerDir, { recursive: true });

  const filePath = join(issuerDir, `${rule.card.id}.yaml`);

  const yamlContent = stringify(rule, {
    // Use 2-space indent
    indent: 2,
    // Keep null values explicit
    nullStr: 'null',
    // Quote strings that look like numbers or booleans
    defaultStringType: 'PLAIN',
    // Block style for readability
    collectionStyle: 'block',
    lineWidth: 120,
    // Sort keys for consistent output
    sortMapEntries: false,
  });

  // Add a header comment
  const today = new Date().toISOString().slice(0, 10);
  const header = [
    `# ${rule.card.nameKo} (${rule.card.name})`,
    `# 발급사: ${rule.card.issuer}`,
    `# 추출일: ${today}`,
    `# 출처: llm-scrape`,
    `# 이 파일은 자동 생성되었습니다. 내용을 검토 후 사용하세요.`,
    '',
  ].join('\n');

  await writeFile(filePath, header + yamlContent, 'utf-8');

  return filePath;
}
