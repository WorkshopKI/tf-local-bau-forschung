interface Tab {
  id: string;
  label: string;
  /** Optional badge count shown after the label. */
  badge?: number;
  /** Optionaler Hover-Tooltip (native `title`) auf dem Tab. */
  tooltip?: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps): React.ReactElement {
  return (
    <div
      role="tablist"
      className="flex flex-nowrap overflow-x-auto overflow-y-hidden whitespace-nowrap [scrollbar-width:thin]"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTab}
          title={tab.tooltip}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 whitespace-nowrap px-4 py-2 text-[13.5px] transition-colors cursor-pointer -mb-px ${
            tab.id === activeTab
              ? 'text-[var(--tf-text)] font-medium'
              : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
          }`}
          style={tab.id === activeTab ? { borderBottom: '2px solid var(--tf-text)' } : undefined}
        >
          {tab.label}
          {tab.badge != null && (
            <span className="ml-1.5 inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
