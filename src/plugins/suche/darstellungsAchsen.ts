/**
 * Die Darstellungs-Achsen der Suchseite für das geteilte `DarstellungDropdown`.
 *
 * **Bewusste Abweichung vom Handoff.** Der Prototyp stellt Sortierung, Dichte,
 * Liste/Tabelle und Spaltenauswahl als vier Bauformen nebeneinander in eine
 * Zeile. Genau das hat v3.24 im Feedback-Board zurückgebaut: fünf Bauformen für
 * dieselbe Art Aufgabe in einer Leiste, und niemand fand mehr, was er suchte.
 * Die Referenz ist die Förderanträge-Seite — dort liegen Ansicht, Gruppierung
 * und Filter-Zusätze zusammen in EINEM Menü.
 *
 * Draußen bleibt nur, was häufig und mit einem Klick bedient wird: der
 * Liste/Tabelle-Umschalter (geteiltes `ViewModeToggle`) und die Spaltenauswahl,
 * die ohnehin nur in der Tabelle gilt.
 *
 * **Beide Achsen gelten NUR in der Liste** (v4.74). Die Tabelle sortiert über
 * ihre Spaltenköpfe (`useSearchResults.sorted`, bewusst getrennt — siehe
 * `SuchSeite.tsx`), und „Zeile zeigt" stellt die Trefferzeile der Liste ein
 * (`TrefferZeile`, `kompakt`-Prop); die Tabellenzeile kennt keine Dichte. In der
 * Tabelle stellte das Menü also zwei Schalter zur Wahl, die nichts bewegten —
 * gemeldet für „Ausführlich/Kompakt", galt für „Sortierung" genauso. Deshalb
 * liefert `baueSucheDarstellungsAchsen` dort eine LEERE Liste, und der Aufrufer
 * blendet den Knopf aus, statt ihn leer zu zeigen: ein Bedienelement, das nichts
 * tut, ist schlimmer als keins.
 *
 * Rein — kein React. Vorbild: `plugins/antraege/darstellungsAchsen.ts`.
 */
import type { DarstellungAchse } from '@/components/ui/darstellungsAchsen';

export type SucheAchsenId = 'sortierung' | 'dichte';

export type SucheSortierung = 'relevanz' | 'neueste' | 'aelteste' | 'fkz';
export type SucheDichte = 'ausfuehrlich' | 'kompakt';

export const SORTIERUNG_LABEL: Record<SucheSortierung, string> = {
  relevanz: 'Relevanz',
  neueste: 'Neueste zuerst',
  aelteste: 'Älteste zuerst',
  fkz: 'FKZ',
};

export const DICHTE_LABEL: Record<SucheDichte, string> = {
  ausfuehrlich: 'Ausführlich',
  kompakt: 'Kompakt',
};

export const STANDARD_SORTIERUNG: SucheSortierung = 'relevanz';
export const STANDARD_DICHTE: SucheDichte = 'ausfuehrlich';

export function baueSucheDarstellungsAchsen({
  sortierung,
  dichte,
  ansicht,
}: {
  sortierung: SucheSortierung;
  dichte: SucheDichte;
  /** In der Tabelle gilt keine der beiden Achsen — dann bleibt die Liste leer. */
  ansicht: 'liste' | 'tabelle';
}): Array<DarstellungAchse<SucheAchsenId>> {
  if (ansicht === 'tabelle') return [];
  return [
    {
      id: 'sortierung',
      label: 'Sortierung',
      art: 'segment',
      stapel: true,
      options: (Object.keys(SORTIERUNG_LABEL) as SucheSortierung[])
        .map(key => ({ key, label: SORTIERUNG_LABEL[key] })),
      value: sortierung,
      standard: STANDARD_SORTIERUNG,
    },
    {
      id: 'dichte',
      label: 'Zeile zeigt',
      art: 'segment',
      options: (Object.keys(DICHTE_LABEL) as SucheDichte[])
        .map(key => ({ key, label: DICHTE_LABEL[key] })),
      value: dichte,
      standard: STANDARD_DICHTE,
    },
  ];
}

/** Toleranter Leser für die Persistenz. */
export function parseSortierung(roh: string | null): SucheSortierung {
  return roh === 'neueste' || roh === 'aelteste' || roh === 'fkz' ? roh : STANDARD_SORTIERUNG;
}

export function parseDichte(roh: string | null): SucheDichte {
  return roh === 'kompakt' ? 'kompakt' : STANDARD_DICHTE;
}

/**
 * Sortier-Schlüssel eines Treffers.
 *
 * `relevanz` sortiert absteigend nach Score — was seit v4.5 überhaupt erst eine
 * Sortierung IST: vorher trug jeder Wortlaut-Treffer den festen Wert 1.0.
 */
export function vergleiche(
  a: { score: number; bewilligungsdatum?: string; antragsdatum?: string; fkz?: string },
  b: { score: number; bewilligungsdatum?: string; antragsdatum?: string; fkz?: string },
  sortierung: SucheSortierung,
): number {
  switch (sortierung) {
    case 'neueste':
      return datumsWert(b) - datumsWert(a);
    case 'aelteste':
      return datumsWert(a) - datumsWert(b);
    case 'fkz':
      return (a.fkz ?? '').localeCompare(b.fkz ?? '', 'de');
    case 'relevanz':
    default:
      return b.score - a.score;
  }
}

/** Datum als vergleichbare Zahl. Ohne Datum ans Ende — ein fehlendes Datum ist
 *  kein „ganz alt", es ist unbekannt, und unbekannt gehört nicht nach vorn. */
function datumsWert(t: { bewilligungsdatum?: string; antragsdatum?: string }): number {
  const roh = t.bewilligungsdatum ?? t.antragsdatum ?? '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(roh);
  if (iso) return Number(`${iso[1]}${iso[2]}${iso[3]}`);
  const de = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(roh);
  if (de) return Number(`${de[3]}${de[2]}${de[1]}`);
  return 0;
}
