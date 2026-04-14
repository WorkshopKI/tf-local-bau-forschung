import { useState, useMemo, useEffect, useCallback } from 'react';
import * as Icons from 'lucide-react';
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { NavigationContext } from '@/core/hooks/useNavigation';
import type { NavigationParams } from '@/core/hooks/useNavigation';
import { useBauantraegeStore } from '@/plugins/bauantraege/store';
import { useForschungStore } from '@/plugins/forschung/store';
import { keyboardService } from '@/core/services/keyboard';
import { CommandPalette } from '@/ui/CommandPalette';
import type { CommandItem } from '@/ui/CommandPalette';
import { setDarkMode, isDarkMode } from '@/ui/theme';
import { SyncStatusIndicator } from '@/ui/SyncStatusIndicator';
import { useTourContext } from '@/core/hooks/useTour';
import { TOUR_STEPS } from '@/core/components/tour/tourSteps';
import { TourOverlay } from '@/core/components/tour/TourOverlay';

interface ShellProps {
  plugins: TeamFlowPlugin[];
  department?: 'bauantraege' | 'forschung' | 'beide';
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

function getIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) return icon as IconComponent;
  return Icons.HelpCircle;
}

export function Shell({ plugins, department = 'beide' }: ShellProps): React.ReactElement {
  const visiblePlugins = useMemo(() => {
    return plugins.filter(p => {
      if (department === 'bauantraege' && p.id === 'forschung') return false;
      if (department === 'forschung' && p.id === 'bauantraege') return false;
      return true;
    });
  }, [plugins, department]);

  const [activeId, setActiveId] = useState(visiblePlugins[0]?.id ?? '');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  const tour = useTourContext();

  const navigate = useCallback((pluginId: string, params?: NavigationParams) => {
    setActiveId(pluginId);
    if (params?.selectedId) {
      if (pluginId === 'bauantraege') useBauantraegeStore.getState().setSelectedId(params.selectedId);
      if (pluginId === 'forschung') useForschungStore.getState().setSelectedId(params.selectedId);
    }
  }, []);

  const sortedPlugins = useMemo(() => [...visiblePlugins].sort((a, b) => a.order - b.order), [visiblePlugins]);

  const commandItems = useMemo((): CommandItem[] => {
    const isMac = navigator.platform.includes('Mac');
    const mod = isMac ? '⌘' : 'Ctrl+';
    const items: CommandItem[] = [];
    sortedPlugins.forEach((p, i) => {
      items.push({ id: `nav-${p.id}`, label: p.name, category: 'Navigation', shortcut: i < 7 ? `${mod}${i + 1}` : undefined, action: () => setActiveId(p.id) });
    });
    items.push({ id: 'act-dark', label: 'Dark Mode umschalten', category: 'Einstellungen', shortcut: `${mod}⇧D`, action: () => setDarkMode(!isDarkMode()) });
    items.push({ id: 'act-sidebar', label: 'Sidebar ein/ausblenden', category: 'Einstellungen', shortcut: `${mod}/`, action: () => setSidebarOpen(prev => !prev) });
    return items;
  }, [sortedPlugins]);

  // Register global shortcuts
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
    const groups: Record<string, TeamFlowPlugin[]> = { workflow: [], tools: [], admin: [] };
    for (const p of sorted) groups[p.category]?.push(p);
    return groups;
  }, [visiblePlugins]);

  const activePlugin = visiblePlugins.find(p => p.id === activeId);
  const ActiveComponent = activePlugin?.component;

  return (
    <NavigationContext.Provider value={{ navigate }}>
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} items={commandItems} />
      <div className="flex h-screen overflow-hidden bg-[var(--tf-bg)]">
        <aside
          data-tour="nav-sidebar"
          className="flex flex-col bg-[var(--tf-bg-sidebar)] transition-all duration-200 overflow-hidden shrink-0"
          style={{ width: sidebarOpen ? 'var(--tf-sidebar-w)' : '0px', borderRight: '0.5px solid var(--tf-border)' }}
        >
          <div className="flex items-center justify-between pl-4 pr-1 pt-4 pb-2 shrink-0">
            <div>
              <span className="text-[15px] font-medium text-[var(--tf-text)]">TeamFlow</span>
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
                        onClick={() => { setActiveId(plugin.id); if (isMobile) setSidebarOpen(false); }}
                        className={`flex items-center gap-2.5 w-full px-3 py-[8px] rounded-[var(--tf-radius)] text-[13.5px] transition-colors cursor-pointer ${
                          isActive ? 'bg-[var(--tf-primary-light)] text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                        }`}
                        style={isActive ? { borderLeft: '2px solid var(--tf-primary)' } : undefined}>
                        <Icon size={16} className={isActive ? 'opacity-80' : 'opacity-50'} />
                        <span>{plugin.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {(grouped.admin?.length ?? 0) > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                <div className="px-3 mb-2">
                  <span className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">Admin</span>
                </div>
                {grouped.admin?.map(plugin => {
                  const Icon = getIcon(plugin.icon);
                  const isActive = plugin.id === activeId;
                  return (
                    <button key={plugin.id}
                      onClick={() => { setActiveId(plugin.id); if (isMobile) setSidebarOpen(false); }}
                      className={`flex items-center gap-2.5 w-full px-3 py-[8px] rounded-[var(--tf-radius)] text-[13.5px] transition-colors cursor-pointer ${
                        isActive ? 'bg-[var(--tf-primary-light)] text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                      }`}
                      style={isActive ? { borderLeft: '2px solid var(--tf-primary)' } : undefined}>
                      <Icon size={16} className={isActive ? 'opacity-80' : 'opacity-50'} />
                      <span>{plugin.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

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
          <div className="flex-1 overflow-y-auto relative">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)}
                className="fixed top-3 left-3 z-10 p-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)] cursor-pointer bg-[var(--tf-bg)]"
                style={{ border: '0.5px solid var(--tf-border)' }}>
                <Icons.PanelLeftOpen size={16} />
              </button>
            )}
            {ActiveComponent ? <ActiveComponent /> : null}
          </div>
        </main>
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
    </NavigationContext.Provider>
  );
}
