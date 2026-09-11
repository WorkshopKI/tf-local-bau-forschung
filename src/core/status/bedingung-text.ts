/**
 * Eine Bedingung als deutscher Satz — die EINZIGE Heimat dieser Formulierung.
 *
 * Herausgelöst aus dem Regeln-Tab, weil inzwischen drei Stellen dieselbe Frage
 * stellen (Nächste-Schritte-Regeln, To-do-Regeln, Meilenstein-Plan). Ein
 * zweiter Formatierer liefe unweigerlich auseinander — und zwar **stumm**:
 * genau das war der Zustand davor, wo die drei Operatoren des Vorgangssystems
 * (`tageSeit`, `datumNachFeld`, `foerdervarianteIn`) in den `default`-Zweig
 * fielen und als leerer String erschienen. Eine Bedingung, die es gibt, sah
 * dann aus wie keine.
 *
 * Deshalb ist der `switch` hier **erschöpfend getypt**: ein neuer Operator
 * bricht den Typecheck, statt still zu verschwinden.
 *
 * Felder erscheinen unter ihrem kuratierten Namen („TV-Status ist beantragt"
 * statt „status ist beantragt"), soweit die Fassung einen führt.
 *
 * **Woher der Name kommt, entscheidet der Aufrufer** ({@link FeldLabelQuelle}):
 * die Status-Fassung führt ihre Felder in einer `MappingVersion`, der
 * Meilenstein-Plan in einem Spalten-Katalog. Ein zweiter Formatierer für die
 * zweite Namensquelle wäre genau die Doppelung, gegen die dieses Modul
 * geschrieben ist — deshalb ein Auflöser als Parameter statt einer Kopie.
 */
import { VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';
import { feldLabel } from './feld-zugriff';
import type { Bedingung, MappingVersion } from './typen';

/** Eine Fassung — oder direkt die Abbildung `feldId → Anzeigename`. */
export type FeldLabelQuelle = MappingVersion | ((feldId: string) => string);

function aufloeser(quelle: FeldLabelQuelle): (feldId: string) => string {
  return typeof quelle === 'function' ? quelle : (id: string) => feldLabel(quelle, id);
}

/**
 * Der Namens-Auflöser als Funktion — für Aufrufer, die neben dem Satz auch die
 * einzelnen Felder benennen (die Quellspalten-Erklärung). Dieselbe Auflösung
 * wie im Satz; sonst hieße ein Feld im Tooltip anders als im Text daneben.
 */
export function labelAufloeser(quelle: FeldLabelQuelle): (feldId: string) => string {
  return aufloeser(quelle);
}

function tage(n: number): string {
  return `${n >= 0 ? '+' : ''}${n} T`;
}

/**
 * Ein Stück des Satzes mit seiner Rolle — damit eine Anzeige Feldnamen und Werte
 * hervorheben kann, ohne den Satz selbst zu bauen. Der Text ist wortgleich mit
 * dem des Satzes: `bedingungAlsText` fügt genau diese Teile zusammen.
 */
export interface SatzTeil {
  art: 'feld' | 'text' | 'wert' | 'verknuepfung' | 'gruppe';
  text: string;
}

const feldT = (text: string): SatzTeil => ({ art: 'feld', text });
const textT = (text: string): SatzTeil => ({ art: 'text', text });
const wertT = (text: string): SatzTeil => ({ art: 'wert', text });

export function satzText(teile: readonly SatzTeil[]): string {
  return teile.map(t => t.text).join('');
}

function blattTeile(
  b: Extract<Bedingung, { feldId: string }>,
  labelVon: (feldId: string) => string,
): SatzTeil[] {
  const feld = feldT(labelVon(b.feldId));
  switch (b.op) {
    case 'gefuellt': return [feld, textT(' gefüllt')];
    case 'leer': return [feld, textT(' leer')];
    case 'ist': return [feld, textT(' ist '), wertT(`„${b.wert ?? ''}"`)];
    case 'istNicht': return [feld, textT(' ist nicht '), wertT(`„${b.wert ?? ''}"`)];
    case 'datumVor':
      // Der häufigste Fall verdient den klaren Satz: Grenze = heute.
      return b.tageRelativHeute === 0
        ? [feld, textT(' liegt in der Vergangenheit')]
        : [feld, textT(` vor heute ${tage(b.tageRelativHeute)}`)];
    case 'datumNach':
      return b.tageRelativHeute === 0
        ? [feld, textT(' liegt in der Zukunft')]
        : [feld, textT(` nach heute ${tage(b.tageRelativHeute)}`)];
    case 'tageSeit': return [textT('seit '), feld, textT(` mehr als ${b.tage} Tage`)];
    case 'datumNachFeld': return [feld, textT(' nach '), feldT(labelVon(b.vergleichFeldId))];
    case 'foerdervarianteIn': {
      const namen = b.varianten.map(v => VB_PHASE_LABELS[v] ?? String(v));
      return [textT('Fördervariante ist '), wertT(namen.join(' oder '))];
    }
  }
}

function blatt(
  b: Extract<Bedingung, { feldId: string }>,
  labelVon: (feldId: string) => string,
): string {
  return satzText(blattTeile(b, labelVon));
}

/** Rekursiv: Blatt / UND / ODER. Klammern nur, wo eine Gruppe steht. */
export function bedingungAlsText(b: Bedingung, quelle: FeldLabelQuelle): string {
  return mitAufloeser(b, aufloeser(quelle));
}

function mitAufloeser(b: Bedingung, labelVon: (feldId: string) => string): string {
  if ('alle' in b) return benannt(b.name, `(${b.alle.map(x => mitAufloeser(x, labelVon)).join(' UND ')})`);
  if ('einige' in b) return benannt(b.name, `(${b.einige.map(x => mitAufloeser(x, labelVon)).join(' ODER ')})`);
  return blatt(b, labelVon);
}

/**
 * Ein Gruppenname steht **vor** seinem Inhalt, nie statt seiner:
 * „PreCheck AB: (… ODER …)". Der Name allein verbärge, was geprüft wird — und
 * genau dort entstehen die falschen Regeln.
 */
function benannt(name: string | undefined, text: string): string {
  return name ? `${name}: ${text}` : text;
}

/**
 * Dieselbe Aussage ohne die äußeren Klammern — für Sätze, die die Bedingung
 * ohnehin schon mit „WENN …" einleiten.
 */
export function bedingungSatz(b: Bedingung, quelle: FeldLabelQuelle): string {
  const text = bedingungAlsText(b, quelle);
  return text.startsWith('(') && text.endsWith(')') ? text.slice(1, -1) : text;
}

/**
 * Der Kopfsatz über den Karten des Editors: „Erfüllt, wenn „PreCheck AB" und
 * „PreCheck FB" zutreffen."
 *
 * Er nennt nur die Teile der **obersten** Ebene — eine Gruppe mit ihrem Namen
 * oder als „Gruppe n" (gezählt unter den Gruppen, wie der Platzhalter der
 * Karte), eine Einzelbedingung mit ihrem Satz. Was in einer Gruppe steht, sagt
 * deren Karte darunter. Das Verb folgt der Verknüpfung („zutreffen" /
 * „zutrifft"); ab vier Teilen wird der Satz generisch, sonst läse er sich als
 * Aufzählung statt als Regel.
 */
export function bedingungKopfsatz(b: Bedingung, quelle: FeldLabelQuelle): string {
  const labelVon = aufloeser(quelle);
  const { und, teile } = obereEbene(b);
  if (teile.length === 0) return 'Noch keine Bedingung.';
  const namen = teile.map(t => (t.art === 'blatt'
    ? `„${blatt(t.b, labelVon)}"`
    : (t.name ? `„${t.name}"` : `Gruppe ${t.nummer}`)));
  if (namen.length === 1) return `Erfüllt, wenn ${namen[0]} zutrifft.`;
  if (namen.length > 3) {
    return und
      ? `Erfüllt, wenn alle ${namen.length} Teile zutreffen.`
      : `Erfüllt, wenn einer der ${namen.length} Teile zutrifft.`;
  }
  const liste = `${namen.slice(0, -1).join(', ')}${und ? ' und ' : ' oder '}${namen[namen.length - 1]}`;
  return `Erfüllt, wenn ${liste} ${und ? 'zutreffen' : 'zutrifft'}.`;
}

type ObererTeil =
  | { art: 'blatt'; b: Extract<Bedingung, { feldId: string }> }
  | { art: 'gruppe'; name: string | undefined; nummer: number };

/**
 * Die Teile der **obersten** Ebene, Gruppen gezählt unter den Gruppen — die
 * EINE Aufzählung für Kopfsatz und Übersicht, damit „Gruppe 2" an beiden
 * Stellen dieselbe Karte meint.
 */
function obereEbene(b: Bedingung): { und: boolean; teile: ObererTeil[] } {
  const und = !('einige' in b);
  const kinder = 'alle' in b ? b.alle : ('einige' in b ? b.einige : [b]);
  let gruppe = 0;
  const teile = kinder.map((k): ObererTeil => {
    if (!('alle' in k) && !('einige' in k)) return { art: 'blatt', b: k };
    gruppe += 1;
    return { art: 'gruppe', name: k.name, nummer: gruppe };
  });
  return { und, teile };
}

function zaehleBlaetter(b: Bedingung): number {
  if ('alle' in b) return b.alle.reduce((n, k) => n + zaehleBlaetter(k), 0);
  if ('einige' in b) return b.einige.reduce((n, k) => n + zaehleBlaetter(k), 0);
  return 1;
}

/** Die oberste Ebene einer Bedingung in Teilen, dazu wie viel darin steckt. */
export interface BedingungsUebersicht {
  teile: SatzTeil[];
  /** Gruppen der obersten Ebene. */
  gruppen: number;
  /** Einzelbedingungen insgesamt, bis in die Tiefe. */
  bedingungen: number;
}

/**
 * Die Bedingung für eine **Tabellenzelle**: Einzelbedingungen mit ihrem Satz,
 * Gruppen nur mit Namen bzw. „Gruppe n" — ihr Inhalt stünde sonst als
 * Klammersatz da, der in keiner Zelle zu Ende gelesen wird. Den vollen Satz
 * nennt der Aufrufer im Tooltip (`bedingungSatz`).
 */
export function bedingungUebersicht(b: Bedingung, quelle: FeldLabelQuelle): BedingungsUebersicht {
  const labelVon = aufloeser(quelle);
  const { und, teile } = obereEbene(b);
  const out: SatzTeil[] = [];
  teile.forEach((t, i) => {
    if (i > 0) out.push(textT(' '), { art: 'verknuepfung', text: und ? 'UND' : 'ODER' }, textT(' '));
    if (t.art === 'blatt') out.push(...blattTeile(t.b, labelVon));
    else out.push({ art: 'gruppe', text: t.name || `Gruppe ${t.nummer}` });
  });
  return {
    teile: out,
    gruppen: teile.filter(t => t.art === 'gruppe').length,
    bedingungen: zaehleBlaetter(b),
  };
}
