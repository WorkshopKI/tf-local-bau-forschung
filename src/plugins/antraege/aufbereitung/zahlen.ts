/**
 * Zahlen-Inventar-Baustein der Antrag-Aufbereitung (Paket 4). EIN interner LLM-Lauf
 * WÄHLT die Claims mit Zahlenwerten aus der VB aus und verankert sie per Sektions-ID —
 * er rechnet, normalisiert und summiert NICHTS. Die deterministischen Quervergleiche
 * (Laufzeit vs. Zeitplan-Horizont, PM-Summe vs. Anlage 5) macht der Code hier, nie das
 * LLM; nur sicher parsebare Werte erzeugen einen Befund (kein Fuzzy-Matching).
 *
 * Der Parser liest den LETZTEN JSON-Codeblock über die GETEILTE `extractLastJsonObject`
 * (aus `steckbrief.ts` — kein zweiter JSON-Parser). Kaputtes JSON → `null` = Degradation.
 * Der Prüfaspekt-/Kategorie-Katalog ist eine Code-Konstante (Domänen-Wissen, nicht
 * Registry). Reine Funktionen (Node-testbar); der Cache-/Transport-Rahmen liegt in
 * `bausteine.ts`.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport, BridgeZiel } from '@/core/services/ai/transports/streamlit';
import type { VbSektion } from './gliederung';
import {
  getOrComputeBaustein, zahlenCacheKey, vbHashFuer, type BausteinResult,
} from './bausteine';
import { extractLastJsonObject } from './steckbrief';
import { birgtRohArray } from './json-salvage';
import { summePm } from './tabellen';
import type { AufbereitungRun } from './types';

/** Eine Zahlen-Kategorie (Code-Konstante, NICHT Registry) — Label + Reihenfolge fürs UI. */
export interface ZahlKategorie {
  id: string;
  name: string;
}

/** Kategorien-Katalog (Vorschlag Paket 4). Reihenfolge = UI-Gruppen-Reihenfolge. */
export const ZAHL_KATEGORIEN: ZahlKategorie[] = [
  { id: 'leistung', name: 'Leistung & Technik' },
  { id: 'zeit', name: 'Zeit & Laufzeit' },
  { id: 'personal', name: 'Personal & Aufwand' },
  { id: 'kosten', name: 'Kosten & Finanzen' },
  { id: 'markt', name: 'Markt & Absatz' },
  { id: 'sonstig', name: 'Sonstige' },
];

/** Menge der gültigen Kategorie-IDs. */
export const ZAHL_KATEGORIE_IDS: ReadonlySet<string> = new Set(ZAHL_KATEGORIEN.map(k => k.id));

/** Fallback-Kategorie für unbekannte/fehlende Werte (tolerant, wie `effektiveKategorie`). */
const KATEGORIE_FALLBACK = 'sonstig';

/** Prüfrelevanz eines Claims — Auswahl des Modells (keine Wertung der Richtigkeit). */
export type ZahlRelevanz = 'kern' | 'detail';

/** Ein ausgewählter Zahlen-Claim: wörtlicher Wert + Kategorie + Kontext + Fundstellen. */
export interface ZahlClaim {
  /** Wert WÖRTLICH wie im Text (z.B. ">95 %", "24 Monate", "3,5 PM"). */
  wert: string;
  /** Optionale Einheit (z.B. "%", "Monate", "PM", "€"). */
  einheit?: string;
  /** Kategorie aus `ZAHL_KATEGORIEN` (Fallback `sonstig`). */
  kategorie: string;
  /**
   * Prüfrelevanz (Modell-Auswahl, keine Berechnung): `kern` = zentrale Prüfwerte,
   * `detail` = Nebenwerte. Der Parser setzt es immer; OPTIONAL, damit alte Cache-Einträge
   * ohne das Feld gültige `ZahlClaim[]` bleiben (die Anzeige behandelt fehlend als `detail`).
   * Reine Selektion, Deterministik-Grenze unverletzt.
   */
  relevanz?: ZahlRelevanz;
  /** Kurzes wörtliches Umfeld (≤ ~20 Wörter). */
  kontext: string;
  /** Sektions-IDs als Fundstelle (Pflicht, ≥ 1 — validiert gegen die Gliederung). */
  sektionIds: string[];
}

