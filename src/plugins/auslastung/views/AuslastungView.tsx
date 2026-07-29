/**
 * AuslastungView — Top-Level-Layout des Auslastungs-Plugins (1.17).
 *
 * Tabs (v2.21):
 *  - Klassifizierung  — pro Verbund, mit LLM-Batch-Button (1.17)
 *  - Zuweisung        — PL-Cockpit mit Top-3 Vorschlaegen
 *  - Auslastung MA    — Statistik + MA-Liste/Kapazitaet
 *  - Kompetenzen      — PL-Kompetenz-Matrix (v2.15)
 *  - Verwaltung       — Kategorien/Import-Export/Konfig (inkl. Zugangs-
 *                       passwort-Verwaltung)/Themen-Vektoren. Der Tab hiess bis
 *                       v2.205 „Einstellungen" (Verwechslung mit den persoenlichen
 *                       Einstellungen); interne TabId bleibt `einstellungen`.
 *
 * Die ehemalige Selbsteintragung wandert auf die Homepage
 * (NeueAntraegeFuerDich-Sektion). Sichtbarkeit "PL-only" ist bereits ueber
 * Build-Varianten geregelt (`features.auslastung` nur in pl/dev configs).
 *
 * Auto-Switch: Setup nicht abgeschlossen → 'uebersicht' (zeigt Setup-Wizard).
 *
 * v2.8 — Tab-Persistenz (lazy + sticky): einmal besuchte Tabs bleiben im
 * DOM (display:none wenn nicht aktiv). Tab-Wechsel ist nur noch ein CSS-
 * Toggle, schwergewichtige Memos (`buildVerbundClassificationViews`,
 * `computeQuartalsAuslastung`) und IDB-Reads (`loadAllVerbundEmbeddings`)
 * laufen genau einmal pro Tab pro App-Session statt bei jedem Wechsel.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useKuerzelMap } from '../hooks/useKuerzelMap';
import { useAutoCollectTeamProfiles } from '../hooks/useAutoCollectTeamProfiles';
import { useReconcileZuweisungen } from '../hooks/useReconcileZuweisungen';
import { useAuslastungCrossTabSync } from '../hooks/useAuslastungCrossTabSync';
import { useAuslastungShareWatcher } from '../hooks/useAuslastungShareWatcher';
import { useAntraegeCacheSnapshotRefresh } from '../hooks/useAntraegeCache';
import { AuslastungIndexProvider } from '../hooks/useAuslastungIndex';
import { useAuslastungReady } from '../hooks/useAuslastungReady';
import { ModulLadeStreifen, ladePhasenText } from '../components/ModulLadeStreifen';
import { SkeletonBar, SkeletonRows } from '../components/Skeleton';
import { AuslastungSaveErrorBanner } from '../components/AuslastungSaveErrorBanner';
import { KlassifizierungsReview } from './KlassifizierungsReview';
import { ZuweisungsCockpit } from './ZuweisungsCockpit';
import { UebersichtView } from './UebersichtView';
import { KompetenzMatrixView } from './KompetenzMatrixView';
import { EinstellungenView } from './EinstellungenView';
import { isAuslastungNurKorpusEnabled } from '@/config/feature-flags';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

type TabId = 'klassifizierung' | 'zuweisung' | 'uebersicht' | 'kompetenzen' | 'einstellungen';
const ALL_TABS: ReadonlySet<TabId> = new Set(['klassifizierung', 'zuweisung', 'uebersicht', 'kompetenzen', 'einstellungen']);

/**
 * Platzhalter fuer die Phase, in der noch NICHTS gerendert werden kann
 * (`auslastung.json` unterwegs) — bis v2.351 blieb die Seite hier komplett leer.
 * Zeigt die Struktur, die gleich kommt: Tab-Leiste + Tabellen-Rumpf.
 */
function SeitenSkeleton(): React.ReactElement {
  return (
    <div className="mt-5 flex flex-col gap-5" aria-hidden>
      <div className="flex items-center gap-6" style={{ borderBottom: '0.5px solid var(--tf-border)', paddingBottom: 10 }}>
        {[130, 110, 100, 180, 90].map(w => <SkeletonBar key={w} width={w} height={13} />)}
      </div>
      <SkeletonRows count={8} columns={[70, 80, 240, 140, 80, 70, 70]} />
    </div>
  );
}

