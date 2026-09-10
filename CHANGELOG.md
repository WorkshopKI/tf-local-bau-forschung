# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v6.52.0 — Das gespeicherte Fristdatum entfällt (September 2026)

MINOR — Nach v6.49 lasen noch zwei Rechenwege nur `D_AAE`. Einer davon schrieb beim Import `frist_datum` in jeden Datensatz. Das Feld stimmte nur bei 506 von 13 690 Anträgen mit der Frist-Spalte überein; 13 021 Werte standen dort, wo die Spalte „angehalten" zeigt. Es entfällt, statt umgestellt zu werden ([Spec](docs/superpowers/specs/2026-09-10-frist-datum-entfaellt-design.md)).

- **Rechenwege**: der Merger-Rückfall `applyFristDatumFallback` und die toten `computeVerbundFristDatum`/`daysUntilFristAware` entfernt ([frist.ts](src/core/services/csv/frist.ts), [merger/helpers.ts](src/core/services/csv/merger/helpers.ts))
- **Datenmodell**: `frist_datum` fällt aus Standardfeldern, Listen-Projektion (v10) und Wizard-Slot. Altwerte sind über `AUSGEMUSTERTE_FELDER` nur noch sichtbar, wenn ein Schema sie mappt ([constants.ts](src/core/services/csv/constants.ts), [buildDisplayRows.ts](src/plugins/antraege/alleFelder/buildDisplayRows.ts))
- **Filter**: Der System-Filter „Fristdatum" entfällt. Der Seed räumt ausgemusterte System-Filter ab, und Kombi-Pins ohne Definition blenden sich aus ([filterRegistry.ts](src/core/services/csv/filter/filterRegistry.ts), [pinnedFilters.ts](src/plugins/antraege/filter/pinnedFilters.ts))
- **Gemessen** in dev:local (14 225 Anträge): Die Frist-Spalte ist vorher und nachher identisch (982 läuft · 13 021 angehalten · 222 nicht berechenbar, gleicher Hash). 0 Listen-Einträge tragen noch das Feld
- **Doku**: [antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md), [ui-muster.md](docs/architecture/ui-muster.md), [CONTEXT.md](CONTEXT.md) (Begriff „Frist")

### v6.51.1 — Kürzel-Paar der Fristen nennt seine CSV-Spalten (September 2026)

PATCH — Die letzte Lücke aus v6.51: ein Zieltag-Anlass „ALT gesetzt, ALU fehlt" zeigte keine Quellspalten. Das Kürzel findet sein Feld jetzt über den Katalog (`kuerzelIndex` der aktiven Fassung) statt über ein geratenes `D_` + Kürzel (Pitfall #44). Am echten Bestand haben alle 84 Paar-Anlässe von 301 Zieltagen zwei Felder.

- **Home-Fristen**: `zieltagAnlass` bekommt den Kürzel-Index und nennt die Felder beider Kürzel, das gesetzte zuerst; unbekannte Kürzel bleiben unbelegt ([fristAnlaesse.ts](src/plugins/home/widgets/fristAnlaesse.ts), [useFristAnlaesse.ts](src/plugins/home/widgets/useFristAnlaesse.ts))
- **Test**: NFD im Katalog gegen NFC im Paar, und keine zusammengesetzte Spalte ([fristAnlaesseQuellen.test.ts](src/plugins/home/widgets/__tests__/fristAnlaesseQuellen.test.ts))
- **Doku**: [ui-muster.md](docs/architecture/ui-muster.md) und [feedback-kontext/home.md](docs/feedback-kontext/home.md) nachgezogen

### v6.51.0 — Quellspalten auch an Frist, Home und Alle Felder (September 2026)

MINOR — Stufe C des Quellspalten-Vorhabens ([Spec](docs/superpowers/specs/2026-09-10-quellspalten-design.md)). Die übrigen Stellen, an denen ein Wert aus CSV-Spalten abgeleitet wird, nennen jetzt ebenfalls ihre Quellspalten, statt nur Codes oder gar nichts zu zeigen. Die festen Codes der Frist-Spalte nehmen ihre Beschriftung aus dem Schema.

- **Frist**: Bei `FRIST_GRUND` und dem Tooltip der Frist-Zelle ([tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)) stehen Code und Klartext. `FESTE_FELDER.frist` beschriftet sich aus dem Index ([spaltenHilfe.ts](src/plugins/antraege/spaltenHilfe.ts))
- **Home**: Die Fristen-Anlässe tragen ihre Quelle, beim Meilenstein den Knoten und beim Zieltag `STATUS_VB`. Das Kürzel-Paar bleibt bewusst ohne ([fristAnlaesse.ts](src/plugins/home/widgets/fristAnlaesse.ts)). Die Phasen-Marke des StatusVerlauf-Widgets liest `STATUS_VB` aus dem Schema
- **[„Alle Felder"](src/plugins/antraege/alleFelder/AlleFelderSection.tsx)**: Code inline und Quellspalten im Tooltip. `frist_datum` sagt, dass es beim Import gerechnet wird
- **[Status-Filter](src/plugins/antraege/filter/facets/StatusFilterFacet.tsx)**: Der Tooltip hat eine Zeile „Spalte" aus dem Schema
- **Abnahme** in dev:local nach sauberem Reload, `fehler()` = 0 ([ui-muster.md](docs/architecture/ui-muster.md))

### v6.50.0 — Quellspalten: Bedingungen und Felder nennen ihre CSV-Spalten (September 2026)

MINOR — Stufe B des Quellspalten-Vorhabens ([Spec](docs/superpowers/specs/2026-09-10-quellspalten-design.md)): „TIB gefüllt UND BIB gefüllt" sagte nicht, welche CSV-Spalte dahinter steht. Selbst Fachleute konnten eine falsche Spalte oder Kombination nur im Code finden. Jede Bedingung, die als Satz auf dem Bildschirm steht, nennt jetzt ihre Quellspalten, und zwar aus dem Schema aufgelöst statt von Hand abgeschrieben.

- **[spalten-inventar.ts](src/core/services/csv/spalten-inventar.ts)**: `baueQuellSpaltenIndex` löst jede Schreibweise einer `feldId` auf (kanonisch, custom, roher Code) und nennt die Programme, die das Feld nicht mappen. `rohSpaltenJeFeld` ist jetzt eine Projektion desselben Durchgangs ([ui-muster.md](docs/architecture/ui-muster.md))
- **[bedingung-quellen.ts](src/core/status/bedingung-quellen.ts)** + **[quellen.ts](src/core/meilensteine/quellen.ts)**: Die Erklärung einer Bedingung oder eines Meilensteins nimmt ihre Felder aus `bedingungFeldRefs` und den Satz aus `bedingungSatz`
- **[QuellSpaltenTooltip](src/components/quellspalten/QuellSpaltenTooltip.tsx)**: Der Index lädt erst beim Überfahren (`useQuellSpaltenIndex`). `SpaltenHilfeInhalt` gruppiert nach Feld
- **Eingebaut** in Meilenstein-Konfiguration, Leiste, „Diese Woche", To-do-Regeln und To-do-Herleitung. Der `FeldWaehler` zeigt `← D_AAE` am Auslöser
- **Guard `quellspalten-an-bedingungen`** ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts)): Wer eine Bedingung rendert, rendert ihre Quellspalten. Der Guard wurde einmal rot gesehen

### v6.49.0 — Ein Anker: Meilensteine zählen ab dem wirksamen Eingang (September 2026)

MINOR — Stufe A des Quellspalten-Vorhabens ([Spec](docs/superpowers/specs/2026-09-10-quellspalten-design.md)): Wer fragt, aus welchen Spalten eine Frist rechnet, fand zwei Antworten. Die Frist-Spalte der Tabelle zählte ab dem späteren aus `D_AAE` und `D_XTE`, der Meilenstein-Anker nur ab `D_AAE`, und das an drei Rechenstellen je für sich. Jetzt gibt es einen einzigen Anker. Gepaart gemessen: 28 von 2 082 offenen Verbünden verschieben sich um +1 bis +61 T (Median +8), kein Zustand und keine Prognose kippt.

- **[anker.ts](src/core/meilensteine/anker.ts)** (neu): `baueAnkerLeser` löst `D_XTE` über das Schema auf. Projektion und Verbund-Detailseite nutzen denselben Leser ([meilensteine.md](docs/architecture/meilensteine.md) § Bewertung)
- **[frist.ts](src/core/services/csv/frist.ts)**: `verbundWirksamerEingang` ist die Verbund-Schwester von `wirksamerEingang`
- **[bewertung.ts](src/core/meilensteine/bewertung.ts)** + **[auswertung.ts](src/core/meilensteine/auswertung.ts)**: Soll, Woche, Frist und Dauern zählen ab `anker`. `antragsdatum` bleibt für den Jahresfilter, `BEWERTUNGS_VERSION` 3
- **[useMeilensteinStand.ts](src/plugins/meilensteine/useMeilensteinStand.ts)**: Die Dauern der Auswertung zählen ab demselben Anker (125 von 5 969 werden kürzer, Median −5 T)
- **Beschriftung**: „Gesamtfrist ab wirksamem Eingang"; die Tooltips an Gesamtfrist und „Eingang" nennen `D_AAE`/`D_XTE` ([labels.ts](src/plugins/meilensteine/labels.ts)). Neue Glossar-Einträge „Quellspalte" und „wirksamer Eingang" in [CONTEXT.md](CONTEXT.md)

### v6.48.1 — der Assistent spricht die Kaskade, nicht die alte Formel (September 2026)

PATCH — Beim Lauf gegen die interne KI (v6.47.1, DynaMaint) widersprach der Assistent der Karte 20 Pixel daneben: sie sagte „Widerspruch gg Abl bearbeiten · liegt bei AB/FB/Jur", er sagte „Ablehnungsbescheid erstellen". Der Faktenblock sprach allein `schrittText` — die Formel, die das Projekt längst als Rückfall führt. Solange der Assistent „dazu weiß ich nichts" antwortete, fiel das nicht auf; mit der mitgereisten Entität wurde daraus eine falsche Handlungsanweisung.

- **[assembliere.ts](src/core/services/assistent/kontext/assembliere.ts)**: `KontextEntitaet.aufgabe` (Ergebnis von `aufgabenAnzeige`) hat Vorrang vor `schrittText`; ein Rückfall gibt sich zu erkennen ([assistent-panel.md](docs/architecture/assistent-panel.md))
- **[kontextSnapshot.ts](src/plugins/chat/assistent/kontextSnapshot.ts)**: füllt es aus der **bereits gerechneten** Ablage — Verbund gefaltet über alle TVs, wie die Verbundzeile
- **[AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)**: `useZeilenAufgaben('nie', …)` liest nur, was da ist — ein shell-weites Dock stößt keinen Bestandslauf an
- **[CONTEXT.md](CONTEXT.md)**: „N Tage überfällig" sind **zwei** Zähler (Meilenstein-SollDatum vs. kritische Frist) — DynaMaint 324 gegen 318, beide richtig; gemessen, kein Fehler
- **An der internen KI abgenommen**: dieselbe Frage, Antwort jetzt „Widerspruch gegen die Ablehnung zu bearbeiten — das liegt bei AB/FB/Jur", `fehler()` = 0

### v6.48.0 — Ein Durchgang, viele Mitfahrer: der geteilte Roh-Halter des Bestands (September 2026)

MINOR — Der Bestand wird an dreizehn Stellen gelesen, und jeder Lesevorgang kostet ~2,2–3,3 s: IndexedDB cacht die Deserialisierung von 14 225 Records nicht. Gleichzeitige Durchgänge teilten sich nichts, sondern behinderten sich — zwei nebeneinander kosteten je das 1,6-fache, also mehr als nacheinander. Ein sitzungslanger Halter scheidet aus (die Roh-Records sind 284 MB); ein laufzeit-begrenzter ist gratis.

- **[roh-halter.ts](src/core/status/roh-halter.ts)** (neu): die Roh-Arrays eines Programms, geteilt unter allen Durchgängen, die gerade laufen — Nutzerzähler statt TTL, `bestandGeneration()` als Schlüssel ([§17](docs/architecture/vorgangssystem.md))
- **[vorgangs-quelle.ts](src/core/status/vorgangs-quelle.ts)** + **[ladeBestand.ts](src/plugins/status-cockpit/ladeBestand.ts)**: beide lesen über den Halter; `ladeBestand` gibt damit den Lesecode ab, den es von `jederVorgang` dupliziert hatte
- **Async-Generator statt Callback**, nachgemessen: als Callback wanderte der Schleifenrumpf in eine Closure und wurde bei byte-identischem Code ~400 ms langsamer; mit `for await` ist die Rechenzeit auf 1 ms identisch
- **Richtigstellung zu v6.47**: die dort notierten „12–15 s" der Regeln-Seite waren der Dev-StrictMode-Zwilling — produktiv sind es 6,4–6,9 s ([§17](docs/architecture/vorgangssystem.md))
- **[Spec](docs/superpowers/specs/2026-09-10-geteilter-bestands-durchgang-design.md)** + **[Plan](docs/superpowers/plans/2026-09-10-geteilter-bestands-durchgang.md)**: Befund, Messfallen und die Warnung, dass der Boden dieser Maschine um ±33 % schwankt — Vergleiche nur gepaart

### v6.47.1 — die Rückfrage aus dem Tagesbrief nimmt ihren Vorgang mit (September 2026)

PATCH — Der Rückfrage-Knopf des Tagesbriefs legte „Was ist bei CALYPSO zu tun?" ins Dock und gab nur den Text mit: auf der Startseite ist nichts selektiert, also stand im Faktenblock „Keine Entität ausgewählt" — die Antwort „dazu liegen mir keine Informationen vor" war prompt-konform. Der zweite Fund wog schwerer und war unsichtbar: Deep-Links legen regelmäßig eine Verbund-Nummer in den Aktenzeichen-Slot; die Detailseite heilt das seit v4.82, der Kontext-Snapshot des Assistenten nicht.

- **[TagesbriefWidget.tsx](src/plugins/home/tagesbrief/TagesbriefWidget.tsx)** + **[panelUiStore.ts](src/plugins/chat/assistent/panelUiStore.ts)**: die vorgelegte Frage reist mit ihrem Vorgang; der Chip nennt ihn, statt „Startseite" zu sagen ([assistent-panel.md](docs/architecture/assistent-panel.md))
- **[kontextSnapshot.ts](src/plugins/chat/assistent/kontextSnapshot.ts)**: ein ausdrücklich mitgegebener Vorgang hat Vorrang vor der Store-Selektion — und der Aktenzeichen-Zweig heilt jetzt eine Verbund-Nummer, statt auf einen Stub ohne Status und Frist zu fallen
- **[detailAufloesung.ts](src/plugins/antraege/detailAufloesung.ts)**: `artDesSchluessels` hebt die Frage „Aktenzeichen oder Verbund?" aus `loeseDetailAuf` heraus — eine Schleife, zwei Leser, kein Drift
- **[punkte.ts](src/plugins/home/tagesbrief/punkte.ts)**: „Wo stehe ich bei X?" trug seinen Vorgang bisher nicht mit; Listenfragen bleiben bewusst ohne
- **Am echten Bestand abgenommen** (14 225 Anträge): Chip „Startseite" → „Verbund WidyLa · DS · 1 Frist", Sprung auf `#/antraege/ZKN121715` zeigt „Verbund ATLAS · FuE · 1 Frist" statt der nackten Nummer

