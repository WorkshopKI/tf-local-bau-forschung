/**
 * Persistenz + reine Config-Logik der Home-Widgets.
 *
 * STRIKT persönliche Darstellungs-Config: IDB primär (kv-Key), optional
 * gespiegelt in PersonalEinstellungen (persönliches Laufwerk via
 * savePersonalSettings — der sanktionierte Mirror-Pfad). NIE auf dem geteilten
 * Daten-Share, NIE in registry.json, NIE im SMB-Snapshot — der kv-Store steht
 * in KEINER Snapshot-Allowlist (SNAPSHOT_FILES, snapshot.ts). Guard:
 * `home-widgets-local-only` (src/__tests__/codebase-conventions.test.ts).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { getPersoenlichHandle } from '@/core/services/infrastructure';
import { savePersonalSettings } from '@/core/services/personal-storage/service';
import { isNewer } from '@/core/services/personal-storage/sync';
import {
  PERSONAL_EINSTELLUNGEN_IDB_KEY,
  type PersonalEinstellungen,
} from '@/core/services/personal-storage/types';
import type { HomeWidgetConfig, WidgetInstanz, WidgetTyp } from './types';
import { WIDGET_KATALOG, type WidgetKatalogEintrag } from './widgetCatalog';

/** IDB-Key (kv-Store) — primäre Quelle der Widget-Config. */
export const HOME_WIDGETS_IDB_KEY = 'home-widgets-config';

/** Alter localStorage-Key des Meine-Anträge-Collapse (useCollapsedSection) —
 *  wird beim Erst-Anlegen der Config EINMALIG als Seed gelesen (Zustands-Erhalt),
 *  danach ist die Widget-Config die einzige Collapse-Quelle. */
export const MEINE_ANTRAEGE_COLLAPSE_LEGACY_KEY = 'home_meine_antraege_collapsed';

const BEREICHE = new Set(['haupt', 'seite']);

/**
 * Default-Config = die HEUTIGE Homepage exakt (Weitermachen + Meine Anträge in
 * der Hauptspalte; Ampel + AI-Assistent in der Seitenspalte). Kanban und
 * Notizen sind als Opt-in angelegt (`sichtbar: false`). `updatedAt` ist Epoche,
 * damit jeder echte Save die Defaults per LWW gewinnt (analog
 * DEFAULT_EINSTELLUNGEN).
 */
export function defaultHomeWidgetConfig(
  opts?: { meineAntraegeEingeklappt?: boolean },
): HomeWidgetConfig {
  const instanz = (
    id: string,
    typ: WidgetTyp,
    position: number,
    sichtbar: boolean,
    eingeklappt = false,
  ): WidgetInstanz => ({
    id,
    typ,
    position,
    bereich: WIDGET_KATALOG[typ].bereich,
    sichtbar,
    eingeklappt,
    config: WIDGET_KATALOG[typ].defaultConfig(),
  });
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    widgets: [
      instanz('w-weitermachen', 'weitermachen', 0, true),
      instanz('w-meine-antraege', 'meine-antraege', 1, true, opts?.meineAntraegeEingeklappt ?? false),
      instanz('w-kanban', 'kanban', 2, false),
      instanz('w-antragseingang', 'antragseingang', 3, true),
      instanz('w-ai-assistent', 'ai-assistent', 4, true),
      instanz('w-notizen', 'notizen', 5, false),
    ],
  };
}

function isWidgetInstanz(v: unknown): v is WidgetInstanz {
  if (!v || typeof v !== 'object') return false;
  const w = v as Record<string, unknown>;
  return typeof w.id === 'string'
    && typeof w.typ === 'string'
    && typeof w.position === 'number'
    && typeof w.bereich === 'string' && BEREICHE.has(w.bereich)
    && typeof w.sichtbar === 'boolean'
    && typeof w.eingeklappt === 'boolean'
    && !!w.config && typeof w.config === 'object';
}

/**
 * Toleranter Read (analog arbeitskontext-log): kaputte/fremde Werte → null
 * (Aufrufer fällt auf Default). Der `version`-Switch ist der
 * Migrations-Einstieg — heute existiert nur v1; unbekannte Versionen werden
 * bewusst NICHT geraten.
 */
export function leseHomeWidgetConfig(raw: unknown): HomeWidgetConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const cfg = raw as Record<string, unknown>;
  switch (cfg.version) {
    case 1:
      break;
    default:
      return null;
  }
  if (typeof cfg.updatedAt !== 'string' || !Array.isArray(cfg.widgets)) return null;
  return {
    version: 1,
    updatedAt: cfg.updatedAt,
    widgets: cfg.widgets.filter(isWidgetInstanz),
  };
}

