import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { keyboardService } from '@/core/services/keyboard';
import { CommandPalette } from '@/components/ui/CommandPalette';
import type { CommandItem } from '@/components/ui/CommandPalette';
import { setDarkMode, isDarkMode } from '@/components/ui/theme';
import { SyncStatusIndicator } from '@/components/ui/SyncStatusIndicator';
import { BridgeStatusIndicator } from '@/components/ui/BridgeStatusIndicator';
import { CsvFreshnessIndicator } from '@/components/ui/CsvFreshnessIndicator';
import { BridgeDisconnectHint } from '@/components/ui/BridgeDisconnectHint';
import { useTourContext } from '@/core/hooks/useTour';
import { useProfile } from '@/core/hooks/useProfile';
import { TOUR_STEPS } from '@/core/components/tour/tourSteps';
import { TourOverlay } from '@/core/components/tour/TourOverlay';
import { FeedbackButton } from '@/components/feedback';
import { groupNavPlugins, navVisiblePlugins } from '@/core/nav/groupNavPlugins';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { useKuratorActivityTracker } from '@/core/hooks/useKuratorActivityTracker';
import { ensureDefaultProgramm } from '@/core/services/csv';
import { getSmbHandle } from '@/core/services/infrastructure/smb-handle';
import { SmbBanner } from '@/core/components/SmbBanner';
import { OfflineBanner } from '@/core/OfflineBanner';
import { NewSnapshotBanner } from '@/core/components/NewSnapshotBanner';
import { StartupDataUpdateBanner } from '@/core/components/StartupDataUpdateBanner';
import { useSnapshotWatcher } from '@/core/hooks/useSnapshotWatcher';
import { useAuslastungCorpusAutoload } from '@/core/hooks/useAuslastungCorpusAutoload';
import { useHeartbeat } from '@/core/services/presence';
import { useBridgeHeartbeat } from '@/core/hooks/useBridgeHeartbeat';
import { CsvAutoRefreshBanner } from '@/plugins/csv-sources-kuration/components/CsvAutoRefreshBanner';
import { useAnfrageAnonAktivierung } from '@/plugins/anfragen/useAnfrageAnonAktivierung';
import { ProgrammSwitcher } from '@/core/components/ProgrammSwitcher';
import { FooterShowcaseButton } from '@/core/components/FooterShowcaseButton';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { pluginIdToRoute, routeToPluginId } from '@/core/routes';
import { runtimeConfig } from '@/config/runtime-config';
import {
  isFeedbackEnabled,
  isKuratorMenusEnabled,
  isCsvAutoRefreshEnabled,
  isDataShareEnabled,
  isGutachtenWorkflowEnabled,
  isGutachtenKurzfassungEnabled,
  menuLabel,
} from '@/config/feature-flags';
import { backupGutachtenStateToPersonal } from '@/core/services/personal-storage/gutachten-backup';
import { BuildInfo } from '@/core/components/BuildInfo';
import { useAutoSmbRefresh } from '@/dev-fixtures/useAutoSmbRefresh';

interface ShellLayoutProps {
  plugins: TeamFlowPlugin[];
  children: React.ReactNode;
}

const SIDEBAR_WIDTH_KEY = 'teamflow_sidebar_width';
const SIDEBAR_MODE_KEY = 'teamflow_sidebar_mode';
const SIDEBAR_DEFAULT = 220;
const SIDEBAR_MIN = 140;
const SIDEBAR_MAX = 360;
const SIDEBAR_RAIL_WIDTH = 52;

type SidebarMode = 'expanded' | 'rail';

function loadSidebarWidth(): number {
  try {
    const v = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(v) && v >= SIDEBAR_MIN && v <= SIDEBAR_MAX) return v;
  } catch { /* ignore */ }
  return SIDEBAR_DEFAULT;
}

function loadSidebarMode(): SidebarMode {
  try {
    if (localStorage.getItem(SIDEBAR_MODE_KEY) === 'rail') return 'rail';
  } catch { /* ignore */ }
  return 'expanded';
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

function getIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) return icon as IconComponent;
  return Icons.HelpCircle;
}

