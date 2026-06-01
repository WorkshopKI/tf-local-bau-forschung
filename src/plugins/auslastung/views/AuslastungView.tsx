/**
 * AuslastungView — Top-Level-Layout des Auslastungs-Plugins (1.17).
 *
 * Reduziert von 5 auf 3 Tabs:
 *  - Klassifizierung  — pro Verbund, mit LLM-Batch-Button (1.17)
 *  - Zuweisung        — PL-Cockpit mit Top-3 Vorschlaegen
 *  - Uebersicht       — fusioniert Admin + Kapazitaet
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
import { Tabs } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { isDeAnonymisierungEnabled } from '@/config/feature-flags';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAutoCollectTeamProfiles } from '../hooks/useAutoCollectTeamProfiles';
import { AuslastungIndexProvider } from '../hooks/useAuslastungIndex';
import { ModulLoadingBanner } from '../components/ModulLoadingBanner';
import { KlassifizierungsReview } from './KlassifizierungsReview';
import { ZuweisungsCockpit } from './ZuweisungsCockpit';
import { UebersichtView } from './UebersichtView';
import { KompetenzMatrixView } from './KompetenzMatrixView';
import { PrivacyChip } from './uebersicht/PrivacyChip';

type TabId = 'klassifizierung' | 'zuweisung' | 'uebersicht' | 'kompetenzen';
const ALL_TABS: ReadonlySet<TabId> = new Set(['klassifizierung', 'zuweisung', 'uebersicht', 'kompetenzen']);

export function AuslastungView(): React.ReactElement {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const data = useAuslastungData(s => s.data);
  const load = useAuslastungData(s => s.load);
  const loaded = useAuslastungData(s => s.loaded);

  const setupDone = data.config.setupAbgeschlossen;

  // v2.8: Team-Profile (Technologien/Antragstyp-Präferenz aus den persönlichen
  // Ordnern) beim Modul-Open automatisch einsammeln, damit der Matcher mit
  // aktuellen Präferenzen arbeitet (z.B. FuE-MA nicht für DS vorschlägt).
  useAutoCollectTeamProfiles();

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
  }, [load, storage]);

  // Einmalig nach erstem Load: Setup nicht abgeschlossen → Uebersicht-Tab.
  useEffect(() => {
    if (!loaded || tabAutoSet) return;
    if (!setupDone) setTab('uebersicht');
    setTabAutoSet(true);
  }, [loaded, tabAutoSet, setupDone]);

  const tabs = useMemo(() => {
    const offene = data.klassifizierungen.filter(k => k.status === 'vorgeschlagen').length;
    const jahrMatch = /^(\d{4})-Q[1-4]$/.exec(data.config.aktuellesQuartal);
    const jahr = jahrMatch ? jahrMatch[1] : null;
    return [
      {
        id: 'klassifizierung' as const,
        label: 'Anträge klassifizieren',
        badge: offene || undefined,
        tooltip: `Verteil-Pool: Verbünde${jahr ? ` aus ${jahr}` : ''} ohne TiB-Zuweisung, ohne Status „abgelehnt/zurückgezogen" und „Irrläufer". Die Klassifizierung wirkt auf alle TVs eines Verbundes.`,
      },
      {
        id: 'zuweisung' as const,
        label: 'Anträge zuweisen',
        tooltip: 'Freigegebene Anträge an passende Mitarbeitende zuweisen — Top-3-Match-Vorschläge aus Kompetenz und freier Kapazität, inkl. Übernahme-Wünschen der MAs.',
      },
      {
        id: 'uebersicht' as const,
        label: 'Kapazitäten MAs',
        tooltip: 'Statistik, Mitarbeiter & Kapazität (pro Quartal) und Konfiguration — Kategorien, CSV-Import/Export, E-Mail-Vorlage, Themen-Modell.',
      },
      {
        id: 'kompetenzen' as const,
        label: 'Kompetenzen',
        tooltip: 'PL-Kompetenz-Vorbelegung: XLSX mit Kompetenz-Leveln (1–3), Antragstyp-Kontingent und Abschlag pro Kürzel hochladen und in einer xlsx-ähnlichen Tabelle pflegen.',
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

  // v2.13: Kein Early-Return mehr fuer !loaded. Header + ModulLoadingBanner
  // werden sofort gerendert — beim Re-Mount sieht der User innerhalb von
  // ~16ms den Spinner mit Countdown statt 2-3s blank wie vorher. Tabs werden
  // erst nach loaded=true gerendert, damit ihre Mount-Effekte (LLM-Bridge,
  // Verbund-Embeddings etc.) nicht doppelt feuern.
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
            ? `${Object.keys(data.mitarbeiter).length} MAs · ${data.config.ueberKategorien.length} Kategorien · ${data.config.aktuellesQuartal}`
            : 'wird geladen …'}
        </p>
        {isDeAnonymisierungEnabled() && (
          <div className="ml-auto">
            <PrivacyChip />
          </div>
        )}
      </div>

      {/* v2.13: Banner direkt unter dem Header (vor den Tabs) — sofort
          sichtbares "etwas-passiert"-Signal bei jedem Mount. Verschwindet
          sobald useAuslastungReady() ready=true meldet. */}
      <ModulLoadingBanner />

      {loaded && (
        <>
          <Tabs tabs={tabs} activeTab={tab} onChange={(id) => switchTab(id as TabId)} />

          {/* v2.9: Eager Mount aller Tabs + gemeinsamer Index-Provider. Alle
              drei Tabs sind dauerhaft im DOM; nicht-aktive werden per
              `display: none` ausgeblendet. Tab-Wechsel ist von Anfang an
              ein reiner CSS-Toggle (<100 ms). Das hilft besonders, weil
              `computeQuartalsAuslastung` jetzt 1x pro Render-Cycle via
              Provider statt 3x in den Konsumenten laeuft. */}
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
            </div>
          </AuslastungIndexProvider>
        </>
      )}
    </div>
  );
}