/** Das geparste Zahlen-Inventar (der gecachte Baustein-Datensatz). */
export interface ZahlenDaten {
  schemaVersion: number;
  claims: ZahlClaim[];
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * NICHT wieder aufnehmen: „Findest du keine prüfrelevanten Zahlen, gib eine leere
 * `claims`-Liste zurück — das ist ein zulässiges Ergebnis." Der `verdaechtig`-Guard in
 * `computeZahlenBaustein` wertet genau diese Antwort als auffällig und startet EINEN
 * zweiten Volllauf über die ganze VB. Der Prompt lud also zu der Antwort ein, die den
 * Lauf verdoppelt (Prompt-Audit Muster 3: Widerspruch ohne Vorrang). Umgekehrt steht hier
 * auch KEIN „die Liste darf nicht leer sein" — das stünde gegen „erfinde keine Werte".
 */
export function buildZahlenPrompt(gliederung: VbSektion[], vbMarkdown: string): string {
  const sektionListe = gliederung
    .filter(s => s.id !== 's-toc')
    .map(s => `[${s.id}] ${s.nummer ? `${s.nummer} ` : ''}${s.titel}`)
    .join('\n');
  const kategorieListe = ZAHL_KATEGORIEN.map(k => `- ${k.id}: ${k.name}`).join('\n');
  return `Du erstellst das Zahlen-Inventar eines Förderantrags aus seiner Vorhabensbeschreibung (VB): jeden Claim mit einem Zahlenwert, wörtlich ausgewählt und per Sektions-ID verankert.

## VB-Sektionen (nummeriert)
${sektionListe}

## Kategorien
${kategorieListe}

## Vollständige Vorhabensbeschreibung
${vbMarkdown}

## Aufgabe
Sammle die **prüfrelevanten** Claims mit Zahlenwert. Gib den Wert WÖRTLICH wie im Text an (z.B. ">95 %", "24 Monate", "3,5 PM"). Rechne nichts aus, rechne nichts um, fasse nichts zusammen, erfinde keine Werte. Ordne jeden Claim einer Kategorie aus dem Katalog zu und gib die Sektions-IDs an, aus denen er stammt (mindestens eine, ausschließlich aus der obigen Liste).

**Erwünscht** (aufnehmen): Leistungs-/Zielwerte des Vorhabens, Laufzeit- und Meilenstein-Termine, Personenmonate/Kapazitäten, Kosten-Eckwerte, Marktzahlen (Volumen, Wachstum, Anteile).
**Nicht erwünscht** (weglassen): beiläufige Zahlen ohne Prüfrelevanz — Seitenzahlen, Kapitel-/Abbildungsnummern, historische Jahreszahlen im Fließtext, generische Prozentangaben ohne konkreten Bezug zum Vorhaben.

Markiere je Claim das Feld \`relevanz\`: \`kern\` für die zentralen Prüfwerte (Leistungs-/Zielwerte, Laufzeit, PM/Kapazität, Kosten-Eckwerte, Marktvolumen), \`detail\` für unterstützende Nebenwerte. Das ist eine Auswahl, keine Bewertung der Richtigkeit.

Zwei Felder, die oben nicht erklärt sind: \`kontext\` ist das kurze wörtliche Umfeld des Werts aus der VB, höchstens ~20 Wörter. \`einheit\` ist die Einheit des Werts ("%", "Monate", "PM", "€"); gibt es keine, lass sie leer.

Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Codeblock in dieser Form — keine Tabelle, keine Aufzählung, kein Fließtext davor oder danach. Gib das JSON **kompakt** aus: jeden Claim in GENAU EINER Zeile, keine Einrückung, kein Pretty-Print:
\`\`\`json
{ "schemaVersion": 1, "claims": [
{ "wert": "<Wert wörtlich wie im Text>", "einheit": "<Einheit oder leer>", "kategorie": "<kategorie-id>", "relevanz": "kern", "kontext": "<kurzes Umfeld aus der VB>", "sektionIds": ["<sektion-id>"] }
] }
\`\`\`
Die spitzen Klammern sind Feld-Beschreibungen, keine Werte — übernimm sie nicht. Nutze ausschließlich die oben vergebenen Sektions-IDs und Kategorie-IDs. Ein Claim = eine Zeile, keine Zeilenumbrüche innerhalb eines Claims.`;
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

function normalisiereKategorie(v: unknown): string {
  const s = alsString(v)?.toLowerCase();
  return s && ZAHL_KATEGORIE_IDS.has(s) ? s : KATEGORIE_FALLBACK;
}

/** Tolerante Relevanz: nur `kern` schaltet auf Kern; alles andere/fehlend → `detail`. */
function normalisiereRelevanz(v: unknown): ZahlRelevanz {
  return alsString(v)?.toLowerCase() === 'kern' ? 'kern' : 'detail';
}

/**
 * Mappt das rohe JSON auf `ZahlenDaten` — feld-tolerant + TRUNCATION-TOLERANT über den
 * geteilten `birgtRohArray` (Objekt-Happy-Path, sonst Array-Salvage ab `"claims"`; rettet
 * die vollständig übertragenen Claims aus abgeschnittenen Antworten). Ein Claim ohne
 * wörtlichen `wert` ODER ohne gültige Sektions-ID wird verworfen (Fundstelle Pflicht).
 * `null` NUR, wenn weder ein JSON-Objekt noch ein `claims`-Array bergbar war (Degradation,
 * z.B. Prosa oder eine Markdown-Tabelle statt JSON).
 */
export function parseZahlen(raw: string, sektionIds: string[]): ZahlenDaten | null {
  const geborgen = birgtRohArray(raw, 'claims');
  if (!geborgen) return null;
  const known = new Set(sektionIds);
  const claims: ZahlClaim[] = [];
  for (const c of geborgen.items) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const wert = alsString(o.wert);
    if (!wert) continue;
    const ids = valideIds(o.sektionIds, known);
    if (ids.length === 0) continue; // Fundstelle Pflicht (≥ 1 gültige Sektion)
    const einheit = alsString(o.einheit);
    claims.push({
      wert,
      ...(einheit ? { einheit } : {}),
      kategorie: normalisiereKategorie(o.kategorie),
      relevanz: normalisiereRelevanz(o.relevanz),
      kontext: alsString(o.kontext) ?? '',
      sektionIds: ids,
    });
  }
  return { schemaVersion: geborgen.schemaVersion, claims };
}

/**
 * Diagnose der Roh-Antwort (dev-Eval — beantwortet „warum wenige/keine Claims?"):
 *
 * - `abgeschnitten`: der Happy-Path-Objekt-Extraktor (`extractLastJsonObject`) fand KEIN
 *   vollständiges claims-tragendes Objekt, obwohl `"claims"` im Text steht → die Antwort
 *   war truncated und lief über den Salvage (die geretteten Claims sind ein Teilstand).
 * - `hatTabelle`: dem JSON-Teil geht eine **Tabelle** voraus (≥ 2 Zeilen mit ≥ 2
 *   Spaltentrennern `|`/Tab im Vorspann vor `"claims"`). Diese Präambel frisst
 *   Token-Budget und begünstigt genau die Truncation — die Prompt-Härtung zielt darauf.
 *
 * Reine Funktion, wirft nie. Beide Flags sind unabhängig; ein sauberer JSON-Lauf ergibt
 * `{ hatTabelle: false, abgeschnitten: false }`.
 */
export function zahlenAntwortDiagnose(raw: string): { hatTabelle: boolean; abgeschnitten: boolean } {
  const obj = extractLastJsonObject(raw);
  const vollstaendig = !!(obj && Array.isArray(obj.claims));
  const claimsIdx = raw.indexOf('"claims"');
  const abgeschnitten = !vollstaendig && claimsIdx >= 0;
  const vorspann = claimsIdx >= 0 ? raw.slice(0, claimsIdx) : raw;
  const tabellenZeilen = vorspann.split('\n').filter(z => {
    const pipes = (z.match(/\|/g) ?? []).length;
    const tabs = (z.match(/\t/g) ?? []).length;
    return pipes >= 2 || tabs >= 2;
  }).length;
  return { hatTabelle: tabellenZeilen >= 2, abgeschnitten };
}

// ---------------------------------------------------------------------------
// Deterministische Quervergleiche (Code, NICHT LLM)
// ---------------------------------------------------------------------------

/** Ein Zahlen-Widerspruch (deterministisch, gegen die geernteten Tabellen). */
export interface ZahlBefund {
  /** Stabiler Key `zahl-widerspruch:<art>:<claim-slug>` für die `offenePunkte`-Mechanik. */
  key: string;
  /** Menschenlesbarer Befundtext (deutsch). */
  text: string;
  /** Fundstellen des auslösenden Claims. */
  sektionIds: string[];
  /** Wörtlicher Claim-Wert (für die UI-Kopplung an die Tabellenzeile). */
  claimWert: string;
  /** Prüfaspekt der Zuordnung (Zeit/PM → H „Projektplan"). Für den Fragen-Tab (Paket 2). */
  aspektId: string;
}

function zahl(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

/** Klare Monatszahl aus dem Claim (Zeit) — sonst null (kein Fuzzy). */
function parseMonate(c: ZahlClaim): number | null {
  const m = /(\d+)\s*monat(?:e|en)?\b/i.exec(c.wert);
  if (m) return parseInt(m[1]!, 10);
  if (/^monat(?:e|en)?$/i.test((c.einheit ?? '').trim()) && /^\d+$/.test(c.wert.trim())) {
    return parseInt(c.wert.trim(), 10);
  }
  return null;
}

/** Klare PM-Zahl aus dem Claim (Personal) — sonst null. */
function parsePm(c: ZahlClaim): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(?:pm|personenmonate?)\b/i.exec(c.wert);
  if (m) return zahl(m[1]!);
  if (/^(?:pm|personenmonate?)$/i.test((c.einheit ?? '').trim()) && /^\d+(?:[.,]\d+)?$/.test(c.wert.trim())) {
    return zahl(c.wert.trim());
  }
  return null;
}

/** Deutsch-tolerante Slug-Bildung (Umlaute ausgeschrieben, nur a-z0-9-, gekürzt). */
function slug(s: string): string {
  return s.toLowerCase().normalize('NFC')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** Float-sichere Gleichheit auf 1 Nachkommastelle (kein Fuzzy — nur Rausch-Schutz). */
function gleich1(a: number, b: number): boolean {
  return Math.round(a * 10) === Math.round(b * 10);
}

/**
 * Deterministische Quervergleiche der Zahlen-Claims gegen die geernteten Tabellen.
 * Startumfang bewusst klein + sicher: Laufzeit-Claim vs. Zeitplan-Horizont, PM-Summen-
 * Claim vs. Anlage-5-Summe. Nur SICHER parsebare Werte erzeugen einen Befund; im
 * Zweifel kein Vergleich, kein Fuzzy-Matching. Reine Funktion.
 */
export function pruefeZahlWidersprueche(claims: ZahlClaim[], run: AufbereitungRun): ZahlBefund[] {
  const befunde: ZahlBefund[] = [];
  const zeitplan = run.zeitplan;
  if (!zeitplan) return befunde;

  // (1) Laufzeit: 'zeit'-Claims mit klarer Monatszahl vs. Zeitplan-Horizont.
  const horizont = zeitplan.achseMax;
  if (horizont > 1) {
    for (const c of claims) {
      if (c.kategorie !== 'zeit') continue;
      const monate = parseMonate(c);
      if (monate == null || monate === horizont) continue;
      befunde.push({
        key: `zahl-widerspruch:laufzeit:${slug(c.wert)}`,
        text: `Laufzeit-Claim „${c.wert}" (${monate} Monate) weicht vom Zeitplan-Horizont (${horizont} Monate) ab.`,
        sektionIds: c.sektionIds,
        claimWert: c.wert,
        aspektId: 'H',
      });
    }
  }

  // (2) Personenmonate: 'personal'-Claims mit klarer PM-Zahl vs. Anlage-5-Summe.
  const pmSumme = summePm(zeitplan.zeilen);
  if (pmSumme > 0) {
    for (const c of claims) {
      if (c.kategorie !== 'personal') continue;
      const pm = parsePm(c);
      if (pm == null || gleich1(pm, pmSumme)) continue;
      befunde.push({
        key: `zahl-widerspruch:pm:${slug(c.wert)}`,
        text: `PM-Claim „${c.wert}" (${pm} PM) weicht von der Anlage-5-Summe (${pmSumme.toFixed(1).replace('.', ',')} PM) ab.`,
        sektionIds: c.sektionIds,
        claimWert: c.wert,
        aspektId: 'H',
      });
    }
  }
  return befunde;
}

// ---------------------------------------------------------------------------
// Compute (Cache-Rahmen)
// ---------------------------------------------------------------------------

export async function computeZahlenBaustein(
  idb: IDBStore,
  transport: AITransport,
  skill: SkillRecord,
  antragKey: string,
  gliederung: VbSektion[],
  vbMarkdown: string,
  opts?: { force?: boolean; ziel?: BridgeZiel },
): Promise<BausteinResult<ZahlenDaten>> {
  const vbHash = vbHashFuer(vbMarkdown);
  const sektionIds = gliederung.map(s => s.id);
  return getOrComputeBaustein<ZahlenDaten>(
    idb, transport, skill,
    zahlenCacheKey(antragKey, vbHash), vbHash,
    () => buildZahlenPrompt(gliederung, vbMarkdown),
    (raw) => parseZahlen(raw, sektionIds),
    {
      ...opts,
      // 0 Claims bei nicht-leerer VB ist verdächtig (Förderanträge tragen immer Zahlen)
      // → ein Retry, sonst degradiert (statt fälschlich leeres `ok`).
      verdaechtig: { pruefe: (d) => d.claims.length === 0, grund: 'Modell hat keine Zahlen-Claims gefunden' },
    },
  );
}
