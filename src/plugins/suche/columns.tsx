/**
 * Spalten-Konfiguration fuer die Excel-artige Suchtabelle.
 *
 * Pro Spalte:
 *  - `accessor`: liefert den sortier-/filterbaren Rohwert (auch fuer Export).
 *  - `render`: liefert das JSX fuer eine Zelle.
 *
 * Konvention: leere Zellen liefern `''` aus `accessor` und `null` aus `render`,
 * damit Sortierung deterministisch ist und Tailwind keinen Layout-Shift macht.
 *
 * Die durchsuchten Textspalten rendern über `MarkierterText` (v4.15.0) — er
 * holt die Suchwörter aus dem Kontext, den die Suchseite um die Tabelle legt.
 * `accessor` bleibt unangetastet: Sortierung, Filter und Export arbeiten auf dem
 * Rohwert, markiert wird nur, was am Bildschirm steht.
 */
import { memo, type ReactNode } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StufenBalken } from '@/components/ui/StufenBalken';
import { RELEVANZ_LABEL } from '@/core/services/search/trefferstelle';
import { antwortSatzFuer, useAntwortBeleg } from './antwort/AntwortBelegKontext';
import { MarkierterText } from './SuchMarkierung';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { SortableColumn } from '@/components/data-table';
import { getStatusCategoryColor } from '@/core/utils/status-category-labels';
import { statusKurzLabel, statusLabel } from '@/core/utils/status-wert-labels';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';

export type SearchColumnAppliesTo = 'both' | 'antrag' | 'dokument';

/**
 * Filter-Typ pro Spalte:
 *  - `multiSelect` (Default): Checkbox-Liste mit allen distinct accessor-Werten.
 *  - `year`: Extrahiert das Jahr aus Datums-Werten (YYYY-MM-DD oder dd.mm.yyyy).
 *    Filter zeigt Jahre als Multi-Select.
 *  - `type`: Antrag / Dokument-Filter — Werte kommen aus `filterAccessor`, nicht
 *    aus dem `accessor` (der dort den FKZ/Dateinamen liefert).
 */
export type SearchColumnFilterType = 'multiSelect' | 'year' | 'type';

/**
 * Such-spezifische Spalten-Definition: erweitert die generische
 * `SortableColumn<UnifiedSearchResult>` um Filter- + Resize-spezifische
 * Felder (Default-Width hier required, `filterable`, Filter-Typ, Filter-
 * Accessor, etc.).
 */
export interface SearchColumn extends SortableColumn<UnifiedSearchResult> {
  /** Default-Spaltenbreite in Pixel. User kann sie per Drag-Handle ueberschreiben. */
  width: number;
  filterable: boolean;
  appliesTo: SearchColumnAppliesTo;
  /** Default `multiSelect`. */
  filterType?: SearchColumnFilterType;
  /** Optional separate Quelle fuer Filter-Kandidaten (wenn der Filter etwas
   *  anderes filtert als der Sort-Accessor — z.B. `fkzDatei`: Sort nach
   *  FKZ/Datei, Filter nach Antrag/Dokument). */
  filterAccessor?: (r: UnifiedSearchResult) => string;
  /** Optionaler Display-Mapper fuer Filter-Dropdown-Werte. Filter-State bleibt
   *  nach Roh-Werten indexiert; nur das Label im Dropdown wird gemappt. */
  formatFilterLabel?: (value: string) => string;
}

/** Extrahiert das Jahr (YYYY) aus einem ISO- oder dd.mm.yyyy-Datum.
 *  Liefert leeren String bei nicht-parsebaren Werten. */
export function extractYear(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const s = String(value);
  const iso = /^(\d{4})-\d{2}-\d{2}/.exec(s);
  if (iso && iso[1]) return iso[1];
  const de = /^\d{2}\.\d{2}\.(\d{4})/.exec(s);
  if (de && de[1]) return de[1];
  return '';
}

