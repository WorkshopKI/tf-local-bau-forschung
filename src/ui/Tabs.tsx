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
    <div className="flex" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-[13.5px] transition-colors cursor-pointer -mb-px ${
            tab.id === activeTab
              ? 'text-[var(--tf-text)] font-medium'
              : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
          }`}
          style={tab.id === activeTab ? { borderBottom: '2px solid var(--tf-text)' } : undefined}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
