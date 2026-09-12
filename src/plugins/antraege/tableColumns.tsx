/**
 * Spalten-Registry für die Tabellen-Ansicht der Förderanträge ("compact"-
 * View-Mode, seit dem Umbau eine echte Header-Tabelle wie die Suche).
 *
 * Aufbau analog zu `SEARCH_COLUMNS` (src/plugins/suche/columns.tsx): jede
 * Spalte liefert `accessor` (primitiver Sort-Wert, leere → '' bzw. große Zahl
 * für deterministische Sortierung) + `render` (Zell-JSX, `null` wenn leer).
 *
 * Alle Felder stammen aus `AntragListItem` und sind im Slim-Store
 * `ANTRAEGE_LIST_VIEW` projiziert (siehe `LIST_VIEW_FIELDS`). Cell-Renderer
 * verwenden ausschließlich vorhandene Helfer wieder (Status-Label, Eingangs-
 * Ampel, Frist) — keine String-Literal-Status-Vergleiche (Pitfall #12).
 */
import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { KopierIconButton } from '@/components/ui/KopierIconButton';
import type { SortableColumn } from '@/components/data-table';
import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusVariant } from '@/core/utils/status-mappings';
import { statusKurzLabel, statusLabel, statusLabelMitQuelle } from '@/core/utils/status-wert-labels';
import { formatGermanDate, formatDatumsWert } from '@/core/services/csv/dateParse';
import { ANTRAG_SLA_DAYS } from '@/core/services/csv/frist';
import { FRIST_GRUND, type FristErgebnis } from '@/core/services/csv/frist-ergebnis';
import { isTerminalStatus, statusRang } from '@/core/utils/status-canonical';
import { naechsterSchritt, precheckUrteilVonZeile } from '@/core/utils/naechsterSchritt';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { HerleitungPopover } from './status/HerleitungPopover';
import { useAusklappSteuerung } from './ausklapp/kontext';
import { getKategorieLabel } from './filter/kategorieQuickfilter';
import { classifyPrecheckBucket } from './filter/precheckQuickfilter';
import { MaKuerzelBadge } from './MaKuerzelBadge';
import type { AntragTableRow } from './tableGrouping';
import { worstAmpel, criticalFristAware, fristErgebnisFuerZeile } from './groupAggregates';
import { fristAnzeigeVon, fristTageVon } from './fristAnzeige';
import {
  getEingangAmpel,
  daysSinceEingang,
  AMPEL_COLOR,
  AMPEL_TOOLTIP,
} from './eingangAmpel';
import {
  FILTER_EMPTY_LABEL, jahrGruppe, monatsFilterLabel, monatsWertOderLeer, neuesteZuerst,
} from './spaltenFilterWerte';
import { strOrNull } from './fieldLookup';

/** Jahr aus ISO (YYYY-…) oder dd.mm.yyyy für den Datums-Spaltenfilter (analog
 *  zum Jahr-Filter der Suche). Leerer/unparsbarer Wert → '' (wird von
 *  `deriveFilterCandidates` als „kein Kandidat" übersprungen). */
function yearOf(v: string | undefined): string {
  const s = (v ?? '').trim();
  const iso = /^(\d{4})-/.exec(s);
  if (iso) return iso[1]!;
  const de = /(\d{4})\s*$/.exec(s);
  return de ? de[1]! : '';
}

// `FILTER_EMPTY_LABEL` (der „(leer)"-Sentinel) wohnt in `spaltenFilterWerte.ts`,
// zusammen mit der Monats-Ableitung, die ihn ebenfalls setzt — ein Sentinel,
// eine Heimat.

/** Jahr fürs Datums-Spaltenfilter, leere/datumslose Zeilen als „(leer)"
 *  wählbar (z.B. „Anträge ohne Erstentscheidung"). */
function yearOfOrEmpty(v: string | undefined): string {
  return yearOf(v) || FILTER_EMPTY_LABEL;
}

/**
 * Der Tooltip zur Frist-Zelle: was da steht und woher es kommt.
 *
 * Die drei Zustände bekommen drei Sätze — der Sinn der ganzen Übung. Vorher
 * hatte eine leere Zelle gar keinen Tooltip, und „keine Basis" sah aus wie
 * „keine Frist nötig".
 */
function fristTooltip(e: FristErgebnis, verbund: boolean): string | undefined {
  const vorsatz = verbund ? 'Dringendste Frist im Verbund — ' : '';
  if (e.zustand === 'angehalten') {
    const seit = e.bezugsZeitpunkt
      ? ` (seit ${new Date(e.bezugsZeitpunkt).toLocaleDateString('de-DE')})`
      : ` (${e.grund ?? 'Haltedatum unbekannt'})`;
    return `${vorsatz}In diesem Verfahrensschritt läuft keine Frist${seit}`;
  }
  if (e.zustand === 'nicht_berechenbar') {
    return `${vorsatz}Keine Frist berechenbar: ${e.grund ?? FRIST_GRUND.ohneEingang}`;
  }
  if (!e.zielDatum) return undefined;
  const datum = new Date(e.zielDatum).toLocaleDateString('de-DE');
  // Die Quellspalte steht als Code dabei — sie ist genau das, was die Engine
  // als `basisFeld` gewählt hat, nicht eine Beschreibung davon.
  const basis = e.basisFeld === 'D_XTE' ? '„alle Anträge da", D_XTE' : 'Antragseingang, D_AAE';
  return e.basisFeld === undefined
    ? `${vorsatz}VN-Frist: ${datum} (VN-Eingang D_VBE + 6 Monate)`
    : `${vorsatz}Bearbeitungsfrist: ${datum} (${basis} + ${ANTRAG_SLA_DAYS} Tage)`;
}

/** EUR ohne Nachkommastellen — lokal gehalten (wie `suche/columns.tsx`). */
function formatEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// Exportiert für die selbst angelegten Spalten (`eigeneSpalten.tsx`): sie sollen
// aussehen wie die eingebauten, nicht wie ein Fremdkörper. Die Mess-Profile
// gehören mit — sonst misst eine eigene Spalte ihre Breite nach einem anderen
// Schriftschnitt als die Nachbarspalte mit demselben Inhalt.
export { textCell, dateCell, MESS_TEXT, MESS_DATUM };

function textCell(v: string | null): ReactNode {
  return v ? <span className="text-[12px] text-[var(--tf-text)]" title={v}>{v}</span> : null;
}

/**
 * Mess-Profile der beiden geteilten Zell-Renderer — damit die Schrift für die
 * Breiten-Messung an EINER Stelle je Renderer steht und nicht an 14 Spalten.
 * Wer `textCell`/`dateCell` benutzt, spreizt das passende Profil mit hinein.
 */
const MESS_TEXT = { messSchrift: 'zelleKlein' } as const;
const MESS_DATUM = { messSchrift: 'mono' } as const;

/** Datums-Zelle in deutscher Schreibweise. Der Rohwert kommt als ISO aus der
 *  CSV-Projektion; `formatDatumsWert` ist die vorhandene Anzeige-Kette und lässt
 *  alles unangetastet, was sich nicht als Datum lesen lässt. Der Sortier-Wert
 *  bleibt der ISO-`accessor` — die Spalten sortieren weiter chronologisch. */
