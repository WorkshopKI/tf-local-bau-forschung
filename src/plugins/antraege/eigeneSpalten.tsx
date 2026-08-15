/**
 * Aus einer selbst angelegten Definition wird eine Tabellen-Spalte.
 *
 * Die Zelle rechnet beim Rendern (`berechneZelle`) aus dem projizierten
 * Rohwert-Beutel — Begründung in `core/spalten/anzeige.ts`. Hier steht nur, wie
 * das Ergebnis aussieht und wonach sortiert und gefiltert wird.
 *
 * **Anzeige und Sortierung sind getrennt**, wie bei den eingebauten Spalten: ein
 * Datum sortiert nach ISO, eine Regel-Spalte nach der Rangfolge ihrer Regeln.
 * Der `accessor` trägt den Sortierwert, `exportValue` den lesbaren Text — sonst
 * stünde im XLSX die Regelnummer.
 */
import type { ReactNode } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import type { SortableColumn } from '@/components/data-table/types';
import {
  berechneZelle, hilfeAus, type EigeneSpalte, type LabelVon, type Rohwerte, type Zellwert,
} from '@/core/spalten';
import type { AntragTableRow } from './tableGrouping';
import { textCell, dateCell, MESS_TEXT, MESS_DATUM } from './tableColumns';

/** Rubriken der eigenen Spalten — eigene Bänder in der Kopfzeile, damit sie
 *  sich nicht zwischen die Rubriken des Fachsystems mischen. */
export const G_MEINE_SPALTEN = 'Meine Spalten';
export const G_TEAM_SPALTEN = 'Team-Spalten';

/** Die Farbwahl der Definition auf die Badge-Varianten der App. `danger` heißt
 *  dort `error` — die eine Stelle, an der beide Vokabulare aufeinandertreffen. */
const FARB_VARIANTE: Record<string, BadgeVariant> = {
  default: 'default', info: 'info', success: 'success', warning: 'warning', danger: 'error',
};

/** Der Rohwert-Beutel einer Zeile; fehlt er, ist die Zeile für uns leer. */
function rohVon(r: AntragTableRow): Rohwerte {
  return r.frei_roh ?? {};
}

/** Die Beutel aller Teilvorhaben einer Verbund-Zeile — nur dort gesetzt. */
function tvRohVon(r: AntragTableRow): Rohwerte[] | undefined {
  const tvs = r._verbund?.tvs;
  if (!tvs || tvs.length === 0) return undefined;
  return tvs.map(t => t.frei_roh ?? {});
}

function zelle(spalte: EigeneSpalte, r: AntragTableRow, heute: string): Zellwert {
  return berechneZelle(spalte, rohVon(r), tvRohVon(r), heute);
}

function badgeZelle(z: Zellwert): ReactNode {
  if (z.text === '') return null;
  if (!z.farbe) return textCell(z.text);
  return (
    <span className="inline-flex max-w-full" title={z.titel}>
      <Badge variant={FARB_VARIANTE[z.farbe] ?? 'default'} className="max-w-full truncate text-[10.5px]">
        {z.text}
      </Badge>
    </span>
  );
}

/**
 * Baut die Spalten. `heute` ist der injizierte Stichtag (ISO) — dieselbe
 * Zeichenkette für alle Zeilen eines Renders, damit eine Liste nicht halb vor
 * und halb nach Mitternacht bewertet wird.
 */
export function baueEigeneSpalten(
  defs: readonly EigeneSpalte[],
  heute: string,
  labelVon: LabelVon = f => f,
): SortableColumn<AntragTableRow>[] {
  return defs.map((def): SortableColumn<AntragTableRow> => {
    const gruppe = def.id.startsWith('frei:team:') ? G_TEAM_SPALTEN : G_MEINE_SPALTEN;
    const basis = {
      key: def.id,
      label: def.label,
      gruppe,
      hilfe: hilfeAus(def, labelVon),
      defaultVisible: false,
      sortable: true,
      filterable: true,
      wrap: false,
      width: def.breite ?? 140,
      // Gefiltert wird nach dem, was in der Zelle STEHT — nicht nach dem
      // Sortierwert. Sonst böte das Filtermenü einer Regel-Spalte die Zahlen
      // 0,1,2 an statt „abgelehnt", „in QS", „offen".
      filterAccessor: (r: AntragTableRow) => zelle(def, r, heute).text || '(leer)',
      exportValue: (r: AntragTableRow) => zelle(def, r, heute).text,
    };

    if (def.art === 'feld') {
      const istDatum = def.typ === 'datum';
      return {
        ...basis,
        ...(istDatum ? MESS_DATUM : MESS_TEXT),
        accessor: r => zelle(def, r, heute).sortier,
        render: r => {
          const z = zelle(def, r, heute);
          if (z.text === '') return null;
          // Datumsfelder in der Schreibweise der übrigen Termin-Spalten; der
          // Sortierwert ist das ISO aus `berechneZelle`.
          return istDatum ? dateCell(String(z.sortier) || z.text) : textCell(z.text);
        },
      };
    }

    if (def.art === 'sammel') {
      return {
        ...basis,
        messSchrift: 'badge',
        messZuschlag: 20,
        accessor: r => zelle(def, r, heute).sortier,
        render: r => {
          const z = zelle(def, r, heute);
          if (z.text === '') return null;
          // Angezeigt wird das FELD, das gewonnen hat, im Tooltip sein Datum —
          // dieselbe Aufteilung wie bei „FB Status".
          return (
            <span className="inline-flex max-w-full" title={z.titel}>
              <Badge variant="default" className="max-w-full truncate text-[10.5px]">
                {labelVon(z.text)}
              </Badge>
            </span>
          );
        },
        filterAccessor: r => {
          const z = zelle(def, r, heute);
          return z.text === '' ? '(leer)' : labelVon(z.text);
        },
        exportValue: r => {
          const z = zelle(def, r, heute);
          return z.text === '' ? '' : labelVon(z.text);
        },
      };
    }

    return {
      ...basis,
      messSchrift: 'badge',
      messZuschlag: 20,
      accessor: r => zelle(def, r, heute).sortier,
      render: r => badgeZelle(zelle(def, r, heute)),
    };
  });
}
