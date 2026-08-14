/**
 * Feldsuche in der Eingabe: `ast:GMBU`, `fkz:16KN08`, `ort:Dresden`.
 *
 * Das Dropdown „Suche in" ist die GROBE Wahl — es gilt für die ganze Anfrage und
 * kennt fünf Bereiche. Wer weiß, in welcher Spalte sein Wort steht, will es
 * feiner sagen und pro Wort: „der Titel heißt so, die Einrichtung heißt so".
 * Genau das ist ein Präfix. Beides greift ineinander: ein Wort OHNE Präfix folgt
 * dem Dropdown, ein Wort MIT Präfix folgt seinem Präfix.
 *
 * **Das Präfix schlägt den Bereich.** Wer `ast:GMBU` tippt, während das Dropdown
 * auf „nur Ort & Bundesland" steht, hat zweimal etwas gesagt — und die genauere
 * Angabe gewinnt. Die Gegenrichtung (der Bereich beschneidet das Präfix) ergäbe
 * eine Anfrage, die nachweislich nie trifft, und 0 Treffer, die aussehen wie
 * „steht nicht im Bestand". Die Deutungszeile schreibt das getroffene Feld
 * deshalb an jeden Chip.
 *
 * **Kein `dokument:`-Präfix.** Die Dokumente kommen aus dem Orama-Index, nicht
 * aus dem Antrags-Korpus; ihre Wahl ist der Bereich „nur Dokumente". Ein Präfix
 * daneben wäre ein zweiter Schalter für dieselbe Sache — und in einer
 * UND-Anfrage (`dokument:laser ast:gmbu`) könnten die beiden Quellen die
 * Bedingung gar nicht gemeinsam erfüllen: sie werden vereinigt, nicht
 * geschnitten. `aehnlichkeit` fehlt aus demselben Grund; sie hat ihren Schalter.
 *
 * Die Aliasse führen die CSV-Spaltencodes MIT (`ORG_AST`, `VB_TITEL`, …), weil
 * der Bearbeiter die Fördertabelle vor Augen hat, wenn er weiß, wo sein Wert
 * steht — und daneben die kurzen Alltagswörter, die niemand nachschlagen muss.
 *
 * Rein — kein React, kein IDB, kein Korpus.
 */
import type { Trefferfeld } from './trefferstelle';

/** Ein Suchteil nach dem Lesen der Anfrage. */
export interface FeldTeil {
  /**
   * Der Teil, wie er in der Anfrage steht — inklusive Präfix. Aus den `roh`-Teilen
   * lässt sich die Eingabe wieder zusammensetzen; das braucht die Deutungszeile,
   * die einzelne Teile abwählbar macht.
   */
  roh: string;
  /** Wonach gesucht wird — der Wert ohne Präfix. */
  wert: string;
  /** Das genannte Feld. `undefined` = kein Präfix, es gilt der Suchbereich. */
  feld?: Trefferfeld;
}

/**
 * Welches Wort vor dem Doppelpunkt welches Feld meint.
 *
 * Klein geschrieben verglichen (`AST:` = `ast:`). Was hier nicht steht, ist kein
 * Präfix — der Teil bleibt dann ein gewöhnliches Suchwort MIT Doppelpunkt. Das
 * ist Absicht: „Projekt: Laser" oder „http://…" darf die Suche nicht anders
 * deuten, nur weil ein Doppelpunkt darin vorkommt.
 */
const ALIASE: ReadonlyMap<string, Trefferfeld> = new Map<string, Trefferfeld>([
  ['titel', 'titel'],
  ['vb_titel', 'titel'],
  ['thema', 'titel'],

  ['inhalt', 'kurzbeschreibung'],
  ['vb_inhalt', 'kurzbeschreibung'],
  ['beschreibung', 'kurzbeschreibung'],
  ['kurzbeschreibung', 'kurzbeschreibung'],

  ['akronym', 'akronym'],
  ['vb_kurznam', 'akronym'],
  ['kurzname', 'akronym'],

  ['fkz', 'aktenzeichen'],
  ['akz', 'aktenzeichen'],
  ['aktenzeichen', 'aktenzeichen'],

  ['ast', 'organisation'],
  ['afs', 'organisation'],
  ['org', 'organisation'],
  ['org_ast', 'organisation'],
  ['org_afs', 'organisation'],
  ['einrichtung', 'organisation'],
  ['antragsteller', 'organisation'],

  ['ort', 'standort'],
  ['ort_ast', 'standort'],
  ['ort_afs', 'standort'],
  ['standort', 'standort'],
  ['bl', 'standort'],
  ['buland', 'standort'],
  ['bundesland', 'standort'],

  ['deskriptor', 'deskriptoren'],
  ['deskriptoren', 'deskriptoren'],
  ['schlagwort', 'deskriptoren'],

  ['web', 'domain'],
  ['domain', 'domain'],
  ['webadresse', 'domain'],
]);

