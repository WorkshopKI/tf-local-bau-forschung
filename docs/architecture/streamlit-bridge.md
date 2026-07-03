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

App  → Streamlit:  { type: 'tf-reset', id }
Streamlit → App:   { type: 'tf-reset-done', id, found }   (Chat-Reset, s.u.)

Streamlit → App:   { type: 'tf-bridge-ready' }            (Announce beim Aktivieren)
Streamlit → App:   { type: 'tf-app-ping' }  → App: { type: 'tf-app-pong' }   (Gegenrichtungs-Test)
```

- **Chat-Reset** (`tf-reset` → `tf-reset-done`): `transport.resetChat()` (optionales `AITransport`-Feld, nur Streamlit) lässt das Bookmarklet den „Neuer Chat"/„Zurücksetzen"-Button der Streamlit-App klicken — Strategie wie im alten ZIM-Bookmarklet: erst Reset-**Symbol** (⟳/↻/🔄), dann Reset-**Text** (zurücksetzen/reset/clear/neu starten/neuer chat), die eigene Bridge-Leiste (`#tf-bridge-bar`) ausgenommen. Best-effort (Timeout 6 s, kein `window.open` — das würde das Bookmarklet löschen). Genutzt vom Such-„Mit KI analysieren"-Lauf: **einmal vor dem ersten Batch** + adaptiv vor Folge-Batches, wenn der akkumulierte Kontext ~30K Token übersteigt (begruendung.ts). Da der Streamlit-Chat eine geteilte Session ist, löscht ein Analyse-Lauf den dort offenen Chat-Verlauf. **Bookmarklet-Änderung ⇒ einmal neu installieren.**

