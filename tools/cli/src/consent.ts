import { createInterface } from 'node:readline';

export interface RemoteLLMConsentOptions {
  allowRemoteLLM: boolean;
  yes: boolean;
  documentIdentity?: string;
}

export interface RemoteLLMConsentDependencies {
  prompt?: (options: RemoteLLMConsentOptions) => Promise<boolean>;
  isCI?: () => boolean;
}

/** Prompt for consent after local parsing has confirmed that remote fallback is needed. */
async function promptRemoteLLMConsent(
  options: RemoteLLMConsentOptions,
): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      rl.close();
      reject(
        new Error(
          'LLM 동의 확인 시간이 초과되었습니다 (30초).\n' +
            '비대화형 모드에서 실행하려면 --yes 옵션을 사용하세요.',
        ),
      );
    }, 30000);

    const identity = options.documentIdentity
      ? ` 대상 문서: ${options.documentIdentity}.`
      : '';
    rl.question(
      `PDF 파싱을 위해 최대 8000자의 데이터가 Anthropic API로 전송됩니다.${identity} 계속하시겠습니까? (y/N) `,
      (answer) => {
        clearTimeout(timer);
        rl.close();
        const normalized = answer.trim().toLowerCase();
        resolve(normalized === 'y' || normalized === 'yes');
      },
    );
  });
}

/**
 * Authorize a remote LLM retry after local PDF parsing reports that it is
 * required. This function deliberately knows nothing about file extensions.
 */
export async function authorizeRemoteLLMFallback(
  options: RemoteLLMConsentOptions,
  dependencies: RemoteLLMConsentDependencies = {},
): Promise<void> {
  if (!options.allowRemoteLLM) {
    throw new Error(
      '로컬 PDF 분석으로 거래를 찾지 못했습니다.\n' +
        '원격 LLM 폴백을 사용하면 PDF 데이터 중 최대 8000자가 Anthropic API로 전송됩니다.\n' +
        '이를 허용하려면 --allow-remote-llm 플래그를 추가하세요.\n' +
        '  예시: cherrypicker analyze statement.pdf --allow-remote-llm',
    );
  }

  const isCI = dependencies.isCI ?? (() => Boolean(process.env.CI));
  if (options.yes) {
    return;
  }
  if (isCI()) {
    throw new Error(
      'CI 같은 비대화형 환경에서는 원격 LLM 데이터 전송에 명시적인 동의가 필요합니다.\n' +
        '--allow-remote-llm과 --yes 옵션을 함께 사용하세요.',
    );
  }

  const prompt = dependencies.prompt ?? promptRemoteLLMConsent;
  const confirmed = await prompt(options);
  if (!confirmed) {
    throw new Error('사용자가 원격 LLM 폴백을 거부했습니다.');
  }
}