function dateCell(v: string | null): ReactNode {
  const text = formatDatumsWert(v);
  return text ? <span className="font-mono text-[11.5px] text-[var(--tf-text)]">{text}</span> : null;
}

/**
 * Das Info-Icon der Status-Erklärung (Vorgangssystem) für eine Listenzeile.
 *
 * Nur wo es eine Verbund-Id gibt — ohne sie könnte die Erklärung weder
 * Teilvorhaben noch Datumsspalten laden und stünde leer da. Der Inhalt lädt erst
 * beim Öffnen (`useHerleitung`), sonst ginge jede der 13 000 Zeilen beim
 * Rendern auf die IndexedDB.
 */
function HerleitungZelle({ r }: { r: AntragListItem }): React.ReactElement | null {
  // Der Verweis „Ganzen Verlauf zeigen" braucht ein Ziel; das gibt es nur in
  // einer Tabelle mit Ausklappbereich (Provider). Ohne ihn zeigt das Popover
  // ihn nicht — siehe `ausklapp/kontext.ts`.
  const steuerung = useAusklappSteuerung();
  const vbid = typeof r.verbund_id === 'string' && r.verbund_id ? r.verbund_id : null;
  if (!vbid) return null;
  return (
    // Erst beim Überfahren der Zeile sichtbar, aber IMMER im Fluss: `opacity`
    // statt bedingtem Rendern, damit die Zeile beim Hover nicht springt
    // (Pitfall #14). Bei 13 000 Zeilen ist ein dauerhaft gezeigtes ⓘ je Zeile
    // ein Raster aus Punkten, das mit dem Status konkurriert — der Griff soll
    // erst da sein, wenn jemand nach ihm greift.
    //
    // Drei Ausnahmen halten es sichtbar: Tastatur-Fokus, offenes Popover
    // (sonst verschwindet der Auslöser, sobald die Maus in den Inhalt fährt —
    // der liegt im Portal, also außerhalb der Zeile) und `@media (hover: none)`
    // über `group-hover` hinaus, weshalb der Auslöser klickbar bleibt.
    <span className="ml-1 inline-flex align-middle opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
      {/* Die Status-Spalte der Liste zeigt den TV-Status — das steht seit v2.382
          auch im Popover-Kopf, statt dass man es wissen muss. */}
      <HerleitungPopover
        verbundId={vbid} statusRoh={r.status} ebene="tv" aktenzeichen={r.aktenzeichen}
        {...(steuerung ? { onGanzenVerlauf: () => steuerung.oeffne(r.aktenzeichen, 'zeitverlauf') } : {})}
      />
    </span>
  );
}

export function renderHerleitung(r: AntragListItem): ReactNode {
  if (!isVorgangssystemEnabled()) return null;
  return <HerleitungZelle r={r} />;
}

/** Key der MA-Spalte (TIB-Bearbeiter-Kürzel) — Konstante für die Auto-Show im
 *  „alle"-/Übersichtsmodus (`resolveAntragTableColumns`) + die Picker-Ausblendung
 *  in genau diesem Modus (`AntraegeMain`, sonst stünde im Picker eine Checkbox,
 *  deren Toggle ohne Wirkung bliebe, weil die Spalte dort erzwungen wird). */
export const MA_COLUMN_KEY = 'tib_kuerz';

/** Key der verdichteten Zuständigkeits-Spalte (FB + AB der Antragsphase). */
export const ZUSTAENDIG_COLUMN_KEY = 'zustaendig';

/**
 * Rubriken des Spalten-Pickers. Reine Anzeige-Ordnung im Menü — die Reihenfolge
 * der Spalten in der Tabelle bleibt die Registry-Reihenfolge unten. Welche
 * Rubrik zuerst steht, entscheidet ebenfalls die Registry (erstes Auftreten,
 * siehe `gruppiereSpalten`), damit hier keine zweite Liste mitgepflegt werden
 * muss.
 */
const G_ANTRAG = 'Antrag';
/** Die Sachdaten des Antrags — getrennt von `G_ANTRAG`, das nur noch das FKZ
 *  trägt. Ohne diese Trennung stünde die Zuständigkeit hinter neun
 *  Antragsdaten-Spalten, und die gewohnte Lesefolge FKZ · TIB · BIB · … wäre
 *  dahin. */
const G_ANTRAGSDATEN = 'Antragsdaten';
/** Eigene Rubrik für die Frist, damit sie direkt hinter dem gepinnten FKZ stehen
 *  kann. In `G_TERMINE` belassen stünde sie am rechten Rand hinter neun anderen
 *  Spalten — die Fristenkontrolle ist aber die häufigste Frage an diese Tabelle
 *  und gehört an den Anfang der Zeile. Eine EIGENE Rubrik statt eines Umzugs
 *  nach `G_ANTRAG`: die Frist ist keine Stammangabe des Antrags, und ein
 *  einzelnes `Termine`-Feld mitten in der Zeile zerrisse die Rubrik-Kopfzeile
 *  (genau das, wogegen `RUBRIK_ORDNUNG` unten angelegt wurde). */
const G_FRIST = 'Frist';
const G_ZUSTAENDIGKEIT = 'Zuständigkeit';
/** Exportiert, weil die Klickzonen die ganze Rubrik aufklappbar machen
 *  (`klickzonen.tsx`) — eine neue Status-Spalte soll das erben, ohne dass
 *  jemand eine zweite Liste pflegt. */
/** Der Schlüssel der kombinierten Status-Spalte — einmal getippt, weil ihn
 *  `resolveAntragTableColumns` wiedererkennen muss, um sie an die To-do-Kaskade
 *  zu hängen. */
export const STATUS_SCHRITT_KEY = 'status_naechster_schritt';

export const G_STATUS = 'Status';
const G_TERMINE = 'Termine';
export const G_ORDNER = 'Ordner des Fachsystems';
export const G_ORDNER_VB = 'Ordner · Verbund';
export const G_ORDNER_TV = 'Ordner · Teilvorhaben';

/**
 * Rubrik einer Ordner-Spalte. Verbund und Teilvorhaben führen teils
 * gleichnamige Ordner („Antragsbearbeitung", „Kommunikation") — in EINER
 * Rubrik stünden sie doppelt und ununterscheidbar. Die Ebene steckt im
 * kuratierten Id-Präfix (`vb.`/`tv.`, Pitfall #42); alles andere landet in der
 * neutralen Sammelrubrik, statt still zu verschwinden.
 */
function ordnerRubrik(kategorieId: string): string {
  if (kategorieId.startsWith('vb.')) return G_ORDNER_VB;
  if (kategorieId.startsWith('tv.')) return G_ORDNER_TV;
  return G_ORDNER;
}

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

/**
 * Factory für die vier Kürzel-Spalten der Fördertabelle. Das Fachsystem führt
 * die Zuständigkeit je Rolle UND je Phase in einer eigenen Spalte:
 * Antragsphase FB `TIB_KUERZ` / AB `BIB_KUERZ`, Begleitphase FB `ZTP_KUERZ` /
 * AB `PFM_KUERZ` (dieselbe Aufteilung wie `ROLLEN_SPALTEN` in
 * `bearbeiterFilter.ts`). Erst alle vier nebeneinander machen sichtbar, dass
 * der Reiter „Begleitung" nach der ANTRAGSPHASEN-Spalte filtert.
 *
 * Breite: `bib_kuerz`/`ztp_kuerz` führen im Bestand auch Doppel-Einträge
 * („StE / CoS"), deshalb breiter als die vierstelligen TIB-/PFM-Kürzel.
 */