### v6.47.0 — Der Bestandslauf wartet auf den Start — und die Leser folgen der Generation (September 2026)

MINOR — Ein Performance-Audit über die ganze App fand als stärksten Hebel nicht die Rechnung, sondern den Zeitpunkt: der Bestandslauf startete im Leerlauf mitten in den Start-Datenlauf hinein, belegte dessen Thread und SMB-Leitung — und wurde danach über die Bestands-Generation entwertet. Am ersten Start des Tages fiel er zweimal an. Der zweite Fund ist ein Wahrheitsproblem: der Schlüssel trägt die Generation, die Leser folgten ihr nicht.

- **[useBestandsAufgaben.ts](src/core/hooks/useBestandsAufgaben.ts)**: Leerlauf-Leser warten den Start-Datenlauf ab (Vorbild `auslastung/index.tsx`), mit Zeit-Rückfall gegen eine hängende Startphase — `'sofort'` (Board) und `'nie'` unberührt
- **[bestand-generation.ts](src/core/services/bestand-generation.ts)**: `subscribeBestandGeneration` — die Leser folgen dem Zähler jetzt per `useSyncExternalStore`; vorher fror ein gemounteter Leser seinen Schlüssel ein und zeigte bis Sitzungsende die To-dos von VOR dem Import
- **[feld-aufloesung.ts](src/core/status/feld-aufloesung.ts)**: der Vorkommen-Plan wird über (Feldliste, Auflösung) memoisiert — das Cockpit kompilierte ihn je Verbund neu (~7 535× je Kaltbesuch), der Board-Pfad hob ihn längst heraus
- **[navigator.ts](src/core/status/navigator.ts)**: `wirkungZeilen` liest aus einem Kürzel-Index statt die ganze Trigger-Tabelle je Feld-Zeile zu filtern — im Kürzel-Reiter waren das über eine Million `normKey`-Aufrufe je Render, auch für zugeklappte Klappen
- **Gemessen am echten Bestand** (14 225 Anträge, 12 359 Vorgänge, 7 535 Verbünde): Bestandslauf 5 531 ms, davon **idb 3 125 ms** — die Rechnung (sammeln 938 · todo 189 · wächter 597) ist nicht mehr der Engpass ([§17](docs/architecture/vorgangssystem.md))

### v6.46.0 — Tagesbrief — was zuerst dran ist (September 2026)

MINOR — Die Startseite zeigte sechs richtige Karten und sagte trotzdem nicht, was **zuerst** dran ist: die überfällige Frist stand in „Fristen", die Änderung von heute Nacht im Nachtlauf, der eigene Entwurf woanders. Der deterministische Kern dafür lag seit dem Assistent-Panel bereit (`baueArbeitsvorratUebersicht`) — er ging nur in einen Prompt, nie auf den Bildschirm.

- **[src/plugins/home/tagesbrief/](src/plugins/home/tagesbrief/)**: neues Home-Widget am Kopf der Hauptspalte, Flag `tagesbrief` (dev + pl) — deterministisch gerankter Kurztext, LLM erst bei der Rückfrage ([home-widgets.md → Tagesbrief](docs/architecture/home-widgets.md))
- **[useFristAnlaesse.ts](src/plugins/home/widgets/useFristAnlaesse.ts)**: der Ladeeffekt des Fristen-Widgets ist **gehoben, nicht kopiert** — eine Herleitung, zwei Leser
- **Config v6** (`migriereV5Tagesbrief`): einmalig einblenden **und** an den Kopf stellen — die einzige begründete Ausnahme von „`position` bleibt unberührt"
- **In der Abnahme gefunden**: über den rohen Bestandslauf standen drei Vorgänge mit „seit 4028 Tagen überfällig" an der Spitze (Karte darunter: höchstens 223), und das Journal zählte 262 statt 7 Vorgängen — beides zieht jetzt aus derselben Quelle wie die Nachbarkarte
- **Neuer Guard `entdeckung-ohne-marke`**: keine Karte in `ENTDECKUNG_WIDGETS` trägt eine Beta-/Experten-Marke — eine Marke legte die Selbst-Einblendung still (der gemessene v6.19-Fall)

### v6.45.0 — Eine Groesse, ein Name — und Ratschen, deren Ausweg wirklich offen steht (September 2026)

MINOR — Zwei Größen liefen im Bestand unter mehreren Namen: `strOrNull` stand zehnmal privat in `plugins/antraege/` — unter **einem** Namen mit **vier** Verhalten —, ein Tag in Millisekunden 13-mal unter vier Namen. Beim Nachziehen der Ratsche fiel auf, dass **fünf von fünf** Ratschen einen Ausweg nennen, den ihr eigener Code nicht annimmt.

- **[fieldLookup.ts](src/plugins/antraege/fieldLookup.ts)**: ein `strOrNull` statt zehn — eine Kopie gab ungetrimmt zurück, eine akzeptierte zusätzlich `number` (an ihren drei Aufrufstellen unerreichbar)
- **[zeitEinheiten.ts](src/core/utils/zeitEinheiten.ts)**: `MS_TAG` als einzige Heimat; `MS_TAG`/`TAG_MS`/`DAY_MS`/`MS_PER_DAY` und 15 nackte Literale zeigen jetzt dorthin — Ratsche `zeitkonstante-hat-einen-namen` **21 → 2**
- **Guard-Defekt behoben**: der Marker im Code hieß anders als der, den die Fehlermeldung nennt (5 von 5 Ratschen) — neuer Wächter `ausweg-heisst-wie-die-regel` hält beide zusammen
- **Zweiter Guard-Defekt**: `zeitkonstante-hat-einen-namen` zählte Fließtext und die *Definition* benannter Konstanten mit — also genau den Weg raus, den er empfiehlt (7 der 9 Treffer)
- **[code-quality-baseline.md](docs/architecture/code-quality-baseline.md)**: „Exporte ohne Nutzer" trennt jetzt **überexportiert** (254, `export` streichen) von **tot** (86); `exhaustive-deps` kostet gemessen 49 Verstöße, die vorhandenen Direktiven verdecken weitere 42 ([eslint.config.js](eslint.config.js))

### v6.44.1 — Ein Timeout heisst zuerst: sshd steht (September 2026)

PATCH — Der Laptop-Tunnel zur internen KI lief in eine Timeout-Schleife; `sshd` stand nach einem Neustart auf `Stopped`. Die Fehlersuch-Tabelle schickte für dieses Bild auf DHCP und VPN und ordnete den gestoppten Dienst „Connection refused" zu — beides führt am Fund vorbei.

- **[ki-tunnel-dev.md](docs/architecture/ki-tunnel-dev.md)**: `Get-Service sshd` ist jetzt die **erste** Prüfung bei „Connection timed out", mit dem Grund an einer Stelle in Schritt 1
- Die Firewall-Regel hängt am **Programm** `sshd.exe`, nicht an Port 22 — ohne laufenden Dienst greift sie nicht, und die Pakete werden still verworfen (Timeout statt RST)
- Zeile „`curl` meldet Connection refused" berichtigt: steht eine SSH-Sitzung, läuft `sshd` per Definition — dort bleibt nur die Loopback-Bindung der Weiterleitung
- **Nachgemessen**: nach `Start-Service sshd` baut die Schleife der `.cmd` den Tunnel selbst wieder auf, `curl` → HTTP 200; ein aktiver NordVPN-Tunnel auf der Dev-Maschine stört nicht

### v6.44.0 — Stille Test-Auslassungen werden laut (September 2026)

MINOR — 16 Tests liefen nur auf der Dev-Maschine: sie hängen an Fixtures, die per `.gitignore` bewusst nicht im Repo liegen. Auf einem frischen Klon verschwanden sie **wortlos**, und der Lauf blieb in beiden Fällen grün — zwei Entwickler führten aus demselben Commit unterschiedliche Testmengen aus.

- **[fixture-gate.ts](src/__tests__/fixture-gate.ts)**: ein gemeinsamer Torwächter statt fünf handgeschriebener `existsSync(…) ? describe : describe.skip`
- **Wächter `fixture-tore-melden-sich`** wird **rot**, wenn ein Block nicht laufen kann — mit Quittung `TF_OHNE_FIXTURES=1`, damit ein Rechner ohne Fixtures nicht dauerhaft rot bleibt
- Zweiter Wächter verhindert, dass sich künftig wieder ein Block an der Bilanz vorbei selbst abschaltet
- **Gemessen statt vermutet**: vitest 4 zeigt `console`-Ausgaben bestandener Tests im Standard-Reporter *nicht* — weder aus der Sammelphase noch aus einem laufenden Test. „Laut" heißt in diesem Reporter zwangsläufig „rot"

### v6.43.0 — importCsvSource wird ein Orchestrator mit benannten Schritten (September 2026)

MINOR — Der dritte und letzte der geplanten Schnitte, und der einzige, der Logik bewegt statt nur Dateien: `importCsvSource` war eine Prozedur von 469 Zeilen, deren Rumpf aus genau EINEM `try`-Block bestand — vierzehn Phasen, jede eine Ebene tiefer als die Funktion, die sie enthielt.

- **[importer-schritte.ts](src/core/services/csv/importer-schritte.ts)**: sieben benannte Phasen; **kein Schritt schreibt in ein geteiltes `result`/`timings`-Objekt** — jeder gibt zurück, was er ermittelt hat
- `importCsvSource` **469 → 237 Zeilen** und ist jetzt lesbar als das, was es ist: Lock, drei Abbruch-Schranken, Speicher-Freigabe, Ergebnis-Zusammenbau
- Die **Abbruch-Schranke vor dem Ersetzen der Share-Kopie** bleibt bewusst im Orchestrator sichtbar — sie verhindert, dass ein abgebrochener Lauf Kopie und Bestand auseinanderlaufen lässt
- **Der Guard `ein-name-eine-implementierung` hat sofort etwas gefunden**: der Importer trug eine byte-gleiche private Kopie von `findJoinColumn`, die es in [merger/helpers.ts](src/core/services/csv/merger/helpers.ts) längst gab — sichtbar erst, als die Extraktion sie aus dem Modul-Privaten hob

### v6.42.0 — Zwei DAOs werden Ordner: idb-csv und smb-handle (September 2026)

MINOR — Zwei Dateien mit zusammen 1.574 LOC und 192 Importeuren waren formal je EINE Verantwortung, faktisch ein DAO für zehn Entitäten und ein Handle-Manager mit vier Fremdaufgaben. Beide Schnitte sind reine Verschiebearbeit: **kein Import-Spezifizierer ändert sich**, die Export-Menge ist nachweislich identisch.

- **[idb-csv/](src/core/services/csv/idb-csv/)** — 633 LOC → 10 Module je Entität; am Dateinamen ist jetzt ablesbar, ob der Voll-Store oder die Slim-Projektion angefasst wird (Pitfall #32)
- **[smb-handle/](src/core/services/infrastructure/smb-handle/)** — 941 LOC → 7 Module entlang der schon vorhandenen Kommentar-Banner; die Berechtigungs-Orchestrierung (37 % der Datei, trägt die `file://`-Regel „ein Prompt pro Gesture") ist jetzt ein eigenes Modul
- Submodule importieren einander **direkt**, nie über ihr Barrel — sonst Zyklus, und `npm run cycles` fährt mit leerer Allowlist (0 Cluster über 2.067 Dateien)
- **Zwei Convention-Guards mussten mitziehen**: sie führten `smb-handle.ts` als Pfad-Fragment auf ihrer Erlaubt-Liste und wurden vom Umzug rot ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts))

### v6.41.1 — Zwei Guards nennen ihre Reichweite (September 2026)

PATCH — Zwei der neuen Ratschen messen weniger, als ihr Name nahelegt. Das steht jetzt bei ihnen — dieselbe Verwechslung machte `no-raw-async-onclick` monatelang zu einem Guard ohne Reichweite.

- **`vier-parameter-sind-ein-objekt`** sieht nur einzeilige `function`-Deklarationen; eine AST-Messung findet 375 Signaturen mit ≥4 Parametern, nicht 18. Der Ausschnitt ist Absicht (88 % aller Signaturen sind niladisch bis dyadisch), aber er muss dranstehen
- **`verschachtelung-vierzehn`** misst Einrückung, nicht Kontrollfluss-Tiefe: die echte maximale Verschachtelung im Bestand ist **6**, erreicht von fünf Funktionen — ein Verschachtelungsproblem gibt es nicht

### v6.41.0 — Zwei blinde Flecken: ein Guard ohne Reichweite, fuenf Dateien binaer fuer git (September 2026)

MINOR — Zwei Befunde aus der adversarischen Gegenprüfung der Messung, beide seit Monaten unbemerkt durch das komplette Gate gelaufen: ein Guard, der eine Abdeckung behauptet, die er nicht hat — und fünf Quelldateien, die git als binär führt.

- **`no-raw-async-onclick` sah nur eine von drei Schreibweisen**: sein Muster trifft `onClick={() => void fn()}`, nicht die Blockform (33×) und kein anderes Handler-Prop (17×). **Alle 50** liegen außerhalb der Whitelist, in 38 Dateien — darunter `App.tsx` und ausgerechnet die als Vorbild genannte `CsvQuellenPanel.tsx`
- Die Lücke wird jetzt **gezählt und gedeckelt** statt geweitet-und-whitelistet ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts)), dazu eine Musterkontrolle für beide Muster
- **Sechs Dateien trugen literale Steuerzeichen**, fünf davon mit NUL und damit für git **binär**: kein Diff-Review, kein textuelles Merge, kein `git log -S`, `git blame` entwertet. Zeichengleich auf Escape-Sequenzen umgestellt — der Laufzeitwert ist derselbe
- Neuer Guard **`keine-steuerzeichen-im-quelltext`** (Ist 0) hält das fest
- **`fmt` wieder eine Quelle**: die neue Guard-Datei hatte sich eine eigene Kopie gebaut; die geteilte Fassung in [conventions-lib.ts](src/__tests__/conventions-lib.ts) kann jetzt kappen

### v6.40.1 — Ein abgebrochener Umbau wird abgeschlossen: totes Duplikat entfernt (September 2026)

PATCH — `fb-status-felder.ts` war seit Juni 2026 eine zweite Wahrheit: die Verallgemeinerung nach `status-datum-gruppen.ts` war fertig, aber die Löschung blieb liegen — ein Notfall-Restore (`3b5bc857`) hatte sie zurückgeholt, nachdem ein fremder Commit die gestagte Löschung einer Parallel-Session mitgenommen und `master` gebrochen hatte.

