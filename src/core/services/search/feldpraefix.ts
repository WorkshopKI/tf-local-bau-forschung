/**
 * Feldsuche in der Eingabe: `ast:Fraunhofer`, `fkz:16KN08`, `ort:Dresden`.
 *
 * Das Dropdown „Suche in" ist die GROBE Wahl — es gilt für die ganze Anfrage und
 * kennt fünf Bereiche. Wer weiß, in welcher Spalte sein Wort steht, will es
 * feiner sagen und pro Wort: „der Titel heißt so, die Einrichtung heißt so".
 * Genau das ist ein Präfix. Beides greift ineinander: ein Wort OHNE Präfix folgt
 * dem Dropdown, ein Wort MIT Präfix folgt seinem Präfix.
 *
 * **Das Präfix schlägt den Bereich.** Wer `ast:Fraunhofer` tippt, während das
 * Dropdown auf dem Ortsbereich steht, hat zweimal etwas gesagt — und die genauere
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
 * Seit v4.50 stehen auch die Felder dahinter, die bis dahin gar nicht durchsucht
 * wurden: `nw:` (Netzwerkname UND Netz-Kennzeichen), `wahlkreis:` und `notiz:`
 * (die Arbeitsnotizen am Vorgang, „Wichtig" + „Bemerkung" als EIN Feld — der
 * Suchende fragt „steht das irgendwo in meinen Notizen", nicht „steht das in
 * T_YW"). Seit v4.53 kommt `vb:` dazu — das Verbundkennzeichen, die Klammer um
 * die Teilvorhaben.
 *
 * Die Aliasse führen die CSV-Spaltencodes MIT (`ORG_AST`, `VB_TITEL`, …), weil
 * der Bearbeiter die Fördertabelle vor Augen hat, wenn er weiß, wo sein Wert
 * steht — und daneben die kurzen Alltagswörter, die niemand nachschlagen muss.
 *
 * **Anführungszeichen halten einen Wert zusammen** (v4.71). Bis dahin zerfiel
 * jede Anfrage an Leerzeichen, und ein Feldwert aus mehreren Wörtern wurde zu
 * etwas anderem, als dastand: `ort:Frankfurt am Main` suchte „Frankfurt" im Ort
 * und „am" und „Main" irgendwo. Am Bestand gemessen (14 225 Anträge):
 *
 * | Verknüpfung | ohne | mit `ort:"Frankfurt am Main"` |
 * |---|---|---|
 * | alle Wörter müssen vorkommen | 48 | **40** |
 * | irgendein Wort genügt | **6 365** | **40** |
 *
 * Bei UND fängt der Zufall den Fehler meist ab — die übrigen Wörter stehen
 * ohnehin in denselben Sätzen; bei ODER nicht mehr.
 *
 * Das ist die Voraussetzung dafür, dass die Vervollständigung im Suchfeld einen
 * Wert überhaupt einsetzen darf: 100 % der 5 461 Einrichtungsnamen und 63 % der
 * gewichteten Deskriptor-Treffer sind mehrwortig
 * ([vervollstaendigung.ts](src/plugins/suche/vervollstaendigung.ts)).
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
  /** Wonach gesucht wird — der Wert ohne Präfix und ohne Anführungszeichen. */
  wert: string;
  /** Das genannte Feld. `undefined` = kein Präfix, es gilt der Suchbereich. */
  feld?: Trefferfeld;
  /**
   * Stand der Wert in Anführungszeichen? Dann ist er wörtlich gemeint, und der
   * Wortstamm bleibt draußen: wer `ast:"Technische Universität Chemnitz"` aus
   * der Vorschlagsliste übernimmt, will genau diese Einrichtung — ein Stamm
   * über die ganze Wortfolge holte fremde Sätze herein.
   */
  exakt?: boolean;
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

  // Ein Feld für BEIDE Schreibweisen desselben Antrags: das Förderkennzeichen
  // (`16KN065624`) und das Aktenzeichen des Fachsystems (`KNF065624`).
  ['fkz', 'aktenzeichen'],
  ['akz', 'aktenzeichen'],
  ['aktenzeichen', 'aktenzeichen'],
  ['kennzeichen', 'aktenzeichen'],

  ['vb', 'verbundkennzeichen'],
  ['verbund', 'verbundkennzeichen'],
  ['verbundkennzeichen', 'verbundkennzeichen'],
  ['vb_nummer', 'verbundkennzeichen'],
  ['vbnummer', 'verbundkennzeichen'],
  ['verbundnummer', 'verbundkennzeichen'],

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

  ['nw', 'netzwerk'],
  ['netz', 'netzwerk'],
  ['netzwerk', 'netzwerk'],
  ['netzwerkna', 'netzwerk'],

  ['wahlkreis', 'wahlkreis'],
  ['wk', 'wahlkreis'],
  ['wknaak_afs', 'wahlkreis'],

  // Beide Notizspalten fuehren auf DIESELBE Fundstelle: der Korpus zieht sie
  // zusammen, weil der Suchende „steht das irgendwo in meinen Notizen" fragt
  // und nicht „steht das in T_YW oder in T_HINT".
  ['notiz', 'notiz'],
  ['notizen', 'notiz'],
  ['bemerkung', 'notiz'],
  ['wichtig', 'notiz'],
  ['t_yw', 'notiz'],
  ['t_hint', 'notiz'],
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
  verbundkennzeichen: 'vb',
  organisation: 'ast',
  standort: 'ort',
  deskriptoren: 'deskriptor',
  domain: 'web',
  // `nw` ist die Schreibweise des Teams (v4.53); `netz:` liest die Suche
  // weiterhin, sie schreibt es nur nicht mehr.
  netzwerk: 'nw',
  wahlkreis: 'wahlkreis',
  notiz: 'notiz',
};

