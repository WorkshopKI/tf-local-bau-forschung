/**
 * Welches Feld ist gemeint? — Vorschläge aus der **Bezeichnung** des
 * Meilensteins und dem **Spalten-Katalog** der Programm-Schemas.
 *
 * Der Auswahl-Vorrat hat je nach Bestand zwei Dutzend bis einige hundert
 * Einträge, und wer „Antrag zugewiesen" tippt, weiß meist längst, dass `TIB`
 * gemeint ist — nur heißt die Spalte nicht so. Diese Zuordnung ist das, was der
 * Vorschlag abkürzt.
 *
 * **Was hier NICHT passiert**: es wird nichts aus den Antrags-Daten gelesen.
 * Der Meilenstein-Plan wird bearbeitet, bevor (und unabhängig davon, ob) ein
 * Bestand geladen ist; ein Vorschlag, der auf einen Bestandslauf wartet, käme zu
 * spät. Grundlage sind ausschließlich Namen und Typen der gemappten Spalten.
 *
 * **Es wird nichts geschrieben.** Die Funktionen liefern Kandidaten; ob einer
 * übernommen wird, entscheidet ein Klick. Ein automatisch gesetzter Meilenstein
 * wäre eine geratene Zahl, die als bare Münze durchginge — genau das, wovor die
 * Marke „unbestätigt" am Auslieferungs-Plan warnt.
 *
 * Rein: keine IO, keine Uhr, keine Zufallsquelle.
 */
import type { Bedingung } from '@/core/status';
import type { SpaltenEintrag } from './spalten-katalog';

/** Ein Feld-Kandidat mit Begründung — die Begründung ist Teil des Vorschlags. */
export interface FeldVorschlag {
  feldId: string;
  /** Warum dieses Feld? Erscheint als gedämpfter Zusatz an der Vorschlagszeile. */
  grund: string;
  punkte: number;
}

/**
 * Wörter ohne Aussage über das gemeinte Feld. Bewusst knapp gehalten: eine
 * lange Liste wirft irgendwann ein Wort weg, das doch trägt.
 */
const STOPPWOERTER = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines',
  'und', 'oder', 'mit', 'von', 'vom', 'bei', 'beim', 'für', 'fuer', 'zur',
  'zum', 'aus', 'auf', 'als', 'ist', 'sind', 'wird', 'werden', 'nach', 'vor',
  'bis', 'durch', 'über', 'ueber', 'auch', 'nur', 'noch', 'schon', 'dann',
  'sowie', 'inkl', 'inklusive', 'etc', 'usw', 'ggf', 'bzw',
]);

/**
 * Wörter, die in dieser Domäne **jeden** Meilenstein betreffen und deshalb
 * keinen von den anderen unterscheiden.
 *
 * Gemessen am ausgelieferten Plan: 6 der 13 Bezeichnungen beginnen mit „Antrag",
 * und die Spalte `antragsdatum` heißt „Antrags eingang". Ohne diesen Filter
 * schlug „Antrag vollständig" den Antragseingang vor — allein, weil beide das
 * Wort „Antrag" tragen. Das Substantiv benennt den Gegenstand, nicht das
 * Kriterium; wonach gesucht wird, steht im Verb daneben.
 *
 * Getrennt von {@link STOPPWOERTER} geführt, weil es keine Sprach-, sondern eine
 * Fach-Beobachtung ist — und weil hier jedes weitere Wort eine Behauptung über
 * den Bestand ist, die belegt gehört.
 */
const DOMAENEN_FUELLWOERTER = new Set([
  'antrag', 'antrags', 'antrages', 'antraege', 'anträge', 'antragstellers',
  'vorgang', 'vorgangs', 'projekt', 'projekts',
]);