- **`fb-status-felder.ts` + Test gelöscht** (228 LOC): keine Produktions-Importstelle; beide Dateien führten dieselbe 11-elementige `FB_STATUS_CODES`-Liste byte-identisch
- Kein Testverlust: [status-datum-gruppen.test.ts](src/core/services/csv/__tests__/status-datum-gruppen.test.ts) deckt jede Zusicherung des gelöschten Tests ab und zusätzlich `D_PC?`/`D_XPC?`
- Zwei Doku-Verweise auf die tote Datei nachgezogen ([korpusFeldAufloesung.ts](src/plugins/antraege/services/korpusFeldAufloesung.ts), [suche-relevanz.md](docs/architecture/suche-relevanz.md))

### v6.40.0 — Die Clean-Code-Achse: elf Regeln zur Codeform, jede mit gemessenem Ist (September 2026)

MINOR — Die ~90 vorhandenen Guards prüfen ausschließlich Fachregeln; eine Achse für die Form des Codes gab es nicht. Sie fehlte nicht, weil die Disziplin fehlt — vier der elf Regeln haben heute **null** Verstöße und halten damit gratis einen Zustand, den bisher nur Gewohnheit hielt.

- **[conventions-clean-code.test.ts](src/__tests__/conventions-clean-code.test.ts)**: 4 Verbote (Ist 0) + 7 Ratschen (Ist eingefroren, darf nur sinken) — jede Schwelle am Bestand gemessen, jede einmal ROT gesehen
- **Ratsche statt Drift-Warnung**, weil die Projekthistorie das entscheidet: über die vier `health-baseline`-Schwellen stehen **70 Anhebungen gegen 5 Senkungen**
- **`eslint-disable-nur-fuer-inaktive-regel`** dreht eine geladene Falle in einen Stolperdraht: alle 72 Direktiven unterdrücken heute *inaktive* Regeln — wer `exhaustive-deps` einschaltet, bekommt sonst null Treffer und hält das für sauber
- **Musterkontrollen für jedes Muster** (Probe + Gegenprobe): ein absichtlich gebrochenes `as any`-Muster fand 0 statt 25 Stellen, die Ratsche blieb dabei **grün** — nur die Kontrolle bemerkte den entwaffneten Guard
- Die Datei nimmt **sich selbst** aus jedem Scan: sie muss die verbotenen Muster im Klartext nennen (dieselbe Klasse wie die 7 Wochen, in denen `MAX_FILE_LOC` die Guard-Datei maß)

### v6.39.1 — Guard-Scanner: 27,5 Prozent weniger Lesearbeit, Blockregeln moeglich, frischer Klon laeuft (September 2026)

PATCH — Der geteilte Guard-Scanner las bei jedem Voll-Durchlauf eine 7,00-MB-Datei mit, die keine Konvention enthält; nur ein einziger Guard hatte die Falle bemerkt und für sich allein repariert. Dazu zwei Vorarbeiten für die Clean-Code-Achse.

- **`src/generated/` fliegt aus [conventions-lib.ts](src/__tests__/conventions-lib.ts)**: eine Datei, 7,00 MB, **27,5 %** jedes Voll-Scans — Testlaufzeit von `check:docs` 18,6 s → 15,0 s
- Die lokale Reparatur in [conventions-status.test.ts](src/__tests__/conventions-status.test.ts) entfällt; die Begründung steht jetzt einmal bei `UEBERSPRUNGEN`
- **`findInContent`** ergänzt: Regeln, die über einem BLOCK entscheiden (leerer `catch`, mehrzeilige Signatur), brauchen keinen eigenen Datei-Scan mehr
- **Frischer Klon lief nicht**: `src/generated/ort-wasm-gz.ts` ist gitignored und wird statisch importiert, aber kein Pre-Hook von `typecheck`/`test` erzeugte sie — `pretypecheck`/`pretest` schließen das (0,19 s, idempotent)

### v6.39.0 — Codequalitaets-Baseline: die Kennzahlen bekommen einen Zaehler (September 2026)

MINOR — Technische Schuld war bisher nur als Gefühl vorhanden: die einzige Struktur-Schranke (`MAX_FILE_LOC` und Geschwister) wurde 70-mal angehoben und 5-mal gesenkt, und sieben Wochen lang maß sie die Guard-Datei selbst statt den Produktionscode. Dieser Schritt misst nur — er verbietet nichts.

- **Mess-Modul** [quality-metrics.mjs](scripts/lib/quality-metrics.mjs): zehn Kennzahlen (Größe, Typsicherheit, Fehlerbehandlung, Marker, Guard-Ausnahmen, Kopplung, Duplikate, Testbezug, tote Exporte, Guard-Suite über sich selbst), reine Node-Stdlib
- **Bericht** [code-quality-baseline.md](docs/architecture/code-quality-baseline.md) per `npm run qualitaet` — versioniert und **ohne Lauf-Datum**, damit ein Diff nur bei echter Drift entsteht; bewusst NICHT im `precheck`
- **`countLoc()` genau einmal definiert** — bis hierher zählte `health-baseline` `split(/\r?\n/)` und `code-map` die Newlines: bei `SuchSeite.tsx` 1233 gegen 1232
- **`src/generated/` ausgeschlossen**: das inline-gzippte ORT-WASM sind 7,34 MB in EINER Zeile und trägt keine Kennzahl
- Erster Befund: 72 `eslint-disable` unterdrücken **ausnahmslos inaktive** Regeln (49× `exhaustive-deps`), und 11 der 55 `vi.mock`-Testdateien stehen nicht in `ISOLATED_TESTS`

### v6.38.0 — AI-native SDLC: Grill-Skill, Zeiger-Skills, Hook, Glossar, Review-Policy (September 2026)

MINOR — Anthropics AI-native SDLC Playbook und Pococks `grill-with-docs`, auf dieses Repo übertragen: Regeln, die bisher nur Prosa waren (keine Heredocs, `git add` nur mit Pathspec), erzwingt jetzt ein Hook; die riskantesten Cheatsheets laden als Skill automatisch; das Interview vor dem Bauen hat ein Format; ein Entwickler-Glossar und eine Review-Policy gibt es erstmals. Detail: [entwicklungsprozess.md](docs/architecture/entwicklungsprozess.md).

- **Hook + Deny-Regeln** in [.claude/settings.json](.claude/settings.json): [bash-guard.mjs](scripts/hooks/bash-guard.mjs) blockt Heredocs, `git add -A/./-u` und verwerfende Git-Befehle mit Grund; eingefrorene Pfade (`_archive/`, `_reference/`, `src/generated/`) sind für Edit/Write gesperrt
- **Skill `grillen`** ([SKILL.md](.claude/skills/grillen/SKILL.md)): Befund zuerst, Frontier-Runden mit Empfehlung, Pflicht-Zweige des Repos, Glossar-Pflege inline — Frage-Schritt des Brainstormings
- **Acht Zeiger-Skills** (`plugin-anlegen` … `filter-facet-anlegen`) öffnen ihr Cheatsheet automatisch; die Quelle bleibt [docs/agents/](docs/agents/README.md)
- **Glossar + Review-Policy**: [CONTEXT.md](CONTEXT.md) (Begriffe, *nicht sagen*, Mehrdeutigkeiten) und [REVIEW.md](REVIEW.md) (vier Pässe, Nit-Deckel 5) für `/code-review`
- **Leichte Artefakt-Kette**: `## 0. Anlass` als Pflicht-Abschnitt jeder Spec, Schwelle für Spec + Plan im Repo ([docs/superpowers/README.md](docs/superpowers/README.md)); Guard [agent-konfiguration.test.ts](src/__tests__/agent-konfiguration.test.ts) prüft Skills, Hook, Settings und Specs in `check:docs`

### v6.37.1 — Veraltete CSV-Datei wird nicht mehr über den Team-Stand importiert (September 2026)

PATCH — Das Produktiv-Audit-Log nannte den Verursacher von v6.37.0: ein Laptop mit einem für Dev-Zwecke eingestellten CSV-Ordner (Exporte vom 21./23.08.) lief gegen den echten Share und importierte dreimal am Tag die alten Dateien über den aktuellen Stand (`changed 1028, heldRemovals 66`) — 18 Tage zurück, bis der nächste Kollege wieder vordrehte. Die 6-h-Divergenz aus v6.37.0 greift dort nicht; die Dateien liegen 18 Tage auseinander, in die falsche Richtung. Detail: [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md).

- **Ältere Datei als der Team-Stempel (≥ 24 h) wird NICHT importiert** und nicht gestempelt — Block mit „Trotzdem importieren" wie bei Spalten-Drift ([csv-quell-divergenz.ts](src/plugins/csv-sources-kuration/services/csv-quell-divergenz.ts), [auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts))
- Bericht, Banner und Dialog zeigen beide Dateien mit Datum, Größe und Urheber; Audit `csv_quelle_veraltet`; `[data-update]` führt `veraltet=` ([CsvAutoRefreshDriftDialog.tsx](src/plugins/csv-sources-kuration/components/CsvAutoRefreshDriftDialog.tsx))

### v6.37.0 — CSV-Quellen: lokaler Import-Stempel, Divergenz-Warnung (September 2026)

MINOR — Produktivsystem, fünf pl-Rechner nach dem Share-Umzug: bei **jedem** Start importierte die App alle drei Quellen neu (Konsole: `imported=3 upToDate=0`, drei Merges mit ~1000 „geänderten" Zeilen, Publish), obwohl die Exporte nur nachts entstehen. Alles, woran die App „schon importiert" erkannte, lag im Snapshot — und den ersetzt der jeweils letzte Publizierer; sehen zwei Rechner die Quelle verschieden, importieren und veröffentlichen sie im Wechsel. Detail: [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md), [recurring-bug-classes.md #26](docs/architecture/recurring-bug-classes.md).

- **Lokaler Import-Stempel** je Quelle im kv-Store, nie im Snapshot: ein Rechner importiert eine Datei höchstens einmal, egal wessen Stempel der Sync hereinträgt ([lokaler-stempel.ts](src/core/services/csv/lokaler-stempel.ts), [csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts))
- **Divergenz-Warnung**: gleiche Export-Nacht, anderer Inhalt, trotzdem Änderungen ⇒ zwei Rechner lesen verschiedene Kopien — Banner, Dialog (beide Dateien mit Größe, Datum, Urheber) und Audit `csv_quelle_divergenz`; Warnung, kein Block ([csv-quell-divergenz.ts](src/plugins/csv-sources-kuration/services/csv-quell-divergenz.ts))
- **Der Start-Pass berichtet in den Banner** statt nur in einen 6-Sekunden-Toast — Divergenz, Drift, Fehler aus dem automatischen Lauf bleiben stehen ([start-bericht.ts](src/plugins/csv-sources-kuration/services/start-bericht.ts))
- **Diagnose im Audit-Log**: `csv_auto_refresh_started` nennt je Kandidat den Grund samt eigener Datei und Team-Stempel, `csv_source_auto_updated` Größe + Checksum, das Schema seinen Urheber (`source_stamped_by`); `[data-update]` führt `changed= errors= divergenz=` ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts))
- Der Kopie-Ordner-Guard steht jetzt im Banner statt nur in der Konsole, die pl-Nutzer nie sehen ([CsvAutoRefreshBanner.tsx](src/plugins/csv-sources-kuration/components/CsvAutoRefreshBanner.tsx))

### v6.36.1 — Abschnitt D bekommt seine Umfangs-Vorgabe zurueck (August 2026)

PATCH — Beim Nebeneinanderlegen der Vorgaben aller sieben Abschnitte (v6.36) stand D als einziger auf `{}`. Der Seed führt 300–350 seit jeher; auf den Share kam der Wert nie, und niemand hat je gemerkt, dass D ungeprüft lief. Detail: [artefakt-engine.md](docs/architecture/artefakt-engine.md).

- **D prüft jetzt 300–350 Wörter als `fehler`** — dieselbe Vorgabe wie C, dieselbe Sorte Abschnitt; damit greift auch dort der automatische Korrektur-Versuch ([migrations.ts](src/core/services/skills/registry/migrations.ts))
- Gemessen an neun gespeicherten D-Texten, was ohne Prüfung entstand: **1 im Band**, drei mit **neun Wörtern** (9, 9, 9, 341, 356, 387, 412, 419, 841)
- Ursache: `applySkillVorgaben` (v2.296) wandelte nur Regel-Records um, die es auf dem Share gab — `mergeMissingSeeds` ergänzt fehlende Skills, nie fehlende Felder eines vorhandenen
- Gesetzt wird **nur, wo gar keine Wortanzahl steht**; ein kuratierter Wert, auch ein weicherer Schweregrad, bleibt unangetastet

### v6.36.0 — Der Standardsatz zieht an den Workflow, der fachliche Pruefer geht an (August 2026)

MINOR — 37 Regel-Deklarationen über A–G, davon 25 dieselbe Regel mehrfach: eine Änderung an „keine Aufzählungen" waren sechs Änderungen. Der Satz zieht an den Workflow, wo er hingehört — und der seit v6.27 stillgelegte fachliche Prüfer geht mit an. Detail: [artefakt-engine.md](docs/architecture/artefakt-engine.md).

- **`WorkflowDef.standardRegelIds`** trägt die vier Form-Regeln für jeden Abschnitt; die aufgelöste Regelliste bleibt A–F **identisch**, nur G gewinnt die bisher fehlende Aufzählungs-Regel ([selectors.ts](src/core/services/skills/registry/selectors.ts))
- **Am Workflow und nicht am Prüfer**: sonst hätte ein abgeschalteter Prüfer stillschweigend vier Form-Regeln aus allen sieben Abschnitten mitgenommen ([types.ts](src/core/services/skills/registry/types.ts))
- **`SkillRecord.ohneStandard`** macht aus der Lücke eine Ansage — E und F tragen bewusst keine Passiv-Regel, was bisher von einem Versehen nicht zu unterscheiden war ([gutachten-bg.seed.ts](src/core/services/skills/registry/gutachten-bg.seed.ts))
- **Der fachliche Prüfer ist an** (`qs-basis`, dritter KI-Lauf je Abschnitt auf der Gegenrolle) — er existiert nur in dev und pl, der Kill-Switch bleibt am Skill ([qs-basis.seed.ts](src/core/services/skills/registry/qs-basis.seed.ts))
- Gemessen am gespeicherten Eval-Korpus (224 echte Abschnitts-Texte): die zwei geschlossenen Lücken schlagen **null-mal** an, der Umzug ist damit verhaltensneutral

### v6.35.0 — Die Korrektur-Anweisung nennt das Ziel zuerst (August 2026)

