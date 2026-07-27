/**
 * Auflösung + Berechnung von „Datums-Status-Spalten" — generisch über mehrere
 * Spalten-Gruppen (z.B. „FB Status", „PreCheck Status").
 *
 * Hintergrund: Im Legacy-System tragen mehrere Datums-Spalten den Stand eines
 * Vorgangs. Die Förderanträge-Tabelle zeigt dafür einblendbare Spalten: pro
 * Antrag wird je Gruppe geprüft, welche der `codes`-Spalten ein gültiges Datum
 * trägt; die mit dem JÜNGSTEN Datum gewinnt — ihr (lesbares) Label wird als
 * Badge angezeigt, das Datum im Tooltip.
 *
 * Die Spalten sind NICHT kanonisch und mapping-abhängig: je nach CSV-Mapping
 * landen sie unter einem Custom-Key. Statt das Antrag-Feld fest zu verdrahten,
 * lösen wir es — wie `resolveVollstaendigkeitsFelder` (Auslastung) — über die
 * Schema-`column_mapping` anhand des Spalten-CODES auf (Lehre aus v2.40,
 * recurring-bug-classes #5). Das Badge-Label kommt aus `ColumnMappingEntry.label`
 * (Label-XLS), Fallback = roher Spalten-Code.
 *
 * Reines Modul (keine IDB-/I/O-Zugriffe) — testbar ohne React/IDB. Die Schemas
 * laden die Aufrufer (Projektion/Merge) selbst pro Programm.
 *
 * Neue Gruppe hinzufügen: einen Eintrag in `STATUS_DATUM_GRUPPEN` + die beiden
 * Slim-Felder (`<id>_status_label`/`_datum`) in `AntragListItem` + `LIST_VIEW_FIELDS`
 * + eine `statusDatumColumn(...)` in `tableColumns.tsx` ergänzen und
 * `LIST_VIEW_PROJECTION_VERSION` bumpen.
 */
import { resolveFieldKey } from './merger/helpers';
import { parseGermanDate } from './dateParse';
import type { CsvSchema } from './types';

/**
 * FB-Status-Quell-Spalten (CSV-Header), in Prioritäts-Reihenfolge: bei gleichem
 * Datum gewinnt der zuerst gelistete Code (Tie-Break).
 */
export const FB_STATUS_CODES: readonly string[] = [
  'D_XPC+',
  'D_XPC-',
  'D_ALS',
  'D_ALU',
  'D_XALF',
  'D_AT4',
  'D_XKS',
  'D_ART',
  'D_ABLT',
  'D_ÄT',
  'D_ZBT',
];

/** PreCheck-Status-Quell-Spalten (CSV-Header), Reihenfolge = Tie-Break. */
export const PRECHECK_STATUS_CODES: readonly string[] = [
  'D_PC+',
  'D_PC?',
  'D_PC-',
  'D_XPC+',
  'D_XPC?',
  'D_XPC-',
  'D_PCQ',
  'D_PCAN',
  'D_PCAL',
];

export interface StatusDatumFeld {
  /** Antrag-Feld-Key, unter dem die Spalte landet (aus dem Schema aufgelöst). */
  feld: string;
  /** Roher CSV-Spalten-Code (z.B. `D_ABLT`). */
  code: string;
  /** Anzeige-Label für den Badge (Schema-Label, Fallback: Code). */
  label: string;
}

/**
 * Normalisierung für den Spalten-Code-Vergleich: NFC (wegen `D_ÄT`, Pitfall #22)
 * + lower + ohne `_`/`-`/Space. `+` und `?` bleiben erhalten, `-` wird gestrippt
 * ⇒ `D_PC+`/`D_PC?`/`D_PC-` (bzw. `D_XPC+`/`D_XPC?`/`D_XPC-`) kollidieren NICHT.
 *
 * Exportiert, weil der Status-Katalog seine Code-Felder nach derselben Regel
 * auflöst (`status/feld-aufloesung.ts`) — zwei Normalisierungen würden
 * auseinanderlaufen, sobald jemand eine davon anfasst.
 */
export const normCode = (s: string): string => s.normalize('NFC').toLowerCase().replace(/[\s_-]/g, '');

/**
 * Löst eine Liste von Spalten-`codes` gegen die Programm-Schemas auf (Master
 * zuerst). Liefert nur tatsächlich gemappte Spalten (in `codes`-Reihenfolge);
 * nicht gemappte Codes fehlen schlicht → werden bei der Berechnung ignoriert.
 */
