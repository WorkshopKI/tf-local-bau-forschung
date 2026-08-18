/**
 * **Der Netzwerkantrag traegt den Namen seines Netzwerks — sonst niemand.**
 *
 * Die Spalte `NETZWERKNA` fuehren nur die TEILVORHABEN: sie zeigt auf das
 * Netzwerk, zu dem sie gehoeren (`"mobiInspec" 16KN083001_ED`). Der
 * Netzwerkantrag selbst laesst sie leer — er IST das Netzwerk, es gibt fuer ihn
 * nichts zu referenzieren. Am Bestand gemessen (13 016 16KN-Saetze): von 1 775
 * Netzwerkantraegen tragen **1 581 gar nichts** in der Spalte, und die
 * uebrigen 194 tragen ein Kennzeichen statt eines Namens (`"16KN111101"` — der
 * Verweis der Phase 2 auf ihre Phase 1).
 *
 * Fuer die Suche war das eine gebrochene Zusage: `nw:mobiInspec` versprach „das
 * Netzwerk" und lieferte nur seine Mitglieder. Wer den Netzwerkantrag selbst
 * suchte, fand ihn ueber dieses Feld nie — und der Antragstyp-Filter bot unter
 * `nw:` folgerichtig nur „FuE" an, nie „NW".
 *
 * Dieses Modul leitet den fehlenden Namen ab. **Zwei Quellen, in dieser
 * Reihenfolge:**
 *
 *  1. **Die Mitglieder.** Ihr `NETZWERKNA` nennt den Namen so, wie das
 *     Fachsystem ihn fuehrt. Das ist die bessere Quelle, weil sie garantiert
 *     DIESELBE Zeichenkette liefert wie bei den Mitgliedern — sonst zerfiele
 *     ein Netzwerk in der Vorschlagsliste in zwei Eintraege. Greift bei 1 306
 *     der 1 775 Netzwerkantraege.
 *  2. **Das eigene Akronym** (`VB_KURZNAM`), wo das Netzwerk (noch) keine
 *     Mitglieder hat — 468 Faelle. Umschliessende Klammern fallen weg: sie
 *     markieren im Bestand den abgelehnten Versuch (`(mobiInspec)`), sind aber
 *     kein Teil des Namens; ohne diese Regel bekaeme die Vorschlagsliste 91
 *     geklammerte Doppelgaenger.
 *
 * Genau **ein** Netzwerkantrag bleibt danach namenlos (16KN086601 — weder
 * Mitglieder noch Akronym). Er wird nicht geraten.
 *
 * **Mehrdeutigkeit gewinnt die Haeufigkeit.** 494 Netzwerke fuehren unter ihren
 * Mitgliedern mehr als eine Schreibweise; bei `mobiInspec` sind es 29 gegen
 * einen einzelnen `mobilnspec` (ein I/l-Vertipper in der Quelle). Der
 * Netzwerkantrag bekommt die haeufigste — die App waescht den Tippfehler damit
 * NICHT weg: beide Schreibweisen stehen weiter in der Vorschlagsliste, und
 * jede findet ihre eigenen Saetze. Geraten wird nur dort, wo ohnehin nichts
 * stuende.
 *
 * Rein: keine IO, kein React, kein IDB.
 */
import { extractNetzwerkId, isNetzwerkLead } from '../netzwerk';
import { netzwerkName } from './wert-index';

/** Was dieses Modul von einem Antrag braucht — nicht mehr. */
export interface NetzwerkZeile {
  aktenzeichen: string;
  vbPhase: unknown;
  /** Rohwert der Spalte `NETZWERKNA`. */
  netzwerkRoh: string;
  /** Rohwert der Spalte `VB_KURZNAM`. */
  akronym: string;
}

/**
 * Entfernt umschliessende Klammern eines Akronyms. `(mobiInspec)` →
 * `mobiInspec`; ein Name MIT innerer Klammer (`AutoPV (alt)`) bleibt ganz.
 */
export function ohneKlammern(akronym: string): string {
  const t = akronym.trim();
  return /^\([^()]*\)$/.test(t) ? t.slice(1, -1).trim() : t;
}

/**
 * Die Netzwerknamen der Netzwerkantraege, per Aktenzeichen.
 *
 * Enthaelt **nur** Netzwerkantraege, und von denen nur die, fuer die sich ein
 * Name belegen laesst. Teilvorhaben stehen nie darin — die tragen ihren Bezug
 * bereits selbst.
 */
export function leiteNetzwerkNamenAb(
  zeilen: readonly NetzwerkZeile[],
): ReadonlyMap<string, string> {
  // 1. Was die Mitglieder je Netzwerk nennen, mit ihrer Haeufigkeit.
  const jeNetz = new Map<string, Map<string, number>>();
  const leads: NetzwerkZeile[] = [];
  for (const z of zeilen) {
    const netzId = extractNetzwerkId(z.aktenzeichen);
    if (netzId === null) continue;
    if (isNetzwerkLead({ aktenzeichen: z.aktenzeichen, vb_phase: z.vbPhase as number })) {
      leads.push(z);
      continue;
    }
    const name = netzwerkName(z.netzwerkRoh);
    if (name === '') continue;
    let zaehler = jeNetz.get(netzId);
    if (!zaehler) { zaehler = new Map(); jeNetz.set(netzId, zaehler); }
    zaehler.set(name, (zaehler.get(name) ?? 0) + 1);
  }

  // 2. Je Netzwerkantrag: haeufigster Mitglieder-Name, sonst eigenes Akronym.
  const out = new Map<string, string>();
  for (const lead of leads) {
    const netzId = extractNetzwerkId(lead.aktenzeichen);
    if (netzId === null) continue;
    const name = haeufigster(jeNetz.get(netzId)) || ohneKlammern(lead.akronym);
    if (name !== '') out.set(lead.aktenzeichen, name);
  }
  return out;
}

/**
 * Der haeufigste Name; bei Gleichstand der alphabetisch erste — dieselbe Regel,
 * nach der `verdichteWertIndex` unter mehreren Schreibweisen waehlt. Ohne den
 * Gleichstand-Zweig entschiede die Einlese-Reihenfolge, und die Vorschlagsliste
 * zeigte je nach Import einen anderen Namen.
 */
function haeufigster(zaehler: Map<string, number> | undefined): string {
  if (!zaehler || zaehler.size === 0) return '';
  let bester = '';
  let beste = -1;
  for (const [name, anzahl] of zaehler) {
    if (anzahl > beste || (anzahl === beste && name.localeCompare(bester, 'de') < 0)) {
      bester = name;
      beste = anzahl;
    }
  }
  return bester;
}
