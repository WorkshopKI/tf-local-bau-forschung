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
import type { KontextZiel } from './llm-context';

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

/**
 * Lauf-Kontext für die Kontextfenster-Ableitung: über welche Transportart und
 * welchen Bridge-Tab geht dieser Lauf?
 *
 * Anders als `aktivesZielFuerLauf` wird `'standard'` hier **mitgegeben** — für die
 * Cap-Rechnung ist der Standard-Tab eine echte Aussage (62k), nicht die Abwesenheit
 * einer Aussage. Der Bridge-Parameter ist strukturell, damit dieses Modul den
 * `AIBridge`-Typ nicht importieren muss (kein Zyklus).
 */
export function kontextZielFuerLauf(bridge: { istBridgeAktiv: () => boolean }): KontextZiel {
  return { bridge: bridge.istBridgeAktiv(), ziel: useKiZiel.getState().ziel };
}

/**
 * Soll beim Umschalten der Variante gewarnt werden?
 *
 * Hintergrund: Aus TeamFlow-Sicht ist die Bridge **single-turn** — gesendet wird
 * nur die letzte Nutzer-Nachricht plus System-Prompt (`streamConversation`). Der
 * Gesprächsfaden eines mehrturnigen Chats liegt damit ausschliesslich in der
 * serverseitigen Historie des Streamlit-Tabs. Ein Variantenwechsel wechselt den
 * Tab — der neue kennt die bisherigen Züge nicht.
 *
 * Nur warnen, wenn das auch wirklich eintritt: bei aktiver Bridge (ohne sie gibt
 * es keine Tabs), bei laufendem Gespräch (sonst gibt es nichts zu verlieren) und
 * bei echtem Wechsel (derselbe Knopf nochmal ist keiner). Rein.
 */
export function sollWechselHinweisZeigen(eingabe: {
  bridgeAktiv: boolean;
  gespraechLaeuft: boolean;
  altesZiel: BridgeZiel;
  neuesZiel: BridgeZiel;
}): boolean {
  return eingabe.bridgeAktiv
    && eingabe.gespraechLaeuft
    && eingabe.altesZiel !== eingabe.neuesZiel;
}