function kuerzelColumn(opts: {
  key: 'tib_kuerz' | 'bib_kuerz' | 'ztp_kuerz' | 'pfm_kuerz';
  label: string;
  rolle: string;
  defaultVisible: boolean;
  width: number;
}): SortableColumn<AntragTableRow> {
  const { key, label, rolle, defaultVisible, width } = opts;
  return {
    key,
    label,
    gruppe: G_ZUSTAENDIGKEIT,
    defaultVisible,
    sortable: true,
    filterable: true,
    filterAccessor: r => strOrNull(r[key]) ?? FILTER_EMPTY_LABEL,
    width,
    wrap: false,
    // Badge mit `px-1.5`-Polster; gemessen wird der Kürzel-Text im Badge-Schnitt.
    messSchrift: 'badge',
    messZuschlag: 12,
    accessor: r => strOrNull(r[key]) ?? '',
    render: r => {
      const v = strOrNull(r[key]);
      return v ? <MaKuerzelBadge kuerzel={v} title={`${rolle}: ${v}`} /> : null;
    },
  };
}

/**
 * Factory für eine „Datums-Status"-Spalte (FB Status / PreCheck Status): Badge
 * mit dem Spalten-Label (aus der Projektion), Tooltip = Datum (DD.MM.YYYY).
 * Sortierung nach Datum (ISO; leer ans Ende, '' sortiert wie bei den übrigen
 * Datums-Spalten vorne), Filter nach Label. Off by default (einblendbar).
 * Tooltip via Wrapper-`<span>`, da `Badge` kein `title` durchreicht.
 */
function statusDatumColumn(opts: {
  key: string;
  label: string;
  gruppe: string;
  variant: BadgeVariant;
  getLabel: (r: AntragTableRow) => string | undefined;
  getDatum: (r: AntragTableRow) => string | undefined;
}): SortableColumn<AntragTableRow> {
  const { key, label, gruppe, variant, getLabel, getDatum } = opts;
  return {
    key,
    label,
    gruppe,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => strOrNull(getLabel(r)) ?? FILTER_EMPTY_LABEL,
    width: 150,
    wrap: false,
    messSchrift: 'badge',
    messZuschlag: 20,
    accessor: r => strOrNull(getDatum(r)) ?? '',
    // Sortiert wird nach DATUM, angezeigt wird das LABEL — ohne eigenen
    // Export-Wert schriebe der XLSX-Export unter „FB Status" ein ISO-Datum
    // (`exportValue ?? accessor`). Gilt über diese Factory auch für alle
    // kuratierten Ordner-Spalten (`katstatus:*`).
    exportValue: r => strOrNull(getLabel(r)) ?? '',
    render: r => {
      const lbl = strOrNull(getLabel(r));
      if (!lbl) return null;
      const datum = strOrNull(getDatum(r));
      return (
        <span className="inline-flex max-w-full" title={datum ? formatGermanDate(datum) : undefined}>
          <Badge variant={variant} className="max-w-full justify-center truncate text-[10.5px]">
            {lbl}
          </Badge>
        </span>
      );
    },
  };
}

/**
 * Reihenfolge der Rubriken in der Tabelle — und damit auch im XLSX-Export und
 * im Spalten-Picker (dessen Rubrik-Folge dem ersten Auftreten folgt).
 *
 * Erst mit dieser Ordnung wird die Rubrik-Kopfzeile lesbar: vorher zerfiel
 * „Antrag" in fünf und „Termine" in drei Strecken, die Zeile las sich als
 * „Antrag | Zuständigkeit | Antrag | Status | Termine | Antrag | …".
 */
const RUBRIK_ORDNUNG: readonly string[] = [
  G_ANTRAG, G_FRIST, G_ZUSTAENDIGKEIT, G_ANTRAGSDATEN, G_STATUS, G_TERMINE,
];

/**
 * Stabil nach `RUBRIK_ORDNUNG` sortieren — innerhalb einer Rubrik bleibt die
 * Reihenfolge der Definition unten erhalten.
 *
 * Bewusst sortiert statt die 24 Einträge von Hand umzustellen: so bleiben die
 * Spalten unten thematisch beieinander definiert, und die Lesefolge ist eine
 * Liste, die man in einer Zeile ändern kann. Unbekannte Rubriken landen hinten.
 */
function ordneNachRubrik(
  spalten: readonly SortableColumn<AntragTableRow>[],
): SortableColumn<AntragTableRow>[] {
  const rang = (c: SortableColumn<AntragTableRow>): number => {
    const i = RUBRIK_ORDNUNG.indexOf(c.gruppe ?? '');
    return i < 0 ? RUBRIK_ORDNUNG.length : i;
  };
  return spalten
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rang(a.c) - rang(b.c) || a.i - b.i)
    .map(x => x.c);
}

/** Ampelpunkt + FKZ + TV-Zähler einer Zeile — der Teil der Identität, den die
 *  zusammengelegte `antrag`-Spalte mit der alten FKZ-Spalte teilt. */
function fkzTeil(r: AntragTableRow): { fkzText: string; meta: AntragTableRow['_verbund'] } {
  const meta = r._verbund;
  return { fkzText: meta ? meta.fkzRange : r.aktenzeichen, meta };
}

