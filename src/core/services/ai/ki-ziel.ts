/**
 * Globale KI-Varianten-Präferenz: welche interne KI ein Lauf ansteuert —
 * `'standard'` (klassische interne KI) oder `'agentisch'` (agentische interne KI).
 *
 * DEFAULT `'standard'` — der agentische Chat ist eine Erprobung; produktive Läufe
 * bleiben ohne aktive Umstellung auf dem Standard-Tab (Verhalten byte-identisch).
 * Die Präferenz wird an ALLE Skill-Läufe (Gutachten/Kurzfassung/NF/Aufbereitung) und
 * den Chat durchgereicht (`SkillRunInput.ziel` / `SubmitMessageOptions.ziel`) und ist
 * an den KI-Verbindungs-Stellen wählbar.
 *
 * Einfacher UI-Flag → localStorage (origin-weit, variantenübergreifend; erlaubt für
 * simple Präferenzen). Kein Share-/IDB-Write.
 */
import { create } from 'zustand';
import type { BridgeZiel } from './transports/streamlit';

const LS_KEY = 'teamflow_ki_ziel';

function ladeInitial(): BridgeZiel {
  try {
    return localStorage.getItem(LS_KEY) === 'agentisch' ? 'agentisch' : 'standard';
  } catch {
    return 'standard';
  }
}

interface KiZielStore {
  ziel: BridgeZiel;
  setZiel: (ziel: BridgeZiel) => void;
}

export const useKiZiel = create<KiZielStore>((set) => ({
  ziel: ladeInitial(),
  setZiel: (ziel) => {
    try { localStorage.setItem(LS_KEY, ziel); } catch { /* localStorage optional */ }
    set({ ziel });
  },
}));

/**
 * Das für einen Lauf durchzureichende `ziel`: `'agentisch'` NUR bei aktiver agentischer
 * Präferenz, sonst `undefined` (= aktiver/Standard-Tab, Verhalten byte-identisch zu vor
 * dem Feature). So bleibt „Standard" wirklich die normale interne KI (kein erzwungenes
 * Tab-Routing). Synchroner Store-Read — für Runner (kein Hook nötig).
 */
export function aktivesZielFuerLauf(): BridgeZiel | undefined {
  return useKiZiel.getState().ziel === 'agentisch' ? 'agentisch' : undefined;
}
