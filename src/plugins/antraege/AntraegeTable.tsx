import { useCallback, useEffect, useMemo } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { SortableTable, useTableSort, useColumnFilters, compareValues, useColumnWidths, useTotalTableWidth, DEFAULT_MIN_COLUMN_WIDTH, type KopfHoehen } from '@/components/data-table';
import { resolveAntragTableColumns } from './tableColumns';
import { mitSpaltenHilfe } from './spaltenHilfe';
import type { SpaltenHilfe, SortableColumn } from '@/components/data-table/types';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import { useKategorieSpalten } from './useKategorieSpalten';
import { useAntraegeStore } from './store';
import { zaehleJeAbschnitt } from './antragGroups';
import {
  buildVerbundTableRows,
  buildStatusSectionRows,
  buildFristSectionRows,
  buildNetzwerkSectionRows,
  buildKuerzelSectionRows,
  type AntragTableRow,
  type TableGroupingMode,
  type TabellenAnsicht,
} from './tableGrouping';
import {
  partitionArbeitsvorrat,
  arbeitsvorratSectionOf,
  archivAufschluesselung,
  formatArchivAufschluesselung,
  istBeendetVersteckt,
  hatBeendetAchse,
} from './arbeitsvorrat';
import { fristAnzeigeVon } from './fristAnzeige';
import { fristErgebnisFuerZeile } from './groupAggregates';
import { AMPEL_COLOR } from './eingangAmpel';
import { ArbeitsvorratSectionHeader } from './ArbeitsvorratSectionHeader';
import { useBeendetSichtbarkeit } from './useBeendetSichtbarkeit';
import { useZeilenAusklapp } from './ausklapp/useZeilenAusklapp';
import { machKlickbar } from './ausklapp/klickzonen';
import { ZeilenBereich } from './ausklapp/ZeilenBereich';
import { istAusklappbar } from './ausklapp/verfuegbar';
import { AusklappKontext } from './ausklapp/kontext';
import { AuswahlKopf, AuswahlZelle, zeilenSchluessel } from './auswahl';
import { useDichteStore } from './useDichteStore';
import { useKopfFilter } from './kopfFilter';
import {
  SPEICHER_SPALTENBREITEN,
  SPEICHER_GESAMTBREITE,
  SPEICHER_KOPF_SORTIERUNG,
} from './tabellenSpeicher';
import type { ZeilenMeldung } from './trefferZahl';

interface Props {
  filtered: AntragListItem[];
  visibleRows: number;
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  grouping: TableGroupingMode;
  /** Zeilen-Körnung: `antrag` verdichtet Verbünde zu einer Zeile. Orthogonal zur
   *  Gruppierung — siehe Kopfkommentar von `tableGrouping.ts`. */
  ansicht: TabellenAnsicht;
  /** „alle"-/Übersichtsmodus → MA-Spalte (tib_kuerz) automatisch einblenden. */
  showMaColumn: boolean;
  /** Herkunft je Spalten-Key für die Kopf-Tooltips. Kommt fertig aus
   *  `AntraegeMain` (dort einmal geladen), damit die Tabelle die Schemas nicht
   *  ein zweites Mal aus IndexedDB liest. */
  spaltenHilfe?: ReadonlyMap<string, SpaltenHilfe>;
  /** Selbst angelegte Spalten — fertig gebaut aus `AntraegeMain`, damit Picker
   *  und Tabelle dieselben Instanzen zeigen (und denselben Stichtag). */
  eigeneSpalten?: readonly SortableColumn<AntragTableRow>[];
  onOpenAntrag: (az: string) => void;
  onOpenVerbund: (id: string) => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Der Tabellenkasten wird selbst zum senkrechten Scroller, damit die
   *  Kopfzeile stehen bleibt (siehe `SortableTable.stickyHeader`). Dann wandert
   *  auch der Pagination-Sentinel MIT hinein — außerhalb stünde er im nicht
   *  scrollenden Elternteil, wäre dauerhaft sichtbar und lüde sofort alles nach. */
  stickyHeader?: boolean;
  /** Scroll-Container der Tabelle nach außen reichen (Scroll-Stand über den
   *  Detail-Split, `IntersectionObserver`-Root). Nur mit `stickyHeader`. */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  /** Meldet der Toolbar in AntraegeMain, was die Tabelle gerade zeigt: die
   *  spaltengefilterte TV-Anzahl und die Zeilen, die daraus werden. */
  onZeilenMeldung?: (m: ZeilenMeldung) => void;
  /** Meldet die gemessenen Höhen des Tabellenkopfes — der Kopf der Filterleiste
   *  legt sich darauf und bildet mit ihm ein Band (v4.76). */
  onKopfHoehe?: (m: KopfHoehen) => void;
}

