/**
 * **Welche Spalten gelten — und wie sie zugeschnitten werden.**
 *
 * [tableColumns.tsx](tableColumns.tsx) ist die Registry: was eine Spalte zeigt.
 * Hier steht die andere Frage: welche davon in dieser Sicht erscheinen, welche
 * erzwungen wird, und welche zur Laufzeit etwas dazubekommt.
 *
 * Herausgelöst mit v4.132, als die Status-Spalte an die To-do-Kaskade kam: die
 * Registry ist eine Datentabelle, die Auflösung eine Entscheidung — zwei
 * Verantwortlichkeiten, die in einer 1 290-Zeilen-Datei nicht mehr
 * auseinanderzuhalten waren.
 */
import { Badge } from '@/components/ui/badge';
import type { SortableColumn } from '@/components/data-table/types';
import type { ZeilenAufgaben } from '@/core/hooks/useBestandsAufgaben';
import { aufgabenAnzeige, regelTraf, type AufgabenAnzeige } from '@/core/status';
import { naechsterSchritt } from '@/core/utils/naechsterSchritt';
import { isTerminalStatus, statusRang } from '@/core/utils/status-canonical';
import { getStatusVariant } from '@/core/utils/status-mappings';
import { statusKurzLabel, statusLabel, statusLabelMitQuelle } from '@/core/utils/status-wert-labels';
import {
  ANTRAG_TABLE_COLUMNS, MA_COLUMN_KEY, STATUS_SCHRITT_KEY, ZUSTAENDIG_COLUMN_KEY,
  kategorieStatusColumns, renderHerleitung,
} from './tableColumns';
import type { AntragTableRow } from './tableGrouping';

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/**
 * Wird die MA-Spalte im Übersichtsmodus erzwungen?
 *
 * Nur, wenn die verdichtete `zustaendig`-Spalte NICHT sichtbar ist — die trägt
 * das TIB-Kürzel schon. Dieselbe Frage stellen {@link resolveAntragTableColumns}
 * (für die Tabelle) und `AntraegeMain` (für die „auto"-Marke im Picker); stünde
 * sie zweimal geschrieben, zeigte der Picker irgendwann eine Marke an einer
 * Spalte, die gar nicht mehr erzwungen wird.
 */
export function maSpalteErzwungen(
  visibleKeys: readonly string[],
  showMaColumn: boolean,
): boolean {
  return showMaColumn && !visibleKeys.includes(ZUSTAENDIG_COLUMN_KEY);
}

/** Die Aktenzeichen, für die eine Tabellenzeile steht (Verbundzeile: alle TVs). */
function zeilenAktenzeichen(r: AntragTableRow): string[] {
  const tvs = r._verbund?.tvs;
  return tvs && tvs.length > 0 ? tvs.map(t => t.aktenzeichen) : [r.aktenzeichen];
}

/**
 * Die Spalte „Status und nächster Schritt" **an die To-do-Kaskade hängen**
 * (v4.132).
 *
 * Das Badge bleibt, wie es war — es ist eine reine Zeilen-Funktion und steht
 * sofort. Nur die Handlung dahinter kommt jetzt aus derselben Rechnung wie
 * Startseite und Vorgangs-Board; solange der Bestandslauf nicht durch ist, steht
 * dort „…" und **nie** die alte Formel: ein Text, der sich nach fünf Sekunden in
 * einen anderen verwandelt, wäre schlimmer als einer, der auf sich warten lässt.
 *
 * `exportValue` zieht mit. Der Export ist das Einzige, was die App verlässt —
 * er darf nicht eine andere Aussage ausliefern als der Bildschirm.
 */