/**
 * Inhalts-Huelle waehrend `!ready`: abgedimmt + nicht bedienbar, damit ein Klick
 * nicht auf halbfertigen Daten landet. EIN Wrapper fuer alle Tabs (die Tab-Leiste
 * selbst bleibt ausserhalb und bedienbar).
 */
function LadeDimmer({ aktiv, children }: { aktiv: boolean; children: React.ReactNode }): React.ReactElement {
  return (
    <div
      aria-busy={aktiv || undefined}
      className={aktiv ? 'pointer-events-none select-none' : undefined}
      style={{ opacity: aktiv ? 0.55 : 1, transition: 'opacity 150ms var(--tf-ease)' }}
    >
      {children}
    </div>
  );
}

export function AuslastungView(): React.ReactElement {
  // Build-time-konstante Verzweigung (flippt zur Laufzeit nie → Rules-of-Hooks-
  // sicher): die kurator-Variante zeigt nur die schlanke Themen-Vektoren-Pflege.
  return isAuslastungNurKorpusEnabled() ? <AuslastungKorpusView /> : <AuslastungFullView />;
}

/**
 * Schlanker kurator-View (v2.56): nur die Themen-Vektoren-Korpus-Sektion, damit
 * der Kurator den Embedding-Katalog aktuell halten kann — ohne MA-Auslastung zu
 * sehen oder zuzuweisen. Bewusst OHNE die MA-mutierenden Mount-Hooks des vollen
 * Views (`useReconcileZuweisungen` + `useAutoCollectTeamProfiles` schreiben
 * `auslastung.json`); es laufen nur read-only Frische-Hooks, damit der Centroid-
 * Write des Korpus-Builds keine fremden MA-Edits überschreibt.
 */
