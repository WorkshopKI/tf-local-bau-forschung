/**
 * Steckbrief-Baustein der Antrag-Aufbereitung (Paket 2). EIN interner LLM-Lauf
 * extrahiert die VB-ABGELEITETEN Kernaussagen als strukturiertes JSON — jede
 * Aussage mit ihren Sektions-IDs als Fundstelle. Stammdaten, die die App bereits
 * kennt (Antragsteller, FKZ, Projektform), kommen deterministisch aus dem Store
 * und werden dem LLM NICHT abverlangt (hybrid, Default #7).
 *
 * Der Parser liest den LETZTEN JSON-Codeblock marker-tolerant (Lehre aus
 * `parseSkillOutput`, aber EIGENER Parser in `aufbereitung/`): fehlende Felder =
 * leer, unbekannte ignoriert, Sektions-IDs gegen die Gliederung validiert
 * (unbekannte verworfen, Aussage behalten). Kaputtes JSON → `null` = Degradation
 * (Rohtext-Anzeige). Reine Funktionen (Node-testbar).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { stripMarkdownWrapper } from '@/core/services/ai/json-tolerant';
import type { VbSektion } from './gliederung';
import {
  getOrComputeBaustein, steckbriefCacheKey, vbHashFuer, type BausteinResult,
} from './bausteine';

/** Eine belegte Aussage: Text + Sektions-IDs als Fundstelle. */
export interface Belegt { text: string; sektionIds: string[] }
/** Ein Zielmarkt: Markt + optionaler Zielwert (Anteil/Volumen) + Fundstelle. */
export interface Zielmarkt { markt: string; zielwert?: string; sektionIds: string[] }
/** Eine Schlüsselperson: Name + Rolle + Fundstelle. */
export interface Person { name: string; rolle: string; sektionIds: string[] }

/** Die VB-abgeleiteten Steckbrief-Felder (der gecachte Baustein-Datensatz). */
export interface SteckbriefDaten {
  einSatz: Belegt | null;
  innovation: Belegt[];        // inkl. Abgrenzung
  fueGegenstand: Belegt[];
  laufzeit: Belegt | null;
  kernZielwert: Belegt | null;
  zielmaerkte: Zielmarkt[];
  personal: Person[];
  auftraegeDritte: Belegt[];
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildSteckbriefPrompt(gliederung: VbSektion[], vbMarkdown: string): string {
  const sektionListe = gliederung
    .filter(s => s.id !== 's-toc')
    .map(s => `[${s.id}] ${s.nummer ? `${s.nummer} ` : ''}${s.titel}`)
    .join('\n');
  return `Du erstellst den Steckbrief eines Förderantrags aus seiner Vorhabensbeschreibung (VB).

## VB-Sektionen (nummeriert)
${sektionListe}

## Vollständige Vorhabensbeschreibung
${vbMarkdown}

## Aufgabe
Extrahiere die folgenden Kernaussagen WORTNAH aus der VB. Gib zu JEDER Aussage die Sektions-IDs an, aus denen sie stammt. Erfinde nichts — findest du eine Angabe nicht, lässt du das Feld leer ([] bzw. null). Antragsteller, Förderkennzeichen und Projektform NICHT ausgeben (die kennt die App bereits).

Gib als LETZTES einen JSON-Codeblock in genau dieser Form aus:
\`\`\`json
{
  "einSatz": { "text": "Das Vorhaben in einem Satz", "sektionIds": ["k-2"] },
  "innovation": [ { "text": "Innovationskern / Abgrenzung zum Wettbewerb", "sektionIds": ["k-2.1","k-6.3"] } ],
  "fueGegenstand": [ { "text": "Was tatsächlich entwickelt wird", "sektionIds": ["k-3.1"] } ],
  "laufzeit": { "text": "z.B. 18 Monate (M1–M18)", "sektionIds": ["k-9"] },
  "kernZielwert": { "text": "zentraler messbarer Claim, z.B. bis zu 25 % Energieeinsparung", "sektionIds": ["k-11.4"] },
  "zielmaerkte": [ { "markt": "Zielmarkt", "zielwert": "Marktanteil/Volumen (optional)", "sektionIds": ["k-11.1"] } ],
  "personal": [ { "name": "Name", "rolle": "Rolle/Qualifikation", "sektionIds": ["k-8"] } ],
  "auftraegeDritte": [ { "text": "Auftrag an Dritte", "sektionIds": ["k-9"] } ]
}
\`\`\`
Nutze ausschließlich die oben vergebenen Sektions-IDs.`;
}

// ---------------------------------------------------------------------------
// Parser (tolerant, kein Throw)
// ---------------------------------------------------------------------------

/**
 * Extrahiert das LETZTE JSON-Objekt aus der LLM-Antwort: bevorzugt den letzten
 * ```json-Codeblock, sonst das letzte balancierte `{…}` im Rohtext (truncation-
 * tolerant). Gibt `null` zurück, wenn kein Objekt parsebar ist.
 */
export function extractLastJsonObject(raw: string): Record<string, unknown> | null {
  const kandidaten: string[] = [];
  const fences = [...raw.matchAll(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/g)];
  if (fences.length) kandidaten.push(fences[fences.length - 1]![1] ?? '');
  kandidaten.push(stripMarkdownWrapper(raw));
  kandidaten.push(raw);
  for (const k of kandidaten) {
    const obj = parseObjektTolerant(k);
    if (obj) return obj;
  }
  return null;
}

/** Parst das erste balancierte Top-Level-`{…}` ab der ersten `{` (truncation-tolerant). */
function parseObjektTolerant(s: string): Record<string, unknown> | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  const ende = s.lastIndexOf('}');
  if (ende > start) {
    try {
      const p = JSON.parse(s.slice(start, ende + 1)) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch { /* Salvage unten. */ }
  }
  // Brace-Walker: erstes vollständig balanciertes Objekt.
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          const p = JSON.parse(s.slice(start, i + 1)) as unknown;
          if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
        } catch { /* nicht parsebar */ }
        return null;
      }
    }
  }
  return null;
}