/**
 * Alle Schreibweisen, die vor dem Doppelpunkt stehen dürfen.
 *
 * Für die Vervollständigung: sie sucht über ALLE Schreibweisen (wer „netz"
 * tippt, meint das Netzwerk), setzt aber immer die eine aus `FELD_PRAEFIX` ein.
 * Als Sicht auf dieselbe Tabelle, nicht als Kopie — eine zweite Liste driftete
 * ab, sobald ein Alias dazukommt.
 */
export const ALLE_PRAEFIXE: ReadonlyMap<string, Trefferfeld> = ALIASE;

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
 * Ein Stück der Eingabe, wie der Leser es sieht — mit seiner Lage im Text.
 *
 * Die Lage braucht die Vervollständigung: sie muss wissen, welches Stück unter
 * dem Schreibcursor liegt, und nur dieses ersetzen.
 */
export interface AnfrageToken {
  roh: string;
  /** Erste Position im Eingabetext. */
  start: number;
  /** Erste Position DAHINTER. */
  ende: number;
}

/**
 * Was als ein Stück gilt: eine geschlossene Wortfolge in Anführungszeichen,
 * eine noch offene, oder eine Folge ohne Leerraum.
 *
 * Die OFFENE Form ist kein Sonderfall für Feinschmecker — sie ist der Zustand
 * beim Tippen. Ohne sie zerfiele `ast:"Technische Uni` in drei Stücke, die
 * Suche liefe auf etwas anderem, und die Vorschlagsliste beschriebe einen
 * Zustand, den es nur bis zum nächsten Tastendruck gibt.
 *
 * Modul-global compiliert, aber je Lauf frisch gestellt (`lastIndex = 0`) —
 * ein `/g`-Ausdruck trägt seinen Stand mit sich.
 */
