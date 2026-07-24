/**
 * Aspekt-Mapping-Baustein der Antrag-Aufbereitung (Paket 2). EIN interner LLM-Lauf
 * ordnet die VB-Sektionen den festen Prüfaspekten A–J zu und benennt fehlende
 * Pflichtangaben — auswählen + referenzieren, nicht zusammenfassen (Muster
 * Relevanz-Map). Der Prüfaspekt-Katalog ist eine **Code-Konstante** (nicht in der
 * Registry): er ist Domänen-Wissen der Prüfung, nicht kuratierbarer Skill-Inhalt.
 *
 * Alles Deterministische (Substanz-Anteile, „dünn"-Schwelle, ohne-Aspekt-Liste,
 * stabile Fehlt-Keys) rechnet DIESE Datei — das LLM liefert nur die Zuordnung und
 * die Fehlt-Freitexte. Reine Funktionen (Node-testbar); der Cache-/Transport-Rahmen
 * liegt in `bausteine.ts`.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport, BridgeZiel } from '@/core/services/ai/transports/streamlit';
import type { VbSektion } from './gliederung';
import {
  getOrComputeBaustein, aspekteCacheKey, vbHashFuer, type BausteinResult,
} from './bausteine';

// Der Prüfaspekt-Katalog (PruefAspekt/PRUEF_ASPEKTE/ASPEKT_IDS) lebt im Leaf-Modul
// `aspekt-katalog.ts` (dep-frei) und wird hier re-exportiert — Konsumenten, die NUR
// den Katalog brauchen (Werkbank), importieren dort, ohne diese Transport-/IDB-Kette.
// Import zusätzlich für die lokale Nutzung in den Funktionen unten (Re-Export allein
// legt keine lokalen Bindungen an).
import { PRUEF_ASPEKTE, ASPEKT_IDS } from './aspekt-katalog';
export { PRUEF_ASPEKTE, ASPEKT_IDS, type PruefAspekt } from './aspekt-katalog';

/** „dünn"-Schwellen (Default): Anteil < 3 % ODER absolute Zeichenzahl < 1200. */
export const SUBSTANZ_DUENN_ANTEIL = 0.03;
export const SUBSTANZ_DUENN_ZEICHEN = 1200;

/** Ergebnis des Aspekt-Mappings (der gecachte Baustein-Datensatz). */
export interface AspektMapping {
  /** Aspekt-Buchstabe → zugeordnete Sektions-IDs (dedupe, nur bekannte). */
  zuordnung: Record<string, string[]>;
  /** Aspekt-Buchstabe → fehlende Pflichtangaben (Freitext). */
  fehlend: Record<string, string[]>;
}

/**
 * „Verdächtig": das Modell hat KEINE Sektion einem Aspekt zugeordnet, obwohl
 * mindestens eine (Nicht-`s-toc`) Sektion angeboten wurde — der stabile Fehlermodus
 * (Lauf mit R=0.00, Status trotzdem `ok`). `fehlend` allein zählt NICHT als
 * Zuordnung. Löst den einmaligen Retry in `getOrComputeBaustein` aus. Geteilt von
 * `computeAspekteBaustein` UND dem In-App-Eval-Runner (Mess-Parität).
 */