const ROH_SPALTEN: SortableColumn<AntragTableRow>[] = [
  {
    // Die IDENTITÄTSSPALTE: Akronym groß, FKZ klein dahinter, TV-Zähler als
    // Marke. Bis v4.62 waren das zwei Spalten (FKZ gepinnt, Akronym irgendwo in
    // den Antragsdaten) — man las den Namen eines Vorgangs also an einer
    // anderen Stelle als seine Nummer, und der gepinnte Anker trug die Nummer,
    // die niemand im Kopf hat.
    //
    // Beide Einzelspalten bleiben im Picker (Default AUS): wer nach Akronym
    // filtern oder FKZ allein exportieren will, blendet sie ein. Umgestellt
    // wird der Standard, nicht das Angebot.
    key: 'antrag',
    label: 'Antrag',
    gruppe: G_ANTRAG,
    defaultVisible: true,
    locked: true,
    sortable: true,
    width: 210,
    wrap: false,
    minWidth: 150,
    maxWidth: 320,
    // Ampelpunkt (8) + Abstände + TV-Marke; der Kopier-Knopf liegt wie zuvor
    // ÜBER der Zelle und kostet keine Breite. Das Häkchen davor kommt erst in
    // `AntraegeTable` dazu und wird dort zugeschlagen.
    messZuschlag: 26,
    messText: r => {
      const { fkzText, meta } = fkzTeil(r);
      const akr = strOrNull(r.akronym);
      return `${akr ? `${akr} ` : ''}${fkzText}${meta ? ` ·${meta.tvCount}` : ''}`;
    },
    // Sortiert nach dem, was groß dasteht — dem Akronym. Ohne Akronym rückt das
    // FKZ ein, damit namenlose Zeilen nicht alle am selben Ende klumpen.
    accessor: r => strOrNull(r.akronym) ?? r.aktenzeichen,
    exportValue: r => {
      const { fkzText } = fkzTeil(r);
      const akr = strOrNull(r.akronym);
      return akr ? `${akr} (${fkzText})` : fkzText;
    },
    render: r => {
      const { fkzText, meta } = fkzTeil(r);
      const ampel = meta ? worstAmpel(meta.tvs) : getEingangAmpel(r);
      const ampelDays = !meta && ampel !== null ? daysSinceEingang(r) : null;
      const akr = strOrNull(r.akronym);
      return (
        <span className="relative inline-flex w-full max-w-full min-w-0 items-center gap-1.5">
          <span className="shrink-0 w-2 h-2 inline-flex items-center justify-center">
            {ampel !== null ? (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: AMPEL_COLOR[ampel] }}
                title={ampelDays !== null ? `${AMPEL_TOOLTIP[ampel]} (${ampelDays} Tage)` : AMPEL_TOOLTIP[ampel]}
                aria-hidden="true"
              />
            ) : null}
          </span>
          {akr ? (
            <span className="min-w-0 shrink font-medium text-[12.5px] text-[var(--tf-text)] truncate" title={akr}>
              {akr}
            </span>
          ) : null}
          {/* Das FKZ steht klein dahinter und weicht zuerst: bei Platznot soll
              der Name überleben, nicht die Nummer. Deshalb `shrink-[3]` gegen
              das `shrink` des Akronyms. */}
          <span
            className="min-w-0 shrink-[3] font-mono text-[11px] text-[var(--tf-text-tertiary)] truncate"
            title={fkzText}
          >
            {fkzText}
          </span>
          {meta ? (
            <span
              className="shrink-0 rounded-[4px] bg-[var(--tf-bg-secondary)] px-1 font-mono text-[10px] text-[var(--tf-text-tertiary)]"
              title={`${meta.tvCount} Teilvorhaben`}
            >
              {meta.tvCount} TV
            </span>
          ) : null}
          <span className="absolute -right-3 top-1/2 -translate-y-1/2 rounded bg-[var(--tf-bg)] group-hover/row:bg-[var(--tf-bg-secondary)] opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
            <KopierIconButton
              text={fkzText}
              title={meta ? 'Verbund-FKZ kopieren' : 'FKZ kopieren'}
              ariaLabel={`${meta ? 'Verbund-FKZ' : 'FKZ'} ${fkzText} kopieren`}
            />
          </span>
        </span>
      );
    },
  },
  {
    key: 'aktenzeichen',
    label: 'FKZ',
    gruppe: G_ANTRAG,
    // Seit v4.63 im Standard durch die zusammengelegte `antrag`-Spalte ersetzt;
    // als Einzelspalte wählbar (und nicht mehr `locked` — sonst stünde das FKZ
    // zwangsweise zweimal in der Zeile).
    defaultVisible: false,
    sortable: true,
    // Rückfall ohne Messung (kein Canvas): grob die gemessene Breite.
    width: 132,
    wrap: false,
    // Gemessen wird das, was die Zelle WIRKLICH zeigt: bei einer Verbund-Zeile
    // die FKZ-Range plus den `·N`-Zähler, nicht das Einzel-Aktenzeichen des
    // `accessor`. Zuschlag: nur Ampelpunkt 8 + gap 6 — der Kopier-Knopf liegt
    // ÜBER der Zelle statt in ihr (s.u.) und kostet keine Breite mehr.
    messSchrift: 'monoKlein',
    messZuschlag: 14,
    minWidth: 96,
    maxWidth: 220,
    messText: r => (r._verbund ? `${r._verbund.fkzRange} ·${r._verbund.tvCount}` : r.aktenzeichen),
    accessor: r => r.aktenzeichen,
    render: r => {
      // Verbund-Zeile (Gruppiert: Verbund) → FKZ-Range + Count-Chip + worst-
      // Ampel über alle TVs; sonst Einzel-FKZ + eigene Eingangs-Ampel.
      const meta = r._verbund;
      const ampel = meta ? worstAmpel(meta.tvs) : getEingangAmpel(r);
      const ampelDays = !meta && ampel !== null ? daysSinceEingang(r) : null;
      const fkzText = meta ? meta.fkzRange : r.aktenzeichen;
      return (
        // `max-w-full min-w-0`: die Zelle clippt (overflow:hidden) — ohne das
        // schoebe ein langer FKZ-Range den Kopier-Knopf aus dem Sichtfeld,
        // statt den Text zu kuerzen. `relative` traegt den ueberlagerten
        // Kopier-Knopf, `w-full` gibt ihm den rechten Zellrand als Anker.
        <span className="relative inline-flex w-full max-w-full min-w-0 items-center gap-1.5">
          <span className="shrink-0 w-2 h-2 inline-flex items-center justify-center">
            {ampel !== null ? (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: AMPEL_COLOR[ampel] }}
                title={ampelDays !== null ? `${AMPEL_TOOLTIP[ampel]} (${ampelDays} Tage)` : AMPEL_TOOLTIP[ampel]}
                aria-hidden="true"
              />
            ) : null}
          </span>
          <span className="min-w-0 font-mono text-[11px] text-[var(--tf-text-tertiary)] truncate" title={fkzText}>{fkzText}</span>
          {meta ? (
            <span
              className="shrink-0 font-mono text-[10px] text-[var(--tf-text-tertiary)]"
              title={`${meta.tvCount} Teilvorhaben`}
            >
              ·{meta.tvCount}
            </span>
          ) : null}
          {/* Kopier-Knopf: liegt UEBER der Zelle, nicht in ihr. Als Slot im
              Textfluss reservierte er in jeder Zeile dauerhaft ~28px (Punkt 22
              + gap 6) fuer etwas, das nur beim Hover zu sehen ist — bei einer
              Spalte, deren Text 60px braucht, war das fast ein Drittel. Der
              Sprung, den Pitfall #14 verbietet, entsteht trotzdem nicht: ein
              absolut positionierter Knopf veraendert das Layout nie.

              `-right-3` schiebt ihn in das rechte Zellpolster (`px-3`), das
              ohnehin leer bleibt — nachgemessen deckte er sonst schon bei einem
              gewoehnlichen FKZ die letzten 10px des Textes ab, nicht erst bei
              den langen Verbund-Ranges. Der deckende Grund haelt ihn dort
              lesbar, wo er doch ueber Zeichen liegt. `focus-within` bleibt,
              damit der per Tab erreichbare Knopf nicht unsichtbar ist.
              Kopiert wird der ANGEZEIGTE Wert — bei einer Verbund-Zeile also das
              gepflegte Verbund-FKZ (ersatzweise die TV-Range, s. `verbundFkz`). */}
          <span className="absolute -right-3 top-1/2 -translate-y-1/2 rounded bg-[var(--tf-bg)] group-hover/row:bg-[var(--tf-bg-secondary)] opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
            <KopierIconButton
              text={fkzText}
              title={meta ? 'Verbund-FKZ kopieren' : 'FKZ kopieren'}
              ariaLabel={`${meta ? 'Verbund-FKZ' : 'FKZ'} ${fkzText} kopieren`}
            />
          </span>
        </span>
      );
    },
  },
  // Zuständigkeit, vier Spalten in der Lesefolge des Verfahrens: erst die
  // Antragsphase (TIB/BIB), dann die Begleitphase (ZTP/PFM).
  //
  // TIB ist zusätzlich die MA-Spalte: im „alle"-/Übersichtsmodus wird sie auch
  // ohne Picker-Auswahl erzwungen (showMaColumn) und ist dann aus dem Picker
  // ausgeblendet. Regulär wählbar bleibt sie für „auch außerhalb meiner Anträge
  // suchen" — dann stehen fremde TIBs in der Trefferliste.
  kuerzelColumn({
    key: MA_COLUMN_KEY, label: 'TIB', rolle: 'FB (Antragsphase)',
    defaultVisible: false, width: 72,
  }),
  kuerzelColumn({
    key: 'bib_kuerz', label: 'BIB', rolle: 'AB (Antragsphase)',
    defaultVisible: true, width: 96,
  }),
  kuerzelColumn({
    key: 'ztp_kuerz', label: 'ZTP', rolle: 'FB (Begleitphase)',
    defaultVisible: false, width: 96,
  }),
  kuerzelColumn({
    key: 'pfm_kuerz', label: 'PFM', rolle: 'AB (Begleitphase)',
    defaultVisible: false, width: 76,
  }),
  {
    // Die beiden Kürzel der ANTRAGSPHASE in einer Spur, mit Rollen-Vorsilbe
    // statt Spaltenkopf: `FB THü` · `AB StE`. Wer die Tabelle zum Sichten
    // benutzt, braucht die Zuständigkeit, nicht zwei Spalten davon.
    //
    // Nur Antragsphase: `ztp_kuerz`/`pfm_kuerz` (Begleitphase) bleiben eigene
    // Picker-Spalten. Vier Kürzel in einer Zelle wären keine Verdichtung mehr,
    // und eine Ausweichkette FB = `tib || ztp` rührte zwei Quellen zu einer
    // Aussage zusammen — man wüsste nicht mehr, welche Phase man liest.
    key: 'zustaendig',
    label: 'Zuständig',
    gruppe: G_ZUSTAENDIGKEIT,
    defaultVisible: false,
    sortable: true,
    // Nicht filterbar: die Zelle trägt zwei Felder, ein Spaltenkopf-Filter
    // müsste sich für eines entscheiden. Wer nach einem Kürzel filtert, nimmt
    // die Einzelspalte oder die Filterleiste (Zuständigkeit FB/AB).
    width: 150,
    wrap: false,
    messSchrift: 'badge',
    // Zwei Badges (`px-1.5`) + zwei Vorsilben + Abstände.
    messZuschlag: 46,
    // Sortiert nach FB, dann AB — dieselbe Lesefolge wie die Zelle.
    accessor: r => `${strOrNull(r.tib_kuerz) ?? ''} ${strOrNull(r.bib_kuerz) ?? ''}`.trim(),
    exportValue: r => {
      const fb = strOrNull(r.tib_kuerz);
      const ab = strOrNull(r.bib_kuerz);
      return [fb ? `FB ${fb}` : null, ab ? `AB ${ab}` : null].filter(Boolean).join(' · ');
    },
    render: r => {
      const fb = strOrNull(r.tib_kuerz);
      const ab = strOrNull(r.bib_kuerz);
      if (!fb && !ab) return null;
      return (
        <span className="inline-flex items-center gap-2">
          {fb ? (
            <span className="inline-flex items-center gap-1">
              <span className="text-[9.5px] tracking-[0.06em] text-[var(--tf-text-tertiary)]">FB</span>
              <MaKuerzelBadge kuerzel={fb} title={`FB (Antragsphase): ${fb}`} />
            </span>
          ) : null}
          {ab ? (
            <span className="inline-flex items-center gap-1">
              <span className="text-[9.5px] tracking-[0.06em] text-[var(--tf-text-tertiary)]">AB</span>
              <MaKuerzelBadge kuerzel={ab} title={`AB (Antragsphase): ${ab}`} />
            </span>
          ) : null}
        </span>
      );
    },
  },
  {
    key: 'akronym',
    label: 'Akronym',
    gruppe: G_ANTRAGSDATEN,
    // Seit v4.63 im Standard Teil der `antrag`-Spalte. Einzeln bleibt sie
    // wählbar — sie ist die einzige, die einen Kopf-Filter auf das Akronym
    // anbietet (die zusammengelegte Spalte trägt zwei Felder und könnte sich
    // für keines entscheiden).
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 130,
    wrap: false,
    accessor: r => strOrNull(r.akronym) ?? '',
    render: r => {
      const v = strOrNull(r.akronym);
      return v ? <span className="font-medium text-[12.5px] text-[var(--tf-text)]" title={v}>{v}</span> : null;
    },
  },
  {
    key: 'antragsteller',
    label: 'Antragsteller',
    gruppe: G_ANTRAGSDATEN,
    defaultVisible: true,
    sortable: true,
    filterable: true,
    width: 260,
    wrap: false,
    // Institutsnamen laufen im Bestand über 120 Zeichen — ohne Deckel bliese
    // eine einzige Zeile die Tabelle auf.
    messSchrift: 'zelleKlein',
    maxWidth: 300,
    accessor: r => strOrNull(r.antragsteller) ?? '',
    render: r => {
      const v = strOrNull(r.antragsteller);
      return v ? <span className="text-[12px] text-[var(--tf-text-secondary)]" title={v}>{v}</span> : null;
    },
  },
  {
    // Kombinierte „Status und nächster Schritt"-Spalte (Journey-Paket 2 Phase 3):
    // amtliches Status-Badge + ` → {Aktion}` aus `naechsterSchritt` (inkl.
    // PreCheck-Stand). Terminale Anträge: kein Badge, nur grauer Status-Text.
    // Sortierung nach kanonischem Status-Rang (`statusRang`, Pitfall #12), dann
    // Aktion alphabetisch als Sekundärschlüssel — beides in einen Sortier-String
    // gefaltet (Rang 2-stellig gepolstert → dominiert, Aktion tie-break).
    key: STATUS_SCHRITT_KEY,
    label: 'Status und nächster Schritt',
    gruppe: G_STATUS,
    defaultVisible: true,
    sortable: true,
    width: 320,
    wrap: false,
    // Badge (`px-2.5`) + Info-Icon des Herleitungs-Popovers. Untergrenze so
    // gesetzt, dass bei Platznot die Aktion zuerst gekürzt wird, nicht der
    // Status; `exportValue` liefert bereits den lesbaren Text (der `accessor`
    // ist ein Rang-Sortier-String und wäre als Messquelle unbrauchbar).
    messZuschlag: 42,
    minWidth: 240,
    accessor: r => {
      const s = strOrNull(r.status);
      if (!s) return '99'; // leerer Status ans Ende
      const schritt = naechsterSchritt(s, precheckUrteilVonZeile(r).label);
      const aktion = (schritt?.aktion || statusKurzLabel(s)).toLowerCase();
      return `${String(statusRang(s)).padStart(2, '0')} ${aktion}`;
    },
    // Export lesbar halten (nicht den Rang-Sortier-String) — „{Status} → {Aktion}".
    // Der VOLLE Bezeichner: eine Tabellenzelle hat keine Breitenbeschränkung und
    // keinen Tooltip, und der Export ist das Einzige, was die App verlässt —
    // eine Abkürzung dort ist ohne Rückweg.
    exportValue: r => {
      const s = strOrNull(r.status);
      if (!s) return '';
      const schritt = naechsterSchritt(s, precheckUrteilVonZeile(r).label);
      const aktion = isTerminalStatus(s) ? '' : (schritt?.aktion ?? '');
      return aktion ? `${statusLabel(s)} → ${aktion}` : statusLabel(s);
    },
    render: r => {
      const s = strOrNull(r.status);
      if (!s) return null;
      // Das Konflikt-Badge ist mit v2.384 entfallen: es meldete einen Widerspruch
      // zwischen zwei ABGELEITETEN Spine-Phasen. Die App leitet keinen Status mehr
      // ab — auseinanderlaufende Ebenen zeigt jetzt das Herleitungs-Popover
      // („Verbund-Status: 31 · beantragt / TV-Status: 72 · …"), und zwar als
      // Auskunft statt als Warnung.
      // Terminal: Arbeit erledigt → kein farbiges Badge, nur ruhiger Status-Text.
      if (isTerminalStatus(s)) {
        return (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]" title={statusLabelMitQuelle(s)}>
            {statusKurzLabel(s)}
            {renderHerleitung(r)}
          </span>
        );
      }
      const schritt = naechsterSchritt(s, precheckUrteilVonZeile(r).label);
      const aktion = schritt?.aktion ?? '';
      // Inline gehalten (kein Flex): das nowrap-`<td>` (overflow:hidden +
      // text-overflow:ellipsis) clippt den nachgestellten Aktions-Text zuerst;
      // das Badge steht vorne und wird nie abgeschnitten.
      return (
        <span
          className="text-[11.5px]"
          title={aktion ? `${statusLabelMitQuelle(s)} → ${aktion}` : statusLabelMitQuelle(s)}
        >
          <Badge
            variant={getStatusVariant(s)}
            className="align-middle justify-center whitespace-nowrap text-[10.5px]"
          >
            {statusKurzLabel(s)}
          </Badge>
          {renderHerleitung(r)}
          {aktion ? (
            <span className="ml-1.5 text-[var(--tf-text-secondary)]">→ {aktion}</span>
          ) : null}
        </span>
      );
    },
  },
  {
    // Altes reines Status-Badge — bleibt als Spalten-Picker-Option, Default AUS
    // (seit Phase 3 durch „Status und nächster Schritt" ersetzt). Bestehende
    // gespeicherte Spalten-Configs behalten diese Spalte (Migration lässt Keys
    // unangetastet, nur der Default ändert sich).
    key: 'status',
    label: 'Status',
    gruppe: G_STATUS,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 140,
    wrap: false,
    // Badge trägt `min-w-[100px]` + `px-2.5`, dazu das Info-Icon — darunter
    // wird die Zelle nicht schmaler, egal wie kurz das Label ist.
    messSchrift: 'badge',
    messZuschlag: 42,
    minWidth: 142,
    // Der Accessor speist Sortierung, Filter-Kandidaten UND die Breitenmessung
    // derselben Spalte — er MUSS dieselbe Zeichenkette liefern wie das Render.
    // Sonst filtert man nach einem Vokabular, das in der Zelle nicht steht.
    accessor: r => {
      const s = strOrNull(r.status);
      return s ? statusKurzLabel(s) : '';
    },
    exportValue: r => {
      const s = strOrNull(r.status);
      return s ? statusLabel(s) : '';
    },
    render: r => {
      const s = strOrNull(r.status);
      return s ? (
        <span className="inline-flex items-center" title={statusLabelMitQuelle(s)}>
          <Badge
            variant={getStatusVariant(s)}
            className="min-w-[100px] justify-center whitespace-nowrap text-[10.5px]"
          >
            {statusKurzLabel(s)}
          </Badge>
          {renderHerleitung(r)}
        </span>
      ) : null;
    },
  },
  // Datums-Status-Spalten (FB Status / PreCheck Status): jüngstes gültiges Datum
  // über mehrere Legacy-Spalten — die *_status_label/_datum-Felder werden bei der
  // List-View-Projektion berechnet (siehe status-datum-gruppen.ts). Off by default
  // (einblendbar via Spalten-Picker).
  statusDatumColumn({
    key: 'fb_status',
    label: 'FB Status',
    gruppe: G_STATUS,
    variant: 'info',
    getLabel: r => r.fb_status_label,
    getDatum: r => r.fb_status_datum,
  }),
  // Zwei PreCheck-Spalten, nicht eine: `D_PC±` ist die Vorprüfung des AB am
  // Teilvorhaben, `D_XPC±` die des FB am Verbund (R23a/R23b). Bis v6.65 standen
  // beide in einer Spalte, in der das jüngere Datum gewann — bei 256 Anträgen
  // verdeckte das positive Verbund-Urteil ein negatives TV-Urteil.
  statusDatumColumn({
    key: 'precheck_tv_status',
    label: 'PreCheck TV',
    gruppe: G_STATUS,
    variant: 'default',
    getLabel: r => r.precheck_tv_status_label,
    getDatum: r => r.precheck_tv_status_datum,
  }),
  statusDatumColumn({
    key: 'precheck_vb_status',
    label: 'PreCheck Verbund',
    gruppe: G_STATUS,
    variant: 'default',
    getLabel: r => r.precheck_vb_status_label,
    getDatum: r => r.precheck_vb_status_datum,
  }),
  {
    // FB-Status und PreCheck in EINER Spur — die beiden Einzelspalten darüber
    // bleiben im Picker, wer den vollen Badge-Satz will, nimmt sie.
    //
    // Ruhige Fläche: kein gefülltes Badge (das trägt der amtliche Status),
    // sondern Rollen-Vorsilbe + Text. Ein Farbpunkt steht NUR am PreCheck —
    // dort gibt es mit `classifyPrecheckBucket` eine kuratierte Klassifikation
    // (positiv/negativ/offen, dieselbe wie in der Filter-Pille). Für den
    // FB-Status gibt es keine; ihn über Wort-Präfixe des Fremddaten-Labels
    // („Ablehnung…", „Rücknahme…") einzufärben behauptete eine Klassifikation,
    // die das Datenmodell nicht hergibt, und liefe bei der nächsten
    // Label-Pflege still falsch.
    key: 'fb_precheck',
    label: 'FB / PreCheck',
    gruppe: G_STATUS,
    defaultVisible: false,
    sortable: true,
    width: 190,
    wrap: false,
    messSchrift: 'zelleKlein',
    messZuschlag: 34,
    // Sortiert nach PreCheck-Klasse (die getragene Aussage), FB als Tie-Break.
    accessor: r =>
      `${classifyPrecheckBucket(precheckUrteilVonZeile(r).label)} ${strOrNull(r.fb_status_label) ?? ''}`,
    // Export trägt den VOLLEN Wortlaut beider Felder — die Zelle kürzt, die
    // Datei ist das Einzige, was die App verlässt. Beide PreCheck-Teile stehen
    // einzeln da: welcher das Urteil trägt, ist in der Datei nicht ablesbar,
    // wenn nur der Sieger exportiert wird.
    exportValue: r => {
      const fb = strOrNull(r.fb_status_label);
      const pcTv = strOrNull(r.precheck_tv_status_label);
      const pcVb = strOrNull(r.precheck_vb_status_label);
      return [
        fb ? `FB: ${fb}` : null,
        pcTv ? `PC TV: ${pcTv}` : null,
        pcVb ? `PC Verbund: ${pcVb}` : null,
      ].filter(Boolean).join(' · ');
    },
    render: r => {
      const fb = strOrNull(r.fb_status_label);
      const urteil = precheckUrteilVonZeile(r);
      const pc = strOrNull(urteil.label);
      if (!fb && !pc) return null;
      const klasse = classifyPrecheckBucket(urteil.label);
      const pcFarbe = klasse === 'positiv'
        ? 'var(--tf-success-text)'
        : klasse === 'negativ' ? 'var(--tf-danger-text)' : 'var(--tf-border-hover)';
      const datum = (v: string | undefined): string =>
        strOrNull(v) ? ` (${formatGermanDate(strOrNull(v)!)})` : '';
      return (
        <span className="inline-flex items-center gap-2.5 text-[11px] max-w-full">
          {fb ? (
            <span className="inline-flex items-baseline gap-1 min-w-0" title={`FB Status: ${fb}${datum(r.fb_status_datum)}`}>
              <span className="shrink-0 text-[9.5px] tracking-[0.06em] text-[var(--tf-text-tertiary)]">FB</span>
              <span className="truncate text-[var(--tf-text-secondary)]">{fb}</span>
            </span>
          ) : null}
          {pc ? (
            // Der Titel nennt BEIDE Teile, auch wenn die Zelle nur den
            // ausschlaggebenden zeigt: sonst liest sich ein negatives TV-Urteil
            // wie das Urteil des Verbunds (und umgekehrt).
            <span
              className="inline-flex items-center gap-1 min-w-0"
              title={[
                strOrNull(r.precheck_tv_status_label)
                  ? `PreCheck TV: ${r.precheck_tv_status_label}${datum(r.precheck_tv_status_datum)}`
                  : null,
                strOrNull(r.precheck_vb_status_label)
                  ? `PreCheck Verbund: ${r.precheck_vb_status_label}${datum(r.precheck_vb_status_datum)}`
                  : null,
              ].filter(Boolean).join('\n')}
            >
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ background: pcFarbe }}
                aria-hidden="true"
              />
              <span className="shrink-0 text-[9.5px] tracking-[0.06em] text-[var(--tf-text-tertiary)]">PC</span>
              <span className="truncate text-[var(--tf-text-secondary)]">{pc}</span>
            </span>
          ) : null}
        </span>
      );
    },
  },
  {
    key: 'frist',
    label: 'Frist',
    gruppe: G_FRIST,
    defaultVisible: true,
    sortable: true,
    width: 96,
    wrap: false,
    // Ampelpunkt (`w-1.5`) + gap. Gemessen wird der `exportValue` („in 45 T"),
    // nicht der `accessor` — der ist die Tage-Zahl mit MAX_SAFE_INTEGER-Sentinel.
    messSchrift: 'badge',
    messZuschlag: 12,
    // Sortier-Wert bleibt der numerische „Tage bis zur Frist" (asc = dringendste
    // zuerst). Terminale/leere Fristen ans Ende → große Zahl (deckt sich mit der
    // leeren Anzeige in `render`/`fristAnzeige`). Verbund-Zeile: dringendste
    // Frist über alle TVs (kritischster TV), sonst per-TV.
    accessor: r => {
      // Nur laufende Uhren tragen eine Restzeit. Angehaltene und unberechenbare
      // sinken ans Ende — sonst stünde ein seit Jahren entschiedener Vorgang
      // mit „853 T über" an der Spitze der nach Frist sortierten Liste.
      const tage = r._verbund ? criticalFristAware(r._verbund.tvs) : fristTageVon(r);
      return tage ?? Number.MAX_SAFE_INTEGER;
    },
    // Export = lesbarer Text („in 45 T" / „seit 12 T" / „angehalten" / „—"),
    // nie der Sortier-Sentinel. Die drei Zustände stehen auch im XLSX: wer die
    // Liste weiterreicht, soll dieselbe Aussage haben wie am Bildschirm.
    exportValue: r => fristAnzeigeVon(fristErgebnisFuerZeile(r)).text,
    render: r => {
      const e = fristErgebnisFuerZeile(r);
      const a = fristAnzeigeVon(e);
      const overdue = a.ampel === 'rot';
      // Angehalten und unberechenbar sind keine Warnung, sondern eine Auskunft:
      // grau, kein Punkt. Ein Ampelpunkt an einer stehenden Uhr behauptete eine
      // Dringlichkeit, die es nicht gibt.
      return (
        <span
          className={`inline-flex items-center gap-1.5 tabular-nums text-[11px] ${
            overdue ? 'text-[var(--tf-danger-text)] font-medium' : 'text-[var(--tf-text-tertiary)]'
          }`}
          title={fristTooltip(e, r._verbund !== undefined)}
        >
          {a.ampel !== null && (
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full"
              style={{ background: AMPEL_COLOR[a.ampel] }}
              aria-hidden="true"
            />
          )}
          {a.text}
        </span>
      );
    },
  },
  {
    key: 'titel',
    label: 'TV Titel',
    gruppe: G_ANTRAGSDATEN,
    defaultVisible: false,
    sortable: true,
    width: 260,
    wrap: false,
    ...MESS_TEXT,
    maxWidth: 320,
    accessor: r => strOrNull(r.titel) ?? '',
    render: r => textCell(strOrNull(r.titel)),
  },
  {
    key: 'verbund_titel',
    label: 'VB Titel',
    gruppe: G_ANTRAGSDATEN,
    defaultVisible: false,
    sortable: true,
    width: 280,
    wrap: false,
    ...MESS_TEXT,
    maxWidth: 320,
    // Verbund-Titel ist nicht in `AntragListItem` projiziert (Verbund-Level-Feld);
    // `AntraegeTable` reichert die Row vorab aus `verbundById` an (siehe dort).
    accessor: r => strOrNull(r.verbund_titel) ?? '',
    render: r => textCell(strOrNull(r.verbund_titel)),
  },
  {
    key: 'vb_phase',
    label: 'Typ',
    gruppe: G_ANTRAGSDATEN,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 76,
    wrap: false,
    ...MESS_TEXT,
    accessor: r => getKategorieLabel(r.vb_phase) ?? '',
    render: r => {
      const v = getKategorieLabel(r.vb_phase);
      return v ? <span className="text-[12px] text-[var(--tf-text)]">{v}</span> : null;
    },
  },
  {
    key: 'bewilligung_datum',
    label: 'Bewilligungsdatum',
    gruppe: G_TERMINE,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => yearOfOrEmpty(r.bewilligung_datum),
    width: 148,
    wrap: false,
    ...MESS_DATUM,
    accessor: r => strOrNull(r.bewilligung_datum) ?? '',
    render: r => dateCell(strOrNull(r.bewilligung_datum)),
  },
  {
    key: 'erstentscheidung',
    label: 'Erstentscheidung',
    gruppe: G_TERMINE,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => yearOfOrEmpty(r.erstentscheidung),
    width: 148,
    wrap: false,
    ...MESS_DATUM,
    accessor: r => strOrNull(r.erstentscheidung) ?? '',
    render: r => dateCell(strOrNull(r.erstentscheidung)),
  },
  {
    key: 'antragsdatum',
    label: 'Antragseingang',
    gruppe: G_TERMINE,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    // Zweistufig: Monat als Filterwert, Jahr als Gruppe, neueste zuerst. Der
    // Sentinel macht Zeilen ohne lesbares Datum wählbar — mit dem blossen
    // `yearOf` fielen sie still aus der Tabelle, sobald ein Jahr angehakt war.
    filterAccessor: r => monatsWertOderLeer(r.antragsdatum),
    formatFilterLabel: monatsFilterLabel,
    filterGroupOf: jahrGruppe,
    filterSort: neuesteZuerst,
    width: 140,
    wrap: false,
    ...MESS_DATUM,
    accessor: r => strOrNull(r.antragsdatum) ?? '',
    render: r => dateCell(strOrNull(r.antragsdatum)),
  },
  {
    key: 'ort_ast',
    label: 'Ort AST',
    gruppe: G_ANTRAGSDATEN,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 140,
    wrap: false,
    ...MESS_TEXT,
    accessor: r => strOrNull(r.ort_ast) ?? '',
    render: r => textCell(strOrNull(r.ort_ast)),
  },
  {
    key: 'foerdersumme',
    label: 'Zuwendung',
    gruppe: G_ANTRAGSDATEN,
    defaultVisible: false,
    sortable: true,
    width: 124,
    wrap: false,
    // Der `accessor` liefert bewusst die ROHE Zahl (Excel soll damit rechnen
    // können) — gemessen werden muss aber der formatierte Betrag der Zelle.
    messSchrift: 'mono',
    minWidth: 110,
    messText: r => (typeof r.foerdersumme === 'number' ? formatEur(r.foerdersumme) : ''),
    accessor: r => (typeof r.foerdersumme === 'number' ? r.foerdersumme : 0),
    render: r =>
      typeof r.foerdersumme === 'number' ? (
        <span className="font-mono text-[12px] text-[var(--tf-text)] block text-right">{formatEur(r.foerdersumme)}</span>
      ) : null,
  },
  {
    key: 'laufzeitbeginn',
    label: 'Laufzeitbeginn',
    gruppe: G_TERMINE,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => yearOfOrEmpty(r.laufzeitbeginn),
    width: 132,
    wrap: false,
    ...MESS_DATUM,
    accessor: r => strOrNull(r.laufzeitbeginn) ?? '',
    render: r => dateCell(strOrNull(r.laufzeitbeginn)),
  },
  {
    key: 'laufzeitende',
    label: 'Laufzeitende',
    gruppe: G_TERMINE,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => yearOfOrEmpty(r.laufzeitende),
    width: 132,
    wrap: false,
    ...MESS_DATUM,
    accessor: r => strOrNull(r.laufzeitende) ?? '',
    render: r => dateCell(strOrNull(r.laufzeitende)),
  },
  {
    key: 'branche',
    label: 'Branche',
    gruppe: G_ANTRAGSDATEN,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 150,
    wrap: false,
    ...MESS_TEXT,
    accessor: r => strOrNull(r.branche) ?? '',
    render: r => textCell(strOrNull(r.branche)),
  },
  {
    key: 'foerdergeber',
    label: 'Fördergeber',
    gruppe: G_ANTRAGSDATEN,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 150,
    wrap: false,
    ...MESS_TEXT,
    accessor: r => strOrNull(r.foerdergeber) ?? '',
    render: r => textCell(strOrNull(r.foerdergeber)),
  },
];