const TOKEN_MUSTER = /[^\s"]*"[^"]*(?:"|$)|\S+/g;

/** Zerlegt die Eingabe in ihre Stücke, Anführungszeichen zusammengehalten. */
export function anfrageTokens(query: string): AnfrageToken[] {
  TOKEN_MUSTER.lastIndex = 0;
  const out: AnfrageToken[] = [];
  for (let m = TOKEN_MUSTER.exec(query); m !== null; m = TOKEN_MUSTER.exec(query)) {
    if (m[0].length === 0) { TOKEN_MUSTER.lastIndex++; continue; }
    out.push({ roh: m[0], start: m.index, ende: m.index + m[0].length });
  }
  return out;
}

/**
 * Nimmt die Anführungszeichen ab und sagt, ob welche dastanden.
 *
 * Tolerant gegenüber der offenen Form: `"Technische Uni` (der Nutzer tippt
 * noch) gilt bereits als wörtlich gemeint. Anders wäre die Suche während des
 * Tippens eine andere als nach dem Schlusszeichen.
 */
function ohneAnfuehrung(wert: string): { wert: string; exakt: boolean } {
  let t = wert.trim();
  if (!t.startsWith('"')) return { wert: t, exakt: false };
  t = t.slice(1);
  if (t.endsWith('"')) t = t.slice(0, -1);
  return { wert: t.trim(), exakt: true };
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
      return [baueTeil(roh, geteilt.wert, geteilt.feld, geteilt.exakt)];
    }
    const blank = ohneAnfuehrung(roh);
    return [baueTeil(roh, blank.wert.length > 0 ? blank.wert : roh, undefined, blank.exakt)];
  }

  const token = anfrageTokens(roh).map(t => t.roh);
  const out: FeldTeil[] = [];
  for (let i = 0; i < token.length; i++) {
    const t = token[i] ?? '';
    const geteilt = teilePraefix(t);
    if (!geteilt) {
      // Eine Wortfolge ohne Feld („additive Fertigung") sucht dieselbe Sache in
      // allen Feldern des Bereichs — ein Suchbegriff, keine zwei.
      const blank = ohneAnfuehrung(t);
      if (blank.wert.length > 0) out.push(baueTeil(t, blank.wert, undefined, blank.exakt));
      continue;
    }
    if (geteilt.wert.length > 0) {
      out.push(baueTeil(t, geteilt.wert, geteilt.feld, geteilt.exakt));
      continue;
    }
    // „ast: GMBU" — mit Leerzeichen getippt. Das Präfix nimmt sich das nächste
    // Stück; so gelesen, wie es dasteht. Steht keines mehr da (der Nutzer tippt
    // gerade), fällt der angefangene Teil weg, statt als Wort „ast:" zu suchen.
    const naechstes = token[i + 1];
    if (naechstes === undefined) continue;
    const wert = ohneAnfuehrung(naechstes);
    if (wert.wert.length === 0) { i++; continue; }
    out.push(baueTeil(`${t} ${naechstes}`, wert.wert, geteilt.feld, wert.exakt));
    i++;
  }
  return out;
}

/** Trägt die Anfrage überhaupt ein Feld? Entscheidet, ob Ähnlichkeit und
 *  Dokumente mitlaufen dürfen — beide können ein Feld nicht einhalten. */
export function hatFeldPraefix(query: string, alsWortfolge = false): boolean {
  return zerlegeFeldAnfrage(query, alsWortfolge).some(t => t.feld !== undefined);
}

/**
 * Baut einen Suchteil. `exakt` steht nur dran, wenn es zutrifft — der Normalfall
 * bleibt damit Feld für Feld derselbe wie vor den Anführungszeichen.
 */
function baueTeil(
  roh: string, wert: string, feld: Trefferfeld | undefined, exakt: boolean,
): FeldTeil {
  return exakt ? { roh, wert, feld, exakt: true } : { roh, wert, feld };
}

/** Spaltet `praefix:wert` auf, wenn das Präfix bekannt ist. */
function teilePraefix(
  token: string,
): { feld: Trefferfeld; wert: string; exakt: boolean } | null {
  const trenner = token.indexOf(':');
  if (trenner <= 0) return null;
  const feld = ALIASE.get(token.slice(0, trenner).toLowerCase());
  if (feld === undefined) return null;
  return { feld, ...ohneAnfuehrung(token.slice(trenner + 1)) };
}
