/**
 * Glossar-Baustein der Antrag-Aufbereitung (v2.219). EIN interner LLM-Lauf WÄHLT die
 * Fachbegriffe/Abkürzungen der Vorhabensbeschreibung aus, gibt zu jedem eine KURZE
 * Definition WORTNAH aus dem Text + die Sektions-IDs als Fundstelle — er erfindet keine
 * Begriffe/Definitionen. Muster: Zahlen-/Steckbrief-Baustein.
 *
 * Der Parser liest das `begriffe`-Array truncation-tolerant über den GETEILTEN
 * `birgtRohArray` (kein zweiter Parser); kompakt-JSON-Instruktion (Lehre: Pretty-Print
 * halbiert die Ausbeute im fixen Server-Budget). Reine Funktionen (Node-testbar); der
 * Cache-/Transport-Rahmen liegt in `bausteine.ts`.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { KiRolle } from '@/core/services/ai/modell-katalog';
import type { VbSektion } from './gliederung';
import {
  getOrComputeBaustein, glossarCacheKey, vbHashFuer, type BausteinResult,
} from './bausteine';
import { birgtRohArray } from './json-salvage';

/** Ein Glossar-Eintrag: Begriff + kurze Definition (wortnah) + Fundstellen. */
export interface GlossarBegriff {
  /** Der Fachbegriff / die Abkürzung (wie im Text). */
  begriff: string;
  /** Kurze Definition, wortnah aus dem Text (≤ ~30 Wörter). */
  definition: string;
  /** Sektions-IDs als Fundstelle (validiert gegen die Gliederung; kann leer sein). */
  sektionIds: string[];
}

/** Das geparste Glossar (der gecachte Baustein-Datensatz). */
export interface GlossarDaten {
  schemaVersion: number;
  begriffe: GlossarBegriff[];
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildGlossarPrompt(gliederung: VbSektion[], vbMarkdown: string): string {
  const sektionListe = gliederung
    .filter(s => s.id !== 's-toc')
    .map(s => `[${s.id}] ${s.nummer ? `${s.nummer} ` : ''}${s.titel}`)
    .join('\n');
  return `Du erstellst das Glossar eines Förderantrags aus seiner Vorhabensbeschreibung (VB): die Fachbegriffe, Fachabkürzungen und technischen Kernbegriffe, jeweils mit einer kurzen Definition WORTNAH aus dem Text und der Fundstelle.

## VB-Sektionen (nummeriert)
${sektionListe}

## Vollständige Vorhabensbeschreibung
${vbMarkdown}

## Aufgabe
Sammle die erklärungsbedürftigen Fachbegriffe/Abkürzungen (z.B. Verfahren, Technologien, Kennwerte, Domänen-Akronyme). Gib zu jedem eine KURZE Definition (≤ ~30 Wörter), wortnah aus dem Text — erfinde nichts, erkläre nichts aus Weltwissen. Gib die Sektions-IDs an, aus denen der Begriff/die Definition stammt (aus der obigen Liste). Keine Allerweltswörter, keine Dubletten.

Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Codeblock in genau dieser Form — keine Tabelle, keine Aufzählung, kein Fließtext davor oder danach. Gib das JSON **kompakt** aus: jeden Begriff in GENAU EINER Zeile wie im Beispiel, KEINE mehrzeilig eingerückten Objekte, kein Pretty-Print — nur so passen ALLE Begriffe ins Antwort-Limit:
\`\`\`json
{ "schemaVersion": 1, "begriffe": [
{ "begriff": "RFID", "definition": "Radio-Frequency Identification zur berührungslosen Objekterkennung per Funk-Tags", "sektionIds": ["k-3.3"] },
{ "begriff": "TRL", "definition": "Technology Readiness Level, Reifegrad einer Technologie von 1 bis 9", "sektionIds": ["k-2"] }
] }
\`\`\`
Die beiden Zeilen sind ein FORMAT-Beispiel: übernimm weder die Begriffe („RFID", „TRL") noch die Sektions-IDs daraus. Nutze ausschließlich die Begriffe aus der Vorhabensbeschreibung und die oben vergebenen Sektions-IDs. Ein Begriff = eine Zeile, keine Zeilenumbrüche innerhalb eines Eintrags.`;
}

// ---------------------------------------------------------------------------
// Parser (tolerant, kein Throw)
// ---------------------------------------------------------------------------

function alsString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function valideIds(v: unknown, known: Set<string>): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.trim()))].filter(id => known.has(id));
}

/**
 * Mappt das rohe JSON auf `GlossarDaten` — feld- + truncation-tolerant (`birgtRohArray`).
 * Ein Eintrag ohne `begriff` ODER ohne `definition` wird verworfen (beides ist der Sinn);
 * Dubletten (Begriff case-insensitiv) werden zusammengeführt, alphabetisch sortiert.
 * `null` NUR, wenn weder Objekt noch `begriffe`-Array bergbar war (Degradation).
 */
export function parseGlossar(raw: string, sektionIds: string[]): GlossarDaten | null {
  const geborgen = birgtRohArray(raw, 'begriffe');
  if (!geborgen) return null;
  const known = new Set(sektionIds);
  const proSchluessel = new Map<string, GlossarBegriff>();
  for (const e of geborgen.items) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const begriff = alsString(o.begriff);
    const definition = alsString(o.definition);
    if (!begriff || !definition) continue;
    const schluessel = begriff.toLowerCase().normalize('NFC');
    if (proSchluessel.has(schluessel)) continue; // erste Definition gewinnt
    proSchluessel.set(schluessel, { begriff, definition, sektionIds: valideIds(o.sektionIds, known) });
  }
  const begriffe = [...proSchluessel.values()].sort((a, b) => a.begriff.localeCompare(b.begriff, 'de'));
  return { schemaVersion: geborgen.schemaVersion, begriffe };
}

// ---------------------------------------------------------------------------
// Compute (Cache-Rahmen)
// ---------------------------------------------------------------------------

export async function computeGlossarBaustein(
  idb: IDBStore,
  transport: AITransport,
  skill: SkillRecord,
  antragKey: string,
  gliederung: VbSektion[],
  vbMarkdown: string,
  opts?: { force?: boolean; ziel?: KiRolle; ueberStandardCap?: boolean },
): Promise<BausteinResult<GlossarDaten>> {
  const vbHash = vbHashFuer(vbMarkdown);
  const sektionIds = gliederung.map(s => s.id);
  return getOrComputeBaustein<GlossarDaten>(
    idb, transport, skill,
    glossarCacheKey(antragKey, vbHash), vbHash,
    () => buildGlossarPrompt(gliederung, vbMarkdown),
    (raw) => parseGlossar(raw, sektionIds),
    {
      ...opts,
      // 0 Begriffe bei nicht-leerer VB ist verdächtig (Förderanträge tragen Fachbegriffe)
      // → ein Retry, sonst degradiert (statt fälschlich leeres `ok`).
      verdaechtig: { pruefe: (d) => d.begriffe.length === 0, grund: 'Modell hat keine Fachbegriffe gefunden' },
    },
  );
}