/** Holt das Bereichs-Menü-Label aus der Runtime-Config (falls Bereichs-Plugin), sonst den Plugin-Default-Namen. */
function displayName(plugin: TeamFlowPlugin): string {
  switch (plugin.id) {
    case 'antraege':    return menuLabel('antraege', plugin.name);
    case 'dokumente':   return menuLabel('dokumente', plugin.name);
    default:            return plugin.name;
  }
}

export function ShellLayout({ plugins, children }: ShellLayoutProps): React.ReactElement {
  const { profile } = useProfile();
  // Runtime-Gate: Kurator-Modus nur aktiv wenn Profil *und* Build-Flag stimmen.
  // Build-Time-Filter in `plugins.config.ts:45` entfernt `category: 'kuration'`
  // — der Runtime-Check hier schützt zusätzlich Plugins die `kuratorOnly: true`
  // mit anderer Kategorie kombinieren (falls künftig eingeführt) und ignoriert
  // Legacy-Profile aus Dev-Builds die versehentlich mit Prod-Build geöffnet werden.
  const isKurator = !!(profile?.is_kurator ?? profile?.is_admin) && isKuratorMenusEnabled();
  const location = useLocation();
  const navigate = useNavigate();

  const visiblePlugins = useMemo(() => {
    return plugins.filter(p => {
      const kuratorOnly = p.kuratorOnly ?? p.adminOnly;
      if (kuratorOnly && !isKurator) return false;
      return true;
    });
  }, [plugins, isKurator]);

  const activeId = routeToPluginId(location.pathname) ?? 'home';
  const activePlugin = visiblePlugins.find(p => p.id === activeId);
  const pageName = activePlugin ? displayName(activePlugin) : '';
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(loadSidebarMode);
  const [isMobile, setIsMobile] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [sidebarDragging, setSidebarDragging] = useState(false);

  const toggleSidebar = useCallback((): void => {
    setSidebarMode(prev => (prev === 'expanded' ? 'rail' : 'expanded'));
  }, []);

  // Sidebar-Breite per Drag-Handle anpassen.
  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onSidebarResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    sidebarDragRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    setSidebarDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent): void => {
      const drag = sidebarDragRef.current;
      if (!drag) return;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, drag.startWidth + (ev.clientX - drag.startX)));
      setSidebarWidth(next);
    };
    const onUp = (): void => {
      sidebarDragRef.current = null;
      setSidebarDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)); } catch { /* ignore */ }
  }, [sidebarWidth]);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_MODE_KEY, sidebarMode); } catch { /* ignore */ }
  }, [sidebarMode]);

  const tour = useTourContext();
  const storage = useStorage();
  const kuratorSession = useKuratorSession();
  const smbStatus = useSmbStatus();
  const initActiveProgramm = useActiveProgramm(s => s.init);

  useKuratorActivityTracker();
  useAutoSmbRefresh(storage.idb);
  // Einmalige Auto-Freischaltung des Anonymisierer-Skills auf Bestands-Shares
  // (Recall-Gate bestanden → Seed aktiv:true, aber mergeMissingSeeds überschreibt
  // bestehende registry.json nie). Läuft nach Share-Grant für schreibberechtigte Clients.
  useAnfrageAnonAktivierung();

  // Snapshot-Watcher: alle 15 Min Manifest checken, ob ein anderer Kurator
  // einen neueren Datenbestand geschrieben hat. Banner wird im <main>-
  // Bereich gerendert. Im Demo-Build deaktiviert (kein Daten-Share).
  const snapshotWatcher = useSnapshotWatcher({ enabled: isDataShareEnabled() });

  // v2.29: Auslastungs-Embedding-Korpus beim Start vom Daten-Share laden
  // (Cold-Start-Selbstheilung), nicht erst beim Navigieren ins Modul. Self-gated
  // auf isAuslastungEnabled() (pl + dev) + SMB-online.
  useAuslastungCorpusAutoload();

  // v2.59: Presence-Heartbeat — schreibt periodisch `ZAH/online-status.json` in
  // den persoenlichen Ordner (jede Variante, best-effort). Quelle fuer den
  // PL-„Online"-Tab. Self-gated (Flag + persoenlicher Handle), NO-OP sonst.
  useHeartbeat();

  // Live-Verbindungsstatus der internen KI (Streamlit-Bridge): faengt den
  // geschlossenen KI-Tab in ~3 s ab und treibt Homepage-Karte, Sidebar-Indikator
  // und den Trennungs-Hinweis. Passiv (öffnet nie selbst einen Tab).
  useBridgeHeartbeat();

  const goToPlugin = useCallback((pluginId: string) => {
    // Beim Wechsel zu einem Listen-Plugin clearet der jeweilige Route-Param-
    // Effekt (fehlender Param → null) den Detail-State im Store automatisch.
    navigate(pluginIdToRoute(pluginId));
  }, [navigate]);

  // Scroll-Restoration: bei Pfadwechsel oben starten
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Rehydrate Kurator-Session + start SMB-polling once.
  // Demo-Variante (kein fester Pfad, keine User-Auswahl) nutzt das SMB-Layer
  // nicht und soll auf evtl. verwaiste Handles aus parallelen Builds nicht
  // reagieren — kuratorSession bleibt aktiv, weil sie nur IDB-Meta liest.
  useEffect(() => {
    void kuratorSession.rehydrate(storage.idb);
    if (!isDataShareEnabled()) return;
    smbStatus.startPolling(storage.idb);
    void (async () => {
      const h = await getSmbHandle(storage.idb);
      if (h) {
        await ensureDefaultProgramm(storage.idb).catch(() => undefined);
      }
      // Active-Programm-Store init: liest profile.activeProgrammId, fällt auf
      // erstes Programm zurück. Idempotent — kann ohne Profile aufgerufen werden.
      await initActiveProgramm(storage.idb, profile);
    })();
    return () => { smbStatus.stopPolling(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v2.78.1: Einmaliger Catch-up-Sweep — spiegelt vorhandenen Gutachten-/
  // Workflow-Stand aus der IDB in den persönlichen Ordner, damit auch VOR dem
  // Mirror-Feature (oder offline) erzeugte Records browser-wechsel-fest werden.
  // Self-gated (Flag + Handle + Permission), best-effort, non-blocking.
  useEffect(() => {
    if (!isGutachtenWorkflowEnabled() && !isGutachtenKurzfassungEnabled()) return;
    void backupGutachtenStateToPersonal(storage.idb).catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h = window.setInterval(() => kuratorSession.tick(storage.idb), 60_000);
    return () => window.clearInterval(h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wenn das Profil später hydriert (asynchron in useProfileProvider), den
  // Active-Programm-State nochmal anstoßen, damit die persistierte ID greift.
  // init() ist idempotent.
  useEffect(() => {
    if (!profile) return;
    void initActiveProgramm(storage.idb, profile);
  }, [profile, initActiveProgramm, storage.idb]);

  // Nav-sichtbare, nach `order` sortierte Plugins — Quelle der Command-Palette-
  // Nav-Items. `hideFromNav`-Plugins (Chat ab Phase 4, Feedback-Board) fallen
  // raus, damit sie keinen Nav-Command erzeugen; ihre Routen bleiben erreichbar.
  const sortedPlugins = useMemo(() => navVisiblePlugins(visiblePlugins), [visiblePlugins]);

  const commandItems = useMemo((): CommandItem[] => {
    const isMac = navigator.platform.includes('Mac');
    const mod = isMac ? '⌘' : 'Ctrl+';
    const items: CommandItem[] = [];
    sortedPlugins.forEach((p, i) => {
      items.push({ id: `nav-${p.id}`, label: displayName(p), category: 'Navigation', shortcut: i < 7 ? `${mod}${i + 1}` : undefined, action: () => goToPlugin(p.id) });
    });
    // Chat ist seit Phase 4 `hideFromNav` (kein Auto-Nav-Command mehr) — der
    // Assistent wird als Panel der Suche geöffnet. Nur wenn die Suche im Build ist.
    if (plugins.some(p => p.id === 'suche')) {
      items.push({ id: 'act-assistent', label: 'Assistent öffnen', category: 'Navigation', action: () => navigate('/suche?assistent=1') });
    }
    items.push({ id: 'act-dark', label: 'Dark Mode umschalten', category: 'Einstellungen', shortcut: `${mod}⇧D`, action: () => setDarkMode(!isDarkMode()) });
    items.push({ id: 'act-sidebar', label: 'Sidebar ein-/einklappen', category: 'Einstellungen', shortcut: `${mod}/`, action: toggleSidebar });
    return items;
  }, [sortedPlugins, plugins, goToPlugin, toggleSidebar, navigate]);

  useEffect(() => {
    keyboardService.init();
    keyboardService.register('mod+k', () => setCmdPaletteOpen(prev => !prev), { description: 'Command Palette', category: 'Global' });
    keyboardService.register('mod+/', () => setSidebarMode(prev => prev === 'expanded' ? 'rail' : 'expanded'), { description: 'Sidebar toggle', category: 'Global' });
    keyboardService.register('mod+shift+d', () => setDarkMode(!isDarkMode()), { description: 'Dark Mode toggle', category: 'Global' });
    keyboardService.register('escape', () => setCmdPaletteOpen(false), { description: 'Schließen', category: 'Global' });
    return () => { keyboardService.unregister('mod+k'); keyboardService.unregister('mod+/'); keyboardService.unregister('mod+shift+d'); keyboardService.unregister('escape'); };
  }, []);

  useEffect(() => {
    const check = (): void => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarMode('rail');
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const grouped = useMemo(() => groupNavPlugins(visiblePlugins), [visiblePlugins]);

  const renderNavItem = (plugin: TeamFlowPlugin): React.ReactElement => {
    const Icon = getIcon(plugin.icon);
    const isActive = plugin.id === activeId;
    const isRail = sidebarMode === 'rail';
    return (
      <button key={plugin.id}
        onClick={() => { goToPlugin(plugin.id); if (isMobile) setSidebarMode('rail'); }}
        title={isRail ? displayName(plugin) : undefined}
        className={`flex items-center w-full py-[8px] rounded-[var(--tf-radius)] text-[13.5px] transition-colors cursor-pointer ${
          isRail ? 'justify-center px-0' : 'gap-2.5 px-3'
        } ${
          isActive ? 'bg-[var(--tf-primary-light)] text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
        }`}
        style={isActive ? { borderLeft: '2px solid var(--tf-primary)' } : undefined}>
        <Icon size={16} className={isActive ? 'opacity-80' : 'opacity-50'} />
        {!isRail && <span>{displayName(plugin)}</span>}
        {!isRail && plugin.navHint === 'global' && (
          <span className="ml-auto flex items-center" title="Änderungen wirken für alle Nutzer">
            <Icons.Globe size={13} className="text-[var(--tf-text-tertiary)]" />
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} items={commandItems} />
      <BridgeDisconnectHint />
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--tf-bg)]">
      <div className="flex flex-1 overflow-hidden">
        <aside
          data-tour="nav-sidebar"
          className={`flex flex-col bg-[var(--tf-bg-sidebar)] overflow-hidden shrink-0 ${sidebarDragging ? '' : 'transition-[width] duration-200'}`}
          style={{ width: sidebarMode === 'expanded' ? sidebarWidth : SIDEBAR_RAIL_WIDTH }}
        >
          <div className={`flex items-center ${sidebarMode === 'expanded' ? 'justify-between pl-4 pr-1' : 'justify-center px-1'} pt-4 pb-2 shrink-0`}>
            {sidebarMode === 'expanded' && (
              <div>
                <span className="text-[15px] font-medium text-[var(--tf-text)]">{runtimeConfig.build.label}</span>
              </div>
            )}
            <button onClick={toggleSidebar}
              title={sidebarMode === 'expanded' ? 'Sidebar einklappen' : 'Sidebar ausklappen'}
              className="p-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)] cursor-pointer">
              <Icons.PanelLeft size={18} />
            </button>
          </div>

          {sidebarMode === 'expanded' && <ProgrammSwitcher />}

          <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col">
            {/* Arbeits-Gruppe: workflow + tools, fortlaufend ohne Label. */}
            {(['workflow', 'tools'] as const).map(cat => {
              const items = grouped[cat];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-1">
                  {items.map(renderNavItem)}
                </div>
              );
            })}

            {/* Spacer schiebt die System-/Kuration-Gruppe an den unteren Rand.
                Kollabiert, wenn die Liste den Platz füllt → dann scrollt die nav. */}
            <div className="flex-1 min-h-[8px]" />

            {/* System-Gruppe: Trennlinie OHNE Label (Skill-Verwaltung, Einstellungen). */}
            {grouped.system.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                {grouped.system.map(renderNavItem)}
              </div>
            )}

            {/* Kuration-Gruppe: Trennlinie + Uppercase-Label (nur Kurator-Builds). */}
            {grouped.kuration.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                {sidebarMode === 'expanded' && (
                  <div className="px-3 mb-2">
                    <span className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">Kuration</span>
                  </div>
                )}
                {grouped.kuration.map(renderNavItem)}
              </div>
            )}
          </nav>

          <div className="px-2 py-1.5 shrink-0 flex flex-col" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
            {sidebarMode === 'expanded' ? (
              <>
                {/* Zeile 1: „Zeig es mir" (links) + Feedback-Übersicht-Icon + Version
                    (rechts). Das Icon öffnet direkt das Feedback-Board (Übersicht);
                    Feedback *geben* liegt auf dem globalen FAB unten rechts. */}
                <div className="flex items-center justify-between gap-1">
                  <FooterShowcaseButton activeId={activeId} pageName={pageName} />
                  <div className="flex items-center gap-1.5">
                    {isFeedbackEnabled() && (
                      <button
                        type="button"
                        onClick={() => navigate('/feedback-board')}
                        title="Feedback-Übersicht"
                        aria-label="Feedback-Übersicht öffnen"
                        className="p-1 rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-primary)] hover:bg-[var(--tf-hover)] cursor-pointer"
                      >
                        <Icons.MessagesSquare size={15} />
                      </button>
                    )}
                    <BuildInfo />
                  </div>
                </div>
                {/* Dünne Trennlinie zwischen den beiden Zeilen — volle Breite wie
                    die obere Fußzeilen-Kante (`-mx-2` hebt das Container-Padding auf). */}
                <div className="-mx-2 my-1.5" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
                {/* Zeile 2: Status-Ampeln („Variante D": Punkt+Wort) gleichmäßig
                    über die verfügbare Breite verteilt — `justify-between` skaliert
                    responsiv mit der Sidebar-Breite, `gap-1` hält den Mindestabstand
                    beim Verschmälern. */}
                <div className="flex items-center justify-between gap-1">
                  <SyncStatusIndicator />
                  {/* CSV-Import-Stand — nur in Import-Rollen (pl/kurator/dev),
                      gleiches Gate wie „CSV-Quellen-Ordner" in den Einstellungen. */}
                  {(isCsvAutoRefreshEnabled() || isKuratorMenusEnabled()) && <CsvFreshnessIndicator />}
                  <BridgeStatusIndicator />
                </div>
              </>
            ) : (
              /* Rail (52 px): nur die Ampeln als reine Punkte, zentriert. */
              <div className="flex items-center justify-center gap-1.5">
                <SyncStatusIndicator compact />
                {(isCsvAutoRefreshEnabled() || isKuratorMenusEnabled()) && <CsvFreshnessIndicator compact />}
                <BridgeStatusIndicator compact />
              </div>
            )}
          </div>
        </aside>

        {sidebarMode === 'expanded' && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Sidebar-Breite ändern"
            onMouseDown={onSidebarResizeMouseDown}
            className="shrink-0 w-[4px] cursor-col-resize hover:bg-[var(--tf-border-hover)] transition-colors"
            style={{ borderRight: '0.5px solid var(--tf-border)' }}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <OfflineBanner />
          {isDataShareEnabled() && (
            <SmbBanner status={smbStatus.status} lastCheck={smbStatus.lastCheck} idb={storage.idb} />
          )}
          {isDataShareEnabled() && <StartupDataUpdateBanner />}
          {(isKuratorMenusEnabled() || isCsvAutoRefreshEnabled()) && <CsvAutoRefreshBanner />}
          {isDataShareEnabled() && <NewSnapshotBanner state={snapshotWatcher} />}
          <div className="flex-1 overflow-y-auto relative">
            {children}
          </div>
        </main>
      </div>
      </div>
      {(() => {
        if (!tour.isActive || tour.activeStep === null) return null;
        const step = TOUR_STEPS[tour.activeStep];
        if (!step) return null;
        return (
          <TourOverlay
            step={step}
            stepIndex={tour.activeStep}
            totalSteps={tour.totalSteps}
            onNext={tour.next}
            onPrev={tour.prev}
            onFinish={tour.finish}
          />
        );
      })()}
      {!tour.isActive && isFeedbackEnabled() && <FeedbackButton />}
    </>
  );
}
