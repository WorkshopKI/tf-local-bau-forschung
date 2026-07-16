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
import { extractLastJsonObject } from './steckbrief';

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

// ---------------------------------------------------------------------------
// Import-Parser (tolerant, kein Throw) — dieselbe Konstante wie die Prompt-Erzeugung.
// ---------------------------------------------------------------------------

export interface ExterneQuelle {
  url: string;
  datum?: string;
}
export interface ExterneAussageKern {
  kategorie: ExternKategorie;
  text: string;
  quellenUrls?: string[];
}
/** Struktur-Kern eines externen Rückwegs (ohne Herkunft/Import-Metadaten). */
export interface ExterneRechercheKern {
  schemaVersion: number;
  quellen: ExterneQuelle[];
  identifikation?: string;
  aussagen: ExterneAussageKern[];
}

function alsStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function parseQuellen(v: unknown): ExterneQuelle[] {
  if (!Array.isArray(v)) return [];
  const out: ExterneQuelle[] = [];
  for (const q of v) {
    if (!q || typeof q !== 'object') continue;
    const o = q as Record<string, unknown>;
    const url = alsStr(o.url);
    if (!url) continue; // Quelle ohne URL ist wertlos (Belegpflicht)
    const datum = alsStr(o.datum);
    out.push(datum ? { url, datum } : { url });
  }
  return out;
}

function parseAussagen(v: unknown): ExterneAussageKern[] {
  if (!Array.isArray(v)) return [];
  const out: ExterneAussageKern[] = [];
  for (const a of v) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    const text = alsStr(o.text);
    if (!text || !istExternKategorie(o.kategorie)) continue;
    const urls = Array.isArray(o.quellenUrls)
      ? [...new Set(o.quellenUrls.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim()))]
      : undefined;
    out.push({ kategorie: o.kategorie, text, ...(urls && urls.length ? { quellenUrls: urls } : {}) });
  }
  return out;
}

/**
 * Liest den externen DR-JSON-Block (das letzte JSON-Objekt) in den Struktur-Kern.
 * `null`, wenn KEIN Schema erkennbar ist (weder `aussagen` noch `quellen` als Array) —
 * dann fällt der Import-Pfad auf den internen Strukturierungs-Lauf zurück. Ein erkanntes,
 * aber leer gefiltertes Schema ist LEGITIM (0 Aussagen) und liefert einen leeren Kern.
 */
export function parseExterneRecherche(raw: string): ExterneRechercheKern | null {
  const obj = extractLastJsonObject(raw);
  if (!obj) return null;
  const hatSchema = Array.isArray(obj.aussagen) || Array.isArray(obj.quellen);
  if (!hatSchema) return null;
  return {
    schemaVersion: typeof obj.schemaVersion === 'number' ? obj.schemaVersion : RECHERCHE_SCHEMA_VERSION,
    quellen: parseQuellen(obj.quellen),
    identifikation: alsStr(obj.identifikation) ?? undefined,
    aussagen: parseAussagen(obj.aussagen),
  };
}
