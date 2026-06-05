import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { useBauantraegeStore } from '@/plugins/bauantraege/store';
import { keyboardService } from '@/core/services/keyboard';
import { CommandPalette } from '@/ui/CommandPalette';
import type { CommandItem } from '@/ui/CommandPalette';
import { setDarkMode, isDarkMode } from '@/ui/theme';
import { SyncStatusIndicator } from '@/ui/SyncStatusIndicator';
import { useTourContext } from '@/core/hooks/useTour';
import { useProfile } from '@/core/hooks/useProfile';
import { TOUR_STEPS } from '@/core/components/tour/tourSteps';
import { TourOverlay } from '@/core/components/tour/TourOverlay';
import { FeedbackButton } from '@/components/feedback';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { useKuratorActivityTracker } from '@/core/hooks/useKuratorActivityTracker';
import { ensureDefaultProgramm } from '@/core/services/csv';
import { getSmbHandle } from '@/core/services/infrastructure/smb-handle';
import { SmbBanner } from '@/core/components/SmbBanner';
import { OfflineBanner } from '@/core/OfflineBanner';
import { NewSnapshotBanner } from '@/core/components/NewSnapshotBanner';
import { useSnapshotWatcher } from '@/core/hooks/useSnapshotWatcher';
import { useAuslastungCorpusAutoload } from '@/core/hooks/useAuslastungCorpusAutoload';
import { CsvAutoRefreshBanner } from '@/plugins/csv-sources-kuration/components/CsvAutoRefreshBanner';
import { ProgrammSwitcher } from '@/core/components/ProgrammSwitcher';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { pluginIdToRoute, routeToPluginId } from '@/core/routes';
import { runtimeConfig } from '@/config/runtime-config';
import {
  isAntraegeEnabled,
  isBauantraegeEnabled,
  isFeedbackEnabled,
  isKuratorMenusEnabled,
  isCsvAutoRefreshEnabled,
  isDataShareEnabled,
  menuLabel,
} from '@/config/feature-flags';
import { BuildInfo } from '@/core/components/BuildInfo';
import { useAutoSmbRefresh } from '@/dev-fixtures/useAutoSmbRefresh';

interface ShellLayoutProps {
  plugins: TeamFlowPlugin[];
  department?: 'antraege' | 'bauantraege' | 'beide';
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
    case 'bauantraege': return menuLabel('bauantraege', plugin.name);
    case 'dokumente':   return menuLabel('dokumente', plugin.name);
    default:            return plugin.name;
  }
}

