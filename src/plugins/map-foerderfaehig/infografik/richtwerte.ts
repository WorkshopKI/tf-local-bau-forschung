/**
 * Deterministische Richtwert-Prüfung an der Wirkungskette.
 *
 * Die Praxis-Richtwerte der Fachprüfung: projektbezogene Umsätze mindestens in
 * Höhe der Projektkosten, Personalzuwachs grösser null. Sie werden hier NUR
 * ausgewertet, wenn sich aus dem extrahierten Zahlenziel tatsächlich eine Zahl
 * lesen lässt — sonst steht dort „nicht quantifiziert", nicht „nicht erfüllt".
 * Ein fehlender Wert ist etwas anderes als ein verfehlter.
 *
 * Rein.
 */
import type { MapEinreichung } from '../types';
import type { Wirkungskette } from './schema';

export type RichtwertLage = 'erfuellt' | 'verfehlt' | 'nicht-quantifiziert';

export interface RichtwertBefund {
  id: 'umsatz-deckt-kosten' | 'personalzuwachs';
  titel: string;
  lage: RichtwertLage;
  erlaeuterung: string;
}

/**
 * Liest eine Geldsumme aus einem Freitext („1,2 Mio. €", „450 T€", „500000").
 * `null`, wenn keine belastbare Zahl erkennbar ist. Rein.
 */
export function leseGeldbetrag(text: string): number | null {
  const norm = text.toLowerCase().replace(/\./g, '').replace(',', '.');
  const treffer = /(\d+(?:\.\d+)?)\s*(mio|millionen|mrd|t€|t eur|tsd|tausend)?/.exec(norm);
  if (!treffer) return null;

  const zahl = Number(treffer[1]);
  if (!Number.isFinite(zahl)) return null;

  const einheit = treffer[2];
  if (einheit === undefined) return zahl;
  if (einheit === 'mio' || einheit === 'millionen') return zahl * 1_000_000;
  if (einheit === 'mrd') return zahl * 1_000_000_000;
  return zahl * 1_000;
}

/**
 * Liest eine Personenzahl aus einem Freitext („3 neue Arbeitsplätze",
 * „2 Vollzeitstellen"). Die Wortstämme sind bewusst kurz gehalten, damit
 * Beugung und Umlaut nicht durchrutschen („Arbeitsplatz" wie „Arbeitsplätze").
 * Rein.
 */
export function lesePersonenzahl(text: string): number | null {
  const treffer = /(\d+(?:[.,]\d+)?)\s*(?:neue\s+|zusätzliche\s+)?(?:vollzeit|vzä|mitarbeit|arbeitspl|stelle|beschäftig)/i
    .exec(text);
  if (!treffer) return null;
  const zahl = Number(treffer[1]!.replace(',', '.'));
  return Number.isFinite(zahl) ? zahl : null;
}

/**
 * Prüft die beiden Richtwerte gegen die extrahierte Wirkungskette. Rein.
 */
export function pruefeRichtwerte(
  kette: Wirkungskette, einreichung: MapEinreichung,
): RichtwertBefund[] {
  const wirkungsText = [kette.wirkung.zahlenziel ?? '', kette.wirkung.text].join(' ');
  const verwertungsText = [kette.verwertung.zahlenziel ?? '', kette.verwertung.text].join(' ');
  const gesamttext = `${wirkungsText} ${verwertungsText}`;

  const umsatz = leseGeldbetrag(wirkungsText) ?? leseGeldbetrag(verwertungsText);
  const kosten = einreichung.kosten.gesamt;
  const personen = lesePersonenzahl(gesamttext);

  const umsatzBefund: RichtwertBefund = umsatz === null || kosten === null
    ? {
        id: 'umsatz-deckt-kosten',
        titel: 'Projektbezogene Umsätze ≥ Projektkosten',
        lage: 'nicht-quantifiziert',
        erlaeuterung: umsatz === null
          ? 'Die Vorhabensbeschreibung nennt keinen bezifferten Umsatz — das ist selbst ein Prüfpunkt.'
          : 'Die Projektkosten liegen nicht vor.',
      }
    : {
        id: 'umsatz-deckt-kosten',
        titel: 'Projektbezogene Umsätze ≥ Projektkosten',
        lage: umsatz >= kosten ? 'erfuellt' : 'verfehlt',
        erlaeuterung: `Genannter Umsatz ${umsatz.toLocaleString('de-DE')} € gegenüber `
          + `Projektkosten ${kosten.toLocaleString('de-DE')} €.`,
      };

  const personalBefund: RichtwertBefund = personen === null
    ? {
        id: 'personalzuwachs',
        titel: 'Personalzuwachs > 0',
        lage: 'nicht-quantifiziert',
        erlaeuterung: 'Die Vorhabensbeschreibung nennt keinen bezifferten Personalzuwachs.',
      }
    : {
        id: 'personalzuwachs',
        titel: 'Personalzuwachs > 0',
        lage: personen > 0 ? 'erfuellt' : 'verfehlt',
        erlaeuterung: `Genannter Zuwachs: ${personen.toLocaleString('de-DE')}.`,
      };

  return [umsatzBefund, personalBefund];
}