/** Die Registry in Lesefolge — Single Source für Tabelle, Export und Picker. */
export const ANTRAG_TABLE_COLUMNS: SortableColumn<AntragTableRow>[] = ordneNachRubrik(ROH_SPALTEN);

export const DEFAULT_VISIBLE_COLUMN_KEYS: string[] =
  ANTRAG_TABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);

/**
 * Zusatz-Hinweis im Spalten-Picker. Die Spaltenköpfe tragen die Kürzel des
 * Fachsystems (TIB/BIB/ZTP/PFM) — kurz genug für eine schmale Spalte, aber
 * nicht selbsterklärend. Im Picker ist Platz für die Rolle dahinter.
 */
export function spaltenHinweis(key: string): string | null {
  switch (key) {
    case 'tib_kuerz': return 'FB';
    case 'bib_kuerz': return 'AB';
    case 'ztp_kuerz': return 'FB · Begleitung';
    case 'pfm_kuerz': return 'AB · Begleitung';
    // Die beiden verdichteten Spalten sagen im Picker, was sie zusammenfassen —
    // sonst steht „Zuständig" ununterscheidbar neben „TIB" und „BIB".
    case ZUSTAENDIG_COLUMN_KEY: return 'FB + AB';
    case 'fb_precheck': return 'zwei Felder';
    default: return null;
  }
}

