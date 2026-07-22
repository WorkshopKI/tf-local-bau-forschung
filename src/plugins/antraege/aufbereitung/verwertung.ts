/**
 * Verwertung/Markt-Baustein der Antrag-Aufbereitung (Stufe 2). EIN interner LLM-Lauf
 * extrahiert die Verwertungs-/Markt-Aussagen aus dem KORPUS (VB + narrative
 * Zusatzdokumente) — jede wortnah, kategorisiert und mit Sektions-IDs als Fundstelle.
 *
 * DOKUMENTGRENZEN-UNABHÄNGIG: der Baustein läuft über den Korpus, nicht über ein
 * separates Marketing-Dokument. Ob das Verwertungskonzept in der VB steht oder in einem
 * Extra-Dokument, ändert das Ergebnis nicht (die Fundstellen zeigen jeweils in die
 * gemeinsame Korpus-Gliederung).
 *
 * KEIN „verdächtig"-Guard: 0 Aussagen ist ein legitimer, inhaltsbasierter Leer-Zustand
 * („kein Verwertungs-Inhalt im Material") — nicht als Degradation behandeln. Muster:
 * Glossar-Baustein; Parser tolerant über den geteilten `birgtRohArray`, kompakt-JSON.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport, BridgeZiel } from '@/core/services/ai/transports/streamlit';
import type { VbSektion } from './gliederung';
import {
  getOrComputeBaustein, verwertungCacheKey, vbHashFuer, type BausteinResult,
} from './bausteine';
import { birgtRohArray } from './json-salvage';

/** Kategorien einer Verwertungs-/Markt-Aussage (geschlossene Menge). */
export const VERWERTUNG_KATEGORIEN = [
  'zielmarkt', 'wettbewerb', 'verwertungsweg', 'zeithorizont', 'umsatz',
] as const;
export type VerwertungKategorie = (typeof VERWERTUNG_KATEGORIEN)[number];

/** Menschlich lesbare Überschrift je Kategorie (Anzeige-Reihenfolge = Array-Reihenfolge). */
export const VERWERTUNG_KATEGORIE_LABEL: Record<VerwertungKategorie, string> = {
  zielmarkt: 'Zielmärkte',
  wettbewerb: 'Wettbewerb / Abgrenzung',
  verwertungsweg: 'Verwertungswege',
  zeithorizont: 'Zeithorizont / Markteintritt',
  umsatz: 'Umsatz- / Marktpotenzial',
};

/** Eine extrahierte Verwertungs-/Markt-Aussage (wortnah) + Fundstellen. */
export interface VerwertungAussage {
  kategorie: VerwertungKategorie;
  /** Die Aussage, wortnah aus dem Material (≤ ~40 Wörter). */
  text: string;
  /** Sektions-IDs als Fundstelle (validiert gegen die Korpus-Gliederung; kann leer sein). */
  sektionIds: string[];
}

