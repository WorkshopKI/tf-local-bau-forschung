/**
 * Globale Modell-Präferenz für die interne KI — als **Rolle**, nicht als Modell:
 * `'standard'` (das bodenständige) oder `'stark'` (weites Fenster, agentisch).
 * Welches Modell die Rolle gerade trägt, entscheidet der Katalog gegen die von der
 * Bridge gemeldete Auswahlliste ([modell-katalog.ts](./modell-katalog.ts)).
 *
 * DEFAULT `'standard'` — das, worauf die interne KI ausgeliefert wird. Wo der
 * Umfang nicht hineinpasst, hebt der Auto-Wechsel den Lauf selbst an
 * ([modell-wahl.ts](./modell-wahl.ts)).
 *
 * Die Präferenz wird an ALLE Skill-Läufe (Gutachten/Kurzfassung/NF/Aufbereitung)
 * und den Chat durchgereicht (`SkillRunInput.ziel` / `SubmitMessageOptions.ziel`)
 * und ist an den Arbeitsstellen wählbar.
 *
 * Einfacher UI-Flag → localStorage (origin-weit, variantenübergreifend; erlaubt für
 * simple Präferenzen). Kein Share-/IDB-Write.
 */
import { create } from 'zustand';
import type { KiRolle } from './modell-katalog';
import type { KontextZiel } from './llm-context';

const LS_KEY = 'teamflow_ki_ziel';

/**
 * Read-Time-Migration **zweier** Generationen gespeicherter Werte.
 *
 * Bis v4 stand hier ein TAB (`'standard'` / `'agentisch'`), in v5 ein MODELL
 * (`'gpt-oss'` / `'qwen35'`), seit v6 eine ROLLE. Alle vier Alt-Werte fallen
 * eindeutig:
 *
 *  - `'standard'` (der klassische Chat) → `'standard'`. Wandert auf sich selbst,
 *    und zwar zu Recht: der klassische Chat läuft auf dem Modell, das die interne
 *    KI voreingestellt hat — genau die Bedeutung, die die Rolle jetzt trägt.
 *  - `'gpt-oss'` → `'standard'`, denn das war dieses Modell.
 *  - `'agentisch'` → `'stark'`. Der agentische Chat ist Qwen3.6 **plus fest
 *    eingebautem Kontext**; den Kontext liefert diese App bewusst selbst, also ist
 *    er nicht angebunden — was von ihm bleibt, ist der Anspruch. Wer ihn gewählt
 *    hatte, wollte das grosse Fenster und behält es.
 *  - `'qwen35'` → `'stark'`, denn das war dieses Modell.
 *
 * Alles Unbekannte fällt auf `'standard'`: die konservative Richtung, weil ein zu
 * klein angenommenes Fenster sichtbar kürzt statt still zu überlaufen.
 */
function migriere(roh: string | null): KiRolle {
  if (roh === 'stark' || roh === 'agentisch' || roh === 'qwen35') return 'stark';
  return 'standard';
}

function ladeInitial(): KiRolle {
  try {
    return migriere(localStorage.getItem(LS_KEY));
  } catch {
    return 'standard';
  }
}

interface KiZielStore {
  ziel: KiRolle;
  setZiel: (ziel: KiRolle) => void;
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
export function aktivesZielFuerLauf(): KiRolle {
  return useKiZiel.getState().ziel;
}

/**
 * Lauf-Kontext für die Kontextfenster-Ableitung bei EXPLIZIT bekanntem Ziel: über
 * welche Transportart und welches Modell geht dieser Lauf?
 *
 * Nötig, wo ein Lauf sein Ziel als Parameter trägt statt es aus dem Store zu lesen —
 * etwa der Fallback-Retry oder ein Auto-Wechsel, der auf `'stark'` hebt, während
 * der Store noch `'standard'` sagt. Sonst misst die Cap-Rechnung gegen das falsche
 * Fenster und die „passt nicht"-Warnung schweigt genau dann, wenn sie nötig wäre.
 *
 * Der Bridge-Parameter ist strukturell, damit dieses Modul den `AIBridge`-Typ nicht
 * importieren muss (kein Zyklus).
 */
export function kontextZielFuer(
  bridge: { istBridgeAktiv: () => boolean },
  ziel: KiRolle,
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