MINOR — Erstmals gegen die **interne KI** gemessen statt gegen den OpenRouter-Zwilling. Sie verhält sich anders — und die Korrektur-Anweisung entscheidet sich an einem Detail: das Modell zielt auf die zuerst genannte Zahl. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Die Korrektur-Anweisung nennt jetzt das ZIEL zuerst**, die Ränder dahinter („Kürze auf rund 450 Wörter (Untergrenze 400, Obergrenze 500)") ([korrektur.ts](src/core/services/skills/registry/korrektur.ts))
- Gemessen an der internen KI, Abschnitt B: Obergrenze zuerst → 659 **→ 377** (25 % unter dem Band); Ziel zuerst → 399 **→ 443** und 539 **→ 482**, beide im Band
- **Der komplette Weg trägt ohne Zutun**: B frisch erzeugt 645 → automatische Korrektur → **473**, 6 von 6 Checks ok; C **→ 304**, 5 von 5 ok
- Die interne KI schreibt anders als Haiku — B **725 statt 310–440** (zu lang), C **106 statt 244–321** (zu kurz); was am Zwilling gewinnt, gewinnt nicht am Original
- Vor diesen Änderungen stand C bei 106 Wörtern gegen ein Ziel von 300–350, B bei 725 gegen 400–500

### v6.34.0 — Ueberschriften im Gutachten-Fliesstext werden gefunden (August 2026)

MINOR — Die Prompts verlangen „keine Zwischenüberschriften", und `keineAufzaehlungen` ist als `fehler` gebunden — trotzdem trug jeder vierte B-Text Markdown-Überschriften bis in den DOCX-Export. Die Regel sucht Listen-Marker; eine Überschrift ist keiner. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Neuer Regel-Typ `keine_ueberschriften`** als Geschwister von `keine_aufzaehlungen` — dieselbe Absicht („ein geschlossener Fließtext"), die fehlende Hälfte der Umsetzung ([check-engine.ts](src/core/services/skills/registry/check-engine.ts))
- Gemessen an 224 echten Abschnitts-Texten aus vorhandenen Eval-Läufen: **17 von 77 B-Texten** betroffen, C–G sauber, **kein einziger Fehlalarm** — ohne neuen Modell-Aufruf
- Als geteilte Regel `seed-keine-ueberschriften` an **alle sieben** Abschnitte gebunden, auch an E und F ([gutachten-kurzfassung.seed.ts](src/core/services/skills/registry/gutachten-kurzfassung.seed.ts))
- **Bewusst `hinweis`, nicht `fehler`**: ein `fehler` verwürfe über den `neu`-Retry einen sonst brauchbaren Abschnitt, und der Nutzen davon ist ungemessen (Mess-Budget erschöpft)
- **Gemessen und verworfen**: die Platzhalter-Regel und fünf Meta-/TODO-Muster schlagen auf denselben Texten null-mal an — sie würden nur eine dauerhaft grüne Zeile je Abschnitt hinzufügen

### v6.33.0 — Die Wortanzahl von B und C wird durchsetzbar (August 2026)

