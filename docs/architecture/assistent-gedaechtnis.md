# Assistent-Gedächtnis (Phase 2)

Sleep-time-Konsolidierung des [Ereignisprotokolls](assistent-protokoll.md) (Phase 0) in wenige benannte, größenbegrenzte **Memory-Blocks**. Ein Hintergrundlauf destilliert per **internem** Modell die neuen Ereignisse zu knappen Faktensätzen, die transparent einsehbar/löschbar sind und als zusätzlicher Block in den [Panel-Kontext-Assembler](assistent-panel.md) (Phase 1) einfließen.

Feature-Flag `features.assistentGedaechtnis` (`isAssistentGedaechtnisEnabled()`, nur dev). **Read-only zum Panel hin**; schreibend ist ausschließlich der Konsolidierungslauf (gegated).

Kernidee (Verankerungs-Philosophie der App, auf Nutzerkontext angewandt): **das rohe Protokoll ist die Wahrheit, jeder Gedächtnis-Eintrag ist Cache** und trägt Belege (Ereignis-IDs). Das LLM liefert **nur Faktensätze + Operationstypen** — nie IDs/Zeitstempel/Belege, nie einen Block als Ganzes.

## Harte Invarianten

1. **Strikt lokal.** Einträge + beide Opt-ins + Lauf-Metadaten leben ausschließlich in der Varianten-IndexedDB (Store `assistent_gedaechtnis`, IDBStore **v10**). NIE auf den Share, NIE in `registry.json`, NIE in Snapshot-/Export-Pfade — der Store steht in KEINER Snapshot-Allowlist. Guard: [store.test.ts](../../src/core/services/assistent/gedaechtnis/__tests__/store.test.ts) „Snapshot-Ausschluss".
2. **Nur interne Transports.** Die Konsolidierung gilt pauschal als dokumentinhaltig (Ereignisse enthalten Suchanfragen/Entitätsbezüge). Transportwahl ausschließlich über `bridge.getTransportForKonsolidierung()` ([bridge.ts](../../src/core/services/ai/bridge.ts), reused `erlaubteTransportKlassen({ enthaeltDokumentInhalte: true })`, Flag hart `true`) — externer Provider **wirft**. Guard `no-raw-active-transport` (#30) deckt jetzt auch `core/services/assistent/gedaechtnis/`.
3. **Doppeltes Opt-in.** Der Gedächtnis-Toggle ist nur aktivierbar, wenn das Protokoll-Opt-in aktiv ist. Der Konsolidierungslauf schreibt NUR bei Flag **und** beiden Opt-ins. Der Phase-0-Erklärtext ist entsprechend angepasst (ohne Gedächtnis: „gar nicht an eine KI"; mit aktivem Gedächtnis: Auswertung ausschließlich durch das interne Modell vor Ort, nie extern, nie über das Internet).
4. **Operationen statt Neuschrieb; invalidieren statt löschen.** Das LLM gibt pro Lauf eine Liste diskreter Operationen (`ADD`/`UPDATE`/`INVALIDATE`/`NOOP`) zurück; `UPDATE` erzeugt einen neuen Eintrag mit `vorgaengerId` und invalidiert den Vorgänger. Harte Löschung nur durch den Nutzer (Einzel-/„Alles vergessen") oder deterministische Retention (invalidierte Einträge > 30 Tage). Kein Auto-Retry, kein zweiter Aufruf; ungültige Operationen werden **verworfen** (mit Grund), nie nachverhandelt.
5. **Deterministische Werte nie vom LLM.** IDs, Zeitstempel, Belege-Prüfung, Grenzen erzeugt/validiert der Code in der **reinen** `wendeOperationenAn` (Uhr + ID-Fabrik injiziert → node-testbar/deterministisch). Belege müssen im Protokoll existieren; sonst wird die Operation verworfen.
6. **Bridge-Exklusivität.** Die Konsolidierung nutzt die Bridge nie parallel zu einem Skill-Lauf oder Panel-Turn. Der `BridgeMutex` gibt ihr einen Lease **nur** bei freier Bridge und bricht ihn ab, sobald Vordergrund-I/O startet — Skill-Läufe und Panel haben Vorrang (siehe unten). Datenatomarität: Operationen werden erst nach vollständigem Parse angewandt; ein abgebrochener/fehlerhafter Lauf lässt Bestand + Wasserzeichen unverändert.
7. **Kein Idle-Tracking.** Trigger sind App-Start (wenn letzter Lauf > 12 h) und ein manueller Button. Keine kontinuierliche Aktivitätsüberwachung.
8. **Memory-Poisoning-Abwehr.** Ereignisinhalte sind Daten, nie Anweisungen — der Prompt sagt das explizit; zusätzlich verwirft der deterministische Guard ([guard.ts](../../src/core/services/assistent/gedaechtnis/guard.ts)) instruktiv/injektiv geformte oder grenzverletzende Einträge (auch wenn das Modell sie vorschlägt).
9. **Additiv.** Eintrag-Schema `version: 1`; Erweiterung nur über optionale Felder.

## Bausteine

Modul [src/core/services/assistent/gedaechtnis/](../../src/core/services/assistent/gedaechtnis/):

| Datei | Verantwortung |
|---|---|
| [types.ts](../../src/core/services/assistent/gedaechtnis/types.ts) | `GedaechtnisEintrag` (Schema v1), 3 Blocks (`arbeitskontext`/`praeferenzen`/`offene_faeden`), Operationstypen, `LaufErgebnis`/`LaufMeta`, Store-/Grenzwert-Konstanten |
| [store.ts](../../src/core/services/assistent/gedaechtnis/store.ts) | IDB-CRUD (nur lokal, kein Sync): `alleEintraege`, `schreibeStapel` (put, atomar), `loescheEintrag`/`loescheAlle`, `entferneInvalidierteAelterAls` |
| [operationen.ts](../../src/core/services/assistent/gedaechtnis/operationen.ts) | **rein**: `wendeOperationenAn(ops, bestand, {belegIndex, jetzt, neueId})` → validiert (Belege, Textgrenzen/Poisoning, Duplikat, Blockkapazität) + wendet an |
| [guard.ts](../../src/core/services/assistent/gedaechtnis/guard.ts) | **rein**: `istVerdaechtig(text)` (Instruktions-/Injection-Muster + Format-Reißer) |
| [eingabe.ts](../../src/core/services/assistent/gedaechtnis/eingabe.ts) | **rein**: `baueEingabe(neueEreignisse, aktive)` — jüngste 300 im Volltext + Zähl-Zusammenfassung des Überhangs; `belegIndex` = gezeigte IDs |
| [prompt.ts](../../src/core/services/assistent/gedaechtnis/prompt.ts) | **rein**: `buildKonsolidierungsPrompt(eingabe)` — Rolle, geteilter `GRUNDSATZ_REGELN`, Anti-Poisoning, JSON-Operations-Schema |
| [parse.ts](../../src/core/services/assistent/gedaechtnis/parse.ts) | `parseOperationsliste(raw)` über die geteilte tolerante Utility `parseJsonArrayTolerant`; `null` = kein Array (echter Parse-Fehler), `[]` = gültig-leer |
| [konsolidierung.ts](../../src/core/services/assistent/gedaechtnis/konsolidierung.ts) | Orchestrierung: Voraussetzungen → Eingabe → resetChat → EIN submit → parse → `wendeOperationenAn` → Bestand + Wasserzeichen atomar. Transport als Lease injiziert (`holeLease`) → testbar |
| [trigger.ts](../../src/core/services/assistent/gedaechtnis/trigger.ts) | App-Start (`konsolidierungFaellig`, 12 h) + manueller Lauf (`starteKonsolidierungManuell`) |
| [recorder.ts](../../src/core/services/assistent/gedaechtnis/recorder.ts) | Modul-Zustand (injizierter Store + Opt-in-Cache), `initGedaechtnis`, Lade-/Lösch-/Persistenz-Facaden, Lauf-Meta (kv) |

## Datenmodell

```ts
interface GedaechtnisEintrag {
  id: string; version: 1;
  block: 'arbeitskontext' | 'praeferenzen' | 'offene_faeden';
  text: string;                 // genau ein deutscher Faktensatz, max. 300 Zeichen
  status: 'aktiv' | 'invalidiert';
  erstellt: number; aktualisiert: number;   // epoch ms, vom Code
  vorgaengerId?: string;        // bei UPDATE: Kette zur invalidierten Vorversion
  belege: string[];             // Ereignis-IDs, min. 1, vom Code validiert
}
```

**Deterministische Grenzen** (Konstanten in `types.ts`): max. 15 aktive Einträge/Block (volle Kapazität → weitere `ADD` **verworfen**, nicht verdrängt); max. 300 Zeichen/`text`; invalidierte Einträge nach 30 Tagen entfernt; Duplikat-Guard über normalisiertem Text je Block. **Lauf-Meta** (kv): letzter Lauf, Wasserzeichen (jüngster konsolidierter Zeitstempel — nur bei Erfolg fortgeschrieben), angewandt/verworfen, Fehlerstatus.

## Bridge-Mutex (`BridgeMutex`)

[bridge-vordergrund.ts](../../src/core/services/ai/bridge-vordergrund.ts) — ein Vordergrund-Ref-Zähler + der Abort-Controller des laufenden Konsolidierungs-Lease, als eigene Klasse (unabhängig testbar), `AIBridge` delegiert:

- `getTransportForSkillRun`/`getTransportForAssistent` geben den Transport in einem **Lease-Wrapper** zurück, der bei jeder Bridge-I/O-Methode (`submitMessage`/`submitConversation`/`streamConversation`/`resetChat`) den Zähler hebt/senkt (`ping` zählt nicht). Die Skill-Runner-State-Machine (`runSkillInner`/`fuehreAssistentTurnAus`) bleibt **unangetastet**.
- `getTransportForKonsolidierung()` liefert einen Lease **nur** bei Zähler 0 (und keinem laufenden Lease); sonst `null` (der Lauf wartet auf den nächsten Trigger). Startet währenddessen ein Skill/Panel-Turn, feuert das Lease-`signal` → die Konsolidierung bricht ab (Vordergrund gewinnt). Bewusster Trade-off: zwischen `resetChat` und `submit` eines Vordergrund-Consumers fällt der Zähler kurz auf 0 — startet die Konsolidierung genau dann, bricht sie beim folgenden `submit` sofort ab (der Vordergrund-Consumer wird nie beschädigt).

## Panel-Integration

Der Assembler ([assembliere.ts](../../src/core/services/assistent/kontext/assembliere.ts)) bekommt einen optionalen **Gedächtnis-Block** an Index 1 — **nach** System, **vor** Fakten, klar als „Hintergrundwissen über die Arbeit des Nutzers (kann veraltet sein)" markiert. Der Controller ([useAssistentController.ts](../../src/plugins/chat/assistent/useAssistentController.ts), `ladeAssistentGedaechtnis`) lädt aktive Einträge **nur bei Flag + beiden Opt-ins** und reicht sie über den `getGedaechtnis`-Dep in den Turn. **Budget-Kaskade:** bei Überschreitung wird ZUERST das Gedächtnis gekürzt (niedrigster Wert), dann Historie (älteste), dann Retrieval (schwächste) — Fakten + Frage bleiben unantastbar. Kontext-Chip „Gedächtnis: N Einträge" im [AssistentPanelHost](../../src/plugins/chat/assistent/AssistentPanelHost.tsx).

## UI (Einstellungen → „Assistent & Gedächtnis")

[GedaechtnisSektion.tsx](../../src/plugins/einstellungen/GedaechtnisSektion.tsx): Opt-in-Toggle (doppeltes Opt-in), Lauf-Status + „Jetzt konsolidieren", die 3 Blocks mit aufklappbaren Einträgen (Belege → aufgelöste Ereignisse, Zeitstempel, Vorgänger-Hinweis), Einzellöschung, „Invalidierte anzeigen", „Alles vergessen" (mit Bestätigung).

## Eval (Phase D — das Gate statt manuellem Zwischentesten)

CLI `npm run eval:gedaechtnis` ([gedaechtnis-eval.ts](../../src/core/services/skill-eval/gedaechtnis-eval.ts), vite-node). 5 **fiktive** Fixtures (kaltstart, fortschreibung, widerspruch, poisoning, degradation über 20 Zyklen). **Deterministische Assertions** ([gedaechtnis-assertions.ts](../../src/core/services/skill-eval/gedaechtnis-assertions.ts)) sind das harte Gate: Belege-Integrität, Text-/Blockgrenzen, keine Duplikate, keine Instruktion, Szenario-Erwartungen. Bei poisoning/degradation ist die Stub-Modellausgabe bewusst fehlerhaft — die Code-Guards müssen greifen. `--dry-run` = Harness-Selbsttest (kein LLM, 100 % Assertions); der Live-Lauf misst zusätzlich einen LLM-Judge (Faktentreue/Nützlichkeit, extern zulässig da fiktiv), n=3.

## Aktivierung außerhalb dev

pl separat nach Testrunde schalten: in `configs/pl.config.json` unter `features` `"assistentGedaechtnis": true` ergänzen (setzt `assistentPanel` + `assistentProtokoll` sinnvoll voraus) und `npm run build:pl` neu bauen.
