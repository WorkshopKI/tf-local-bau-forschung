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
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { VbSektion } from './gliederung';
import {
  getOrComputeBaustein, zahlenCacheKey, vbHashFuer, type BausteinResult,
} from './bausteine';
import { extractLastJsonObject } from './steckbrief';
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

/** Ein ausgewählter Zahlen-Claim: wörtlicher Wert + Kategorie + Kontext + Fundstellen. */
export interface ZahlClaim {
  /** Wert WÖRTLICH wie im Text (z.B. ">95 %", "24 Monate", "3,5 PM"). */
  wert: string;
  /** Optionale Einheit (z.B. "%", "Monate", "PM", "€"). */
  einheit?: string;
  /** Kategorie aus `ZAHL_KATEGORIEN` (Fallback `sonstig`). */
  kategorie: string;
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
Sammle jeden Claim, der einen Zahlenwert trägt (Leistungswerte, Laufzeiten, Personenmonate, Kosten, Marktzahlen …). Gib den Wert WÖRTLICH wie im Text an (z.B. ">95 %", "24 Monate", "3,5 PM"). Rechne nichts aus, rechne nichts um, fasse nichts zusammen, erfinde keine Werte. Ordne jeden Claim einer Kategorie aus dem Katalog zu und gib die Sektions-IDs an, aus denen er stammt (mindestens eine, ausschließlich aus der obigen Liste).

Gib als LETZTES einen JSON-Codeblock in genau dieser Form aus:
\`\`\`json
{
  "schemaVersion": 1,
  "claims": [
    { "wert": ">95 %", "einheit": "%", "kategorie": "leistung", "kontext": "Erkennungsrate von über 95 %", "sektionIds": ["k-3.1"] },
    { "wert": "24 Monate", "einheit": "Monate", "kategorie": "zeit", "kontext": "Projektlaufzeit von 24 Monaten", "sektionIds": ["k-9"] }
  ]
}
\`\`\`
Nutze ausschließlich die oben vergebenen Sektions-IDs und die Kategorie-IDs.`;
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

/**
 * Mappt das rohe JSON auf `ZahlenDaten` — feld-tolerant. Ein Claim ohne wörtlichen
 * `wert` ODER ohne gültige Sektions-ID wird verworfen (Fundstelle ist Pflicht).
 * `null` NUR, wenn kein JSON-Objekt extrahierbar war (Degradation).
 */
export function parseZahlen(raw: string, sektionIds: string[]): ZahlenDaten | null {
  const obj = extractLastJsonObject(raw);
  if (!obj) return null;
  const known = new Set(sektionIds);
  const rohClaims = Array.isArray(obj.claims) ? obj.claims : [];
  const claims: ZahlClaim[] = [];
  for (const c of rohClaims) {
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
      kontext: alsString(o.kontext) ?? '',
      sektionIds: ids,
    });
  }
  const schemaVersion = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1;
  return { schemaVersion, claims };
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
  opts?: { force?: boolean },
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
