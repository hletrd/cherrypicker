export const ANTHROPIC_API_KEY_ENV = 'ANTHROPIC_API_KEY';
export const ANTHROPIC_MODEL_ENV = 'ANTHROPIC_MODEL';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';

const ANTHROPIC_API_KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{16,}$/;
const ANTHROPIC_MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type ScraperEnvironment = Readonly<
  Record<string, string | undefined>
>;

export interface ScraperRuntimeConfig {
  readonly apiKey: string;
  readonly model: string;
}

/**
 * Validate scraper-only configuration without network, filesystem, or SDK
 * construction. Error messages deliberately identify variables, never values.
 */
export function resolveScraperRuntimeConfig(
  environment: ScraperEnvironment = process.env,
): ScraperRuntimeConfig {
  const apiKey = environment[ANTHROPIC_API_KEY_ENV];
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(
      `${ANTHROPIC_API_KEY_ENV} 환경 변수가 필요합니다. ` +
      '셸의 비공개 환경 또는 비밀 관리자를 통해 주입하세요.',
    );
  }
  if (
    apiKey !== apiKey.trim() ||
    !ANTHROPIC_API_KEY_PATTERN.test(apiKey)
  ) {
    throw new Error(
      `${ANTHROPIC_API_KEY_ENV} 형식이 올바르지 않습니다. ` +
      '셸 또는 비밀 관리자에서 값을 다시 주입하세요.',
    );
  }

  const configuredModel = environment[ANTHROPIC_MODEL_ENV];
  const model = configuredModel ?? DEFAULT_ANTHROPIC_MODEL;
  if (
    model !== model.trim() ||
    !ANTHROPIC_MODEL_PATTERN.test(model)
  ) {
    throw new Error(
      `${ANTHROPIC_MODEL_ENV} 형식이 올바르지 않습니다. ` +
      '공백이나 제어 문자가 없는 모델 ID를 사용하세요.',
    );
  }

  return { apiKey, model };
}
