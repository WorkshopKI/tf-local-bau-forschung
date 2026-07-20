/**
 * Arbeitspakete + Einsatzplanung — der heikelste Teil des Imports.
 *
 * Zwei Eigenheiten der Quelle bestimmen das Design:
 *
 * 1. **Vier inkompatible AP-Referenzformate.** Die Arbeitspaket-Liste nennt APs
 *    als reinen Namen (`"AP1"`), die Einsatzplanung ebenso (im Feld `arbeitspacket`
 *    — Tippfehler der Quelle, ohne „e"), das Personalkosten-Grid als Objekt
 *    `{label: "1 AP1", value: "1-<startEpochMs>-<endeEpochMs>"}`, und die
 *    Auftrags-Grids als Freitext mit abweichender Gross-/Kleinschreibung
 *    (`"Ap2"` gegen `"AP2"`). Deshalb joint der Adapter über die numerischen
 *    Felder `number` ↔ `laufnummer` und NIE über den Namen. Die Namensauflösung
 *    (`loeseApRefAuf`) dient nur den Nebengrids, die keine Laufnummer führen.
 *
 * 2. **N.N. hat kein Flag.** Nicht besetzte Stellen sind ausschliesslich am
 *    Namen erkennbar, und die Schreibweise ist uneinheitlich (`"N.N."` als
 *    Vorname, `"N.N"` ohne Punkt als Nachname). `istNn` normalisiert deshalb,
 *    statt auf Literale zu vergleichen.
 */
import type { MapArbeitspaket, MapEinsatzZeile, MapMitarbeiterKurz } from '../types';
import { alsListe, alsText, alsZahl, lesePfad } from './pfad';

// --- N.N.-Erkennung ---------------------------------------------------------

/**
 * Erkennt „nicht benannt" in allen bekannten Schreibweisen: `N.N.`, `N.N`,
 * `N. N.`, `NN`, `n.n.` — auch doppelt, wenn Vor- und Nachname beide N.N. sind
 * (`"N.N. N.N"`). Rein.
 */
export function istNn(name: string | null): boolean {
  if (name === null) return false;
  const norm = name.toLowerCase().replace(/[.\s\-_]/g, '');
  return norm.length >= 2 && /^n+$/.test(norm);
}

export interface LabelTeile {
  /** Führende Personalnummer (antragslokales Pseudonym). */
  personalNr: string | null;
  /** Namensteil — wird NICHT gespeichert, nur für die N.N.-Erkennung gebraucht. */
  name: string | null;
}

/**
 * Zerlegt ein Mitarbeiter-Label `"<nr> | <Vorname> <Nachname>"`. Ohne Trenner
 * gilt der ganze Text als Name. Rein.
 */
export function zerlegeMitarbeiterLabel(label: unknown): LabelTeile {
  const text = alsText(label);
  if (text === null) return { personalNr: null, name: null };
  const idx = text.indexOf('|');
  if (idx < 0) return { personalNr: null, name: text };
  return {
    personalNr: alsText(text.slice(0, idx)),
    name: alsText(text.slice(idx + 1)),
  };
}

// --- Arbeitspakete ----------------------------------------------------------

/** Erntet die Arbeitspaket-Liste. Rein. */
export function ernteArbeitspakete(editgrid: unknown): MapArbeitspaket[] {
  return alsListe(editgrid).map((zeile, quellIndex) => ({
    laufnummer: alsZahl(lesePfad(zeile, 'number')),
    name: alsText(lesePfad(zeile, 'arbeitspaket')) ?? `AP ${quellIndex + 1}`,
    start: alsText(lesePfad(zeile, 'laufzeitstart_date')),
    ende: alsText(lesePfad(zeile, 'laufzeitend_date')),
    aufwandPm: alsZahl(lesePfad(zeile, 'arbeitsaufwand')),
    quellIndex,
  }));
}

// --- Einsatzplanung ---------------------------------------------------------

/** Erntet die Mitarbeiter-Zeilen einer Einsatzplanungs-Zeile. Rein. */
export function ernteMitarbeiter(liste: unknown): MapMitarbeiterKurz[] {
  return alsListe(liste).map(eintrag => {
    const { personalNr, name } = zerlegeMitarbeiterLabel(lesePfad(eintrag, 'mitarbeiternummer.label'));
    return {
      personalNr,
      istNn: istNn(name),
      pm: alsZahl(lesePfad(eintrag, 'gesamtpersonalmonateJeMitarbeiter')),
    };
  });
}

/** Anzahl der Jahresscheiben, die die Quelle je Mitarbeiter führt (`jahr1`…`jahr4`). */
const JAHRESSCHEIBEN = 4;

/**
 * Sammelt die Kalenderjahre, auf die eine Einsatzplanungs-Zeile Personenmonate
 * verteilt. Jahre ohne Personenmonate zählen nicht mit — sonst meldete jede
 * ungenutzte vierte Scheibe eine Laufzeitüberschreitung. Rein.
 */
