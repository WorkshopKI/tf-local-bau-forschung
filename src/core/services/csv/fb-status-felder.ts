/**
 * Auflösung + Berechnung des „FB-Status" aus mehreren Legacy-Datums-Spalten.
 *
 * Hintergrund: Im Legacy-System setzt ein FB („Förderberater") je nach Vorgang
 * eines von mehreren Status-Datumsfeldern. Die Förderanträge-Tabelle zeigt
 * dafür eine einblendbare Spalte „FB Status": pro Antrag wird geprüft, welche
 * der `FB_STATUS_CODES`-Spalten ein gültiges Datum trägt; die mit dem JÜNGSTEN
 * Datum gewinnt — ihr (lesbares) Label wird als Badge angezeigt, das Datum im
 * Tooltip.
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
 */
import { resolveFieldKey } from './merger/helpers';
import { parseGermanDate } from './dateParse';
import type { CsvSchema } from './types';

/**
 * Quell-Spalten-Codes (CSV-Header), in Prioritäts-Reihenfolge: bei gleichem
 * Datum gewinnt der zuerst gelistete Code (Tie-Break). Append-only erweitern.
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

export interface FbStatusFeld {
  /** Antrag-Feld-Key, unter dem die Spalte landet (aus dem Schema aufgelöst). */
  feld: string;
  /** Roher CSV-Spalten-Code (z.B. `D_ABLT`). */
  code: string;
  /** Anzeige-Label für den Badge (Schema-Label, Fallback: Code). */
  label: string;
}

/**
 * Normalisierung für den Spalten-Code-Vergleich: NFC (wegen `D_ÄT`, Pitfall #22)
 * + lower + ohne `_`/`-`/Space. Das `+` bleibt erhalten, `-` wird gestrippt ⇒
 * `D_XPC+` (`dxpc+`) und `D_XPC-` (`dxpc`) kollidieren NICHT.
 */
const normCode = (s: string): string => s.normalize('NFC').toLowerCase().replace(/[\s_-]/g, '');

/**
 * Löst die `FB_STATUS_CODES` gegen die Programm-Schemas auf (Master zuerst).
 * Liefert nur tatsächlich gemappte Spalten (in Code-Reihenfolge); nicht
 * gemappte Codes fehlen schlicht → werden bei der Berechnung ignoriert.
 */
export function resolveFbStatusFelder(schemas: readonly CsvSchema[]): FbStatusFeld[] {
  const ordered = [...schemas].sort((a, b) => (b.is_master ? 1 : 0) - (a.is_master ? 1 : 0));
  const out: FbStatusFeld[] = [];
  for (const code of FB_STATUS_CODES) {
    const target = normCode(code);
    let found: FbStatusFeld | null = null;
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
 * Liefert `{ label, datum: ISO }` oder `null`, wenn kein Feld ein gültiges
 * Datum trägt.
 */
export function computeFbStatus(
  record: Record<string, unknown>,
  felder: readonly FbStatusFeld[],
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
