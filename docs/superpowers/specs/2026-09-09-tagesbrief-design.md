# Tagesbrief — ein gerankter Kurztext ganz oben auf der Startseite

Stand: 2026-09-09 · Ausgangspunkt: die Startseite zeigt sechs richtige Karten und sagt trotzdem nicht, was zuerst dran ist.

## 0. Anlass

In den Worten des Auslösers:

> „neues Modul Morning Brief auf der Homepage ganz oben, als Text das wichtigste
> Zusammenfassen konfigurierbar durch User soll sein welche Themen, aus vorgefertigten
> Baustein Katalog oder Regeln (mit Claude code festlegen) zusammensetzen, für Rückfragen
> dann nur mit LLM, Aktionen dazu anbieten"

Geschärft im Grill-Interview (vier Runden): aus „Morning Brief" wurde der **Tagesbrief**,
aus „Baustein" wurde **Thema**, und aus „das Wichtigste zusammenfassen" wurde die eine
Leistung, die heute nachweislich fehlt — **Querschnitt und Rangfolge**.

## 1. Warum

Die Startseite zeigt ein Hero-Band und sechs Karten. Jede ist für sich richtig, aber keine
kreuzt die Quellen: die überfällige Frist steht in „Fristen", die Änderung von heute Nacht
in „Änderungen der letzten Nacht", der eigene angefangene Entwurf in „Meine Entwürfe".
Was von alledem **zuerst** dran ist, sagt keine der Karten — der Nutzer tastet sechs
Kacheln ab, statt einen Satz zu lesen.

Was die wörtliche Bitte nicht sagt: ein siebter Kasten, der dasselbe Material noch einmal
erzählt, macht die Seite schlechter, nicht besser. Der Brief rechtfertigt sich nur durch
die Rangfolge über Quellengrenzen hinweg. Deshalb lässt er alles aus, was eine Karte
daneben bereits gleichwertig sagt.

## 2. Befunde aus dem Bestand

Gemessen am 2026-09-09 gegen den Stand `master`@`edff2c72`.

- **Der deterministische Kern existiert schon und wird nie gezeigt.**
  [`baueArbeitsvorratUebersicht(antraege, now)`](../../../src/plugins/chat/assistent/arbeitsvorratUebersicht.ts)
  liefert `gesamtInArbeit`, `ueberfaellig`, `dringend` und die fünf nächsten Fristen — je
  mit nächster Aktion aus `naechsterSchritt`. Rein, `now` injizierbar, node-testbar. Er
  geht **ausschließlich** als Faktenblock 2a in den Assistenten-Prompt; kein Pixel davon
  steht auf der Startseite.
- **Die Frage ist bereits ein Knopf.** Quick Action `heute-dran` („Was ist heute in meinem
  Arbeitsvorrat dran?", [quickActions.ts](../../../src/plugins/chat/assistent/quickActions.ts))
  ist genau dann sichtbar, wenn keine Entität selektiert ist — also auf der Startseite. Sie
  sitzt im Dock rechts und liefert eine Chat-Antwort, keinen stehenden Text.
- **Das Widget `ai-assistent` ist trotz seines Namens keine Zusammenfassung**: eine Zeile
  Verbindungsstatus plus „Verbinden"
  ([AiAssistantCard.tsx](../../../src/plugins/home/AiAssistantCard.tsx), 63 Zeilen). Es
  liest keine Antragsdaten und ruft kein Modell.
- **Eine narrative Tageslage gibt es nirgends im Repo.** `morning|morgenbrief|tagesbrief|
  digest|briefing` trifft in `src/` und `docs/` (außerhalb `_archiv/`) null fachliche
  Stellen. LLM-Fließtext existiert nur **pro Verbund** (Gutachten-Kurzfassung).
- **Vier der sechs Karten, die eine frische Startseite von selbst zeigt, sagen bereits
  Teile eines Briefs**: „Meine Anträge", „Fristen", „Änderungen der letzten Nacht",
  „Antragseingang" (`ENTDECKUNG_WIDGETS`,
  [homeWidgetsStore.ts](../../../src/plugins/home/widgets/homeWidgetsStore.ts)).
- **Die Alert-Karte misst eine andere Achse als der Brief.** Ihre Kacheln zählen **Alter**
  („älter als 90 Tage", „zwischen 31 und 90 Tagen", aus `useEingangAmpelCounts`), während
  `baueArbeitsvorratUebersicht` **Frist** rechnet (`fristTageVon`, phasenbewusst — 113 von
  577 Anträgen haben gar keine laufende Uhr, v4.131). Zwei Zahlen über „was drängt", die
  auseinanderlaufen dürfen — und heute beide oben stünden.