MINOR — Der Befund aus v6.32 („das Ziel liegt über dem, was das Modell schreibt") galt nur für einen einzelnen Wurf. Mit der Wortanzahl als `fehler` greift der vorhandene `laenger`-Retry, und die Zielzahlen sind erreichbar. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **B und C führen die Wortanzahl als `fehler` statt `hinweis`** — nur so startet `chooseRetryModifier` einen Korrektur-Versuch; B erreicht damit 9 von 9 Läufen das Band 400–500 (vorher: nie) ([gutachten-bg.seed.ts](src/core/services/skills/registry/gutachten-bg.seed.ts))
- Der Seed übernimmt für B die vom Team kuratierten **400–500** statt der alten 750, die nachgemessen kein Modell erreicht
- **Die Eval-Harness kennt den Auto-Retry** — Decke aus der Workflow-Definition, `--no-auto-retry` schaltet ab; ohne sie maß jede Zahl den ersten Wurf, den in der App niemand sieht ([eval-run.ts](src/core/services/skill-eval/eval-run.ts))
- Der automatische Korrektur-Lauf nennt jetzt denselben Zielwert wie der manuelle Knopf (`retryKorrekturAnweisung`, ohne messbaren Effekt) ([retry-policy.ts](src/plugins/antraege/gutachten/retry-policy.ts))
- **Zurückgenommen nach der Messung**: zwei „prinzipiellere" Korrektur-Wortlaute („N bis M", „rund MITTE") schnitten schlechter ab als der Bestand (10/18 und 11/18 gegen 14/18) — Sonnet 5 löst es ebenfalls nicht

### v6.32.0 — Abschnitt B und C: die Zahl ueberlebte den Formwechsel (August 2026)

MINOR — Beide Abschnitte lieferten 3/3 zu wenig Wörter, und beide Male war es eine Umfangs-Zahl, die eine Form überlebt hat, für die sie nie geeicht war. Anders als bei A war die Messung selbst in Ordnung. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **B forderte in der Prosa mindestens 750 Wörter, in der Regel 400–500** — die Teil-Richtwerte ≥150/≥150/≥450 blieben bei der Ent-Dopplung 2026-07 stehen und waren auf den alten Stand geeicht ([gutachten-bg.seed.ts](src/core/services/skills/registry/gutachten-bg.seed.ts))
- **C's Umfang gehörte zu einer Form, die es nicht mehr gibt**: 300–350 Wörter galten, als der finale Text ALLE Risiken mit Kurztitel trug; heute ist er eine gefilterte Teilmenge ohne eigene Tiefenangabe
- Gemessen (Haiku, 3 VBs): **C 203/235/218 → 309/244/283**, B ohne Richtung (360/364/364 → 440/321/337) — B's Ziel liegt über dem, was das Modell für diesen Abschnitt schreibt
- **Der `laenger`-Retry feuert bei zu kurzem Text nie** — `chooseRetryModifier` startet nur bei `fehler`, die Wortanzahl ist an B und C ein `hinweis` ([retry-policy.ts](src/plugins/antraege/gutachten/retry-policy.ts))
- Der Wächter, der das hätte fangen müssen, prüft Teil-Richtwerte jetzt als **Summe**; `npm run eval:skills` meldet Prompt-Widersprüche VOR dem ersten Modell-Aufruf ([check-engine.ts](src/core/services/skills/registry/check-engine.ts), [cli.ts](src/core/services/skill-eval/cli.ts))

### v6.31.0 — Doppelfoerderung: der Bestand waehlt das Schlagwort (August 2026)

MINOR — Der erste Messlauf gegen die interne KI zeigte: 45,6 % der gelieferten Schlagworte trafen im Bestand **nichts**, 13,4 % fluteten. Das ist kein Prompt-Mangel, sondern eine Wissensgrenze — das Modell sieht den Bestand nicht, die App schon. Detail: [doppelfoerderung.md](docs/architecture/doppelfoerderung.md).

- Das Modell liefert je Achse **zwei bis drei Vorschläge eng → weit** statt eines Worts; ein KI-Lauf je Zeile wie bisher ([schlagworte.ts](src/plugins/doppelfoerderung/services/schlagworte.ts))
- Die Wahl trifft der Bestand: Rang `trägt` vor `markiert` vor `tot` vor `flutet`, bei Gleichstand der engere ([wortwahl.ts](src/plugins/doppelfoerderung/services/wortwahl.ts))
- Ein nachgeschlagenes Wort trägt `↳` und nennt im Tooltip den verworfenen Erstvorschlag mit seiner Trefferzahl ([ErgebnisTabelle.tsx](src/plugins/doppelfoerderung/components/ErgebnisTabelle.tsx))
- Gemessen (3 × 29 Meldungen, 261 Schlagworte): tote Wörter **45,6 % → 29,1 %**, „zu weit" **13,4 % → 7,3 %**, Median 1 → 4, „nicht beurteilbar" 9 → 3 Zeilen; Wartezeit +55 %
- **Nicht gelöst**: die Wiederholbarkeit — 8 von 29 Zeilen wechseln über drei Läufe weiter ihr Urteil (Abschnitt 12)

### v6.30.0 — Abschnitt A: Zweck, Weglass-Liste und das verlorene Ausgabeformat (August 2026)

MINOR — Die Kurzfassung wird veröffentlicht und steht dort allein — das stand nirgends, und ohne den Zweck war nicht begründbar, warum Antragsteller, FuE-Risiko und Abgrenzung zum Stand der Technik nicht hineingehören. Darunter lagen zwei Defekte, die erst der Messlauf zeigte. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Das Ausgabeformat war im kuratierten Prompt verloren** — ohne `### Finaler Text` nahm der Parser die GANZE Antwort samt erfundener Titelzeile, Förderkennzeichen und Antragsteller-Zeile; daran riss das Zeichenlimit ([gutachten-kurzfassung.seed.ts](src/core/services/skills/registry/gutachten-kurzfassung.seed.ts))
- Zweck, Weglass-Liste und das Zeichenlimit als **Schreib**-Anweisung (1.100 Zeichen auf zehn Sätze = rund 15 Wörter je Satz) statt als Nachkontrolle — `mitVeroeffentlichungsKontrakt`, eine Funktion für Seed und Migration
- **Der Eval-Judge sah nur 10–12 % der VB** (Cap 12.000 bei 100.000+ Zeichen) und wertete korrekt übernommene Kennzahlen als „nicht belegt" ab; Default jetzt die ganze VB, `--judge-vb-cap` senkt ihn ([judge.ts](src/core/services/skill-eval/judge.ts))
- Die `beschreibung` von A trägt den Umfang — sie ist das einzige Feld, aus dem der Judge erfährt, was der Abschnitt leisten soll
- Gemessen (Haiku 4.5 / Opus 5, 3 fiktive EP): fachliche Korrektheit **3,00 → 4,67**, Regeltreue **3,00 → 4,33**, Läufe ohne Check-Fehler **0/3 → 2/3**

Rollout über `ga-a-veroeffentlichung-2026-08`, additiv und zeilenweise; eine selbst geschriebene `beschreibung` bleibt stehen.

### v6.29.0 — Zeitplan-Pause aufgehoben (August 2026)

MINOR — Der Zeitplan-Tab war seit v2.266 gesperrt, weil „die Arbeitspaket-Erkennung aus den PDF-Quellen zu unzuverlässig" sei. Der Grund lag eine Schicht tiefer, im Konverter (v6.28.0) — behoben trägt die Ernte. Nachgemessen über den echten `baueRun`-Pfad, dann aufgehoben; zwei Defekte, die erst die offene Sicht zeigte, gleich mit. Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

- Zeitplan-Tab, „Zeitplan öffnen"-Einstieg und die Zahlen-Quervergleiche sind **unbedingt offen**; ein Antrag ohne lesbaren Arbeitsplan bekommt den Leerzustand statt einer Sperre ([tab-gating.ts](src/plugins/antraege/aufbereitung/tab-gating.ts))
- Die Pause ist **entfernt**, nicht auf `false` gestellt — `ZEITPLAN_PAUSIERT`, `zeitplanVerfuegbar` und `sichtbareZeitplanBefunde` samt ihrer Gates sind weg ([pausierte-module.ts](src/plugins/antraege/aufbereitung/pausierte-module.ts))
- **Anlage 5 wird auch aus der VB gelesen**, wenn sie kein eigenes Dokument ist (so in allen drei synthetischen Anträgen) — vorher zeigte der Tab 9 Text-Zeilen ohne PM/MA statt der 21 vollständigen ([store.ts](src/plugins/antraege/aufbereitung/store.ts))
- **„Januar 2024" ist kein Monat 2024**: Beginn/Ende-Spalten mit Datums-Werten werden als Kalendermonate gelesen (M1 = frühester Beginn), Monats-Indizes über 240 verworfen — die Gantt-Achse ging sonst bis M2026 ([tabellen.ts](src/plugins/antraege/aufbereitung/tabellen.ts))
- Messung 100 generierte DOCX-Anträge: 49 mit AP-Tabelle → **100 %** auswertbare Monats-Spannen, `zeitplanUnsicher` false 49/49; 49 ohne → `run.zeitplan === null`, kein falscher Gantt

**Unverändert pausiert**: Fragen-Tab, Abdeckungs-Tab und die nicht prüfrelevanten Zahlen-Kategorien — andere Gründe, eigene Entscheidungen.

### v6.28.0 — Die PDF-Konvertierung liest die Gliederung aus dem Dokument (August 2026)

MINOR — Gemessen an den drei synthetischen Anträgen kamen aus einem PDF **0 von 44–47 Überschriften** an, 0 Listen, 0 Auszeichnungen — obwohl alle drei PDFs ihre Gliederung als Tag-Baum mitbringen. Der Konverter las nur `getTextContent()` und warf die Struktur weg. Folge: `parseVbHeadings` fand genau eine Sektion, die Relevanz-Map des Gutachtens war auf jedem PDF-Antrag blind. Detail: [pdf-konvertierung.md](docs/architecture/pdf-konvertierung.md).

- **Sprosse 1 — Tag-Baum**: `getStructTree()` + Marked-Content-Ids ergeben Überschriften, Listen und Tabellen wie im Original; Kopf-/Fußzeilen fallen als Artefakte weg ([pdf-struktur.ts](src/core/services/converter/pdf-struktur.ts))
- **Sprosse 2 — Schriftgrößen** für PDFs ohne Tags: Grundgröße nach Zeichen (nicht nach Zeilen), umbrochene Überschriften werden zusammengesetzt, und über 25 % Trefferquote gilt das Signal als unbrauchbar ([pdf-ueberschriften.ts](src/core/services/converter/pdf-ueberschriften.ts))
- **Sprosse 3 — flach**: der Bericht sagt jetzt, dass die Überschriften verloren sind, und nennt den Umweg über den PDF-Client ([conversion-report.ts](src/core/services/converter/conversion-report.ts))
- Ein Inhaltsverzeichnis wird als **Liste** gesetzt (getaggt oder als Absatz-ganz-im-Link erkannt) — als blanke Zeilen las die Gliederungs-Erkennung jede IHV-Zeile als Kapitel: 59 statt 47 Sektionen
- Gemessen nach dem Umbau: **46/48/45 Überschriften** (Referenz 46/47/44), Relevanz-Map 32/34/31 = exakt die Referenz

**Wo es aufschlägt**: jede VB-Aufnahme (Aufbereitung, Gutachten, Dokumente, Chat-Anhänge) — die Konvertierung ist eine Stelle. DOCX war und bleibt strukturtreu; die Leiter betrifft nur PDF.

### v6.27.1 — die Zieldatei überlebt einen gescheiterten Write (August 2026)

PATCH — `atomicWrite` benannte das Ziel zur `.backup` um, **bevor** es den neuen Inhalt schrieb; bei `atomicWriteStream` umfasste dieses Fenster den ganzen `produce`-Lauf. Jeder Abbruch darin ließ nur `<datei>.backup` zurück — belegt an `_intern/skills/registry.json`. Regel: [add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md).

- **Reihenfolge gedreht**: erst `.tmp` schreiben, dann rotieren, dann umbenennen — das Fenster ohne Zieldatei schrumpft auf zwei Umbenennungen ohne Nutzdaten-I/O ([atomic-write.ts](src/core/services/infrastructure/atomic-write.ts))
- **Gescheiterter Einwechsel wird zurückgedreht** — schlägt die letzte Umbenennung fehl, trägt das Ziel wieder seinen alten Inhalt (`tauscheTmpEin`, geteilt von beiden Schreibern)
- Der Kommentar „das Ziel bleibt unberührt" an `atomicWriteStream` war falsch; er stimmt jetzt
- **Warum die grüne Suite das trug**: der einzige Fehlerfall-Test lief mit `skipBackup` — dem einen Profil, das das Ziel nie wegbenennt ([atomic-write-konformitaet.test.ts](src/core/services/infrastructure/local-fs/__tests__/atomic-write-konformitaet.test.ts))
- Neuer Ordnungs- **und** Ergebnis-Nachweis, jeder Zweig einmal rot gesehen ([atomic-write-reihenfolge.test.ts](src/core/services/infrastructure/__tests__/atomic-write-reihenfolge.test.ts))

### v6.27.0 — Der fachliche Prüfer wird gebunden (August 2026)

MINOR — Die fachliche Prüfung war vollständig gebaut und nirgends gebunden: `zim-ep` trug sieben Generierungs-Schritte und keinen `llm_qs`, also erschien der QS-Knopf nie und `ga-qs-quellenabgleich` — eine `fehler`-Regel — ist noch nie gelaufen. Detail: [artefakt-engine.md](docs/architecture/artefakt-engine.md).

- **Ein Prüfer ist ein Skill mit `pruefart`**, gebunden am ARTEFAKT (`WorkflowDef.pruefer`) statt als sieben `llm_qs`-Schritte ([selectors.ts](src/core/services/skills/registry/selectors.ts))
- **Drittes Bein der Kette**: `mitPruefung` nach dem Feinschliff — auch nach Überarbeitungen, auf der **Gegenrolle** der Generierung, beratend und ohne Auto-Retry ([workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts))
- **Prüfkatalog am Prüfer** (`gruppe` · `kriterium` · `herkunft` · `giltFuer`); eigene `qsKriterien` am Abschnitt schlagen ihn ([PruefkatalogEditor.tsx](src/plugins/skill-verwaltung-kuration/PruefkatalogEditor.tsx))
- **Er startet stillgelegt** — sein Prompt ist an echten Abschnitten nie gemessen worden, und er kostet je Abschnitt einen KI-Lauf (A–G ~10 → ~15 min). Rollout `ga-fachpruefer-2026-08` ([migrations.ts](src/core/services/skills/registry/migrations.ts))
- Abgenommen in der laufenden App: Migration legt einen Bestands-Share still, Katalog-Zeile bis auf die Platte gespeichert, 0 Konsolenfehler

### v6.26.0 — Jede Vorgabe nennt ihren Grund (August 2026)

MINOR — Am Zeichenlimit der Kurzfassung stand nirgends, dass es aus einem fremden Formularfeld kommt, das 1.200 Zeichen fasst. Deshalb stand es gleichrangig neben einer hausgemachten Satzzahl, die ihm rechnerisch widersprach — und niemand konnte sagen, welche der beiden verhandelbar ist. Detail: [skill-vorgaben.md](docs/architecture/skill-vorgaben.md).

- **`herkunft` an Regel und Vorgabe** — ein Satz, den der Kurator schreibt und der NICHT in den Prompt geht ([types.ts](src/core/services/skills/registry/types.ts))
- **Er reist bis an die Prüfung**: `runRegelChecks` stempelt ihn wie `kategorie` auf das `CheckResult`, die Check-Liste zeigt ihn als „Grund:"-Zeile unter dem Befund ([CheckList.tsx](src/plugins/antraege/kurzfassung/CheckList.tsx))
- **Gepflegt wird er im Skill-Editor (je Vorgabe) und im Regel-Editor** ([VorgabenEditor.tsx](src/plugins/skill-verwaltung-kuration/VorgabenEditor.tsx), [RegelEditor.tsx](src/plugins/skill-verwaltung-kuration/RegelEditor.tsx))
- **Kurzfassung: Zeichenlimit 1.000 → 1.100** („900 ± 200", hundert Zeichen Luft zum harten Rand) samt Grund — Rollout über `ga-a-zeichen-herkunft-2026-08`, Wert und Grund unabhängig pristine-geschützt ([migrations.ts](src/core/services/skills/registry/migrations.ts))
- Abgenommen in der laufenden App: Grund-Zeile an Ampel-Zeile UND Fehler-Karte, Editor speichert bis auf den Share, 0 Konsolenfehler

### v6.25.2 — Doppelförderung: die fehlende Ähnlichkeit nennt ihren Grund (August 2026)

PATCH — Fehlte die Ähnlichkeit, sah das aus wie ein Vorhaben ohne inhaltliche Nachbarn — dabei war oft nur das Modell nicht bereit. Beim Abnehmen von v6.25.1 kostete genau das drei Fehlversuche. Detail: [doppelfoerderung.md](docs/architecture/doppelfoerderung.md).

- **Vier getrennte Gründe statt einer stummen Leerstelle** (`modell-fehlt` · `vektoren-fehlen` · `vektoren-unlesbar` · `einbetten-schlug-fehl`) ([types.ts](src/plugins/doppelfoerderung/types.ts))
- **Was den ganzen Lauf betrifft, steht im Seitenkopf; was eine Zeile betrifft, an ihrer Karte** — samt der rohen Meldung des Modells ([ErgebnisTabelle.tsx](src/plugins/doppelfoerderung/components/ErgebnisTabelle.tsx))
- **`embedden` fängt nichts mehr ab**: die Klassifizierung sitzt in `aehnlichkeitsStufe`, die Stapellauf und Handeingabe gleichermaßen bedient ([abgleich.ts](src/plugins/doppelfoerderung/services/abgleich.ts))
- Die drei Wege, die vorher gemeinsam in `catch(() => new Map())` endeten, werden beim Laden der Einbettungen einzeln benannt ([useDoppelfoerderung.ts](src/plugins/doppelfoerderung/useDoppelfoerderung.ts))
- Abgenommen in der laufenden App: Kopfzeile bei ungeladenem Modell, Zeilenvermerk „(Model not initialized)" nach Handeingabe, 0 Konsolenfehler

### v6.25.1 — Handweg holt die Ähnlichkeit nach (August 2026)

PATCH — Die Handeingabe aus v6.24 rechnete nur Wortlaut und Träger nach. Ohne erreichbare KI kam der Stapel nie bis zur Ähnlichkeitsstufe — und ohne sie kann das Träger-Urteil nicht auslösen, weil es eine inhaltliche Mindestnähe verlangt. Der Eingabeweg zeigte damit genau das nicht, wofür es ihn gibt.

- **Wer Schlagworte von Hand einträgt, bekommt die Ähnlichkeitsstufe jetzt nachgereicht**, sofern die Zeile noch keine Werte hat und das Embedding-Modell geladen ist ([useDoppelfoerderung.ts](src/plugins/doppelfoerderung/useDoppelfoerderung.ts))
- Abgenommen an `49MF260044`: „keine Übereinstimmung" mit 9 Befunden wird zu **„Übereinstimmung (gleicher Träger)"** mit 10, VetDx/ZytoVet auf Platz 1

### v6.25.0 — Kategorie-Referenzen ohne Neubau (August 2026)

MINOR — Die Kategorie-Referenzen liegen in `auslastung.json`, nicht im Korpus. Wer den Korpus vom Datenspeicher **holte**, bekam sie nie — die Karte meldete „synchron", die Themen-Erkennung blieb stumm, und der einzige Ausweg war ein Neubau (ohne Grafikkarte über zwölf Stunden). Zwei Umgebungen mit getrennten Daten-Shares treffen genau das. Detail: [auslastung.md](docs/architecture/auslastung.md).

- **Nach „Vom Datenspeicher laden" werden die Kategorie-Referenzen nachgezogen** — ein Mittelwert über die geholten Verbund-Vektoren, ohne Modell und ohne Grafikkarte ([useKategorieReferenzen.ts](src/plugins/auslastung/hooks/useKategorieReferenzen.ts))
- **Der Hinweis „Kategorie-Referenzen fehlen" trägt jetzt den Knopf „Jetzt berechnen"** statt einer Anleitung zum Korpus-Bau, die seit v4.127 zudem auf den falschen Reiter zeigte ([KlassifizierungsReview.tsx](src/plugins/auslastung/views/KlassifizierungsReview.tsx))
- **Eine leere Zentren-Map schreibt nichts** — vorher hätte ein Lauf ohne Klassifizierungen die Referenzen des ganzen Teams gelöscht ([kategorie-referenzen.ts](src/plugins/auslastung/services/klassifizierung/kategorie-referenzen.ts))
- **Ein gescheiterter Schreibvorgang bricht den Bau nicht mehr ab**: die Spiegelung läuft weiter, die Karte sagt, dass die Referenzen nur in dieser Sitzung gelten ([useKorpusBau.ts](src/plugins/kuration/suche-index/hooks/useKorpusBau.ts))
- Ohne das Auslastungs-Modul (`features.auslastung === false`) entfällt der Schritt ganz — samt des Schreibversuchs, der in einer Nur-Lese-Variante nur scheitern konnte

### v6.24.0 — Doppelförderung: der Zuwendungsempfänger wird zum Beleg (August 2026)

MINOR — ZIM fördert selbst Netzwerke; Mittelstand-Digital-Zentren sind ihnen ähnlich. Die halbe Beispielliste war damit nicht unprüfbar, sondern gegen den falschen Teil des Bestands gehalten. Ein zweiter Messlauf über dieselben 45 Meldungen hat die neue Achse und drei weitere Änderungen belegt. Detail: [doppelfoerderung.md](docs/architecture/doppelfoerderung.md).

- **Der Zuwendungsempfänger ist jetzt ein Beleg, keine Anzeige** — Namensgleichheit statt Token-Seltenheit (28 von 45 Zeilen, Median 1 Treffer, keine Fehltreffer); löst nur zusammen mit inhaltlicher Nähe ein Urteil aus ([traeger.ts](src/plugins/doppelfoerderung/services/traeger.ts))
- **Teilvorhaben werden zusammengefasst** — 45 Prüfungen werden 29, und ein Vorhaben über 1,2 Mio € fällt nicht mehr als sechs Zeilen à 200.000 € unter die Betragsschwelle ([liste-lesen.ts](src/plugins/doppelfoerderung/services/liste-lesen.ts))
- **„nicht beurteilbar" als eigenes Urteil**, wenn kein Schlagwort im Bestand vorkam — fünf Meldungen der Liste gaben sonst ein Nein aus, das keine Prüfung hinter sich hatte ([abgleich.ts](src/plugins/doppelfoerderung/services/abgleich.ts))
- **Schlagworte über 2 % des Bereichs zählen nicht mehr zur Abdeckung** und der Prompt verlangt drei verschiedene Achsen (Verfahren/Gegenstand/Anwendung) statt drei Wörtern ([schlagworte.ts](src/plugins/doppelfoerderung/services/schlagworte.ts))
- **Ohne erreichbare KI bleibt die Seite benutzbar**: alle Meldungen bekommen ihre Karte, Schlagworte lassen sich von Hand eintragen ([ErgebnisTabelle.tsx](src/plugins/doppelfoerderung/components/ErgebnisTabelle.tsx))

### v6.23.0 — Doppelförderung: an einer echten Liste kalibriert (August 2026)

MINOR — Alle 45 Meldungen über der Betragsschwelle aus der 72er-Beispielliste einmal durch den echten Suchpfad gefahren, mit von Hand formulierten Schlagworten (die interne KI war nicht erreichbar). Der Lauf hat zwei Zahlen widerlegt, die bisher geschätzt waren. Detail: [doppelfoerderung.md](docs/architecture/doppelfoerderung.md).

- **Die Ähnlichkeitsschwelle lag über dem gesamten beobachteten Wertebereich** — höchster Wert der Liste 0,621, Schwelle 0,75: die Stufe lief und trug zu keinem Urteil bei. Jetzt 0,52, mit der Messtabelle am Wert ([abgleich.ts](src/plugins/doppelfoerderung/services/abgleich.ts))
- **Sieben nachgemessene Sammelbegriffe im Prompt-Verbot** — Automatisierung trifft 852 von 4.327 Vorhaben, Maschinenbau 672, Medizintechnik 353 ([schlagworte.ts](src/plugins/doppelfoerderung/services/schlagworte.ts))
- **Schlagworte ab 1 % des Bereichs tragen die Marke „zu weit"**: das Urteil zählt Schlagworte, es wiegt sie nicht — ohne die Marke liest sich eine Übereinstimmung, die allein an „Automatisierung" hängt, wie ein Fund ([ErgebnisTabelle.tsx](src/plugins/doppelfoerderung/components/ErgebnisTabelle.tsx))
- **Regler „3 von 3" ist an echten Listen leer** (0 von 45 Meldungen) — die Reglerhilfe sagt das jetzt, statt Schärfe zu versprechen ([DoppelfoerderungSeite.tsx](src/plugins/doppelfoerderung/DoppelfoerderungSeite.tsx))
- **Laufzeit gemessen statt geschätzt**: 145 ms je Zeile für beide Stufen, 6,5 s für die ganze Liste — die Wartezeit liegt vollständig beim KI-Lauf

### v6.22.0 — Der Vollbau überlebt einen Seiten-Neustart (August 2026)

MINOR — Der gemeldete Fehlertext war eine nackte Zahl (`12851960`) — ein roher Emscripten-Abbruch. Damit war klar, warum der Ausweich-Pfad aus v6.20 nicht greifen kann: WebGPU- und CPU-Provider liegen in EINEM WASM-Modul, das ORT global hält. Ist es tot, ist es in dieser Seite tot. Nur ein frischer Seitenkontext hilft. Detail: [auslastung.md](docs/architecture/auslastung.md).

- **Der Bau merkt sich, was offen ist, lädt die Seite neu und macht weiter** — angekündigt, abbrechbar, mit erhaltenen Vektoren ([korpus-fortsetzung.ts](src/plugins/auslastung/services/matching/korpus-fortsetzung.ts))
- **Die Restliste steht explizit im Merker**, nicht als Position: ein abgebrochener Vollbau im gleichen Vektorraum hinterlässt sonst einen Zustand, in dem „nichts offen" ist ([embedding-corpus.ts](src/plugins/auslastung/services/matching/embedding-corpus.ts) — neue Option `nurDiese`)
- **Zwei Bremsen gegen die Endlosschleife**: Obergrenze 30 Neustarts, und eine Runde ohne einen einzigen neuen Vektor beendet den Bau
- **Auch die Verbund-Phase wird fortgesetzt** — sie kommt nach den Vorhaben und kann selbst scheitern ([useKorpusBau.ts](src/plugins/kuration/suche-index/hooks/useKorpusBau.ts))

### v6.21.0 — Doppelförderung: gemeldete Vorhaben gegen den Bestand halten (August 2026)

MINOR — Zweimal im Monat kommt eine Ressort-Liste gemeldeter Forschungsvorhaben, die von Hand gegen den ZIM-Bestand gehalten wurde. Die Anforderung nennt „drei Schlagworte, ODER-verknüpft" — in der App am echten Bestand gemessen trifft ein weites Trio damit 1.150 von 4.327 Vorhaben, also ein Viertel des Bereichs: als Warnung wertlos. Deshalb trägt jeder Treffer seine Abdeckung, und das Urteil hängt an einer Schwelle. Detail: [doppelfoerderung.md](docs/architecture/doppelfoerderung.md).

- **Neue Seite hinter dem ⋯-Menü der Suchseite**: XLSX aufnehmen, je Zeile drei Schlagworte von der internen KI, Wortlaut- + Ähnlichkeitsstufe, Urteil je Zeile mit Titel und Kurzbeschreibung der Treffer ([doppelfoerderung/](src/plugins/doppelfoerderung/), [SuchAktionenMenu.tsx](src/plugins/suche/SuchAktionenMenu.tsx))
- **Urteil ab 2 von 3 Schlagworten**, Regler auf 1 (das wörtliche ODER) oder 3; die Trefferliste nennt ihre Gesamtzahl, statt still zu schneiden ([abgleich.ts](src/plugins/doppelfoerderung/services/abgleich.ts))
- **Betrachtungsbereich als drei abschaltbare Achsen** — 4.327 von 14.225 Anträgen; abgelehnte über `isAbgelehntZurueckgezogenStatus`, denn die Kategorie `abgelehnt` ist unbesetzt und ein Vergleich gegen sie liefe still ins Leere ([bereich.ts](src/plugins/doppelfoerderung/services/bereich.ts))
- **Ein Schlagwort bleibt eine Einheit**: bei der Messung fiel auf, dass „Mobile Fabrik" ODER-verknüpft in seine Wörter zerfiel und 535 statt 2 Vorhaben traf — Test einmal ROT gesehen ([abgleich.test.ts](src/plugins/doppelfoerderung/__tests__/abgleich.test.ts))
- **Beträge werden nicht geraten**: `1.850` und `899650.65` lesen den Punkt verschieden; unlesbare Zellen fallen nicht still unter die Schwelle, sondern in eine sichtbare Gruppe ([liste-lesen.ts](src/plugins/doppelfoerderung/services/liste-lesen.ts))

### v6.20.1 — Jede Einbettung gibt ihre Grafikpuffer zurück (August 2026)

PATCH — Der Nutzer maß mit: 12 GB Grafikspeicher, Verbrauch schwankend zwischen 2,6 und 3,3 GB — also **kein** Speichermangel, und Position 808 der Queue hat 17 Zeichen, ist also auch kein Ausreißer. Der Sägezahn war die Spur: die `Tensor`-Objekte aus Transformers.js halten je einen GPU-Puffer, der erst beim nächsten JS-GC frei wird. `dispose()` gab es die ganze Zeit — gerufen wurde es nur beim Entladen des Modells, einmal statt 14.221-mal.

- **Jede Einbettung gibt ihre Ein- und Ausgabe-Tensoren zurück**, auch wenn die Auswertung wirft ([embedding-service.ts](src/core/services/search/embedding-service.ts))
- **Der Fehlertext eines gescheiterten Nachladens steht jetzt in der Karte** — ohne ihn war die Ferndiagnose auf halbem Weg zu Ende ([EmbeddingKorpusSection.tsx](src/plugins/kuration/suche-index/sections/EmbeddingKorpusSection.tsx))
- Test einmal ROT gesehen: ohne die Freigabe fallen 3 von 4 Prüfungen ([embedding-tensor-freigabe.test.ts](src/core/services/search/__tests__/embedding-tensor-freigabe.test.ts))

### v6.20.0 — Ein gescheiterter Rettungsversuch sagt es — und weicht aus (August 2026)

MINOR — Ein gemeldeter Abbruch (807 Vektoren, 20 fehlgeschlagen) ließ sich nicht ferndiagnostizieren: die Karte sagt nichts darüber, ob eine Erholung überhaupt versucht wurde, und v6.18 ging ohne eigenen Versionsbump raus — „v6.19.0" beschrieb damit zwei verschiedene Stände. Beides ist hier behoben. Detail: [auslastung.md](docs/architecture/auslastung.md).

- **Scheitert das Neuladen auf der Grafikkarte, wird sofort der Hauptprozessor versucht** — ONNX hält seine WebGPU-Umgebung global; ist die zerlegt, entsteht dort auch keine frische Session mehr, und die Erholung war genau im Ernstfall wirkungslos ([erholung.ts](src/core/services/embedding-corpus/erholung.ts))
- **Ein gescheiterter Rettungsversuch steht im Protokoll und in der Karte** — sonst ist „es wurde nichts versucht" von „der Versuch misslang" nicht zu unterscheiden ([EmbeddingKorpusSection.tsx](src/plugins/kuration/suche-index/sections/EmbeddingKorpusSection.tsx))
- **Eigene Versionsnummer**, damit ein gemeldeter Stand wieder eindeutig ist

### v6.19.0 — Die Startseite zeigt, was sie kann — und das Untermenue rueckt an (August 2026)

MINOR — `reconcileVerfuegbareWidgets` zieht neue Widgets bewusst als Opt-in nach — wer nie ins Untermenü sah, fand „Fristen“ oder „Änderungen der letzten Nacht“ nie. Sieben Karten erscheinen jetzt einmalig von selbst; ein Ausblenden hält danach. Detail: [home-widgets.md](docs/architecture/home-widgets.md).

- **Config v5 blendet `ENTDECKUNG_WIDGETS` + die Alert-Karte einmalig ein** — nur einblenden, nie ausblenden; Position und Einklapp-Zustand bleiben ([homeWidgetsStore.ts](src/plugins/home/widgets/homeWidgetsStore.ts))
- **Der Versions-Stempel ist das Gedächtnis**: die erste Nutzer-Änderung persistiert v5, ab da hält ein Ausblenden über Neustarts ([useHomeWidgets.ts](src/plugins/home/widgets/useHomeWidgets.ts))
- **`fristen` und `nachtlauf` verlieren ihre Beta-Marke** — sie hätte die Einblendung stillgelegt: Häkchen an, Karte trotzdem verworfen (gemessen 4 von 6 Karten) ([katalog.ts](src/core/sichtbarkeit/katalog.ts))
- **Das Untermenü schließt nicht mehr am Panel-Innenrand** — nur noch echte Zeilen (`data-menue-zeile`) schließen es ([StartseiteMenue.tsx](src/plugins/home/anpassen/StartseiteMenue.tsx), [menueZeilen.tsx](src/plugins/home/anpassen/menueZeilen.tsx))
- **`ABSTAND` 6 → 0**: die Panels berühren sich, die tote Lücke auf dem Weg nach rechts ist weg ([StartseiteMenue.tsx](src/plugins/home/anpassen/StartseiteMenue.tsx))

### v6.18.0 — Der Bau überlebt, wenn die Grafikkarte aufgibt (August 2026)

MINOR — v6.17 hat den Absturz sichtbar gemacht, nicht behoben: der WebGPU-Kontext stirbt beim Vollbau nach ~810 Vektoren (807 beim Nutzer, 827 in der Abnahme), und danach war der Lauf tot — `embedText` kannte keinerlei Erholung. Jetzt lädt er das Modell nach und wechselt notfalls auf den Hauptprozessor. Detail: [auslastung.md](docs/architecture/auslastung.md).

- **Der Lauf überlebt einen Geräteverlust**: Modell nachladen, denselben Datensatz wiederholen, weiterrechnen ([erholung.ts](src/core/services/embedding-corpus/erholung.ts))
- **Die Leiter ist rein, getestet und an gemessenen Zahlen kalibriert**: Grafikkarte 0,067 s je Vektor gegen 2,02 s auf dem Hauptprozessor (Faktor 30, Vollbau dort > 12 h), Ladelauf 38 s — deshalb hält sie an der Grafikkarte fest, solange ein Ladelauf mehr als 25 Vektoren einbringt ([geraet.ts](src/core/services/embedding-corpus/geraet.ts))
- **Zwei Leitplanken gegen eine teure Rettung**: höchstens ein Neuladen je Datensatz, und nur bei einem erkannten Geräteverlust — ein kaputter Datensatz löst keine Ladekette aus ([erholung.test.ts](src/core/services/embedding-corpus/__tests__/erholung.test.ts))
- **Der Wechsel überlebt den Lauf** und gilt für den ganzen Such-Stack, sichtbar in der Karte samt Rückweg „Wieder mit Grafikkarte versuchen" ([EmbeddingKorpusSection.tsx](src/plugins/kuration/suche-index/sections/EmbeddingKorpusSection.tsx), [SucheIndexPanel.tsx](src/plugins/kuration/suche-index/SucheIndexPanel.tsx))
- **Die gemessene Rate trägt ihr Rechenwerk** — eine Messung von der Grafikkarte sagt über einen Lauf auf dem Hauptprozessor nichts, dann steht am Knopf wieder die Anzahl ([korpus-messung.ts](src/plugins/auslastung/services/matching/korpus-messung.ts))

### v6.17.0 — Korpus-Bau: ein Balken, gemessene Restzeit, Fehler die auffallen (August 2026)

MINOR — Gemeldet war ein Fortschrittsbalken, der mehrfach bis 100 % zählt, und eine Restzeit, die 25 Minuten sagte, wo fünf gemessen wurden. Die fünf Minuten waren aber kein schneller Lauf, sondern ein abgestürzter: der WebGPU-Kontext starb nach ~800 Vektoren, und die restlichen 13.418 Fehlschläge verschluckte der Bau einzeln per `console.warn` und meldete „fertig". In der Abnahme auf der Dev-Maschine trat derselbe Fehler auf (`[Device] is lost` nach 827). Detail: [auslastung.md](docs/architecture/auslastung.md).

- **Ein Balken über den ganzen Lauf** statt je Phase von vorne — Vorbereiten, Vorhaben, Verbünde, Centroids, Spiegeln auf einer Skala ([bauFortschritt.ts](src/plugins/kuration/suche-index/hooks/bauFortschritt.ts))
- **Restzeit aus einem gleitenden Fenster** über beide Phasen; die Schätzung am Knopf kommt aus der letzten gemessenen Laufzeit, vorher nennt er nur die Anzahl ([korpus-messung.ts](src/plugins/auslastung/services/matching/korpus-messung.ts), [eta.ts](src/core/utils/eta.ts))
- **Fehler sind keine „übersprungenen"**: getrennte Zähler, Abbruch nach 20 Fehlschlägen in Folge, erster Fehlertext in der Karte — und ein unsauberer Lauf wird weder gestempelt noch gespiegelt ([embedding-corpus.ts](src/plugins/auslastung/services/matching/embedding-corpus.ts), [useKorpusBau.ts](src/plugins/kuration/suche-index/hooks/useKorpusBau.ts))
- **Spiegeln übersteht eine wacklige Strecke**: frischer Verzeichnis-Handle je Versuch, drei Anläufe, 42 MB in Scheiben mit Fortschritt — plus Knopf „Erneut spiegeln", der den fertigen Bau ohne Neurechnung hochlädt ([mirror.ts](src/core/services/embedding-corpus/mirror.ts))
- **Der gelbe Neuaufbau-Hinweis nennt die Lage statt der Projektgeschichte** ([EmbeddingKorpusSection.tsx](src/plugins/kuration/suche-index/sections/EmbeddingKorpusSection.tsx))

### v6.16.0 — Suche & Index: Kartenkopf entquetscht, Vektoren-Karte nach oben (August 2026)

MINOR — Die Karte „Vektoren der Ähnlichkeitssuche" lag so weit unten, dass man zu ihr scrollen musste. Zwei Ursachen: die obere Kartenzeile war doppelt so hoch wie nötig, weil der Kopftext neben einer nicht schrumpfenden Ordner-Steuerung auf 74 px gequetscht war (gemessen bei 233 px Kartenbreite) — und davor stand noch die Karte, die man einmal einstellt und dann nicht wieder anfasst.

- **Der Kartenkopf bricht um, statt den Text zu quetschen** — Textspalte 74 → 203 px, der Worttrennungs-Hinweis 6 → 2 Zeilen, die Rasterzeile 445 → 351 px ([ActionCard.tsx](src/plugins/kuration/suche-index/actions/ActionCard.tsx))
- **„Index aktualisieren" und „Dokumente scannen" nutzen den geteilten Rahmen**, statt ihn samt Defekt zweimal nachzubauen ([ActionCardIndex.tsx](src/plugins/kuration/suche-index/actions/ActionCardIndex.tsx), [ActionCardDocuments.tsx](src/plugins/kuration/suche-index/actions/ActionCardDocuments.tsx))
- **Die Vektoren stehen direkt unter „Index pflegen"**, die Dokumentenquellen dahinter; „Selten gebraucht" bleibt unten ([SucheIndexPanel.tsx](src/plugins/kuration/suche-index/SucheIndexPanel.tsx))
- **Die Hub-Suche listet ihre Treffer wieder in Sichtreihenfolge** ([kurationPanels.tsx](src/plugins/kuration/kurationPanels.tsx))
- **Der Ordnername wird abgeschnitten statt über die Kartenkante geschoben** — wie es die Schwesterkarte längst tut ([ActionCardIndex.tsx](src/plugins/kuration/suche-index/actions/ActionCardIndex.tsx))

### v6.15.0 — Was der Messlauf fand, ist repariert: sechs Befunde an der Gutachten-Kette (August 2026)

MINOR — Der Messlauf aus v6.14.0 fand sechs Befunde an der Gutachten-Kette; vier davon waren Vorgaben-Defekte, die über alle vier gemessenen Modelle hinweg gleich ausfielen. Alle sechs sind repariert, die fachlichen Entscheidungen (C auf fünf Risiken, A einheitlich 9–11 Sätze, Vorgaben für E und F) traf der Nutzer. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md), Bericht: [gutachten-modellvergleich-2026-08.md](docs/_archiv/gutachten-modellvergleich-2026-08.md).

- **Der Feinschliff verwirft sich, wenn er eine erfüllte Vorgabe bräche** — gemessen an Abschnitt G, wo der Lektor den Pflicht-Anfang wegformulierte ([lektorat.ts](src/plugins/antraege/gutachten/lektorat.ts))
- **Ein automatischer Korrektur-Versuch je Abschnitt**: der beschränkte Auto-Retry gab es seit v4.124, eingeschaltet war er an keinem Schritt ([seed.ts](src/core/services/skills/registry/seed.ts))
- **Abschnitt C nennt fünf statt drei Risiken**, damit Deckel und Wortzahl nicht länger gegeneinander stehen; **Abschnitt A** nennt die Satzzahl nur noch in der Vorgabe, dort und in den Modifiern 9–11 ([migrations.ts](src/core/services/skills/registry/migrations.ts))
- **E und F prüfen erstmals mehr als die Interpunktion** — Wort-Boden, Satzlänge, keine Aufzählungen; die Skill-Liste zählt jetzt alle Regeln, die wirklich prüfen ([SkillsTab.tsx](src/plugins/skill-verwaltung-kuration/SkillsTab.tsx))
- **Liegt eine Vorhabensbeschreibung als DOCX und als PDF vor, gilt die DOCX** — die PDF-Fassung verliert im Konverter jede Überschrift ([vbDokument.ts](src/plugins/antraege/kurzfassung/vbDokument.ts))

### v6.14.2 — Die Verbindungs-Pille der internen KI verfaellt nicht mehr nach fuenf Sekunden (August 2026)

PATCH — Bei der Messreihe zu v6.14.1 lief ein echter Frage-Lauf durch, während die Status-Karte in den Einstellungen „Nicht verbunden" behauptete. Sie las allein `testErgebnis` — und das räumt sich fünf Sekunden nach dem Test selbst weg. Zehn andere Stellen lasen `useBridgeStatus` längst; diese eine blieb beim Nachzug übrig (in [AiAssistantCard](src/plugins/home/AiAssistantCard.tsx) war derselbe Fall schon einmal behoben).

- **Die Karte liest den lebenden Bridge-Status**, das Test-Echo ergänzt ihn nur ([verbindungsAnzeige.ts](src/plugins/einstellungen/ki/verbindungsAnzeige.ts), neu — eigene reine Datei, weil sich die Entscheidung in der `.tsx` nicht festnageln ließ)
- **Ein alter Fehlversuch widerspricht keiner lebenden Bridge mehr**: „Nicht erreichbar" gilt nur, solange nichts verbunden ist ([VerbindungGruppe.tsx](src/plugins/einstellungen/ki/VerbindungGruppe.tsx))
- **Dreiwertig in der Farbe, zweiwertig im Wort** — grün / amber getrennt / grau `unknown`, genau wie im [BridgeStatusIndicator](src/components/ui/BridgeStatusIndicator.tsx), der einzigen anderen Stelle, die den Zustand anzeigt statt ihn zu einem Ja/Nein zu verrechnen

### v6.14.1 — Die Frage-Suche erfindet keinen Bearbeitungsstand mehr (August 2026)

PATCH — Erste Reproduzierbarkeits-Messung des Frage-Modus: je Frage **drei** Runden statt einer (24 Läufe, 0 Konsolenfehler). Befund: die Suche selbst ist stabil (Bayern/Leichtbau lieferte roh 82 in allen Runden) — was streute, war eine **erfundene Status-Facette** auf Fragen, die keinen Bearbeitungsstand nennen. Sie schnitt die 82 still auf 11 und auf 0.

- **`status` bekommt sein „im Zweifel weglassen"** — das trugen die Nachbarregeln `feld` und `bereich` längst, ausgerechnet diese nicht ([frageplan.ts](src/core/services/search/frageplan.ts))
- **Streuung über drei Runden: Bayern/Leichtbau 122 % → 0 %, Sensorik/Sachsen 55 % → 0 %, Robotik 164 % → 0 %**; „Photonik in Sachsen" von dreimal null auf fünf Treffer ([suche-relevanz.md §8.5](docs/architecture/suche-relevanz.md))
- **Verworfen und dokumentiert**: die Stamm-Regel unbedingt zu stellen („gib IMMER beides") stabilisierte zwei Fragen, zerlegte dafür „Batterierecycling" an der Fuge zu `batterie` — 788 bzw. 227 statt 3 Treffer, auch mit ausdrücklicher Gegengrenze im Prompt ([frageplan.test.ts](src/core/services/search/__tests__/frageplan.test.ts))

### v6.14.0 — Variante local-fiktiv: Gutachten-Abschnitte gegen die interne KI messen (August 2026)

MINOR — Seit dem Tunnel ist die interne KI von hier aus erreichbar; gemessen wurde sie an den Gutachten-Abschnitten trotzdem nie. Dafür fehlte eine Umgebung mit fiktiven Anträgen, die den echten Bestand nicht anfasst.

- **Variante `local-fiktiv`** (`npm run dev:fiktiv`, Port 5176): eigene IDB `teamflow-zah-local-fiktiv` + eigene Datenwurzel, ausschließlich fiktive Anträge ([configs/local-fiktiv.config.json](configs/local-fiktiv.config.json))
- **Referenzlauf gegen Claude** über das vorhandene Skill-Eval-Harness — dieselbe kuratierte Registry, dieselben Prompts; die Modell-Configs bleiben wie alle `eval/models*.json` lokal ([skill-eval/README.md](src/core/services/skill-eval/README.md))
- **Befund-Bericht des ersten Messlaufs A–G**: zwei harte Regelverstöße der internen KI, vier modellunabhängige Prompt-Defekte ([gutachten-modellvergleich-2026-08.md](docs/_archiv/gutachten-modellvergleich-2026-08.md))
- **Die Varianten-Matrix des Registry-Zugangs** kennt `local-fiktiv` (globbt `configs/*.config.json`, hätte sonst rot gemeldet) ([registry-zugang.test.ts](src/config/__tests__/registry-zugang.test.ts))
- **Fiktive Synthese-Anträge + Fachbereichs-Zuarbeiten ignoriert** — ~6 MB DOCX/PDF, kein Repo-Inhalt ([.gitignore](.gitignore))

### v6.13.0 — Eine uebernommene Anfrage ist keine Frage — und das Kurzprofil wird kompakter (August 2026)

MINOR — Zwei Meldungen aus der Abnahme: das Kurzprofil des Antragstellers (v6.10) stapelte Kurzname über Aktenzeichen und kostete 44 px je Antrag, und ein Wert aus „Top Ten" strandete im Frage-Modus im Hinweis „Noch nicht gestellt" — ausgerechnet dort, wo gerade noch „305 Treffer" danebenstand.

- **Eine Zeile je Antrag statt zwei** im Kurzprofil (30,5 px statt 44): Kurzname und Aktenzeichen nebeneinander, der nur bei Berührung sichtbare Chevron entfällt ([AntragstellerProfilHover.tsx](src/plugins/antraege/AntragstellerProfilHover.tsx))
- **Von 6.646 Kurznamen sind 51 breiter als der verbleibende Platz**; die Marke „dieser Verbund" kürzt nie mit — sie trifft ohnehin nur 232 Zeilen im Bestand ([AntragstellerProfilHover.tsx](src/plugins/antraege/AntragstellerProfilHover.tsx))
- **`starteSuche` stellt die Suchart auf Stichworte zurück** — Top Ten, Suchsprache, gemerkte Suche und Treffertitel liefern nie eine Frage ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Der Verlauf behält den Frage-Modus, außer bei einem Feldpräfix**: `ast:"EurA AG"` läuft als Suche, ein ganzer Satz geht weiter an die KI ([hatFeldPraefix](src/core/services/search/feldpraefix.ts))
- **Schwelle `MAX_FILE_LOC` 1220 → 1235** (Ist 1223, SuchSeite.tsx) ([health-baseline.test.ts](src/__tests__/health-baseline.test.ts))

### v6.12.1 — Der Dev-Server ueberlebt einen Test-Gate-Loop (August 2026)

PATCH — Bei der Abnahme der Frage-Suche (v6.12.0) riss der Dev-Server im Sekundentakt jede laufende Messung ab: eine gespeicherte `*.test.ts` hängt nicht im Modulgraph der App und löst darum keinen HMR-Austausch aus, sondern einen Vollreload. Ein Gate-Loop nebenan genügt.

- **`**/__tests__/**` steht in `server.watch.ignored`** — alle 773 Testdateien liegen dort, keine wird vom Dev-Server je gerendert; Vitest hat seinen eigenen Watcher ([vite.config.ts](vite.config.ts))

### v6.12.0 — Frage-Suche am echten Bestand abgenommen: zwei Beispielfragen lieferten null (August 2026)

MINOR — Der Frage-Modus war gebaut, aber nie gegen den Bestand abgenommen — die Zahlen im Doc stammten aus der Entwurfszeit. Erster voller Lauf über alle acht Beispielfragen (je zwei Runden gegen die interne KI, 14.225 Anträge): **zwei lieferten null Treffer**, eine dritte schwankte bei identischem Text zwischen 176 und 550. Kein Fehlgriff lag in der Mechanik, alle im Prompt.

- **Die Feldliste nennt ihre Bezeichnungen** (`ort (Ort) · bl (Bundesland)`) wie die Nachbarlisten längst — „Sachsen" landete in vier von fünf Ortsfragen im Ortsfeld (7 Anträge statt 2.742) ([frageplan.ts](src/core/services/search/frageplan.ts))
- **Nadel-Regeln mit ihrer Messung im Prompt**: kürzester Stamm statt Beugungsform, aber kein Grundwort (`technologie` = 8.075 von 14.225); vier tote Normen-Beispiele entfernt, die der Prompt selbst lehrte ([suche-relevanz.md §8.0](docs/architecture/suche-relevanz.md))
- **„nicht berücksichtigt" meldet keine Nicht-Verluste mehr** — weder Sätze über Frageworte noch Achsen, die der Plan gesetzt hat; Prompt-Zeile geteilt mit dem [Antragsplan](src/plugins/antraege/frage/antragsplan.ts) ([§8.2](docs/architecture/suche-relevanz.md))
- **Der Befund nennt die Einschränkung und rechnet das Jahr wie die Facette** — zwei Definitionen derselben Achse standen auf einem Bildschirm ([frageBefund.ts](src/plugins/suche/frageBefund.ts), [§8.3](docs/architecture/suche-relevanz.md))
- **Guard misst jetzt Ertrag statt Zeichenlänge**: der alte prüfte, ob die Normen-Beispiele lang genug sind — vier von sechs fanden nichts ([frageplan.test.ts](src/core/services/search/__tests__/frageplan.test.ts))

### v6.11.0 — Suche: Startzustand beim Betreten, Reiter Top Ten mit Stichwoertern und Themen (August 2026)

MINOR — Gemeldet: „wenn die suchseite aufgerufen wird soll nicht der letzte suchterm im suchfeld stehen, da dann die startseite der suche nicht mehr zu sehen ist." Dazu: „stöbern" umbenennen, auf zehn Werte erweitern — und zwei Achsen ergänzen, die der Bestand längst hergab, aber keine Oberfläche zeigte.

- **Die Anfrage überlebt genau EINEN Sprung** — den in eine Detailseite und zurück; jeder andere Weg zur Suche beginnt im Startzustand ([useFrischerStart.ts](src/plugins/suche/useFrischerStart.ts), Regel rein in [sitzungsAnfrage.ts](src/plugins/suche/sitzungsAnfrage.ts))
- **Reiter „Stöbern" heißt „Top Ten"** und zeigt je Achse zehn Werte plus „+10 weitere" ([stoebern.ts](src/plugins/suche/start/stoebern.ts), [StartStoebern.tsx](src/plugins/suche/start/StartStoebern.tsx))
- **Neue Achse „Stichwörter"**: die häufigsten Wörter aus VB-/TV-Titel und Kurzbeschreibung, dreifach gefiltert (Großschreibung · Funktionswörter · Füllwörter der Förderdomäne) — 587 ms im Korpus-Walk ([wort-index.ts](src/plugins/antraege/services/wort-index.ts))
- **Neue Achse „Themen"**: die 21 Zukunftstechnologien, aus dem Deskriptoren-Topf herausgenommen statt danebengestellt ([descriptor-text.ts](src/plugins/antraege/services/descriptor-text.ts) `istZukunftsthema`)
- **Zwei Maße, zwei Wörter**: Feldwerte tragen ihre Trefferzahl, Stichwörter „903 Vorhaben" — sonst liefe die sortierte Liste sichtbar durcheinander (gemessen 530 über 2.711)

### v6.10.0 — Kurzprofil des Antragstellers am Teilvorhaben (August 2026)

MINOR — Gewünscht: „so weiss der bearbeiter was es noch von diesem Antragsteller gibt und kann etwaige Auffälligkeiten sehen." Die Teilvorhaben-Zeile nannte nur den Namen — dabei haben **9.477 von 12.358 Teilvorhaben (77 %)** einen Antragsteller mit weiteren Anträgen, und **69 %** dieser Antragsteller tragen mindestens eine Ablehnung. Der Bestand gab die Antwort längst her, die Oberfläche stellte die Frage nie.

- **Hover-Karte am Antragsteller-Namen** mit allen weiteren Anträgen derselben Organisation, jüngster zuerst, Zeile klickbar ([AntragstellerProfilHover.tsx](src/plugins/antraege/AntragstellerProfilHover.tsx))
- **Bilanz aus fünf disjunkten Töpfen**; `abgelehnt/zurückgezogen` zählt eigens statt unter `abgeschlossen` zu verschwinden ([antragstellerProfil.ts](src/plugins/antraege/antragstellerProfil.ts))
- **Abgleich auf dem Feld, das die Zeile anzeigt** (`antragsteller`), ohne Rechtsform-Faltung — gemessen fällt von 4.916 Namen keiner mit einem anderen zusammen, „Müller GmbH" ≠ „Müller AG"
- **Über den Betrachtungsbereich hinaus**, und die Karte sagt das an ihrem Fuß (Pitfall #46: Evidenz folgt dem Bereich nicht)
- Abnahme in `dev:local` gegen den Nachtexport: AIWOOD zeigt für beide Partner exakt die vorausberechneten Listen (2 bzw. 5 Einträge inkl. Widerruf), Stressfall 265 Zeilen scrollt, 0 Konsolenfehler

### v6.9.7 — Nach einem Reload des App-Tabs findet die App den lebenden KI-Tab wieder (August 2026)

PATCH — Dritte Ursache derselben Meldung, jetzt mit dem fehlenden Auslöser: „wenn ich einen Browser-Refresh mache, kommt der Dialog wieder". Der Griff auf den KI-Tab lebt nur im Speicher der Seite, und das Bookmarklet meldet sich nur **einmal** — beim Aktivieren. Ein F5 löschte damit den einzigen Zeiger auf eine weiterlaufende Bridge.

- **Der Transport sucht den überlebenden KI-Tab einmal je Seitenladung** (`findeKiFensterWieder`, [connect-ki.ts](src/core/services/ai/connect-ki.ts))
- **`window.open` mit leerer url findet, ohne zu navigieren** — ein Reload des Tabs löschte das injizierte Bookmarklet und wäre keine Wiederaufnahme, sondern ein Verlust
- **Treffer nur bei fremder Origin**: ein lesbares `about:blank` ist ein selbst erzeugter Leer-Tab und wird geschlossen, nie übernommen
- **Der Umweg über die Pille im KI-Tab entfällt** — sie war bisher der einzige Rückweg, weil sie von sich aus sendet ([ki-bridge.md](docs/architecture/ki-bridge.md))
- A/B in der laufenden App gegen die interne KI: nach F5 ohne den Fix „Interne KI nicht verbunden" bei lebendem Tab, mit ihm „Interne KI verbunden", 0 Konsolenfehler

### v6.9.6 — Der Heartbeat probte im Stoerfall alle 3 s statt alle 15 (August 2026)

PATCH — Nachlese zu v6.9.5: der Takt des Erreichbarkeits-Pollers zählte Ticks statt Zeit, und der Zähler lief erst **hinter** dem `await` der Probe hoch. Solange eine Probe lief (bis 5 s), sahen die folgenden 3-Sekunden-Ticks denselben Stand und starteten jeweils eine weitere — ausgerechnet bei klemmender Bridge probte die App alle 3 s statt alle 15.

- **Takt hängt an der Uhr**, nicht an der Zahl der Ticks; eine laufende Probe sperrt sich selbst ([useBridgeHeartbeat.ts](src/core/hooks/useBridgeHeartbeat.ts))
- **Re-Fokus probt jetzt wirklich sofort** — die Zusage der Datei traf vorher nur zu, wenn der Tick-Zähler zufällig durch 5 teilbar war, also in einem von fünf Fällen
- **Die Entscheidung ist pur** (`probeIstFaellig`) und damit testbar, obwohl das Projekt keine Komponenten rendert; der Hook bleibt reine Anbindung
- **Halbe Tick-Breite Nachsicht auf die Frist**: ohne sie kam die Probe systematisch einen Takt zu spät (live gemessen: durchgehend 18 s statt 15 s)
- Live nachgemessen in `dev:local` gegen die interne KI: Abstände 15012 / 14988 ms, eine Probe je Fenster, 0 Konsolenfehler

### v6.9.5 — Der Verbinden-Dialog stand vor einer lebenden KI (August 2026)

PATCH — Gemeldet als „das Fenster kommt öfters, obwohl die KI verbunden ist". Zwei unabhängige Ursachen, beide in der laufenden App gemessen: grüner Statuspunkt „Interne KI verbunden" und gleichzeitig ein offener Dialog „Interne KI nicht verbunden". Der Handgriff des Nutzers im KI-Tab war nie ein Neuverbinden — er machte nur den Status wieder ehrlich.

- **Der Dialog überlebte seine eigene Bedingung**: nichts schloss ihn, wenn die Bridge zurückkam — obwohl sein Text genau damit rechnet; jetzt entscheidet die pure `promptDarfSchliessen` ([ki-guard.ts](src/core/services/ai/ki-guard.ts))
- **Gleichzeitige Ping-Proben verdrängten einander**: alle lagen unter dem festen Schlüssel `'ping'` auf EINEM Platz, der verwaiste Timeout der älteren räumte den der jüngeren weg ([streamlit.ts](src/core/services/ai/transports/streamlit.ts))
- **Ein `tf-pong` beantwortet jetzt ALLE offenen Proben** — es trägt keine id, das Bookmarklet antwortet unadressiert; Protokoll und Lesezeichen bleiben unverändert
- **Der Bridge-Status schließt keinen fremden Dialog**: bei aktivem direktem Server sagt ein offener KI-Tab nichts über dessen Erreichbarkeit aus
- Abgenommen in `dev:local` gegen die echte interne KI über den Tunnel: Dialog verschwindet beim Verbinden, echter Ping/Pong löst weiterhin auf, 0 Konsolenfehler

### v6.9.4 — die Bridge laesst sich vom Agenten selbst einsetzen (August 2026)

PATCH — v6.9.3 erklärte den Klick aufs Lesezeichen zur Grenze der Automatisierung. Das war zu früh aufgegeben: der KI-Tab landet in derselben steuerbaren Tab-Gruppe, und die beiden Tabs können sich den Snippet-Text browserintern zureichen. Ein vollständiger Lauf ist durch. Detail: [ki-tunnel-dev.md](docs/architecture/ki-tunnel-dev.md).

- **Lesezeichen nachschießen statt anklicken**: App-Tab gibt den Snippet auf `postMessage` heraus, KI-Tab führt ihn aus — 49.675 Zeichen, nie durch den Agenten ([ki-tunnel-dev.md](docs/architecture/ki-tunnel-dev.md))
- **Nur noch ein Handgriff**: das erstmalige Öffnen des KI-Tabs braucht eine echte Geste; ein Reload danach ist wieder automatisch reparierbar
- **Vollständiger Lauf belegt**: App-Tab → postMessage → KI-Tab → `/send` + SSE → Tunnel → VPN → interne KI → zurück, 0 Konsolenfehler
- **Werkzeug-Vergleich als Tabelle**: die Browser-Pane scheidet aus (`window.open` → `null`, `fetch` → `ERR_BLOCKED_BY_CLIENT`), die Chrome-Anbindung trägt
- **Zwei Fallen notiert**: Klappen-Zustand prüfen statt toggeln, und ein Gutachten-Abschnitt braucht erst eine Vorhabensbeschreibung

### v6.9.3 — der Tunnel zur internen KI ist gemessen, nicht nur beschrieben (August 2026)

PATCH — v6.9.2 beschrieb den Weg, ohne ihn gegangen zu sein. Er ist jetzt eingerichtet und Ende zu Ende gemessen: `curl` mit voller Zertifikatsprüfung liefert HTTP 200, und die echte KI-Oberfläche lädt im Browser dieser Maschine. Zwei Dinge kamen dabei ans Licht, die vorher niemand wissen konnte. Detail: [ki-tunnel-dev.md](docs/architecture/ki-tunnel-dev.md).

- **Firmen-CA als eigener Einrichtungsschritt**: die interne KI hängt an `vdivde-it-CA`, nicht an einer öffentlichen Stelle — samt Prüfung der Kette **vor** dem Vertrauen ([ki-tunnel-dev.md](docs/architecture/ki-tunnel-dev.md))
- **Passwort-Anmeldung braucht ZWEI Direktiven**: `PasswordAuthentication no` allein lässt `keyboard-interactive` offen, das Windows ebenfalls mit dem Konto-Passwort bedient
- **Messergebnisse statt Annahmen** im Stand-Abschnitt: TCP-Weg, Weiterleitung, TLS-Zeiten, alle Bridge-Anker der echten Seite; Chromium liest die hosts-Datei, Secure DNS läuft nicht daran vorbei
- **Grenze der Automatisierung benannt und begründet**: der Klick aufs Lesezeichen bleibt Handarbeit — Pane und Chrome-Anbindung erreichen den Popup-Tab nicht
- **Drei Fallstricke im Fehlersuch-Register**: Host-Schlüssel-Warnung nach frischer Installation, `sshd` startet nach Reboot nicht von selbst, `CRYPT_E_REVOCATION_OFFLINE` ist erwartetes Verhalten

### v6.9.2 — der Zugang zur internen KI ist ein Netzweg, keine zweite Bridge (August 2026)

PATCH — Alles, was die interne KI braucht, war von der Dev-Maschine aus gar nicht prüfbar: `gpt.vdivde-it.de` liegt hinter dem VPN, und das hat nur der Firmenlaptop. Die Bridge ist aber längst eine Zwei-Tab-Konstruktion, und Tab eins liefert `dev:local` — es fehlte allein die Erreichbarkeit des Hosts. Gebraucht wurde also ein Netzweg, kein Protokoll. Detail: [ki-tunnel-dev.md](docs/architecture/ki-tunnel-dev.md).

- **Runbook für den SSH-Tunnel über den Firmenlaptop** — Einrichtung, Abnahme in vier Stufen, Fehlersuche ([ki-tunnel-dev.md](docs/architecture/ki-tunnel-dev.md))
- **Starter für den Laptop**, ausgehend und ohne Admin-Rechte; leitet genau einen Host auf einem Port weiter ([laptop-tunnel.cmd](scripts/ki-tunnel/laptop-tunnel.cmd))
- **Kein Produktivcode angefasst**: die App behält ihren Vorgabe-Endpunkt, TLS bleibt Ende-zu-Ende, die Origin bleibt produktionsgleich
- **`*.cmd` erzwingt CRLF** ([.gitattributes](.gitattributes)) — die Regel galt bisher nur für `*.bat`
- **Die Abnahme-Trennlinie zieht nach**: KI-Läufe gehören jetzt auf die Agenten-Seite ([local-variante.md](docs/architecture/local-variante.md), [ki-bridge.md](docs/architecture/ki-bridge.md))

### v6.9.1 — Nachtlauf-Trennlinie so leise wie in Meine Antraege (August 2026)

PATCH — Die Verbund-Trennlinie las sich kräftiger als die Zeilentrenner in „Meine Anträge" — zwei Karten untereinander auf derselben Seite. Nicht die Stärke war der Unterschied (beide 0,5 px), sondern die Farbe: die dichte Listenzeile dämpft `--tf-border` auf 45 %. Detail: [home-widgets.md](docs/architecture/home-widgets.md).

- **Die gedämpfte Trennfarbe bekommt einen Ort**: `TRENNLINIE_GEDAEMPFT` aus [ListItem.tsx](src/components/ui/ListItem.tsx) statt einer zweiten, abgeschriebenen Prozentzahl
- **Die Verbund-Linie im Nachtlauf-Widget übernimmt sie** ([NachtlaufWidget.tsx](src/plugins/home/widgets/NachtlaufWidget.tsx))
- **Als Kante statt als 0,5 px hoher Kasten**: einen Kasten dieser Höhe malt der Browser halbdeckend, eine Kante rundet er auf ein Gerätepixel — nachgebaut sahen beide Karten verschieden aus
- **Am echten Bestand nachgemessen**: beide Linien jetzt `1px` / `rgb(0 0 0 / 0.035)`, Zeilenhöhe unverändert 16,00 px, 0 Konsolenfehler

### v6.9.0 — Feinschliff nur bei frischer Generierung; beide Prompts sichtbar (August 2026)

MINOR — Nach „Kürzer" stand im KI-Fenster der Lektor-Prompt: die Kette hängte an JEDE Generierung den Feinschliff, und weil jeder Lauf einen frischen Chat startet, war vom ersten Prompt nichts mehr zu sehen. Zwei Läufe, von denen der zweite eine bewusste Kürzung wieder glattzieht — und eine Prompt-Ansicht, die nur den ersten kannte. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Feinschliff nur an eine frische Generierung**: `generateInto` reicht bei `istUeberarbeitung(o)` (Modifier oder freie Anweisung) `null` statt des Lektor-Thunks ([workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts))
- **`mitFeinschliff(…, null)` gibt den Stand 1:1 zurück** — ohne `feinschliffUebersprungen`: die Marke heißt „hat nicht getragen", nicht „war nicht geplant" ([workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts))
- **`istUeberarbeitung` trägt beide davon abhängigen Entscheidungen** (Feinschliff-Bein + Ausschluss der Teil-Generierung) statt zweier wortgleicher Bedingungen
- **Das Feinschliff-Bein meldet seinen Prompt** an die Prompt-Ansicht; der Hook hält Generierung/Feinschliff als Slots statt als Liste ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts))
- **Beschriftung je Prompt aus der reinen `beschrifteGesendet`** — Teil-Nummerierung zählt den Feinschliff nicht mit ([promptAnsicht.ts](src/plugins/antraege/gutachten/promptAnsicht.ts), [PromptAnsichtDialog.tsx](src/plugins/antraege/gutachten/PromptAnsichtDialog.tsx))

### v6.8.0 — die Antragsliste zeigt 16 Zeilen statt 10 (August 2026)

MINOR — Die Karte zeigte 10 von 19 Anträgen; der Rest lag unter der Fensterkante. Nicht die Zeilen waren der Hauptposten, sondern die 213,75 px über ihnen — Kopfzeile, Quartals-Balken und Erklärzeile, zusammen fast fünf Zeilen. Werte vorab in einem Prototyp durchgespielt, dann fest eingebaut. Detail: [home-widgets.md](docs/architecture/home-widgets.md).

- **Zeile 44,5 → 30,5 px** über das neue Opt-in `dicht` an [ListItem.tsx](src/components/ui/ListItem.tsx) — kein geänderter Standard, die sechs anderen Aufrufer bleiben unberührt
- **Quartals-Balken von 139,25 auf 104,25 px**: Innenpolster 18 → 12, Abstand darunter 24 → 10, Balken 20 → 16, Zahlenzeile ohne die geerbte 24-px-Zeilenhöhe ([MeineAntraegeBalken.tsx](src/plugins/home/MeineAntraegeBalken.tsx))
- **Kopfzeile aller Haupt-Karten 48 → 40 px**, Kartenfuß 12 → 8 px ([WidgetShell.tsx](src/plugins/home/widgets/WidgetShell.tsx)) — bewusst für alle, eine einzelne flachere Karte läse sich als Fehler
- **Trennlinie via `color-mix` auf 45 % gedämpft** statt fester rgba-Schwarz-Angabe, die im Dunkelmodus unsichtbar wäre ([ListItem.tsx](src/components/ui/ListItem.tsx))
- **Am echten Bestand nachgemessen** (1536 × 960): 16 statt 10 Zeilen ohne Scrollen, Karte 703,75 → 510 px, Startseite 2124 → 1895 px, 0 Konsolenfehler

### v6.7.0 — Der Denkprozess der internen KI ist sichtbar — und das Lesezeichen heisst wieder v2 (August 2026)

MINOR — Der Denkprozess kam die ganze Zeit an und wurde an einer Zeile verworfen: `submitMessage` löst auf einen String auf, und nur der Streaming-Zweig packte `reasoning` aus. Dazu die Lesezeichen-Nummer, die mit internen Bumps davongelaufen war. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md), [ki-bridge.md](docs/architecture/ki-bridge.md).