/**
 * Felder, die einen Vorgang **benennen**, statt seinen Fortschritt zu
 * bezeichnen: Titel, Kennzeichen, Adressat, Programm-Zuordnung. Sie sind in
 * aller Regel gefüllt, sobald es den Vorgang gibt — ein Meilenstein darauf wäre
 * ab Tag eins erreicht und sagte nichts.
 *
 * Das ist der Grund, aus dem „Rückmeldung des Antragstellers" nicht das Feld
 * `antragsteller` vorschlägt, obwohl das Wort dort steht.
 */
const KEINE_KRITERIEN = new Set([
  'akronym', 'aktenzeichen', 'titel', 'verbund_titel', 'verbund_id',
  'unterprogramm_id', 'programm_id', 'antragsteller', 'tib_mail', 'antragsteller_mail',
]);

/**
 * Fachwort → Feld, wo der Name der Spalte es nicht hergibt. Die Zuordnung
 * stammt aus dem Auslieferungs-Plan ([seed.ts](./seed.ts)) — dort steht sie
 * bereits als fertige Bedingung, hier als das Wort, das darauf zeigt.
 *
 * Die Werte sind **Präfixe** einer `feldId`: `d_pc` trifft `D_PC+`, `D_PC-`
 * und `D_XPC+` nicht — letzteres beginnt anders und braucht seinen eigenen
 * Eintrag, wenn es je gebraucht wird. Lieber eine Lücke als ein falscher Treffer.
 */
const SYNONYME: Readonly<Record<string, readonly string[]>> = {
  zugewiesen: ['tib_kuerz', 'bib_kuerz'],
  zuweisung: ['tib_kuerz', 'bib_kuerz'],
  zuordnung: ['tib_kuerz', 'bib_kuerz'],
  bearbeiter: ['tib_kuerz', 'bib_kuerz'],
  eingang: ['antragsdatum'],
  eingegangen: ['antragsdatum'],
  eingegeben: ['antragsdatum'],
  eingereicht: ['antragsdatum'],
  bewilligung: ['bewilligung_datum'],
  bewilligt: ['bewilligung_datum'],
  bewilligungsunterlagen: ['bewilligung_datum'],
  erstentscheidung: ['erstentscheidung'],
  entscheidung: ['erstentscheidung'],
  precheck: ['d_pc'],
  vorpruefung: ['d_pc'],
  fördervariante: ['vb_phase'],
  foerdervariante: ['vb_phase'],
  variante: ['vb_phase'],
};

/** Ab hier taucht ein Kandidat überhaupt auf. */
const SCHWELLE = 3;

/** Kürzer wird nicht verglichen — „QS" und „AB" träfen sonst überall. */
const MIN_TOKEN = 3;

/** Präfix-Treffer erst ab dieser Länge, sonst passt „ant" auf zu vieles. */
const MIN_PRAEFIX = 4;

function zerlege(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/i)
    .filter(t => t.length >= MIN_TOKEN && !STOPPWOERTER.has(t) && !DOMAENEN_FUELLWOERTER.has(t));
}

/** Gleich, oder das eine ein hinreichend langes Präfix des anderen. */
function trifft(a: string, b: string): 'genau' | 'praefix' | null {
  if (a === b) return 'genau';
  if (a.length < MIN_PRAEFIX || b.length < MIN_PRAEFIX) return null;
  return a.startsWith(b) || b.startsWith(a) ? 'praefix' : null;
}

interface Treffer { punkte: number; grund: string }

