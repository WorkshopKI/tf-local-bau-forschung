import { HASH_SEPARATOR } from './constants';
import type { ColumnMapping } from './types';

// MurmurHash3 x86 32-bit, adapted from imurmurhash (public-domain reference implementation).
// Returns an unsigned 32-bit integer as hex string.
export function murmurhash3(str: string, seed = 0): string {
  let h1 = seed >>> 0;
  const remainder = str.length & 3;
  const bytes = str.length - remainder;
  let i = 0;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let k1 = 0;

  while (i < bytes) {
    k1 =
      (str.charCodeAt(i) & 0xff) |
      ((str.charCodeAt(++i) & 0xff) << 8) |
      ((str.charCodeAt(++i) & 0xff) << 16) |
      ((str.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = ((k1 & 0xffff) * c1 + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = ((k1 & 0xffff) * c2 + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    const h1b = ((h1 & 0xffff) * 5 + ((((h1 >>> 16) * 5) & 0xffff) << 16)) & 0xffffffff;
    h1 = ((h1b & 0xffff) + 0x6b64 + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16)) & 0xffffffff;
  }

  k1 = 0;
  if (remainder >= 3) k1 ^= (str.charCodeAt(i + 2) & 0xff) << 16;
  if (remainder >= 2) k1 ^= (str.charCodeAt(i + 1) & 0xff) << 8;
  if (remainder >= 1) {
    k1 ^= str.charCodeAt(i) & 0xff;
    k1 = ((k1 & 0xffff) * c1 + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = ((k1 & 0xffff) * c2 + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
    h1 ^= k1;
  }

  h1 ^= str.length;

  h1 ^= h1 >>> 16;
  h1 = ((h1 & 0xffff) * 0x85ebca6b + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = ((h1 & 0xffff) * 0xc2b2ae35 + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 16;

  return (h1 >>> 0).toString(16).padStart(8, '0');
}

// Build the canonical hash input from a raw CSV row + mapping.
// - Only non-ignored columns are included
// - Column names sorted alphabetically
// - Values trimmed
// - Separator `\u001f` so embedded whitespace never collides
export function canonicalRowHash(
  row: Record<string, string>,
  mapping: ColumnMapping,
): string {
  const cols = Object.keys(mapping)
    .filter(k => !mapping[k]?.ignore)
    .sort();
  const parts: string[] = [];
  for (const col of cols) {
    const v = (row[col] ?? '').trim();
    parts.push(`${col}=${v}`);
  }
  return murmurhash3(parts.join(HASH_SEPARATOR));
}