- **`SubmitMessageOptions.onReasoning`** reicht den Denkprozess durch den Single-Shot-Pfad — einmal am Ende, vor dem `resolve` ([streamlit.ts](src/core/services/ai/transports/streamlit.ts), [run-skill.ts](src/core/services/skills/run/run-skill.ts))
- **Anzeige zieht ins Sichtfeld**: Schalter „Denkprozess" in der Fußzeile der Abschnitts-Karte statt im eingeklappten Kontext-Panel ([AbschnittFuss.tsx](src/plugins/antraege/gutachten/AbschnittFuss.tsx), [KontextPanel.tsx](src/plugins/antraege/gutachten/KontextPanel.tsx))
- **`BRIDGE_VERSION` zurück auf 2**: sie zählt Ausrollungen an das Team, nicht Builds — v3/v4 hat nie jemand in der Hand gehabt ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js))
- **Neuer Guard bindet die Nummer an `changelog-user.md`** (höchste angekündigte Nummer = die richtige) ([snippet-version.test.ts](src/core/services/ai/streamlit-bridge/__tests__/snippet-version.test.ts))
- **Naht-Tests statt Quelltext-Prüfung** für den Denkprozess-Pfad ([streamlit-reasoning.test.ts](src/core/services/ai/__tests__/streamlit-reasoning.test.ts))

**Korrektur an v6.4.0**: der dortige Migrationshinweis nannte `interne-KI v4`. Richtig ist `interne-KI v2` — v6.0 bis v6.6 waren nie freigegeben, für das Team ist es der erste Wechsel seit v1.