/** Section-Key-Funktion pro Zeile (Gruppierungs-Abschnitt oder Arbeitsvorrat-
 *  Sektion) bzw. `null` (keine Sektionierung). */
type SectionOf = ((row: AntragTableRow) => string) | null;
/** Beschriftung eines Abschnitts-Schlüssels. `null`, wo der Renderer den
 *  Schlüssel selbst deutet (Arbeitsvorrat/Archiv). */
type LabelOf = ((key: string) => string) | null;

/** Band-Header der Gruppierung in der Tabelle — wie `StatusSectionHeader` der
 *  List-View, aber nicht-kollabierbar (eingebettet in einer Tabellen-Zeile).
 *
 *  **Ohne Trennlinie**, anders als die List-View-Variante: in der Tabelle sitzt
 *  das Band auf grauem Grund, der die Abgrenzung schon leistet. Die auslaufende
 *  Linie war eine zweite Aussage zur selben Sache — und stieß beim ersten Band
 *  direkt auf die Unterkante des Tabellenkopfes.
 *
 *  `grossbuchstaben` trennt zwei Sorten Beschriftung: die Status-Abschnitte sind
 *  feste Rubriken und stehen wie eh in Versalien. Netzwerk, FB und AB tragen
 *  dagegen ECHTE Bezeichner — Versalien verfälschen sie (`AAt` las sich als
 *  `AAT`, `SprayCloth · Phase 2` als `SPRAYCLOTH · PHASE 2`). */
