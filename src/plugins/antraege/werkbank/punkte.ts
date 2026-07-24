/**
 * Reine Punkt-Operationen der Werkbank (UI-frei, testbar). Der stabile Key eines
 * manuellen Punkts leitet sich aus seinem Text ab (`hashText`, die gutachten-eigene
 * djb2-Variante) — gleicher Text ⇒ gleicher Key, kein Dubletten-Wildwuchs.
 */
import { hashText } from '../gutachten/runner';
import type { PunktQuelle, WerkbankPunkt } from './types';

/** Normalisiert den Text für die Key-Bildung (Whitespace/Case). Rein. */
function normText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Stabiler Key eines manuell erfassten Punkts (aus dem Text). */
export function punktKeyAusText(text: string): string {
  return `manuell:${hashText(normText(text))}`;
}

/** Legt einen neuen manuellen Punkt an. Rein (Zeitstempel von aussen). */
export function neuerPunkt(
  text: string, aspektId: string | null, fundstellen: string[], erstelltAm: string,
): WerkbankPunkt {
  return {
    key: punktKeyAusText(text),
    text: text.trim(),
    aspektId,
    fundstellen,
    quelle: 'manuell',
    erledigt: false,
    erstelltAm,
  };
}

/**
 * Fügt einen Punkt hinzu ODER aktualisiert einen gleich-gekeyten (idempotent bei
 * gleichem Text). Ein übernommener Punkt (MAP/Rechencheck) trägt seinen `originKey`
 * als stabile Identität. Rein.
 */
export function upsertPunkt(punkte: readonly WerkbankPunkt[], punkt: WerkbankPunkt): WerkbankPunkt[] {
  const idx = punkte.findIndex(p => p.key === punkt.key);
  return idx >= 0 ? punkte.map((p, i) => (i === idx ? punkt : p)) : [...punkte, punkt];
}

/** Entfernt einen Punkt per Key. Rein. */
export function entfernePunkt(punkte: readonly WerkbankPunkt[], key: string): WerkbankPunkt[] {
  return punkte.filter(p => p.key !== key);
}

/** Setzt das erledigt-Flag. Rein. */
export function setzeErledigt(punkte: readonly WerkbankPunkt[], key: string, erledigt: boolean): WerkbankPunkt[] {
  return punkte.map(p => (p.key === key ? { ...p, erledigt } : p));
}

/**
 * Baut einen übernommenen Punkt (z. B. aus einem MAP-Kriterium). Der `originKey`
 * hält die Identität stabil, auch wenn der Text sich leicht ändert.
 */
export function uebernommenerPunkt(opts: {
  originKey: string; quelle: PunktQuelle; text: string; aspektId: string | null;
  fundstellen?: string[]; erstelltAm: string;
}): WerkbankPunkt {
  return {
    key: `${opts.quelle}:${opts.originKey}`,
    text: opts.text.trim(),
    aspektId: opts.aspektId,
    fundstellen: opts.fundstellen ?? [],
    quelle: opts.quelle,
    originKey: opts.originKey,
    erledigt: false,
    erstelltAm: opts.erstelltAm,
  };
}
