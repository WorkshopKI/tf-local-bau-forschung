import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { pluginIdToRoute, routeToPluginId } from '@/core/routes';
import { runtimeConfig } from '@/config/runtime-config';
import { isFeedbackEnabled, isKuratorMenusEnabled, menuLabel } from '@/config/feature-flags';
import { BuildInfo } from '@/core/components/BuildInfo';
import { DevQuickBar } from '@/dev-fixtures/DevQuickBar';
import { useAutoSmbRefresh } from '@/dev-fixtures/useAutoSmbRefresh';

interface ShellLayoutProps {
  plugins: TeamFlowPlugin[];
  department?: 'antraege' | 'bauantraege' | 'beide';
  children: React.ReactNode;
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

  const visiblePlugins = useMemo(() => {
    return plugins.filter(p => {
      const kuratorOnly = p.kuratorOnly ?? p.adminOnly;
      if (kuratorOnly && !isKurator) return false;
      if (department === 'antraege' && p.id === 'bauantraege') return false;
      if (department === 'bauantraege' && p.id === 'antraege') return false;
      return true;
    });
  }, [plugins, department, isKurator]);

  const activeId = routeToPluginId(location.pathname) ?? 'home';
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  const tour = useTourContext();
  const storage = useStorage();
  const kuratorSession = useKuratorSession();
  const smbStatus = useSmbStatus();

  useKuratorActivityTracker();
  useAutoSmbRefresh(storage.idb);

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
  useEffect(() => {
    void kuratorSession.rehydrate(storage.idb);
    smbStatus.startPolling(storage.idb);
    void (async () => {
      const h = await getSmbHandle(storage.idb);
      if (h) {
        await ensureDefaultProgramm(storage.idb).catch(() => undefined);
      }
    })();
    return () => { smbStatus.stopPolling(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h = window.setInterval(() => kuratorSession.tick(storage.idb), 60_000);
    return () => window.clearInterval(h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedPlugins = useMemo(() => [...visiblePlugins].sort((a, b) => a.order - b.order), [visiblePlugins]);

  const commandItems = useMemo((): CommandItem[] => {
    const isMac = navigator.platform.includes('Mac');
    const mod = isMac ? '⌘' : 'Ctrl+';
    const items: CommandItem[] = [];
    sortedPlugins.forEach((p, i) => {
      items.push({ id: `nav-${p.id}`, label: displayName(p), category: 'Navigation', shortcut: i < 7 ? `${mod}${i + 1}` : undefined, action: () => goToPlugin(p.id) });
    });
    items.push({ id: 'act-dark', label: 'Dark Mode umschalten', category: 'Einstellungen', shortcut: `${mod}⇧D`, action: () => setDarkMode(!isDarkMode()) });
    items.push({ id: 'act-sidebar', label: 'Sidebar ein/ausblenden', category: 'Einstellungen', shortcut: `${mod}/`, action: () => setSidebarOpen(prev => !prev) });
    return items;
  }, [sortedPlugins, goToPlugin]);

  useEffect(() => {
    keyboardService.init();
    keyboardService.register('mod+k', () => setCmdPaletteOpen(prev => !prev), { description: 'Command Palette', category: 'Global' });
    keyboardService.register('mod+/', () => setSidebarOpen(prev => !prev), { description: 'Sidebar toggle', category: 'Global' });
    keyboardService.register('mod+shift+d', () => setDarkMode(!isDarkMode()), { description: 'Dark Mode toggle', category: 'Global' });
    keyboardService.register('escape', () => setCmdPaletteOpen(false), { description: 'Schließen', category: 'Global' });
    return () => { keyboardService.unregister('mod+k'); keyboardService.unregister('mod+/'); keyboardService.unregister('mod+shift+d'); keyboardService.unregister('escape'); };
  }, []);

  useEffect(() => {
    const check = (): void => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
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
      {__TEAMFLOW_DEV_FIXTURES__ && <DevQuickBar />}
      <div className="flex flex-1 overflow-hidden">
        <aside
          data-tour="nav-sidebar"
          className="flex flex-col bg-[var(--tf-bg-sidebar)] transition-all duration-200 overflow-hidden shrink-0"
          style={{ width: sidebarOpen ? 'var(--tf-sidebar-w)' : '0px', borderRight: '0.5px solid var(--tf-border)' }}
        >
          <div className="flex items-center justify-between pl-4 pr-1 pt-4 pb-2 shrink-0">
            <div>
              <span className="text-[15px] font-medium text-[var(--tf-text)]">{runtimeConfig.build.label}</span>
              <span className="block text-[12px] text-[var(--tf-text-secondary)]">Verwaltung</span>
            </div>
            <button onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)] cursor-pointer">
              <Icons.PanelLeftClose size={18} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-2">
            {(['workflow', 'tools'] as const).map(cat => {
              const items = grouped[cat];
              if (!items || items.length === 0) return null;
              return (
                <div key={cat} className="mb-1">
                  {items.map(plugin => {
                    const Icon = getIcon(plugin.icon);
                    const isActive = plugin.id === activeId;
                    return (
                      <button key={plugin.id}
                        onClick={() => { goToPlugin(plugin.id); if (isMobile) setSidebarOpen(false); }}
                        className={`flex items-center gap-2.5 w-full px-3 py-[8px] rounded-[var(--tf-radius)] text-[13.5px] transition-colors cursor-pointer ${
                          isActive ? 'bg-[var(--tf-primary-light)] text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                        }`}
                        style={isActive ? { borderLeft: '2px solid var(--tf-primary)' } : undefined}>
                        <Icon size={16} className={isActive ? 'opacity-80' : 'opacity-50'} />
                        <span>{displayName(plugin)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {(grouped.kuration?.length ?? 0) > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                <div className="px-3 mb-2">
                  <span className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">Kuration</span>
                </div>
                {grouped.kuration?.map(plugin => {
                  const Icon = getIcon(plugin.icon);
                  const isActive = plugin.id === activeId;
                  return (
                    <button key={plugin.id}
                      onClick={() => { goToPlugin(plugin.id); if (isMobile) setSidebarOpen(false); }}
                      className={`flex items-center gap-2.5 w-full px-3 py-[8px] rounded-[var(--tf-radius)] text-[13.5px] transition-colors cursor-pointer ${
                        isActive ? 'bg-[var(--tf-primary-light)] text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                      }`}
                      style={isActive ? { borderLeft: '2px solid var(--tf-primary)' } : undefined}>
                      <Icon size={16} className={isActive ? 'opacity-80' : 'opacity-50'} />
                      <span>{displayName(plugin)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          <div className="shrink-0" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
            <BuildInfo />
          </div>
          <div className="px-2 py-1 shrink-0 flex items-center gap-1" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
            <button
              onClick={() => tour.start()}
              className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--tf-radius)] text-[11px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] transition-colors cursor-pointer shrink-0"
              title="Onboarding-Tour starten"
            >
              <Icons.PlayCircle size={12} className="opacity-60" />
              <span>Neu hier?</span>
              {!tour.hasCompleted && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--tf-primary)] animate-pulse" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <SyncStatusIndicator />
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <SmbBanner status={smbStatus.status} lastCheck={smbStatus.lastCheck} idb={storage.idb} />
          <div className="flex-1 overflow-y-auto relative">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)}
                className="fixed top-3 left-3 z-10 p-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)] cursor-pointer bg-[var(--tf-bg)]"
                style={{ border: '0.5px solid var(--tf-border)' }}>
                <Icons.PanelLeftOpen size={16} />
              </button>
            )}
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
