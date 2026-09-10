# Der Assistent kennt den Vorgang und schlägt Fragen vor

Stand: 10.09.2026 · Ausgangspunkt: Der Assistent bekommt heute fünf Stammdaten, den Status, eine Frist und die Aufgabe — fast alles andere, was die App über einen Vorgang schon rechnet, reist nicht mit, und die fünf festen Schnellfragen wissen nichts davon.

## 0. Anlass

Nutzer, 10.09.2026:

> „wir können doch dem assistent den gesamten kontext zu dem Antrag mitgeben (alle relevanten signale die für die bearbeitung durch FB und AB wichtig sind), und der assistent kann dem user fragen vorschlagen die er beantworten kann. (inline zum klicken für den user)"

> „kontext kann auch die historie sein, was mit dem antrag (und allen Teilvorhaben) passiert ist seit sie im system sind"

> „bitte die rolle PL (Projektleitung) zu der App hinzufügen, damit auch die PL sinnvolle Fragen stellen kann. den Bestandslauf bitte nur über die aktuelle und die Richtlinie davor machen."

## 1. Warum

Die Bitte klingt nach „mehr Kontext". Der Bedarf ist ein anderer: **Vorschläge, die der Assistent auch einlösen kann.** Ein Vorschlag, zu dem die Daten fehlen, ist eine Einladung ins Leere — dieselbe Regel, nach der die Frage-Vorschläge der Suche ihren Katalog je Seite bekommen ([abschnitte.ts](../../../src/components/frage-vorschlaege/abschnitte.ts)). Das kann nur die App garantieren, denn nur sie weiß, welches Signal an diesem Vorgang vorliegt. Die Vorschläge kommen deshalb aus einem festen Katalog, dessen Einträge an Signale gebunden sind, nicht vom Modell.

Und mehr Kontext ist nicht automatisch besser: Das Fenster ist groß genug (Standard gpt-oss-120B mit 62k Token, Stark Qwen 3.6 35B mit 262k), aber irrelevanter Kontext verwirrt die Modelle. Die Frage bestimmt deshalb, welche Blöcke mitreisen.

## 2. Befunde aus dem Bestand

Stand Code 10.09.2026 (nach v6.53.1).

**Was heute mitreist** ([kontextSnapshot.ts](../../../src/plugins/chat/assistent/kontextSnapshot.ts)): Status mit Kategorie, Fördervariante, die Aufgabe (nur aus dem Bestandslauf-Zwischenspeicher, `useZeilenAufgaben('nie')` — leer, solange kein Lauf gelaufen ist), ein vorformatierter Frist-Hinweis, vier Stammdaten-Zeilen. Budget 24 000 Zeichen ([assembliere.ts:35](../../../src/core/services/assistent/kontext/assembliere.ts)), geschätzt 6–7k Token.

**Was gerechnet wird, aber nicht mitreist** (Inventar 10.09.2026, alles rein oder je Vorgang billig, sofern nicht anders vermerkt):