function AuslastungKorpusView(): React.ReactElement {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const load = useAuslastungData(s => s.load);
  const loaded = useAuslastungData(s => s.loaded);

  // Nur read-only Sync: hält den Store frisch (Cross-Tab, Fremd-Write am Share,
  // CSV-Snapshot) — schreibt selbst nichts.
  useAuslastungCrossTabSync();
  useAuslastungShareWatcher();
  useAntraegeCacheSnapshotRefresh();

  useEffect(() => {
    void load(storage);
    void useKuerzelMap.getState().load(storage);
  }, [load, storage]);

  if (!activeProgrammId) {
    return (
      <div className="p-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">Themen-Vektoren</h1>
        <p className="text-[13.5px] text-[var(--tf-text-secondary)]">
          Kein Förderprogramm aktiv — bitte zuerst ein Programm einrichten oder auswählen.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-0 mb-4">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-none tracking-[-0.01em]">
          Themen-Vektoren
        </h1>
        <p
          className="text-[12px] text-[var(--tf-text-tertiary)]"
          style={{ paddingLeft: 14, marginLeft: 14, borderLeft: '0.5px solid var(--tf-border)' }}
        >
          Embedding-Katalog für die automatische Klassifizierung aktuell halten
        </p>
      </div>

      <ModulLadeStreifen />
      <AuslastungSaveErrorBanner />

      {loaded && (
        <div className="mt-5">
          <EinstellungenView korpusOnly />
        </div>
      )}
    </div>
  );
}

function AuslastungFullView(): React.ReactElement {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const data = useAuslastungData(s => s.data);
  const load = useAuslastungData(s => s.load);
  const loaded = useAuslastungData(s => s.loaded);
  const { ready, phase } = useAuslastungReady();

  const setupDone = data.config.setupAbgeschlossen;

  // v2.8: Team-Profile (Technologien/Antragstyp-Präferenz aus den persönlichen
  // Ordnern) beim Modul-Open automatisch einsammeln, damit der Matcher mit
  // aktuellen Präferenzen arbeitet (z.B. FuE-MA nicht für DS vorschlägt).
  useAutoCollectTeamProfiles();

  // Einmal-Bereinigung von Altdaten-Dubletten (eine Einheit, ein Bearbeiter):
  // collapst pro Verbund/Quartal auf die höchstrangige Zuweisung. CSV-Refresh
  // heilt diese Phantome nicht (eigener PL-Stand) → hier beim Modul-Open.
  useReconcileZuweisungen();

  // v2.25: Cross-Tab-Sync — ein zweiter pl-Tab (z.B. auf einem zweiten Monitor)
  // lädt frisch vom Share nach, sobald dieser Tab schreibt (verhindert Lost-
  // Updates bei geteilter IDB + Datei-Handle).
  useAuslastungCrossTabSync();

  // v2.31: Share-Watcher — andere PL-Rechner (eigene IDB/Handle) sehen
  // Kompetenz-/Kapazitäts-Edits live: pollt das lastModified von
  // `_intern/auslastung.json` und lädt bei fremden Writes nach.
  useAuslastungShareWatcher();

  // v2.26: nach einem CSV-Refresh (neue Snapshot-Version in der IDB) die
  // Anträge ohne App-Reload nachladen — Klassifizierung bleibt manuell.
  useAntraegeCacheSnapshotRefresh();

  // Default-Tab: 'klassifizierung'. Wenn Setup nicht abgeschlossen, springt
  // ein useEffect (siehe unten) auf 'uebersicht' (zeigt Setup-Wizard).
  const [tab, setTab] = useState<TabId>('klassifizierung');
  const [tabAutoSet, setTabAutoSet] = useState(false);
  // v2.9: Eager Mount aller Tabs (statt Lazy+Sticky aus v2.8).
  // Alle drei Tabs werden beim Modul-Open parallel gemountet — der
  // gemeinsame AuslastungIndexProvider berechnet `auslastungByAnon` 1×
  // statt 3×. Initial-Mount des Moduls dauert dadurch nicht laenger
  // (Skeleton fängt das ab), aber JEDER Tab-Wechsel ist von Anfang an
  // <100 ms (reiner CSS-Toggle, kein Mount mehr).
  const switchTab = useCallback((next: TabId): void => {
    setTab(next);
  }, []);

  useEffect(() => {
    void load(storage);
    // v2.46.1: kuerzel-map post-grant nachladen (symmetrisch zu auslastung.json).
    // Der Plugin-onInit-Load lief evtl. VOR dem Share-Grant und blieb dank
    // isDatenShareReadable-Gate auf loaded:false — dieser Mount-Aufruf (jetzt
    // gegranteter Share) füllt die anonymMap, sonst skippt das Matching jeden
    // nicht-onboarded MA (matching-engine.ts:189).
    void useKuerzelMap.getState().load(storage);
  }, [load, storage]);

  // Einmalig nach erstem Load: Setup nicht abgeschlossen → Uebersicht-Tab.
  useEffect(() => {
    if (!loaded || tabAutoSet) return;
    if (!setupDone) setTab('uebersicht');
    setTabAutoSet(true);
  }, [loaded, tabAutoSet, setupDone]);

  const tabs = useMemo(() => {
    const offene = data.klassifizierungen.filter(k => k.status === 'vorgeschlagen').length;
    const lookback = data.config.verteilLookbackMonate ?? 6;
    return [
      {
        id: 'klassifizierung' as const,
        label: 'Anträge klassifizieren',
        badge: offene || undefined,
        tooltip: `Verteil-Pool: Verbünde der letzten ${lookback} Monate (nach Antragsdatum) ohne TiB-Zuweisung, ohne Status „abgelehnt/zurückgezogen" und „Irrläufer". Gleitet über den Jahreswechsel. Die Klassifizierung wirkt auf alle TVs eines Verbundes.`,
      },
      {
        id: 'zuweisung' as const,
        label: 'Anträge zuweisen',
        tooltip: 'Freigegebene Anträge an passende Mitarbeitende zuweisen — Top-3-Match-Vorschläge aus fachlicher Passung und freier Kapazität, inkl. Übernahme-Wünschen der MAs.',
      },
      {
        id: 'uebersicht' as const,
        label: 'Auslastung MA',
        tooltip: 'Statistik, Mitarbeiter & Kapazität (pro Quartal) und Konfiguration — Kategorien, CSV-Import/Export, E-Mail-Vorlage, Themen-Modell.',
      },
      {
        id: 'kompetenzen' as const,
        label: 'Kompetenzen & Jahreskapazitäten',
        tooltip: 'PL-Kompetenz-Vorbelegung: XLSX mit Kompetenz-Leveln (1–3), Antragstyp-Kontingent und Abschlag pro Kürzel hochladen und in einer xlsx-ähnlichen Tabelle pflegen.',
      },
      {
        id: 'einstellungen' as const,
        label: 'Verwaltung',
        tooltip: 'Kategorien, CSV-Import/Export, Konfiguration (inkl. Zugangspasswort-Verwaltung & E-Mail-Vorlage) und Themen-Vektoren (Embedding-Korpus).',
      },
    ];
  }, [data.klassifizierungen, data.config.aktuellesQuartal]);

  // Empty-States
  if (!activeProgrammId) {
    return (
      <div className="p-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">Auslastung</h1>
        <p className="text-[13.5px] text-[var(--tf-text-secondary)]">
          Kein Förderprogramm aktiv — bitte zuerst ein Programm einrichten oder auswählen.
        </p>
      </div>
    );
  }

  // v2.13: Kein Early-Return mehr fuer !loaded. Header + Lade-Streifen werden
  // sofort gerendert. Tabs erst nach loaded=true, damit ihre Mount-Effekte
  // (LLM-Bridge, Verbund-Embeddings etc.) nicht doppelt feuern.
  //
  // v2.352: EIN Ladezustand statt drei — der Phasentext haengt in der ohnehin
  // vorhandenen Kopf-Zeile, darunter die schmale Leiste, und der Tab-Inhalt ist
  // bis `ready` abgedimmt + nicht bedienbar.
  const phasenText = ladePhasenText(phase);
  return (
    <div className="p-6">
      <div className="flex items-center gap-0 mb-4">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-none tracking-[-0.01em]">
          Auslastung
        </h1>
        <p
          className="text-[12px] text-[var(--tf-text-tertiary)] font-mono"
          style={{ paddingLeft: 14, marginLeft: 14, borderLeft: '0.5px solid var(--tf-border)' }}
        >
          {loaded
            ? `${Object.keys(data.mitarbeiter).length} MAs · ${data.config.ueberKategorien.length} Kategorien · ${data.config.aktuellesQuartal}${phasenText ? ` · ${phasenText}` : ''}`
            : (phasenText ?? 'wird geladen …')}
        </p>
        <div className="ml-auto shrink-0"><SeitenHilfeButton pluginId="auslastung" /></div>
      </div>

      <ModulLadeStreifen />

      {/* v2.25: Sichtbarer Schreib-/Lade-Fehler (z.B. fehlendes Schreibrecht) —
          statt still geschluckter Rejection (Pitfall #15). */}
      <AuslastungSaveErrorBanner />

      {!loaded && <SeitenSkeleton />}

      {loaded && (
        <>
          <Tabs tabs={tabs} activeTab={tab} onChange={(id) => switchTab(id as TabId)} />

          {/* v2.9: Eager Mount aller Tabs + gemeinsamer Index-Provider. Alle
              drei Tabs sind dauerhaft im DOM; nicht-aktive werden per
              `display: none` ausgeblendet. Tab-Wechsel ist von Anfang an
              ein reiner CSS-Toggle (<100 ms). Das hilft besonders, weil
              `computeQuartalsAuslastung` jetzt 1x pro Render-Cycle via
              Provider statt 3x in den Konsumenten laeuft. */}
          <LadeDimmer aktiv={!ready}>
            <AuslastungIndexProvider>
              <div className="mt-5">
                {ALL_TABS.has('klassifizierung') && (
                  <div style={{ display: tab === 'klassifizierung' ? 'block' : 'none' }}>
                    <KlassifizierungsReview />
                  </div>
                )}
                {ALL_TABS.has('zuweisung') && (
                  <div style={{ display: tab === 'zuweisung' ? 'block' : 'none' }}>
                    <ZuweisungsCockpit />
                  </div>
                )}
                {ALL_TABS.has('uebersicht') && (
                  <div style={{ display: tab === 'uebersicht' ? 'block' : 'none' }}>
                    <UebersichtView />
                  </div>
                )}
                {ALL_TABS.has('kompetenzen') && (
                  <div style={{ display: tab === 'kompetenzen' ? 'block' : 'none' }}>
                    <KompetenzMatrixView />
                  </div>
                )}
                {ALL_TABS.has('einstellungen') && (
                  <div style={{ display: tab === 'einstellungen' ? 'block' : 'none' }}>
                    <EinstellungenView />
                  </div>
                )}
              </div>
            </AuslastungIndexProvider>
          </LadeDimmer>
        </>
      )}
    </div>
  );
}