- **Es gibt zwei Motoren für „was ist zu tun".** Die alte Status-Formel
  [`naechsterSchritt`](../../../src/core/utils/naechsterSchritt.ts) (O(1), rein) und die
  To-do-Kaskade über gesetzte Kürzel (`laufeBestand` → über 12 000 Zeilen, ~5 s,
  5-min-TTL-Cache, [useBestandsAufgaben.ts](../../../src/core/hooks/useBestandsAufgaben.ts)).
  Der Assistent nutzt heute den **schwächeren**.
- **Der Kaskaden-Lauf kostet den Brief nichts.** Die Startseite startet ihn bereits
  **viermal** mit `'leerlauf'` — `useDashboardData`, `useEingangAmpelCounts`,
  `MeineAntraegeSection`, `AntragKanbanWidget`. Der Brief hängt sich an denselben
  gecachten Lauf.
- **Es gibt keinen Scheduler.** Einziger zeitgesteuerter Auslöser im Repo ist
  `gedaechtnis/trigger.ts` (App-Start ≥ 12 h). „Morning" wäre ein Name ohne Mechanismus.
- **„Baustein" ist vergeben** an den
  [Textbaustein-Katalog](../../architecture/textbaustein-katalog.md) (NF/RNE/ABL,
  versioniert, freigebbar). Ein zweiter Baustein-Katalog kollidierte.
- **Zwei Ablagen, ungleicher Preis.** `HeroConfig` wird additiv gelesen (fehlendes Feld =
  an, kein Versions-Bump); eine Widget-Detail-Config braucht dagegen eine
  Config-Versions-**Migration**, weil `reconcileVerfuegbareWidgets` nur fehlende **Typen**
  ergänzt, nie fehlende **Felder** (v6.1-Präzedenzfall `nachtlauf`).

## 3. Entwurf

### 3.1 Ort und Form

Ein eigenes Home-Widget `tagesbrief`, `bereich: 'haupt'`, auf Position 0 — **nicht** das
Hero-Band. Damit bleibt er verschiebbar, ausblendbar und einklappbar wie jede Karte, und
er bekommt ein Detail-Formular für die Themenwahl.

Die **Alert-Karte bleibt unberührt**. Sie zählt Alter, der Brief rechnet Frist; der Brief
lässt ihre drei Zahlen bewusst aus, damit oben kein Wort zweimal steht.

### 3.2 Der Brief leitet nichts Neues ab

Tragende Invariante, analog zu Leitplanke 3 des Assistent-Panels: **jedes Thema konsumiert
eine bestehende reine bzw. gecachte Quelle.** Der Brief erfindet keine Frist-, Status- oder
Dringlichkeits-Rechnung.

| Familie | Thema | Quelle (besteht) | Uhr |
|---|---|---|---|
| Arbeitsvorrat | Fristen | `baueArbeitsvorratUebersicht` (`fristTageVon`) | Tage |
| Arbeitsvorrat | Stillstand | `restTage`/Wächter aus `useBestandsAufgaben` | Tage |
| Arbeitsvorrat | Was zu tun ist | `useZeilenAufgaben().fuer()` + `aufgabenAnzeige` | Tage |
| Bewegung | Über Nacht geändert | `letzterNachtLauf` + `nachtlaufGruppen` | – |
| Bewegung | Neu eingegangen | `useEingangAmpelCounts` | Alter |
| Eigenes | Meine Entwürfe | `useQsFreigaben(true)` | – |
| Eigenes | Weitermachen | `useWeitermachenRows()[0]` | – |
| Umfeld | Feedback | `berechneFeedbackNews` | – |
| Umfeld | Skills & Regeln | `zaehleRegistryAenderungen` (nur Kurator) | – |
| Umfeld | Auslastung | `computeKapazitaet` (nur freigeschaltet) | – |

### 3.3 Rangfolge: nur wo eine Uhr tickt

