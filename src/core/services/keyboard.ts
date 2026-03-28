interface ShortcutEntry {
  combo: string;
  handler: () => void;
  description: string;
  category: string;
  global: boolean;
}

function parseCombo(combo: string): { key: string; mod: boolean; shift: boolean; alt: boolean } {
  const parts = combo.toLowerCase().split('+');
  return {
    key: parts[parts.length - 1] ?? '',
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
}

function matchesCombo(e: KeyboardEvent, parsed: ReturnType<typeof parseCombo>): boolean {
  const modPressed = e.metaKey || e.ctrlKey;
  if (parsed.mod && !modPressed) return false;
  if (!parsed.mod && modPressed) return false;
  if (parsed.shift !== e.shiftKey) return false;
  if (parsed.alt !== e.altKey) return false;
  return e.key.toLowerCase() === parsed.key;
}

class KeyboardService {
  private shortcuts = new Map<string, ShortcutEntry>();
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    document.addEventListener('keydown', (e) => {
      for (const entry of this.shortcuts.values()) {
        const parsed = parseCombo(entry.combo);
        if (matchesCombo(e, parsed)) {
          e.preventDefault();
          entry.handler();
          return;
        }
      }
    });
  }

  register(combo: string, handler: () => void, options: { description: string; category?: string; global?: boolean }): void {
    this.shortcuts.set(combo, {
      combo,
      handler,
      description: options.description,
      category: options.category ?? 'Global',
      global: options.global ?? false,
    });
  }

  unregister(combo: string): void {
    this.shortcuts.delete(combo);
  }

  getAll(): ShortcutEntry[] {
    return Array.from(this.shortcuts.values());
  }
}

export const keyboardService = new KeyboardService();
export type { ShortcutEntry };
