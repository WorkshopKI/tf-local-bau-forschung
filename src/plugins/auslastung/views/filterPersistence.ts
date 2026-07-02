/**
 * Filter-Persistenz des Auslastungs-Moduls — hält die gesetzten Filter-Segmente
 * pro Tab in localStorage, damit sie eine Session überleben und beim nächsten
 * Aufruf der Seite wieder angewandt werden (Screen 1a „Anträge klassifizieren",
 * Screen 1b „Anträge zuweisen", „Auslastung MA").
 *
 * Reine UI-Preference (laut CLAUDE.md in localStorage erlaubt), origin-weit wie
 * SPLIT_STORAGE_KEY — bewusst KEIN Varianten-Suffix.
 *
 * Bewusst NICHT persistiert: der Auf-/Zuklapp-Zustand der Segmente
 * (`manualClosed`/`forceOpen` in CollapsibleSeg). Er wird beim Reload
 * zurückgesetzt, sodass ein vom Standard abweichendes Segment beim nächsten
 * Aufruf automatisch aufklappt („hier ist gefiltert"). Einzige Ausnahme bleibt
 * das „Sortiert nach"-Segment (`startCollapsed` in FilterToolbar) — es wird
 * persistiert & angewandt, klappt aber nicht auf (die eingeklappte Pille zeigt
 * den aktiven Sortierwert ohnehin an, eine Sortierung blendet keine Daten aus).
 */
import { ALL_ANTRAGSTYP_BUCKETS, type AntragstypBucket } from '../types';
import type { StatusFilter } from './cockpit-helpers';
import {
  SORT_CHIP_DISPLAY,
  DEFAULT_ZUWEISUNG_SORT,
  type ZuweisungSortKey,
} from '../services/matching';

/** Status-/Sicht-Filter der Klassifizierungs-Review (Screen 1a). Single Source
 *  of Truth — `KlassifizierungsReview` importiert den Typ von hier. */
export type ViewFilter = 'alle' | 'review' | 'llm' | 'freigegeben' | 'unvollstaendig';

// ─── interne safe Helfer ────────────────────────────────────────────────
/** Liest ein JSON-Objekt aus localStorage. Fehlt es / ist es kaputt → null. */
function readJson(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Persistiert ein Objekt best-effort (localStorage kann fehlen/voll sein). */
function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage nicht verfügbar — Filter bleiben nur für die Session */
  }
}

/** Gibt `v` nur zurück, wenn es einer der erlaubten Werte ist, sonst `fallback`. */
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Antragstyp-Bucket oder '' (= Alle). Überall gleiche Semantik. */
function readAntragstyp(v: unknown): AntragstypBucket | '' {
  return typeof v === 'string' && (ALL_ANTRAGSTYP_BUCKETS as readonly string[]).includes(v)
    ? (v as AntragstypBucket)
    : '';
}

/** Kategorie: beliebige ID als String (Existenz wird erst zur Laufzeit gegen
 *  `config.ueberKategorien` reconciled), sonst '' (= Alle). */
function readKategorie(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readSort(v: unknown): ZuweisungSortKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SORT_CHIP_DISPLAY, v)
    ? (v as ZuweisungSortKey)
    : DEFAULT_ZUWEISUNG_SORT;
}

const STATUS_VALUES: readonly StatusFilter[] = ['offen', 'selbst', 'zugewiesen', 'alle'];
const VIEW_FILTER_VALUES: readonly ViewFilter[] = [
  'alle', 'review', 'llm', 'freigegeben', 'unvollstaendig',
];

// ─── Anträge zuweisen (Screen 1b) ───────────────────────────────────────
const ZUWEISUNG_KEY = 'tf-auslastung-zuweisung-filters';

export interface ZuweisungFilterState {
  kategorie: string;
  antragstyp: AntragstypBucket | '';
  status: StatusFilter;
  sort: ZuweisungSortKey;
}

export function readZuweisungFilters(): ZuweisungFilterState {
  const o = readJson(ZUWEISUNG_KEY);
  return {
    kategorie: readKategorie(o?.kategorie),
    antragstyp: readAntragstyp(o?.antragstyp),
    status: oneOf(o?.status, STATUS_VALUES, 'offen'),
    sort: readSort(o?.sort),
  };
}

export function persistZuweisungFilters(s: ZuweisungFilterState): void {
  writeJson(ZUWEISUNG_KEY, s);
}

// ─── Anträge klassifizieren (Screen 1a) ─────────────────────────────────
const KLASSIFIZIERUNG_KEY = 'tf-auslastung-klassifizierung-filters';

export interface KlassifizierungFilterState {
  filter: ViewFilter;
  kategorie: string;
  antragstyp: AntragstypBucket | '';
}

export function readKlassifizierungFilters(): KlassifizierungFilterState {
  const o = readJson(KLASSIFIZIERUNG_KEY);
  return {
    filter: oneOf(o?.filter, VIEW_FILTER_VALUES, 'alle'),
    kategorie: readKategorie(o?.kategorie),
    antragstyp: readAntragstyp(o?.antragstyp),
  };
}

export function persistKlassifizierungFilters(s: KlassifizierungFilterState): void {
  writeJson(KLASSIFIZIERUNG_KEY, s);
}

// ─── Auslastung MA (MA-Liste) ───────────────────────────────────────────
const MALISTE_KEY = 'tf-auslastung-maliste-filters';

export interface MaListeFilterState {
  kategorie: string;
  antragstyp: AntragstypBucket | '';
  showInactive: boolean;
}

export function readMaListeFilters(): MaListeFilterState {
  const o = readJson(MALISTE_KEY);
  return {
    kategorie: readKategorie(o?.kategorie),
    antragstyp: readAntragstyp(o?.antragstyp),
    showInactive: o?.showInactive === true,
  };
}

export function persistMaListeFilters(s: MaListeFilterState): void {
  writeJson(MALISTE_KEY, s);
}