| Signal | Quelle |
|---|---|
| Aufgabe je Rolle mit Zuständigkeit, „wartet auf", Streuung über TV | `ermittleTodosAlleRollen`, `baueAufgabe` ([aufgabe.ts](../../../src/core/status/aufgabe.ts)); je Verbund billig über `useZeilenTodo` |
| Halb offene Kürzel-Paare | `offenePaareJeTeilvorhaben` ([waechter.ts](../../../src/core/status/waechter.ts)) |
| ZAH-Phase, Code, seit wann, letzter Vorgang | `baueHerleitung` ([herleitung.ts](../../../src/core/status/herleitung.ts)) |
| Frist-Zustand, Basisfeld, Grund, Haltedatum | `berechneFrist` ([frist-ergebnis.ts](../../../src/core/services/csv/frist-ergebnis.ts)), `ermittleHaltedatum` |
| Stillstand: Tage gegen Zieltage, belegt/„mindestens", hängende Rolle | `pruefeStillstand` |
| Liegezeit-Verteilung je Status (Median, p90, n) | `medianLiegezeit` — braucht den Bestandslauf |
| Meilenstein-Prognose, gerissene Knoten, Blocker | `bewerteVerbund` ([bewertung.ts](../../../src/core/meilensteine/bewertung.ts)), Flag `meilensteinMonitoring` |
| Chronik je Kürzel × Tag, Rollen, Träger, Kennzahlen | `baueChronik`, `verlaufKennzahlen` ([chronik.ts](../../../src/core/status/chronik.ts)) |
| Liegezeiten je Statusabschnitt (rekonstruiert, mit Konfidenz) | `baueVerlaufFuerVorgang`; Klartext-Form existiert: `baueVerlaufsText` ([bandText.ts](../../../src/plugins/antraege/verlauf-band/bandText.ts)) |
| Journal: gesetzt / geändert / geleert, zurückgenommene Termine | `chronikFuerAntraege`, `baueZurueckgenommene` — **teuer**: `stand.json` > 5 MB über SMB, bewusst ungecacht |
| Artefakt-Stand (GA/NF), Prüfer-Hinweise, Werkbank-Punkte | `workflow-run:<typ>:<scope>`, `StepRun.qsHinweise`, `werkbank-punkte:<az>` |
| Offene Punkte der Aufbereitung | `sammleFragen` — nur aus dem Zwischenspeicher |
| Vorgänger des Antragstellers, Wiedereinreicher | `findAbgelehnteVorgaenger`, `findAntraegeVonAntragsteller`, `t_xsw` |
| Stau je Rolle („die PL-Frage ‚wo klemmt es?'") | `useVorgangsBoard` ([useVorgangsBoard.ts:362](../../../src/plugins/vorgangs-board/useVorgangsBoard.ts)) |

**Nicht vorhanden** (kein Vorschlag dazu): Doppelförderungs-Urteil je Antrag (wird nicht gespeichert), Verknüpfung Antrag → MAP-Prüfung, Projekt-Meilensteine `MS01_*`–`MS03_*` und Mittelabrufe (keine Logik liest sie), Klärungen je Antrag (sie gelten dem Katalog), eine Soll-Liste der Unterlagen je Fördervariante.

**Grenzen des Verlaufs.** Je Kürzel steht im Export nur das zuletzt gesetzte Datum ([vorgangssystem.md](../../architecture/vorgangssystem.md) V9). Belegt ist der Verlauf erst ab dem Journal-Nullpunkt 05.08.2026. Liegezeiten sind aus Datumsspalten rekonstruiert, nicht beobachtet. Größe: ZKN084412 (7 TV) hat 91 Schritte mit 350 Datumsangaben ([chronik-und-zeitstrahl.md](../../status-system/chronik-und-zeitstrahl.md)); der Tabellen-Ausklapp zeigt im Median 22 Zeilen, p90 32. Die Zeichenzahl eines Verlaufsblocks ist **nicht gemessen** (grob 70 Zeichen je Zeile).

**Rolle.** Das Profil führt `status_rolle` mit AB, FB, QS, PA, Jur oder „Alle" ([AntraegeSichtGruppe.tsx:77](../../../src/plugins/einstellungen/profil/AntraegeSichtGruppe.tsx)). Diese Rollen bedeuten „wer setzt ein Kürzel in C16" ([rollen.ts:19](../../../src/core/status/rollen.ts)); die PL setzt keines und ist laut [CONTEXT.md](../../../CONTEXT.md) eine App-Rolle, keine Fachrolle. `leseStatusRolle` liest jeden unbekannten Wert als „alle" ([rollen.ts:100](../../../src/core/status/rollen.ts)). Der Code nennt ausdrücklich „PL mit Doppelrolle" ([AntraegeSichtGruppe.tsx:117](../../../src/plugins/einstellungen/profil/AntraegeSichtGruppe.tsx)). „Alle" heißt heute an zwei Stellen „nie gewählt": Das Vorgangs-Board liest dann den AB-Regelsatz ([useVorgangsBoard.ts:64](../../../src/plugins/vorgangs-board/useVorgangsBoard.ts)), und die Befund-Zeile im Profil schlägt eine Rolle aus **allen** Anträgen des Kürzels vor, auch alten ([bearbeiterFilter.ts:89](../../../src/plugins/antraege/bearbeiterFilter.ts)).

**Bestandslauf.** Er folgt heute dem Betrachtungsbereich ([useBestandsAufgaben.ts:253](../../../src/core/hooks/useBestandsAufgaben.ts)), Standard sind die drei jüngsten Generationen 2015, 2020, 2025 ([betrachtungsbereich.ts:63](../../../src/core/status/betrachtungsbereich.ts)). Dokumentiert: 6 615 Vorhaben in 17,5 s ([vorgangssystem.md:2116](../../architecture/vorgangssystem.md)), nicht neu gemessen. C16-Trigger gibt es nur für 2020 und 2025 ([betrachtungsbereich.ts:11](../../../src/core/status/betrachtungsbereich.ts)) — der Verlauf von 2015er-Vorgängen ist ohnehin nicht ableitbar. Der Bereichsfilter greift in `laufeBestand` je Datensatz, nach dem Lesen ([bestands-lauf.ts:222](../../../src/core/status/bestands-lauf.ts)); ob sich ganze Programme vor dem Lesen überspringen lassen, klärt der Plan. Die parallele Spec [geteilter Bestands-Durchgang](2026-09-10-geteilter-bestands-durchgang-design.md) ändert, *wann* gelesen wird, nicht *was* — beide vertragen sich.

**Modell.** Der Assistent sendet ohne Modellwahl ([turn.ts:128](../../../src/plugins/chat/assistent/turn.ts)), also an den aktiven Tab der internen KI.

## 3. Entwurf

Grill-Entscheidungen (10.09.2026): Q1 = fester Katalog, die App entscheidet · Q2 = im leeren Dock und als Folgefragen unter jeder Antwort · Q3 = Vorgangsakte immer, Verlauf/Journal/Bestand nur bei passender Frage · Q4 = Verlauf nur mit Rollen, keine Bearbeiter-Kürzel · Q5 = PL als eigener Schalter neben der Fachrolle · Q6 = Schnitt auf zwei Richtlinien nur im Bestandslauf · Q7 = der Klick startet einen fehlenden Bestandslauf · Q8 = Modell „standard", Budget rund 100 000 Zeichen, Aufstieg nur bei Überlauf.

### 3.1 Die Vorgangsakte (reist bei jeder Frage mit Entität mit)

Ein reiner Baustein neben dem Assembler ([kontext/](../../../src/core/services/assistent/kontext/)) nimmt vorberechnete Signale entgegen und rendert sie als Faktenblock. Er rechnet nichts selbst (Invariante 3 des Panels); die unreine Grenze bleibt [kontextSnapshot.ts](../../../src/plugins/chat/assistent/kontextSnapshot.ts).

Inhalt: Lage (Status, ZAH-Phase, seit wann), Aufgabe je Rolle mit „wartet auf" und TV-Streuung, Fristen (Zustand, Resttage, Basis, bei Halt der Grund), Stillstand, Meilenstein-Prognose, offene Kürzel-Paare, Verlaufs-Kennzahlen mit den Hauptereignissen der Chronik, Artefakt-Stand, Titel von Verbund und allen TV samt `vb_inhalt`. Leere Signale entfallen, ohne Platzhalter.

Die Aufgabe kommt für einen Vorgang aus der Einzelrechnung (`useZeilenTodo`-Weg), nicht mehr allein aus dem Zwischenspeicher des Bestandslaufs.

### 3.2 Zuschaltbare Blöcke

| Block | Inhalt | Kosten |
|---|---|---|
| `verlauf` | volle Chronik je Kürzel × Tag mit Rolle und Träger, Statusabschnitte mit Dauer und Konfidenz; Kopf wie `baueVerlaufsText`: „rekonstruiert", Katalogfassung, Journal-Nullpunkt | billig |
| `journal` | Änderungen seit dem letzten Export, zurückgenommene Termine, unscharfe Spannen, Nullpunkt | teuer — nur, wenn die Seite das Journal schon geladen hat (`useJournalChroniken`); sonst entfällt der Vorschlag |
| `bestand` | Aggregate über den Bestandslauf: Stau je Rolle, Verteilung auf ZAH-Phasen, Liegezeit-Verteilung, Fristen der nächsten 14 Tage, Vorgänge ohne Bearbeiter (gezählt) | Bestandslauf |

Ein Katalogeintrag nennt die Blöcke, die er braucht. Ein einmal zugeschalteter Block bleibt für die Unterhaltung stehen, damit Nachfragen dieselbe Grundlage haben; „Neue Unterhaltung" und Routenwechsel lösen ihn (dieselbe Lebensdauer wie der geliehene Vorgang, [assistent-panel.md](../../architecture/assistent-panel.md)). Eine getippte Frage bekommt die Akte und die bereits zugeschalteten Blöcke.

### 3.3 Der Fragen-Katalog

Ersetzt [quickActions.ts](../../../src/plugins/chat/assistent/quickActions.ts), bleibt rein. Jeder Eintrag: `id`, `gruppe`, `frage`, `bloecke`, `rollen` (für wen), `sichtbarWenn(signale)` — rein deterministisch, „Voraussetzung nicht erfüllt → ausblenden".

| Gruppe | Fragen (Kurzform) | erscheint, wenn |
|---|---|---|
| A Lage | nächster Schritt und von wem · was muss ich als FB/AB tun · worauf wartet der Vorgang · wo steht er seit wann · welche TV hängen hinterher | Entität; „ich als …" nur mit Fachrolle; „wartet" nur mit `wartetAuf`/offenem Paar; TV-Frage nur bei Verbund mit TV in verschiedenem Stand |
| B Fristen/Plan | wie viel Zeit bleibt, ab wann zählt die Frist · warum angehalten · Plan noch zu halten · liegt er zu lange · ist das für den Status ungewöhnlich | je nach Frist-Zustand, Prognose, Wächter-Urteil; Liegezeit-Vergleich mit Block `bestand` und ausreichend `n` |
| C Verlauf | was ist seit Eingang passiert · wann kamen die TV, wann war der Verbund vollständig · wie lange stand er in welchem Status · was hat sich seit dem letzten Export geändert · wurde etwas zurückgenommen | Chronik nicht leer; Verbund > 1 TV; Spur mit Verlauf; Journal geladen und nicht leer; Zähler > 0 |
| D Inhalt | worum geht es (**immer** — Titel reichen für einen Anfang) · offene Punkte der Aufbereitung · welche Unterlagen liegen vor | Aufbereitung gerechnet; Dokumente zugeordnet |
| E Eigene Arbeit | wie weit ist das Gutachten/die NF · was haben die Prüfer beanstandet · welche Werkbank-Punkte sind offen | Lauf / Hinweise / Punkte vorhanden |
| F Umfeld | frühere Anträge des Antragstellers, auch abgelehnt · hat sich die Zuwendung seit Bewilligung geändert | Vorgänger gefunden; beide Beträge vorhanden |
| G Projektleitung | ist der Verbund gefährdet und woran hängt es · sind AB und FB zugewiesen (nur ob) · wo klemmt es, Stau je Rolle · welche Verbünde reißen ihren Plan · Fristen der nächsten 14 Tage über alle · was hat sich diese Woche bewegt · wie viele ohne Bearbeiter · Verteilung auf Verfahrensschritte · Liegezeiten je Status | PL-Schalter an; G1/G2 an einer Entität, der Rest auf Startseite und Liste |

**Wo sie stehen.** Im leeren Dock die sichtbaren Einträge, nach Gruppe geordnet und gekappt (die Zahl misst die Abnahme, wie bei den Frage-Vorschlägen der Suche). Unter jeder Antwort zwei bis drei Folgefragen: sichtbar, noch nicht gestellt, zuerst aus derselben Gruppe. Ein Klick schickt ab — derselbe `c.send()`-Weg wie heute.

### 3.4 Personen bleiben draußen

Bearbeiter-Kürzel (`tib_kuerz`, `bib_kuerz`, `ztp_kuerz`, `pfm_kuerz`) gehen **nie** in den Assistenten-Prompt. Mit datiertem Verlauf daneben würde „wie lange hat X gebraucht?" beantwortbar — ein Aktivitätsprotokoll, mitbestimmungspflichtig ([vorgangssystem.md §12.6](../../architecture/vorgangssystem.md)). Zuständigkeit spricht der Assistent als Rolle aus; G2 sagt nur „zugewiesen ja/nein". Bestandsfragen zählen nach Rolle, Phase und Richtlinie, nie nach Kürzel. Neuer Guard: der Assembler-Ausgang enthält keinen Wert aus den Bearbeiter-Spalten (Probe mit Fixture, Gegenprobe rot gesehen).

### 3.5 Projektleitung im Profil

- Neues Profilfeld neben `status_rolle`: ein Schalter „Projektleitung" in [AntraegeSichtGruppe.tsx](../../../src/plugins/einstellungen/profil/AntraegeSichtGruppe.tsx). Die Fachrolle bleibt unverändert; PL mit Doppelrolle wählen FB oder AB **und** den Schalter.
- **Nur PL** (früher selbst bearbeitet, heute nicht mehr): Schalter an, Fachrolle „Alle Rollen", Bearbeiter-Kürzel „Alle". Kein dritter Rollenwert — „alle" verhält sich überall schon richtig (Statusliste ungefiltert, keine Hervorhebung in der Chronik). Zwei Anpassungen, damit „Alle" hier nicht als „nie gewählt" gelesen wird:
  - Ist der Schalter an, heißt der Eintrag „Alle Rollen" im Auswahlfeld „Keine eigene – nur Projektleitung".
  - Die Befund-Zeile schlägt dann keine Fachrolle aus alten Fällen vor, sondern bestätigt die Wahl.
- Der Assistent liest Fachrolle und Schalter über einen eigenen Leser; `leseStatusRolle` bleibt unverändert. Der Faktenblock nennt die Rolle des Nutzers („Projektleitung, zusätzlich FB"); der Systemblock spricht von „Bearbeitung (AB, FB) und Projektleitung" statt von „Gutachtern und Projektleitung".
- Persistenz: das bestehende Profil, kein neuer Store. Sichtbar, wo das Assistent-Panel freigeschaltet ist.
- Glossar: [CONTEXT.md](../../../CONTEXT.md) „PL" bekommt mit der Umsetzung den Zusatz „auch Profilangabe, unabhängig von der Fachrolle".

### 3.6 Bestandslauf über zwei Richtlinien

- Die Lauf-Menge ist der gewählte Bereich **geschnitten** mit den zwei jüngsten Generationen, abgeleitet aus `RICHTLINIEN_GENERATIONEN.slice(-2)` wie Seed und „Aktuelle Richtlinie" — beim nächsten Richtlinienwechsel rollt es von selbst. Listen, Zähler und Bereichs-Chip bleiben bei drei Generationen.
- Vorgänge außerhalb (heute: Generation 2015) bekommen keine Kaskade. Sie zeigen den Rückfall und sagen **warum** („für diese Richtlinie rechnet der Bestandslauf nicht") — Pitfall #46: kein Zustand ohne sichtbare Auskunft. Alle Leser von `useZeilenAufgaben` bekommen den Grund (Liste im Plan).
- Aggregate aus dem Lauf (Stau, Liegezeiten) nennen ihre Grundlage: „Richtlinien 2020 und 2025".
- Der Schlüssel des Zwischenspeichers trägt die neue Menge, alte Ergebnisse werden nicht gelesen ([Bug-Klasse 25](../../architecture/recurring-bug-classes.md)).
- **Auslösen:** Wählt jemand eine Frage mit Block `bestand` und liegt kein gültiges Ergebnis vor, startet der Klick den Lauf, das Dock zeigt „rechne Bestand …", danach wird abgeschickt. Kein Lauf beim bloßen Öffnen des Docks.

### 3.7 Modell und Budget

- Der Assistent sendet mit der Rolle „standard" (gpt-oss) statt an den aktiven Tab.
- `GESAMT_MAX_CHARS` steigt auf rund 100 000 (geschätzt 25–30k Token; Luft für Denken und Antwort im 62k-Fenster). Die Kürzungsreihenfolge bleibt; Akte und Frage werden nie gekürzt.
- Passt ein Prompt nicht, steigt der Turn auf „stark" — nur aufwärts, dieselbe Regel wie [modell-wahl.ts](../../../src/core/services/ai/modell-wahl.ts).
- Die endgültige Zahl setzt die Messung aus 4 (größter Verbund mit allen Blöcken).

### 3.8 Tests

- Katalog: je Eintrag Sichtbarkeit mit und ohne sein Signal; die Leiste ist nie leer; Folgefragen ohne bereits gestellte.
- Vorgangsakte: leere Signale entfallen; Rückfall der Aufgabe bleibt markiert; Verlaufsblock trägt „rekonstruiert" und den Nullpunkt.
- Assembler: Budget-Reihenfolge unverändert; zugeschaltete Blöcke bleiben über Turns.
- Guard „keine Personen im Prompt" (3.4), einmal rot gesehen.
- Bestandslauf: Menge = Bereich ∩ zwei Generationen; Vorgang aus 2015 bekommt den benannten Grund; Schlüssel ändert sich mit der Menge.
- Profil: Leser für Fachrolle + PL; `leseStatusRolle` unverändert (bestehender Test grün).

## 4. Verifikation

- **Gate:** `check:quick` im Loop, `check` vor dem Commit, `build:devpl` im Hintergrund, Exit-Code geprüft.
- **Messung in dev:local**, nach sauberem Reload: Zeichenzahl der Akte und jedes Blocks am größten Verbund und an einem Median-Verbund; daraus das endgültige Budget. Bestandslauf vorher/nachher gepaart auf denselben Daten (Dauer, Zahl der gerechneten Anträge).
- **Abnahme** mit ausgeschaltetem Beta-Schalter:
  - Verbund-Detailseite: das leere Dock zeigt nur Fragen, deren Signal vorliegt (Gegenprobe an einem Verbund ohne Meilensteine, ohne Journal).
  - Klick schickt ab; unter der Antwort stehen Folgefragen.
  - Profil: Schalter „Projektleitung"; mit Fachrolle „Alle" lautet der Eintrag „Keine eigene – nur Projektleitung"; die Startseite zeigt Gruppe G.
  - Bestandsfrage ohne Zwischenspeicher: „rechne Bestand …", dann Antwort.
  - Prompt (über den Debug-Weg des Controllers) enthält kein Bearbeiter-Kürzel.
  - `__tf.fehler()` = 0.
- **Echte Antwort** nur mit erreichbarer interner KI (Tunnel, [ki-tunnel-dev.md](../../architecture/ki-tunnel-dev.md)): drei Fragen je Gruppe A–C an einem echten Verbund, jede Antwort gegen die Detailseite gehalten. Ohne Tunnel benannt als offen.
- **Nicht `file://`-spezifisch:** keine Importe, keine Worker, keine neuen Share-Schreibpfade.
