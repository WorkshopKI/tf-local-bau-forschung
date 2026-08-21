# KI-Bridge (interne KI „AitisiGPT")

Zugang zu einem internen LLM, für das die App **keinen direkten API-Zugang** hat: die KI-Oberfläche läuft in einem **parallelen Browser-Tab**, den TeamFlow per `window.open` öffnet; der Datenaustausch zwischen den beiden Tabs läuft über `postMessage`. Die Bridge ist ein normaler `AITransport` und funktioniert damit wie das OpenRouter-/llama.cpp-Gateway.

> Warum kein `BroadcastChannel`: cross-origin zwischen `file://` (App) und `https://…` (KI-Seite) schlägt fehl (Pitfall #3). `window.open` + `postMessage` ist der einzige Weg.

> **Namens-Hinweis:** Im Code heißt die Bridge weiterhin „Streamlit" (`StreamlitBridgeTransport`, `getStreamlitTransport`, Ordner `streamlit-bridge/`, Flag `streamlitBridge`) — historisch, seit die interne KI auf Streamlit lief. Der Bezeichner `transport.name === 'Streamlit'` ist ein **Vergleichs-String** (Ziel-Fallback, Transport-Policy), kein Label; er wird nicht nebenbei umbenannt. Gemeint ist immer diese Bridge.

## Die Oberfläche dahinter (Stand 2026-08)

Die interne KI wurde von Streamlit auf **htmx + servergerendertes HTML** umgebaut. Für die Bridge ist das ein Glücksfall: die Seite hat eine echte HTTP-Schnittstelle und einen SSE-Strom mit **`done`-Ereignis**. Sie beschreibt ihre Endpunkte selbst in `hx-post`-Attributen — das Bookmarklet **liest** sie, statt Routen zu verdrahten.

| Was | Anker in der Seite |
|---|---|
| Senden | `<form id="sendform" hx-post="/send" hx-target="#log" hx-swap="beforeend">` mit `textarea[name=message]` |
| Verlauf | `#log` > `div.msg` je Beitrag; darin `img.avatar` + `div.content` |
| Antwort | `div.msg` > `.content` > `.sse[data-url][data-status][data-reasoning]` > **`div.answer`** (dorthin gehören die Snapshots); daneben `span.reasoning-help#r-<job>` > `.reasoning-pop` |
| Strom | `data-url="/stream?job=<job>"` → `EventSource`; Ereignisse `message` (Voll-Snapshots HTML), `reasoning`, `status`, `tokenbar`, **`done`** |
| Modell | `<select name="model" class="modelsel">` (nativ) — `gpt-oss-120b`, `Qwen3.6-35B`, `Qwen3-VL-30B (multimodal)` |
| Sitzung | `#shell[data-sid]` → Header `X-Session-Id` bei **jedem** Request |
| Kontext | `#tokenbar` > `.tokenbar-text` („Chatlänge [Token]: 1k von 62k") + `.tokenbar-track > .tokenbar-fill`; `data-over` wenn voll |
| Zurücksetzen | `form.resetform hx-post="/reset" hx-target="#app" hx-swap="innerHTML"` — tauscht die **ganze** Oberfläche |
| Datenquelle | `<select name="datasource">` (RAG-Quellen der Seite) |

Der SSE-Strom braucht **keinen** Sitzungs-Header — eine `EventSource` kann keine Header senden, die Adresse ist auftragsgebunden. Alle anderen Aufrufe brauchen ihn: ohne ihn trifft der Aufruf eine fremde Sitzung.

**Die Datenquellen-Auswahl wird vor jedem Lauf auf „— keine —" gestellt.** Unsere Aufträge bringen ihren Kontext vollständig selbst mit; eine gewählte Quelle würde ihn unbemerkt ergänzen.

## Bausteine

| Teil | Datei | Aufgabe |
|---|---|---|
| Transport | [transports/streamlit.ts](../../src/core/services/ai/transports/streamlit.ts) | `StreamlitBridgeTransport implements AITransport` — `window.open` + `postMessage`, `submitMessage` + `streamConversation` + `resetChat` |
| Registry | [bridge.ts](../../src/core/services/ai/bridge.ts) | `AIBridge` — die Bridge ist der Default-Transport; `switchProvider` aktualisiert die URL per `updateUrl()` (kein Listener-Leak) |
| Installer-UI | [VerbindungGruppe.tsx](../../src/plugins/einstellungen/ki/VerbindungGruppe.tsx) | URL konfigurieren, Lesezeichen ziehen, Tab öffnen, Verbindung testen, **veraltetes Lesezeichen melden** |
| Bookmarklet | [bridge-snippet.source.js](../../src/core/services/ai/streamlit-bridge/bridge-snippet.source.js) + [snippet.ts](../../src/core/services/ai/streamlit-bridge/snippet.ts) | Snippet (Single Source of Truth), via `?raw` zur Build-Zeit ins Bundle inlined (kein Runtime-`fetch`, `file://`-tauglich) |
| Modell-Katalog | [modell-katalog.ts](../../src/core/services/ai/modell-katalog.ts) | **Die einzige Stelle, die Modelle beim Namen nennt** — Muster, Rolle, Rückfall-Fenster; Auflösung Rolle → Modell |
| Angebot + gelernte Fenster | [bridge-modelle.ts](../../src/core/services/ai/bridge-modelle.ts) | Was die KI-Seite anbietet, was wir an ihr abgelesen haben; `modellLabel(rolle)` |
| Tab-Titel | [tab-titel.ts](../../src/core/services/ai/streamlit-bridge/tab-titel.ts) | Statusformat für `document.title` des KI-Tabs; im Snippet gespiegelt |

## Protokoll (postMessage)

```
App  → KI-Tab:  { type: 'tf-ping' }
KI-Tab → App:   { type: 'tf-pong', rev, modelle, kontextText }

App  → KI-Tab:  { type: 'tf-request', id, message, modell? }
KI-Tab → App:   { type: 'tf-progress', id }                (Heartbeat ~10 s, solange der Lauf lebt)
KI-Tab → App:   { type: 'tf-stream', id, content }         (Voll-Snapshots des Antwort-Markdowns)
KI-Tab → App:   { type: 'tf-response', id, result, reasoning?,
                  modell?, modelle?, kontextText?, kontextVoll?, fehlschlag? }

App  → KI-Tab:  { type: 'tf-reset', id, modell? }
KI-Tab → App:   { type: 'tf-reset-done', id, found, modelle }

KI-Tab → App:   { type: 'tf-bridge-ready', rev, modelle, kontextText }   (Announce beim Aktivieren)
KI-Tab → App:   { type: 'tf-app-ping' }  → App: { type: 'tf-app-pong' }  (Gegenrichtungs-Test)
```

`modell` ist der **sichtbare Optionstext** der Auswahlliste, keine Kennung. `modelle` ist diese Liste (`{ text, value, aktiv }`). Ohne `modell` fasst das Snippet die Auswahl nicht an, meldet aber im `tf-response`, welches Modell tatsächlich lief.

### `reasoning` gilt für BEIDE Wege (v6.5)

Das Snippet legt den Denkprozess **jedem** `tf-response` bei — es weiß nicht, ob die App gerade streamt. Der Transport hat ihn trotzdem lange nur im Streaming-Zweig ausgepackt: `submitMessage` löst auf einen String auf, und für einen zweiten Wert war darin kein Platz. Ein Skill-Lauf ohne Delta-Konsumenten (also jeder Gutachten-Abschnitt) nimmt genau diesen Zweig — der Denkprozess fiel dort still auf den Boden, ununterscheidbar von „das Modell hat nicht gedacht".

Der Weg dorthin ist jetzt `SubmitMessageOptions.onReasoning` — ein Rückruf, **einmal am Ende und vor dem Auflösen**, damit der Aufrufer den Wert direkt nach seinem `await` sieht. Bewusst **nicht** an `thinkingBudget` gekoppelt: über die Bridge entscheidet die fremde Seite, ob sie denkt; die App reicht durch, was ankommt. Ein leeres `reasoning` löst den Rückruf nicht aus — sonst wäre „nichts geliefert" von „leerer Denkprozess" nicht mehr zu unterscheiden. Naht-Tests: [streamlit-reasoning.test.ts](../../src/core/services/ai/__tests__/streamlit-reasoning.test.ts).

**Bewusst der Text und kein Index**: eine Liste kann sich zwischen dem Melden und dem Auftrag geändert haben, und ein verschobener Index wählt dann still das falsche Modell. Ein Text, den es nicht mehr gibt, ist dagegen ein sauberer Fehlschlag — und der ist hier richtig, weil die App ihre Nutzlast bereits auf das Fenster *dieses* Modells zugeschnitten hat.

## Rolle statt Modell — und warum

Die Achse hieß bis v5.0 `'standard' | 'agentisch'` (ein **Tab**), in v5.x `'gpt-oss' | 'qwen35'` (ein **Modell**). Seit v6.0 ist sie eine **Rolle**: `KiRolle = 'standard' | 'stark'`.

Der Grund ist ein Betriebsrisiko, kein Geschmack. Die interne KI wird von Kollegen betrieben und tauscht ihre Modelle nach ihrem eigenen Fahrplan. Solange der Modellname an ~50 Codestellen hing, war jeder ihrer Wechsel ein **Ausfall bei uns**: die Options-Regel fand nichts mehr, `ensureModell` meldete „steht nicht zur Wahl", und weil der Auto-Wechsel bei jedem großen Dokument genau dieses Modell ansteuert, hörte ausgerechnet die Arbeit mit großen Anträgen auf zu funktionieren — an einem Tag, den wir nicht bestimmen, mitten in einer Aufbereitung.

Fast keine Stelle im Code meint wirklich ein Modell. `FEEDBACK_ZIEL`, `EIN_SCHUSS_ZIEL`, `AUFBEREITUNG_ZIEL`, `ABLEITUNG_ZIEL` meinen „klein und billig"; [ziel-fallback.ts](../../src/core/services/ai/ziel-fallback.ts) meint „das verlässliche nach einem Fehlschlag"; der Auto-Wechsel meint „das weiteste Fenster"; die Zweitmeinung meint „ein *anderes* als eben". Das sind Rollen.

| Rolle | meint | löst sich auf zu |
|---|---|---|
| `standard` | bodenständig: normales Fenster, schnell, für die grundlegenden Aufgaben gut genug | Katalogmodell dieser Rolle, sonst die **Voreinstellung der KI-Seite** |
| `stark` | weites Kontextfenster **und** agentische Fähigkeiten — bewusst offen für Eigenschaften, die heute noch nicht feststehen | Katalogmodell dieser Rolle, sonst das **weiteste bekannte Fenster** |

Beide Auflösungen hängen an **beobachtbaren** Eigenschaften. Fällt der Katalog aus der Zeit, lösen sie weiter richtig auf.

### Drei Schichten, absteigende Autorität

1. **Die KI-Seite** — was sie anbietet und was ihre Chatlängen-Anzeige sagt. Die Bridge meldet beides, [bridge-modelle.ts](../../src/core/services/ai/bridge-modelle.ts) hält es (localStorage, damit die App auch ohne Verbindung Auskunft geben kann).
2. **Der Katalog** — Rolle und Rückfall-Fenster. **Ein neues Modell = eine Zeile.** Kein Typwechsel, keine Migration, **kein neues Lesezeichen**.
3. **Nichts** — ein unbekanntes Modell bleibt unbekannt. Es wird nicht geraten: ein zu groß angesetztes Fenster fällt niemandem auf, weil das Modell dann still den Anfang des Prompts wegschiebt.

### Wenn die interne KI ihre Modelle tauscht

- **Neues Modell, Katalog kennt es nicht** → die App arbeitet weiter. Sein Fenster wird beim ersten Lauf **abgelesen und unter seinem Namen gemerkt**; ab dann kann es die Rolle `stark` tragen, ohne dass jemand den Katalog anfasst.
- **Ohne gemessenes Fenster** wird ein unbekanntes Modell **nicht** zur starken Rolle erhoben — es könnte 8k haben, und ein auf 250k zugeschnittener Lauf liefe still über.
- **Sichtbar statt still**: die Modell-Auswahl nennt unter den Kacheln, was die interne KI anbietet und diese App noch nicht einordnen kann. Bis v5 fiel ein Modellwechsel erst auf, wenn ein Lauf scheiterte.
- **Multimodale Modelle sind gesperrt** — nicht weil sie schlecht wären (Qwen3-VL kann OCR in 32 Sprachen), sondern weil die Bridge ausschließlich Text überträgt *und* das Fenster mit 62k das kleine ist. Eine Eskalation dorthin liefe genau in das Fenster, dem sie entkommen soll. Das Muster ist generisch: jedes künftige multimodale Modell fällt ebenfalls heraus.

Die Read-Time-Migration in [ki-ziel.ts](../../src/core/services/ai/ki-ziel.ts) fängt **beide** Alt-Generationen: `'standard'`/`'gpt-oss'` → `'standard'`, `'agentisch'`/`'qwen35'` → `'stark'`. Der agentische Chat war Qwen3.6 *plus fest eingebautem Kontext*; wer ihn gewählt hatte, wollte das große Fenster und behält es.

**Guard** `modellname-nur-im-katalog` ([conventions-daten.test.ts](../../src/__tests__/conventions-daten.test.ts)): ein Modellname der internen KI außerhalb von `modell-katalog.ts` bricht das Gate. Anzeige geht über `modellLabel(rolle)`, Auswahl über die Rolle. Ausgenommen sind OpenRouter-Modell-Ids — dort **ist** die Id der Wert.

### Auto-Wechsel nach Umfang

Passt ein Lauf nicht in das gewählte Fenster, hebt ihn [modell-wahl.ts](../../src/core/services/ai/modell-wahl.ts) auf die Rolle mit dem größeren Fenster. **Nur aufwärts, nie abwärts** — die Wahl des Bearbeiters ist eine Untergrenze, keine Schätzung, die wir korrigieren dürften. Seit `stark` mehr meint als nur ein weites Fenster (agentische Fähigkeiten), wäre „passt ja auch klein" ohnehin die falsche Frage.

Der Auto-Wechsel misst **ausschließlich das Fenster** — die Rolle ist die Präferenz des Bearbeiters, die Eskalation eine mechanische Übersteuerung. Deshalb trägt der Katalog beide Eigenschaften getrennt: käme ein Modell mit weitem Fenster, aber ohne die Stärke, dürfte die Eskalation es nehmen, die Rolle `stark` aber nicht.

Damit dreht sich eine Reihenfolge um: bis v5.0 war Kürzen der erste Reflex (`capVbMarkdown` schnitt auf den Cap des *gewählten* Modells, das größere Fenster daneben blieb ungenutzt). Jetzt wird erst das Modell gewählt und der Cap daraus abgeleitet; gekürzt wird nur noch, wenn auch das größte Fenster nicht reicht.

**Zwei Aufrufer, eine Funktion** — bewusst doppelt, weil sie verschiedene Dinge messen:

- [run-skill.ts](../../src/core/services/skills/run/run-skill.ts) braucht die Entscheidung **früh**, weil der Zeichen-Cap am Modell hängt. Es meldet die Anhebung auch selbst — der Transport sieht danach das bereits angehobene Ziel und (richtigerweise) keine Eskalation mehr.
- Der **Transport** entscheidet auf der fertig zusammengebauten Nutzlast. Nur dort steht die *ganze* Nachricht, und nur dort laufen die Pfade vorbei, die `runSkill` umgehen: Assistent-Turn, Chat, Aufbereitungs-Bausteine, Feedback, Gedächtnis.

Der Doppelaufruf ist unschädlich, weil die Funktion idempotent ist (Test `idempotent: die Wahl auf sich selbst angewandt ändert nichts mehr`). Wer die Transport-Stelle als Dopplung wegräumt, nimmt den Nicht-Skill-Pfaden den Auto-Wechsel.

**Sichtbar gemeldet** an zwei Orten mit verschiedener Lebensdauer: [ModellEskalationHinweis](../../src/core/components/ModellEskalationHinweis.tsx) — einmal in der Shell montiert, rendert `null`, solange nichts angehoben wurde — ist die flüchtige Ansage; `SkillRunResult.modellWahl` ist der bleibende Vermerk am gespeicherten Lauf.

### Ablauf eines Laufs

1. Chat-Bereich sicherstellen (`#sendform` vorhanden, sonst Reiter „Chat" klicken).
2. **Modell setzen** — über das native `<select>` + `change`-Ereignis, damit htmx den `#app`-Swap wie gewohnt ausführt und die Seite in sich stimmig bleibt (Modellname, Kontextleiste, Sperren). Ein stiller `fetch` würde die Anzeige von der Server-Sitzung wegdriften lassen. Anschließend wird **verifiziert**: ein nicht durchgeschlagener Wechsel ist ein Fehler, keine stille Abweichung.
3. Datenquelle auf „— keine —".
4. `POST` an die Sende-Adresse mit `message`.
5. Aus dem Antwort-Fragment `.sse[data-url]` lesen, `EventSource` öffnen — und das Fragment an `hx-target` der Seite **einhängen** (siehe unten).
6. `message` → HTML → Markdown → `tf-stream`, zugleich in die Antwortblase der Seite; `reasoning` sammeln; `tokenbar` in die Leiste; **`done` beendet den Lauf**.
7. Kontextstand **nach** dem Lauf ablesen und mitmelden — das ist der Wert, der die nächste Anfrage begrenzt.

Liefert der `POST` **kein** `.sse`-Element, ist das Fragment selbst die Antwort (eine Fehlermeldung der Seite, z. B. „Maximale Chatlänge überschritten"). Sie wird als Ergebnis zurückgegeben statt verschwiegen — der Nutzer soll den Grund lesen.

### Was die Seite selbst zeigt

Wer an htmx vorbei sendet, übernimmt **dessen zweite Hälfte** mit: das Einhängen der Antwort. Zwischen v6.0 und v6.3 tat das niemand — der sichtbare Chat der internen KI blieb leer, obwohl Frage und Antwort längst durchliefen. Sichtbar wurde etwas nur **zufällig**: ein Modellwechsel löst über das `change`-Ereignis den `#app`-Swap der Seite aus, und der rendert den serverseitigen Verlauf mit. Deshalb erschien der Chat ausgerechnet beim zweiten Lauf — und zeigte dann den Stand **vor** dem Zurücksetzen, also einen Verlauf, den der Server bereits verworfen hatte.

Das war nicht nur Optik. `kontextStand()` liest die Tokenleiste der Seite, und aus ihr kommt das `data-over`-Signal („Fenster voll") an die App. Eine Leiste, die nie nachgezogen wird, meldet bis zum nächsten Neuladen einen alten Stand.

Seit v6.4 wird der Renderauftrag erfüllt, den die Seite **selbst an ihrem Formular notiert** (`hx-target` / `hx-swap`), mit **ihrem eigenen Fragment**. Es wird kein Markup erfunden; eingehängt wird, was der Server geliefert hat. Drei Stellen: Senden, Antwortstrom (`message`-Snapshots ersetzen den Inhalt der Antwortblase), Zurücksetzen.

Zwei Invarianten hält [snippet-render.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/snippet-render.test.ts):

| Invariante | Warum |
|---|---|
| Fragmente werden vor dem Einhängen **entschärft** (`data-url` → `data-tf-url`) | Bliebe die Strom-Adresse stehen, könnte die Mechanik der fremden Seite daran einen **zweiten** `EventSource` öffnen — derselbe Lauf zweimal, auf Kosten der internen KI |
| `hx-swap`-Rückfall ist **`beforeend`**, nie htmx' echter Standard `innerHTML` | Fehlt das Attribut, steht das Eingehängte höchstens an der falschen Stelle; Ersetzen würde den sichtbaren Verlauf **löschen** |
| Eingehängtes geht durch **`htmx.process()`** | Eingehängtes Markup hat keine htmx-Bindungen. `/reset` tauscht `#app` **komplett** — ohne den Aufruf wären Modell-Auswahl und Reiter danach tot, und der nächste Modellwechsel liefe stumm in seinen 15-s-Timeout |

Nachgeführt wird nur, wenn der Leser ohnehin unten steht — wer hochgescrollt hat, um mitzulesen, soll nicht bei jedem Token zurückgerissen werden.

Die Anker oben stammen aus der **Konsole des Produktivsystems**, nicht aus einer Annahme — ein selbst erfundenes jsdom-Fixture hätte nur bestätigt, was wir ohnehin geglaubt haben. Was kein lokaler Test belegen kann, bleibt die Abnahme dort: dass die Anzeige wirklich erscheint. Das Snippet meldet dafür bei jedem Lauf `[TeamFlow-Bridge] Antwort-Fragment: …` in die Konsole — Gerüst, Strom ja/nein, Antwortblase gefunden ja/nein; **nie Inhalt**, dort stünde sonst der Prompt.

### Was ersatzlos entfallen ist

Echo-Erkennung, Antwort-Auswahl im Nachrichten-Roster, `isRunning()`-Polling, das Ruhefenster (`SETTLE_MS`) und der Abschluss-Marker (`erwarteAbschluss`) waren allesamt Umgehungen eines **fehlenden Fertig-Signals**. Der Strom liefert es. Siehe [recurring-bug-classes.md → Klasse 10](recurring-bug-classes.md), Nachtrag v5.0.

`SubmitMessageOptions.erwarteAbschluss` existiert app-seitig vorerst weiter (Gutachten-Abschnitte setzen ihn), wird vom Snippet aber **ignoriert**. Er verschwindet, sobald `done` im Regelbetrieb belegt ist.

### Revisions-Handschlag

`BRIDGE_REV` markiert die Snippet-Version; das Snippet meldet sie in `tf-pong` und `tf-bridge-ready`, die App hält sie in [bridge-status.ts](../../src/core/services/ai/bridge-status.ts) und vergleicht per `istBookmarkletVeraltet` gegen die aus dem Snippet gelesene eigene Revision (kein zweiter Konstanten-Ort).

Bis zum Umbau war ein altes Snippet **harmlos**: es ignorierte unbekannte Felder und lief sonst weiter. Das gilt nicht mehr. Ein Snippet ohne Modellsteuerung antwortet aus einem anderen Modell mit einem anderen Kontextfenster, als die App annimmt — ohne jedes Anzeichen. Deshalb meldet die Verbindungs-Gruppe ein veraltetes Lesezeichen sichtbar. `rev === null` heißt „noch kein Handschlag" und schweigt; ein **leerer** String ist dagegen eine Aussage (gemeldet, aber ohne Revision → Fassung von vor dem Umbau).

`BRIDGE_VERSION` ist die Kurzform davon und steht im **Lesezeichen-Namen** (`interne-KI v4`) — das Einzige, was der Nutzer ohne Klick sieht. Beide Marker werden zusammen hochgezählt; der Guard prüft nur, dass sie lesbar sind und der Name in die Lesezeichenleiste passt (ob jemand beide Zeilen angefasst hat, steht nirgends im Code).

**Wann eine neue Version nötig ist** — und wann nicht: das Snippet kennt seit v6.0 keine Modellnamen mehr. Ein Modellwechsel der internen KI kostet deshalb **keine** Neuinstallation, nur einen Build. Neu ziehen muss das Team nur, wenn sich das **Protokoll** ändert.

## Invarianten

- **Stateless-Läufe = frischer Chat** (Pitfall #36): Skill-Läufe sind stateless designt (voller Kontext im Prompt), der Chat der internen KI ist aber stateful (serverseitige Sitzung) — ohne Reset akkumuliert der Verlauf (Kontext-Überlauf, zwischen Vorgängen vermischte VBs). Deshalb ruft **jeder** Einzel-Skill-Lauf `resetChat` VOR dem Submit, über den gemeinsamen Helfer `starteFrischenChat` ([chat-reset.ts](../../src/core/services/ai/chat-reset.ts) → `'ok' | 'nicht-gefunden' | 'nicht-unterstuetzt' | 'timeout'`, wirft nie): der zentrale Skill-Runner `runSkill` (Gutachten A–G, KI-QS, Kurzfassung, Nachforderungen, Batch, Anonymisieren, Metadaten), die Aufbereitungs-Bausteine `runBaustein`, die Relevanz-Map `runRelevanzMap` und der In-App-Eval-Runner. Best-effort: `'nicht-gefunden'`/`'timeout'` bricht den Lauf NIE ab, markiert ihn aber (Warn-Banner bei Gutachten/Aufbereitung, Reset-Status-Zeile im Eval-Report); `'nicht-unterstuetzt'` (DirectLLM/llama.cpp — ohnehin stateless) erzeugt keine Warnung. **Ausgenommen:** das mehrturnige Such-Chat-Panel und die Batch-Analyse `begruendung.ts` (behält ihre adaptive ~30K-Token-Strategie).
- **Origin-Pinning**: der Transport akzeptiert nur Nachrichten von der konfigurierten URL-Origin (`new URL(streamlitUrl).origin`), nicht hart `localhost` — interne Hosts laufen ggf. unter Servername/IP. Unparsebare URL → akzeptierend (Single-Team-Trust).
- **Fenster-Handle aus `event.source`**: der Transport übernimmt bei jeder eingehenden `tf-*`-Nachricht `event.source` als `streamlitWindow` — das exakte Tab, in dem das Bookmarklet läuft. Das Bookmarklet sendet beim Aktivieren `tf-bridge-ready` an `window.opener`. So muss `window.open` den Tab **nicht** erneut öffnen (das würde ihn neu laden und das injizierte Bookmarklet löschen). **Voraussetzung:** der KI-Tab wird **aus der App** geöffnet („Interne KI öffnen").
- **Korrelation über `id`** (`Map<id, {resolve, reject, cancel, touch?}>`); Abort verwirft das pending-Promise, der Lauf läuft serverseitig fertig.

## Timeouts

Aktivitätsbasiert ([deadline.ts](../../src/core/services/ai/transports/deadline.ts) `createActivityDeadline`): eingehende `tf-stream`/`tf-progress` schieben das Idle-Timeout — lange Läufe unter Server-Last (Queue vor dem ersten Token) laufen durch; nur echte Funkstille lässt die Anfrage scheitern. App-Werte liegen über den Snippet-Werten, damit ein App-Timeout „Bookmarklet tot" bedeutet, nie „Lauf zu langsam".

| Timer | Wert | Wo |
|---|---|---|
| Ping | 5 s | App (`ping`) |
| Chat-Reset | 15 s | App (`resetChat`) |
| Modellwechsel / Reiter-Wechsel (`SWAP_TIMEOUT_MS`) | 15 s | Snippet |
| Stille im Strom (`STILL_MS`: kein SSE-Ereignis mehr, aber auch kein `done`) | 180 s | Snippet |
| Harter Deckel (`HARD_MAX_MS`) | 600 s | Snippet |
| Antwort-Idle (`RESPONSE_IDLE_TIMEOUT_MS`, resettet auf tf-stream/tf-progress) | 200 s | App |
| Antwort-Hard (`RESPONSE_HARD_TIMEOUT_MS`) | 660 s | App |

## Anzeige im KI-Tab

- **Status-Pill** (`#tf-bridge-badge` in `#tf-bridge-bar`): farbiger Punkt + neutraler Text auf hellem Grund, fix **unten rechts, nach links eingerückt** (`bottom:12px;right:220px`, z-index-Maximum) — Chrome zeichnet seine Bildschirmfreigabe-Anzeige unten rechts (außerhalb der Seite, nicht per JS messbar). Ein 4-s-Watchdog hängt die Leiste wieder an, rückt sie ans body-Ende und re-asserted die Inline-Styles. Ein **Klick** löst beide Selbsttests erneut aus. `window.__teamflowBridge`-Guard gegen Doppel-Installation.
- **Anschluss-Test statt Chat-Test**: `pruefeAnschluss()` prüft **einzeln**, was die Bridge wirklich braucht — Sitzungs-Id, Chat-Formular, Sende-Adresse, Modell-Auswahl, Reset-Weg, Kontextleiste — und benennt das erste Fehlende in der Pill. Der frühere Rundlauf mit einer Rechenfrage entfällt: er kostete einen echten Lauf und sagte nur „irgendetwas stimmt nicht". **Ein stiller Teilausfall wie beim Streamlit→htmx-Wechsel — senden ging, Antworten lesen nicht — darf sich nicht wiederholen.**
- **Tab-Titel als zweiter Ausgabekanal**: Die Pill sieht nur, wer **in** diesem Tab ist. Derselbe Zustand steht deshalb im `document.title` des KI-Tabs: `⏳ 0:42 · 1,4k · <Fremdtitel>` während eines Laufs (Uhr **und** wachsender Antwort-Umfang — nur der Umfang belegt „kommt voran", eine Uhr tickt auch bei totem Server weiter), `✅ Fertig` für 60 s (`QUITTUNG_MS`), `⚠️ …` bleibt bis zum nächsten Statuswechsel stehen. Symbol **vorne**, damit es sichtbar bleibt, wenn Chrome den Tab-Text abschneidet. Angehängt an `setBadge()` — dem einzigen Statuswechsel-Punkt des Snippets, damit Tab und Pill nicht auseinanderlaufen können.

## Aktivierung (Nutzer-Flow)

Das Lesezeichen muss **einmal pro KI-Tab** angeklickt werden (nach jedem Neuladen erneut) — unter `file://` kann die App kein JS in den fremden cross-origin-Tab injizieren; das Bookmarklet ist der vom Nutzer autorisierte Weg.

**Das Lesezeichen heißt `interne-KI v<n>`** ([snippet.ts](../../src/core/services/ai/streamlit-bridge/snippet.ts), `BRIDGE_BOOKMARK_NAME`). Die Nummer ist der eigentliche Zweck: ein Lesezeichen sieht man in der Leiste, **ohne es anzuklicken** — dort beantwortet sie „habe ich die aktuelle Bridge?", ohne dass jemand die Einstellungen öffnen muss. Kurz gehalten, weil Chrome längere Namen in der Leiste auf ein Icon zusammenschnurren lässt; dann wäre die Nummer genau dort unsichtbar, wo sie gebraucht wird. `BRIDGE_VERSION` (Kurzform, sichtbar) und `BRIDGE_REV` (genau, für den Handschlag) werden **gemeinsam** hochgezählt — erzwingen lässt sich das nicht, [snippet-version.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/snippet-version.test.ts) prüft nur, dass beide lesbar bleiben.

**Ein Weg in die Lesezeichenleiste**: das Lesezeichen wird **gezogen**, nicht angeklickt — bewusst ohne zweiten Knopf daneben, der sich wie ein gleichwertiger Weg läse. Der `javascript:`-href kommt über eine **Callback-Ref** ins DOM, nicht aus einem Mount-Effekt: der Anker steckt in einer `SettingsKlappe`, die ihre Kinder erst beim Aufklappen montiert — ein `[]`-Effekt lief ins Leere, solange die Klappe zu war (seit v4.31, [Bug-Klasse 23](recurring-bug-classes.md)).

## Sichtbarkeit / Flag

Feature-Flag `streamlitBridge` (`isStreamlitBridgeEnabled()`, optional, default false). Aktiv in **dev + prod + kurator + pl**. Schaltet den KI-Assistent-Tab frei und blendet die Bridge-Sektion ein. In prod/kurator erscheint **nur** die Bridge-Sektion; der volle Provider-Switcher bleibt dev-exklusiv (`isDevContext`).

## Test

Die gespiegelte Logik läuft je per Marker-Extraktion gegen dieselben Fixtures wie die TS-Fassung (Drift-Schutz): [modell-erkennung.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/modell-erkennung.test.ts) (Modell-Zuordnung inkl. **VL-Ausschluss**, Chatlängen-Ablesung — Fixtures sind die echten Options-Texte aus dem Produktiv-Dump) und [tab-titel.test.ts](../../src/core/services/ai/streamlit-bridge/__tests__/tab-titel.test.ts). Dazu [deadline.test.ts](../../src/core/services/ai/transports/__tests__/deadline.test.ts) + [streamlit-deadline.test.ts](../../src/core/services/ai/__tests__/streamlit-deadline.test.ts) (aktivitätsbasierte Timeouts) und [streamlit-ziel.test.ts](../../src/core/services/ai/__tests__/streamlit-ziel.test.ts) (Ziel-Weitergabe).

**Was kein Test abdeckt**, weil es die echte fremde Seite braucht: dass die abgelesenen Endpunkte stimmen, dass der Modellwechsel durchschlägt und dass `done` zuverlässig kommt. Diese drei gehören in den Handtest nach jedem `BRIDGE_REV`-Bump — `npm run build:devpl`, `file://` öffnen, Lesezeichen neu ziehen, eine echte Frage stellen.
