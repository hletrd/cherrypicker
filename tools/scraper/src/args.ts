import type { ScraperIssuer } from './config.js';
import { parseScraperIssuer } from './config.js';

export interface ScraperArgs {
  issuer: ScraperIssuer;
  url?: string;
  output: string;
  force: boolean;
  allowHosts: string[];
}

function requireValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} 옵션에 값이 필요합니다.`);
  }
  return value;
}

export function parseScraperArgs(args: string[], defaultOutput: string): ScraperArgs {
  let issuerValue: string | undefined;
  let url: string | undefined;
  let output = defaultOutput;
  let force = false;
  const allowHosts: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    switch (arg) {
      case '--issuer':
        issuerValue = requireValue(args, index, arg);
        index++;
        break;
      case '--url':
        url = requireValue(args, index, arg);
        index++;
        break;
      case '--output':
        output = requireValue(args, index, arg);
        index++;
        break;
      case '--allow-host':
        allowHosts.push(requireValue(args, index, arg));
        index++;
        break;
      case '--force':
        force = true;
        break;
      default:
        throw new Error(`알 수 없는 옵션입니다: ${arg}`);
    }
  }

  if (!issuerValue) {
    throw new Error('--issuer 옵션이 필요합니다.');
  }

  return {
    issuer: parseScraperIssuer(issuerValue),
    url,
    output,
    force,
    allowHosts,
  };
}