export function aspekteVerdaechtig(mapping: AspektMapping, sektionIds: string[]): boolean {
  const angeboten = sektionIds.some(id => id !== 's-toc');
  return angeboten && Object.keys(mapping.zuordnung).length === 0;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * Baut den Aspekt-Mapping-Prompt: nummerierte Sektionsliste (`s-toc` ausgenommen) +
 * Prüfaspekt-Katalog + volle VB + Ausgabeformat-Anweisung. Mehrfachzuordnung
 * erlaubt; `I/J`-Fälle als zwei Zeilen; keine Zuordnung erzwingen.
 */
export function buildAspektePrompt(gliederung: VbSektion[], vbMarkdown: string): string {
  const sektionListe = gliederung
    .filter(s => s.id !== 's-toc')
    .map(s => `[${s.id}] ${s.nummer ? `${s.nummer} ` : ''}${s.titel}`)
    .join('\n');
  const aspektListe = PRUEF_ASPEKTE.map(a => `- ${a.id}: ${a.name} — ${a.fokus}`).join('\n');
  return `Du ordnest die Sektionen einer Vorhabensbeschreibung (VB) den Prüfaspekten A–J eines Förderantrags zu.

## VB-Sektionen (nummeriert)
${sektionListe}

## Prüfaspekte
${aspektListe}

## Vollständige Vorhabensbeschreibung
${vbMarkdown}

## Aufgabe
1. Ordne jeder Sektion ALLE inhaltlich passenden Prüfaspekte zu — nicht nur den dominantesten. Eine Sektion trägt oft MEHRERE Aspekte (z.B. beschreibt ein Marktkapitel zugleich die Zielmärkte (I) UND die Meilenstein-/Zielkriterien (J)); dann gib beide an. Ein Aspekt darf zu mehreren Sektionen gehören. Erzwinge KEINE Zuordnung für Sektionen, die zu keinem Aspekt passen.
2. Benenne je Aspekt Angaben, die der Prüfaspekt erwartet, die die VB aber nicht enthält (z.B. fehlende Preisvorstellungen, fehlende Angaben zur vorhandenen Ausstattung). Beurteile das aus der Aspekt-Beschreibung oben — es gibt hier keinen weiteren Katalog. Fällt dir zu einem Aspekt nichts auf, lasse ihn aus.

## Ausgabeformat
Zuerst je Aspekt eine Zeile mit den zugeordneten Sektions-IDs:
A: <sektion-id>, <sektion-id>
B: <sektion-id>
Passt zu einem Aspekt keine einzige Sektion, lasse seine Zeile ganz weg.
Trägt eine Sektion mehrere Aspekte, taucht ihre ID in JEDER betroffenen Aspekt-Zeile auf — schreibe je Aspekt eine eigene Zeile. Gehört z.B. eine Sektion zu I UND J, erscheint ihre ID sowohl in der I- als auch in der J-Zeile.

Danach je fehlender Angabe eine Zeile, höchstens 12 Wörter:
A-fehlt: <kurzer Text der fehlenden Angabe>

Nutze ausschließlich die oben vergebenen Sektions-IDs und die Aspekt-Buchstaben A–J. Gib keinen Fließtext aus.`;
}

// ---------------------------------------------------------------------------
// Parser (tolerant, kein Throw)
// ---------------------------------------------------------------------------

/**
 * Tolerantes Parsing der LLM-Antwort → `AspektMapping`. Je Zeile: links der/die
 * Aspekt-Buchstabe(n) (bzw. `<X>-fehlt`), rechts die Sektions-IDs bzw. der
 * Fehlt-Text. Unbekannte Sektions-IDs werden verworfen, unbekannte Buchstaben
 * ignoriert, Doppeltes dedupliziert. Leeres Ergebnis erlaubt; KEIN Throw.
 */
export function parseAspektMapping(raw: string, sektionIds: string[]): AspektMapping {
  const known = new Set(sektionIds);
  const zuordnung: Record<string, string[]> = {};
  const fehlend: Record<string, string[]> = {};

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/^[\s>*_`#-]+/, '').trim(); // führende Deko/Bullet
    const ci = line.indexOf(':');
    if (ci < 0) continue;
    const links = line.slice(0, ci).trim();
    const rechts = line.slice(ci + 1).trim();
    if (!rechts) continue;

    // „A-fehlt: <Text>" (Block 2).
    const fehlt = /^([A-J])\s*-\s*fehlt\b/i.exec(links);
    if (fehlt) {
      const a = fehlt[1]!.toUpperCase();
      if (ASPEKT_IDS.has(a)) (fehlend[a] ??= []).push(rechts);
      continue;
    }

    // „A: <ids>" bzw. „I/J: <ids>" (Block 1) — alle A–J-Buchstaben links, einzeln
    // (`I, J`) ODER zusammengeklebt (`IJ`, defense-in-depth: das Modell soll je Aspekt
    // eine eigene Zeile schreiben, ein geklebtes Token darf aber nicht verloren gehen).
    const einzel = links.match(/\b[A-J]\b/g) ?? [];
    const geklebt = (links.match(/\b[A-J]{2,}\b/g) ?? []).flatMap(t => t.split(''));
    const buchstaben = [...new Set([...einzel, ...geklebt].map(s => s.toUpperCase()))].filter(a => ASPEKT_IDS.has(a));
    if (buchstaben.length === 0) continue;
    const ids = rechts.split(/[\s,]+/).map(t => t.trim()).filter(t => known.has(t));
    if (ids.length === 0) continue;
    for (const a of buchstaben) {
      zuordnung[a] = [...new Set([...(zuordnung[a] ?? []), ...ids])];
    }
  }
  return { zuordnung, fehlend };
}

// ---------------------------------------------------------------------------
// Deterministische Ableitungen
// ---------------------------------------------------------------------------

/** Substanz eines Aspekts: zugeordnete Sektionen + deren Zeichenmasse + „dünn"-Flag. */
export interface AspektSubstanz {
  aspektId: string;
  sektionIds: string[];
  /** Summe der Zeichen (`end - start`) der zugeordneten Sektionen. */
  zeichen: number;
  /** `zeichen` ÷ Gesamtzeichen (ohne `s-toc`), 0…1. */
  anteil: number;
  /** true, wenn der Aspekt Fundstellen hat, diese aber dünn sind (Anteil/Zeichen unter Schwelle). */
  duenn: boolean;
}

/** Gesamtzeichenmasse der Gliederung ohne das Inhaltsverzeichnis (`s-toc`). */
function gesamtZeichen(gliederung: VbSektion[]): number {
  return gliederung.filter(s => s.id !== 's-toc').reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
}

/**
 * Deterministische Substanz je Aspekt (Default #6): Anteil = Zeichen der einem
 * Aspekt zugeordneten Sektionen ÷ Gesamtzeichen (ohne `s-toc`). „dünn" nur, wenn
 * der Aspekt überhaupt Fundstellen hat (Aspekte ganz ohne Fundstelle sind ein
 * eigener Zustand, kein „dünn").
 */
export function berechneSubstanz(mapping: AspektMapping, gliederung: VbSektion[]): AspektSubstanz[] {
  const byId = new Map(gliederung.map(s => [s.id, s]));
  const gesamt = gesamtZeichen(gliederung);
  return PRUEF_ASPEKTE.map(a => {
    const ids = [...new Set(mapping.zuordnung[a.id] ?? [])].filter(id => byId.has(id) && id !== 's-toc');
    const zeichen = ids.reduce((sum, id) => { const s = byId.get(id)!; return sum + Math.max(0, s.end - s.start); }, 0);
    const anteil = gesamt > 0 ? zeichen / gesamt : 0;
    const duenn = ids.length > 0 && (anteil < SUBSTANZ_DUENN_ANTEIL || zeichen < SUBSTANZ_DUENN_ZEICHEN);
    return { aspektId: a.id, sektionIds: ids, zeichen, anteil, duenn };
  });
}

/**
 * Invertierung: Sektions-ID → zugeordnete Aspekt-Buchstaben (für Karte/Badges).
 * Reihenfolge der Aspekte stabil (A…J).
 */
export function sektionZuAspekte(mapping: AspektMapping): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of PRUEF_ASPEKTE) {
    for (const id of mapping.zuordnung[a.id] ?? []) {
      (out[id] ??= []).push(a.id);
    }
  }
  return out;
}

/**
 * Ebene-1-Sektionen, die (weder selbst noch über eine nummern-verwandte
 * Unter-Sektion) einem Aspekt zugeordnet sind — „NICHT IM PRÜFRASTER". `s-intro`
 * und `s-toc` ausgenommen.
 */
export function ermittleOhneAspekt(mapping: AspektMapping, gliederung: VbSektion[]): VbSektion[] {
  const zugeordnet = new Set(Object.values(mapping.zuordnung).flat());
  const hatKindZuordnung = (s: VbSektion): boolean =>
    !!s.nummer && gliederung.some(k => k.id !== s.id && k.nummer?.startsWith(`${s.nummer}.`) && zugeordnet.has(k.id));
  return gliederung.filter(
    s => s.ebene === 1 && s.id !== 's-toc' && s.id !== 's-intro' && !zugeordnet.has(s.id) && !hatKindZuordnung(s),
  );
}

/** Ein aus einer LLM-`fehlt`-Angabe abgeleiteter offener-Punkt-Kandidat (stabiler Key). */
export interface OffenerPunktKandidat {
  /** `aspekt-fehlt:<aspekt>:<slug(text)>` — stabil, für die `offenePunkte`-Mechanik. */
  key: string;
  aspektId: string;
  text: string;
}

/** Deutsch-tolerante Slug-Bildung (Umlaute ausgeschrieben, nur a-z0-9-, gekürzt). */
function slug(s: string): string {
  return s.toLowerCase().normalize('NFC')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/**
 * Fehlt-Einträge als offene-Punkt-Kandidaten mit stabilen Keys (Default #10). Der
 * Key `aspekt-fehlt:<aspekt>:<slug(text)>` bleibt über Neuberechnungen stabil, solange
 * Aspekt + Text gleich bleiben (→ die Nutzer-Markierung übersteht „Neu aufbereiten").
 */
export function fehlendeAlsKandidaten(mapping: AspektMapping): OffenerPunktKandidat[] {
  const out: OffenerPunktKandidat[] = [];
  for (const a of PRUEF_ASPEKTE) {
    for (const text of mapping.fehlend[a.id] ?? []) {
      out.push({ key: `aspekt-fehlt:${a.id}:${slug(text)}`, aspektId: a.id, text });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Compute (Cache-Rahmen)
// ---------------------------------------------------------------------------

/**
 * Berechnet (oder liest gecacht) das Aspekt-Mapping für einen Antrag. Leeres
 * Parse-Ergebnis (weder Zuordnung noch Fehlt) gilt als Degradation (nicht gecacht).
 */
export async function computeAspekteBaustein(
  idb: IDBStore,
  transport: AITransport,
  skill: SkillRecord,
  antragKey: string,
  gliederung: VbSektion[],
  vbMarkdown: string,
  opts?: { force?: boolean; ziel?: BridgeZiel },
): Promise<BausteinResult<AspektMapping>> {
  const vbHash = vbHashFuer(vbMarkdown);
  const sektionIds = gliederung.map(s => s.id);
  return getOrComputeBaustein<AspektMapping>(
    idb, transport, skill,
    aspekteCacheKey(antragKey, vbHash), vbHash,
    () => buildAspektePrompt(gliederung, vbMarkdown),
    (raw) => {
      const mapping = parseAspektMapping(raw, sektionIds);
      const leer = Object.keys(mapping.zuordnung).length === 0 && Object.keys(mapping.fehlend).length === 0;
      return leer ? null : mapping;
    },
    {
      ...opts,
      // 0 Zuordnungen bei ≥1 Sektion → verdächtig → EIN Retry, sonst degradiert
      // (statt fälschlich `ok`). `fehlend`-only-Antworten fängt genau dieser Pfad.
      verdaechtig: { pruefe: (m) => aspekteVerdaechtig(m, sektionIds), grund: 'Modell hat keine Sektion zugeordnet' },
    },
  );
}
