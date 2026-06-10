import { useEffect, useState } from 'react';
import { ArrowRight, AlertTriangle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, SectionHeader, ListItem, Button } from '@/ui';
import { Alert } from '@/components/ui/alert';
import { useStorage } from '@/core/hooks/useStorage';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useProfile } from '@/core/hooks/useProfile';
import { useTourContext } from '@/core/hooks/useTour';
import { TOUR_STEPS } from '@/core/components/tour/tourSteps';
import { useBauantraegeStore } from '@/plugins/bauantraege/store';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useDashboardData } from './useDashboardData';
import { MeineAntraegeSection } from './MeineAntraegeSection';
import { NeueAntraegeFuerDich } from './NeueAntraegeFuerDich';
import { ProgrammeOverviewCards } from './ProgrammeOverviewCards';
import { EingangAmpelCard } from './EingangAmpelCard';
import { menuLabel, isDataShareEnabled, isAuslastungSelbstEintragungEnabled, isEndUserProdVariant, isAuslastungEnabled, hasDepartmentChoice } from '@/config/feature-flags';
import { getStatusVariant, getStatusLabel } from '@/core/utils/status-mappings';
import { getVbPhaseLabel, getVbPhaseVariant } from '@/core/utils/vb-phase-mappings';
import { getSmbHandle } from '@/core/services/infrastructure/smb-handle';
import { HomeCallToAction } from '@/core/components/HomeCallToAction';
import { tfPerfStart } from '@/core/utils/tfPerf';

