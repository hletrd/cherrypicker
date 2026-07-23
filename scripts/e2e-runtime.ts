export const E2E_HOST = '127.0.0.1';
export const E2E_DEFAULT_PORT = 4173;
export const E2E_BASE_PATH = '/cherrypicker/';

export interface E2ERuntime {
  host: typeof E2E_HOST;
  port: number;
  basePath: typeof E2E_BASE_PATH;
  baseURL: string;
}

export function isValidE2EPort(port: unknown): port is number {
  return (
    typeof port === 'number' &&
    Number.isSafeInteger(port) &&
    port >= 1024 &&
    port <= 65_535
  );
}

export function buildE2EBaseURL(port: number): string {
  if (!isValidE2EPort(port)) {
    throw new Error(`Invalid E2E loopback port: ${String(port)}`);
  }
  return `http://${E2E_HOST}:${port}${E2E_BASE_PATH}`;
}

export function resolveE2ERuntime(
  env: Partial<Pick<
    NodeJS.ProcessEnv,
    'CHERRYPICKER_E2E_PORT' | 'PLAYWRIGHT_BASE_URL'
  >> = process.env,
): E2ERuntime {
  const rawPort = env.CHERRYPICKER_E2E_PORT;
  if (rawPort !== undefined && !/^\d+$/.test(rawPort)) {
    throw new Error(`CHERRYPICKER_E2E_PORT must be an integer: ${rawPort}`);
  }

  const port = rawPort === undefined ? E2E_DEFAULT_PORT : Number(rawPort);
  if (!isValidE2EPort(port)) {
    throw new Error(`CHERRYPICKER_E2E_PORT is outside the safe TCP range: ${rawPort}`);
  }

  const expectedBaseURL = buildE2EBaseURL(port);
  const baseURL = env.PLAYWRIGHT_BASE_URL ?? expectedBaseURL;
  let normalizedBaseURL: string;
  try {
    normalizedBaseURL = new URL(baseURL).href;
  } catch {
    throw new Error(`PLAYWRIGHT_BASE_URL is not a valid URL: ${baseURL}`);
  }
  if (normalizedBaseURL !== expectedBaseURL) {
    throw new Error(
      `PLAYWRIGHT_BASE_URL must match the selected loopback port and base path: ${expectedBaseURL}`,
    );
  }

  return {
    host: E2E_HOST,
    port,
    basePath: E2E_BASE_PATH,
    baseURL: expectedBaseURL,
  };
}
