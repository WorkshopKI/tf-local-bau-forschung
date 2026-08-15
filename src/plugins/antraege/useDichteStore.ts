/**
 * Zeilendichte der Förderanträge-Tabelle.
 *
 * **Zwei Stufen, nicht drei.** Der Redesign-Handoff kennt Kompakt / Normal /
 * Luftig; „Luftig" fehlt hier bewusst — eine Tabelle, die zum Sichten von ein
 * paar tausend Vorgängen dient, gewinnt nichts durch eine dritte, noch
 * großzügigere Stufe, und jede Stufe ist eine Zeile mehr im Menü.
 *
 * **Kompakt ist der Standard und entspricht dem bisherigen Aussehen.** Wer nichts
 * umstellt, sieht die Tabelle von heute; „Normal" ist das Angebot nach oben.
 */
import { create } from 'zustand';

export type Dichte = 'kompakt' | 'normal';

export const DEFAULT_DICHTE: Dichte = 'kompakt';

/** Werte + Beschriftungen — zugleich die Whitelist der Persistenz. */
export const DICHTE_OPTIONS: readonly { key: Dichte; label: string }[] = [
  { key: 'kompakt', label: 'Kompakt' },
  { key: 'normal', label: 'Normal' },
];

const STORAGE_KEY = 'teamflow_antraege_table_dichte';

export function istDichte(v: unknown): v is Dichte {
  return DICHTE_OPTIONS.some(o => o.key === v);
}

function laden(): Dichte {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return istDichte(raw) ? raw : DEFAULT_DICHTE;
  } catch {
    return DEFAULT_DICHTE;
  }
}

interface DichteStore {
  dichte: Dichte;
  setzeDichte: (d: Dichte) => void;
}

export const useDichteStore = create<DichteStore>(set => ({
  dichte: laden(),
  setzeDichte: (d) => {
    try { localStorage.setItem(STORAGE_KEY, d); } catch { /* ignore */ }
    set({ dichte: d });
  },
}));
