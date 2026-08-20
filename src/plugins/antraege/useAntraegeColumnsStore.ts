/**
 * Sichtbare Spalten der Förderanträge-Tabellen-Ansicht ("compact"-View-Mode).
 *
 * Eigener Zustand-Store (kein direktes `useColumnVisibility`), damit der
 * "Spalten"-Picker und die Tabelle denselben State reaktiv teilen. Beide
 * sitzen seit der UI-Verlagerung in `AntraegeTable` (Picker direkt über der
 * Tabelle); der globale Store bleibt, weil andere Stellen (z.B. Export)
 * dieselbe Sichtbarkeit lesen könnten und zwei Hook-Instanzen nur über
 * Reload syncen würden.
 *
 * Persistenz: localStorage `teamflow_antraege_table_columns` (JSON-Array von
 * Spalten-Keys). Locked-Spalten werden bei Load + Toggle erzwungen. Muster
 * 1:1 aus `src/plugins/suche/store.ts`.
 */
import { create } from 'zustand';
import { useKopfFilter } from './kopfFilter';
import {
  ANTRAG_TABLE_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  KATEGORIE_COLUMN_PREFIX,
  LOCKED_COLUMN_KEYS,
} from './tableColumns';
import { FREIE_SPALTE_PREFIX } from '@/core/spalten';

const VISIBLE_COLUMNS_KEY = 'teamflow_antraege_table_columns';
const STATISCHE_KEYS: ReadonlySet<string> = new Set(ANTRAG_TABLE_COLUMNS.map(c => c.key));

/**
 * Nachträglich in den Standard gewanderte Spalten.
 *
 * Eine gespeicherte Auswahl schlägt den Code-Default: wer die Tabelle schon
 * einmal benutzt hat, hat eine Liste im localStorage und bekäme eine neue
 * `defaultVisible: true`-Spalte NIE zu sehen. Deshalb wird sie einmalig
 * nachgereicht, festgehalten über eine Revisionsnummer. Wer sie danach
 * abwählt, behält das — die Revision ist dann bereits fortgeschrieben.
 *
 * Kein Key-Bump: der würde die gesamte persönliche Spaltenwahl verwerfen.
 */
const SPALTEN_REV_KEY = 'teamflow_antraege_table_columns_rev';
const NACHZUEGLER: readonly { rev: number; keys: readonly string[] }[] = [
  // v3.3 — das AB-Kürzel (BIB) gehört ab Werk neben das FB-Kürzel.
  { rev: 1, keys: ['bib_kuerz'] },
];

/**
 * Zusammengelegte Spalten: mehrere alte Keys werden zu einem neuen.
 *
 * Braucht eine eigene Liste, weil `NACHZUEGLER` nur ANHÄNGT. Ohne sie bekäme
 * ein Bestandsnutzer die neue Spalte zusätzlich zu ihren Einzelteilen — FKZ
 * stünde zweimal in derselben Zeile, und niemand würde vermuten, dass man dafür
 * zwei Häkchen im Picker wegnehmen muss.
 *
 * Die Ersetzung sitzt an der POSITION des ersten Treffers, damit die persönliche
 * Spaltenreihenfolge erhalten bleibt.
 */
const ZUSAMMENGELEGT: readonly { rev: number; alt: readonly string[]; neu: string }[] = [
  // v4.63 — Akronym und FKZ sind eine Identitätsspalte „Antrag".
  { rev: 2, alt: ['aktenzeichen', 'akronym'], neu: 'antrag' },
];

const AKTUELLE_REV: number = Math.max(
  NACHZUEGLER.reduce((max, n) => Math.max(max, n.rev), 0),
  ZUSAMMENGELEGT.reduce((max, z) => Math.max(max, z.rev), 0),
);

/**
 * Rein: wendet die seit `gespeicherteRev` fälligen Zusammenlegungen an, hängt
 * danach die neu hinzugekommenen Standardspalten an (ohne Duplikate,
 * Reihenfolge der übrigen bleibt) und meldet die neue Revision.
 */
export function reicheNeueStandardspaltenNach(
  gespeichert: readonly string[],
  gespeicherteRev: number,
): { keys: string[]; rev: number } {
  let keys = [...gespeichert];
  for (const z of ZUSAMMENGELEGT) {
    if (z.rev <= gespeicherteRev) continue;
    const ersteStelle = keys.findIndex(k => z.alt.includes(k));
    if (ersteStelle < 0) continue;
    keys = keys.filter(k => !z.alt.includes(k));
    // Der neue Key darf nicht doppelt landen, falls er (etwa aus einem Profil)
    // schon dasteht.
    if (!keys.includes(z.neu)) keys.splice(ersteStelle, 0, z.neu);
  }
  for (const n of NACHZUEGLER) {
    if (n.rev <= gespeicherteRev) continue;
    for (const k of n.keys) if (!keys.includes(k)) keys.push(k);
  }
  return { keys, rev: Math.max(gespeicherteRev, AKTUELLE_REV) };
}

