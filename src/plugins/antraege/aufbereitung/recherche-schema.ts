/**
 * Geteiltes Schema des Deep-Research-Rückwegs (Paket 5). EINE Wahrheit für
 *  - die Prompt-Erzeugung (Phase 1: der interne DR-Auftrag bittet das externe
 *    Modell um genau diesen JSON-Block ZUSÄTZLICH zum Report), und
 *  - den Import-Parser (Phase 2: strukturierte Übernahme des Rückwegs).
 * Nie zwei Wahrheiten — Prompt-Text + Parser lesen dieselbe Konstante.
 *
 * Die Kategorien teilen sich mit der Verwertung (`VERWERTUNG_KATEGORIEN`) plus
 * `sdt` für Stand-der-Technik-Aussagen (die im Recherche-Tab, nicht in der
 * Verwertungs-Gegenüberstellung erscheinen).
 */
import { VERWERTUNG_KATEGORIEN, type VerwertungKategorie } from './verwertung';

/** Aktuelle Schema-Version des externen Recherche-Rückwegs. */
export const RECHERCHE_SCHEMA_VERSION = 1;

/** Kategorien einer externen Aussage: die Verwertungs-Kategorien + `sdt`. */
export const EXTERN_KATEGORIEN = [...VERWERTUNG_KATEGORIEN, 'sdt'] as const;
export type ExternKategorie = VerwertungKategorie | 'sdt';

/** Ist der String eine bekannte externe Kategorie? */
export function istExternKategorie(v: unknown): v is ExternKategorie {
  return typeof v === 'string' && (EXTERN_KATEGORIEN as readonly string[]).includes(v);
}

/**
 * Menschenlesbare Beschreibung des JSON-Blocks, den der externe DR-Auftrag am Ende
 * seines Reports anfügen soll. Wird wörtlich in den erzeugten DR-Prompt eingebettet
 * (Phase 1) — der Import-Parser (Phase 2) liest dieselben Felder.
 */
export function drSchemaBlockBeschreibung(): string {
  const kategorien = EXTERN_KATEGORIEN.join('|');
  return [
    '```json',
    '{',
    `  "schemaVersion": ${RECHERCHE_SCHEMA_VERSION},`,
    '  "quellen": [{ "url": "https://…", "datum": "YYYY-MM-DD" }],',
    '  "identifikation": "welche Firma / welche Produkte wurden untersucht (kurz)",',
    `  "aussagen": [{ "kategorie": "${kategorien}", "text": "eine belegte Aussage", "quellenUrls": ["https://…"] }]`,
    '}',
    '```',
    'Pflicht: jede Quelle mit URL und (soweit auffindbar) Datum; jede Aussage einer Kategorie zugeordnet und mit Quellen-URL(s) belegt.',
  ].join('\n');
}