export const LOCKED_COLUMN_KEYS: string[] =
  ANTRAG_TABLE_COLUMNS.filter(c => c.locked === true).map(c => c.key);

/**
 * Präfix der Ordner-Spalten aus dem Statuskatalog. Diese Spalten stehen NICHT
 * in `ANTRAG_TABLE_COLUMNS` — welche es gibt, entscheidet die Kuration, nicht
 * der Code. Der Sichtbarkeits-Store muss sie deshalb am Präfix erkennen statt
 * an einer festen Schlüsselliste.
 */
export const KATEGORIE_COLUMN_PREFIX = 'katstatus:';

/**
 * Eine einblendbare Spalte je kuratiertem Ordner: der jüngste Eintrag des
 * Ordners als Badge, das Datum im Tooltip und als Sortierschlüssel. Bauart 1:1
 * wie die fest verdrahteten FB-/PreCheck-Spalten — nur dass die Liste aus dem
 * Katalog kommt.
 */
export function kategorieStatusColumns(
  kategorien: readonly { kategorieId: string; label: string }[],
): SortableColumn<AntragTableRow>[] {
  // Nach Rubrik sortieren: die Katalog-Liste sichert keine `vb.`/`tv.`-
  // Gruppierung zu, und eine gemischte Folge zerrisse die Rubrik-Kopfzeile in
  // abwechselnde Ein-Spalten-Strecken.
  return ordneNachOrdnerRubrik(kategorien.map(k => statusDatumColumn({
    key: `${KATEGORIE_COLUMN_PREFIX}${k.kategorieId}`,
    label: k.label,
    gruppe: ordnerRubrik(k.kategorieId),
    variant: 'default',
    getLabel: r => r.kat_status?.[k.kategorieId]?.l,
    getDatum: r => r.kat_status?.[k.kategorieId]?.d,
  })));
}

/** Reihenfolge der drei Ordner-Rubriken. Stabil — innerhalb einer Rubrik bleibt
 *  die Katalog-Reihenfolge. */
const ORDNER_RUBRIK_ORDNUNG: readonly string[] = [G_ORDNER_VB, G_ORDNER_TV, G_ORDNER];

function ordneNachOrdnerRubrik(
  spalten: SortableColumn<AntragTableRow>[],
): SortableColumn<AntragTableRow>[] {
  const rang = (c: SortableColumn<AntragTableRow>): number => {
    const i = ORDNER_RUBRIK_ORDNUNG.indexOf(c.gruppe ?? '');
    return i < 0 ? ORDNER_RUBRIK_ORDNUNG.length : i;
  };
  return spalten
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rang(a.c) - rang(b.c) || a.i - b.i)
    .map(x => x.c);
}
