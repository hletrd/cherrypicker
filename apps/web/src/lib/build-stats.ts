// Shared build-time card stats reader for Astro pages/layouts
// Eliminates duplication between index.astro and Layout.astro

import { readFile } from 'fs/promises';
import { resolve } from 'path';

export interface CardStats {
  totalCards: number;
  totalIssuers: number;
  totalCategories: number;
}

/** Read card statistics from the built cards.json at build time.
 *  Returns fallback values if the file is unavailable. */
export async function readCardStats(): Promise<CardStats> {
  let totalCards = 683;
  let totalIssuers = 24;
  let totalCategories = 45;
  try {
    const raw = await readFile(resolve(process.cwd(), 'public/data/cards.json'), 'utf-8');
    const data = JSON.parse(raw);
    totalCards = data.meta?.totalCards ?? totalCards;
    totalIssuers = data.meta?.totalIssuers ?? totalIssuers;
    totalCategories = data.meta?.categories?.length ?? totalCategories;
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.warn('[cherrypicker] cards.json is malformed at build time, using fallback stats:', err.message);
    } else {
      const code = (err as NodeJS.ErrnoException)?.code;
      const reason = code === 'ENOENT' ? 'not found' : code === 'EACCES' ? 'permission denied' : 'unreadable';
      console.warn(`[cherrypicker] cards.json ${reason} at build time, using fallback stats:`, err);
    }
  }
  return { totalCards, totalIssuers, totalCategories };
}
