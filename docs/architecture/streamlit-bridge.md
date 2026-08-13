# Streamlit-Bridge

Zugang zu einem internen LLM (z.B. gpt-oss), für das **kein API** existiert — nur eine Streamlit-Chat-UI. Die Streamlit-App läuft in einem **parallelen Browser-Tab**, den TeamFlow per `window.open` öffnet; Datenaustausch via `postMessage`. Die Bridge ist ein normaler `AITransport` und funktioniert damit wie das OpenRouter-/llama.cpp-Gateway.

> Warum kein `BroadcastChannel`: cross-origin zwischen `file://` (App) und `http://…` (Streamlit) schlägt fehl (Pitfall #3). `window.open` + `postMessage` ist der einzige Weg.

## Bausteine

| Teil | Datei | Aufgabe |
|---|---|---|
| Transport | [src/core/services/ai/transports/streamlit.ts](../../src/core/services/ai/transports/streamlit.ts) | `StreamlitBridgeTransport implements AITransport` — `window.open` (Tab-Name `teamflow-streamlit`) + `postMessage`, nur Single-Turn (`submitMessage`) |
| Registry | [src/core/services/ai/bridge.ts](../../src/core/services/ai/bridge.ts) | `AIBridge` — Streamlit ist der Default-Transport; `switchProvider` aktualisiert die URL per `updateUrl()` (kein Listener-Leak) |
| Installer-UI | [src/plugins/einstellungen/ki/VerbindungGruppe.tsx](../../src/plugins/einstellungen/ki/VerbindungGruppe.tsx) | URL konfigurieren, Bookmarklet ziehen/kopieren, Tab öffnen, Verbindung testen |
| Bookmarklet | [src/core/services/ai/streamlit-bridge/bridge-snippet.source.js](../../src/core/services/ai/streamlit-bridge/bridge-snippet.source.js) + `snippet.ts` | Streamlit-seitiges Snippet (Single Source of Truth), via `?raw` zur Build-Zeit ins Bundle inlined (kein Runtime-`fetch`, `file://`-tauglich) |

## Protokoll (postMessage)

```
App  → Streamlit:  { type: 'tf-ping' }
Streamlit → App:   { type: 'tf-pong' }

App  → Streamlit:  { type: 'tf-request', id, message, ziel? }
Streamlit → App:   { type: 'tf-progress', id }            (Heartbeat ~10 s, solange der Lauf lebt)
Streamlit → App:   { type: 'tf-stream', id, content }     (Voll-Snapshots des Antwort-Markdowns)
Streamlit → App:   { type: 'tf-response', id, result, reasoning? }

App  → Streamlit:  { type: 'tf-reset', id, ziel? }
Streamlit → App:   { type: 'tf-reset-done', id, found }   (Chat-Reset, s.u.)

Streamlit → App:   { type: 'tf-bridge-ready' }            (Announce beim Aktivieren)
Streamlit → App:   { type: 'tf-app-ping' }  → App: { type: 'tf-app-pong' }   (Gegenrichtungs-Test)
```

`ziel` (`'standard' | 'agentisch'`, optional, v2.203) routet den Lauf in einen benannten Tab der
KI-Oberfläche — siehe [Zweit-LLM / Ziel-Routing](#zweit-llm--ziel-routing-erprobung). Ohne `ziel`
läuft alles im aktiven Tab (bisheriges Verhalten; alte Bookmarklets ignorieren das Feld, alte
App-Builds senden es nicht — beide Richtungen bleiben kompatibel).

- **Chat-Reset** (`tf-reset` → `tf-reset-done`): `transport.resetChat(ziel?)` (optionales `AITransport`-Feld, nur Streamlit) lässt das Bookmarklet den „Neuer Chat"/„Zurücksetzen"-Button der Streamlit-App klicken — Strategie wie im alten ZIM-Bookmarklet: erst Reset-**Symbol** (⟳/↻/🔄), dann Reset-**Text** (zurücksetzen/**zuruecksetzen**/reset/clear/neu starten/neuer chat — die ue-Variante, weil der Agentischer-Chat-Button real „Chat zuruecksetzen" heißt), die eigene Bridge-Leiste (`#tf-bridge-bar`) und **unsichtbare Buttons** (verstecktes Tab-Panel) ausgenommen. Best-effort (Timeout 15 s inkl. möglichem `ziel`-Tab-Wechsel, kein `window.open` — das würde das Bookmarklet löschen); Rückgabe `'ok' | 'nicht-gefunden' | 'timeout'` (kein Fenster / keine Antwort → `'timeout'`). **Wer wann resettet, steht in der Invariante „Stateless-Läufe = frischer Chat" direkt darunter.**

- **Stateless-Läufe = frischer Chat** (Invariante, Pitfall #36): Skill-Läufe sind stateless designt (voller Kontext im Prompt), der Streamlit-Chat ist aber stateful — ohne Reset akkumuliert der Verlauf (Kontext-Überlauf, zwischen Vorgängen vermischte VBs). Deshalb ruft **jeder** Einzel-Skill-Lauf über einen Streamlit-Transport `resetChat` VOR dem Submit, über den gemeinsamen Helfer `starteFrischenChat` ([chat-reset.ts](../../src/core/services/ai/chat-reset.ts) → `'ok' | 'nicht-gefunden' | 'nicht-unterstuetzt' | 'timeout'`, wirft nie): der zentrale Skill-Runner `runSkill` (Gutachten A–G, KI-QS, Kurzfassung, Nachforderungen, Batch, Anonymisieren, Metadaten), die Aufbereitungs-Bausteine `runBaustein`, die Relevanz-Map `runRelevanzMap` und der In-App-Eval-Runner. Best-effort: `'nicht-gefunden'`/`'timeout'` bricht den Lauf NIE ab, markiert ihn aber (Warn-Banner bei Gutachten/Aufbereitung, Reset-Status-Zeile im Eval-Report); `'nicht-unterstuetzt'` (DirectLLM/llama.cpp — ohnehin stateless) erzeugt keine Warnung. **Ausgenommen:** das mehrturnige Such-Chat-Panel und die Batch-Analyse `begruendung.ts` (behält ihre adaptive ~30K-Token-Strategie: Reset einmal vor dem ersten Batch + vor Folge-Batches über der Schwelle). Rein app-seitig — **kein** Bookmarklet-/`BRIDGE_REV`-Change.

- Korrelation über `id` (`Map<id, {resolve, reject, cancel, touch?}>`).
- **Timeouts sind aktivitätsbasiert** (v2.203, [deadline.ts](../../src/core/services/ai/transports/deadline.ts) `createActivityDeadline`): eingehende `tf-stream`/`tf-progress` schieben das Idle-Timeout — lange Läufe unter Server-Last (1–2 min+, Queue vor dem ersten Token) laufen durch; nur echte Funkstille (Tab tot/geschlossen) lässt die Anfrage scheitern. Schichtung (App-Werte > Bookmarklet-Werte, damit ein App-Timeout „Bookmarklet tot" bedeutet, nie „Lauf zu langsam"):

  | Timer | Wert | Wo |
  |---|---|---|
  | Ping | 5 s | App (`ping`) |
  | Chat-Reset | 15 s | App (`resetChat`, inkl. `ziel`-Tab-Wechsel) |
  | Idle-Finalisierung (`SETTLE_MS`, ×2 bei Kurz-Inhalt) | 5 s | Bookmarklet |
  | Kein Fortschritt (`NO_PROGRESS_MS`: weder Inhalts-Änderung noch sichtbarer Lauf-Indikator) | 150 s | Bookmarklet |
  | Harter Deckel (`HARD_MAX_MS`, gegen stuck-true `isRunning()`) | 600 s | Bookmarklet |
  | Antwort-Idle (`RESPONSE_IDLE_TIMEOUT_MS`, resettet auf tf-stream/tf-progress) | 200 s | App |
  | Antwort-Hard (`RESPONSE_HARD_TIMEOUT_MS`) | 660 s | App |

  Die App-Idle-Marke bleibt bewusst beim alten Fix-Wert 200 s: ALTE Bookmarklets ohne `tf-progress`-Heartbeat werden nicht strenger behandelt als bisher; neue melden alle ~10 s Aktivität.
- Abort: das pending-Promise wird verworfen, der Streamlit-Run läuft serverseitig fertig (das UI reagiert sofort).
- **Origin-Pinning**: der Transport akzeptiert nur Nachrichten von der konfigurierten Streamlit-URL-Origin (`new URL(streamlitUrl).origin`), nicht hart `localhost` — interne Hosts laufen ggf. unter Servername/IP. Unparsebare URL → akzeptierend (Single-Team-Trust).
- **Fenster-Handle aus `event.source`**: der Transport übernimmt bei jeder eingehenden `tf-*`-Nachricht `event.source` als `streamlitWindow` — das exakte Tab, in dem das Bookmarklet läuft. Das Bookmarklet sendet beim Aktivieren `tf-bridge-ready` an `window.opener` und löst das Capturing aus. So muss `window.open` den Tab **nicht** erneut öffnen (das würde ihn neu laden und das injizierte Bookmarklet löschen). **Voraussetzung:** der KI-Tab wird **aus der App** geöffnet („Interne KI öffnen") und die `window.opener`-Beziehung besteht (kein `Cross-Origin-Opener-Policy: same-origin` auf der KI-Seite — sonst ist gar keine Tab-zu-Tab-Kommunikation möglich).
- **Bidirektionaler Test**: links (App) „Verbindung testen" → `tf-ping`/`tf-pong` → „Interne KI erreichbar"; rechts (KI-Tab) Button „ZAH-App testen" → `tf-app-ping`/`tf-app-pong` → „ZAH App erreichbar". Der Test nutzt den **persistenten** Transport (`AIBridge.getStreamlitTransport()`), nicht einen Wegwerf — nur der hält das gecapturte Handle.

## Black-Box-DOM-Scrape (Streamlit-Seite)

Die Streamlit-App gehört uns nicht und kann nicht geändert werden → das Bookmarklet schreibt die Nachricht in das Chat-Eingabefeld, sendet ab und liest die Antwort aus dem Chat-DOM. Härtung gegen typische Fehler:
- **Selektor-Fallback-Arrays** (spezifisch → generisch); `.st-key-input_msg` setzt `key="input_msg"` im `st.chat_input` voraus, sonst greifen die generischen Selektoren.
- **Sichtbarkeits-bevorzugte Queries** (`q1v`/`qav`, v2.203): erst alle Selektoren nach einem **sichtbaren** Treffer absuchen (per Prod-Dump 2026-07-09 bestätigt: die AitisiGPT-Tabs halten **beide Chat-Panels gemountet** — globale Queries griffen sonst ins versteckte Panel, Cross-Tab-Bleed); findet sich keiner, Fallback auf den ersten Treffer überhaupt (degradiert schlimmstenfalls aufs alte Verhalten). `isVisible` = `offsetParent`-Check + Client-Rects-Fallback für `position:fixed`.
- **Panel-Scoping des Nachrichten-Rosters** (v2.203.1, `panelScopeOf`): `runRequest`/`runSelfTest` binden die Nachrichten-Queries ans **Tab-Panel der Ziel-textarea** (`stTabPanel`/`role="tabpanel"`, sonst `document`). So bleibt der Scrape auch beim **manuellen Tab-Wechsel mitten im Lauf** am richtigen Chat: wird das Panel unsichtbar, liefert der qav-Fallback trotzdem die Panel-eigenen Nachrichten — nie die des anderen Chats. Der Submit-Button wird ohne gefundenen Chat-Input-Container sichtbarkeits-bevorzugt gesucht (nie dokumentweiter Erst-Treffer = ggf. versteckter Fremd-Button).
- **Submit** per Button (zuerst im Container der eigenen textarea gescoped) **oder** Enter-Key-Fallback.
- **Antwort-Auswahl per Echo-Anker** (nicht per Position) — Details unten. Nur die **Assistant**-Nachricht wird gelesen (User-Echo primär via `img[alt*="user"]`, Fallback über den Nachrichtentext).
- **Stabilitäts-Gate**: Inhalt muss idle bleiben (`SETTLE_MS`, verlängert bei sehr kurzem Inhalt), bevor finalisiert wird — überlebt Thinking-Denk-Pausen. Lauf-Erkennung (`isRunning`) **primär über den Streamlit-Skript-Zustand** `stApp[data-test-script-state="running"]` (v2.203.2, UI-unabhängig — AitisiGPT blendet das Status-Widget per CSS aus; Prod-Dump 2026-07-09: während der Generierung war KEIN Indikator sichtbar, lange Agent-Reasoning-Pausen hätten verfrüht finalisiert), Fallback: sichtbare Indikatoren (`stStatusWidget`, Stop-Button, `stSpinner`). Stuck-true-Backstop = `HARD_MAX_MS`.
- **Progressbewusste Deadlines statt absolutem Deckel** (v2.203): Abbruch erst nach `NO_PROGRESS_MS` (150 s ohne Inhalts-Änderung UND ohne sichtbaren Lauf-Indikator) bzw. `HARD_MAX_MS` (600 s absolut) — der alte 180-s-Deckel kappte unter Server-Last auch noch wachsende Antworten. Parallel `tf-progress`-Heartbeat (~10 s) an die App.
- **Diagnose**: das Nachrichten-Roster (User/Assistant-Flags + Echo-Flag `~E` + Text-Anfänge) wird beim **Finalisieren UND beim Timeout** in die Konsole (F12) geloggt — bei „falscher/keiner Antwort" zeigt die Konsole die echte DOM-Struktur statt Blind-Patchen (Bug-Klasse 10).
- **Eine dezente Status-Pill** (v2.212, `#tf-bridge-badge`): farbiger Punkt (Ton grün/amber/rot) + neutraler Text auf hellem Grund — ersetzt das frühere Voll-Farb-Badge **und** die zwei Test-Buttons „ZAH-App testen" / „Chat-Test". Zeigt im Zeitverlauf alle Zustände (Interne KI / Prüfe ZAH-App… / ZAH App erreichbar / Chat-Test läuft… / Chat-Test OK / Arbeitet… / Zeitüberschreitung / Fehler) und ruht auf grün „Verbunden". Ein **Klick** auf die Pill löst beide Selbsttests (ZAH-App-Ping via `runAppReachTest()` + Chat-Test via `runSelfTest()`) erneut aus — beide laufen ohnehin automatisch beim Aktivieren (300 ms / 1500 ms). Bei fehlendem `window.opener` Hinweis „Tab aus der App öffnen". `window.__teamflowBridge`-Guard gegen Doppel-Installation.
- **Leiste unten rechts + Watchdog** (v2.203, Position v2.212): `#tf-bridge-bar` sitzt fix **unten rechts, aber nach links eingerückt** (`bottom:12px;right:220px`, z-index-Maximum) — Chrome zeichnet seine Bildschirmfreigabe-Anzeige unten rechts (außerhalb der Seite, nicht per JS messbar); die Pill weicht ihr per festem `right`-Versatz aus. Oben rechts wurde die Leiste zudem wiederholt vom Streamlit-Header-/Status-Bereich überdeckt. Ein 4-s-Watchdog (a) hängt sie wieder an, wenn ein UI-Umbau sie entfernt hat, (b) rückt sie ans body-Ende (gewinnt die Paint-Order bei z-index-Gleichstand), (c) re-asserted die Inline-Styles.
- **Tab-Titel als zweiter Ausgabekanal** (v2.280): Die Pill sieht nur, wer **in** diesem Tab ist — wer in der App arbeitet, musste zum Prüfen hinwechseln. Derselbe Zustand steht deshalb zusätzlich im `document.title` des KI-Tabs, ablesbar aus der Chrome-Tab-Leiste heraus: `⏳ 0:42 · 1,4k · <Fremdtitel>` während eines Laufs (Uhr **und** wachsender Antwort-Umfang — nur der Umfang belegt „kommt voran", eine Uhr tickt auch bei totem Server weiter), `⏳ Arbeitet…`/`⏳ Chat-Test läuft…` ohne Lauf-Schleife, `✅ Fertig` für 60 s (`QUITTUNG_MS`, danach zurück auf den unveränderten Fremdtitel), `⚠️ …` bleibt bis zum nächsten Statuswechsel stehen. Das Symbol steht **vorne**, damit es sichtbar bleibt, wenn Chrome den Tab-Text abschneidet. Angehängt an `setBadge()` — dem einzigen Statuswechsel-Punkt des Snippets, damit Tab und Pill nicht auseinanderlaufen können; `runRequest` überschreibt den Pill-Text „Verbunden" per `tabQuittung('Fertig')` (die Pill beschreibt die **Verbindung**, der Tab den **Lauf**). **Keine neuen Timer**: der Ticker hängt in der 400-ms-Poll-Schleife (jeder 3. Tick), Quittungs-Ablauf und Re-Assert gegen Streamlit-Reruns im bestehenden 4-s-Watchdog. Die Formatierung lebt wie die Echo-/Antwort-Logik zweifach identisch — pur in [tab-titel.ts](../../src/core/services/ai/streamlit-bridge/tab-titel.ts), gespiegelt zwischen den `<tab-titel-core>`-Markern, Drift-Test [tab-titel.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/tab-titel.test.ts).
- **„Prompt-Vorlagen"-Spalte ausblenden** (`installTemplateHide()`): die rechte Vorlagen-Spalte der KI-Seite kostet nur Platz, da die App den Chat fernsteuert. Ausblendung **rein per CSS** (injiziertes `<style id="tf-bridge-layout">`) verankert am Streamlit-Auto-Anker `#prompt-vorlagen` — `[data-testid="stColumn"]:has(#prompt-vorlagen){display:none}` + Geschwister-Chat-Spalte auf volle Breite. Der Anker wird bei jedem Rerun neu erzeugt → flackerfrei **ohne** Observer. Sicherheitsnetz `ensureVorlagenHook()`: fehlt der Anker, wird die Überschrift per Text-Match (`/prompt[\s-]*vorlagen/i`) gefunden und der Anker nachgesetzt (Re-Check im bestehenden `MutationObserver`, kein zweiter Observer). Übernommen aus dem alten ZIM-Bookmarklet (`_reference/.../streamlit-theme.css`).

### Antwort-Auswahl (Echo-Anker)

Welche Chat-Nachricht ist „die Antwort"? Das AitisiGPT-DOM ist eine fremde, nicht kontrollierte UI — jede
Annahme über die **Position** der Antwort ist brüchig (Bug-Klasse 10, [recurring-bug-classes.md](recurring-bug-classes.md)):
„die letzte Nachricht" bricht, weil nach der Antwort eine **Folge-Begrüßung** angehängt wird; eine
„Zähl-Baseline vor dem Senden" bricht am Render-Race. Real: `[0] Begrüßung · [1] Prompt-Echo · [2] Antwort ·
[3] Folge-Begrüßung`. Historie der Fehlversuche: v2.157.1 → v2.159.1 → v2.159.3 → **v2.159.4** (aktuell korrekt).

Stabil ist nur die **Anker-Relation**: die **erste Nicht-User-Nachricht NACH dem Prompt-Echo** (der letzten
User-Nachricht). Kein Echo gefunden → **nichts zurückgeben** (nicht raten, kein Fallback auf die Begrüßung).

**Zweistufige Echo-Erkennung** (v2.203): Stufe 1 = Avatar-Heuristik (`img[alt*="user"]`, unverändert).
NUR wenn sie **gar kein** Prompt-Echo findet (UI-Drift am Avatar-Markup — genau die Fehlerklasse hinter
„Ende der Response nicht erkannt": ohne Echo wird nie finalisiert → Timeout trotz fertiger Antwort),
markiert Stufe 2 das Echo über den **gesendeten Text selbst** (normalisierter Prefix-Vergleich,
[echo-match.ts](../../src/core/services/ai/streamlit-bridge/echo-match.ts), gespiegelt zwischen den
`<echo-match-core>`-Markern im Snippet, Drift-Test
[echo-match.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/echo-match.test.ts)) und wählt
erneut. Bewusst **nicht** inhalts-primär: eine Antwort, die mit einem Prompt-Zitat beginnt, würde sonst
fälschlich zum Anker.

Die reine Index-Logik lebt zweifach identisch: als pure Funktion `selectAnswerIndex` /`selectAnswer` in
[answer-selection.ts](../../src/core/services/ai/streamlit-bridge/answer-selection.ts) (unit-testbar) und —
weil das Bookmarklet standalone sein muss (`?raw`-Inlining, kein Import) — **gespiegelt** im
[bridge-snippet.source.js](../../src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)
(`findAnswerMsg` → `selectAnswerIndex` zwischen den `<answer-selection-core>`-Markern). Der Drift-Test
[answer-selection.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/answer-selection.test.ts)
extrahiert die JS-Funktion und lässt sie **gegen dieselben Fixtures** wie die TS-Fassung laufen (erschöpfend
über alle Roster-Kombinationen bis Länge 8) — Divergenz schlägt fehl. `BRIDGE_REV` markiert die Snippet-Version
(bump bei echter Verhaltensänderung → Re-Install; der reine Extraktions-Refactor ließ das Verhalten unverändert).

## Zweit-LLM / Ziel-Routing (Erprobung)

Die KI-Oberfläche hat neben dem klassischen Chat einen Tab **„Agentischer Chat"** (anderes LLM: Qwen,
größerer Kontext, recherchiert selbst, fragt bei Unklarheit zurück) — potenziell ein Zweit-LLM für
QS/Zweitmeinung. Das Bridge-Protokoll trägt dafür ein optionales `ziel` (`'standard' | 'agentisch'`,
`SubmitMessageOptions.ziel` + `resetChat(ziel?)`):

- Bookmarklet-seitig aktiviert `ensureZiel()` zuerst den passenden Tab (`button[role="tab"]`/
  `[data-baseweb="tab"]`, Fuzzy-Text: `agentisch` bzw. `chat`-aber-nicht-`agentisch`), wartet bis zu
  10 s auf eine **sichtbare** textarea und fährt dann den normalen Scrape-Pfad (Echo-Anker, Settle,
  Deadlines — alles geteilt). `'standard'` ohne Tab-UI läuft wie bisher weiter; `'agentisch'` ohne
  passenden Tab liefert einen klaren Fehlertext als `tf-response`.
- App-seitig trugen zunächst **nur** `SubmitMessageOptions` das `ziel`; `ConversationOptions`
  war bewusst ausgespart, solange die agentische Variante eine Erprobung war. Validiert wurde
  über die dev-only Testfläche „Zweit-LLM (Erprobung)" in der Einstellungs-Sektion
  ([VerbindungGruppe.tsx](../../src/plugins/einstellungen/ki/VerbindungGruppe.tsx),
  gated `isDevContext()`) — Rechenfrage → Tab-Wechsel → Scrape → gezielter Reset.
- **Seit v2.274 tragen beide Options-Typen das Feld.** Die Aussparung war überholt, seit die
  Variante eine globale Nutzer-Einstellung (`useKiZiel`) und in allen Skill-Runnern verdrahtet
  ist: der Chat bevorzugt `streamConversation` per Feature-Detection, genau diese Methode
  postete kein `ziel` — der Umschalter war dort also ein **toter Schalter**, und der Zweig mit
  `aktivesZielFuerLauf()` für die Bridge unerreichbar. Rein app-seitig behoben: das Snippet
  wertet `ziel` bei **jedem** `tf-request` aus (`runRequest(..., data.ziel, ...)`), Stream und
  Single-Turn gleichermassen — **kein `BRIDGE_REV`-Bump, keine Neu-Installation**. Ohne
  gesetztes `ziel` lässt der Transport das Feld ganz weg (= aktiver Tab); seit v2.365 liefern
  die Runner aber immer eines, siehe „Standard ist eine Aussage" unten. Regressionstest:
  [streamlit-ziel.test.ts](../../src/core/services/ai/__tests__/streamlit-ziel.test.ts).
- **Nicht** abgedeckt: ein Variantenwechsel **mitten** in einer Unterhaltung wechselt den Tab,
  und der neue Tab hat seinen eigenen Verlauf — der Chat resettet bewusst nicht (Ausnahme von
  Pitfall #36, mehrturnig). Die bisherige Unterhaltung liegt dann im anderen Tab.
- **Produktive Nutzung (QS-Verdrahtung, Auswahl-UI) ist ein späteres Paket** — erst nach Erprobung
  am echten System. Bekanntes Risiko: der Agent stellt Rückfragen; ein Single-Shot-Scrape kann eine
  Rückfrage als „Antwort" einsammeln.

### Kontextfenster je Tab (v2.273)

Die beiden Tabs haben **unterschiedlich grossen Kontext** — die `n_ctx`-Werte der
llama.cpp-Server, die die Streamlit-App speisen: Standard (gpt-oss) **62k** Tokens,
Agentisch (Qwen) **262k**. Beide stehen sichtbar in der Seite („Chatlänge [Token]: 0k von
62k"), sind aber nicht **abfragbar**: die `/props`-Auto-Erkennung
([direct-llm.ts](../../src/core/services/ai/transports/direct-llm.ts)) spricht den lokalen
llama.cpp direkt an und erreicht die Server hinter der fremden App nicht. Bis v2.272 galt an
der Bridge deshalb ersatzweise der lokale Default (81.920): agentische Läufe wurden grundlos
gekürzt, Standard-Läufe zu spät gewarnt.

**Ausbaupfad**, falls die Werte häufiger wandern: das Bookmarklet scrapt die Seite ohnehin
und könnte die angezeigte Chatlänge mitmelden, statt sie im Code zu pflegen. Kostet einen
`BRIDGE_REV`-Bump und damit eine Neu-Installation bei allen Nutzern — lohnt sich erst, wenn
die Konstanten tatsächlich driften.

Seit v2.273 sind beide Werte in [llm-context.ts](../../src/core/services/ai/llm-context.ts)
fest verdrahtet (`BRIDGE_STANDARD_CONTEXT_TOKENS` / `BRIDGE_AGENTISCH_CONTEXT_TOKENS`) — die
einzige Stelle für die Rechnung; die „(Qwen, 262k)"-Labels der Eval-Panels sind Prosa und
müssen bei einer Änderung mitgezogen werden. Jeder Lauf leitet seinen Cap über
`kontextZielFuerLauf(bridge)` ([ki-ziel.ts](../../src/core/services/ai/ki-ziel.ts)) ab,
Anzeige-Stellen über den Hook `useVbCharCap` ([useVbCharCap.ts](../../src/core/hooks/useVbCharCap.ts)).

**Präzedenz: manuell > Bridge-Tab > erkannt > Default.** Eine manuell eingetragene
Kontextlänge gewinnt auch an der Bridge — wer sie gesetzt hat, soll sie nicht
stillschweigend überschrieben bekommen.

Läufe, die ihr Ziel als Parameter tragen (Fallback-Retry!), leiten den Cap über
`kontextZielFuer(bridge, ziel)` ab statt erneut den Store zu lesen — sonst misst die
Rechnung gegen ein anderes Fenster als der Lauf tatsächlich fährt.

### „Standard" ist eine Aussage, kein Weglassen (v2.365)

`aktivesZielFuerLauf()` gibt **immer** ein explizites Ziel zurück, auch `'standard'`.

Bis v2.364 reichte es für „Standard" `undefined` durch — mit der Begründung, kein
Tab-Routing zu erzwingen. Das war ein Denkfehler: `undefined` heisst an der Bridge nicht
„Standard-Tab", sondern **„aktiver Tab"** (`ensureZiel` steigt bei fehlendem `ziel` sofort
aus und sucht gar keinen Tab). Da Streamlit die Tab-Auswahl hält und niemand sie
zurückstellte, blieb nach dem ersten agentischen Lauf **jeder** Folge-Lauf im agentischen
Chat — aus dem Agentischen führte kein Weg zurück, egal was der Umschalter zeigte. Sichtbar
wurde es daran, dass die Cap-Warnung (die über `kontextZielFuerLauf` schon immer explizit
`'standard'` sah) korrekt umsprang, während die Anfrage im falschen Tab landete.

Derselbe Fehler steckte im Ziel-Fallback (`lauf(undefined)` als „Standard-Lauf") und in der
Relevanz-Map (Reset + Submit ganz ohne `ziel`); beide nennen ihr Ziel jetzt ausdrücklich.
Dritter Vorfall dieser Klasse nach v2.292 (`feedbackImprove`) und v2.298 (Aufbereitung) —
dort wurde jeweils die Aufrufstelle gepinnt, die Wurzel blieb stehen.

Rein app-seitig behoben: das ausgelieferte Snippet versteht explizites `'standard'` längst
(`tabMatches`), und ohne Tab-UI ist `ensureZiel` ein No-op — **kein `BRIDGE_REV`-Bump, keine
Neu-Installation**. Der Transport lässt das Feld weiterhin weg, wenn wirklich keins kommt
([streamlit-ziel.test.ts](../../src/core/services/ai/__tests__/streamlit-ziel.test.ts) ist
unverändert); geändert hat sich nur, dass die Runner immer eins liefern.

## Aktivierung (Nutzer-Flow)

Das Bookmarklet muss **einmal pro Streamlit-Tab** angeklickt werden (nach jedem Neuladen erneut) — unter `file://` kann die App kein JS in den fremden cross-origin-Tab injizieren; das Bookmarklet ist der vom Nutzer autorisierte Weg. Ablauf siehe Installer-UI bzw. README.

## Sichtbarkeit / Flag

Feature-Flag `streamlitBridge` (`isStreamlitBridgeEnabled()`, optional, default false). Aktiv in **dev + prod + kurator + pl**. Schaltet den KI-Assistent-Tab frei (auch ohne `isDevContext`/`isLlmKontextSettingEnabled`) und blendet die Bridge-Sektion ein. In prod/kurator erscheint **nur** die Bridge-Sektion; der volle Provider-Switcher bleibt dev-exklusiv (`isDevContext`).

## Test

Mini-Streamlit-App unter `_reference/code-bookmarklet-multiple-file-codebase/streamlit-dev-chat` (`streamlit run app.py`, Mock-Modus oder `.env` auf den lokalen llama-Server). Sie nutzt `st.chat_input(key="input_msg")` → passt zum bevorzugten Selektor. Seit v2.203 spiegelt sie die echte Oberfläche mit **zwei Tabs** („Chat" + „Agentischer Chat" mit „Chat zuruecksetzen"-Button) für das `ziel`-Routing, simuliert Server-Last per `RESPONSE_DELAY_S`-Env-Var (Deadline-Tests) und kann User-Messages ohne `img`-Avatar rendern (Checkbox — testet den Stufe-2-Echo-Fallback).

Unit-Tests: [answer-selection.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/answer-selection.test.ts) (Echo-Anker-Auswahl, belegte DOM-Roster v2.157.1–v2.159.4), [echo-match.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/echo-match.test.ts) (Stufe-2-Echo-Fallback), [deadline.test.ts](../../src/core/services/ai/transports/__tests__/deadline.test.ts) + [streamlit-deadline.test.ts](../../src/core/services/ai/__tests__/streamlit-deadline.test.ts) (aktivitätsbasierte Timeouts) — die Snippet-Spiegel laufen jeweils per Marker-Extraktion gegen dieselben Fixtures wie die TS-Fassung (Drift-Schutz).
