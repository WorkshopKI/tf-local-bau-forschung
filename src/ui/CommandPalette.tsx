import { useState, useEffect, useRef, useMemo } from 'react';

interface CommandItem {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({ open, onClose, items }: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQuery(''); setSelectedIndex(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter(i => fuzzyMatch(query, i.label) || fuzzyMatch(query, i.category));
  }, [query, items]);

  const grouped = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return groups;
  }, [filtered]);

  const flatItems = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    if (selectedIndex >= flatItems.length) setSelectedIndex(Math.max(0, flatItems.length - 1));
  }, [flatItems.length, selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && flatItems[selectedIndex]) { flatItems[selectedIndex].action(); onClose(); }
    else if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  let itemIndex = 0;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="flex justify-center pt-[15vh]" onClick={e => e.stopPropagation()}>
        <div className="w-full max-w-lg bg-[var(--tf-bg)] rounded-[var(--tf-radius-lg)] overflow-hidden"
          style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
          <div className="p-3" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
            <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown} placeholder="Aktion suchen..."
              className="w-full px-3 py-2 text-[14px] bg-transparent text-[var(--tf-text)] outline-none placeholder:text-[var(--tf-text-tertiary)]" />
          </div>
          <div className="max-h-[320px] overflow-y-auto py-1">
            {flatItems.length === 0 && (
              <p className="px-4 py-6 text-center text-[13px] text-[var(--tf-text-tertiary)]">Keine Treffer</p>
            )}
            {Array.from(grouped.entries()).map(([category, categoryItems]) => (
              <div key={category}>
                <p className="px-4 pt-2 pb-1 text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">{category}</p>
                {categoryItems.map(item => {
                  const isSelected = itemIndex === selectedIndex;
                  const idx = itemIndex;
                  itemIndex++;
                  return (
                    <button key={item.id}
                      onClick={() => { item.action(); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between w-full px-4 py-2 text-[13px] text-[var(--tf-text)] cursor-pointer ${isSelected ? 'bg-[var(--tf-hover)]' : ''}`}>
                      <span>{item.label}</span>
                      {item.shortcut && <span className="text-[11px] text-[var(--tf-text-tertiary)] font-mono">{item.shortcut}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { CommandItem };