- Korrelation über `id` (`Map<id, {resolve, reject, timeout}>`). Ping-Timeout 5 s, Response-Timeout 60 s.
- Abort: das pending-Promise wird verworfen, der Streamlit-Run läuft serverseitig fertig (das UI reagiert sofort).
- **Origin-Pinning**: der Transport akzeptiert nur Nachrichten von der konfigurierten Streamlit-URL-Origin (`new URL(streamlitUrl).origin`), nicht hart `localhost` — interne Hosts laufen ggf. unter Servername/IP. Unparsebare URL → akzeptierend (Single-Team-Trust).
- **Fenster-Handle aus `event.source`**: der Transport übernimmt bei jeder eingehenden `tf-*`-Nachricht `event.source` als `streamlitWindow` — das exakte Tab, in dem das Bookmarklet läuft. Das Bookmarklet sendet beim Aktivieren `tf-bridge-ready` an `window.opener` und löst das Capturing aus. So muss `window.open` den Tab **nicht** erneut öffnen (das würde ihn neu laden und das injizierte Bookmarklet löschen). **Voraussetzung:** der KI-Tab wird **aus der App** geöffnet („Interne KI öffnen") und die `window.opener`-Beziehung besteht (kein `Cross-Origin-Opener-Policy: same-origin` auf der KI-Seite — sonst ist gar keine Tab-zu-Tab-Kommunikation möglich).
- **Bidirektionaler Test**: links (App) „Verbindung testen" → `tf-ping`/`tf-pong` → „Interne KI erreichbar"; rechts (KI-Tab) Button „ZAH-App testen" → `tf-app-ping`/`tf-app-pong` → „ZAH App erreichbar". Der Test nutzt den **persistenten** Transport (`AIBridge.getStreamlitTransport()`), nicht einen Wegwerf — nur der hält das gecapturte Handle.

## Black-Box-DOM-Scrape (Streamlit-Seite)

Die Streamlit-App gehört uns nicht und kann nicht geändert werden → das Bookmarklet schreibt die Nachricht in das Chat-Eingabefeld, sendet ab und liest die Antwort aus dem Chat-DOM. Härtung gegen typische Fehler:
- **Selektor-Fallback-Arrays** (spezifisch → generisch); `.st-key-input_msg` setzt `key="input_msg"` im `st.chat_input` voraus, sonst greifen die generischen Selektoren.
- **Submit** per Button **oder** Enter-Key-Fallback.
- **Antwort-Auswahl per Echo-Anker** (nicht per Position) — Details unten. Nur die **Assistant**-Nachricht wird gelesen (User-Echo via `img[alt*="user"]` erkannt).
- **Stabilitäts-Gate**: Inhalt muss idle bleiben (`SETTLE_MS`, verlängert bei sehr kurzem Inhalt), bevor finalisiert wird — überlebt Thinking-Denk-Pausen.
- Kleines Status-Badge (Interne KI / Verbunden / Arbeitet… / Zeitüberschreitung / Fehler) + Button „ZAH-App testen"; bei fehlendem `window.opener` Hinweis „Tab aus der App öffnen". `window.__teamflowBridge`-Guard gegen Doppel-Installation.
- **„Prompt-Vorlagen"-Spalte ausblenden** (`installTemplateHide()`): die rechte Vorlagen-Spalte der KI-Seite kostet nur Platz, da die App den Chat fernsteuert. Ausblendung **rein per CSS** (injiziertes `<style id="tf-bridge-layout">`) verankert am Streamlit-Auto-Anker `#prompt-vorlagen` — `[data-testid="stColumn"]:has(#prompt-vorlagen){display:none}` + Geschwister-Chat-Spalte auf volle Breite. Der Anker wird bei jedem Rerun neu erzeugt → flackerfrei **ohne** Observer. Sicherheitsnetz `ensureVorlagenHook()`: fehlt der Anker, wird die Überschrift per Text-Match (`/prompt[\s-]*vorlagen/i`) gefunden und der Anker nachgesetzt (Re-Check im bestehenden `MutationObserver`, kein zweiter Observer). Übernommen aus dem alten ZIM-Bookmarklet (`_reference/.../streamlit-theme.css`).

### Antwort-Auswahl (Echo-Anker)

Welche Chat-Nachricht ist „die Antwort"? Das AitisiGPT-DOM ist eine fremde, nicht kontrollierte UI — jede
Annahme über die **Position** der Antwort ist brüchig (Bug-Klasse 10, [recurring-bug-classes.md](recurring-bug-classes.md)):
„die letzte Nachricht" bricht, weil nach der Antwort eine **Folge-Begrüßung** angehängt wird; eine
„Zähl-Baseline vor dem Senden" bricht am Render-Race. Real: `[0] Begrüßung · [1] Prompt-Echo · [2] Antwort ·
[3] Folge-Begrüßung`. Historie der Fehlversuche: v2.157.1 → v2.159.1 → v2.159.3 → **v2.159.4** (aktuell korrekt).

Stabil ist nur die **Anker-Relation**: die **erste Nicht-User-Nachricht NACH dem Prompt-Echo** (der letzten
User-Nachricht). Kein Echo gefunden → **nichts zurückgeben** (nicht raten, kein Fallback auf die Begrüßung).

Die reine Index-Logik lebt zweifach identisch: als pure Funktion `selectAnswerIndex` /`selectAnswer` in
[answer-selection.ts](../../src/core/services/ai/streamlit-bridge/answer-selection.ts) (unit-testbar) und —
weil das Bookmarklet standalone sein muss (`?raw`-Inlining, kein Import) — **gespiegelt** im
[bridge-snippet.source.js](../../src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)
(`findAnswerMsg` → `selectAnswerIndex` zwischen den `<answer-selection-core>`-Markern). Der Drift-Test
[answer-selection.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/answer-selection.test.ts)
extrahiert die JS-Funktion und lässt sie **gegen dieselben Fixtures** wie die TS-Fassung laufen (erschöpfend
über alle Roster-Kombinationen bis Länge 8) — Divergenz schlägt fehl. `BRIDGE_REV` markiert die Snippet-Version
(bump bei echter Verhaltensänderung → Re-Install; der reine Extraktions-Refactor ließ das Verhalten unverändert).

## Aktivierung (Nutzer-Flow)

Das Bookmarklet muss **einmal pro Streamlit-Tab** angeklickt werden (nach jedem Neuladen erneut) — unter `file://` kann die App kein JS in den fremden cross-origin-Tab injizieren; das Bookmarklet ist der vom Nutzer autorisierte Weg. Ablauf siehe Installer-UI bzw. README.

## Sichtbarkeit / Flag

Feature-Flag `streamlitBridge` (`isStreamlitBridgeEnabled()`, optional, default false). Aktiv in **dev + prod + kurator + pl**. Schaltet den KI-Assistent-Tab frei (auch ohne `isDevContext`/`isLlmKontextSettingEnabled`) und blendet die Bridge-Sektion ein. In prod/kurator erscheint **nur** die Bridge-Sektion; der volle Provider-Switcher bleibt dev-exklusiv (`isDevContext`).

## Test

Mini-Streamlit-App unter `_reference/bookmarklet-streamlit/code-bookmarklet-multiple-file-codebase/streamlit-dev-chat` (`streamlit run app.py`, Mock-Modus oder `.env` auf den lokalen llama-Server). Sie nutzt `st.chat_input(key="input_msg")` → passt zum bevorzugten Selektor.

Die **Antwort-Auswahl** (Echo-Anker) ist zusätzlich unit-getestet: [answer-selection.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/answer-selection.test.ts) prüft die belegten DOM-Roster (v2.157.1–v2.159.4) und laufen JS-Snippet + TS-Modul gegen dieselben Fixtures (Drift-Schutz).