function alsString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function valideIds(v: unknown, known: Set<string>): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.trim()))].filter(id => known.has(id));
}

function belegt(v: unknown, known: Set<string>): Belegt | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const text = alsString(o.text);
  if (!text) return null;
  return { text, sektionIds: valideIds(o.sektionIds, known) };
}

function belegtListe(v: unknown, known: Set<string>): Belegt[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => belegt(x, known)).filter((b): b is Belegt => b !== null);
}

/**
 * Mappt das rohe JSON auf `SteckbriefDaten` — feld-tolerant, Sektions-IDs gegen die
 * Gliederung validiert. `null` NUR, wenn kein JSON-Objekt extrahierbar war
 * (Degradation); ein valides, aber leeres Objekt ergibt einen leeren Steckbrief
 * (die Lücke ist Information, Default #7).
 */
export function parseSteckbrief(raw: string, sektionIds: string[]): SteckbriefDaten | null {
  const obj = extractLastJsonObject(raw);
  if (!obj) return null;
  const known = new Set(sektionIds);
  const zielmaerkte: Zielmarkt[] = Array.isArray(obj.zielmaerkte)
    ? obj.zielmaerkte.map(x => {
        if (!x || typeof x !== 'object') return null;
        const o = x as Record<string, unknown>;
        const markt = alsString(o.markt) ?? alsString(o.text);
        if (!markt) return null;
        const zielwert = alsString(o.zielwert);
        return { markt, ...(zielwert ? { zielwert } : {}), sektionIds: valideIds(o.sektionIds, known) };
      }).filter((z): z is Zielmarkt => z !== null)
    : [];
  const personal: Person[] = Array.isArray(obj.personal)
    ? obj.personal.map(x => {
        if (!x || typeof x !== 'object') return null;
        const o = x as Record<string, unknown>;
        const name = alsString(o.name);
        if (!name) return null;
        return { name, rolle: alsString(o.rolle) ?? '', sektionIds: valideIds(o.sektionIds, known) };
      }).filter((p): p is Person => p !== null)
    : [];
  return {
    einSatz: belegt(obj.einSatz, known),
    innovation: belegtListe(obj.innovation, known),
    fueGegenstand: belegtListe(obj.fueGegenstand, known),
    laufzeit: belegt(obj.laufzeit, known),
    kernZielwert: belegt(obj.kernZielwert, known),
    zielmaerkte,
    personal,
    auftraegeDritte: belegtListe(obj.auftraegeDritte, known),
  };
}

// ---------------------------------------------------------------------------
// Compute (Cache-Rahmen)
// ---------------------------------------------------------------------------

export async function computeSteckbriefBaustein(
  idb: IDBStore,
  transport: AITransport,
  skill: SkillRecord,
  antragKey: string,
  gliederung: VbSektion[],
  vbMarkdown: string,
  opts?: { force?: boolean },
): Promise<BausteinResult<SteckbriefDaten>> {
  const vbHash = vbHashFuer(vbMarkdown);
  const sektionIds = gliederung.map(s => s.id);
  return getOrComputeBaustein<SteckbriefDaten>(
    idb, transport, skill,
    steckbriefCacheKey(antragKey, vbHash), vbHash,
    () => buildSteckbriefPrompt(gliederung, vbMarkdown),
    (raw) => parseSteckbrief(raw, sektionIds),
    opts,
  );
}
