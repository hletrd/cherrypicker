import { createInterface } from 'node:readline';

/** Detect whether the statement file may trigger remote LLM fallback.
 *  Currently only PDF files use LLM fallback. */
function isPotentialLLMFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.pdf');
}

/** Check if running in non-interactive mode (--yes or CI environment). */
function isNonInteractive(yesFlag: boolean): boolean {
  return yesFlag || !!process.env.CI;
}

/** Prompt the user for LLM fallback consent interactively.
 *  Returns true if user confirms, false otherwise. */
async function promptConsent(): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('This will send up to 8000 chars to Anthropic. Continue? (y/N) ', (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

/** Enforce LLM fallback consent before parsing a potentially-PDF statement.
 *  Throws if --allow-remote-llm is missing. Prompts interactively unless
 *  --yes or CI is set. Returns the allowRemoteLLM value to pass to parseStatement. */
export async function requireRemoteLLMConsent(
  filePath: string,
  allowRemoteLLM: boolean,
  yesFlag: boolean,
): Promise<boolean> {
  if (!isPotentialLLMFile(filePath)) {
    return false; // No LLM fallback needed for non-PDF files
  }

  if (!allowRemoteLLM) {
    throw new Error(
      '원격 LLM 폴백이 비활성화되어 있습니다.\n' +
        'PDF 명세서 파싱을 위해 Anthropic API로 최대 8000자의 데이터가 전송됩니다.\n' +
        '이를 허용하려면 --allow-remote-llm 플래그를 추가하세요.\n' +
        '  예시: cherrypicker analyze statement.pdf --allow-remote-llm',
    );
  }

  if (isNonInteractive(yesFlag)) {
    return true;
  }

  const confirmed = await promptConsent();
  if (!confirmed) {
    throw new Error('사용자가 원격 LLM 폴백을 거부했습니다.');
  }

  return true;
}
