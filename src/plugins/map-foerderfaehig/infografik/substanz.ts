/**
 * Substanzcheck: Widersprüche und Unschärfe-Begriffe aus dem Extraktions-Lauf.
 *
 * Beide Listen sind der Anti-Prosa-Hebel. Sie bewerten keine Textqualität,
 * sondern halten Behauptungen gegen harte Daten (Widerspruch) und gegen die
 * Quantifizierungspflicht (Unschärfe).
 *
 * Zwei Leitplanken prägen den Parser:
 *
 * 1. **Eine leere Liste ist ein gutes Ergebnis.** Ein sauberer Antrag hat keine
 *    Widersprüche. Leere Listen dürfen deshalb nie als Fehlschlag oder als
 *    „verdächtige" Antwort gelten (siehe `istInhaltsleer` in `schema.ts`, das
 *    diese Felder bewusst ignoriert).
 * 2. **Im Zweifel verwerfen, nicht raten.** Eine Zeile mit unbekannter `art`
 *    oder unbekanntem `grund` fällt raus. Ein Falsch-Positiv kostet den Prüfer
 *    Vertrauen in die ganze Ansicht; eine fehlende Zeile kostet ihn nichts, was
 *    er nicht ohnehin selbst läse.
 *
 * Reine Funktionen.
 */
import { alsSektionIds, alsText } from './roh';

/** Art der Abweichung zwischen Fliesstext und Einreichungsdaten. */
export type WiderspruchArt = 'zahl' | 'zeitraum' | 'bezeichnung';

export interface Widerspruch {
  /** Wortlaut des Fakts aus der Einreichung (Fakten-Block). */
  fakt: string;
  /** Wortlaut der abweichenden Aussage aus der Vorhabensbeschreibung. */
  aussageImText: string;
  art: WiderspruchArt;
  sektionIds: string[];
}

/** Warum ein Begriff als unscharf gilt. */
export type UnschaerfeGrund = 'nicht definiert' | 'nicht quantifiziert';

export interface UnschaerfeBegriff {
  /** Die beanstandete Formulierung, wortnah. */
  begriff: string;
  /** Der Satz bzw. Halbsatz, in dem sie steht. */
  kontext: string;
  grund: UnschaerfeGrund;
  sektionIds: string[];
}

export interface SubstanzDaten {
  widersprueche: Widerspruch[];
  unschaerfeBegriffe: UnschaerfeBegriff[];
}

/**
 * Obergrenze der Unschärfe-Liste. Sie ist eine Leseliste, die ein Mensch
 * durchgeht — jenseits von zehn Einträgen liest sie niemand mehr, und das
 * Modell fängt an, Füllwörter zu melden.
 */
export const UNSCHAERFE_MAX = 10;

const ARTEN: ReadonlySet<string> = new Set<WiderspruchArt>(['zahl', 'zeitraum', 'bezeichnung']);
const GRUENDE: ReadonlySet<string> = new Set<UnschaerfeGrund>(
  ['nicht definiert', 'nicht quantifiziert'],
);

function alsWiderspruch(roh: unknown, bekannt: ReadonlySet<string>): Widerspruch | null {
  if (roh === null || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;

  const fakt = alsText(o['fakt']);
  const aussageImText = alsText(o['aussageImText']);
  // Ein Widerspruch braucht BEIDE Seiten — mit nur einer ist er nicht prüfbar
  // und im Zweifel eine Halluzination.
  if (fakt.length === 0 || aussageImText.length === 0) return null;

  const art = alsText(o['art']);
  if (!ARTEN.has(art)) return null;

  return { fakt, aussageImText, art: art as WiderspruchArt, sektionIds: alsSektionIds(o['sektionIds'], bekannt) };
}

function alsUnschaerfe(roh: unknown, bekannt: ReadonlySet<string>): UnschaerfeBegriff | null {
  if (roh === null || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;

  const begriff = alsText(o['begriff']);
  if (begriff.length === 0) return null;

  const grund = alsText(o['grund']);
  if (!GRUENDE.has(grund)) return null;

  return {
    begriff,
    kontext: alsText(o['kontext']),
    grund: grund as UnschaerfeGrund,
    sektionIds: alsSektionIds(o['sektionIds'], bekannt),
  };
}

/**
 * Liest die beiden Substanz-Listen aus dem bereits geparsten Antwort-Objekt.
 * Fehlen sie ganz (altes Schema, abgeschnittene Antwort), sind die Listen leer —
 * das ist kein Fehlerfall. Rein.
 */
export function parseSubstanz(
  objekt: Record<string, unknown>, bekannt: ReadonlySet<string>,
): SubstanzDaten {
  const widerspruecheRoh = Array.isArray(objekt['widersprueche']) ? objekt['widersprueche'] : [];
  const unschaerfeRoh = Array.isArray(objekt['unschaerfeBegriffe'])
    ? objekt['unschaerfeBegriffe']
    : [];

  return {
    widersprueche: widerspruecheRoh
      .map(w => alsWiderspruch(w, bekannt))
      .filter((w): w is Widerspruch => w !== null),
    unschaerfeBegriffe: unschaerfeRoh
      .map(u => alsUnschaerfe(u, bekannt))
      .filter((u): u is UnschaerfeBegriff => u !== null)
      .slice(0, UNSCHAERFE_MAX),
  };
}
