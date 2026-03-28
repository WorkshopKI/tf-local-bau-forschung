import { SectionHeader, ListItem } from '@/ui';
import { keyboardService } from '@/core/services/keyboard';

export function TastaturTab(): React.ReactElement {
  const shortcuts = keyboardService.getAll();
  const grouped = new Map<string, typeof shortcuts>();
  for (const s of shortcuts) {
    const list = grouped.get(s.category) ?? [];
    list.push(s);
    grouped.set(s.category, list);
  }

  const isMac = navigator.platform.includes('Mac');
  const formatCombo = (combo: string): string => {
    return combo
      .replace('mod', isMac ? '⌘' : 'Ctrl')
      .replace('shift', isMac ? '⇧' : 'Shift')
      .replace('alt', isMac ? '⌥' : 'Alt')
      .split('+').join(isMac ? '' : '+');
  };

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([category, items]) => (
        <div key={category}>
          <SectionHeader label={category} />
          {items.map((s, i) => (
            <ListItem key={s.combo}
              title={s.description}
              meta={<span className="text-[12px] font-mono text-[var(--tf-text-tertiary)] bg-[var(--tf-bg-secondary)] px-2 py-0.5 rounded">{formatCombo(s.combo)}</span>}
              last={i === items.length - 1}
            />
          ))}
        </div>
      ))}
      {shortcuts.length === 0 && (
        <p className="text-[13px] text-[var(--tf-text-secondary)]">Keine Shortcuts registriert</p>
      )}
    </div>
  );
}
