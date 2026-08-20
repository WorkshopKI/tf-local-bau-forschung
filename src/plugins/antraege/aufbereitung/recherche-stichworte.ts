/**
 * Stichwort-Kern des Deep-Research-Auftrags (Paket 5, Phase 1). Das interne Modell
 * liefert NUR noch kurze Nominalphrasen als JSON; den Auftragstext baut die feste
 * Vorlage (`recherche-auftrag.ts`) deterministisch daraus.
 *
 * Hintergrund: solange das Modell den ganzen Auftrag frei formulierte, erzählte es die
 * VB nach — die im Antrag identifizierten Lücken, seine Marktzahlen, seine Wettbewerber,
 * seine Zielkennwerte. Das ist doppelt schädlich: der externe Dienst bestätigt dann nur
 * noch die vorgegebenen Antworten (als Gegenprobe wertlos), und substanzieller
 * Antragsinhalt verlässt mit dem Kopieren den geschützten Bereich.
 *
 * Deshalb ist dieser Sanitizer die eigentliche Leitplanke — **deterministisch**, nicht
 * per Prompt-Bitte: Zahlwerte fliegen raus (Zahlen-Wächter), Sätze werden auf
 * Nominalphrasen gestutzt (Wort-Kappung), identifizierende Angaben werden entfernt
 * (Leak-Filter, `recherche-leak.ts`). Rein/Node-testbar, kein LLM, kein IDB.
 */
import { clean, kurz } from './recherche';
import { findeLeaks, type BekannteStammwerte } from './recherche-leak';
import { auftragsRahmen } from './recherche-auftrag';
import { extractLastJsonObject } from './steckbrief';

/**
 * Schema-Version der INTERNEN Stichwort-Antwort. Eigene Achse — nicht zu verwechseln
 * mit `RECHERCHE_SCHEMA_VERSION` (`recherche-schema.ts`), das den EXTERNEN Rückweg
 * versioniert. Fließt in den Baustein-Cache-Key ein (Shape-Wechsel = kalter Cache).
 */
export const STICHWORTE_SCHEMA_VERSION = 1;

/** Die Stichworte, aus denen die feste Vorlage den DR-Auftrag baut. */
export interface RechercheStichworte {
  /** Technologiefeld — die einzige Pflichtangabe. */
  themenfeld: string;
  /** Branche/Einsatzkontext. */
  anwendungsdomaene: string;
  /** Verfahren/Technologien des Themengebiets. */
  technologien: string[];
  /** Leistungsdimensionen OHNE Zahlwert („Latenz", „Skalierbarkeit der Agentenzahl"). */
  leistungsdimensionen: string[];
  /** Marktsegmente/Zielmärkte. */
  marktsegmente: string[];
  /** Englische Fachbegriffe (Paper-/Marktstudien-Suche). */
  suchbegriffeEn: string[];
}

/** Leere Stichworte (Basis für Merge/Fallback). */
export const LEERE_STICHWORTE: RechercheStichworte = {
  themenfeld: '',
  anwendungsdomaene: '',
  technologien: [],
  leistungsdimensionen: [],
  marktsegmente: [],
  suchbegriffeEn: [],
};

/** Feld-Grenzen: max. Wörter je Eintrag + max. Einträge je Liste. */
export const FELD_GRENZEN = {
  themenfeld: { woerter: 8 },
  anwendungsdomaene: { woerter: 8 },
  technologien: { woerter: 5, anzahl: 8 },
  leistungsdimensionen: { woerter: 4, anzahl: 4 },
  marktsegmente: { woerter: 5, anzahl: 4 },
  suchbegriffeEn: { woerter: 5, anzahl: 8 },
} as const;

// ---------------------------------------------------------------------------
// Sanitizer
// ---------------------------------------------------------------------------

/**
 * Etablierte Fachbegriffe MIT Ziffer, die kein Antragswert sind. Bewusst knapp: was
 * hier nicht steht, gilt als Zahlwert und fliegt raus (lieber ein Begriff zu wenig als
 * eine Kennzahl des Antrags im externen Auftrag).
 */
