/**
 * Preflight-Guard für KI-abhängige CTAs + app-weiter „Interne KI verbinden"-Prompt.
 *
 * Problem: Ein KI-CTA (z. B. „KI-Aufbereitung starten") ohne verbundene interne KI
 * öffnete stillschweigend einen KI-Tab und lief in eine lange Retry-Schleife
 * (`submitMessage` → `ensureConnection` → `window.open` + Idle-Timeout). Stattdessen:
 * vor dem Lauf prüfen und — falls nicht erreichbar — EINEN app-weiten Dialog öffnen,
 * der das Verbinden anbietet, und die Aktion sauber abbrechen.
 *
 * Der Dialog-Zustand lebt in einem winzigen Store (ein Dialog, von jedem CTA
 * auslösbar); gerendert wird er einmalig via `KiConnectPromptDialog` im ShellLayout.
 * Importiert nur `zustand` + den Status-Store (keine Kante zurück nach `ai/bridge`).
 */
import { create } from 'zustand';
import type { AIBridge } from './bridge';
import { useBridgeStatus, type BridgeStatus } from './bridge-status';

interface KiConnectPromptStore {
  offen: boolean;
  oeffnen: () => void;
  schliessen: () => void;
}

export const useKiConnectPrompt = create<KiConnectPromptStore>((set) => ({
  offen: false,
  oeffnen: () => set({ offen: true }),
  schliessen: () => set({ offen: false }),
}));

/**
 * Ist die interne KI für einen sofort startenden KI-Lauf bereit? `true` = darf laufen;
 * `false` = nicht erreichbar → app-weiter Verbinden-Prompt geöffnet, Aufrufer bricht ab.
 *
 * Nur der Streamlit-Bridge-Transport braucht einen offenen KI-Tab. Stateless-API-
 * Transporte (OpenRouter/DirectLLM) sind ohne Tab erreichbar → nie blocken. Bei der
 * Bridge: `connected` erlaubt; sonst erlaubt, wenn bereits ein KI-Tab offen ist (Ping
 * folgt), andernfalls Prompt.
 */
export function kiVerbindungBereit(bridge: AIBridge): boolean {
  const transport = bridge.getActiveTransport();
  if (transport.name !== 'Streamlit') return true;
  if (useBridgeStatus.getState().status === 'connected') return true;
  if (transport.hasLiveBridgeWindow?.()) return true;
  useKiConnectPrompt.getState().oeffnen();
  return false;
}

/**
 * Wie `kiVerbindungBereit`, aber mit echtem **passivem Ping** statt der Annahme, ein
 * offenes Fenster sei eine Verbindung.
 *
 * Grund: `hasLiveBridgeWindow()` sagt nur „irgendein KI-Tab ist offen". Ist dort das
 * Lesezeichen nicht (mehr) aktiv oder der Tab weggenavigiert, wirkt die Verbindung
 * bereit, antwortet aber nie — der Lauf startet trotzdem und endet nach Minuten in
 * lauter Fehlern (genau so gemeldet: Knopf klickbar, danach „Fehler" an allen sechs
 * Abschnitten, kein Verbinden-Dialog). `ping({ openIfNeeded: false })` fragt die
 * Bridge tatsächlich (max. 5 s, öffnet KEINEN Tab) und pflegt nebenbei den Status.
 *
 * Für Läufe, die Minuten dauern, ist diese Sekunde gut investiert. `transportName`
 * erlaubt den Check auf dem Transport, der den Lauf WIRKLICH fährt (der aktive muss
 * das nicht sein — siehe `getTransportForSkillRun`).
 *
 * **Gilt für JEDEN internen Transport, nicht nur die Bridge** (v4.68). Bis dahin
 * stand hier `if (name !== 'Streamlit') return true;` — ein lokaler llama.cpp-
 * Server (`name === 'llama.cpp'`) lief also ungeprüft durch, und wenn er nicht
 * lief, bekam der Nutzer statt der Verbinden-Aufforderung den rohen Browser-Text
 * „Failed to fetch" zu lesen. `DirectLLMTransport.ping()` fragt `/v1/models` und
 * beantwortet genau die Frage, an der der Lauf sonst eine Zeile später scheitert.
 */
export async function kiVerbindungGeprueft(bridge: AIBridge, transportName?: string): Promise<boolean> {
  const name = transportName ?? bridge.getActiveTransport().name;
  // Bei der Bridge bewusst der PERSISTENTE Streamlit-Transport: nur er trägt das
  // Fenster-Handle aus dem `tf-bridge-ready`-Announce (und der Vordergrund-
  // Wrapper reicht `hasLiveBridgeWindow` nicht durch). Sonst der aktive.
  const transport = name === 'Streamlit'
    ? bridge.getStreamlitTransport()
    : bridge.getActiveTransport();
  if (await transport.ping({ openIfNeeded: false }).catch(() => false)) return true;
  useKiConnectPrompt.getState().oeffnen();
  return false;
}

/**
 * Darf ein offener Verbinden-Dialog von selbst verschwinden?
 *
 * Der Dialog ist eine Aussage über einen Zustand („ist aber gerade nicht
 * verbunden"), und sein eigener Text rechnet damit, dass der Nutzer den Wechsel
 * WÄHREND er offen steht herbeiführt („dann wird der Status automatisch grün").
 * Bis v6.9.5 blieb er trotzdem stehen — in der laufenden App gemessen: grüner
 * Statuspunkt „Interne KI verbunden" und gleichzeitig der Dialog „Interne KI
 * nicht verbunden". Wer beides sieht, glaubt der App nicht mehr.
 *
 * Bewusst am BRIDGE-Status und nur bei aktiver Bridge: `useBridgeStatus` wird vom
 * Heartbeat immer am Streamlit-Transport gepflegt, auch wenn ein direkter Server
 * der aktive Provider ist. Ein offener KI-Tab sagt über einen toten llama.cpp
 * nichts aus und darf dessen Dialog nicht wegwischen.
 *
 * Pur gehalten (kein Hook): so hält ein Test die Regel fest, obwohl das Projekt
 * keine Komponenten rendert — die Komponente bleibt reine Anbindung.
 */
export function promptDarfSchliessen(args: {
  offen: boolean;
  bridgeAktiv: boolean;
  status: BridgeStatus;
}): boolean {
  return args.offen && args.bridgeAktiv && args.status === 'connected';
}

/**
 * Riecht ein Fehler nach „die KI war nicht erreichbar" statt nach „das Modell hat
 * schlecht geantwortet"?
 *
 * Der Preflight oben deckt den Normalfall ab, aber ein Server kann mitten im Lauf
 * verschwinden — und dann steht wieder ein roher Browser-Text in der Oberfläche.
 * Ein Aufrufer, der das hier abfragt, kann stattdessen dieselbe Aufforderung
 * zeigen wie der Preflight.
 *
 * Bewusst eine Mustererkennung auf der Meldung: `fetch` wirft für „Server tot",
 * „falscher Port" und „CORS verboten" denselben `TypeError`, ohne unterscheidbares
 * Feld. Falsch-positiv ist hier billig (der Nutzer bekommt einen Verbinden-Dialog,
 * den er wegklicken kann), falsch-negativ teuer (er liest „Failed to fetch").
 */
const VERBINDUNGS_MUSTER: readonly RegExp[] = [
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /err_connection/i,
  /fetch failed/i,
  /ECONNREFUSED/i,
];

export function istVerbindungsFehler(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return VERBINDUNGS_MUSTER.some(m => m.test(text));
}
