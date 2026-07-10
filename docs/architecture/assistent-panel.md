# Assistent-Panel (Phase 1)

Kontextbewusstes Frage-Antwort-Panel über deterministisch bereitgestellten Fakten. Der Nutzer fragt zu seiner aktuellen Arbeit („nächster Schritt bei diesem Verbund?", „welche Fristen?", „wo steht im Antrag etwas zu X?"); die App assembliert den Kontext **rein deterministisch** und schickt **genau einen** Prompt an das **interne** Modell. Das LLM formuliert nur — Status/Phase/Frist/nächster Schritt kommen aus bestehenden reinen Funktionen, nie vom Modell.

Feature-Flag `features.assistentPanel` (`isAssistentPanelEnabled()`, nur dev). **Phase 1 ist read-only**: kein Tool-Use, kein Auto-Retry, kein Zugriff auf das Phase-0-Ereignisprotokoll, kein Memory, keine schreibenden Aktionen, **keine** Persistenz der Historie (session-only). Agentik kommt in späteren Phasen.

## Harte Invarianten

1. **Immer dokumentinhaltig → nur intern.** Der Assistenten-Kontext enthält regelmäßig Dokumentinhalte (Orama-Auszüge aus VBs), daher gilt jeder Aufruf pauschal als dokument-tragend. Transportwahl **ausschließlich** über `bridge.getTransportForAssistent()` ([bridge.ts](../../src/core/services/ai/bridge.ts)) — reused die bestehende Policy `erlaubteTransportKlassen({ enthaeltDokumentInhalte: true })` mit Flag **hart `true`**; ist der aktive Provider extern, **wirft** die Methode. OpenRouter/extern ist strukturell unerreichbar, auch nicht als Fallback. Guard: `no-raw-active-transport` deckt jetzt auch `plugins/chat/assistent/` ([codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts)).
2. **resetChat pro Turn** (Pitfall #36). `starteFrischenChat` VOR dem Senden (best-effort; `resetHatVerlaufsrisiko` → Kontaminations-Warnung im Panel). Die Bridge-Statefulness wird **nie** als Gedächtnis genutzt — die Historie führt die App app-seitig und schickt sie im assemblierten Prompt mit.
3. **Deterministische Fakten injiziert, nie vom LLM berechnet.** Der Assembler ruft nur bestehende reine Funktionen (`naechsterSchritt`, `fristAnzeige`/`daysUntilFristAware`, `getStatusLabel`/`getStatusCategory`, `getVbPhaseLabel`) — er erfindet keine neue Ableitung.
4. **Ein Aufruf pro Turn.** Kein Auto-Retry, keine Schleife, keine Selbstkorrektur. Fehler → verständliche Panel-Meldung, Frage bleibt im Eingabefeld, **Historie unverändert** (der fehlgeschlagene Turn wird nicht einsortiert).
5. **Geteilter Grundsatz-Block, kein Duplikat.** Der Basis-Block „streng quellenbasiert / nichts erfinden / aktiver Stil" lebt in EINER Konstante `GRUNDSATZ_REGELN` ([grundsatz.ts](../../src/core/services/skills/registry/grundsatz.ts)); Seed-Builder (`seed.ts`) UND der Assembler referenzieren sie. Byte-Identität ist kritisch (Journey-Paket-4-Rollout-Migration) → Guard `grundsatz.test.ts`.
6. **Session-only Historie.** Kein IDB, kein Share, keine Persistenz der Konversation.

## Bausteine

| Ebene | Datei | Verantwortung |
|---|---|---|
| Kontext-Assembler (rein) | [src/core/services/assistent/kontext/](../../src/core/services/assistent/kontext/) | `assembliereAssistentKontext(eingabe) → { promptText, verwendeteTreffer, kontextBeschreibung }`; feste Blockreihenfolge, Budget; `beschreibeKontext()` für die Chips |
| Grundsatz-Block | [grundsatz.ts](../../src/core/services/skills/registry/grundsatz.ts) | geteilte `GRUNDSATZ_REGELN` (Leitplanke 5) |
| Transport-Gate | [bridge.ts](../../src/core/services/ai/bridge.ts) `getTransportForAssistent()` | intern-only, wirft bei extern |
| Turn-Orchestrator (rein) | [turn.ts](../../src/plugins/chat/assistent/turn.ts) | `fuehreAssistentTurnAus(frage, turns, deps)`; Transport→ping→Kontext→Retrieval→assemble→resetChat→submit; nie werfend |
| Session-Store (vanilla) | [sessionStore.ts](../../src/plugins/chat/assistent/sessionStore.ts) | session-only Historie, optimistischer Append + Rollback bei Fehler |
| Kontext-Snapshot (unrein) | [kontextSnapshot.ts](../../src/plugins/chat/assistent/kontextSnapshot.ts) | Route + selektierte Entität (Antraege-Store) → `KontextEntitaet` |
| UI-Dock-Zustand | [panelUiStore.ts](../../src/plugins/chat/assistent/panelUiStore.ts) | offen/Breite (localStorage) — geteilt zwischen Shell-Mount, Suche-Button, Command-Palette |
| Controller (Hook) | [useAssistentController.ts](../../src/plugins/chat/assistent/useAssistentController.ts) | verdrahtet Transport/Kontext/Retrieval, exponiert schlanken Controller |
| Panel-UI | [AssistentPanelHost.tsx](../../src/plugins/chat/assistent/AssistentPanelHost.tsx) | shell-weites Dock; Wiederverwendung `MessageList`/`SourcePanel`/chat.css |

## Kontext-Assembler — feste Blockreihenfolge

Analog zur fixen Skill-Komposition: **System → Fakten → Retrieval → Historie → Frage**.

1. **System** — Rolle, Grenzen (nur bereitgestellte Fakten; fehlt Info → sagen statt raten; keine Rechts-/Förderentscheidungen), Deutsch, kurz. Bindet `GRUNDSATZ_REGELN` ein.
2. **Fakten (deterministisch, wird NIE gekürzt)** — Route in Worten, Entität + Stammdaten, Status-Label + Kategorie, `naechsterSchritt()`, Frist-Hinweis (vom Controller aus `fristAnzeige`/`daysUntilFristAware` vorformatiert; hält den Assembler frei von Plugin-Importen).
3. **Retrieval (optional)** — Top-k Orama-Chunks (k=5), Treffer **unter `RETRIEVAL_MIN_SCORE` verworfen** → dann KEIN Block (statt schlechtem Block); als `[n] Titel: Auszug`. Das Retrieval selbst läuft im Controller (`useSearch().search`, unrein) und wird als `treffer` hereingereicht → Assembler bleibt byte-deterministisch.
4. **Historie** — bisherige Turns dieser Sitzung.
5. **Frage** + Ausgabeanweisung: auf Auszüge gestützte Aussagen referenzieren `[n]` (mappt auf `ChatSource.n`).

**Budget** (`GESAMT_MAX_CHARS`): bei Überschreitung wird in fester Reihenfolge gekürzt — erst Historie (ältester Turn zuerst), dann Retrieval-k (schwächster Treffer zuerst); **Fakten + Frage bleiben unangetastet**.

## Fundstellen = Orama + bestehendes Chat-Zitatsystem

Bewusste Entscheidung (statt der `[3.2]`-VB-Sektions-Popover): der Orama-Index trägt keine strukturierten Sektions-IDs; das Chat-Panel hat bereits ein vollständiges `[n]`-Zitatsystem über Orama. `verwendeteTreffer` → `buildChatSources` ([rag-sources.ts](../../src/plugins/chat/services/rag-sources.ts)) → `ChatSource[]`; gerendert über `CitationAnswer` (`[n]`-Inline), `AssistantMessage` (Quellen-Chips + „Verwendeter Kontext") und `SourcePanel` — alles wiederverwendet, kein Fork.

## Panel-Ort

Shell-weit: EINMAL in [ShellLayout](../../src/core/ShellLayout.tsx) hinter `isAssistentPanelEnabled()` gemountet, auf JEDER Route verfügbar (Suche wie Antrag-/Verbund-Detail) — damit der Entitätskontext direkt ist. Der `panelUiStore` teilt den Offen-Zustand; bei aktivem Flag togglet der Suche-„Assistent"-Button und der Command-Palette-Befehl „Assistent öffnen" dieses Dock (die Suche rendert dann NICHT mehr den alten `ChatPanelHost` → kein Doppel-Panel).

## Abgrenzung / offen

- Der bestehende Chat + „Mit KI analysieren" nutzen weiter rohen `getActiveTransport()` (nur das Build-Flag schützt) — in dieser Phase **nicht** gefixt; der Assistent erbt den Pfad nicht (eigener gegateter Controller).
- Später (nicht Phase 1): zentrale Assistenten-Transport-Policy, Tool-Use/Agentik, Zugriff aufs Phase-0-Protokoll/Memory (Streaming-Antwort, sobald der Bridge-Pfad es produktiv hergibt).

## Aktivierung außerhalb dev

pl separat nach manuellem Smoke-Test schalten: in `configs/pl.config.json` unter `features` `"assistentPanel": true` ergänzen und `npm run build:pl` neu bauen.