function loadRev(): number {
  try {
    const n = Number(localStorage.getItem(SPALTEN_REV_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}

function saveRev(rev: number): void {
  try { localStorage.setItem(SPALTEN_REV_KEY, String(rev)); } catch { /* ignore */ }
}

/**
 * Gültig sind die festen Spalten, die Ordner-Spalten des Statuskatalogs UND die
 * selbst angelegten.
 *
 * Die beiden letzteren sind nicht im Code aufzählbar — welche es gibt,
 * entscheiden Kuration bzw. Nutzer. Eine feste Schlüsselliste filtert sie beim
 * Laden heraus, und die Auswahl ist nach jedem Reload weg: genau so verhielt
 * sich die erste Fassung der eigenen Spalten (angelegt, eingeblendet, nach dem
 * Neuladen verschwunden), weil hier ein Präfix fehlte.
 */
function istGueltigerKey(key: string): boolean {
  return STATISCHE_KEYS.has(key)
    || key.startsWith(KATEGORIE_COLUMN_PREFIX)
    || key.startsWith(FREIE_SPALTE_PREFIX);
}

function loadVisibleColumns(): string[] {
  try {
    const raw = localStorage.getItem(VISIBLE_COLUMNS_KEY);
    // Noch nie etwas gewählt → Defaults. Die Revision wird trotzdem gestempelt:
    // sonst bekäme ein Nutzer, der eine dieser Spalten gleich wieder abwählt,
    // sie beim nächsten Start wieder untergeschoben.
    if (!raw) { saveRev(AKTUELLE_REV); return [...DEFAULT_VISIBLE_COLUMN_KEYS]; }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) { saveRev(AKTUELLE_REV); return [...DEFAULT_VISIBLE_COLUMN_KEYS]; }
    const gefiltert = parsed.filter((k): k is string => typeof k === 'string' && istGueltigerKey(k));
    const vorherigeRev = loadRev();
    const { keys, rev } = reicheNeueStandardspaltenNach(gefiltert, vorherigeRev);
    for (const lockedKey of LOCKED_COLUMN_KEYS) {
      if (!keys.includes(lockedKey)) keys.push(lockedKey);
    }
    if (rev !== vorherigeRev) {
      saveVisibleColumns(keys);
      saveRev(rev);
    }
    return keys;
  } catch {
    return [...DEFAULT_VISIBLE_COLUMN_KEYS];
  }
}

function saveVisibleColumns(keys: string[]): void {
  try { localStorage.setItem(VISIBLE_COLUMNS_KEY, JSON.stringify(keys)); } catch { /* ignore */ }
}

interface AntraegeColumnsState {
  visibleColumns: string[];
  setVisibleColumns: (keys: string[]) => void;
  toggleColumn: (key: string) => void;
}

export const useAntraegeColumnsStore = create<AntraegeColumnsState>((set, get) => ({
  visibleColumns: loadVisibleColumns(),
  setVisibleColumns: (keys: string[]) => {
    const next = [...keys];
    for (const lockedKey of LOCKED_COLUMN_KEYS) {
      if (!next.includes(lockedKey)) next.push(lockedKey);
    }
    saveVisibleColumns(next);
    set({ visibleColumns: next });
  },
  toggleColumn: (key: string) => {
    if (LOCKED_COLUMN_KEYS.includes(key)) return;
    const current = get().visibleColumns;
    const ausblenden = current.includes(key);
    const next = ausblenden
      ? current.filter(k => k !== key)
      : [...current, key];
    saveVisibleColumns(next);
    set({ visibleColumns: next });
    // Wer eine Spalte AUSBLENDET, verliert ihren Kopf-Trichter mit. Er wirkte
    // ohnehin nicht (`applyColumnFilters` überspringt unbekannte Spalten), blieb
    // aber gespeichert — und sprang beim erneuten Einblenden zurück, ohne dass
    // ihn jemand gesetzt hätte: eine stille Einschränkung ohne Chip (v4.124).
    // NUR beim Ausblenden per Hand; `setVisibleColumns` (Reiter anwenden) bleibt
    // unangetastet, dort folgt `setzeStand` mit dem gemerkten Trichter.
    if (ausblenden) useKopfFilter.getState().setzeSpalte(key, new Set());
  },
}));