export function ShellLayout({ plugins, department = 'beide', children }: ShellLayoutProps): React.ReactElement {
  const { profile } = useProfile();
  // Runtime-Gate: Kurator-Modus nur aktiv wenn Profil *und* Build-Flag stimmen.
  // Build-Time-Filter in `plugins.config.ts:45` entfernt `category: 'kuration'`
  // — der Runtime-Check hier schützt zusätzlich Plugins die `kuratorOnly: true`
  // mit anderer Kategorie kombinieren (falls künftig eingeführt) und ignoriert
  // Legacy-Profile aus Dev-Builds die versehentlich mit Prod-Build geöffnet werden.
  const isKurator = !!(profile?.is_kurator ?? profile?.is_admin) && isKuratorMenusEnabled();
  const location = useLocation();
  const navigate = useNavigate();

  // Department-Filter nur greifen wenn BEIDE Bereiche im Build aktiv sind.
  // Bauantraege sind synthetisch und nur in der demo-Variante an — wenn das
  // Flag aus ist, ignorieren wir ein eventuell altes `department: 'bauantraege'`-
  // Profil (sonst wuerde der User in dev/prod faelschlich kein Antraege-Plugin
  // sehen). Plugin-Existenz selbst ist schon ueber `features.bauantraege` in
  // `plugins.config.ts` zur Build-Zeit gegated.
  const bothDepartmentsActive = isAntraegeEnabled() && isBauantraegeEnabled();
  const visiblePlugins = useMemo(() => {
    return plugins.filter(p => {
      const kuratorOnly = p.kuratorOnly ?? p.adminOnly;
      if (kuratorOnly && !isKurator) return false;
      if (bothDepartmentsActive) {
        if (department === 'antraege' && p.id === 'bauantraege') return false;
        if (department === 'bauantraege' && p.id === 'antraege') return false;
      }
      return true;
    });
  }, [plugins, department, isKurator, bothDepartmentsActive]);

  const activeId = routeToPluginId(location.pathname) ?? 'home';
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

  // Snapshot-Watcher: alle 15 Min Manifest checken, ob ein anderer Kurator
  // einen neueren Datenbestand geschrieben hat. Banner wird im <main>-
  // Bereich gerendert. Im Demo-Build deaktiviert (kein Daten-Share).
  const snapshotWatcher = useSnapshotWatcher({ enabled: isDataShareEnabled() });

  // v2.29: Auslastungs-Embedding-Korpus beim Start vom Daten-Share laden
  // (Cold-Start-Selbstheilung), nicht erst beim Navigieren ins Modul. Self-gated
  // auf isAuslastungEnabled() (pl + dev) + SMB-online.
  useAuslastungCorpusAutoload();

  const goToPlugin = useCallback((pluginId: string) => {
    // Beim Wechsel zu Listen-Plugins: Detail-State in Stores clearen (Route-Param fehlt → Effekt clearet ohnehin, aber wir machen es hier explizit)
    if (pluginId === 'bauantraege') useBauantraegeStore.getState().setSelectedId(null);
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

  const sortedPlugins = useMemo(() => [...visiblePlugins].sort((a, b) => a.order - b.order), [visiblePlugins]);

  const commandItems = useMemo((): CommandItem[] => {
    const isMac = navigator.platform.includes('Mac');
    const mod = isMac ? '⌘' : 'Ctrl+';
    const items: CommandItem[] = [];
    sortedPlugins.forEach((p, i) => {
      items.push({ id: `nav-${p.id}`, label: displayName(p), category: 'Navigation', shortcut: i < 7 ? `${mod}${i + 1}` : undefined, action: () => goToPlugin(p.id) });
    });
    items.push({ id: 'act-dark', label: 'Dark Mode umschalten', category: 'Einstellungen', shortcut: `${mod}⇧D`, action: () => setDarkMode(!isDarkMode()) });
    items.push({ id: 'act-sidebar', label: 'Sidebar ein-/einklappen', category: 'Einstellungen', shortcut: `${mod}/`, action: toggleSidebar });
    return items;
  }, [sortedPlugins, goToPlugin, toggleSidebar]);

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

  const grouped = useMemo(() => {
    const sorted = [...visiblePlugins].sort((a, b) => a.order - b.order);
    const groups: Record<string, TeamFlowPlugin[]> = { workflow: [], tools: [], kuration: [] };
    for (const p of sorted) groups[p.category]?.push(p);
    return groups;
  }, [visiblePlugins]);

  return (
    <>
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} items={commandItems} />
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

          <nav className="flex-1 overflow-y-auto px-2 py-2">
            {(['workflow', 'tools'] as const).map(cat => {
              const items = grouped[cat];
              if (!items || items.length === 0) return null;
              return (
                <div key={cat} className="mb-1">
                  {items.map(plugin => {
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
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {(grouped.kuration?.length ?? 0) > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                {sidebarMode === 'expanded' && (
                  <div className="px-3 mb-2">
                    <span className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">Kuration</span>
                  </div>
                )}
                {grouped.kuration?.map(plugin => {
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
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          <div className={`px-2 py-1 shrink-0 flex items-center gap-1 ${sidebarMode === 'rail' ? 'justify-center' : ''}`} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
            <button
              onClick={() => tour.start()}
              className={`relative flex items-center py-1.5 rounded-[var(--tf-radius)] text-[11px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] transition-colors cursor-pointer shrink-0 ${
                sidebarMode === 'expanded' ? 'gap-1.5 px-2' : 'justify-center px-1.5'
              }`}
              title="Onboarding-Tour starten"
            >
              <Icons.PlayCircle size={12} className="opacity-60" />
              {sidebarMode === 'expanded' && <span>Neu hier?</span>}
              {!tour.hasCompleted && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--tf-primary)] animate-pulse" />
              )}
            </button>
            {sidebarMode === 'expanded' && (
              <>
                <div className="flex-1 min-w-0">
                  <SyncStatusIndicator />
                </div>
                <BuildInfo />
              </>
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
