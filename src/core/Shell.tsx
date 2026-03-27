import { useState, useMemo, useEffect } from 'react';
import * as Icons from 'lucide-react';
import type { TeamFlowPlugin } from '@/core/types/plugin';

interface ShellProps {
  plugins: TeamFlowPlugin[];
}

type IconComponent = React.ComponentType<{ size?: number }>;

function getIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) {
    return icon as IconComponent;
  }
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
    const groups: Record<string, TeamFlowPlugin[]> = {
      workflow: [],
      tools: [],
      admin: [],
    };
    for (const p of sorted) {
      groups[p.category]?.push(p);
    }
    return groups;
  }, [plugins]);

  const activePlugin = plugins.find(p => p.id === activeId);
  const ActiveComponent = activePlugin?.component;

  const categoryOrder: Array<'workflow' | 'tools' | 'admin'> = ['workflow', 'tools', 'admin'];

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--tf-bg)]">
      {/* Sidebar */}
      <aside
        className="flex flex-col border-r border-[var(--tf-border)] bg-[var(--tf-bg-sidebar)] transition-all duration-200 overflow-hidden shrink-0"
        style={{ width: sidebarOpen ? 'var(--tf-sidebar-w)' : '0px' }}
      >
        <div className="flex items-center gap-3 px-5 h-14 shrink-0">
          <span className="text-xl font-bold text-[var(--tf-primary)]">TeamFlow</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {categoryOrder.map((cat, catIdx) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;
            return (
              <div key={cat}>
                {catIdx > 0 && (grouped[categoryOrder[catIdx - 1] ?? '']?.length ?? 0) > 0 && (
                  <div className="border-t border-[var(--tf-border)] my-2 mx-1" />
                )}
                {items.map(plugin => {
                  const Icon = getIcon(plugin.icon);
                  const isActive = plugin.id === activeId;
                  return (
                    <button
                      key={plugin.id}
                      onClick={() => {
                        setActiveId(plugin.id);
                        if (isMobile) setSidebarOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-3 py-2 rounded-[var(--tf-radius-sm)] text-sm transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)] font-medium'
                          : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{plugin.name}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center h-14 px-4 border-b border-[var(--tf-border)] bg-[var(--tf-bg)] shrink-0">
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-2 rounded-[var(--tf-radius-sm)] hover:bg-[var(--tf-hover)] text-[var(--tf-text-secondary)] cursor-pointer"
          >
            <Icons.Menu size={20} />
          </button>
          <h2 className="ml-3 text-sm font-medium text-[var(--tf-text)]">
            {activePlugin?.name ?? ''}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto">
          {ActiveComponent ? <ActiveComponent /> : null}
        </div>
      </main>
    </div>
  );
}