function bewerte(token: string, eintrag: SpaltenEintrag): Treffer | null {
  // Die REIHENFOLGE in der Synonym-Liste ist die Rangfolge: „zugewiesen" meint
  // zuerst den fachlichen Bearbeiter (TIB), dann den administrativen (BIB).
  // Ohne diesen Vorrang entschiede die Alphabetik, und BIB gewänne — obwohl der
  // ausgelieferte Plan an dieser Stelle TIB führt.
  const rang = SYNONYME[token]?.findIndex(ziel => eintrag.feldId.toLowerCase().startsWith(ziel));
  if (rang !== undefined && rang >= 0) {
    return { punkte: rang === 0 ? 5 : 4, grund: `„${token}" steht für ${eintrag.label}` };
  }

  for (const wort of zerlege(eintrag.label)) {
    const art = trifft(token, wort);
    if (art) return { punkte: art === 'genau' ? 4 : 3, grund: `„${token}" ≈ ${eintrag.label}` };
  }

  for (const wort of eintrag.feldId.toLowerCase().split(/[^a-zà-ÿ0-9]+/i)) {
    const art = trifft(token, wort);
    if (art) return { punkte: art === 'genau' ? 4 : 3, grund: `„${token}" ≈ ${eintrag.feldId}` };
  }

  const code = eintrag.quellCodes.find(c => c.toLowerCase().includes(token));
  if (code) return { punkte: 2, grund: `„${token}" steckt in der Spalte ${code}` };

  return null;
}

/**
 * Die passendsten Felder zu einem Text, absteigend nach Punkten.
 *
 * `text` ist die Bezeichnung des Meilensteins — der Aufrufer darf die
 * Beschreibung anhängen, sie trägt oft das entscheidende Wort („Bearbeiter mit
 * passender Expertise … eingetragen").
 *
 * Trifft nichts, kommt eine **leere** Liste zurück. Es wird nicht geraten: ein
 * schwacher Vorschlag an prominenter Stelle kostet mehr, als er spart.
 */
export function schlageFelderVor(
  text: string,
  spalten: readonly SpaltenEintrag[],
  grenze = 5,
): FeldVorschlag[] {
  const tokens = zerlege(text);
  if (tokens.length === 0) return [];

  const treffer: (FeldVorschlag & { rang: number })[] = [];
  spalten.forEach((eintrag, rang) => {
    if (KEINE_KRITERIEN.has(eintrag.feldId)) return;
    let punkte = 0;
    // Der STÄRKSTE Treffer erklärt den Vorschlag; die schwächeren zählen mit,
    // ohne die Begründung zu verwässern.
    let bester: Treffer | null = null;
    for (const token of tokens) {
      const t = bewerte(token, eintrag);
      if (!t) continue;
      punkte += t.punkte;
      if (!bester || t.punkte > bester.punkte) bester = t;
    }
    if (!bester) return;
    const grund = bester.grund;
    // Datumsspalten sind das übliche Kriterium eines Bearbeitungsschritts — ein
    // Termin ist gesetzt oder nicht. Der Bonus entscheidet nur Gleichstände.
    if (eintrag.typ === 'datum') punkte += 1;
    if (punkte < SCHWELLE) return;
    treffer.push({ feldId: eintrag.feldId, grund, punkte, rang });
  });

  return treffer
    // Gleichstand → Katalog-Reihenfolge (kanonische Felder zuerst). Ohne diesen
    // Rückfall hinge die Reihenfolge an der Schema-Reihenfolge und sprang bei
    // jedem Import.
    .sort((a, b) => (b.punkte - a.punkte) || (a.rang - b.rang))
    .slice(0, Math.max(0, grenze))
    .map(({ feldId, grund, punkte }) => ({ feldId, grund, punkte }));
}

/**
 * Der beste Vorschlag als fertige Bedingung — oder `null`, wenn keiner trägt.
 *
 * Immer `gefuellt`, nie `ist`/`istNicht`: ein `ist` ohne Wert wird beim Laden
 * wieder verworfen (`normalisiereBedingung`), und ein `istNicht` ohne Wert wäre
 * für jeden Vorgang wahr. Welcher Wert gemeint ist, kann nur der Mensch sagen.
 */
export function schlageBedingungVor(
  text: string,
  spalten: readonly SpaltenEintrag[],
): Bedingung | null {
  const bester = schlageFelderVor(text, spalten, 1)[0];
  return bester ? { feldId: bester.feldId, op: 'gefuellt' } : null;
}