/**
 * Liefert den Filter-Wert einer Spalte fuer eine Ergebniszeile — beruecksichtigt
 * `filterType` und optionalen `filterAccessor`. Wird sowohl beim Sammeln der
 * Filter-Kandidaten als auch beim Anwenden des Filters genutzt, damit beide
 * Pfade identisch projizieren.
 */
export function getColumnFilterValue(col: SearchColumn, r: UnifiedSearchResult): string {
  if (col.filterType === 'type' && col.filterAccessor) {
    return col.filterAccessor(r);
  }
  if (col.filterType === 'year') {
    const raw = col.filterAccessor ? col.filterAccessor(r) : col.accessor(r);
    return extractYear(raw);
  }
  if (col.filterAccessor) return col.filterAccessor(r);
  const v = col.accessor(r);
  return v === undefined || v === null ? '' : String(v);
}

const METHOD_LABELS: Record<string, string> = {
  fulltext: 'Stichwort', vector: 'Bedeutung', hybrid: 'Stichwort + Bedeutung',
};

function safeString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

// Zellen-Renderer sind ueber alle ~14 Spalten und alle Treffer-Zeilen
// im Hot-Path. memo() spart bei Filter-/Sort-/Resize-Updates Tausende
// Reconcile-Calls (siehe Performance-Audit, R2).
const MethodPill = memo(function MethodPill({ method }: { method: string }): ReactNode {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
      {METHOD_LABELS[method] ?? method}
    </span>
  );
});

const TypeBadge = memo(function TypeBadge({ r }: { r: UnifiedSearchResult }): ReactNode {
  if (r.type === 'antrag') {
    const dotColor = r.statusKategorie ? getStatusCategoryColor(r.statusKategorie) : '#d1d5db';
    const label = getKategorieLabel(r.vbPhase) ?? 'Antrag';
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-800">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-violet-50 text-violet-800">
      <FileText size={10} aria-hidden />
      Dok
    </span>
  );
});

const StatusBadge = memo(function StatusBadge({ r }: { r: UnifiedSearchResult }): ReactNode {
  if (r.type !== 'antrag' || !r.status) return null;
  const color = r.statusKategorie ? getStatusCategoryColor(r.statusKategorie) : '#9ca3af';
  return (
    <span
      className="inline-block text-[11px] px-2 py-0.5 rounded truncate max-w-full"
      style={{ backgroundColor: `${color}22`, color, border: `0.5px solid ${color}44` }}
      title={statusLabel(r.status)}
    >
      {statusKurzLabel(r.status)}
    </span>
  );
});

function formatEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export const SEARCH_COLUMNS: SearchColumn[] = [
  {
    key: 'type', label: 'Typ', width: 60, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'both',
    // Accessor liefert exakt das Label, das TypeBadge anzeigt — damit
    // Filter-Dropdown / Sort konsistent zur Zell-Pill sind. Die Typ-Spalte
    // unterscheidet ausschliesslich entlang der UnifiedSearchResult.type-Achse
    // ('antrag' / 'dokument'), nicht entlang Dokument-interner Subtypen.
    accessor: r => r.type === 'antrag'
      ? (getKategorieLabel(r.vbPhase) ?? 'Antrag')
      : 'Dok',
    render: r => <TypeBadge r={r} />,
  },
  {
    key: 'fkzDatei', label: 'FKZ', width: 85, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'both',
    accessor: r => r.type === 'antrag' ? safeString(r.fkz) : safeString(r.dateiname),
    filterType: 'type',
    filterAccessor: r => r.type === 'antrag' ? 'Antrag' : 'Dokument',
    render: r => r.type === 'antrag'
      ? (
        <span className="font-mono text-[12px] text-[var(--tf-text)]">
          <MarkierterText text={r.fkz ?? ''} />
        </span>
      )
      : (
        <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.dateiname}>
          <MarkierterText text={r.dateiname ?? ''} />
        </span>
      ),
  },
  {
    // Das Kennzeichen des VERBUNDS — steht direkt neben dem des Teilvorhabens,
    // weil man beide nebeneinander liest. Filterbar: die Nummer ist der einzige
    // Weg, die Geschwister eines Teilvorhabens beisammen zu sehen (3 451 der
    // 7 535 Verbünde haben mehr als eines).
    key: 'verbundkennzeichen', label: 'Verbund-Nr.', width: 115, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.verbundkennzeichen),
    render: r => r.verbundkennzeichen
      ? (
        <span className="font-mono text-[12px] text-[var(--tf-text)]">
          <MarkierterText text={r.verbundkennzeichen} />
        </span>
      )
      : null,
  },
  {
    // Format „Programm/Unterprogramm" (z.B. „ZIM/ZIM FuE-Projekte 2025"). Ohne
    // Unterprogramm nur der Programm-Name. Sort/Filter/Export laufen ueber den
    // kombinierten Accessor-Wert — dadurch wird Filtern nach Unterprogramm moeglich.
    key: 'programm', label: 'Programm', width: 180, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'both',
    accessor: r => {
      const p = r.programm ?? r.zugehoerigesProgramm;
      if (!p) return '';
      return r.unterprogramm ? `${p}/${r.unterprogramm}` : safeString(p);
    },
    render: r => {
      const p = r.programm ?? r.zugehoerigesProgramm;
      if (!p) return null;
      const text = r.unterprogramm ? `${p}/${r.unterprogramm}` : p;
      return (
        <span className="text-[11px] text-[var(--tf-text-secondary)] truncate block" title={text}>
          {text}
        </span>
      );
    },
  },
  {
    key: 'titelInhalt', label: 'Titel / Inhalt', width: 400, defaultVisible: true,
    sortable: true, filterable: false, locked: true, appliesTo: 'both', wrap: true,
    accessor: r => safeString(r.title),
    render: r => (
      <div className="min-w-0">
        <span className="font-medium text-[13px] text-[var(--tf-text)]">
          <MarkierterText text={r.title} />
        </span>
        {/* Die Suche bleibt am Vollbestand — ein Treffer aus einem
            stillgelegten Altprogramm wird gekennzeichnet, nicht verschwiegen.
            Öffnen geht trotzdem; der Bereich bleibt, wie er ist. */}
        {r.ausserhalbBereich && (
          <span
            className="ml-1.5 text-[10.5px] text-[var(--tf-text-tertiary)] whitespace-nowrap"
            title="Dieser Antrag liegt außerhalb des eingestellten Anzeigebereichs. Er lässt sich trotzdem öffnen."
          >
            · außerhalb des Anzeigebereichs
          </span>
        )}
        {r.snippet && (
          <>
            <span className="text-[12px] text-[var(--tf-text-tertiary)]"> — </span>
            <span className="text-[12px] text-[var(--tf-text-secondary)]">
              <MarkierterText text={r.snippet} />
            </span>
          </>
        )}
      </div>
    ),
  },
  {
    key: 'status', label: 'Status', width: 90, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.status),
    render: r => <StatusBadge r={r} />,
    // Dieselbe Zeichenkette wie in der Zelle — sonst filtert man nach einem
    // Vokabular, das in der Tabelle darunter nicht steht.
    formatFilterLabel: statusKurzLabel,
  },
  {
    // Dieselbe Einstufung wie in der Listenansicht, dasselbe Bauteil
    // (`StufenBalken`) — „0.88" sagt niemandem, ob das viel ist; drei Striche
    // und „hoch" sagen es sofort. Der rohe Score ist deshalb nicht weg: er
    // steht im Titel der Zelle und bleibt der SORTIERWERT (`accessor`), damit
    // die Reihenfolge innerhalb einer Stufe fein bleibt statt zufällig.
    key: 'score', label: 'Relevanz', width: 90, defaultVisible: true,
    sortable: true, filterable: false, appliesTo: 'both',
    accessor: r => r.score,
    render: r => {
      const stufe = r.relevanzStufe ?? 1;
      return (
        <StufenBalken
          stufe={stufe}
          label={RELEVANZ_LABEL[stufe]}
          title={`Relevanz aus Fundstelle, Anzahl der Felder und Wort-Abdeckung — Score ${r.score.toFixed(2)}`}
        />
      );
    },
  },
  {
    key: 'antragsteller', label: 'AST', width: 180, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.antragsteller),
    render: r => r.antragsteller
      ? (
        <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.antragsteller}>
          <MarkierterText text={r.antragsteller} />
        </span>
      )
      : null,
  },
  {
    key: 'antragsdatum', label: 'Antragseingang', width: 150, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.antragsdatum),
    filterType: 'year',
    render: r => r.antragsdatum
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono">{r.antragsdatum}</span>
      : null,
  },
  {
    key: 'bewilligungsdatum', label: 'Bewilligungsdatum', width: 165, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.bewilligungsdatum),
    filterType: 'year',
    render: r => r.bewilligungsdatum
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono">{r.bewilligungsdatum}</span>
      : null,
  },
  {
    key: 'ortAst', label: 'Ort AST', width: 120, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.ortAst),
    render: r => r.ortAst
      ? (
        <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.ortAst}>
          <MarkierterText text={r.ortAst} />
        </span>
      )
      : null,
  },
  {
    // Der Text, in dem die Suche tatsächlich nachsieht (Ort AFS + Ort AST) —
    // NICHT die CSV-Spalte `ort_ast`. Die steht als „Ort AST" daneben und bleibt
    // die Quelle für Sortieren, Filtern und Export; hier geht es um den BELEG:
    // eine Zelle ohne das Suchwort behauptete eine Erklärung, die sie nicht
    // liefert (7,4 % der Sätze haben einen abweichenden Ausführungsort).
    key: 'standort', label: 'Ort', width: 175, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.standort),
    render: r => r.standort
      ? (
        <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.standort}>
          <MarkierterText text={r.standort} />
        </span>
      )
      : null,
  },
  {
    // Das Bundesland im Klartext — seit v4.81 ein eigenes Suchfeld (`bl:`) und
    // deshalb ein eigener Beleg. In der Ortsspalte war es bis dahin miterfasst
    // und machte deren Vorschlagsliste unbrauchbar: die 16 Ländernamen führen
    // jede Häufigkeitsliste an.
    key: 'bundesland', label: 'Bundesland', width: 150, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.bundesland),
    render: r => r.bundesland
      ? (
        <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.bundesland}>
          <MarkierterText text={r.bundesland} />
        </span>
      )
      : null,
  },
  {
    // Der Beleg für einen Kürzel-Treffer. Die Einrichtung heißt im Bestand
    // ausgeschrieben; wer „GMBU" tippt, findet sie über ihre Mail-Domain — und
    // ohne diese Spalte stünde in der Zeile kein einziges Zeichen der Anfrage.
    // Abgeleitet, nicht erhoben: deshalb kein Sortier-/Filter-Vertrag.
    key: 'domain', label: 'Web-Adresse', width: 150, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.domain),
    render: r => r.domain
      ? (
        <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.domain}>
          <MarkierterText text={r.domain} />
        </span>
      )
      : null,
  },
  {
    // Nicht filterbar: der Wert ist eine zusammengesetzte Kette
    // („lasertechnik • maschinenbau • …"), als Facette gäbe das tausende
    // Einzelwerte, von denen keiner zweimal vorkommt.
    //
    // Klein geschrieben, und das ist kein Anzeigefehler: `readAntragDeskriptoren`
    // normalisiert die Werte fürs Zusammenführen (TECHN-Spalten + ZT-Klartexte),
    // und genau diese Form durchsucht die Suche. Das Auslastungs-Modul zeigt sie
    // seit jeher genauso (`TechnologieTags` im DetailPanel) — sie hier
    // aufzuhübschen hieße, einen anderen Text zu zeigen als den getroffenen.
    key: 'deskriptoren', label: 'Deskriptoren', width: 240, defaultVisible: false,
    sortable: true, filterable: false, appliesTo: 'antrag', wrap: true,
    accessor: r => safeString(r.deskriptoren),
    render: r => r.deskriptoren
      ? (
        <span className="text-[12px] text-[var(--tf-text-secondary)] whitespace-normal">
          <MarkierterText text={r.deskriptoren} />
        </span>
      )
      : null,
  },
  {
    // Netzwerkname UND Netz-Kennzeichen, roh wie im Export
    // („LOHCmobil" 16KN065602_AM). Das Kennzeichen ist der Grund, warum die
    // Spalte einen Filter trägt: es ist der einzige Weg, alle Teilvorhaben
    // EINES Netzwerks beisammen zu sehen.
    key: 'netzwerk', label: 'Netzwerk', width: 190, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.netzwerk),
    render: r => r.netzwerk
      ? (
        <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.netzwerk}>
          {/* `alsName`: der Wert ist EIN Name, also markiert `nafatech` auch
              „NAFA-Tech". Die anderen Spalten dürfen das nicht — sie zeigen
              Fließtext oder gleich mehrere Felder in einer Zeichenkette. */}
          <MarkierterText text={r.netzwerk} alsName />
        </span>
      )
      : null,
  },
  {
    // Der Wahlkreis der ausführenden Stelle. Steht neben „Ort & Bundesland",
    // weil er dieselbe Frage beantwortet — und weil er sie in 5 274 von 14 218
    // Fällen mit einem Ortsnamen beantwortet, der in der Ortsspalte fehlt.
    key: 'wahlkreis', label: 'Wahlkreis', width: 185, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.wahlkreis),
    render: r => r.wahlkreis
      ? (
        <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.wahlkreis}>
          <MarkierterText text={r.wahlkreis} />
        </span>
      )
      : null,
  },
  {
    // Die Arbeitsnotizen am Vorgang („Wichtig" + „Bemerkung"). Umbrechend wie
    // die Deskriptoren: es sind ganze Sätze, gekürzt wären sie oft genau um die
    // Stelle gekürzt, die getroffen hat. Nicht filterbar — jeder Wert ist
    // einmalig, eine Facette daraus hätte so viele Einträge wie Zeilen.
    key: 'notiz', label: 'Notiz', width: 260, defaultVisible: false,
    sortable: true, filterable: false, appliesTo: 'antrag', wrap: true,
    accessor: r => safeString(r.notiz),
    render: r => r.notiz
      ? (
        <span className="text-[12px] text-[var(--tf-text-secondary)] whitespace-normal">
          <MarkierterText text={r.notiz} />
        </span>
      )
      : null,
  },
  {
    // Die Tabellen-Entsprechung zur Marke „in der Antwort" in der Liste. Sie
    // wird von der Suchseite automatisch eingeblendet, sobald eine Antwort
    // Vorhaben nennt (`autoSpalten` in SuchSeite.tsx) — eine Zeile MIT Inhalt
    // ist genau eine genannte Zeile, eine zweite Marken-Spalte braucht es
    // deshalb nicht. Nicht filterbar: der Chip „nur die genannten" tut das
    // bereits und zählt dabei mit.
    key: 'kiAntwort', label: 'KI-Antwort', width: 300, defaultVisible: false,
    sortable: false, filterable: false, appliesTo: 'antrag', wrap: true,
    // Der GANZE Satz, nicht die Kurzform: Export und Zwischenablage sollen
    // tragen, was die KI gesagt hat, nicht was in die Spalte passte.
    accessor: r => antwortSatzFuer(r.fkz),
    render: r => <KiAntwortZelle fkz={r.fkz} />,
  },
  {
    key: 'laufzeitbeginn', label: 'Laufzeitbeginn', width: 150, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.laufzeitbeginn),
    filterType: 'year',
    render: r => r.laufzeitbeginn
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono">{r.laufzeitbeginn}</span>
      : null,
  },
  {
    key: 'laufzeitende', label: 'Laufzeitende', width: 140, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.laufzeitende),
    filterType: 'year',
    render: r => r.laufzeitende
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono">{r.laufzeitende}</span>
      : null,
  },
  {
    key: 'zuwendung', label: 'Zuwendung', width: 120, defaultVisible: false,
    sortable: true, filterable: false, appliesTo: 'antrag',
    accessor: r => typeof r.zuwendung === 'number' ? r.zuwendung : 0,
    render: r => typeof r.zuwendung === 'number'
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono block text-right">{formatEur(r.zuwendung)}</span>
      : null,
  },
  {
    key: 'dokumentTyp', label: 'Dokumenttyp', width: 140, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'dokument',
    accessor: r => safeString(r.dokumentTyp),
    render: r => r.dokumentTyp
      ? <Badge variant="default">{r.dokumentTyp}</Badge>
      : null,
  },
  {
    key: 'method', label: 'Suche', width: 170, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'both',
    accessor: r => safeString(r.method),
    render: r => <MethodPill method={r.method} />,
    formatFilterLabel: v => METHOD_LABELS[v] ?? v,
  },
];

