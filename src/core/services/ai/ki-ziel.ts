/**
 * Globale Modell-Präferenz für die interne KI: welches Modell ein Lauf ansteuert —
 * `'gpt-oss'` (gpt-oss-120b, 62k Kontext) oder `'qwen35'` (Qwen3.6-35B, 259k).
 *
 * DEFAULT `'gpt-oss'` — das kleinere, schnellere Modell; es ist auch das, auf dem
 * die interne KI ausgeliefert wird. Wo der Umfang nicht hineinpasst, hebt der
 * Auto-Wechsel den Lauf selbst an ([modell-wahl.ts](./modell-wahl.ts)).
 *
 * Die Präferenz wird an ALLE Skill-Läufe (Gutachten/Kurzfassung/NF/Aufbereitung)
 * und den Chat durchgereicht (`SkillRunInput.ziel` / `SubmitMessageOptions.ziel`)
 * und ist an den Arbeitsstellen wählbar.
 *
 * Einfacher UI-Flag → localStorage (origin-weit, variantenübergreifend; erlaubt für
 * simple Präferenzen). Kein Share-/IDB-Write.
 */
import { create } from 'zustand';
import type { BridgeZiel } from './transports/streamlit';
import type { KontextZiel } from './llm-context';

const LS_KEY = 'teamflow_ki_ziel';

/**
 * Read-Time-Migration der bis v4 gespeicherten Werte.
 *
 * `'standard'` meinte den klassischen Chat — der läuft auf gpt-oss.
 * `'agentisch'` meinte den agentischen Chat, und der ist **Qwen3.6 plus fest
 * eingebautem Kontext**. Diesen Kontext liefert die App bewusst selbst, der
 * agentische Chat ist deshalb nicht mehr angebunden — was von ihm bleibt, ist
 * genau das Modell. Wer ihn gewählt hatte, wollte das große Fenster und behält
 * es; ihn auf gpt-oss zurückzusetzen wäre eine stille Verkleinerung.
 */
function migriere(roh: string | null): BridgeZiel {
  if (roh === 'qwen35' || roh === 'agentisch') return 'qwen35';
  return 'gpt-oss';
}

function ladeInitial(): BridgeZiel {
  try {
    return migriere(localStorage.getItem(LS_KEY));
  } catch {
    return 'gpt-oss';
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
 * Das für einen Lauf durchzureichende `ziel` — **immer explizit**.
 * Synchroner Store-Read; für Runner gedacht (kein Hook nötig).
 *
 * `undefined` wäre hier keine harmlose Abkürzung, sondern eine andere Aussage: der
 * Transport lässt das Feld dann ganz weg, und das Bookmarklet fasst die
 * Modell-Auswahl gar nicht erst an — der Lauf trifft, was zuletzt jemand
 * eingestellt hat. Die Wahl lebt in der serverseitigen Sitzung der KI-Seite und
 * bleibt dort stehen, bis sie jemand ändert.
 *
 * Dieselbe Falle gab es in der Tab-Fassung bereits dreimal (v2.292
 * `feedbackImprove`, v2.298 Aufbereitung, v2.365 die Wurzel): dort blieb der Lauf
 * im zuletzt benutzten Tab. Die Ursache ist unverändert — nur heißt sie jetzt
 * Modell statt Tab.
 */
export function aktivesZielFuerLauf(): BridgeZiel {
  return useKiZiel.getState().ziel;
}

/**
 * Lauf-Kontext für die Kontextfenster-Ableitung bei EXPLIZIT bekanntem Ziel: über
 * welche Transportart und welches Modell geht dieser Lauf?
 *
 * Nötig, wo ein Lauf sein Ziel als Parameter trägt statt es aus dem Store zu lesen —
 * etwa der Fallback-Retry oder ein Auto-Wechsel, der auf `'qwen35'` hebt, während
 * der Store noch `'gpt-oss'` sagt. Sonst misst die Cap-Rechnung gegen das falsche
 * Fenster und die „passt nicht"-Warnung schweigt genau dann, wenn sie nötig wäre.
 *
 * Der Bridge-Parameter ist strukturell, damit dieses Modul den `AIBridge`-Typ nicht
 * importieren muss (kein Zyklus).
 */
export function kontextZielFuer(
  bridge: { istBridgeAktiv: () => boolean },
  ziel: BridgeZiel,
): KontextZiel {
  return { bridge: bridge.istBridgeAktiv(), ziel };
}

/**
 * Lauf-Kontext für die Kontextfenster-Ableitung aus der globalen Präferenz — die
 * Anzeige-Variante (Warnungen, Inventare), wo kein konkreter Lauf im Spiel ist.
 * Eine Ableitung, keine zweite: führt auf `kontextZielFuer` zurück.
 */
export function kontextZielFuerLauf(bridge: { istBridgeAktiv: () => boolean }): KontextZiel {
  return kontextZielFuer(bridge, useKiZiel.getState().ziel);
}