function StatusBand({
  label,
  count,
  grossbuchstaben = true,
}: { label: string; count: number; grossbuchstaben?: boolean }): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-[11px] tracking-[0.08em] font-medium text-[var(--tf-text-tertiary)] ${
          grossbuchstaben ? 'uppercase' : ''
        }`}
      >
        {label}
      </span>
      <span className="text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">
        {count.toLocaleString('de-DE')}
      </span>
    </div>
  );
}

/**
 * Tabellen-Ansicht der Förderanträge ("compact"-View-Mode) — eine echte
 * Header-Tabelle mit konfigurierbaren Spalten (Spalten-Picker im Header) +
 * Klick-auf-Header-Sortierung, gebaut auf der generischen `SortableTable`.
 *
 * Drei unabhängige Toolbar-Achsen, in dieser Reihenfolge ausgewertet (siehe
 * Kopfkommentar von `tableGrouping.ts`):
 *
 * 1. **Ansicht** — `antrag`: pro Verbund eine Zeile (Multi-TV kollabiert, Solo
 *    unverändert). `antrag-mit-tv`: jedes Teilvorhaben eine eigene Zeile.
 * 2. **Beendet** (nur Reiter „Alle") — terminale Zeilen ausgeblendet (Streifen
 *    unter der Tabelle) oder eingeblendet. Läuft NACH der Verdichtung, damit ein
 *    Verbund als Ganzes beurteilt wird.
 * 3. **Gruppierung** — `none`: flach; sind beendete Zeilen sichtbar, trennen
 *    zwei Bänder (Arbeitsvorrat/Beendet) die Hälften. `status`/`netzwerk`/`fb`/
 *    `ab`: Bänder über den Zeilen; Header-Sort wirkt section-stabil (innerhalb
 *    der Bänder).
 *
 * Header-Sort (`useTableSort`) läuft VOR dem Pagination-Slice, damit die
 * Sortierung über die ganze Liste greift, nicht nur die sichtbare Seite.
 */
export function AntraegeTable({
  filtered,
  visibleRows,
  selectedAktenzeichen,
  selectedVerbundId,
  grouping,
  ansicht,
  showMaColumn,
  spaltenHilfe,
  eigeneSpalten,
  onOpenAntrag,
  onOpenVerbund,
  sentinelRef,
  onZeilenMeldung,
  stickyHeader = false,
  scrollContainerRef,
  onScroll,
  onKopfHoehe,
}: Props): React.ReactElement {
  const visibleColumns = useAntraegeColumnsStore(s => s.visibleColumns);
  const verbundById = useAntraegeStore(s => s.verbundById);
  // Netzwerk-Namen für die NW-Bänder (Cross-Programm-Index, einmal pro Session).
  const netzwerkNameById = useAntraegeStore(s => s.netzwerkNameById);
  // Achse 3 (Beendet): eigener Schalter, nur im „Alle"-Tab.
  const activeView = useAntraegeStore(s => s.activeView);
  const searchActive = useAntraegeStore(s => s.search.trim().length > 0);
  const beendetWunsch = useBeendetSichtbarkeit(s => s.ausgeblendet);
  const setBeendetAusgeblendet = useBeendetSichtbarkeit(s => s.setAusgeblendet);
  const beendetAchse = hatBeendetAchse(activeView);
  // Persistierte Spalten-Pixelbreiten (Resize via Drag-Handles der SortableTable).
  const { widths, setWidth, resetWidth } = useColumnWidths(SPEICHER_SPALTENBREITEN, {});
  // Griff am rechten Rand, zwei Zustände: `totalWidth` = gepinnte Pixelbreite
  // (null = keine), `inhaltsBreite` = Klick-Umschalter zwischen „Spalten teilen
  // sich die verfügbare Breite" (Standard) und „jede Spalte nimmt ihre
  // Inhaltsbreite, die Tabelle scrollt waagerecht".
  const { totalWidth, setTotalWidth, inhaltsBreite, toggleInhaltsBreite } = useTotalTableWidth(
    SPEICHER_GESAMTBREITE,
  );
  // Einblendbare Ordner-Spalten aus dem Statuskatalog (leer ohne Flag).
  const kategorieSpalten = useKategorieSpalten();
  const dichte = useDichteStore(s => s.dichte);
  // Registry-Reihenfolge beibehalten (nicht Toggle-Reihenfolge des Stores).
  // Im „alle"-Modus die MA-Spalte direkt nach der gelockten FKZ-Spalte
  // einblenden (auto-verwaltet, nicht im Spalten-Picker).
  const rohSpalten = useMemo(
    () => {
      const aufgeloest = resolveAntragTableColumns(visibleColumns, showMaColumn, kategorieSpalten);
      const mitHilfe = spaltenHilfe ? mitSpaltenHilfe(aufgeloest, spaltenHilfe) : aufgeloest;
      // Die eigenen Spalten hängen hinten an — in ihrer Definitionsreihenfolge,
      // gefiltert nach derselben Sichtbarkeits-Auswahl wie alle anderen.
      const sichtbar = new Set(visibleColumns);
      const eigene = (eigeneSpalten ?? []).filter(c => sichtbar.has(c.key));
      return eigene.length > 0 ? [...mitHilfe, ...eigene] : mitHilfe;
    },
    [visibleColumns, showMaColumn, kategorieSpalten, spaltenHilfe, eigeneSpalten],
  );

  // VB-Titel ist nicht in `AntragListItem` projiziert (Verbund-Level-Feld) → einmal
  // aus `verbundById` an die Row anhängen. Überlebt alle drei Gruppierungs-Modi
  // (Solo-/Lead-Spread in buildVerbundTableRows, Objekt-Durchreichung in
  // buildStatusSectionRows) und versorgt sowohl die „VB Titel"-Spalte als auch den
  // Spaltenkopf-Filter mit korrekten Werten.
  const enriched = useMemo<AntragTableRow[]>(
    () => filtered.map(a => {
      const t = a.verbund_id ? verbundById.get(a.verbund_id)?.titel : undefined;
      return t ? { ...a, verbund_titel: t } : a;
    }),
    [filtered, verbundById],
  );

  // Spaltenkopf-Filter (Header-Dropdown, wie in der Suche). Kandidaten aus der
  // EINGABE-Liste `enriched` (= Segment-/Sidebar-/Such-gefiltert) → view-scoped
  // und stabil; angewandt VOR der Gruppierung, also pro Einzel-Antrag.
  //
  // Der Stand liegt seit v4.67 im Store daneben (`kopfFilter.ts`) statt im Hook:
  // ein gemerkter Reiter muss ihn lesen und setzen können.
  // Zwei Einzel-Auswahlen statt eines Objekt-Selektors: ein im Selektor
  // gebautes Objekt ist bei jedem Store-Ereignis neu und rendert die Tabelle
  // ohne Anlass mit.
  const kopfStand = useKopfFilter(s => s.stand);
  const setzeKopfSpalte = useKopfFilter(s => s.setzeSpalte);
  const kopfSteuerung = useMemo(
    () => ({ stand: kopfStand, setzeSpalte: setzeKopfSpalte }),
    [kopfStand, setzeKopfSpalte],
  );
  const { columnFilters, setColumnFilter, filterCandidates, filteredRows, filterCounts } =
    useColumnFilters(enriched, rohSpalten, kopfSteuerung);

  // Achse 1 (Ansicht): Zeilen-Körnung. Läuft VOR der Gruppierung — eine
  // Verbund-Zeile wird also nach den Werten ihres Lead-TVs einsortiert.
  const baseRows = useMemo<AntragTableRow[]>(
    () => (ansicht === 'antrag' ? buildVerbundTableRows(filteredRows, verbundById) : filteredRows),
    [ansicht, filteredRows, verbundById],
  );

  // Achse 3 (Beendet): terminale Zeilen sind eine EIGENE Sichtbarkeits-Frage,
  // unabhängig von Ansicht und Gruppierung. Getrennt wird nach der Verdichtung
  // — eine Verbund-Zeile trägt den dominanten Status ihres Verbundes, und den
  // erst nach dem Zusammenfassen zu kennen ist der Punkt.
  const { inArbeit, archiv } = useMemo(
    () => (beendetAchse
      ? partitionArbeitsvorrat(baseRows)
      : { inArbeit: baseRows, archiv: [] as AntragTableRow[] }),
    [beendetAchse, baseRows],
  );
  const beendetVersteckt = istBeendetVersteckt({
    wunsch: beendetWunsch,
    suchAktiv: searchActive,
    beendet: archiv.length,
    arbeitsvorrat: inArbeit.length,
  });
  const beendetAufschluesselung = useMemo(
    () => formatArchivAufschluesselung(archivAufschluesselung(archiv)),
    [archiv],
  );

  // Achse 2 (Gruppierung): Abschnitts-Bänder über den sichtbaren Zeilen (vor
  // Header-Sort + Slice).
  const { allRows, sectionOf, labelOf } = useMemo<{
    allRows: AntragTableRow[];
    sectionOf: SectionOf;
    labelOf: LabelOf;
  }>(() => {
    // Versteckte Zeilen bleiben aus der Tabelle draußen (kein Pagination-
    // Verbrauch); ihr Kopf wird als Streifen unter der Tabelle gerendert.
    const sichtbar = beendetVersteckt ? inArbeit : baseRows;
    if (grouping !== 'none') {
      const built = grouping === 'status'
        ? buildStatusSectionRows(sichtbar)
        : grouping === 'frist'
          ? buildFristSectionRows(sichtbar)
          : grouping === 'netzwerk'
            ? buildNetzwerkSectionRows(sichtbar, netzwerkNameById)
            : buildKuerzelSectionRows(sichtbar, grouping === 'fb' ? 'tib_kuerz' : 'bib_kuerz');
      return { allRows: built.rows, sectionOf: built.sectionOf, labelOf: built.labelOf };
    }
    // Ohne Gruppierung und mit sichtbarem Beendet-Teil: die zwei Bänder. Sie
    // sind hier keine dritte Gruppierung, sondern die Grenze zwischen den zwei
    // Hälften — ohne sie wäre nicht zu sehen, wo der Arbeitsvorrat endet.
    if (archiv.length > 0 && !beendetVersteckt) {
      return {
        allRows: [...inArbeit, ...archiv],
        sectionOf: (r: AntragTableRow) => arbeitsvorratSectionOf(r),
        labelOf: null,
      };
    }
    return { allRows: sichtbar, sectionOf: null, labelOf: null };
  }, [grouping, beendetVersteckt, inArbeit, archiv, baseRows, netzwerkNameById]);

  // Abschnitts-Gesamtzahlen über `allRows` (= vor Header-Sort und Pagination).
  // NICHT der Zähler, den `SortableTable` an `renderSectionHeader` reicht: der
  // kommt aus dem gerenderten Slice und wüchse beim Nachladen — seine Summe war
  // exakt die Seitengröße. Der Arbeitsvorrat-Zweig umging das schon einzeln;
  // jetzt gilt es für alle Bänder über denselben Weg.
  const abschnittsGesamt = useMemo(
    () => (sectionOf === null ? null : zaehleJeAbschnitt(allRows, sectionOf)),
    [allRows, sectionOf],
  );

  // An die Toolbar melden, was hier steht. Effekt statt direktem Aufruf, weil
  // setState eines Eltern-Elements im Render verboten ist.
  //
  // Eine abweichende Zeilenzahl gibt es NUR in der Ansicht „Antrag" — nur dort
  // fasst die Tabelle mehrere TV zu einer Zeile zusammen. Gezählt wird auf
  // `baseRows`, nicht auf `allRows`: bei ausgeblendetem Beendet-Teil ist
  // `allRows` ebenfalls kürzer, aber das ist keine Verdichtung, sondern ein
  // ausgeblendeter Abschnitt (dessen Streifen unter der Tabelle steht und seine
  // Zahl selbst nennt); als „Zeilen" ausgewiesen wäre es eine Falschaussage.
  const zeilen = ansicht === 'antrag' ? baseRows.length : filteredRows.length;
  useEffect(() => {
    onZeilenMeldung?.({
      quelle: 'compact',
      tv: filteredRows.length,
      zeilen,
      art: ansicht === 'antrag' ? 'verbund' : null,
    });
  }, [filteredRows.length, zeilen, ansicht, onZeilenMeldung]);

  // storageKey → die Klick-auf-Spaltenkopf-Sortierung überlebt Reload/Seiten-
  // wechsel (Nutzer-Wunsch). Global (nicht per-View), konsistent mit den
  // ebenfalls global persistierten Spaltenbreiten oben.
  const { sortKey, sortDirection, toggleSort, sortedRows } =
    useTableSort(allRows, rohSpalten, null, 'desc', SPEICHER_KOPF_SORTIERUNG);

  // Sektionierte Modi (Status-Gruppierung ODER Arbeitsvorrat/Archiv): section-
  // stabile Sortierung — Section-Reihenfolge bleibt, nur INNERHALB jeder Section
  // wird nach der aktiven Spalte sortiert. (Der globale `sortedRows` von
  // `useTableSort` würde die Sections zerreißen.)
  const orderedRows = useMemo(() => {
    if (sectionOf === null) return sortedRows;
    if (!sortKey) return allRows;
    const col = rohSpalten.find(c => c.key === sortKey);
    if (!col) return allRows;
    const out: AntragTableRow[] = [];
    let i = 0;
    while (i < allRows.length) {
      const sec = sectionOf(allRows[i]!);
      let j = i;
      while (j < allRows.length && sectionOf(allRows[j]!) === sec) j++;
      const slice = allRows.slice(i, j);
      slice.sort((a, b) => compareValues(col.accessor(a), col.accessor(b), sortDirection));
      out.push(...slice);
      i = j;
    }
    return out;
  }, [sectionOf, sortedRows, allRows, rohSpalten, sortKey, sortDirection]);

  const rows = useMemo(() => orderedRows.slice(0, visibleRows), [orderedRows, visibleRows]);
  const hasMore = visibleRows < orderedRows.length;

  // Dringlichkeits-Rinne am Zeilenanfang. Sie liest denselben Frist-Zustand wie
  // die Frist-Zelle und die Dringlichkeits-Bänder (`fristErgebnisFuerZeile`) —
  // eine zweite Ableitung wäre genau dann falsch, wenn es zählt.
  //
  // NUR rot/orange/gelb. Grün und „keine laufende Uhr" bekommen keine Kante:
  // eine Rinne an jeder Zeile wäre Dekoration, so heißt sie „hier ist etwas zu
  // tun". Dieselbe Zurückhaltung wie in der Zelle, die bei stehender Uhr auch
  // keinen Ampelpunkt zeichnet.
  const rowAccent = useCallback((r: AntragTableRow): string | null => {
    const ampel = fristAnzeigeVon(fristErgebnisFuerZeile(r)).ampel;
    return ampel === null || ampel === 'gruen' ? null : AMPEL_COLOR[ampel];
  }, []);

  // Aufklappbarer Bereich. Die Signatur bündelt alles, dessen Wechsel die Zeile
  // verschiebt oder verschwinden lässt — der Bereich hängt am Zeilenschlüssel,
  // nicht an einer Bildschirmposition. `bereichSignatur` ist bewusst grob: ein
  // Schließen zu viel ist harmlos, ein Bereich unter dem falschen Vorgang nicht.
  const bereichSignatur = [
    activeView, grouping, ansicht, String(searchActive), String(beendetVersteckt),
    sortKey ?? '', sortDirection,
    Object.entries(columnFilters).filter(([, v]) => v.size > 0).map(([k, v]) => `${k}:${v.size}`).sort().join(','),
    String(filtered.length),
  ].join('|');
  const ausklapp = useZeilenAusklapp(bereichSignatur);
  const ausklappbar = istAusklappbar();
  const stichtag = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // Der Draht zum Info-Icon: es steckt tief in der statischen Spaltenregistry
  // und kommt an den Zeilen-Zustand nur über den Context.
  const steuerung = useMemo(() => ({ oeffne: ausklapp.oeffne }), [ausklapp.oeffne]);

  const columns = useMemo(
    () => machKlickbar(rohSpalten, {
      zeilenKey: (r: AntragTableRow) => r.aktenzeichen,
      istOffen: (r: AntragTableRow) => ausklapp.istOffen(r.aktenzeichen),
      offenerReiter: (r: AntragTableRow) => ausklapp.reiterVon(r.aktenzeichen),
      umschalten: (r: AntragTableRow, reiter) => ausklapp.umschalten(r.aktenzeichen, reiter),
      oeffnenDetail: (r: AntragTableRow) =>
        (r._verbund ? onOpenVerbund(r._verbund.verbundId) : onOpenAntrag(r.aktenzeichen)),
      ausklappbar,
    }),
    [rohSpalten, ausklapp, ausklappbar, onOpenAntrag, onOpenVerbund],
  );

  // Mehrfachauswahl: das Häkchen hängt in der IDENTITÄTSSPALTE (Index 0), nicht
  // in einer eigenen Spur. Eine eigene Spalte müsste die erste sein — und damit
  // die klebende; beim Blättern nach rechts stünde dann ein 34px-Häkchen still,
  // während Akronym und FKZ wegscrollen. So bleibt die Identität der Anker und
  // nimmt das Häkchen mit.
  //
  // Eingehängt HIER, nicht in der Spaltenregistry: die Registry beschreibt
  // Daten, und `machKlickbar` hat die Zelle bereits in eine Navigationszone
  // gehüllt — das Häkchen muss außerhalb davon liegen, sonst öffnet es den
  // Antrag statt ihn auszuwählen.
  const alleSchluessel = useMemo(() => orderedRows.flatMap(zeilenSchluessel), [orderedRows]);
  const columnsMitAuswahl = useMemo(
    () => columns.map((c, i) => (i === 0
      ? {
          ...c,
          kopfPrefix: <AuswahlKopf keys={alleSchluessel} />,
          // Häkchen (13) + Abstand (8): sonst misst die Spalte nur ihren Text
          // und schneidet ihn um genau diese Breite ab.
          messZuschlag: (c.messZuschlag ?? 0) + 21,
          ...(c.minWidth !== undefined ? { minWidth: c.minWidth + 21 } : {}),
          render: (row: AntragTableRow) => (
            <span className="flex min-w-0 items-center gap-2">
              <AuswahlZelle keys={zeilenSchluessel(row)} />
              <span className="min-w-0 flex-1">{c.render(row)}</span>
            </span>
          ),
        }
      : c)),
    [columns, alleSchluessel],
  );

  const sectionProps = sectionOf !== null
    ? {
        sectionKeyOf: (r: AntragTableRow) => sectionOf(r),
        renderSectionHeader: (key: string, slice: number): React.ReactNode => {
          // `slice` ist bewusst nur der Rückfall: er zählt die gerenderten
          // Zeilen, die Gesamtzahl steht in `abschnittsGesamt`.
          const count = abschnittsGesamt?.get(key) ?? slice;
          // Gruppierungs-Bänder: der Schlüssel ist eine stabile Id (Abschnitt,
          // Netzwerk-Id, Kürzel) — die Beschriftung kommt vom Builder. Bis v3.0
          // stand der Schlüssel roh im Band („VOR-ENTSCHEIDUNG").
          if (labelOf !== null) {
            return (
              <StatusBand
                label={labelOf(key)}
                count={count}
                // Status und Frist sind feste Rubriken und stehen wie eh in
                // Versalien. Netzwerk, FB und AB tragen ECHTE Bezeichner —
                // dort verfälschen Versalien (siehe Kopf von `StatusBand`).
                grossbuchstaben={grouping === 'status' || grouping === 'frist'}
              />
            );
          }
          // Arbeitsvorrat/Beendet: eigene Bänder. Das Beendet-Band ist hier immer
          // aufgeklappt (ausgeblendet → Streifen unter der Tabelle).
          if (key === 'archiv') {
            return (
              <ArbeitsvorratSectionHeader
                section="archiv"
                count={count}
                collapsed={false}
                onToggle={() => setBeendetAusgeblendet(true)}
                breakdown={beendetAufschluesselung}
                linie={false}
              />
            );
          }
          return <ArbeitsvorratSectionHeader section="in_arbeit" count={count} linie={false} />;
        },
      }
    : {};

  const ladeStreifen = hasMore ? (
    <div ref={sentinelRef} className="py-3 text-center text-[11px] text-[var(--tf-text-tertiary)]">
      Lade weitere Einträge …
    </div>
  ) : null;

  return (
    <AusklappKontext.Provider value={steuerung}>
    <div className={stickyHeader ? 'flex flex-col flex-1 min-h-0' : 'flex flex-col'}>
      <SortableTable<AntragTableRow>
        rows={rows}
        columns={columnsMitAuswahl}
        dichte={dichte}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        rowKey={r => r.aktenzeichen}
        // KEIN `onRowClick`: die Zeile trägt jetzt zwei verschiedene Klick-
        // Bedeutungen (Akronym/FKZ navigieren, Status/Frist klappen auf). Ein
        // Klick auf die Zeile bliebe daneben ein drittes, unsichtbares Ziel.
        isRowSelected={r =>
          r._verbund ? r._verbund.verbundId === selectedVerbundId : r.aktenzeichen === selectedAktenzeichen
        }
        rowAccent={rowAccent}
        emptyContent="Keine Anträge."
        // Standard ist EINPASSEN: die Spalten teilen sich die verfügbare Breite
        // und skalieren mit, wenn sie sich ändert. Ein Klick auf den Griff am
        // rechten Rand schaltet auf Inhaltsbreite mit waagerechtem Scrollen um
        // (der frühere Festzustand) — persistiert, siehe `useTotalTableWidth`.
        fitContentWidth={inhaltsBreite}
        onTotalWidthToggle={toggleInhaltsBreite}
        // Spaltenbreiten aus dem Inhalt. Im Einpass-Modus sind sie das GEWICHT
        // der Verteilung (nicht der Platz selbst): alle Spalten werden mit
        // demselben Faktor gestaucht oder gestreckt, breite bleiben breit.
        // Gemessen wird `allRows` — der volle gefilterte Satz VOR
        // Header-Sortierung und Pagination. Auf `rows` gemessen würde jede
        // nachgeladene Seite die Breiten neu setzen, auf `orderedRows` jeder
        // Sortierklick. Die Signatur trennt zusätzlich zwei Filterergebnisse
        // gleicher Länge (zwei O(1)-Zugriffe).
        autoColumnWidth
        // FKZ bleibt beim Blättern nach rechts stehen — sonst weiß man bei
        // 25 Spalten nicht mehr, welche Zeile man gerade liest.
        stickyFirstColumn
        // Rubrik-Bänder über den Spaltenköpfen. Trägt erst, seit die Registry
        // nach Rubrik geordnet ist — vorher zerfiel „Antrag" in fünf Strecken.
        showGroupHeader
        measureRows={allRows}
        measureSignature={`${allRows[0]?.aktenzeichen ?? ''}|${allRows[allRows.length - 1]?.aktenzeichen ?? ''}`}
        columnWidths={widths}
        onColumnWidthChange={setWidth}
        onColumnWidthReset={resetWidth}
        totalWidth={totalWidth}
        onTotalWidthChange={setTotalWidth}
        // Boden des Einpassens: die Summe der Spalten-Mindestbreiten statt der
        // pauschalen 720px. Bei den ~12 Standardspalten läuft das auf dasselbe
        // hinaus; bei 25 eingeblendeten Spalten verhindert es, dass sie auf
        // 29px je Spalte gestaucht werden, bevor der Scrollbalken greift.
        // `floorWidth` deckelt den Wert ohnehin auf die Wunschbreite, ein
        // schmaler Spaltensatz bekommt also keinen künstlichen Mindestbedarf.
        responsiveMinWidth={columns.length * DEFAULT_MIN_COLUMN_WIDTH}
        columnFilters={columnFilters}
        onColumnFilterChange={setColumnFilter}
        filterCandidates={filterCandidates}
        filterCounts={filterCounts}
        // Der Kopf bleibt stehen — dafür wird dieser Kasten der senkrechte
        // Scroller, und der Lade-Streifen muss MIT hinein.
        stickyHeader={stickyHeader}
        scrollContainerRef={scrollContainerRef}
        onScroll={onScroll}
        onKopfHoehe={onKopfHoehe}
        footerSlot={stickyHeader ? ladeStreifen : undefined}
        isRowExpanded={ausklappbar ? (r => ausklapp.istOffen(r.aktenzeichen)) : undefined}
        renderRowDetail={ausklappbar ? (r => (
          <ZeilenBereich
            zeilenKey={r.aktenzeichen}
            verbundId={r._verbund?.verbundId ?? (typeof r.verbund_id === 'string' ? r.verbund_id : null)}
            istVerbundZeile={r._verbund !== undefined}
            statusRoh={r.status}
            reiter={ausklapp.reiterVon(r.aktenzeichen) ?? 'vorgangsverlauf'}
            onReiter={ausklapp.setzeReiter}
            onSchliessen={ausklapp.schliessen}
            stichtag={stichtag}
          />
        )) : undefined}
        {...sectionProps}
      />
      {stickyHeader ? null : ladeStreifen}
      {/* Ausgeblendetes Beendet: Streifen unter der Tabelle (seine Zeilen sind
          bewusst nicht Teil der Tabelle → keine Pagination). Klick blendet ein
          und setzt damit denselben Schalter wie die Toolbar. Er steht unter
          JEDER Gruppierung — was ausgeblendet ist, bleibt abzählbar. */}
      {beendetVersteckt ? (
        <div className="px-3 py-2 mt-1 rounded-[10px]" style={{ border: '0.5px solid var(--tf-border)' }}>
          <ArbeitsvorratSectionHeader
            section="archiv"
            count={archiv.length}
            collapsed
            onToggle={() => setBeendetAusgeblendet(false)}
            breakdown={beendetAufschluesselung}
          />
        </div>
      ) : null}
    </div>
    </AusklappKontext.Provider>
  );
}
