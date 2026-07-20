/**
 * Datenschutz-Schranke des Imports.
 *
 * Die Plattform-Einreichung enthält weit mehr, als die Prüfung braucht:
 * Personalbögen mit Geburtsdatum, Gehalt, VWL und Tarifgruppe, die
 * Bankverbindung des Antragstellers, Ansprechpartner mit Telefonnummern und
 * Browser-Telemetrie. Nichts davon wird importiert — gebraucht werden nur
 * PM-Summen und Personalnummer/N.N.
 *
 * Zwei Mechanismen, bewusst getrennt:
 *
 * - `VERBOTENE_PFADE` sind **Pfad-Präfixe**, keine Feldnamen. Ein Feldname-
 *   Filter würde ein gleichnamiges Feld aus einem harmlosen Teilbaum mit
 *   verwerfen und — schlimmer — ein umbenanntes Feld im verbotenen Teilbaum
 *   durchlassen.
 * - `findeVerdaechtigeWerte` ist der **Nachweis**: ein Scan über das fertige
 *   Importergebnis. Der Adapter listet nur auf, was er zu übernehmen gedenkt;
 *   dieser Scan prüft, was tatsächlich drin gelandet ist.
 */
import { sammlePfade } from './pfad';

/**
 * Teilbäume der Quelle, die der Adapter nie liest. Präfix-Semantik: `a.b` deckt
 * `a.b` und alles darunter ab.
 */
export const VERBOTENE_PFADE: readonly string[] = [
  'data.mitarbeiter.personalbogen_editgrid',
  'data.personalkostentemp.personalbogen_editgrid',
  'data.auftraegefp.personalbogen_editgrid',
  'data.bankverb',
  'data.plansprechpartner',
  'data.bevollmaechtigter',
  'data.berater',
  'metadata',
];

/** `true`, wenn der Pfad in einem verbotenen Teilbaum liegt. Rein. */
export function istVerbotenerPfad(pfad: string): boolean {
  return VERBOTENE_PFADE.some(p => pfad === p || pfad.startsWith(`${p}.`));
}

/**
 * Listet alle Quellpfade auf, die der Adapter bewusst verwirft — der
 * Datenschutz-Nachweis für den Import-Report. Rein.
 */
export function findeVerworfenePfade(quelle: unknown): string[] {
  return sammlePfade(quelle).filter(istVerbotenerPfad);
}

/**
 * Feldnamen-Marker, die in einem sauberen Importergebnis NICHT vorkommen dürfen.
 * Absichtlich Substring-Muster auf Schlüsselnamen — sie fangen auch umbenannte
 * Varianten (`jahresbruttokorrigiert_number`, `mitarbeiterfixmonatsbrutto_number`).
 */
export const VERDAECHTIGE_SCHLUESSEL: readonly string[] = [
  'iban', 'bic', 'geldinstitut', 'bankverb',
  'geburtsdatum', 'email', 'telefon',
  'brutto', 'gehalt', 'vwl', 'stundensatz', 'tvod',
  'normiertemonatskosten', 'einstellungsdatum', 'qualifikation',
];

export interface VerdaechtigerFund {
  pfad: string;
  marker: string;
}

/**
 * Nachweis-Scan über das Importergebnis: findet Schlüssel, die nach
 * personenbezogenen Daten aussehen. Ein leeres Ergebnis ist die Zusicherung,
 * dass die Redaktion gegriffen hat. Rein.
 */
export function findeVerdaechtigeWerte(ergebnis: unknown): VerdaechtigerFund[] {
  const funde: VerdaechtigerFund[] = [];
  for (const pfad of sammlePfade(ergebnis)) {
    const klein = pfad.toLowerCase();
    for (const marker of VERDAECHTIGE_SCHLUESSEL) {
      if (klein.includes(marker)) {
        funde.push({ pfad, marker });
        break;
      }
    }
  }
  return funde;
}