export function HomePage(): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();
  const loadBau = useBauantraegeStore(s => s.loadAll);
  const loadAntraege = useAntraegeStore(s => s.loadAll);
  const { profile } = useProfile();
  const tour = useTourContext();
  const [hasHandle, setHasHandle] = useState<boolean | null>(null);
  // Verhindert den "Noch keine Vorgaenge"-Flash, bevor die beiden Stores
  // (Bauantraege + Antraege) beim ersten Mount async befuellt sind.
  // Wird nur einmal gesetzt — Programm-Switches loesen kein Reset aus, damit
  // beim Wechsel kein Skeleton aufblitzt.
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const h = await getSmbHandle(storage.idb);
      if (!cancelled) setHasHandle(!!h);
    })();
    return () => { cancelled = true; };
  }, [storage.idb]);

  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  useEffect(() => {
    // Race-Gate: ProfileProvider startet mit profile=null und befuellt
    // ihn erst nach einem useEffect-Tick aus IDB. Wenn HomePage in dem
    // Fenster mountet, war department auf 'beide' (Fallback) und
    // loadBau lief unnoetig — selbst bei einem 'antraege'-Profil. Wir
    // warten daher, bis profile != null ist, und nehmen dann anhand des
    // tatsaechlichen department-Werts die richtigen Loads auf.
    if (profile === null) return;
    const department = profile.department ?? 'beide';
    let cancelled = false;
    const end = tfPerfStart('HomePage mount: loadBau+loadAntraege');
    const tasks: Promise<void>[] = [];
    if (department !== 'antraege') tasks.push(loadBau(storage));
    if (department !== 'bauantraege') {
      tasks.push(loadAntraege(storage.idb, activeProgrammId ?? undefined));
    }
    void Promise.all(tasks).then(() => {
      if (!cancelled) {
        setFirstLoadDone(true);
        end();
      }
    });
    return () => { cancelled = true; };
  }, [storage, loadBau, loadAntraege, activeProgrammId, profile]);

  // useDashboardData filtert NICHT explizit auf activeProgrammId — der
  // useAntraegeStore.antraege-State enthält nach loadAll(idb, programmId)
  // bereits nur die Anträge des aktiven Programms.
  const data = useDashboardData(profile?.department);
  const name = profile?.name ?? '';
  const antraegeLabel = menuLabel('antraege', 'Anträge');
  const bauantraegeLabel = menuLabel('bauantraege', 'Bauanträge');
  const dept = profile?.department === 'antraege' ? antraegeLabel
    : profile?.department === 'bauantraege' ? bauantraegeLabel
    : 'Beide Abteilungen';

  // Auto-Start der Tour beim ersten Besuch (nur wenn Daten vorhanden)
  const tourHasCompleted = tour.hasCompleted;
  const tourIsActive = tour.isActive;
  const tourStart = tour.start;
  useEffect(() => {
    // v2.21: Auto-Start nur im prod-Endkunden-Build — pl/kurator/dev/demo
    // starten die Tour nicht automatisch (der „Neu hier?"-Button bleibt überall).
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
      <div className="px-8 pt-4 pb-6 max-w-5xl">
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
        <p className="text-[14px] text-[var(--tf-text-secondary)] mb-6">Noch keine Vorgänge angelegt</p>
        <Button variant="secondary" icon={ArrowRight} onClick={() => navigate('bauantraege')}>Ersten Antrag erstellen</Button>
      </div>
    );
  }

  return (
    <div className="px-8 pt-4 pb-6 max-w-5xl">
      {/* Header */}
      <div data-tour="home-dashboard" className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{data.greeting}{name ? `, ${name}` : ''}</h1>
        <p className="text-[13px] text-[var(--tf-text-secondary)]">
          {hasDepartmentChoice() ? `${dept} · ` : ''}{data.stats.offen} offene Vorgänge · {data.fristenDieseWoche} Fristen diese Woche
        </p>
      </div>

      {data.bearbeiterFilterActive && data.bearbeiterKuerzelMissing ? (
        <BearbeiterKuerzelMissingAlert tokens={data.bearbeiterTokens} />
      ) : null}

      {/* Multi-Programm-Übersicht — versteckt bei <= 1 Programm */}
      <ProgrammeOverviewCards />

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
        {/* Main */}
        <div data-tour="document-list" className="min-w-0">
          {(() => {
            // Bauanträge-Department behält den bisherigen "Aktuelle Vorgänge"-Render.
            // Förderanträge-Pfad ('antraege' / 'beide') zeigt ausschließlich "Meine
            // Anträge" — inkl. Onboarding-Karte (kein Kürzel) und Empty-State
            // (Kürzel aktiv aber 0 Treffer).
            if (profile?.department === 'bauantraege') {
              if (data.letzteAenderungen.length === 0) return null;
              return (
                <>
                  <SectionHeader
                    label="Aktuelle Vorgänge"
                    action={
                      <button
                        onClick={() => navigate('bauantraege')}
                        className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
                      >
                        Alle →
                      </button>
                    }
                  />
                  {data.letzteAenderungen.map((v, i) => {
                    const isAntrag = (v as { _isAntrag?: boolean })._isAntrag === true;
                    const vbPhase = isAntrag ? (v as { vb_phase?: number }).vb_phase : undefined;
                    const phaseLabel = getVbPhaseLabel(vbPhase);
                    return (
                      <ListItem
                        key={v.id}
                        iconBare
                        icon={
                          phaseLabel ? (
                            <Badge variant={getVbPhaseVariant(vbPhase)}>{phaseLabel}</Badge>
                          ) : (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--tf-text-tertiary)] opacity-40" />
                          )
                        }
                        title={v.title}
                        subtitle={v.id}
                        meta={<Badge variant={getStatusVariant(v.status)}>{getStatusLabel(v.status)}</Badge>}
                        onClick={() => navigate(isAntrag ? 'antraege' : 'bauantraege', { selectedId: v.id })}
                        last={i === data.letzteAenderungen.length - 1}
                      />
                    );
                  })}
                </>
              );
            }

            // „alle"-Modus = kein aktiver Kürzel-Filter. In pl/dev zeigt Home
            // dann die Übersicht aller (aktiven) MAs (mit MA-Kürzel je Zeile)
            // statt des „Kürzel setzen"-Hinweises. Die übrigen Varianten (prod
            // via MA-Login, kurator/demo ohne Auslastungs-Modul) behalten den
            // Hinweis.
            const alleMode = !data.bearbeiterFilterActive;

            if (alleMode && !isAuslastungEnabled()) {
              return (
                <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-5">
                  <div className="flex items-start gap-3">
                    <Settings size={18} className="mt-0.5 text-[var(--tf-text-secondary)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[var(--tf-text)] mb-1">
                        Ihr Bearbeiter-Kürzel ist noch nicht gesetzt
                      </p>
                      <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-snug mb-3">
                        Tragen Sie in den Einstellungen Ihr Namenskürzel ein
                        (z.B. <span className="font-mono">MUE</span>), damit hier automatisch
                        Ihre offenen Anträge erscheinen.
                      </p>
                      <Button variant="secondary" size="sm" icon={ArrowRight} onClick={() => navigate('einstellungen')}>
                        Zu den Einstellungen
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }

            if (data.meineAntraege.length === 0) {
              return (
                <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-5">
                  <p className="text-[14px] font-medium text-[var(--tf-text)] mb-1">
                    {alleMode ? (
                      'Keine offenen Anträge'
                    ) : (
                      <>Keine offenen Anträge für Kürzel{' '}<span className="font-mono">{data.bearbeiterTokens.join(', ')}</span></>
                    )}
                  </p>
                  <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-snug mb-3">
                    {alleMode
                      ? 'Aktuell sind keine offenen Förderanträge erfasst. In der Förderanträge-Liste können Sie alle Vorgänge einsehen.'
                      : 'Aktuell sind keine offenen Förderanträge auf Sie zugeordnet. In der Förderanträge-Liste können Sie alle Vorgänge einsehen.'}
                  </p>
                  <Button variant="secondary" size="sm" icon={ArrowRight} onClick={() => navigate('antraege')}>
                    Alle Förderanträge öffnen
                  </Button>
                </div>
              );
            }

            const initialCount = Math.max(5, Math.min(15, profile?.home_meine_antraege_count ?? 5));
            return (
              <MeineAntraegeSection
                antraege={data.meineAntraege}
                initialCount={initialCount}
                bearbeiterTokens={data.bearbeiterTokens}
                alleMode={alleMode}
              />
            );
          })()}

          {/* "Neue Antraege fuer dich" — Selbsteintragung aus Auslastung
              (1.17 ersetzt den frueheren Tab "Selbsteintragung"). Nur sichtbar
              wenn features.auslastung aktiv ist und der User Foerderantraege
              im Profil hat. */}
          {profile?.department !== 'bauantraege' && isAuslastungSelbstEintragungEnabled() && (
            <NeueAntraegeFuerDich />
          )}
        </div>

        {/* Sidebar cards */}
        <div className="space-y-4">
          {/* Antragseingang-Ampel — nur wenn Förderanträge im Profil sichtbar */}
          {profile?.department !== 'bauantraege' ? <EingangAmpelCard /> : null}

          {/* AI Status */}
          <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3 uppercase tracking-[0.08em]">AI-Assistent</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tf-text-tertiary)]" />
              <span className="text-[13px] text-[var(--tf-text-secondary)]">Nicht verbunden</span>
            </div>
            <button onClick={() => navigate('chat')} className="text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer">Chat öffnen →</button>
          </div>
        </div>
      </div>
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