/**
 * Das Präfix, das die App selbst schreibt — in Beispielen, in der Hilfe, in der
 * Deutungszeile. Genau eines je Feld: die Aliasse sind zum Lesen da, nicht zum
 * Vorschlagen, sonst stünden acht Schreibweisen derselben Sache im Beispiel.
 *
 * Jedes Feld, das die Wortlaut-Stufe kennt, MUSS hier stehen — sonst gibt es
 * eine Fundstelle, die man nicht ansprechen kann. Ein Guard hält das fest.
 */
export const FELD_PRAEFIX: Partial<Record<Trefferfeld, string>> = {
  titel: 'titel',
  kurzbeschreibung: 'inhalt',
  akronym: 'akronym',
  aktenzeichen: 'fkz',
  organisation: 'ast',
  standort: 'ort',
  deskriptoren: 'deskriptor',
  domain: 'web',
};

/** Alle bekannten Aliasse eines Feldes — für die Hilfe und für die Tests. */
export function aliasseFuer(feld: Trefferfeld): string[] {
  const out: string[] = [];
  for (const [alias, ziel] of ALIASE) if (ziel === feld) out.push(alias);
  return out;
}

/** Löst ein getipptes Präfix auf. `undefined` = kein bekanntes Feld. */
export function feldAusPraefix(roh: string): Trefferfeld | undefined {
  return ALIASE.get(roh.trim().toLowerCase());
}

/**
 * Zerlegt die Anfrage in ihre Suchteile und liest dabei die Feld-Präfixe.
 *
 * `alsWortfolge` bildet den Modus „genaue Wortfolge" ab: dort ist die ganze
 * Eingabe EIN Suchbegriff, also gibt es höchstens einen Teil — ein führendes
 * Präfix bindet dann an die gesamte Phrase (`ast: gesellschaft zur förderung`).
 *
 * Bewusst KEINE Faltung (`falte()`): die Korpus-Felder sind nur `toLowerCase()`
 * (siehe `search-corpus.ts`), eine gefaltete Anfrage träfe dort auf ungefalteten
 * Text und fände Umlaut-Wörter schlechter als heute. Die Schreibweise bleibt
 * ebenfalls erhalten — die Anzeige zeigt, was getippt wurde; klein gemacht wird
 * erst in der Suchstufe.
 */
export function zerlegeFeldAnfrage(query: string, alsWortfolge = false): FeldTeil[] {
  const roh = query.trim();
  if (roh.length === 0) return [];

  if (alsWortfolge) {
    const geteilt = teilePraefix(roh);
    if (geteilt && geteilt.wert.length > 0) {
      return [{ roh, wert: geteilt.wert, feld: geteilt.feld }];
    }
    return [{ roh, wert: roh }];
  }

  const token = roh.split(/\s+/).filter(t => t.length > 0);
  const out: FeldTeil[] = [];
  for (let i = 0; i < token.length; i++) {
    const t = token[i] ?? '';
    const geteilt = teilePraefix(t);
    if (!geteilt) { out.push({ roh: t, wert: t }); continue; }
    if (geteilt.wert.length > 0) {
      out.push({ roh: t, wert: geteilt.wert, feld: geteilt.feld });
      continue;
    }
    // „ast: GMBU" — mit Leerzeichen getippt. Das Präfix nimmt sich das nächste
    // Wort; so gelesen, wie es dasteht. Steht keines mehr da (der Nutzer tippt
    // gerade), fällt der angefangene Teil weg, statt als Wort „ast:" zu suchen.
    const naechstes = token[i + 1];
    if (naechstes === undefined) continue;
    out.push({ roh: `${t} ${naechstes}`, wert: naechstes, feld: geteilt.feld });
    i++;
  }
  return out;
}

/** Trägt die Anfrage überhaupt ein Feld? Entscheidet, ob Ähnlichkeit und
 *  Dokumente mitlaufen dürfen — beide können ein Feld nicht einhalten. */
export function hatFeldPraefix(query: string, alsWortfolge = false): boolean {
  return zerlegeFeldAnfrage(query, alsWortfolge).some(t => t.feld !== undefined);
}

/** Spaltet `praefix:wert` auf, wenn das Präfix bekannt ist. */
function teilePraefix(token: string): { feld: Trefferfeld; wert: string } | null {
  const trenner = token.indexOf(':');
  if (trenner <= 0) return null;
  const feld = ALIASE.get(token.slice(0, trenner).toLowerCase());
  if (feld === undefined) return null;
  return { feld, wert: token.slice(trenner + 1).trim() };
}
