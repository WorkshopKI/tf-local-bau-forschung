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

function tage(n: number): string {
  return `${n >= 0 ? '+' : ''}${n} T`;
}

function blatt(
  b: Extract<Bedingung, { feldId: string }>,
  labelVon: (feldId: string) => string,
): string {
  const feld = labelVon(b.feldId);
  switch (b.op) {
    case 'gefuellt': return `${feld} gefüllt`;
    case 'leer': return `${feld} leer`;
    case 'ist': return `${feld} ist „${b.wert ?? ''}"`;
    case 'istNicht': return `${feld} ist nicht „${b.wert ?? ''}"`;
    case 'datumVor':
      // Der häufigste Fall verdient den klaren Satz: Grenze = heute.
      return b.tageRelativHeute === 0
        ? `${feld} liegt in der Vergangenheit`
        : `${feld} vor heute ${tage(b.tageRelativHeute)}`;
    case 'datumNach':
      return b.tageRelativHeute === 0
        ? `${feld} liegt in der Zukunft`
        : `${feld} nach heute ${tage(b.tageRelativHeute)}`;
    case 'tageSeit': return `seit ${feld} mehr als ${b.tage} Tage`;
    case 'datumNachFeld': return `${feld} nach ${labelVon(b.vergleichFeldId)}`;
    case 'foerdervarianteIn': {
      const namen = b.varianten.map(v => VB_PHASE_LABELS[v] ?? String(v));
      return `Fördervariante ist ${namen.join(' oder ')}`;
    }
  }
}

/** Rekursiv: Blatt / UND / ODER. Klammern nur, wo eine Gruppe steht. */
export function bedingungAlsText(b: Bedingung, quelle: FeldLabelQuelle): string {
  return mitAufloeser(b, aufloeser(quelle));
}

function mitAufloeser(b: Bedingung, labelVon: (feldId: string) => string): string {
  if ('alle' in b) return `(${b.alle.map(x => mitAufloeser(x, labelVon)).join(' UND ')})`;
  if ('einige' in b) return `(${b.einige.map(x => mitAufloeser(x, labelVon)).join(' ODER ')})`;
  return blatt(b, labelVon);
}

/**
 * Dieselbe Aussage ohne die äußeren Klammern — für Sätze, die die Bedingung
 * ohnehin schon mit „WENN …" einleiten.
 */
export function bedingungSatz(b: Bedingung, quelle: FeldLabelQuelle): string {
  const text = bedingungAlsText(b, quelle);
  return text.startsWith('(') && text.endsWith(')') ? text.slice(1, -1) : text;
}
