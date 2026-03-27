interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps): React.ReactElement {
  return (
    <div className="flex border-b border-[var(--tf-border)]">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer -mb-px ${
            tab.id === activeTab
              ? 'text-[var(--tf-primary)] border-b-2 border-[var(--tf-primary)]'
              : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
