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
import {
  AMPEL_SCHWELLEN_DEFAULT,
  type AmpelSchwellen,
} from '@/plugins/antraege/eingangAmpel';
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
 * Ergänzt Instanzen für neu verfügbar gewordene Katalog-Widgets, die im
 * (älteren) Config-Stand fehlen — sonst tauchten sie für Bestands-Nutzer nie in
 * der Einstellungs-Liste auf (die Liste rendert Instanzen, nicht den Katalog).
 * Rein + flag-frei (Gate nur auf statischem `verfuegbar`); die Sichtbarkeits-
 * Flags (`sichtbarWenn`) wirken erst beim Rendern (`sichtbareWidgets` / Settings).
 * Neue Instanzen sind Opt-in (`sichtbar: false`) und hängen hinten an; `updatedAt`
 * bleibt unberührt (kein künstlicher LWW-Gewinn). Idempotent.
 *
 * Notizen bleibt dabei per Default am Spaltenende (Schnell-Eingabe unten,
 * v2.239.1): eine vorhandene Notizen-Instanz wird ÜBER alle — auch die eben
 * angehängten — Positionen gehoben, damit ein später aktiviertes Seiten-Widget
 * (z.B. Auslastung) NICHT unter die Notizen rutscht. Kein harter Pin: nur die
 * Erst-Anlage/Reconcile ordnet um; per Pfeilen (`moveInstanz`) bleibt Notizen
 * frei verschiebbar.
 */
export function reconcileVerfuegbareWidgets(
  cfg: HomeWidgetConfig,
  katalog: Record<string, WidgetKatalogEintrag> = WIDGET_KATALOG,
): HomeWidgetConfig {
  const vorhanden = new Set(cfg.widgets.map(w => w.typ));
  const fehlend = (Object.keys(katalog) as WidgetTyp[])
    .filter(typ => katalog[typ]!.verfuegbar && !vorhanden.has(typ));
  if (fehlend.length === 0) return cfg;
  let pos = cfg.widgets.reduce((m, w) => Math.max(m, w.position), -1);
  const neue: WidgetInstanz[] = fehlend.map(typ => ({
    id: `w-${typ}`,
    typ,
    position: ++pos,
    bereich: katalog[typ]!.bereich,
    sichtbar: false,
    eingeklappt: katalog[typ]!.defaultEingeklappt ?? false,
    config: katalog[typ]!.defaultConfig(),
  }));
  const notizenUnten = pos + 1;
  const widgets = [...cfg.widgets, ...neue].map(w =>
    w.typ === 'notizen' ? { ...w, position: notizenUnten } : w,
  );
  return { ...cfg, widgets };
}

/**
 * Lädt die Config: kv-Key vs. PersonalEinstellungen-Mirror per LWW
 * (`updatedAt`), sonst Default (mit Legacy-Collapse-Seed); fehlende verfügbare
 * Katalog-Widgets werden ergänzt (reconcileVerfuegbareWidgets).
 */
export async function loadHomeWidgets(idb: IDBStore): Promise<HomeWidgetConfig> {
  const kv = leseHomeWidgetConfig(await idb.get<unknown>(HOME_WIDGETS_IDB_KEY));
  const einstellungen = await idb.get<PersonalEinstellungen>(PERSONAL_EINSTELLUNGEN_IDB_KEY);
  const gespiegelt = leseHomeWidgetConfig(einstellungen?.homeWidgets);
  const gewaehlt = isNewer(gespiegelt?.updatedAt, kv?.updatedAt) ? gespiegelt : (kv ?? gespiegelt);
  const basis = gewaehlt
    ?? defaultHomeWidgetConfig({ meineAntraegeEingeklappt: liesLegacyMeineAntraegeCollapse() });
  return reconcileVerfuegbareWidgets(basis);
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
  // Reine Positions-Reihenfolge — kein Sonder-Pin (Notizen ist per Default unten,
  // wird aber im Reconcile positioniert, s. reconcileVerfuegbareWidgets, und
  // bleibt per Pfeilen frei verschiebbar).
  return sortiereInstanzen(cfg.widgets).filter(w => {
    if (w.bereich !== bereich || !w.sichtbar) return false;
    const eintrag = katalog[w.typ];
    return !!eintrag && eintrag.verfuegbar && eintrag.sichtbarWenn();
  });
}

/**
 * Ampel-Schwellen aus der Widget-Config (erste `antragseingang`-Instanz).
 * GEMEINSAME Quelle für Home-Kopfzeile (formatHomeSubtitle-Pfad) UND
 * Ampel-Widget — kein Zahlen-Drift. Ohne (geladene) Config: Defaults 30/90.
 */
export function ampelSchwellenAusConfig(cfg: HomeWidgetConfig | null): AmpelSchwellen {
  const instanz = cfg?.widgets.find(w => w.typ === 'antragseingang');
  if (instanz && instanz.config.art === 'ampel') {
    const { warnschwelleTage, kritischSchwelleTage } = instanz.config;
    if (
      Number.isFinite(warnschwelleTage) && Number.isFinite(kritischSchwelleTage)
      && warnschwelleTage > 0 && kritischSchwelleTage > warnschwelleTage
    ) {
      return { warnschwelleTage, kritischSchwelleTage };
    }
  }
  return AMPEL_SCHWELLEN_DEFAULT;
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