export function resolveStatusDatumFelder(
  schemas: readonly CsvSchema[],
  codes: readonly string[],
): StatusDatumFeld[] {
  const ordered = [...schemas].sort((a, b) => (b.is_master ? 1 : 0) - (a.is_master ? 1 : 0));
  const out: StatusDatumFeld[] = [];
  for (const code of codes) {
    const target = normCode(code);
    let found: StatusDatumFeld | null = null;
    for (const sc of ordered) {
      const cm = sc.column_mapping ?? {};
      for (const col of Object.keys(cm)) {
        const entry = cm[col];
        if (!entry || entry.ignore) continue;
        if (normCode(col) !== target) continue;
        const feld = resolveFieldKey(col, entry);
        if (!feld) continue;
        const label = entry.label?.trim() ? entry.label.trim() : code;
        found = { feld, code, label };
        break;
      }
      if (found) break;
    }
    if (found) out.push(found);
  }
  return out;
}

/**
 * Ermittelt aus einem Record das jüngste gültige Datum über die aufgelösten
 * `felder`. „Gültig" = von `parseGermanDate` (DD.MM.YYYY oder ISO) als Datum
 * erkannt. Bei Gleichstand gewinnt der früher gelistete Code (`>`-Vergleich).
 * Liefert `{ label, datum: ISO }` oder `null`.
 */
export function computeStatusDatum(
  record: Record<string, unknown>,
  felder: readonly StatusDatumFeld[],
): { label: string; datum: string } | null {
  let best: { label: string; datum: string } | null = null;
  let bestMs = -Infinity;
  for (const f of felder) {
    const raw = record[f.feld];
    if (typeof raw !== 'string') continue;
    const iso = parseGermanDate(raw);
    if (!iso) continue;
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = { label: f.label, datum: iso };
    }
  }
  return best;
}

export interface StatusDatumGruppe {
  /** Technische Gruppen-ID (auch Spalten-Key-Präfix). */
  id: string;
  /** Quell-Spalten-Codes der Gruppe (Reihenfolge = Tie-Break). */
  codes: readonly string[];
  /** Slim-Feld-Key für das Badge-Label in `AntragListItem`. */
  labelKey: 'fb_status_label' | 'precheck_status_label';
  /** Slim-Feld-Key für das ISO-Datum in `AntragListItem`. */
  datumKey: 'fb_status_datum' | 'precheck_status_datum';
}

/**
 * Registry aller Datums-Status-Gruppen. Jede Gruppe wird bei der List-View-
 * Projektion in ihre beiden Slim-Felder berechnet und bekommt eine Tabellen-
 * Spalte (siehe `tableColumns.tsx`).
 */
export const STATUS_DATUM_GRUPPEN: readonly StatusDatumGruppe[] = [
  { id: 'fb', codes: FB_STATUS_CODES, labelKey: 'fb_status_label', datumKey: 'fb_status_datum' },
  { id: 'precheck', codes: PRECHECK_STATUS_CODES, labelKey: 'precheck_status_label', datumKey: 'precheck_status_datum' },
];

export interface ResolvedStatusDatumGruppe {
  labelKey: StatusDatumGruppe['labelKey'];
  datumKey: StatusDatumGruppe['datumKey'];
  felder: StatusDatumFeld[];
}

/**
 * Dieselbe Mechanik, aber für die **kuratierten Ordner** des Statuskatalogs
 * statt für die zwei fest verdrahteten Gruppen oben: je Ordner das jüngste
 * gültige Datum seiner Felder.
 *
 * Der Typ wohnt hier, damit `list-view.ts` ihn konsumieren kann, ohne den
 * Status-Katalog zu importieren — gebaut wird er in
 * `status/kategorie-projektion.ts`, wo der Katalog zu Hause ist.
 */
export interface ResolvedKategorieSpalten {
  kategorieId: string;
  /** Anzeigename des Ordners (Spaltenkopf in der Fördertabelle). */
  label: string;
  felder: StatusDatumFeld[];
}

/**
 * Löst ALLE Gruppen gegen die Programm-Schemas auf — einmal pro Programm, dann
 * je Record über `computeStatusDatum` in `toAntragListItem` angewandt.
 */
export function resolveStatusDatumGruppen(schemas: readonly CsvSchema[]): ResolvedStatusDatumGruppe[] {
  return STATUS_DATUM_GRUPPEN.map(g => ({
    labelKey: g.labelKey,
    datumKey: g.datumKey,
    felder: resolveStatusDatumFelder(schemas, g.codes),
  }));
}
