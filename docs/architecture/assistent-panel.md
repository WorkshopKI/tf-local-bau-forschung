# Assistent-Panel (Phase 1)

Kontextbewusstes Frage-Antwort-Panel über deterministisch bereitgestellten Fakten. Der Nutzer fragt zu seiner aktuellen Arbeit („nächster Schritt bei diesem Verbund?", „welche Fristen?", „wo steht im Antrag etwas zu X?"); die App assembliert den Kontext **rein deterministisch** und schickt **genau einen** Prompt an das **interne** Modell. Das LLM formuliert nur — Status/Phase/Frist/nächster Schritt kommen aus bestehenden reinen Funktionen, nie vom Modell.

Feature-Flag `features.assistentPanel` (`isAssistentPanelEnabled()`, dev + pl + kurator + as). **Phase 1 ist read-only**: kein Tool-Use, kein Auto-Retry, kein Zugriff auf das Phase-0-Ereignisprotokoll, kein Memory, keine schreibenden Aktionen, **keine** Persistenz der Historie (session-only). Agentik kommt in späteren Phasen.

## Harte Invarianten

1. **Immer dokumentinhaltig → nur intern.** Der Assistenten-Kontext enthält regelmäßig Dokumentinhalte (Orama-Auszüge aus VBs), daher gilt jeder Aufruf pauschal als dokument-tragend. Transportwahl **ausschließlich** über `bridge.getTransportForAssistent()` ([bridge.ts](../../src/core/services/ai/bridge.ts)) — reused die bestehende Policy `erlaubteTransportKlassen({ enthaeltDokumentInhalte: true })` mit Flag **hart `true`**; ist der aktive Provider extern, **wirft** die Methode. OpenRouter/extern ist strukturell unerreichbar, auch nicht als Fallback. Guard: `no-raw-active-transport` deckt jetzt auch `plugins/chat/assistent/` ([conventions-daten.test.ts](../../src/__tests__/conventions-daten.test.ts)).
2. **resetChat pro Turn** (Pitfall #36). `starteFrischenChat` VOR dem Senden (best-effort; `resetHatVerlaufsrisiko` → Kontaminations-Warnung im Panel). Die Bridge-Statefulness wird **nie** als Gedächtnis genutzt — die Historie führt die App app-seitig und schickt sie im assemblierten Prompt mit.
3. **Deterministische Fakten injiziert, nie vom LLM berechnet.** Der Assembler ruft nur bestehende reine Funktionen (`naechsterSchritt`, `fristAnzeige`/`daysUntilFristAware`, `getStatusLabel`/`getStatusCategory`, `getVbPhaseLabel`) — er erfindet keine neue Ableitung.
4. **Ein Aufruf pro Turn.** Kein Auto-Retry, keine Schleife, keine Selbstkorrektur. Fehler → verständliche Panel-Meldung, Frage bleibt im Eingabefeld, **Historie unverändert** (der fehlgeschlagene Turn wird nicht einsortiert).
5. **Geteilter Grundsatz-Block, kein Duplikat.** Der Basis-Block „streng quellenbasiert / nichts erfinden / aktiver Stil" lebt in EINER Konstante `GRUNDSATZ_REGELN` ([grundsatz.ts](../../src/core/services/skills/registry/grundsatz.ts)); Seed-Builder (`seed.ts`) UND der Assembler referenzieren sie. Byte-Identität ist kritisch (Journey-Paket-4-Rollout-Migration) → Guard `grundsatz.test.ts`.
6. **Session-only Historie.** Kein IDB, kein Share, keine Persistenz der Konversation.
7. **Keine Personen im Prompt** (v6.54). Die Vorgangsakte trägt einen datierten Verlauf; ein Bearbeiter-Kürzel daneben machte „wie lange hat X gebraucht?" beantwortbar — ein Aktivitätsprotokoll ([vorgangssystem.md §12.6](vorgangssystem.md)). Die Besetzung zählt `besetzteRollen` (nur Rollen, nie Werte), der Systemblock verbietet Namen. Guard `assistent-ohne-personen` ([ohnePersonen.test.ts](../../src/plugins/chat/assistent/__tests__/ohnePersonen.test.ts)).

## Bausteine

| Ebene | Datei | Verantwortung |
|---|---|---|
| Kontext-Assembler (rein) | [src/core/services/assistent/kontext/](../../src/core/services/assistent/kontext/) | `assembliereAssistentKontext(eingabe) → { promptText, verwendeteTreffer, kontextBeschreibung }`; feste Blockreihenfolge, Budget; `beschreibeKontext()` für die Chips |
| Grundsatz-Block | [grundsatz.ts](../../src/core/services/skills/registry/grundsatz.ts) | geteilte `GRUNDSATZ_REGELN` (Leitplanke 5) |
| Transport-Gate | [bridge.ts](../../src/core/services/ai/bridge.ts) `getTransportForAssistent()` | intern-only, wirft bei extern |
| Turn-Orchestrator (rein) | [turn.ts](../../src/plugins/chat/assistent/turn.ts) | `fuehreAssistentTurnAus(frage, turns, deps)`; Transport→ping→Kontext→Retrieval→assemble→resetChat→submit; nie werfend |
| Session-Store (vanilla) | [sessionStore.ts](../../src/plugins/chat/assistent/sessionStore.ts) | session-only Historie, optimistischer Append + Rollback bei Fehler |
| Kontext-Snapshot (unrein) | [kontextSnapshot.ts](../../src/plugins/chat/assistent/kontextSnapshot.ts) | Route + Entität → `KontextEntitaet` (Vorrang: mitgegebener Schlüssel vor Store-Selektion, siehe unten); im Kein-Entität-Fall zusätzlich die Arbeitsvorrat-Übersicht |
| Fragen-Katalog (rein) | [fragenKatalog.ts](../../src/plugins/chat/assistent/fragenKatalog.ts) | `fragenFuer` / `fragenNachGruppe` / `folgefragen`; jede Frage an ein Signal der Vorgangsakte gebunden (v6.54, löst die Quick Actions ab) |
| Vorgangsakte (rein) | [akte.ts](../../src/core/services/assistent/kontext/akte.ts) (Form + Text), [vorgangsakte.ts](../../src/plugins/chat/assistent/vorgangsakte.ts) (Bau) | was die App über EINEN Vorgang schon rechnet, als Faktenblock |
| Akte-Hook (unrein) | [useVorgangsakte.ts](../../src/plugins/chat/assistent/useVorgangsakte.ts) | lädt `useStatusVerlauf` + `useVerbundMeilensteine`, nur bei offenem Dock |
| Wer fragt | [nutzerRolle.ts](../../src/plugins/chat/assistent/nutzerRolle.ts) | Fachrolle + Projektleitung aus dem Profil |
| Arbeitsvorrat-Übersicht (rein) | [arbeitsvorratUebersicht.ts](../../src/plugins/chat/assistent/arbeitsvorratUebersicht.ts) | `baueArbeitsvorratUebersicht(antraege, now)`; frist-sortierte Übersicht für den Kein-Entität-Faktenblock |
| UI-Dock-Zustand | [panelUiStore.ts](../../src/plugins/chat/assistent/panelUiStore.ts) | offen/Breite (localStorage) — geteilt zwischen Shell-Mount, Suche-Button, Command-Palette; dazu die transienten `vorgabe`/`vorgabeScope` |
| Controller (Hook) | [useAssistentController.ts](../../src/plugins/chat/assistent/useAssistentController.ts) | verdrahtet Transport/Kontext/Retrieval, exponiert schlanken Controller |
| Panel-UI | [AssistentPanelHost.tsx](../../src/plugins/chat/assistent/AssistentPanelHost.tsx) | shell-weites Dock; Wiederverwendung `MessageList`/`SourcePanel`/chat.css |

## Welche Entität gilt (v6.47.1)

`baueKontextSnapshot(now, scopeSchluessel?)` entscheidet in dieser Reihenfolge:

1. **Ein ausdrücklich mitgegebener Schlüssel** (`vorgabeScope`). Eine Karte, die
   eine Frage vorlegt, benennt damit auch deren Subjekt — der Tagesbrief reicht zu
   „Was ist bei CALYPSO zu tun?" die Verbund-Nummer mit. Ohne ihn stand auf der
   Startseite „Keine Entität ausgewählt" im Faktenblock, und die Antwort „dazu
   liegen mir keine Informationen vor" war die regelkonforme Folge, kein
   Modellfehler.
2. **Die Store-Selektion** — `selectedVerbundId`, sonst `selectedAktenzeichen`.

**Der Schlüssel ist zweideutig, und das ist Absicht.** Deep-Links legen
regelmäßig eine Verbund-Nummer in den Aktenzeichen-Slot (`#/antraege/ZKN121715`).
Die Detailseite verkraftet das seit v4.82; der Snapshot tat es nicht und zeigte dem
Modell den nackten Stub `{art:'antrag', id:'ZKN121715', titel:'ZKN121715'}` — ohne
Status, Frist und nächsten Schritt, während die Seite daneben den richtigen Verbund
rendete. Beide fragen jetzt dieselbe reine Ableitung
([`artDesSchluessels`](../../src/plugins/antraege/detailAufloesung.ts), aus
`loeseDetailAuf` herausgehoben statt danebengebaut): **Aktenzeichen zuerst**, dann
Verbund-Nummer, sonst der Schlüssel selbst.

**Der geliehene Vorgang wird wieder losgelassen** — bei Routenwechsel und bei „Neue
Unterhaltung" (`scopeLoeschen`). Er überlebt dagegen das Absenden und gilt für
Nachfragen derselben Unterhaltung; verschiedene Lebensdauern also, weshalb
`vorgabeVerbraucht()` nur den Text löscht. Ein von der Startseite geliehenes
CALYPSO, das nach der Navigation zu einem *anderen* Vorgang weitergälte, ließe den
Kontext-Chip lügen — und der Chip ist die Zusage „nur das geht ins Modell".

## Was zu tun ist — die Kaskade vor der Formel (v6.48.1)

Der Faktenblock sprach bis v6.48.0 allein `schrittText` — die alte Status-Formel,
die das Projekt längst als **Rückfall** führt (CLAUDE.md → „Was ist zu tun?").
Gemessen an DynaMaint (10.09.2026, gegen die interne KI): die Karte zeigte
*„Widerspruch gg Abl bearbeiten · liegt bei AB/FB/Jur"*, der Assistent sagte
*„Ablehnungsbescheid erstellen"* — zwei gegensätzliche Anweisungen auf einem
Bildschirm. Solange der Assistent „dazu weiß ich nichts" antwortete, fiel das
niemandem auf; mit der mitgereisten Entität wurde es zur falschen Handlungsanweisung.

Jetzt trägt `KontextEntitaet.aufgabe` das Ergebnis von `aufgabenAnzeige` — wortgleich
mit der Karte, inklusive Nebenzeile. Der Assembler bevorzugt es und macht einen
Rückfall kenntlich („aus dem Status abgeleitet, keine Regel greift"); fehlt das
Feld, gilt unverändert die Formel.

**Gelesen wird nur, was schon gerechnet ist.** Das Panel hängt an
`useZeilenAufgaben('nie', …)` — ein reiner Leser der Bestands-Ablage, der **keinen**
Lauf auslöst. Ein Dock, das auf jeder Route einen Bestandslauf über den vollen
Antragsbestand anstößt, wäre der falsche Handel; und weil der Schlüssel Fassung,
Betrachtungsbereich, Generation und Stichtag trägt, kann dabei kein fremdes
Ergebnis gelesen werden ([Bug-Klasse 25](recurring-bug-classes.md)).

> **Zwei Uhren, kein Fehler.** Der Frist-Hinweis im Faktenblock rechnet gegen die
> kritische Frist, der Tagesbrief gegen das Meilenstein-SollDatum — für denselben
> Vorgang dürfen dort verschiedene Zahlen stehen (DynaMaint: 318 gegen 324 Tage).
> Siehe [CONTEXT.md → „N Tage überfällig"](../../CONTEXT.md).

## Auszüge nur vom gefragten Vorgang (v6.53.1)

Bis v6.53.0 lief das Retrieval **global** über den Fragetext. Bei „Was ist bei
CALYPSO zu tun?" (10.09.2026) stand deshalb im Faktenblock der richtige Verbund,
im Auszugs-Block als Beleg `[1]` aber die Anlage 4 von KITED, einem fremden
Antrag. Sie tauchte auch als Quellen-Chip auf. Bemerkt hat das niemand, weil der
Block „Dokumente zum Vorhaben" für CALYPSO leer war: Der fremde Auszug war der
einzige und sah deshalb wie der richtige aus.

**Welche Treffer zum Vorgang gehören**
([`trefferGehoertZumVorhaben`](../../src/core/services/assistent/vorhaben-dokumente.ts))

Die Tags eines Treffers taugen dafür nicht. Der Indexlauf schreibt dort
`topic_tags`, der DMS-Scan nur das Verzeichnis. Die Regel ist deshalb dieselbe wie
in der Aufnahmefläche. `KontextEntitaet.kennungen` enthält die Verbund-Nummer und
die Aktenzeichen aller Teilvorhaben, also die Menge `knownIds`. Bei einem Antrag
kommt seine Verbund-Nummer dazu, denn die Verbund-VB gehört zu jedem TV. Ein
Treffer zählt, wenn eine der beiden Bedingungen gilt:

1. Sein Chunk (`<docId>-…`) gehört zu einem Dokument, dessen Tags eine Kennung
   tragen.
2. Sein Dateiname trägt eine Kennung (`classifyFkz`). Das deckt die DMS-Dateien
   `16KN… - Datum-Anlage …` ab.

**Wo der Zuschnitt greift**

Die Suche holt 50 statt 10 Kandidaten und filtert über `SearchFilters.nur`, und
zwar **vor** dem Re-Ranker. Der behält nur 10 von 15 Kandidaten. Ein Filter
danach hätte die eigenen Treffer dort schon verloren.

**Was die Antwort bekommt**

- Bleibt nichts Eigenes übrig, gibt es **keinen** Auszug statt eines fremden.
- Ohne Entität (Liste, Startseite ohne Scope) bleibt die Suche global. Dort ist sie
  gewollt.
- Den `doc:`-Scan macht der Controller einmal je Turn. Retrieval und
  Dokument-Block lesen denselben Scan.

## Kontext-Assembler — feste Blockreihenfolge

Analog zur fixen Skill-Komposition: **System → Fakten → Retrieval → Historie → Frage**.

1. **System** — Rolle, Grenzen (nur bereitgestellte Fakten; fehlt Info → sagen statt raten; keine Rechts-/Förderentscheidungen), Deutsch, kurz. Bindet `GRUNDSATZ_REGELN` ein.
2. **Fakten (deterministisch, wird NIE gekürzt)** — Route in Worten, die fragende Person (Fachrolle, Projektleitung), Entität + Stammdaten, Status-Label + Kategorie, was zu tun ist, Frist-Hinweis (vom Controller vorformatiert; hält den Assembler frei von Plugin-Importen) und die **Vorgangsakte** (siehe unten). Trägt die Akte die Aufgaben aller Regelsätze, entfällt der Rückfall auf die alte Status-Formel — „keine Regel greift" neben Regeltreffern kann nicht wahr sein.
   - **2a. Arbeitsvorrat-Übersicht (nur Kein-Entität-Fall, deterministisch, wird NIE gekürzt)** — auf Liste/Startseite ohne selektierte Entität hängt der Assembler direkt nach den Fakten einen kompakten Übersichtsblock an (In-Arbeit-Zahl, überfällig/dringend, die nächsten Fristen mit nächstem Schritt). So tragen die Quick Actions „Fristen"/„Was ist heute dran?" auch ohne Entität echte Fakten. Der Controller füllt `arbeitsvorratUebersicht` (aus `partitionArbeitsvorrat` + `daysUntilFristAware`); bei selektierter Entität `null` (deren eigener Faktenblock trägt).
3. **Retrieval (optional)** — Top-k Orama-Chunks (k=5), Treffer **unter `RETRIEVAL_MIN_SCORE` verworfen** → dann KEIN Block (statt schlechtem Block); als `[n] Titel: Auszug`. Das Retrieval selbst läuft im Controller (`useSearch().search`, unrein) und wird als `treffer` hereingereicht → Assembler bleibt byte-deterministisch. **Mit Entität nur aus deren Dokumenten** (siehe unten).
4. **Historie** — bisherige Turns dieser Sitzung.
5. **Frage** + Ausgabeanweisung: auf Auszüge gestützte Aussagen referenzieren `[n]` (mappt auf `ChatSource.n`).

**Budget** (`GESAMT_MAX_CHARS` = 100 000 Zeichen, geschätzt 25–30k Token; bis v6.53 waren es 24 000): bei Überschreitung wird in fester Reihenfolge gekürzt — erst Historie (ältester Turn zuerst), dann Retrieval-k (schwächster Treffer zuerst); **Fakten + Frage bleiben unangetastet**.

## Fundstellen = Orama + bestehendes Chat-Zitatsystem

Bewusste Entscheidung (statt der `[3.2]`-VB-Sektions-Popover): der Orama-Index trägt keine strukturierten Sektions-IDs; das Chat-Panel hat bereits ein vollständiges `[n]`-Zitatsystem über Orama. `verwendeteTreffer` → `buildChatSources` ([rag-sources.ts](../../src/plugins/chat/services/rag-sources.ts)) → `ChatSource[]`; gerendert über `CitationAnswer` (`[n]`-Inline), `AssistantMessage` (Quellen-Chips + „Verwendeter Kontext") und `SourcePanel` — alles wiederverwendet, kein Fork.

## Panel-Ort

Shell-weit: EINMAL in [ShellLayout](../../src/core/ShellLayout.tsx) hinter `isAssistentPanelEnabled()` gemountet — auf JEDER Route **außer der Suche** (`activeId !== 'suche'`), damit der Entitätskontext direkt ist. Die **Suche behält bewusst ihren eigenen vollen `ChatPanelHost`** (mit „+"-Menü/Verlauf/Anhängen); das schlanke Dock ist dort nicht gemountet → kein Doppel-Panel. Der `panelUiStore` teilt den Offen-Zustand. Die globalen Einstiegspunkte sind routen-bewusst (`openAssistent` in ShellLayout): auf der Suche schalten der Command-Palette-Befehl „Assistent öffnen" und `mod+shift+k` den Voll-Chat direkt (`sucheAssistentUiStore.setOpen(true)`), auf allen anderen Routen das schlanke Dock (`assistentPanelUiStore.setOpen(true)`). Der `?assistent=1`-Deep-Link bleibt für Navigationen von außerhalb.

**Die Spine steht auf JEDER Seite** (seit v3.50) — sie schaltet nur je Route ein anderes Panel. Zwei verschiedene Einstiege für dieselbe Sache waren der Bruch: überall ein Streifen am Rand, auf der Suche ein Knopf im Seitenkopf. Der Streifen ist deshalb ein eigenes Bauteil ([AssistentSpine.tsx](../../src/plugins/chat/assistent/AssistentSpine.tsx)), das sich `AssistentPanelHost` und ShellLayout teilen; auf `/suche` hängt er am `sucheAssistentUiStore` ([assistentPanel.ts](../../src/plugins/suche/assistentPanel.ts)) und ist **flag-unabhängig**, weil der Such-Chat in allen Varianten existiert. Ein Nachbau des Streifens fiele unter den Guard `no-parallel-board-geometry`.

**Dock-Form:** Geschlossen eine dauerhafte schmale Spine am rechten Blattrand (`SPINE_WIDTH` = 28px, [panelUiStore.ts](../../src/plugins/chat/assistent/panelUiStore.ts)) — Mini-Primär-Badge oben + dauerhaft sichtbares vertikales Label „ASSISTENT" (kein Tooltip, das Label ist ohnehin sichtbar). Die Spine **bleibt bei offenem Panel sichtbar** und togglet (Klick schließt wieder); das Panel legt sich als Overlay links daneben (`right: SPINE_WIDTH`), verdeckt sie also nicht — breite Tabellen behalten unter dem Overlay ihre Breite. Auf der Suche steht das Panel stattdessen **im Fluss** neben der Tabelle (in-flow `<aside>`), endet aber ebenso an der Spine. ShellLayout reserviert `SPINE_WIDTH` als rechten `<main>`-Rand, sobald irgendeine Spine steht (`spineAktiv = dockAktiv || Suche`), damit die fixe Spine Inhalt/Scrollbar nicht überlappt.

## Vorgangsakte (v6.54)

Bis v6.53 trug der Faktenblock Status, Fördervariante, die Aufgabe, einen Frist-Hinweis und vier Stammdaten. Alles andere, was die App über einen Vorgang schon rechnet, reiste nicht mit — und die Schnellfragen boten nur an, was diese Zeilen trugen. Die **Vorgangsakte** ([akte.ts](../../src/core/services/assistent/kontext/akte.ts)) holt es nach, ohne einen neuen Rechenweg: jede Aussage kommt aus der Funktion, die auch die Karte daneben speist ([vorgangsakte.ts](../../src/plugins/chat/assistent/vorgangsakte.ts)).

| Aussage | Quelle |
|---|---|
| Verfahrensschritt | `zahPhaseFuerStatusText` → `zahPhaseLabel` |
| Aufgaben je Regelsatz, mit Adresse, TV-Anteil, „abgeleitet" | `ermittleTodosAlleRollen` → `baueAufgabe` je Rolle |
| Halb offene Kürzel-Paare | `offenePaareJeTeilvorhaben` |
| Bearbeitungsfrist mit Basis (D_AAE/D_XTE) | `fristErgebnisVon` / `criticalFristErgebnis` |
| Stillstands-Wächter (ohne Journal → „mindestens") | `pruefeStillstand` |
| Meilenstein-Prognose, gerissene und fällige Knoten | `useVerbundMeilensteine` (Flag `meilensteinMonitoring`) |
| Verlaufs-Kennzahlen + die jüngsten 30 Termine | `baueChronik`, `verlaufKennzahlen` |
| Teilvorhaben mit Status und Eingang, „alle Anträge da" | Projektion + Katalogfelder `AAE`/`XTE` |
| Zuweisung AB/FB (nur gezählt) | `besetzteRollen` |

- **Ein Antrag schneidet auf sein Teilvorhaben**, ein Verbund zeigt alle — dieselbe Auswahl wie `useZeilenTodo`.
- **Kaskade, Paare und Wächter nur mit Flag `vorgangssystem`** — eine Aussage aus einer Rechnung, die in der Variante nirgends sichtbar ist, könnte niemand nachprüfen.
- **Leere Signale entfallen** ohne Platzhalter. Die Akte trägt `fuer` (die Entität); der Assembler rendert sie nur, wenn sie zur Entität des Turns passt.
- **Geladen nur bei offenem Dock** ([useVorgangsakte.ts](../../src/plugins/chat/assistent/useVorgangsakte.ts)) — dieselben Leser wie die Detailseite, kein Bestandslauf.

## Fragen-Katalog (v6.54)

Statt fünf fester Quick Actions zeigt das Dock die Fragen, die der Assistent **zu diesem Vorgang** beantworten kann ([fragenKatalog.ts](../../src/plugins/chat/assistent/fragenKatalog.ts)). Jeder Eintrag hängt an einem Signal der Akte; fehlt es, fehlt die Frage („ausblenden, nicht ausgrauen"). **Die App entscheidet, nicht das Modell** — ließe man es Folgefragen erfinden, böte es Fragen an, zu denen es keine Daten hat. Ein Klick schickt die Frage durch denselben `c.send()` wie eine getippte.

| Gruppe | Fragen | erscheint, wenn |
|---|---|---|
| Lage und Zuständigkeit | nächster Schritt · meine Aufgabe als FB/AB · worauf wartet er · wo steht er · Teilvorhaben im Vergleich | Entität; Fachrolle gewählt; wartende Rolle oder offenes Paar; Verbund mit verschiedenem TV-Stand |
| Fristen und Plan | wie viel Zeit bleibt · warum angehalten · Plan noch zu halten · liegt er zu lange | Frist läuft / steht; Prognose weder abgeschlossen noch unbekannt; Wächter „hängt" |
| Verlauf | was ist seit Eingang passiert · Eingänge der Teilanträge | Termine vorhanden; Verbund mit mehr als einem Eingang |
| Inhalt | worum geht es · zusammenfassen | immer (die Titel reichen für einen Anfang); Suchindex geladen |
| Projektleitung | ist er gefährdet · AB und FB zugewiesen | Profil-Schalter „Projektleitung" an |
| Arbeitsvorrat | Fristen · was ist heute dran | keine Entität (Liste, Startseite) |

Im leeren Dock stehen die Fragen nach Gruppe. Unter jeder fertigen Antwort stehen bis zu drei **Folgefragen**: sichtbar, noch nicht gestellt, zuerst aus der Gruppe der letzten Frage.

**Wer fragt** ([nutzerRolle.ts](../../src/plugins/chat/assistent/nutzerRolle.ts)): die Fachrolle aus dem Profil und, unabhängig davon, der Schalter „Projektleitung" (`profile.projektleitung`). Zwei Angaben statt einer sechsten Rolle, weil viele PL nebenbei als FB oder AB bearbeiten; wer nur PL ist, lässt die Fachrolle auf „alle" — das Auswahlfeld heißt dann „Keine eigene – nur Projektleitung". `leseStatusRolle` bleibt unberührt, Statusliste, Chronik und Board lesen weiter nur die Fachrolle.

## Modell (v6.54)

Der Turn fährt mit der Rolle **`standard`** (gpt-oss, 62k Fenster) statt am aktiven Tab; passt der Prompt nicht, steigt er auf `stark` — nur aufwärts, `waehleModellFuerLauf`. Reset und Senden treffen denselben Tab (Pitfall #36). Das größere Fenster ist kein Grund, mehr mitzuschicken: irrelevanter Kontext verwirrt die Modelle.

## Abgrenzung / offen

- Der bestehende Chat + „Mit KI analysieren" nutzen weiter rohen `getActiveTransport()` (nur das Build-Flag schützt) — in dieser Phase **nicht** gefixt; der Assistent erbt den Pfad nicht (eigener gegateter Controller).
- Später (nicht Phase 1): zentrale Assistenten-Transport-Policy, Tool-Use/Agentik, Zugriff aufs Phase-0-Protokoll/Memory (Streaming-Antwort, sobald der Bridge-Pfad es produktiv hergibt).

## Aktivierung

**Aktiv in dev + pl + kurator + as** (pl + kurator seit v2.346.0, as seit v2.390.0). **prod: nicht aktiv** — der Flag steht nicht in `configs/prod.config.json` (Default `false`). Voraussetzung jeder Variante ist ein **interner** Transport (`ki.localLlama.enabled` bzw. `streamlitBridge`). Ohne geladenen Orama-Index (z. B. `as`: `dokumentenscan`/`volltextsuche` aus) degradiert das Panel sauber auf „Fakten ohne Auszüge" — `retrieve` liefert `null`, der Turn läuft.
