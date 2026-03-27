import { useState, useMemo, useEffect } from 'react';
import * as Icons from 'lucide-react';
import type { TeamFlowPlugin } from '@/core/types/plugin';

interface ShellProps {
  plugins: TeamFlowPlugin[];
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

function getIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) return icon as IconComponent;
  return Icons.HelpCircle;
}

export function Shell({ plugins }: ShellProps): React.ReactElement {
  const [activeId, setActiveId] = useState(plugins[0]?.id ?? '');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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
    const sorted = [...plugins].sort((a, b) => a.order - b.order);
    const groups: Record<string, TeamFlowPlugin[]> = { workflow: [], tools: [], admin: [] };
    for (const p of sorted) groups[p.category]?.push(p);
    return groups;
  }, [plugins]);

  const activePlugin = plugins.find(p => p.id === activeId);
  const ActiveComponent = activePlugin?.component;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--tf-bg)]">
      <aside
        className="flex flex-col bg-[var(--tf-bg-sidebar)] transition-all duration-200 overflow-hidden shrink-0"
        style={{
          width: sidebarOpen ? 'var(--tf-sidebar-w)' : '0px',
          borderRight: '0.5px solid var(--tf-border)',
        }}
      >
        <div className="flex flex-col px-4 pt-5 pb-2 shrink-0">
          <span className="text-[15px] font-medium text-[var(--tf-text)]">TeamFlow</span>
          <span className="text-[12px] text-[var(--tf-text-secondary)]">Verwaltung</span>
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
                    <button
                      key={plugin.id}
                      onClick={() => { setActiveId(plugin.id); if (isMobile) setSidebarOpen(false); }}
                      className={`flex items-center gap-2.5 w-full px-3 py-[8px] rounded-[var(--tf-radius)] text-[13.5px] transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] font-medium'
                          : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                      }`}
                    >
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
                  <button
                    key={plugin.id}
                    onClick={() => { setActiveId(plugin.id); if (isMobile) setSidebarOpen(false); }}
                    className={`flex items-center gap-2.5 w-full px-3 py-[8px] rounded-[var(--tf-radius)] text-[13.5px] transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] font-medium'
                        : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'opacity-80' : 'opacity-50'} />
                    <span>{plugin.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center h-12 px-4 shrink-0" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] text-[var(--tf-text-secondary)] cursor-pointer"
          >
            <Icons.Menu size={18} />
          </button>
          <span className="ml-3 text-[13px] text-[var(--tf-text-secondary)]">
            {activePlugin?.name ?? ''}
          </span>
        </header>
        <div className="flex-1 overflow-y-auto">
          {ActiveComponent ? <ActiveComponent /> : null}
        </div>
      </main>
    </div>
  );
}