/** Einmaliger Seed des alten Collapse-Zustands ('1' = eingeklappt). Defensive
 *  Hülle: Vitest läuft in node (kein localStorage). */
function liesLegacyMeineAntraegeCollapse(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(MEINE_ANTRAEGE_COLLAPSE_LEGACY_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Lädt die Config: kv-Key vs. PersonalEinstellungen-Mirror per LWW
 * (`updatedAt`), sonst Default (mit Legacy-Collapse-Seed).
 */
export async function loadHomeWidgets(idb: IDBStore): Promise<HomeWidgetConfig> {
  const kv = leseHomeWidgetConfig(await idb.get<unknown>(HOME_WIDGETS_IDB_KEY));
  const einstellungen = await idb.get<PersonalEinstellungen>(PERSONAL_EINSTELLUNGEN_IDB_KEY);
  const gespiegelt = leseHomeWidgetConfig(einstellungen?.homeWidgets);
  const gewaehlt = isNewer(gespiegelt?.updatedAt, kv?.updatedAt) ? gespiegelt : (kv ?? gespiegelt);
  if (gewaehlt) return gewaehlt;
  return defaultHomeWidgetConfig({ meineAntraegeEingeklappt: liesLegacyMeineAntraegeCollapse() });
}

/**
 * Schreibt `cfg` VERBATIM (Aufrufer stempelt `updatedAt` — so bleibt der
 * In-Memory-Store byte-gleich mit dem Persistierten) in den kv-Key und spiegelt
 * best-effort in den PersonalEinstellungen-Sync-Fluss (LWW, personal-Laufwerk
 * wenn Handle vorhanden).
 */
export async function saveHomeWidgets(idb: IDBStore, cfg: HomeWidgetConfig): Promise<void> {
  await idb.set(HOME_WIDGETS_IDB_KEY, cfg);
  try {
    const persHandle = await getPersoenlichHandle(idb);
    await savePersonalSettings(idb, persHandle, { einstellungen: { homeWidgets: cfg } });
  } catch {
    // Best-effort — IDB (kv-Key) bleibt Source of Truth.
  }
}

// ---------------------------------------------------------------------------
// Reine Config-Logik (Sortierung / Sichtbarkeit / Move) — testbar ohne IDB.
// ---------------------------------------------------------------------------

/** Globale Reihenfolge (position asc, stabil). */
export function sortiereInstanzen(widgets: WidgetInstanz[]): WidgetInstanz[] {
  return [...widgets].sort((a, b) => a.position - b.position);
}

/**
 * Sichtbare Widgets eines Bereichs für die Homepage: `sichtbar` UND im Katalog
 * `verfuegbar` UND `sichtbarWenn()` (Flags). Unbekannte Typen (aus zukünftigen
 * Config-Ständen) fallen still raus — forward-kompatibel.
 */
export function sichtbareWidgets(
  cfg: HomeWidgetConfig,
  bereich: WidgetInstanz['bereich'],
  katalog: Record<string, WidgetKatalogEintrag> = WIDGET_KATALOG,
): WidgetInstanz[] {
  return sortiereInstanzen(cfg.widgets).filter(w => {
    if (w.bereich !== bereich || !w.sichtbar) return false;
    const eintrag = katalog[w.typ];
    return !!eintrag && eintrag.verfuegbar && eintrag.sichtbarWenn();
  });
}

/**
 * Verschiebt eine Instanz in der GLOBALEN Reihenfolge um eine Position
 * (Einstellungs-Positionsliste). Tauscht mit dem Nachbarn und nummeriert
 * 0..n-1 neu; am Rand ein No-op. Der `bereich` bleibt unverändert (v1:
 * kein Spalten-Wechsel über die Pfeile).
 */
export function moveInstanz(
  cfg: HomeWidgetConfig,
  id: string,
  richtung: 'hoch' | 'runter',
): HomeWidgetConfig {
  const sortiert = sortiereInstanzen(cfg.widgets);
  const idx = sortiert.findIndex(w => w.id === id);
  if (idx < 0) return cfg;
  const ziel = richtung === 'hoch' ? idx - 1 : idx + 1;
  if (ziel < 0 || ziel >= sortiert.length) return cfg;
  const neu = [...sortiert];
  const el = neu[idx]!;
  neu[idx] = neu[ziel]!;
  neu[ziel] = el;
  return {
    ...cfg,
    widgets: neu.map((w, i) => ({ ...w, position: i })),
  };
}