Nur etwa die Hälfte der Themen hat überhaupt eine Fälligkeit. Eine gemeinsame Skala über
alle zehn hinweg müsste Gewichte erfinden, die gegen nichts prüfbar wären („Zählen ist
keine Gewichtung"). Deshalb zwei Teile mit klarer Grenze:

1. **Gerankter Absatz** aus den Uhr-Themen, alle normiert auf „Tage bis/seit Fälligkeit",
   überfällig zuerst, harter Deckel. Der Deckel und jede Dringlichkeits-Schwelle werden
   **am echten Bestand gemessen**, bevor sie festgezurrt werden — eine Schwelle über dem
   Wertebereich schaltet lautlos ab.
2. **Ein Nachsatz** für die Neuigkeiten ohne Fälligkeit: „Außerdem: 12 Vorgänge über Nacht
   geändert, 2 Antworten auf dein Feedback."

### 3.4 Die Zeile ist eine Segment-Liste, kein Satz

Am fertigen String ließe sich keine einzelne Zahl aufhängen (Lehre der Nachtlauf-Zeile,
v6.1). Ein Punkt trägt deshalb `segmente: Segment[]` — Text- und Ziel-Segmente — und
zusätzlich `satz: string` als `aria-label`: was die Maus in mehreren Klickzielen erfährt,
muss die Vorlesesoftware am Stück bekommen.

Sprungziele nutzen das bestehende Quickfilter-Muster (`kategorieQuickfilter`), damit „ein
Klick, der eine Zahl nennt, bei genau dieser Zahl landet". Kein neuer Navigations-Mechanismus.

### 3.5 To-do-Motor: Kaskade, sonst beschrifteter Rückfall

Genau der `rueckfall`-Zustand, den `aufgabenAnzeige` bereits kennt: die Kaskade wo sie
trägt, sonst die alte Status-Formel — **und der Rückfall sagt, dass er einer ist**. So
spricht der Brief dieselben Sätze wie die Zeilen zwanzig Pixel darunter.

### 3.6 Rückfrage: kein zweites Chat-Bauteil

Je Punkt ein unauffälliges „dazu nachfragen". Der Klick öffnet das bestehende Dock
(`assistentPanelUiStore`) mit vorbefüllter Frage und läuft durch den unveränderten
Turn-Pfad: `resetChat` vor dem Senden (Pitfall #36), intern-only Transport
(`getTransportForAssistent`), ein Aufruf pro Turn, session-only Historie. Ohne
`assistentPanel`-Flag verschwindet der Knopf — ausblenden, nicht ausgrauen.

### 3.7 Fehler- und Randfälle

- **Leerfall**: der Brief benennt, was er geprüft hat („Keine Frist unter 14 Tagen, keine
  Änderung über Nacht, keine offenen Entwürfe."), nie „Nichts zu tun" und nie die leere Karte.
- **Ladefall**: die Uhr-Sätze stehen sofort; die Kaskaden-Sätze füllen über den bestehenden
  `laedt`-Zustand nach.
- **Eingeklappt**: kein Body, also keine Aggregation (Lazy-Zusage der `WidgetShell`); der
  Zähler-Slot zeigt „—", nicht „0".
- **Ausschnitt**: der Brief folgt `useBearbeiterSicht` wie die Karten daneben, ohne eigenen
  Regler — ein selbstgebauter Modus nennt sonst Team-Zahlen unter einem Kürzel-Chip (v4.47).

### 3.8 Tests

Reiner Kern zuerst: Rangfolge (überfällig vor fällig), Deckel samt „und N weitere",
Nachsatz-Bildung, Leerfall-Text, Rückfall-Beschriftung, Determinismus (kein `Date.now()`
in `baueBrief`). Dazu ein neuer Guard `entdeckung-ohne-marke`: jedes Widget in
`ENTDECKUNG_WIDGETS` ist im Sichtbarkeits-Katalog unmarkiert — der Guard, der den
v6.19-Fall gefangen hätte, in dem eine Beta-Marke die Selbst-Einblendung stilllegte.

## 4. Verifikation

**Gate**: `check:docs` nach Doc-/Guard-Schritten, `check:quick` im inneren Loop, `check`
vor dem Commit, danach `build:devpl` mit geprüftem Exit-Code.

**Abnahme in `dev:local`** (Port 5175, `await window.__tf.bereit()`): der Brief steht ganz
oben in der Hauptspalte; jede Zahl im Text wird gegen die Karte darunter gehalten; keine
der drei Alter-Zahlen der Alert-Karte taucht im Brieftext auf; ein Klick auf eine Zahl
landet bei genau dieser Menge; „dazu nachfragen" öffnet das Dock mit vorbefüllter Frage;
Leerfall und Ladefall werden erzwungen; Abnahme mit **ausgeschaltetem** Beta-Schalter
(vier Sichtbarkeits-Achsen, Pitfall #54); Migration einer gewachsenen v5-Config prüfen
(Position 0, zweiter Reload ändert nichts); `window.__tf.fehler()` muss 0 sein.

**Beim Nutzer bleibt** der `file://`-Handtest des Single-File-Builds und die Rückfrage
gegen die echte interne KI.
