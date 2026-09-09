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
import {
  HERO_CONFIG_DEFAULT,
  type HeroChipId,
  type HeroConfig,
  type HeroKarte,
  type HomeWidgetConfig,
  type WidgetInstanz,
  type WidgetTyp,
} from './types';
import { widgetId } from '@/core/sichtbarkeit';
import { WIDGET_KATALOG, type WidgetKatalogEintrag } from './widgetCatalog';

/** IDB-Key (kv-Store) — primäre Quelle der Widget-Config. */
export const HOME_WIDGETS_IDB_KEY = 'home-widgets-config';

/** Alter localStorage-Key des Meine-Anträge-Collapse (useCollapsedSection) —
 *  wird beim Erst-Anlegen der Config EINMALIG als Seed gelesen (Zustands-Erhalt),
 *  danach ist die Widget-Config die einzige Collapse-Quelle. */
export const MEINE_ANTRAEGE_COLLAPSE_LEGACY_KEY = 'home_meine_antraege_collapsed';

const BEREICHE = new Set(['haupt', 'seite']);

/**
 * Was eine Startseite von selbst zeigen soll, damit man es überhaupt findet.
 *
 * `reconcileVerfuegbareWidgets` zieht neue Katalog-Typen bewusst als Opt-in
 * (`sichtbar: false`) nach — richtig für „irgendwann mal", falsch für die
 * Handvoll Karten, die die tägliche Arbeit tragen: wer nie ins Widgets-
 * Untermenü sieht, hat „Fristen" oder „Änderungen der letzten Nacht" nie zu
 * Gesicht bekommen.
 *
 * EINE Deklaration für zwei Wege: der Default eines frischen Geräts führt genau
 * diese Typen sichtbar (plus `ai-assistent`), und `migriereV4Entdeckung` holt
 * gewachsene Configs einmalig dorthin nach. Der Guard
 * `entdeckung-default-deckungsgleich` hält beide zusammen.
 *
 * Die Hero-Karte „Braucht heute Aufmerksamkeit" gehört fachlich dazu, steht aber
 * nicht hier: sie ist kein Widget (keine Instanz, kein Bereich) und läuft über
 * `hero.sichtbar.alert`.
 */
export const ENTDECKUNG_WIDGETS: WidgetTyp[] = [
  'tagesbrief',
  'meine-antraege',
  'fristen',
  'nachtlauf',
  'antragseingang',
  'feedback-news',
  'notizen',
];

/**
 * Default-Config (v6): der Auslieferungszustand einer frischen Startseite —
 * `ENTDECKUNG_WIDGETS` sichtbar, dazu der KI-Assistent; `kanban` bleibt Opt-in.
 * `weitermachen` steht seit v2 nicht mehr im Default — das Hero-Band (HomeHero)
 * zeigt „Weiter, wo du aufgehört hast" prominent; das gleichnamige Widget bleibt
 * als Opt-in im Katalog (per reconcileVerfuegbareWidgets als `sichtbar: false`
 * ergänzt). `updatedAt` ist Epoche, damit jeder echte Save die Defaults per LWW
 * gewinnt.
 *
 * `nachtlauf` steht ans Ende seiner Spalte (Nachschlage-Karte, nicht Arbeits-
 * liste — derselbe Grund wie in `migriereV2NachtlaufAnsEnde`); `notizen` hebt
 * der Reconcile ohnehin ans Ende der Seitenspalte.
 */