export const DEFAULT_VISIBLE_COLUMN_KEYS: string[] =
  SEARCH_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);

export const LOCKED_COLUMN_KEYS: string[] =
  SEARCH_COLUMNS.filter(c => c.locked).map(c => c.key);

export function getColumnByKey(key: string): SearchColumn | undefined {
  return SEARCH_COLUMNS.find(c => c.key === key);
}

// ---------- Begründung-Spalte (KI-Analyse) ----------------------------------

/** Schlüssel der KI-Begründung-Spalte. Wird NICHT über den Spalten-Picker
 *  getoggelt, sondern von SuchSeite nur dann an `visibleColumnDefs` angehängt,
 *  wenn eine KI-Analyse lief. */
export const BEGRUENDUNG_COLUMN_KEY = 'begruendung';

/** Die EINE zusätzliche Spalte nach „Mit KI analysieren": per-Treffer-
 *  Begründung, warum der Treffer für die Anfrage relevant ist. Liest aus
 *  `r.begruendung` (Overlay über die bestehenden Treffer). */
export const BEGRUENDUNG_COLUMN: SearchColumn = {
  key: BEGRUENDUNG_COLUMN_KEY,
  label: 'Begründung',
  width: 340,
  defaultVisible: false,
  sortable: false,
  filterable: false,
  appliesTo: 'both',
  wrap: true,
  accessor: r => safeString(r.begruendung),
  render: r => r.begruendung
    ? <span className="text-[12px] text-[var(--tf-text)] whitespace-normal" title={r.begruendung}>{r.begruendung}</span>
    : <span className="text-[12px] text-[var(--tf-text-tertiary)]">…</span>,
};

/**
 * Die Zelle der Spalte „KI-Antwort".
 *
 * Eine eigene Komponente, weil `render` keinen Hook aufrufen darf: der Kontext
 * wird hier gelesen, nicht in der Spalten-Definition. Kurzform in der Zelle,
 * ganzer Satz im `title` — dieselbe Aufteilung wie in der Trefferliste, damit
 * beide Ansichten dasselbe versprechen.
 */
function KiAntwortZelle({ fkz }: { fkz: string | undefined }): React.ReactElement | null {
  const beleg = useAntwortBeleg(fkz);
  if (beleg === undefined) return null;
  return (
    <span
      className="flex items-start gap-1 text-[12px] italic text-[var(--tf-text-secondary)] whitespace-normal"
      title={beleg.satz}
    >
      <Sparkles size={10} aria-hidden className="mt-[3px] shrink-0" style={{ color: 'var(--tf-primary)' }} />
      <span>{beleg.kurz}</span>
    </span>
  );
}