const ZIFFER_ALLOWLIST = /\b(?:[2-6]D|[2-6]G|4\.0|CO2|H2O|H2|NOx|Web3|IPv[46]|P2P|B2[BC])\b/gi;

/** Führende Aufzählungszeichen/Anführungszeichen + schließende Satzzeichen abschneiden. */
function trimmeRand(s: string): string {
  return s
    .replace(/^[\s\-–—*•·>»"'„“‚‘]+/, '')
    .replace(/[\s.,;:!?"'“”‚‘»«]+$/, '');
}

/**
 * Trägt der Text einen Zahlwert? Etablierte Ziffer-Token (5G, Industrie 4.0, CO2)
 * werden vorher entfernt — bleibt danach eine Ziffer übrig, ist es eine Kennzahl
 * („≤ 10 s Latenz", „1,2 Mrd. €", „30–50 Agenten") und der Eintrag wird verworfen.
 */
export function traegtZahlwert(s: string): boolean {
  return /\d/.test(s.replace(ZIFFER_ALLOWLIST, ''));
}

/** Warum ein Eintrag verworfen wurde (der Chip-Editor zeigt es dem Prüfer an). */
export type StichwortAblehnung = 'leer' | 'zahlwert' | 'identifizierend';

export type StichwortPruefung =
  | { ok: true; wert: string }
  | { ok: false; grund: StichwortAblehnung };

/**
 * Prüft und normalisiert EINEN Eintrag: Rand trimmen, Whitespace normalisieren,
 * Zahlwert-Guard, Leak-Guard, Wort-Kappung. Dieselbe Funktion bedient den LLM-Satz und
 * die Nutzer-Eingabe im Chip-Editor — der Prüfer kann die Regel also nicht umgehen,
 * bekommt aber den Grund genannt (stilles Verschwinden wäre nicht erklärbar).
 */
export function pruefeStichwort(
  roh: unknown, woerter: number, werte: BekannteStammwerte = {},
): StichwortPruefung {
  if (typeof roh !== 'string') return { ok: false, grund: 'leer' };
  const t = clean(trimmeRand(roh));
  if (!t) return { ok: false, grund: 'leer' };
  if (traegtZahlwert(t)) return { ok: false, grund: 'zahlwert' };
  // Gegen den Auftrags-RAHMEN geprüft: ein Wort, das ohnehin in der festen
  // Vorlage steht („Technik", „Forschung", „Markt"), ist kein identifizierender
  // Namensbestandteil — sonst verwarf der Sanitizer für eine „… Technik GmbH"
  // jedes fachlich richtige Stichwort (v4.124, siehe `findeLeaks`).
  if (findeLeaks(t, werte, auftragsRahmen()).length > 0) return { ok: false, grund: 'identifizierend' };
  const gekappt = kurz(t, woerter);
  return gekappt ? { ok: true, wert: gekappt } : { ok: false, grund: 'leer' };
}

/** Menschenlesbarer Grund (UI + Tests lesen denselben Text). */
export const ABLEHNUNGS_TEXT: Record<StichwortAblehnung, string> = {
  leer: 'Kein verwertbarer Begriff.',
  zahlwert: 'Enthält einen Zahlwert — der Auftrag fragt nach Kennzahlen, gibt aber keine vor.',
  identifizierend: 'Enthält eine identifizierende Angabe aus den Stammdaten.',
};

function bereinigeEintrag(roh: unknown, woerter: number, werte: BekannteStammwerte): string | null {
  const p = pruefeStichwort(roh, woerter, werte);
  return p.ok ? p.wert : null;
}

/** Verworfene Einträge mitzählen — das UI sagt ehrlich, dass etwas entfernt wurde. */
interface Zaehler { entfernt: number }

function bereinigeListe(
  roh: unknown, grenzen: { woerter: number; anzahl: number }, werte: BekannteStammwerte, z: Zaehler,
): string[] {
  if (!Array.isArray(roh)) return [];
  const gesehen = new Set<string>();
  const out: string[] = [];
  for (const eintrag of roh) {
    const t = bereinigeEintrag(eintrag, grenzen.woerter, werte);
    if (!t) { z.entfernt += 1; continue; }
    const k = t.toLowerCase();
    if (gesehen.has(k)) continue; // Dublette ist kein Verlust → nicht als „entfernt" zählen
    gesehen.add(k);
    if (out.length < grenzen.anzahl) out.push(t);
  }
  return out;
}

export interface BereinigungsErgebnis {
  stichworte: RechercheStichworte;
  /** Anzahl verworfener Einträge (Zahlwert oder identifizierender Bezug). */
  entfernt: number;
}

/**
 * Bereinigt einen rohen (LLM- oder Nutzer-) Stichwort-Satz auf die zulässige Form.
 * Idempotent: ein bereits bereinigter Satz kommt unverändert zurück — deshalb darf
 * auch jede Nutzer-Eingabe im Chip-Editor durch dieselbe Funktion laufen.
 */
export function bereinigeStichworte(
  roh: Partial<Record<keyof RechercheStichworte, unknown>> | null | undefined,
  werte: BekannteStammwerte = {},
): BereinigungsErgebnis {
  const z: Zaehler = { entfernt: 0 };
  if (!roh) return { stichworte: { ...LEERE_STICHWORTE }, entfernt: 0 };

  const einzeln = (v: unknown, woerter: number): string => {
    if (v === undefined || v === null || v === '') return '';
    const t = bereinigeEintrag(v, woerter, werte);
    if (!t) { z.entfernt += 1; return ''; }
    return t;
  };

  return {
    stichworte: {
      themenfeld: einzeln(roh.themenfeld, FELD_GRENZEN.themenfeld.woerter),
      anwendungsdomaene: einzeln(roh.anwendungsdomaene, FELD_GRENZEN.anwendungsdomaene.woerter),
      technologien: bereinigeListe(roh.technologien, FELD_GRENZEN.technologien, werte, z),
      leistungsdimensionen: bereinigeListe(roh.leistungsdimensionen, FELD_GRENZEN.leistungsdimensionen, werte, z),
      marktsegmente: bereinigeListe(roh.marktsegmente, FELD_GRENZEN.marktsegmente, werte, z),
      suchbegriffeEn: bereinigeListe(roh.suchbegriffeEn, FELD_GRENZEN.suchbegriffeEn, werte, z),
    },
    entfernt: z.entfernt,
  };
}

/**
 * Reicht der Satz für einen brauchbaren Auftrag? Ohne Themenfeld gäbe es kein Suchfeld;
 * ohne Verfahren UND ohne Marktsegment bliebe die Vorlage eine leere Fragenliste.
 */
export function stichworteBrauchbar(s: RechercheStichworte): boolean {
  return !!s.themenfeld && (s.technologien.length >= 2 || s.marktsegmente.length >= 1);
}

// ---------------------------------------------------------------------------
// Parser (tolerant, kein Throw)
// ---------------------------------------------------------------------------

/**
 * Liest den Stichwort-Satz aus dem letzten JSON-Objekt der Modell-Antwort und bereinigt
 * ihn sofort. `null`, wenn kein Objekt erkennbar ist oder KEIN Feld etwas hergab —
 * dann degradiert der Baustein (Rohtext bleibt zur Einsicht).
 */
export function parseStichworte(
  raw: string, werte: BekannteStammwerte = {},
): BereinigungsErgebnis | null {
  const obj = extractLastJsonObject(raw);
  if (!obj) return null;
  const erg = bereinigeStichworte(obj as Partial<Record<keyof RechercheStichworte, unknown>>, werte);
  const s = erg.stichworte;
  const leer = !s.themenfeld && !s.anwendungsdomaene
    && !s.technologien.length && !s.leistungsdimensionen.length
    && !s.marktsegmente.length && !s.suchbegriffeEn.length;
  return leer ? null : erg;
}