function mitAufgabenKaskade(
  spalte: SortableColumn<AntragTableRow>,
  aufgaben: ZeilenAufgaben,
): SortableColumn<AntragTableRow> {
  const anzeigeVon = (r: AntragTableRow): AufgabenAnzeige => aufgabenAnzeige({
    aufgabe: aufgaben.fuer(zeilenAktenzeichen(r)),
    // Nur die HANDLUNG als Rückfall, nicht `schrittText`: dessen Rückfall auf die
    // Status-Kurzform stünde hier neben dem Badge, das sie schon zeigt
    // („Bewilligt → Bewilligt", in der Abnahme gesehen).
    rueckfall: naechsterSchritt(strOrNull(r.status), r.precheck_status_label ?? '')?.aktion ?? '',
    laeuftNoch: aufgaben.laeuftNoch,
    regeln: aufgaben.regeln,
    status: r.status,
  });
  return {
    ...spalte,
    accessor: r => {
      const s = strOrNull(r.status);
      if (!s) return '99';
      return `${String(statusRang(s)).padStart(2, '0')} ${anzeigeVon(r).text.toLowerCase()}`;
    },
    exportValue: r => {
      const s = strOrNull(r.status);
      if (!s) return '';
      const a = anzeigeVon(r);
      // Der Ladezustand gehört nicht in eine Datei: dort steht dann der Status
      // allein, statt eines Platzhalters, den niemand mehr auflösen kann.
      if (a.quelle === 'laedt') return statusLabel(s);
      const zusatz = a.neben ? `${a.text} (${a.neben})` : a.text;
      return zusatz ? `${statusLabel(s)} → ${zusatz}` : statusLabel(s);
    },
    render: r => {
      const s = strOrNull(r.status);
      if (!s) return null;
      const a = anzeigeVon(r);
      // Terminal ohne Kaskaden-Treffer: ruhiger Text statt farbigem Badge, wie
      // bisher. Trifft dagegen eine Regel, steht dort echte Arbeit — dann darf
      // die Zeile nicht so aussehen, als sei nichts mehr zu tun. `fremd` zählt
      // dazu: die Regel traf, nur gehört die Arbeit einer anderen Rolle — sonst
      // sähe dieselbe Zeile für den FB leerer aus als für die AB.
      if (isTerminalStatus(s) && !regelTraf(a.quelle)) {
        return (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]" title={statusLabelMitQuelle(s)}>
            {statusKurzLabel(s)}
            {renderHerleitung(r)}
          </span>
        );
      }
      return (
        <span className="text-[11.5px]" title={`${statusLabelMitQuelle(s)} — ${a.titel}`}>
          <Badge
            variant={getStatusVariant(s)}
            className="align-middle justify-center whitespace-nowrap text-[10.5px]"
          >
            {statusKurzLabel(s)}
          </Badge>
          {renderHerleitung(r)}
          {a.text ? (
            <span className={a.quelle === 'gesperrt'
              ? 'ml-1.5 text-[var(--tf-text-tertiary)]'
              : 'ml-1.5 text-[var(--tf-text-secondary)]'}
            >
              → {a.text}
            </span>
          ) : null}
          {a.neben ? (
            <span className="ml-1 text-[10.5px] text-[var(--tf-text-tertiary)]">{a.neben}</span>
          ) : null}
        </span>
      );
    },
  };
}

/**
 * Sichtbare Spalten in Registry-Reihenfolge auflösen — Single Source für Tabelle
 * (`AntraegeTable`) UND XLSX-Export (`export-xlsx.ts`), damit der Export exakt
 * die Spalten der Ansicht abbildet. Die MA-Spalte (TIB-Kürzel) ist regulär im
 * Picker wählbar; im „alle"-/Übersichtsmodus (`showMaColumn`) wird sie zusätzlich
 * automatisch erzwungen und erscheint dank Registry-Reihenfolge direkt nach der
 * gelockten FKZ-Spalte. Set-Union → kein Duplikat.
 */
export function resolveAntragTableColumns(
  visibleKeys: readonly string[],
  showMaColumn: boolean,
  kategorien: readonly { kategorieId: string; label: string }[] = [],
  /** Ohne sie bleibt die Spalte bei der Status-Formel — unverändertes Verhalten. */
  aufgaben?: ZeilenAufgaben,
): SortableColumn<AntragTableRow>[] {
  const keys = new Set(visibleKeys);
  if (maSpalteErzwungen(visibleKeys, showMaColumn)) keys.add(MA_COLUMN_KEY);
  // Ordner-Spalten hinten anhängen: die Registry-Reihenfolge ist die Lesefolge
  // der festen Spalten, die kuratierten kommen als Zusatz dazu.
  return [...ANTRAG_TABLE_COLUMNS, ...kategorieStatusColumns(kategorien)]
    .filter(c => keys.has(c.key))
    .map(c => (aufgaben && c.key === STATUS_SCHRITT_KEY ? mitAufgabenKaskade(c, aufgaben) : c));
}
