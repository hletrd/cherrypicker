import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const source = readFileSync(
  join(import.meta.dir, '../public/scripts/frame-guard.js'),
  'utf8',
);

interface GuardResult {
  removed: string[];
  attributes: Map<string, string>;
  navigations: string[];
}

function runGuard(options: {
  framed: boolean;
  throwOnNavigation?: boolean;
}): GuardResult {
  const removed: string[] = [];
  const attributes = new Map<string, string>();
  const navigations: string[] = [];
  const document = {
    documentElement: {
      classList: {
        remove(value: string) {
          removed.push(value);
        },
      },
      removeAttribute(name: string) {
        attributes.delete(name);
      },
      setAttribute(name: string, value: string) {
        attributes.set(name, value);
      },
    },
  };
  const selfWindow = { location: { href: 'https://app.example.test/' } };
  const topWindow = options.framed
    ? {
        location: {
          replace(value: string) {
            if (options.throwOnNavigation) {
              throw new Error('cross-origin navigation denied');
            }
            navigations.push(value);
          },
        },
      }
    : selfWindow;
  const window = {
    self: selfWindow,
    top: topWindow,
  };
  if (!options.framed) {
    window.self = window as unknown as typeof selfWindow;
    window.top = window as unknown as typeof topWindow;
  }

  runInNewContext(source, { document, window });
  return { removed, attributes, navigations };
}

describe('production frame guard', () => {
  it('reveals a top-level document immediately', () => {
    const result = runGuard({ framed: false });
    expect(result.removed).toEqual(['frame-guard-pending']);
    expect(result.attributes.has('data-frame-blocked')).toBe(false);
  });

  it('keeps a framed document blocked while attempting top navigation', () => {
    const result = runGuard({ framed: true });
    expect(result.removed).toEqual([]);
    expect(result.attributes.get('data-frame-blocked')).toBe('true');
    expect(result.navigations).toEqual(['https://app.example.test/']);
  });

  it('catches cross-origin escape failures without revealing the document', () => {
    const result = runGuard({ framed: true, throwOnNavigation: true });
    expect(result.removed).toEqual([]);
    expect(result.attributes.get('data-frame-blocked')).toBe('true');
    expect(result.navigations).toEqual([]);
  });
});
