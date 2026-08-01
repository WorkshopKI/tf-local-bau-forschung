import { useEffect, useState } from 'react';
import { ArrowRight, AlertTriangle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useStorage } from '@/core/hooks/useStorage';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useProfile } from '@/core/hooks/useProfile';
import { useTourContext } from '@/core/hooks/useTour';
import { TOUR_STEPS } from '@/core/components/tour/tourSteps';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useDashboardData } from './useDashboardData';
import { HomeZweiSpalten } from './HomeZweiSpalten';
import { HomeHero } from './HomeHero';
import { ProgrammeOverviewCards } from './ProgrammeOverviewCards';
import { useEingangAmpelCounts } from './useEingangAmpelCounts';
import { formatHomeSubtitle } from './homeSubtitle';
import type { AmpelBucket } from '@/plugins/antraege/eingangAmpel';
import { HomeWidgetStack } from './widgets/HomeWidgetStack';
import { ampelSchwellenAusConfig } from './widgets/homeWidgetsStore';
import { useHomeWidgetsStore } from './widgets/useHomeWidgets';
import type { HomeWidgetContext } from './widgets/widgetProps';
import { isDataShareEnabled, isEndUserProdVariant } from '@/config/feature-flags';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { HomeCallToAction } from '@/core/components/HomeCallToAction';
import { tfPerfStart } from '@/core/utils/tfPerf';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

