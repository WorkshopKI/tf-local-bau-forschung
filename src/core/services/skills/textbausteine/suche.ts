/**
 * Auswahl + Suche im Textbaustein-Katalog — der geteilte Kern hinter dem
 * MAP-Abschluss (`nf-suche.ts`) und der Artefakt-Werkbank.
 *
 * Bewusst schlicht: Wortstamm-Vergleich, kein Ranking-Modell. Der Vorschlag muss
 * nachvollziehbar bleiben — `treffer` nennt, WAS angeschlagen hat, damit erkennbar
 * ist, warum ein Baustein oben steht. Rein (kein IO, kein LLM: eine Baustein-Auswahl
 * ist deterministisch ableitbar und gehört deshalb nicht ans Modell).
 *
 * Die Suche **wählt aus**, sie formuliert nicht um und füllt keine Platzhalter
 * (Pitfall #34).
 */
import type { NfScope } from '../registry/nf-bausteine.seed';
import type { BausteinArtefaktTyp, TextbausteinRecord } from './types';

/** Das Minimum, das ein Kandidat zum Bewerten mitbringen muss. */
export interface SuchbarerBaustein {
  id: string;
  thema: string;
  text: string;
  /** Prüfaspekt-Tags (A–J). Fehlt bei Kandidaten aus dem alten NF-Seed. */
  aspekte?: string[];
  stichworte?: string[];
}

export interface BausteinTreffer<T extends SuchbarerBaustein> {
  baustein: T;
  /** Trefferwert, höher ist besser. */
  punkte: number;
  /** Was angeschlagen hat — macht den Vorschlag begründbar. */
  treffer: string[];
}

/**
 * Gewichte, absteigend. Der Aspekt-Tag schlägt alles: er ist die kuratierte Aussage
 * „dieser Baustein gehört zu diesem Prüfaspekt", während ein Wort im Fliesstext auch
 * Zufall sein kann. Die Reihenfolge ist auch die Auswertungs-Reihenfolge — je Wort
 * zählt nur der HÖCHSTE Treffer, nicht die Summe.
 */
const GEWICHT_ASPEKT = 6;
const GEWICHT_THEMA = 3;
const GEWICHT_STICHWORT = 2;
const GEWICHT_TEXT = 1;

/** Wortstämme, die in fast jedem Baustein vorkommen und nichts unterscheiden. */
const STOPPWOERTER = new Set([
  'bitte', 'ihre', 'ihrer', 'ihren', 'sich', 'dass', 'oder', 'und', 'der', 'die', 'das',
  'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einen', 'nicht', 'sind', 'ist', 'werden',
  'wird', 'sie', 'wie', 'bei', 'mit', 'für', 'auf', 'aus', 'von', 'zum', 'zur', 'als',
  'auch', 'noch', 'nur', 'sowie', 'beschreiben', 'erläutern', 'geplante', 'geplanten',
]);

/** Umlaut-/Schärfe-Normalisierung — eine Quelle für Suchtext und Suchwort. */
function normalisiere(text: string): string {
  return text.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

/** Zerlegt einen Text in normalisierte Suchwörter. Rein. */
export function zerlegeBegriffe(text: string): string[] {
  return normalisiere(text)
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 4 && !STOPPWOERTER.has(w));
}

/** Optionen der Bewertung. */
export interface BewertungsOptionen {
  /**
   * Prüfaspekt des offenen Punkts. Bausteine, die diesen Aspekt als Tag tragen,
   * bekommen den Aspekt-Bonus — unabhängig von den Suchwörtern.
   */
  aspektId?: string | null;
  maxTreffer?: number;
}

/**
 * Bewertet Kandidaten gegen eine Liste von Begriffen. Je Suchwort zählt nur der
 * höchstwertige Fundort (Thema **oder** Stichwort **oder** Text), damit ein langer
 * Baustein nicht allein durch Länge gewinnt.
 *
 * Ohne Suchwörter und ohne Aspekt gibt es keine Treffer — ein leerer Punkt soll
 * nicht den halben Katalog vorschlagen.
 */
export function bewerteBausteine<T extends SuchbarerBaustein>(
  kandidaten: readonly T[], begriffe: readonly string[], opts: BewertungsOptionen = {},
): Array<BausteinTreffer<T>> {
  const { aspektId = null, maxTreffer = 3 } = opts;
  const gesucht = [...new Set(begriffe.flatMap(zerlegeBegriffe))];
  if (gesucht.length === 0 && !aspektId) return [];

  return kandidaten
    .map(baustein => {
      const thema = normalisiere(baustein.thema);
      const text = normalisiere(baustein.text);
      const stichworte = normalisiere((baustein.stichworte ?? []).join(' '));
      const treffer: string[] = [];
      let punkte = 0;

      if (aspektId && (baustein.aspekte ?? []).includes(aspektId)) {
        punkte += GEWICHT_ASPEKT;
        treffer.push(`Aspekt ${aspektId}`);
      }
      for (const wort of gesucht) {
        if (thema.includes(wort)) { punkte += GEWICHT_THEMA; treffer.push(wort); }
        else if (stichworte.includes(wort)) { punkte += GEWICHT_STICHWORT; treffer.push(wort); }
        else if (text.includes(wort)) { punkte += GEWICHT_TEXT; treffer.push(wort); }
      }

      return { baustein, punkte, treffer };
    })
    .filter(t => t.punkte > 0)
    .sort((a, b) => b.punkte - a.punkte || a.baustein.id.localeCompare(b.baustein.id))
    .slice(0, maxTreffer);
}

/* -------------------------------------------------------------------------- */
/* Katalog-Selektoren                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Die EINZIGE Quelle für alles, was ein Artefakt erzeugt: nur `freigegeben`.
 * Entwürfe (frisch importiert, in Arbeit) und Stillgelegte dürfen nie in einen
 * Bescheid-Entwurf geraten.
 */
export function freigegebeneBausteine(
  katalog: readonly TextbausteinRecord[], typ: BausteinArtefaktTyp, scope?: NfScope,
): TextbausteinRecord[] {
  return katalog.filter(b =>
    b.status === 'freigegeben'
    && b.artefaktTyp === typ
    && (scope === undefined || b.scope === scope));
}

/** Freigegebene Bausteine des Typs/Scopes, nach Begriffen + Aspekt bewertet. */
export function sucheBausteine(
  katalog: readonly TextbausteinRecord[],
  begriffe: readonly string[],
  typ: BausteinArtefaktTyp,
  scope?: NfScope,
  opts: BewertungsOptionen = {},
): Array<BausteinTreffer<TextbausteinRecord>> {
  return bewerteBausteine(freigegebeneBausteine(katalog, typ, scope), begriffe, opts);
}
