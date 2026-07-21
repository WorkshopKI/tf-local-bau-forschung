/**
 * Präzisions-Nachforderungen aus unbezifferten Zielwerten und unscharfen Begriffen.
 *
 * FORMULIERUNGS-LEITPLANKE (der eigentliche Zweck dieser Datei): jede erzeugte
 * Frage verlangt eine **konkrete Angabe** UND das **Messverfahren bzw. die
 * Bezugsgrösse**. Ein „bitte näher erläutern" ist verboten — es produziert eine
 * zweite Runde Prosa und damit genau das Problem, gegen das der Substanzcheck
 * gebaut ist. Die Leitplanke steckt fest im Generator, nicht in einem Prompt:
 * so kann kein Modell-Lauf sie aufweichen.
 *
 * Die Registry-Bausteine werden NIE umformuliert (Pitfall #34). Passt einer, wird
 * sein Text im Entwurf wortgetreu gesetzt und die generierte Frage tritt als
 * Konkretisierung daneben; passt keiner, steht dort `[TODO Baustein zuordnen]`.
 *
 * Reine Funktionen.
 */
import { hashText } from '@/plugins/antraege/gutachten/runner';
import type { MapPraezisionsNf } from '../checkliste/typen';
import type { SdtDeltaZeile } from '../infografik/schema';
import type { UnschaerfeBegriff } from '../infografik/substanz';
import { sucheNfBausteine } from '../abschluss/nf-suche';
import { normalisiere } from './schluessel';

/** Was in jeder Frage stehen muss — einmal formuliert, überall verwendet. */
const VERLANGT = 'Bitte benennen Sie zusätzlich das Messverfahren und die Bezugsgrösse.';

/** Stabile ID: derselbe Auslöser erzeugt denselben Eintrag, nie eine Dublette. */
export function praezisionsNfId(quelle: 'delta' | 'unschaerfe', ausloeser: string): string {
  return `nf-${quelle}-${hashText(normalisiere(ausloeser))}`;
}

function frageFuerDelta(zeile: SdtDeltaZeile): string {
  const ziel = zeile.zielWert.trim();
  if (zeile.quantifizierung === 'fehlt') {
    return `Für den Zielparameter „${zeile.parameter}" ist kein Zielwert angegeben.`
      + ` Bitte beziffern Sie den angestrebten Wert. ${VERLANGT}`;
  }
  return `Der Zielwert für „${zeile.parameter}" ist bislang nur qualitativ beschrieben`
    + (ziel.length > 0 ? ` („${ziel}")` : '')
    + `. Bitte beziffern Sie ihn. ${VERLANGT}`;
}

function frageFuerUnschaerfe(begriff: UnschaerfeBegriff): string {
  if (begriff.grund === 'nicht quantifiziert') {
    return `Die Formulierung „${begriff.begriff}" ist nicht beziffert.`
      + ` Bitte geben Sie den angestrebten Wert an. ${VERLANGT}`;
  }
  return `Der Begriff „${begriff.begriff}" ist nicht bestimmt.`
    + ` Bitte definieren Sie ihn anhand eines messbaren Kriteriums und geben Sie den`
    + ` zugehörigen Wert an. ${VERLANGT}`;
}

function baue(
  quelle: 'delta' | 'unschaerfe', ausloeser: string, frage: string, erzeugtAm: string,
): MapPraezisionsNf {
  // Ein Baustein-Treffer ist ein Vorschlag für den Entwurf, keine Umformulierung
  // der Frage: der Rechtstext des Bausteins und die konkrete Zahlen-Nachfrage
  // stehen im Entwurf nebeneinander.
  const treffer = sucheNfBausteine([ausloeser], 'tv', 1);
  return {
    id: praezisionsNfId(quelle, ausloeser),
    quelle,
    ausloeser,
    frage,
    bausteinId: treffer.length > 0 ? treffer[0]!.baustein.id : null,
    erzeugtAm,
  };
}

/** Präzisions-NF aus einer Delta-Zeile ohne belastbaren Zielwert. Rein. */
export function nfAusDeltaZeile(zeile: SdtDeltaZeile, erzeugtAm: string): MapPraezisionsNf {
  return baue('delta', zeile.parameter, frageFuerDelta(zeile), erzeugtAm);
}

/** Präzisions-NF aus einem unscharfen Begriff. Rein. */
export function nfAusUnschaerfe(
  begriff: UnschaerfeBegriff, erzeugtAm: string,
): MapPraezisionsNf {
  return baue('unschaerfe', begriff.begriff, frageFuerUnschaerfe(begriff), erzeugtAm);
}

/**
 * Nimmt einen Eintrag auf, ohne Dubletten zu erzeugen. Ein zweiter Klick auf
 * denselben Auslöser ersetzt den vorhandenen Eintrag (neuer Wortlaut nach einem
 * neuen Lauf), statt die Liste zu verdoppeln. Rein.
 */
export function ergaenzeNf(
  vorhanden: readonly MapPraezisionsNf[], neu: MapPraezisionsNf,
): MapPraezisionsNf[] {
  const ohne = vorhanden.filter(n => n.id !== neu.id);
  return [...ohne, neu];
}