export function HomePage(): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();
  const loadAntraege = useAntraegeStore(s => s.loadAll);
  const { profile } = useProfile();
  const tour = useTourContext();
  const [hasHandle, setHasHandle] = useState<boolean | null>(null);
  // Verhindert den "Noch keine Vorgaenge"-Flash, bevor der Antraege-Store
  // beim ersten Mount async befuellt ist. Wird nur einmal gesetzt — Programm-
  // Switches loesen kein Reset aus, damit beim Wechsel kein Skeleton aufblitzt.
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const h = await getDatenShareHandle(storage.idb);
      if (!cancelled) setHasHandle(!!h);
    })();
    return () => { cancelled = true; };
  }, [storage.idb]);

  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  useEffect(() => {
    // Race-Gate: ProfileProvider startet mit profile=null und befuellt ihn
    // erst nach einem useEffect-Tick aus IDB. Wir warten daher, bis
    // profile != null ist, bevor wir die Foerderantraege laden.
    if (profile === null) return;
    let cancelled = false;
    const end = tfPerfStart('HomePage mount: loadAntraege');
    void loadAntraege(storage.idb, activeProgrammId ?? undefined).then(() => {
      if (!cancelled) {
        setFirstLoadDone(true);
        end();
      }
    });
    return () => { cancelled = true; };
  }, [storage, loadAntraege, activeProgrammId, profile]);

  // useDashboardData filtert NICHT explizit auf activeProgrammId — der
  // useAntraegeStore.antraege-State enthält nach loadAll(idb, programmId)
  // bereits nur die Anträge des aktiven Programms.
  const data = useDashboardData();
  const name = profile?.name ?? '';

  // Kopfzeilen-Subtitle aus denselben Ampel-Aggregaten wie das Antragseingang-
  // Widget — GLEICHE Schwellen-Quelle (ampelSchwellenAusConfig auf derselben
  // Widget-Config) → garantiert identische Zahlen (kein Drift). Hook muss
  // vor den Early-Returns stehen (React-Regel).
  const homeWidgetConfig = useHomeWidgetsStore(s => s.config);
  const ladeWidgetConfig = useHomeWidgetsStore(s => s.laden);
  useEffect(() => {
    // Config früh laden (nicht erst im Stack-Mount) — die Kopfzeile braucht
    // die Ampel-Schwellen schon im ersten sichtbaren Frame.
    ladeWidgetConfig(storage.idb).catch(() => {});
  }, [ladeWidgetConfig, storage.idb]);
  const schwellen = ampelSchwellenAusConfig(homeWidgetConfig);
  const ampelCounts = useEingangAmpelCounts(schwellen);
  const subtitleParts = formatHomeSubtitle({
    offen: ampelCounts.total,
    kritisch: ampelCounts.kritisch,
    warnung: ampelCounts.warnung,
  });

  // Hero-Alert-Chips öffnen dieselbe gefilterte Liste wie das Antragseingang-
  // Widget (setActiveView setzt zurück → danach Quickfilter setzen).
  const openBucket = (bucket: AmpelBucket): void => {
    const store = useAntraegeStore.getState();
    store.setActiveView('meine_offenen');
    store.setAmpelQuickfilter({ bucket, schwellen });
    navigate('antraege');
  };
  // Direkt in den Vorgang statt in die ungefilterte Liste — dieselbe Zielwahl
  // wie die „Prüfen →"-Zeile im QS-Widget (eine QS-Listenseite gibt es nicht).
  const openQs = (scopeId: string): void => navigate('antraege', { selectedId: scopeId });

  // Geteilter Kontext für die Widget-Wrapper — die 13k-Antraege-Aggregation
  // (useDashboardData) läuft EINMAL hier, nicht je Widget.
  const initialCount = Math.max(5, Math.min(15, profile?.home_meine_antraege_count ?? 5));
  const widgetCtx: HomeWidgetContext = { data, initialCount };

  // Auto-Start der Tour beim ersten Besuch (nur wenn Daten vorhanden)
  const tourHasCompleted = tour.hasCompleted;
  const tourIsActive = tour.isActive;
  const tourStart = tour.start;
  useEffect(() => {
    // v2.21: Auto-Start nur im prod-Endkunden-Build — pl/kurator/dev/demo
    // starten die Tour nicht automatisch. Manueller Einstieg überall: „Hilfe" im
    // Seitenkopf → „Einführungs-Tour" (bis v2.359 ein „Neu hier?"-Knopf in der
    // Sidebar-Fußzeile).
    if (!isEndUserProdVariant()) return;
    if (tourHasCompleted || tourIsActive) return;
    if (data.stats.total === 0) return;
    if (TOUR_STEPS.length === 0) return;
    const timer = setTimeout(() => tourStart(), 800);
    return () => clearTimeout(timer);
  }, [tourHasCompleted, tourIsActive, tourStart, data.stats.total]);

  if (hasHandle === null) {
    return <div className="min-h-[60vh]" />;
  }

  // CTA immer wenn die Variante den Daten-Share nutzt und (noch) kein Handle
  // verbunden ist — inkl. fixed-path-Varianten (prod/pl). Frueher nur bei
  // allowUserToChangePath, was prod/pl ohne In-App-Verbindungsweg in einer
  // leeren App stranden liess, wenn der Handle fehlte/unbrauchbar war (StartupScreen
  // uebersprungen, stale/denied Handle, Citrix-Neumount). Demo (demoDataBundled,
  // kein Daten-Share) bleibt via isDataShareEnabled() ausgenommen.
  if (hasHandle === false && isDataShareEnabled()) {
    return <HomeCallToAction idb={storage.idb} onConnected={() => setHasHandle(true)} />;
  }

  // Erster Store-Load laeuft noch — Skeleton mit echter Begruessung statt
  // leerem Div. Unter Multi-CSV-Joins (~480 MB IDB-getAll fuer 13k Antraege)
  // dauert das mehrere Sekunden; ohne Skeleton sieht der User in der Zeit
  // gar nichts und die App fuehlt sich eingefroren an.
  if (!firstLoadDone) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
    return (
      <div className="px-8 pt-4 pb-6 max-w-[1600px]">
        <div className="mb-6">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">
            {greeting}{name ? `, ${name}` : ''}
          </h1>
          <p className="text-[13px] text-[var(--tf-text-tertiary)]">Lade Vorgänge …</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
          <div className="min-w-0">
            <div className="h-4 w-40 rounded bg-[var(--tf-bg-secondary)] animate-pulse mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-[var(--tf-bg-secondary)] animate-pulse" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.stats.total === 0) {
    // Wenn der Bearbeiter-Filter aktiv ist und die KUERZ-Spalten in den
    // CSV-Quellen fehlen, ist die "Noch keine Vorgänge"-Meldung trügerisch —
    // es gäbe ja Daten, sie können nur nicht gefiltert werden.
    if (data.bearbeiterFilterActive && data.bearbeiterKuerzelMissing) {
      return (
        <div className="px-8 pt-4 pb-6 max-w-3xl">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-4">
            {data.greeting}{name ? `, ${name}` : ''}
          </h1>
          <BearbeiterKuerzelMissingAlert tokens={data.bearbeiterTokens} />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">{data.greeting}{name ? `, ${name}` : ''}</h1>
        <p className="text-[14px] text-[var(--tf-text-secondary)] mb-6">Noch keine Förderanträge erfasst</p>
        <Button variant="secondary" icon={ArrowRight} onClick={() => navigate('antraege')}>Förderanträge öffnen</Button>
      </div>
    );
  }

  return (
    <div className="px-8 pt-4 pb-6 max-w-[1600px]">
      {/* Header */}
      <div data-tour="home-dashboard" className="mb-6 flex items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{data.greeting}{name ? `, ${name}` : ''}</h1>
          <p className="text-[13px] text-[var(--tf-text-secondary)]">
            {subtitleParts.offen}
            {subtitleParts.kritisch ? (
              <> · <span className="text-[var(--tf-danger-text)]">{subtitleParts.kritisch}</span></>
            ) : null}
            {subtitleParts.warnung ? <> · {subtitleParts.warnung}</> : null}
          </p>
        </div>
        <div className="ml-auto shrink-0"><SeitenHilfeButton pluginId="home" /></div>
      </div>

      {data.bearbeiterFilterActive && data.bearbeiterKuerzelMissing ? (
        <BearbeiterKuerzelMissingAlert tokens={data.bearbeiterTokens} />
      ) : null}

      {/* Multi-Programm-Übersicht — versteckt bei <= 1 Programm */}
      <ProgrammeOverviewCards />

      {/* Two-column grid — beide Spalten rendern Widget-Instanzen aus der
          persönlichen Config (Reihenfolge/Sichtbarkeit/Collapse). Der ziehbare
          Trenn-Griff (HomeZweiSpalten) verbreitert die Hauptspalte für den
          Kanban. Die Sonderfälle (Begrüßung, Alert, ProgrammeOverviewCards,
          Early-Returns/Tour) bleiben bewusst KEINE Widgets. „Neue Anträge für
          dich" (MA-Selbsteintragung) ist seit v2.238 ein echtes Katalog-Widget
          (flag-gebunden über sichtbarWenn) und wird vom haupt-Stack gerendert. */}
      <HomeZweiSpalten
        main={
          <div className="min-w-0 space-y-[18px]">
            {/* Hero-Band (fixes Element, kein Widget) — Arbeitseinstieg oben in
                der Hauptspalte, Rail top-aligned daneben (Handoff-Layout). */}
            <HomeHero counts={ampelCounts} onOpenBucket={openBucket} onOpenQs={openQs} />
            <div data-tour="document-list">
              <HomeWidgetStack bereich="haupt" ctx={widgetCtx} className="space-y-[18px]" />
            </div>
          </div>
        }
        seite={<HomeWidgetStack bereich="seite" ctx={widgetCtx} className="space-y-3" />}
      />
    </div>
  );
}

interface BearbeiterKuerzelMissingAlertProps {
  tokens: string[];
}

function BearbeiterKuerzelMissingAlert({ tokens }: BearbeiterKuerzelMissingAlertProps): React.ReactElement {
  return (
    <Alert variant="warning" className="mb-6">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">
          Bearbeiter-Filter aktiv ({tokens.join(', ')}), aber die Bearbeiter-Spalten
          {' '}<span className="font-mono">TiB_KUERZ</span> / <span className="font-mono">BIB_KUERZ</span>
          {' '}sind in den geladenen CSV-Quellen nicht vorhanden.
        </p>
        <p className="mt-1 text-[12px] opacity-90">
          Deshalb ist die Anzeige leer. Lösungen: Kürzel-Filter im Profil deaktivieren
          (Wert <span className="font-mono">alle</span> eintragen oder leeren) oder eine
          CSV-Quelle mit den KUERZ-Spalten registrieren bzw. das Mapping ergänzen.
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-[11.5px]">
          <Link
            to="/einstellungen"
            className="inline-flex items-center gap-1 underline hover:no-underline"
          >
            <Settings size={12} /> Profil bearbeiten
          </Link>
        </div>
      </div>
    </Alert>
  );
}