/** Das geparste Verwertungs-Inventar (der gecachte Baustein-Datensatz). */
export interface VerwertungDaten {
  schemaVersion: number;
  aussagen: VerwertungAussage[];
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildVerwertungPrompt(gliederung: VbSektion[], vbMarkdown: string): string {
  const sektionListe = gliederung
    .filter(s => s.id !== 's-toc')
    .map(s => `[${s.id}] ${s.nummer ? `${s.nummer} ` : ''}${s.titel}`)
    .join('\n');
  return `Du bereitest die Verwertungs- und Markt-Aussagen eines Förderantrags aus seinem Antragsmaterial auf (Vorhabensbeschreibung und ggf. angehängte Zusatzdokumente wie ein Marketing-/Verwertungskonzept). Extrahiere, was im Text steht — erfinde nichts, ergänze kein Weltwissen.

## Sektionen des Materials (nummeriert)
${sektionListe}

## Vollständiges Antragsmaterial
${vbMarkdown}

## Aufgabe
Sammle die konkreten Verwertungs-/Markt-Aussagen und ordne jede EINER Kategorie zu:
- "zielmarkt": adressierte Märkte/Zielgruppen/Branchen, Marktvolumen
- "wettbewerb": Wettbewerber, Alleinstellung, Abgrenzung zum Stand der Technik am Markt
- "verwertungsweg": Art der Verwertung (Eigenvertrieb, Lizenz, Ausgründung, Kooperation …)
- "zeithorizont": geplanter Markteintritt / Zeitpunkt der Verwertung
- "umsatz": erwartete Umsätze, Stückzahlen, Marktanteile, Amortisation

Gib jede Aussage KURZ und wortnah (≤ ~40 Wörter) wieder. Gib die Sektions-IDs an, aus denen die Aussage stammt (aus der obigen Liste). Steht im Material nichts zur Verwertung/zum Markt, gib ein leeres Array zurück — erfinde nichts.

Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Codeblock in genau dieser Form — keine Tabelle, keine Aufzählung, kein Fließtext davor oder danach. Gib das JSON **kompakt** aus: jede Aussage in GENAU EINER Zeile wie im Beispiel, KEIN Pretty-Print — nur so passen ALLE Aussagen ins Antwort-Limit:
\`\`\`json
{ "schemaVersion": 1, "aussagen": [
{ "kategorie": "zielmarkt", "text": "Zielmarkt sind mittelständische Maschinenbauer im DACH-Raum", "sektionIds": ["k-7.1"] },
{ "kategorie": "verwertungsweg", "text": "Verwertung über Eigenvertrieb als SaaS-Lizenz", "sektionIds": ["k-7.3"] }
] }
\`\`\`
Die beiden Zeilen sind ein FORMAT-Beispiel: übernimm weder ihre Aussagetexte noch ihre Sektions-IDs. Nutze ausschließlich Aussagen aus dem Material oben, die dort vergebenen Sektions-IDs und ausschließlich die fünf genannten Kategorie-Werte. Eine Aussage = eine Zeile.`;
}

// ---------------------------------------------------------------------------
// Parser (tolerant, kein Throw)
// ---------------------------------------------------------------------------

function alsString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function alsKategorie(v: unknown): VerwertungKategorie | null {
  return typeof v === 'string' && (VERWERTUNG_KATEGORIEN as readonly string[]).includes(v.trim())
    ? (v.trim() as VerwertungKategorie)
    : null;
}

function valideIds(v: unknown, known: Set<string>): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.trim()))].filter(id => known.has(id));
}

/**
 * Mappt das rohe JSON auf `VerwertungDaten` — feld- + truncation-tolerant (`birgtRohArray`).
 * Ein Eintrag ohne gültige `kategorie` ODER ohne `text` wird verworfen. `null` NUR, wenn
 * weder Objekt noch `aussagen`-Array bergbar war (echte Degradation); ein leeres, aber
 * bergbares Array ergibt `{ aussagen: [] }` (legitimer inhaltsbasierter Leer-Zustand).
 */
export function parseVerwertung(raw: string, sektionIds: string[]): VerwertungDaten | null {
  const geborgen = birgtRohArray(raw, 'aussagen');
  if (!geborgen) return null;
  const known = new Set(sektionIds);
  const aussagen: VerwertungAussage[] = [];
  for (const e of geborgen.items) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const kategorie = alsKategorie(o.kategorie);
    const text = alsString(o.text);
    if (!kategorie || !text) continue;
    aussagen.push({ kategorie, text, sektionIds: valideIds(o.sektionIds, known) });
  }
  return { schemaVersion: geborgen.schemaVersion, aussagen };
}

// ---------------------------------------------------------------------------
// Compute (Cache-Rahmen)
// ---------------------------------------------------------------------------

export async function computeVerwertungBaustein(
  idb: IDBStore,
  transport: AITransport,
  skill: SkillRecord,
  antragKey: string,
  gliederung: VbSektion[],
  vbMarkdown: string,
  opts?: { force?: boolean; ziel?: BridgeZiel },
): Promise<BausteinResult<VerwertungDaten>> {
  const vbHash = vbHashFuer(vbMarkdown);
  const sektionIds = gliederung.map(s => s.id);
  return getOrComputeBaustein<VerwertungDaten>(
    idb, transport, skill,
    verwertungCacheKey(antragKey, vbHash), vbHash,
    () => buildVerwertungPrompt(gliederung, vbMarkdown),
    (raw) => parseVerwertung(raw, sektionIds),
    // KEIN `verdaechtig`: 0 Aussagen = legitimer Leer-Zustand, keine Degradation.
    { ...opts },
  );
}