export function defaultHomeWidgetConfig(
  opts?: { meineAntraegeEingeklappt?: boolean },
): HomeWidgetConfig {
  const instanz = (
    id: string,
    typ: WidgetTyp,
    position: number,
    sichtbar: boolean,
    // Ohne Angabe entscheidet der Katalog — sonst driftete der Auslieferungs-
    // zustand von `defaultEingeklappt` ab, sobald dort jemand etwas ändert
    // (`nachtlauf` und `auslastung` starten aus Kostengründen eingeklappt).
    eingeklappt = WIDGET_KATALOG[typ].defaultEingeklappt ?? false,
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
    version: 6,
    updatedAt: new Date(0).toISOString(),
    hero: HERO_CONFIG_DEFAULT,
    widgets: [
      instanz('w-tagesbrief', 'tagesbrief', 0, true),
      instanz('w-meine-antraege', 'meine-antraege', 1, true, opts?.meineAntraegeEingeklappt ?? false),
      instanz('w-kanban', 'kanban', 2, false),
      instanz('w-fristen', 'fristen', 3, true),
      instanz('w-antragseingang', 'antragseingang', 4, true),
      instanz('w-ai-assistent', 'ai-assistent', 5, true),
      instanz('w-feedback-news', 'feedback-news', 6, true),
      instanz('w-nachtlauf', 'nachtlauf', 7, true),
      instanz('w-notizen', 'notizen', 8, true),
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
 * v1 → v2 (Home-Redesign „optimiert"): Das Hero-Band zeigt „Weitermachen" jetzt
 * prominent oben; eine sichtbare `weitermachen`-Widget-Instanz würde doppeln →
 * einmalig ausblenden. Bleibt im Katalog `verfuegbar` (über die Einstellungen
 * reaktivierbar). Rein + idempotent — jede spätere Nutzer-Mutation persistiert
 * v2, sodass die Migration danach nie wieder greift (auch ein bewusstes
 * Reaktivieren bleibt erhalten).
 */
export function migriereV1HeroWeitermachen(widgets: WidgetInstanz[]): WidgetInstanz[] {
  return widgets.map(w =>
    w.typ === 'weitermachen' && w.sichtbar ? { ...w, sichtbar: false } : w,
  );
}

/**
 * v2 → v3 (v4.134): „Änderungen der letzten Nacht" rückt ans Ende.
 *
 * Das Widget ist eine **Nachschlage-Karte**, keine Arbeitsliste: es sagt, was
 * der Nacht-Import gebracht hat, und nicht, was zu tun ist. In den gewachsenen
 * Configs stand es zwischen den Karten, die die Arbeit des Tages tragen — die
 * Position kam aus der Reihenfolge, in der `reconcileVerfuegbareWidgets` neue
 * Typen angehängt hat, also aus der Bauzeit und nicht aus einer Entscheidung.
 *
 * **Einmalig, kein Pin.** Anders als die Notizen-Regel im Reconcile läuft das
 * hier genau einen Lesevorgang lang: die Config wird als v3 zurückgegeben, und
 * wer die Karte danach nach oben holt, behält sie dort. Rein + idempotent —
 * steht sie schon allein am Ende, bleibt die Liste unverändert.
 */
export function migriereV2NachtlaufAnsEnde(widgets: WidgetInstanz[]): WidgetInstanz[] {
  const nacht = widgets.find(w => w.typ === 'nachtlauf');
  if (!nacht) return widgets;
  const max = widgets.reduce((m, w) => Math.max(m, w.position), -1);
  const alleinAmEnde = nacht.position === max
    && widgets.filter(w => w.position === max).length === 1;
  if (alleinAmEnde) return widgets;
  return widgets.map(w => (w.typ === 'nachtlauf' ? { ...w, position: max + 1 } : w));
}

/**
 * v3 → v4 (v4.135): „Änderungen der letzten Nacht" bekommt seine Detail-Config.
 *
 * **Warum das nötig ist.** `reconcileVerfuegbareWidgets` ergänzt nur fehlende
 * TYPEN, nie fehlende FELDER. Eine gewachsene Config trägt die Instanz längst —
 * mit `{ art: 'keine' }`, weil es damals keine Regler gab. Ohne diesen Schritt
 * bliebe `hatWidgetDetailConfig` für sie false, und der Menü-Eintrag
 * „Widget-Einstellungen" erschiene bei genau den Nutzern nie, die das Widget
 * schon benutzen.
 *
 * Rein + idempotent: eine Instanz, die bereits eine `nachtlauf`-Config trägt,
 * bleibt unangetastet — auch dann, wenn ihre Werte von den Defaults abweichen.
 */
export function migriereV3NachtlaufConfig(widgets: WidgetInstanz[]): WidgetInstanz[] {
  if (!widgets.some(w => w.typ === 'nachtlauf' && w.config.art !== 'nachtlauf')) return widgets;
  return widgets.map(w => (w.typ === 'nachtlauf' && w.config.art !== 'nachtlauf'
    ? { ...w, config: WIDGET_KATALOG.nachtlauf.defaultConfig() }
    : w));
}

/**
 * v4 → v5 (v6.19): die Karten aus `ENTDECKUNG_WIDGETS` und die Alert-Karte des
 * Hero-Bandes werden EINMALIG eingeblendet.
 *
 * **Erst anlegen, dann einblenden.** Ein gewachsener Stand von vor `fristen`
 * trägt für diesen Typ gar keine Instanz — ein bloßes Umlegen des Häkchens fände
 * nichts vor, und der Reconcile-Schritt in `loadHomeWidgets` käme danach und
 * legte sie als `sichtbar: false` an. Deshalb ruft dieser Schritt
 * `reconcileVerfuegbareWidgets` selbst; er ist rein und idempotent, der spätere
 * Aufruf ist dann ein No-op.
 *
 * **Nur einblenden, nie ausblenden** — was jemand sich eingerichtet hat, bleibt.
 * `position` und `eingeklappt` bleiben ebenfalls unberührt: die Anordnung gehört
 * dem Nutzer, und `nachtlauf` erscheint eingeklappt, wie sein Katalog-Eintrag es
 * vorsieht (es liest die Monatsdateien des Journals vom Share).
 *
 * Die Alert-Karte läuft über `setzeHeroKarte` statt über einen eigenen Griff in
 * `hero`: das holt zugleich die drei Kacheln zurück, falls alle abgewählt waren
 * — sonst käme eine Karte wieder, die nichts anzuzeigen hätte.
 *
 * Rein + idempotent; ohne Änderung referenzgleich.
 */
export function migriereV4Entdeckung(cfg: HomeWidgetConfig): HomeWidgetConfig {
  const voll = reconcileVerfuegbareWidgets(cfg);
  const ziel = new Set<string>(ENTDECKUNG_WIDGETS);
  const trifft = (w: WidgetInstanz): boolean => ziel.has(w.typ) && !w.sichtbar;
  const mitWidgets = voll.widgets.some(trifft)
    ? { ...voll, widgets: voll.widgets.map(w => (trifft(w) ? { ...w, sichtbar: true } : w)) }
    : voll;
  return setzeHeroKarte(mitWidgets, 'alert', true);
}

/**
 * v5 → v6 (v6.45): der **Tagesbrief** wird einmalig eingeblendet — und als
 * einziger Schritt dieser Kette auch **umgestellt**, an den Kopf der Hauptspalte.
 *
 * **Warum die Ausnahme.** Alle bisherigen Schritte lassen `position` bewusst in
 * Ruhe: die Anordnung gehört dem Nutzer. Beim Tagesbrief IST die Position aber
 * die Sache selbst — er rankt, was zuerst dran ist, und ein Ranking, das unter
 * fünf Karten steht, beantwortet die Frage nicht mehr, für die es da ist. Ein
 * angehängter Brief wäre eingebaut und trotzdem wirkungslos.
 *
 * **Einmalig, kein Pin.** Wer ihn danach verschiebt oder ausblendet, behält
 * seine Anordnung — der Versions-Stempel sorgt dafür, dass dieser Schritt nach
 * der ersten echten Änderung nicht mehr läuft. Bis dahin ist er idempotent und
 * folgenlos (gleiche Eingabe, gleiche Ausgabe).
 *
 * **Erst anlegen, dann einblenden** (wie v4 → v5): ein gewachsener Stand kennt
 * den Typ gar nicht, deshalb reconciled der Schritt selbst.
 */
export function migriereV5Tagesbrief(cfg: HomeWidgetConfig): HomeWidgetConfig {
  const voll = reconcileVerfuegbareWidgets(cfg);
  const brief = voll.widgets.find(w => w.typ === 'tagesbrief');
  if (!brief) return voll;

  // Die kleinste Position der Hauptspalte ist der Bezugspunkt — nicht die 0:
  // die Positionen sind eine GLOBALE Ordnungszahl über beide Spalten, und ein
  // hart gesetztes 0 verschöbe die Seitenspalte gleich mit.
  const haupt = voll.widgets.filter(w => w.bereich === 'haupt' && w.id !== brief.id);
  const kopf = haupt.length > 0 ? Math.min(...haupt.map(w => w.position)) : 0;
  const stehtSchonOben = brief.sichtbar && brief.position < kopf;
  if (stehtSchonOben) return voll;

  return {
    ...voll,
    widgets: voll.widgets.map(w => {
      if (w.id === brief.id) return { ...w, sichtbar: true, position: kopf };
      // Nur die Hauptspalte rückt nach; die Seitenspalte bleibt, wo sie ist.
      return w.bereich === 'haupt' && w.position >= kopf
        ? { ...w, position: w.position + 1 }
        : w;
    }),
  };
}

/**
 * Die Hero-Karten aus einem Config-Stand — jeder fehlende oder kaputte Wert
 * bedeutet „an". Additiv statt versioniert: das Feld kam mit v4.41 dazu, und ein
 * Stand ohne es soll exakt so aussehen wie bisher (beide Karten, alle Kacheln).
 */
export function leseHeroConfig(raw: unknown): HeroConfig {
  const feld = (v: unknown): Record<string, unknown> =>
    (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const an = (v: unknown): boolean => (typeof v === 'boolean' ? v : true);
  const s = feld(feld(raw).sichtbar);
  const c = feld(feld(raw).chips);
  return {
    sichtbar: { resume: an(s.resume), alert: an(s.alert) },
    chips: { kritisch: an(c.kritisch), warnung: an(c.warnung), qs: an(c.qs) },
  };
}

/**
 * Toleranter Read (analog arbeitskontext-log): kaputte/fremde Werte → null
 * (Aufrufer fällt auf Default). Der `version`-Switch ist der Migrations-
 * Einstieg: v1-Stände werden auf v2 gehoben (weitermachen einmalig ausgeblendet,
 * s. migriereV1HeroWeitermachen); ein v5-Stand wird verbatim gelesen. Unbekannte
 * Versionen werden bewusst NICHT geraten.
 *
 * Der v5-Schritt ist der einzige, der die GANZE Config braucht (er fasst auch
 * `hero` an) und der Instanzen voraussetzt, die es in alten Ständen noch gar
 * nicht gibt — er läuft deshalb auf dem fertigen Objekt und reconciled selbst
 * (s. `migriereV4Entdeckung`).
 */
export function leseHomeWidgetConfig(raw: unknown): HomeWidgetConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const cfg = raw as Record<string, unknown>;
  const version = cfg.version;
  // Whitelist statt Bereich: unbekannte Versionen werden bewusst NICHT geraten.
  if (version !== 1 && version !== 2 && version !== 3
    && version !== 4 && version !== 5 && version !== 6) return null;
  if (typeof cfg.updatedAt !== 'string' || !Array.isArray(cfg.widgets)) return null;
  let widgets = cfg.widgets.filter(isWidgetInstanz);
  if (version === 1) widgets = migriereV1HeroWeitermachen(widgets);
  if (version < 3) widgets = migriereV2NachtlaufAnsEnde(widgets);
  if (version < 4) widgets = migriereV3NachtlaufConfig(widgets);
  const gelesen: HomeWidgetConfig = {
    version: 6,
    updatedAt: cfg.updatedAt,
    hero: leseHeroConfig(cfg.hero),
    widgets,
  };
  const nachV5 = version < 5 ? migriereV4Entdeckung(gelesen) : gelesen;
  return version < 6 ? migriereV5Tagesbrief(nachV5) : nachV5;
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

/** Antwort von `useSichtbar()`; ohne Angabe gilt alles als sichtbar (Tests, reine Aufrufer). */
export type WidgetSichtbarkeit = (id: string) => boolean;
const ALLES_SICHTBAR: WidgetSichtbarkeit = () => true;

/**
 * Darf dieser Widget-Typ überhaupt erscheinen? DIE Stelle, an der die drei
 * Bedingungen zusammenkommen — bis v4.111 stand die Kette
 * `verfuegbar && sichtbarWenn()` an fünf Orten wortgleich, und eine vierte
 * Bedingung hätte sie fünfmal ergänzen müssen.
 *
 * Die Beta/Experte-Marken kommen als Parameter, nicht aus einem globalen
 * Zugriff: die beiden Schalter hängen am Profil-Kontext, und eine Funktion,
 * die still an React-Zustand hängt, wäre weder testbar noch reaktiv.
 */
export function widgetAnzeigbar(
  typ: string,
  katalog: Record<string, WidgetKatalogEintrag> = WIDGET_KATALOG,
  sichtbar: WidgetSichtbarkeit = ALLES_SICHTBAR,
): boolean {
  const eintrag = katalog[typ];
  return !!eintrag && eintrag.verfuegbar && eintrag.sichtbarWenn() && sichtbar(widgetId(typ));
}

/**
 * Sichtbare Widgets eines Bereichs für die Homepage: `sichtbar` UND
 * `widgetAnzeigbar` (verfügbar, Flags, Beta/Experte). Unbekannte Typen (aus
 * zukünftigen Config-Ständen) fallen still raus — forward-kompatibel.
 *
 * Ein von den Marken verborgenes Widget wird nur NICHT GERENDERT — seine
 * Instanz bleibt in der persönlichen Config stehen. Sonst verlöre ein
 * Beta-aus/an-Wechsel die Anordnung, die sich jemand einmal eingerichtet hat.
 */
export function sichtbareWidgets(
  cfg: HomeWidgetConfig,
  bereich: WidgetInstanz['bereich'],
  katalog: Record<string, WidgetKatalogEintrag> = WIDGET_KATALOG,
  sichtbar: WidgetSichtbarkeit = ALLES_SICHTBAR,
): WidgetInstanz[] {
  // Reine Positions-Reihenfolge — kein Sonder-Pin (Notizen ist per Default unten,
  // wird aber im Reconcile positioniert, s. reconcileVerfuegbareWidgets, und
  // bleibt per Pfeilen frei verschiebbar).
  return sortiereInstanzen(cfg.widgets).filter(w => {
    if (w.bereich !== bereich || !w.sichtbar) return false;
    return widgetAnzeigbar(w.typ, katalog, sichtbar);
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
 * Klappt alle SICHTBAREN Widgets zu bzw. auf („Alles einklappen" im
 * Startseiten-Menü). Bewusst nur die sichtbaren: ein ausgeblendetes Widget
 * mitzuklappen wäre eine unsichtbare Nebenwirkung, die erst beim späteren
 * Einblenden aufflöge. Rein + idempotent; ohne Treffer referenzgleich.
 */
export function setzeAlleEingeklappt(
  cfg: HomeWidgetConfig,
  eingeklappt: boolean,
  katalog: Record<string, WidgetKatalogEintrag> = WIDGET_KATALOG,
  sichtbar: WidgetSichtbarkeit = ALLES_SICHTBAR,
): HomeWidgetConfig {
  const ids = new Set([
    ...sichtbareWidgets(cfg, 'haupt', katalog, sichtbar).map(w => w.id),
    ...sichtbareWidgets(cfg, 'seite', katalog, sichtbar).map(w => w.id),
  ]);
  if (!cfg.widgets.some(w => ids.has(w.id) && w.eingeklappt !== eingeklappt)) return cfg;
  return {
    ...cfg,
    widgets: cfg.widgets.map(w => (ids.has(w.id) ? { ...w, eingeklappt } : w)),
  };
}

/**
 * Der „alle"-Schalter einer Spalte im Widgets-Untermenü. Fasst nur Instanzen an,
 * die im Katalog überhaupt anzeigbar sind (`verfuegbar` + `sichtbarWenn`) — sonst
 * schaltete „alle" Widgets scharf, die diese Variante gar nicht kennt, und der
 * Nutzer sähe von seiner eigenen Aktion nichts. Die andere Spalte bleibt unberührt.
 */
export function setzeSichtbarkeitBereich(
  cfg: HomeWidgetConfig,
  bereich: WidgetInstanz['bereich'],
  sichtbar: boolean,
  katalog: Record<string, WidgetKatalogEintrag> = WIDGET_KATALOG,
  angezeigt: WidgetSichtbarkeit = ALLES_SICHTBAR,
): HomeWidgetConfig {
  const trifft = (w: WidgetInstanz): boolean =>
    w.bereich === bereich && widgetAnzeigbar(w.typ, katalog, angezeigt);
  if (!cfg.widgets.some(w => trifft(w) && w.sichtbar !== sichtbar)) return cfg;
  return {
    ...cfg,
    widgets: cfg.widgets.map(w => (trifft(w) ? { ...w, sichtbar } : w)),
  };
}

/** Hat die Alert-Karte überhaupt noch eine Kachel zu zeigen? */
function irgendeineKachel(chips: HeroConfig['chips']): boolean {
  return chips.kritisch || chips.warnung || chips.qs;
}

/**
 * Blendet eine der beiden Hero-Karten aus/ein. Der Weg zurück ist nicht ihr
 * eigenes `⋯` (das ist mit der Karte weg), sondern die Gruppe „Oben" im
 * Widgets-Untermenü — dieselbe Checkliste, die auch die Widgets führt.
 *
 * Wer die Alert-Karte dort wieder einschaltet, bekommt ihre Kacheln zurück:
 * sonst käme eine Karte wieder, die nichts anzuzeigen hätte, und der Schalter
 * bliebe wirkungslos. Rein + referenzgleich ohne Änderung.
 */
export function setzeHeroKarte(
  cfg: HomeWidgetConfig, karte: HeroKarte, sichtbar: boolean,
): HomeWidgetConfig {
  if (cfg.hero.sichtbar[karte] === sichtbar) return cfg;
  const leer = karte === 'alert' && sichtbar && !irgendeineKachel(cfg.hero.chips);
  return {
    ...cfg,
    hero: {
      chips: leer ? { kritisch: true, warnung: true, qs: true } : cfg.hero.chips,
      sichtbar: { ...cfg.hero.sichtbar, [karte]: sichtbar },
    },
  };
}

/**
 * Wählt eine Kachel der Alert-Karte ab/an. Getrennt von der Zähler-Regel: die
 * Abwahl ist eine Aussage über Zuständigkeit („QS geht mich nichts an"), die
 * 0 eine über den Bestand — beide blenden aus, aus verschiedenen Gründen.
 *
 * **Kachel-Wahl und Karte hängen zusammen**: ohne Kachel hat die Karte nichts zu
 * zeigen, also ist sie dann auch „aus" — und taucht als solche in der Liste
 * „Oben" auf. Stünde sie dort weiter als „an", wäre das Abwählen aller drei eine
 * Einbahnstraße: die Karte weg, ihr `⋯` mit ihr, und der Schalter, der sie
 * zurückholen soll, schon oben.
 */
export function setzeHeroChip(
  cfg: HomeWidgetConfig, chip: HeroChipId, an: boolean,
): HomeWidgetConfig {
  if (cfg.hero.chips[chip] === an) return cfg;
  const chips = { ...cfg.hero.chips, [chip]: an };
  return {
    ...cfg,
    hero: { chips, sichtbar: { ...cfg.hero.sichtbar, alert: irgendeineKachel(chips) } },
  };
}

/**
 * „Startseite zurücksetzen": exakt der Stand, den ein frisches Gerät bekäme —
 * Default plus die per Reconcile nachgezogenen Opt-in-Instanzen. Kein eigener
 * Pfad, damit „zurückgesetzt" und „nie angefasst" dasselbe bedeuten. Der
 * Notiz-TEXT liegt unter eigenem kv-Key und bleibt davon unberührt.
 */
export function zurueckgesetzteConfig(): HomeWidgetConfig {
  return reconcileVerfuegbareWidgets(defaultHomeWidgetConfig());
}

/**
 * Verschiebt eine Instanz um eine Position INNERHALB IHRER SPALTE (`bereich`) —
 * die beiden Spalten der Startseite haben je eine unabhängige Reihenfolge
 * (die Homepage filtert je Bereich und sortiert nach `position`; ein Tausch
 * über die Spaltengrenze wäre für die Homepage folgenlos). Tauscht die
 * `position` mit dem nächsten Nachbarn DESSELBEN Bereichs; die andere Spalte
 * bleibt unberührt. Am Spaltenrand / bei unbekannter ID ein No-op (Referenz-
 * gleich). Der `bereich` bleibt unverändert (Pfeile wechseln nie die Spalte).
 *
 * `zaehlt` blendet Nachbarn aus, die gar nicht auf dem Schirm stehen (von der
 * Beta-/Experten-Achse verborgen). Ohne das tauschte der Pfeil mit einem
 * unsichtbaren Nachbarn: die Zeile blieb, wo sie war, und der Klick sah aus,
 * als hätte er nicht funktioniert — die Liste rechnete mit der gekürzten
 * Reihenfolge, der Tausch mit der vollen.
 */
export function moveInstanz(
  cfg: HomeWidgetConfig,
  id: string,
  richtung: 'hoch' | 'runter',
  zaehlt: (w: WidgetInstanz) => boolean = () => true,
): HomeWidgetConfig {
  const el = cfg.widgets.find(w => w.id === id);
  if (!el) return cfg;
  const geschwister = sortiereInstanzen(cfg.widgets)
    .filter(w => w.bereich === el.bereich)
    .filter(w => w.id === id || zaehlt(w));
  const idx = geschwister.findIndex(w => w.id === id);
  const ziel = richtung === 'hoch' ? idx - 1 : idx + 1;
  if (ziel < 0 || ziel >= geschwister.length) return cfg;
  const nachbar = geschwister[ziel]!;
  return {
    ...cfg,
    widgets: cfg.widgets.map(w => {
      if (w.id === el.id) return { ...w, position: nachbar.position };
      if (w.id === nachbar.id) return { ...w, position: el.position };
      return w;
    }),
  };
}