export function ernteJahre(mitarbeiterListe: unknown): number[] {
  const jahre = new Set<number>();
  for (const eintrag of alsListe(mitarbeiterListe)) {
    for (let i = 1; i <= JAHRESSCHEIBEN; i++) {
      const jahr = alsZahl(lesePfad(eintrag, `jahr${i}`));
      const pm = alsZahl(lesePfad(eintrag, `personenmonateJahr${i}`));
      if (jahr !== null && pm !== null && pm > 0) jahre.add(jahr);
    }
  }
  return [...jahre].sort((a, b) => a - b);
}

/**
 * Erntet die Einsatzplanung. `apRefRoh` hält den Rohwert des Feldes
 * `arbeitspacket` — nur für die Diagnose im Report, nie als Join-Schlüssel.
 * Rein.
 */
export function ernteEinsatzplanung(editgrid: unknown): MapEinsatzZeile[] {
  return alsListe(editgrid).map(zeile => {
    const mitarbeiterListe = lesePfad(zeile, 'mitarbeiter');
    return {
      laufnummer: alsZahl(lesePfad(zeile, 'laufnummer')),
      apRefRoh: alsText(lesePfad(zeile, 'arbeitspacket')),
      aufwandPm: alsZahl(lesePfad(zeile, 'arbeitsaufwandPM')) ?? alsZahl(lesePfad(zeile, 'arbeitsaufwandAP')),
      gesamtkosten: alsZahl(lesePfad(zeile, 'gesamtkostenAP')),
      mitarbeiter: ernteMitarbeiter(mitarbeiterListe),
      jahre: ernteJahre(mitarbeiterListe),
    };
  });
}

/**
 * Anteil der Personenmonate, die auf nicht benanntes Personal entfallen.
 * `null`, wenn gar keine Personenmonate erfasst sind (0 wäre irreführend).
 * Dummy: 10 von 16 PM = 0.625. Rein.
 */
export function berechneNnAnteil(zeilen: readonly MapEinsatzZeile[]): number | null {
  let gesamt = 0;
  let nn = 0;
  for (const zeile of zeilen) {
    for (const ma of zeile.mitarbeiter) {
      const pm = ma.pm ?? 0;
      gesamt += pm;
      if (ma.istNn) nn += pm;
    }
  }
  return gesamt > 0 ? nn / gesamt : null;
}

// --- AP-Referenzen der Nebengrids ------------------------------------------

/**
 * Löst eine AP-Referenz beliebigen Formats auf eine Laufnummer auf.
 *
 * Reihenfolge: Objekt-`value` (`"1-<epoch>-<epoch>"` → führendes Segment) →
 * Objekt-`label` → führende Zahl eines Strings (`"1 AP1"`) → Namensvergleich
 * gegen die bekannten APs (case-insensitiv, deckt `"Ap2"` gegen `"AP2"` ab).
 *
 * Aus dem Epoch-Tripel wird BEWUSST nur das führende Segment gelesen: die
 * Zeitstempel entstehen browser-lokal und können gegenüber den Datumsfeldern um
 * einen Tag abweichen. Zeiträume kommen immer aus der Arbeitspaket-Liste.
 *
 * `null` = verwaiste Referenz. Rein.
 */
export function loeseApRefAuf(ref: unknown, pakete: readonly MapArbeitspaket[]): number | null {
  if (ref !== null && typeof ref === 'object' && !Array.isArray(ref)) {
    const ausValue = loeseApRefAuf(lesePfad(ref, 'value'), pakete);
    if (ausValue !== null) return ausValue;
    return loeseApRefAuf(lesePfad(ref, 'label'), pakete);
  }

  const text = alsText(ref);
  if (text === null) return null;

  const fuehrendeZahl = /^(\d+)(?:[-\s]|$)/.exec(text);
  if (fuehrendeZahl) {
    const nummer = Number(fuehrendeZahl[1]);
    if (pakete.some(p => p.laufnummer === nummer)) return nummer;
  }

  const norm = text.trim().toLowerCase();
  const perName = pakete.find(p => p.name.trim().toLowerCase() === norm);
  return perName?.laufnummer ?? null;
}

/**
 * Sammelt alle AP-Referenzen der Nebengrids, die auf kein bekanntes Arbeitspaket
 * zeigen. Rein.
 */
export function findeVerwaisteApRefs(
  refs: readonly unknown[], pakete: readonly MapArbeitspaket[],
): string[] {
  const verwaist: string[] = [];
  for (const ref of refs) {
    if (loeseApRefAuf(ref, pakete) !== null) continue;
    const anzeige = typeof ref === 'object' && ref !== null
      ? alsText(lesePfad(ref, 'label')) ?? JSON.stringify(ref)
      : alsText(ref);
    if (anzeige !== null && !verwaist.includes(anzeige)) verwaist.push(anzeige);
  }
  return verwaist;
}
