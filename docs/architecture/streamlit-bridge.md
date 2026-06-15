# Streamlit-Bridge

Zugang zu einem internen LLM (z.B. gpt-oss), für das **kein API** existiert — nur eine Streamlit-Chat-UI. Die Streamlit-App läuft in einem **parallelen Browser-Tab**, den TeamFlow per `window.open` öffnet; Datenaustausch via `postMessage`. Die Bridge ist ein normaler `AITransport` und funktioniert damit wie das OpenRouter-/llama.cpp-Gateway.

> Warum kein `BroadcastChannel`: cross-origin zwischen `file://` (App) und `http://…` (Streamlit) schlägt fehl (Pitfall #3). `window.open` + `postMessage` ist der einzige Weg.

## Bausteine

| Teil | Datei | Aufgabe |
|---|---|---|
| Transport | [src/core/services/ai/transports/streamlit.ts](../../src/core/services/ai/transports/streamlit.ts) | `StreamlitBridgeTransport implements AITransport` — `window.open` (Tab-Name `teamflow-streamlit`) + `postMessage`, nur Single-Turn (`submitMessage`) |
| Registry | [src/core/services/ai/bridge.ts](../../src/core/services/ai/bridge.ts) | `AIBridge` — Streamlit ist der Default-Transport; `switchProvider` aktualisiert die URL per `updateUrl()` (kein Listener-Leak) |
| Installer-UI | [src/plugins/einstellungen/StreamlitBridgeSection.tsx](../../src/plugins/einstellungen/StreamlitBridgeSection.tsx) | URL konfigurieren, Bookmarklet ziehen/kopieren, Tab öffnen, Verbindung testen |
| Bookmarklet | [src/core/services/ai/streamlit-bridge/snippet.js](../../src/core/services/ai/streamlit-bridge/snippet.js) + `snippet.ts` | Streamlit-seitiges Snippet (Single Source of Truth), via `?raw` zur Build-Zeit ins Bundle inlined (kein Runtime-`fetch`, `file://`-tauglich) |

## Protokoll (postMessage)

```
App  → Streamlit:  { type: 'tf-ping' }
Streamlit → App:   { type: 'tf-pong' }

App  → Streamlit:  { type: 'tf-request', id, message }
Streamlit → App:   { type: 'tf-response', id, result }

Streamlit → App:   { type: 'tf-bridge-ready' }            (Announce beim Aktivieren)
Streamlit → App:   { type: 'tf-app-ping' }  → App: { type: 'tf-app-pong' }   (Gegenrichtungs-Test)
```

- Korrelation über `id` (`Map<id, {resolve, reject, timeout}>`). Ping-Timeout 5 s, Response-Timeout 60 s.
- Abort: das pending-Promise wird verworfen, der Streamlit-Run läuft serverseitig fertig (das UI reagiert sofort).
- **Origin-Pinning**: der Transport akzeptiert nur Nachrichten von der konfigurierten Streamlit-URL-Origin (`new URL(streamlitUrl).origin`), nicht hart `localhost` — interne Hosts laufen ggf. unter Servername/IP. Unparsebare URL → akzeptierend (Single-Team-Trust).
- **Fenster-Handle aus `event.source`**: der Transport übernimmt bei jeder eingehenden `tf-*`-Nachricht `event.source` als `streamlitWindow` — das exakte Tab, in dem das Bookmarklet läuft. Das Bookmarklet sendet beim Aktivieren `tf-bridge-ready` an `window.opener` und löst das Capturing aus. So muss `window.open` den Tab **nicht** erneut öffnen (das würde ihn neu laden und das injizierte Bookmarklet löschen). **Voraussetzung:** der KI-Tab wird **aus der App** geöffnet („Interne KI öffnen") und die `window.opener`-Beziehung besteht (kein `Cross-Origin-Opener-Policy: same-origin` auf der KI-Seite — sonst ist gar keine Tab-zu-Tab-Kommunikation möglich).
- **Bidirektionaler Test**: links (App) „Verbindung testen" → `tf-ping`/`tf-pong` → „Interne KI erreichbar"; rechts (KI-Tab) Button „ZAH-App testen" → `tf-app-ping`/`tf-app-pong` → „ZAH App erreichbar". Der Test nutzt den **persistenten** Transport (`AIBridge.getStreamlitTransport()`), nicht einen Wegwerf — nur der hält das gecapturte Handle.

## Black-Box-DOM-Scrape (Streamlit-Seite)

Die Streamlit-App gehört uns nicht und kann nicht geändert werden → das Bookmarklet schreibt die Nachricht in das Chat-Eingabefeld, sendet ab und liest die Antwort aus dem Chat-DOM. Härtung gegen typische Fehler:
- **Selektor-Fallback-Arrays** (spezifisch → generisch); `.st-key-input_msg` setzt `key="input_msg"` im `st.chat_input` voraus, sonst greifen die generischen Selektoren.
- **Submit** per Button **oder** Enter-Key-Fallback.
- **Baseline**-Nachrichtenzahl vor dem Senden; es wird auf neue Nachrichten gewartet.
- Nur die **Assistant**-Nachricht wird gelesen (User-Echo via `img[alt*="user"]` ausgeschlossen, und Kandidat übersprungen, dessen Text == gesendete Nachricht).
- **Stabilitäts-Gate**: Inhalt muss N×500 ms unverändert bleiben (Streaming fertig), bevor zurückgegeben wird.
- Kleines Status-Badge (Interne KI / Verbunden / Arbeitet… / Zeitüberschreitung / Fehler) + Button „ZAH-App testen"; bei fehlendem `window.opener` Hinweis „Tab aus der App öffnen". `window.__teamflowBridge`-Guard gegen Doppel-Installation.

## Aktivierung (Nutzer-Flow)

Das Bookmarklet muss **einmal pro Streamlit-Tab** angeklickt werden (nach jedem Neuladen erneut) — unter `file://` kann die App kein JS in den fremden cross-origin-Tab injizieren; das Bookmarklet ist der vom Nutzer autorisierte Weg. Ablauf siehe Installer-UI bzw. README.

## Sichtbarkeit / Flag

Feature-Flag `streamlitBridge` (`isStreamlitBridgeEnabled()`, optional, default false). Aktiv in **dev + prod + kurator + pl**. Schaltet den KI-Assistent-Tab frei (auch ohne `isDevContext`/`isLlmKontextSettingEnabled`) und blendet die Bridge-Sektion ein. In prod/kurator erscheint **nur** die Bridge-Sektion; der volle Provider-Switcher bleibt dev-exklusiv (`isDevContext`).

## Test

Mini-Streamlit-App unter `_reference/bookmarklet-streamlit/code-bookmarklet-multiple-file-codebase/streamlit-dev-chat` (`streamlit run app.py`, Mock-Modus oder `.env` auf den lokalen llama-Server). Sie nutzt `st.chat_input(key="input_msg")` → passt zum bevorzugten Selektor.
