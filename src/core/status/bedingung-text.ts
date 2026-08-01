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
 */
import { VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';
import { feldLabel } from './feld-zugriff';
import type { Bedingung, MappingVersion } from './typen';

function tage(n: number): string {
  return `${n >= 0 ? '+' : ''}${n} T`;
}

function blatt(b: Extract<Bedingung, { feldId: string }>, version: MappingVersion): string {
  const feld = feldLabel(version, b.feldId);
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
    case 'datumNachFeld': return `${feld} nach ${feldLabel(version, b.vergleichFeldId)}`;
    case 'foerdervarianteIn': {
      const namen = b.varianten.map(v => VB_PHASE_LABELS[v] ?? String(v));
      return `Fördervariante ist ${namen.join(' oder ')}`;
    }
  }
}

/** Rekursiv: Blatt / UND / ODER. Klammern nur, wo eine Gruppe steht. */
export function bedingungAlsText(b: Bedingung, version: MappingVersion): string {
  if ('alle' in b) return `(${b.alle.map(x => bedingungAlsText(x, version)).join(' UND ')})`;
  if ('einige' in b) return `(${b.einige.map(x => bedingungAlsText(x, version)).join(' ODER ')})`;
  return blatt(b, version);
}

/**
 * Dieselbe Aussage ohne die äußeren Klammern — für Sätze, die die Bedingung
 * ohnehin schon mit „WENN …" einleiten.
 */
export function bedingungSatz(b: Bedingung, version: MappingVersion): string {
  const text = bedingungAlsText(b, version);
  return text.startsWith('(') && text.endsWith(')') ? text.slice(1, -1) : text;
}
