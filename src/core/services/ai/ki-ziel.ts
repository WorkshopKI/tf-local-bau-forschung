/**
 * Globale KI-Varianten-Präferenz: welche interne KI ein Lauf ansteuert —
 * `'standard'` (klassische interne KI) oder `'agentisch'` (agentische interne KI).
 *
 * DEFAULT `'standard'` — der agentische Chat ist eine Erprobung; produktive Läufe
 * bleiben ohne aktive Umstellung auf dem Standard-Tab.
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
 * Das für einen Lauf durchzureichende `ziel` — **immer explizit**, auch `'standard'`.
 * Synchroner Store-Read; für Runner gedacht (kein Hook nötig).
 *
 * `undefined` wäre hier keine harmlose Abkürzung, sondern eine andere Aussage: der
 * Transport lässt das Feld dann ganz weg, und das Bookmarklet steigt in `ensureZiel`
 * sofort aus (`if (!ziel) { cb(null); return; }`) — es sucht gar keinen Tab. Da
 * Streamlit die Tab-Auswahl hält und niemand sie zurückstellt, bliebe jeder Lauf im
 * zuletzt benutzten Tab. Nach einem agentischen Lauf führte aus dem agentischen Chat
 * also kein Weg zurück, egal was der Umschalter zeigte (v2.365; dritter Fall nach
 * v2.292 `feedbackImprove` und v2.298 Aufbereitung).
 *
 * Explizites `'standard'` ist bookmarklet-seitig abgedeckt: `tabMatches` sucht „chat,
 * aber nicht agentisch", und fehlt ein Tab-UI ganz, ist `ensureZiel` ein No-op — auf
 * tab-losen Oberflächen bleibt das Verhalten damit unverändert.
 */
export function aktivesZielFuerLauf(): BridgeZiel {
  return useKiZiel.getState().ziel;
}

/**
 * Lauf-Kontext für die Kontextfenster-Ableitung bei EXPLIZIT bekanntem Ziel: über
 * welche Transportart und welchen Bridge-Tab geht dieser Lauf?
 *
 * Nötig, wo ein Lauf sein Ziel als Parameter trägt statt es aus dem Store zu lesen —
 * etwa der Fallback-Retry, der auf `'standard'` wechselt, während der Store noch
 * `'agentisch'` sagt. Sonst misst die Cap-Rechnung gegen das falsche Fenster (774k
 * statt 174k) und die „passt nicht"-Warnung schweigt genau dann, wenn sie nötig wäre.
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
