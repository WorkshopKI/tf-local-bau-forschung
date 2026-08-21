# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v5.2.0 — Eigenes Ticket ergaenzen, ohne das Kanban zu verlassen (August 2026)

MINOR — Wer sein eigenes Ticket fortschreiben wollte, öffnete dafür das volle Detail-Panel — oder fand den Weg gar nicht: „Ergänzung anhängen" lag zwei Klicks tief im `⋯`-Menü und hing an `!darfSchreiben`, war also ausgerechnet für jeden unsichtbar, der zugleich verwalten darf. Im Erfassungs-Panel war „Mein Feedback" eine reine Anzeige-Liste ohne jeden Rückkanal.

- **Symbol an der eigenen Karte** öffnet das Schreibfeld direkt im Board — das Detail bleibt zu ([ErgaenzenKnopf.tsx](src/plugins/feedback-board/ticket/ErgaenzenKnopf.tsx))
- **Die Ergänzung gehört dem Ticket, nicht der Rolle**: `istMeins` statt `!darfSchreiben && istMeins` an allen vier Stellen ([TicketMenue.tsx](src/plugins/feedback-board/ticket/TicketMenue.tsx), [VerlaufBlock.tsx](src/plugins/feedback-board/ticket/VerlaufBlock.tsx), [beitragBausteine.ts](src/components/feedback/beitragBausteine.ts))
- **„Mein Feedback" im Erfassungs-Panel kann ergänzen** — Feld klappt unter der Karte auf, `AddCommentResult` wird an Ort und Stelle ausgewertet ([MyFeedbackList.tsx](src/components/feedback/MyFeedbackList.tsx))
- **Ein Schreibfeld für vier Orte** statt vier Kopien; die Menüeinträge nehmen ihre Art mit, statt sie im Label zu verlieren ([FeedbackBeitragFeld.tsx](src/components/feedback/FeedbackBeitragFeld.tsx), [SchnellKommentar.tsx](src/plugins/feedback-board/ticket/SchnellKommentar.tsx))
- **Die Art überlebt die Outbox**: `OutboxComment.kind` — read-only-Nutzer verloren beim Einsammeln genau die Marke, für die dieser Weg gebaut ist ([feedbackCommentOutbox.ts](src/core/services/feedback/feedbackCommentOutbox.ts))

### v5.1.0 — Modellwahl fuer die interne KI mit Auto-Wechsel nach Umfang (August 2026)

MINOR — Die interne KI bietet jetzt drei Modelle zur Wahl. Bisher entschied die Achse `ziel` einen **Tab** (`'standard'`/`'agentisch'`); dieselbe Achse entscheidet jetzt das **Modell**. Der agentische Chat ist Qwen3.6 *plus fest eingebautem Kontext* — den stellt diese App selbst zusammen, also bleibt er stillgelegt, und was von ihm übrig ist, ist genau `'qwen35'`.

- **Eine Achse, umbenannt**: `BridgeZiel = 'gpt-oss' | 'qwen35'`; die Read-Time-Migration bildet `'agentisch'` auf **Qwen3.6** ab, nicht auf gpt-oss — wer das große Fenster gewählt hatte, behält es ([ki-ziel.ts](src/core/services/ai/ki-ziel.ts))
- **Auto-Wechsel nach Umfang**: passt ein Lauf nicht ins gewählte Fenster, hebt ihn die App auf Qwen3.6 — **nur aufwärts, nie abwärts**, und sichtbar gemeldet ([modell-wahl.ts](src/core/services/ai/modell-wahl.ts), [ModellEskalationHinweis.tsx](src/core/components/ModellEskalationHinweis.tsx))
- **Kürzen ist letztes Mittel statt erstem Reflex**: der Zeichen-Cap wird aus dem *gewählten* Modell abgeleitet, nicht umgekehrt ([run-skill.ts](src/core/services/skills/run/run-skill.ts))
- **Modellwahl statt Variantenwahl** in den Einstellungen, mit Fenstergröße am Chip und gesperrtem agentischem Eintrag; beim Verbinden entfällt die Wahl ([KiModellSelector.tsx](src/core/components/KiModellSelector.tsx))
- **Das Lesezeichen heißt `interne-KI v1`** — die Nummer sieht man in der Leiste, ohne zu klicken ([snippet.ts](src/core/services/ai/streamlit-bridge/snippet.ts))

### v5.0.0 — Bridge spricht die neue AitisiGPT-Oberflaeche direkt an (August 2026)

MAJOR — Die interne KI wurde neu gebaut: nicht mehr Streamlit, sondern htmx auf servergerendertem HTML. Die Bridge zielte durchgehend auf Streamlit-`data-testid`-Attribute, von denen kein einziges mehr existiert — Fragen gingen hinaus, **Antworten wurden nicht mehr gelesen**. Belegt an zwei DOM-Dumps vom Produktivsystem. Der Ersatz ist besser als das Original: die neue Oberfläche hat eine HTTP-Schnittstelle und einen SSE-Strom mit `done`-Ereignis.

- **Senden per `POST`, Empfangen per SSE** — die Endpunkte liest das Bookmarklet aus den `hx-post`-Attributen der Seite, statt Routen zu verdrahten; die Sitzung reist als `X-Session-Id` mit ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js))
- **Ersatzlos entfallen**: Echo-Erkennung, Antwort-Auswahl im Nachrichten-Roster, Lauf-Indikator-Polling, Ruhefenster-Heuristik — allesamt Umgehungen eines fehlenden Fertig-Signals, das der Strom jetzt als `done` liefert (`answer-selection.ts` + `echo-match.ts` gelöscht)
- **Modell und Kontextfenster werden von der Seite gelesen**, nicht geraten — Options-Text statt Dateiname, `Qwen3-VL` explizit ausgeschlossen ([modell-erkennung.ts](src/core/services/ai/streamlit-bridge/modell-erkennung.ts))
- **`rev`-Handschlag**: die App erkennt ein veraltetes Lesezeichen und sagt es in den Einstellungen — ein altes Snippet ist nicht mehr harmlos ([snippet.ts](src/core/services/ai/streamlit-bridge/snippet.ts), [VerbindungGruppe.tsx](src/plugins/einstellungen/ki/VerbindungGruppe.tsx))
- Die Datenquellen-Auswahl der Seite wird vor jedem Lauf neutralisiert — unsere Aufträge bringen ihren Kontext vollständig selbst mit

**Migration**: Jeder Nutzer muss das **Lesezeichen neu ziehen** (Einstellungen → KI → Einrichtung) und im KI-Tab einmal anklicken. Bis dahin meldet die App das veraltete Lesezeichen und rechnet konservativ mit dem kleinen Kontextfenster. Kein Daten-Layout und keine IndexedDB-Änderung.

### v4.136.0 — Schweigt der eigene Regelsatz, sagt die Zeile was laeuft (August 2026)

MINOR — Unter „Meine Anträge" stand weiter „Gutachten freigeben", obwohl v4.132 beide Motoren zusammengelegt hatte. Grund: in der **FB-Sicht** schweigt die Kaskade fast überall — R19 („in QS") wartet auf die QS, R21 („GA schreiben") ist die AB zuständig, keine nennt den FB, also greift kein Leihweg. Dann sprach wieder die alte Status-Formel, und die ist an 101 von 102 Vorgängen widerlegt. Gemessen: 17 von 19 offenen Vorgängen mit Kürzel THü.

- **Schweigt der eigene Regelsatz, wird der AB-Satz gelesen** und als fremde Aufgabe gezeigt — „in QS · wartet auf QS" statt einer Handlung, die es für die eigene Rolle nicht gibt (`Aufgabe.gelesenAls`, [aufgabe.ts](src/core/status/aufgabe.ts))
- **Fünfter Anzeige-Zustand `fremd`** neben `kaskade`/`gesperrt`/`rueckfall`/`laedt`; der Rückfall auf die Status-Formel bleibt, wo auch der AB-Satz nichts sagt ([aufgaben-anzeige.ts](src/core/status/aufgaben-anzeige.ts))
- **Der fremde Satz wird benannt, nicht stillschweigend gelesen** — der Ausklapp schreibt „Aufgabe · Regelsatz AB · nicht FB", „warum?" zeigt R19 samt `D_AK4`/`D_AT4` ([AufgabenZeile.tsx](src/plugins/antraege/ausklapp/kopfkarte/AufgabenZeile.tsx))
- **Keine Graustufe als Träger**: dass die Aufgabe woanders liegt, sagt die Adresse in Worten — `--tf-text-tertiary` misst 2,62:1 und liegt unter AA ([status-achsen.md](docs/architecture/status-achsen.md))
- Ein Treffer der eigenen Rolle und eine für sie greifende Sperre gehen immer vor; die AB-Sicht und die Engine bleiben unverändert ([aufgaben-anzeige.test.ts](src/core/status/__tests__/aufgaben-anzeige.test.ts))

### v4.135.0 — Suchsprache: beide Platzhalter erklaert, jedes Feld gezeigt (August 2026)

MINOR — Der Reiter „Suchsprache" erklärte den Stern (seit v4.123) und verschwieg das Fragezeichen: die Suche kann `?` seit v4.101, in der Oberfläche stand dazu keine Zeile. Die Feldsuche war halb vorgemacht — sechs der dreizehn Felder als Beispiel, der Rest eine nackte Präfix-Aufzählung im Fußsatz, aus der man `bl` und `ast` raten musste, daneben drei Spaltencodes als Prosa.

- **Beide Platzhalter stehen als eigene, ausführbare Zeile** — `mob*spec` „Stern — beliebig viele Zeichen, auch keines" (33) und neu `16KN0830?1` „Fragezeichen — genau ein Zeichen" (14); getrennt, weil die Wahl zwischen beiden der Inhalt ist ([suchsprache.ts](src/plugins/suche/start/suchsprache.ts))
- **Neuer Block „Alle Felder — vor dem Doppelpunkt"**: alle dreizehn Felder mit Beispiel, Bedeutung und Spaltencode, jede Zeile anklickbar — er ersetzt die Prosa-Aufzählung im Fußsatz ([feldliste.ts](src/plugins/suche/start/feldliste.ts), [StartSuchsprache.tsx](src/plugins/suche/start/StartSuchsprache.tsx))
- **Der Spaltencode je Feld ist eine Einzelquelle** (`FELD_SPALTE`), abgeleitet statt abgeschrieben wie Präfix und Bedeutung ([feldpraefix.ts](src/core/services/search/feldpraefix.ts))
- **Reiter-Zahl und „alle N ansehen" lesen dieselbe Konstante** (`SUCHSPRACHE_ZEILEN`, jetzt 26) — nachgezählt stimmt sie ([SucheStartzustand.tsx](src/plugins/suche/SucheStartzustand.tsx))
- Alle Beispiele in dev:local an 14.225 Anträgen nachgemessen; Guards halten Vollständigkeit, Ausführbarkeit und Herkunft der drei Angaben ([feldliste.test.ts](src/plugins/suche/start/__tests__/feldliste.test.ts))

### v4.134.0 — Vier Widgets sagen, was sie zählen (August 2026)

MINOR — Vier Startseiten-Karten benannten eine Menge, die sie nicht führen. Am Bestand gemessen: die Bahn „Wartet auf Antragsteller" stand auf 0, während zehn Karten daneben genau das sagten; „QS-Freigaben offen" meldete „keine", während die Karte darüber denselben Entwurf zum Weiterarbeiten anbot; das Fristen-Widget führte 108 von 124 Anlässen auf vier Meilensteine zurück, die **keine Bedingung** tragen und deshalb nie erfüllbar sind; und „Änderungen der letzten Nacht" zeigte 402 Zeilen, von denen 7 den Leser angingen.

- **Die Kategorie `nachforderung` heißt „Nachforderung läuft"** (app-weit: Kanban-Bahn, Reiter, Filter-Chips, Suchfacetten) — sie umfasst genau einen Status, „NF gestellt"; wer wartet, sagt die To-do-Kaskade je Zeile ([status-category-labels.ts](src/core/utils/status-category-labels.ts))
- **„QS-Freigaben offen" heißt „Meine Entwürfe in dieser App"** und filtert nicht mehr nach dem Kürzel des Antrags — die Runs liegen gerätelokal, wer sie sieht, hat sie selbst erzeugt ([qsFreigaben.ts](src/plugins/home/widgets/qsFreigaben.ts), [useQsFreigaben.ts](src/plugins/home/widgets/useQsFreigaben.ts))
- **Meilenstein-Knoten ohne auswertbare Bedingung gelten nicht mehr als gerissen**, sondern als `ohneBedingung` — gezählt in der Fußzeile des Widgets, markiert im Editor; die Projektions-Signatur trägt jetzt die `BEWERTUNGS_VERSION`, sonst wirkt eine Engine-Änderung erst am nächsten Tag ([bewertung.ts](src/core/meilensteine/bewertung.ts), [projektion.ts](src/core/meilensteine/projektion.ts))
- **„Änderungen der letzten Nacht" folgt dem Bearbeiter-Ausschnitt, gruppiert je Antrag und weicht auf den letzten Lauf MIT Änderungen aus** (4 von 9 Stempeln waren leer); die Karte rückt einmalig ans Spaltenende ([nachtlaufGruppen.ts](src/plugins/home/widgets/nachtlaufGruppen.ts), [lesen.ts](src/core/status/journal/lesen.ts), Config v3)
- **Die Fristen-Liste zeigt beide Quellen**, statt die kleinere in der Sortierung verschwinden zu lassen, und der Kanban-Kopf nennt die Einheit samt der Kategorien außerhalb seiner Bahnen ([fristAnlaesse.ts](src/plugins/home/widgets/fristAnlaesse.ts), [kanbanLanes.ts](src/plugins/home/widgets/kanbanLanes.ts))

### v4.133.0 — Zuletzt geändert: der Klick landet beim Eintrag, der Rückweg führt heim (August 2026)

MINOR — Das Startseiten-Widget hieß „Registry-Änderungen" — ein Wort aus `registry.json`, das in der Oberfläche sonst nirgends vorkommt. Und sein Klick warf weg, worauf man geklickt hatte: man landete auf der Skills-Liste ohne Auswahl und ohne Weg zurück. Der Deep-Link dafür war seit Juni 2026 gebaut (`b70c02d7`, Provenienz-Affordanz des Gutachten-Flows), nur rief ihn niemand auf.

- **Die Karte heißt „Zuletzt geändert"**, in der Widget-Liste „Zuletzt geändert: Skills & Regeln" (dort steht das Label allein zwischen „Notizen" und „Auslastung"); die Typ-Id `registry-aenderungen` bleibt, weil sie in den Startseiten-Configs der Nutzer steht ([RegistryAenderungenWidget.tsx](src/plugins/home/widgets/RegistryAenderungenWidget.tsx), [widgetCatalog.ts](src/plugins/home/widgets/widgetCatalog.ts))
- **Ein Klick öffnet genau den angeklickten Eintrag** — Skill wie Qualitätsregel über dieselbe Route `/kuration/skill-verwaltung/<eintragId>`; bisher konnte sie nur Skills, während das Widget Regeln gleichrangig führt ([Router.tsx](src/core/Router.tsx), [SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx))
- **Die Skill-Verwaltung hat einen Rückweg** („← Zurück zu Home") über dem Titel — das X des Detail-Panels behält seine andere Aussage: Editor schließen, nicht Seite verlassen
- **Die Rückweg-Mechanik trägt jetzt zwei Wirte statt einen**: `LISTEN_ROUTEN` statt des Pfad-Literals `/antraege`, und `rueckwegAus` bekommt die eigene Route als Parameter statt als eingebaute Sonderregel ([herkunft.ts](src/core/nav/herkunft.ts)); der Knopf selbst ist geteilt ([RueckwegLink.tsx](src/core/nav/RueckwegLink.tsx))
- Tests: 6 neue — der Skill-Deep-Link zählt zum Detail und wird nie eigene Herkunft, `rueckwegAus` schweigt für die eigene Route, und die Typ-Id überlebt jede Umbenennung des Labels

### v4.132.0 — Eine Aussage je Vorgang: Startseite, Board und Liste lesen dieselbe Kaskade (August 2026)

MINOR — Die App beantwortete „was ist zu tun?" mit **zwei** Motoren: einer 10-Zeilen-Tabelle über den Rohstatus (Startseite, Kanban, Tabellenspalte) und der 27-Regel-Kaskade über die gesetzten Kürzel (Vorgangs-Board). Am Nachtexport vom 20.08.2026 gemessen sagten sie bei **262 von 845** offenen Vorgängen (31 %) etwas Verschiedenes — allen voran „Gutachten freigeben" bei **101 von 102** Vorgängen, deren `D_AT4` längst gesetzt war.

- **Ein Bestandslauf, eine Ablage, drei Leser**: der Lauf des Boards steht jetzt in [bestands-lauf.ts](src/core/status/bestands-lauf.ts), sein Ergebnis in [useBestandsAufgaben.ts](src/core/hooks/useBestandsAufgaben.ts) — Startseite und Förderanträge-Liste lesen dieselbe Rechnung (Board-Zahlen unverändert, 4,9 s über 12.359 Vorgänge)
- **Startseite, Kanban-Karten und Tabellenspalte nennen die Aufgabe der Kaskade** samt Adresse („in QS · wartet auf QS" statt „Gutachten freigeben"); wo die Kaskade schweigt, bleibt die alte Formel der Rückfall ([aufgaben-anzeige.ts](src/core/status/aufgaben-anzeige.ts))
- **Was laut Kürzeln erledigt ist, zählt nicht mehr als offen**: drei Vorgänge im Bestand tragen einen Schlussvermerk über einem offenen `STATUS_TV` — sie stehen am Ende der Liste mit „Keine Aufgabe mehr" und werden gemeldet statt weggeräumt ([dashboardAggregate.ts](src/plugins/home/dashboardAggregate.ts))
- **Eine Regel, die eine Rolle als zuständig NENNT, ist für sie sichtbar**: bis hierher entstand die FB-Sicht allein aus `wartetAuf`, und R12 („Widerspruch gg Abl bearbeiten", AB/FB/Jur) fehlte ihr ganz — der FB sah ein leeres Board ([todo-engine.ts](src/core/status/todo-engine.ts))
- **Die Chips heißen, was sie zählen**: ohne Rollenwahl „Jemand ist zuständig" statt „Meine Aufgaben" (für THü: 17, davon 16 beim AB), und die Rollen-Zeile der Einstellungen sagt, was in den Daten steht — „407× FB · 0× AB" ([zustaendigkeit.ts](src/plugins/vorgangs-board/zustaendigkeit.ts), [AntraegeSichtGruppe.tsx](src/plugins/einstellungen/profil/AntraegeSichtGruppe.tsx))

### v4.131.1 — Kontext-Doc-Reissleine zweistufig (August 2026)

PATCH — In v4.131.0 wurde eine korrekte Drei-Zeilen-Ergänzung in `antraege.md` auf einen Halbsatz eingedampft, bis 54.999 von 55.000 Zeichen dastanden. Genau davor warnt der Kommentar am Guard seit v4.72, und die README verbietet es ausdrücklich — eine Reißleine mit einem Zeichen Luft ist ein Budget.

- **Die Reißleine ist zweistufig**: global 45.000 Zeichen, eigene Grenze für `antraege.md` in `REISSLEINE_JE_DOC` ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts)) — eine gemeinsame Zahl, die für die größte Seite passt, fing für die übrigen 18 Docs nichts mehr (bei 55.000 hätte sich `suche.md` verdoppeln können)
- **Ein zweiter Guard sichert die Ausnahme-Tabelle**: jeder Eintrag muss zu einem existierenden Doc gehören, über der globalen Grenze liegen und darf nicht mehr als dessen doppelte Länge betragen — sonst wäre er ein Freibrief statt einer Grenze
- **1.300 Zeichen aus `antraege.md` entfernt**, die dort nicht hingehörten: Layout-Begründungen, drei Historien-Nebensätze (Doku-Konvention 1) und eine doppelt beschriebene Trefferzahl — gemessen bleiben 177 Aufzählungspunkte à 300 Zeichen, längste Zeile 666 von 700, null Code-Marker außerhalb „Technik"
- Beide Doku-Stellen nannten noch die Reißleine von 10.000 aus der Zeit vor sechs Anhebungen ([README](docs/feedback-kontext/README.md), [update-screen-context.md](docs/agents/update-screen-context.md)) und sagen jetzt auch, in welcher Reihenfolge man auf eine Reisse reagiert

### v4.131.0 — Startseite: die Befunde der Bug-Jagd behoben (August 2026)

MINOR — Ergebnis der read-only Jagd auf die Startseite entlang der Frage „zeigt sie dieselbe Wahrheit wie die Seite, auf die sie verlinkt?" (48 Roh → 15 adversarisch gekippt → 20 behoben). Ein Muster trägt die Hälfte: die Startseite rechnete Zahlen selbst nach, statt die Engine der Zielseite zu fragen — und Zähler nannten Auszüge wie Bestände.

- **Die Frist kommt aus DERSELBEN Engine wie die Liste** (`criticalFristErgebnis` statt eigener `antragsdatum + 90`-Rechnung): am Bestand haben 113 von 577 Anträgen keine laufende Uhr — sie standen mit dreistelligem Rückstand oben in einer Karte, die „Sortierung: Frist" verspricht, und stehen jetzt geschlossen am Ende ([dashboardAggregate.ts](src/plugins/home/dashboardAggregate.ts))
- **Kein Zähler behauptet mehr einen Bestand, wenn er einen Auszug meint**: Kanban-Kopf (573 von 6.581) und Vollbild nennen, was außerhalb der Bahnen liegt; Feedback-News und Registry-Änderungen zeigen den Bestand statt ihrer Kappungs-Grenze; das Fristen-Widget sagt eingeklappt „—" statt „0" ([kanbanLanes.ts](src/plugins/home/widgets/kanbanLanes.ts), [registryAenderungen.ts](src/plugins/home/widgets/registryAenderungen.ts))
- **Jeder wirksame Filter steht in der Chip-Zeile**: der persistente Spaltenkopf-Trichter machte aus der zugesagten „Kritisch 524" eine fast leere Tabelle, ohne dass etwas es sagte; „+ N weitere →" einer Kanban-Bahn landet in ihrer Kategorie statt in der Voll-Liste ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx), `kategorieQuickfilter` in [store.ts](src/plugins/antraege/store.ts))
- **„Rückgängig" nimmt zurück, wovon die Leiste spricht** — nicht den ganzen Vorstand (gemessen: ein zwischenzeitliches Einklappen sprang stillschweigend mit zurück); die Reue-Frist hängt an einem Zeitstempel statt an der Lebensdauer der Leiste ([rueckgaengigStore.ts](src/plugins/home/anpassen/rueckgaengigStore.ts))
- Weiter behoben: „nur lokal auf diesem Gerät" war falsch (die Config wird in den persönlichen Ordner gespiegelt), Verbund-Marke fehlte in „Meine Anträge", Positions-Zähler und Tausch meinten verschiedene Nachbarn, Inaktiv-Ausschluss fehlte in Ampel und Kanban, ein Antrag mit fremdem Kürzel stand weiter im Übernahme-Angebot, „Alle Einstellungen" sprang in einen Abschnitt — Bericht: [home-widgets.md](docs/architecture/home-widgets.md)

### v4.130.0 — Ein Paket bringt den ganzen kuratierten Stand auf einen anderen Share (August 2026)

MINOR — Skills, die auf dem Entwicklungs-Share gewachsen sind, kamen bisher nicht am Stück auf den Produktiv-Share: der Seed ergänzt nur fehlende IDs, und ein Einzel-Bündel legt bei ID-Kollision bewusst eine Kopie an. 23 Skills zu übertragen hieß 23 Downloads und danach ein Ziel voller Doubletten.

- **Kuratur-Paket**: Skills + Regeln + Workflows + Textbausteine in EINER Datei, vier reine Module ohne IO ([paket/](src/core/services/skills/paket/), `kind: 'teamflow-kuratur-paket'`)
- **Vorschau vor dem Schreiben** je Eintrag — neu / geändert / unverändert mit der Wahl übernehmen · aktualisieren · als Kopie · überspringen, Knopf „Paket…" in der Skill-Verwaltung ([PaketDialog.tsx](src/plugins/skill-verwaltung-kuration/PaketDialog.tsx), [PaketImportPanel.tsx](src/plugins/skill-verwaltung-kuration/PaketImportPanel.tsx))
- **Aktualisieren verliert den Ziel-Stand nie**: neue Fassung, der bisherige Stand rückt in die Historie und ist per Rollback erreichbar ([einspielen.ts](src/core/services/skills/paket/einspielen.ts))
- **Workflow-Schritt-IDs bleiben stabil** (Zuordnung über `ankerKey` → `nr` → `label+skillId`) — `WorkflowRun.schritte` hängt daran; nur der Kopie-Pfad vergibt sie neu
- Der Inhaltsvergleich ist kanonisch über den ganzen Record, nicht feldweise — sonst fielen `vorgaben`/`teilStruktur`/`aktiv` durchs Raster ([vergleich.ts](src/core/services/skills/paket/vergleich.ts)); Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md)

### v4.129.0 — Feedback-System: 27 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Ergebnis der read-only Jagd auf die beiden Feedback-Oberflächen (43 Roh → 12 adversarisch gekippt → 27 nach Zusammenführung). Zwei Muster tragen die Hälfte: die Nutzer-Vorschau verbarg, was sie nicht verbot, und „Archivierte zeigen" wirkte nur in der Liste, während der Zähler die volle Zahl versprach.

- **Verändernde Bedienelemente hängen an EINER Bedingung** (`darfSchreiben` = Recht UND Entwickler-Sicht): Auswahl-Häkchen, Bulk-Leiste mit „Archivieren", Verwaltungs-Zahnrad und der Verwaltungs-Block im Detail waren in der Nutzer-Vorschau erreichbar ([typen.ts](src/plugins/feedback-board/ticket/typen.ts), [FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx))
- **Archiviertes hat jetzt eine Bahn, eine Facette und einen eigenen Stepper-Endpunkt** statt zu verschwinden bzw. „Umgesetzt" zu behaupten; Karten in ausgeblendeten Spalten melden sich ([boardSpalten.ts](src/plugins/feedback-board/boardSpalten.ts), [FacettenLeiste.tsx](src/plugins/feedback-board/ticket/FacettenLeiste.tsx), [feedbackStepper.ts](src/core/services/feedback/feedbackStepper.ts))
- **Jede Facettenzahl gilt neben Suche und den anderen Achsen** — „Rückfrage 1" lieferte beim Klick 0 ([boardZahlen.ts](src/plugins/feedback-board/boardZahlen.ts), `FacettenEinschraenkung`)
- **Escape gehört der obersten Ebene**: im Annotator warf es Typ, Text und Screenshot weg; am Board schlossen Kaskade **und** `MasterDetailLayout` zusätzlich das Detail — beide fragen jetzt `eineEbeneLiegtDarueber()` (wirkt app-weit) ([FeedbackAnnotator.tsx](src/components/feedback/FeedbackAnnotator.tsx), [masterDetailLayout-logic.ts](src/components/master-detail/masterDetailLayout-logic.ts))
- Weiter behoben: stummes Absenden + Duplikate bei Wiederholung, überschriebene Entwürfe im Verwaltungs-Block, zwei Budget-Konten je Person, nur-lokales FAQ, verlustbehaftetes Inbox-„Genehmigen", gesperrtes Zurückziehen bei erreichtem Ziel, Sponsoren-Zahl als Personen, tote Chatbot-Einstellungen — Bericht: [feedback-system.md](docs/architecture/feedback-system.md)

### v4.128.2 — Der Index sagt, welcher er ist — und was ihm fehlt (August 2026)

PATCH — Aus dem Test: „Vektoren neu gebaut, App neu geladen — die Seite sagt trotzdem, es gebe keinen Index, und bietet Nachziehen für 136 an." Beide Meldungen stimmten und widersprachen sich trotzdem: die Ampel meinte den Dokumenten-Index, und die 136 fehlten wirklich — der Korpus kam vom Datenspeicher, gebaut in einer anderen Variante mit eigenem Antragsstand.

- **Jedes Ampel-Label nennt seinen Gegenstand** („Kein Dokumenten-Index — bitte indexieren"); seit v4.127 stehen zwei Indizes auf der Seite ([indexAmpel.ts](src/core/services/search/indexAmpel.ts), [katalog.ts](src/core/sichtbarkeit/katalog.ts))
- **„Synchron mit dem Datenspeicher" und „vollständig für diesen Bestand" sind getrennt** — deckt der geholte Korpus Vorhaben von hier nicht ab, steht das im Klartext statt als ✓ neben einem Knopf mit einer Zahl ([EmbeddingKorpusSection.tsx](src/plugins/kuration/suche-index/sections/EmbeddingKorpusSection.tsx))
- **Der Lauf meldet seine Bilanz** (eingebettet / übersprungen / voll erzwungen) — `BuildErgebnis` gab es seit je, gelesen hat es niemand ([useKorpusBau.ts](src/plugins/kuration/suche-index/hooks/useKorpusBau.ts))
- **Der automatische Nachlauf verliert seinen einen Versuch nicht mehr an die Startaufgaben**: vorübergehende Sperren geben den Latch frei, Datenaktualisierung und Korpus-Abgleich sind Abhängigkeiten ([useEmbeddingKorpusAbgleich.ts](src/core/hooks/useEmbeddingKorpusAbgleich.ts), `SPERRE_VORUEBERGEHEND`)
- Während die Bestandsaufnahme läuft, steht „Bestand wird ermittelt…" statt „0 von 0 · nichts offen"; die Hub-Suche fand den Vektor-Korpus noch unter „Selten gebraucht" ([kurationPanels.tsx](src/plugins/kuration/kurationPanels.tsx))

### v4.128.1 — Ein Netzwerk steht einmal in der Vorschlagsliste, nicht je Schreibweise (August 2026)

PATCH — Aus dem Test: unter `nw:CANNABIS` standen zwei Zeilen, „CannabisNET" und „CANNABIS-NET", beide mit 60 — das las sich wie zwei Mengen. Es ist eine (alle 60 im Netzwerk `16KN0896`); der Export führt allein für dieses Netzwerk elf Schreibweisen. Seit die Suche fugenblind vergleicht (v4.125), ist eine Zeile je Bindestrich eine Unterscheidung ohne Unterschied.

- **Ein Netzwerk steht einmal in der Liste**, beschriftet mit der häufigsten Schreibweise, die Trefferzahl ist die Summe der Gruppe — 61 der 1.025 Schreibweisen fallen zusammen, 222 der 688 Netzwerke standen mehrfach ([wert-index.ts](src/plugins/antraege/services/wert-index.ts))
- **Der Klick setzt den Namenskern ein statt zu zitieren**: `nw:"NaFa Tech"` fand 9, `nw:NaFa-Tech` 29 — dasselbe Netzwerk, und der Unterschied kam aus der Klammer statt aus den Daten (189 Namen mit Leerzeichen betroffen, [vervollstaendigung.ts](src/plugins/suche/vervollstaendigung.ts))
- **Der Rang hängt am Kern, nicht an der angezeigten Schreibweise** — nach der Faltung ist sie nur noch Stellvertreterin ihrer Gruppe; „Cannabis-Net" wäre sonst hinter das unverwandte „Netzwerk Cannabisnetz" gerutscht ([wert-index.ts](src/plugins/antraege/services/wert-index.ts), `sammlePassende`)
- „Stöbern" baut dieselbe Anfrage wie die Vorschlagsliste ([stoebern.ts](src/plugins/suche/start/stoebern.ts))
- Kein Befund an der Suche: eindeutig ist ohnehin das Kennzeichen (`fkz:16KN0896` → 61 statt 60, weil ein Teilvorhaben einen fremden Netzwerknamen trägt — 96 solcher Fehlzeiger im Bestand), aber es gilt je Förderrunde ([suche.md](docs/feedback-kontext/suche.md))

### v4.128.0 — Die Metadaten-Extraktion zeigt nur noch die Wege, die diese Fassung gehen kann (August 2026)

MINOR — Im Aufklappmenü „Metadaten-Extraktion" (Datenpflege → Suche & Index) standen sechs Wege, zwei davon in `zah-pl` ohne Wirkung: „Interne KI-API" und „OpenRouter API" bauen ihren Transport aus der Provider-Adresse, die nur der dev-Build setzen kann — in pl steht dort die Streamlit-Adresse, gegen die ein API-Ping scheitert. OpenRouter sperrt für Metadaten ohnehin die Transport-Policy.

- **Beide API-Wege sind in pl/prod aus dem Menü verschwunden**, im dev-Build bleiben sie ([metadata-extractor.ts](src/core/services/search/metadata-extractor.ts), `verfuegbareMetadataModelle`)
- **Neuer Flag `metadatenDirektApi`** (dev + local an, pl/prod aus) ([feature-flags.ts](src/config/feature-flags.ts), [runtime-layers.md](docs/architecture/runtime-layers.md))
- **Eine gespeicherte Auswahl, die es nicht mehr gibt, zählt als „Kein LLM (regelbasiert)"** — sonst zeigte das Feld still den ersten Eintrag, während der Indexlauf die alte Adresse ansprach ([usePipelineConfig.ts](src/plugins/kuration/suche-index/hooks/usePipelineConfig.ts), `normalisiereMetadataLLMId`)
- OpenRouter hängt zusätzlich an `ki.openrouter.enabled` — im local-Build fällt der Eintrag damit ebenfalls weg ([metadata-modelle.test.ts](src/core/services/search/__tests__/metadata-modelle.test.ts))
- Baseline `MAX_FEATURE_FLAGS` von 29 auf 30 angehoben ([health-baseline.test.ts](src/__tests__/health-baseline.test.ts))

### v4.127.1 — Der Ausweg aus der Richtlinien-Auswahl steht jetzt vorn (August 2026)

PATCH — Aus dem Test: `nafatech` meldete „Keine Treffer", obwohl die Suche 29 Anträge gefunden hatte — alle in den Richtlinien-Generationen 2012 und 2015, weggeblendet von einer Richtlinien-Auswahl, die die Anfrage überlebt. Der Ausweg stand da, aber als eine Zeile unter mehreren gleich aussehenden, und wurde überlesen.

- **Das Öffnen der Richtlinien steht jetzt direkt unter „Keine Treffer"** — eigener Kasten mit Zahl und gefülltem Knopf statt Listenzeile ([KeinTrefferZustand.tsx](src/plugins/suche/KeinTrefferZustand.tsx))
- **Herausgehoben wird genau dieser eine Ausweg**: nur bei ihm existieren die Treffer nachweislich und eine stille Einstellung verdeckt sie; alle übrigen ändern die Anfrage und bleiben in der Liste ([auswege.ts](src/plugins/suche/auswege.ts), `teileAuswege`)
- **Der zusammengelegte Ausweg bleibt unten**, obwohl er die Richtlinien mit öffnet — unter der Beschriftung „Alle Richtlinien einbeziehen" verschwiege er, dass er auch Filter leert und Regler lockert ([auswege.test.ts](src/plugins/suche/__tests__/auswege.test.ts))
- Kein Befund an der Suche selbst: die 29 Treffer waren da und richtig; nachgemessen in den Unterprogrammen 34, 36 und 47 ([suche.md](docs/feedback-kontext/suche.md))

### v4.127.0 — Der Vektorindex der Suche zieht in die Kuration und meldet sich, wenn er veraltet (August 2026)

MINOR — Die Themen-Vektoren sind der Vektorindex der Ähnlichkeitssuche; gebaut wurden sie im Auslastungs-Modul, wo der Knopf „Corpus aufbauen" an `isDevContext()` hing und in `zah-pl` schlicht fehlte — während drei Texte in der App dazu aufforderten, ihn zu klicken. Dazu verglich der Start-Abgleich nur die ANZAHL: ein vollständiger, aber überholter Korpus blieb für immer liegen, unsichtbar, weil keine Zahl auffällig wurde. Am echten Bestand betrifft das **9 259 von 14 221** Vorhaben, deren Vektor ihren Inhalt nie gesehen hat.

- **Bau, Abgleich und Spiegelung liegen in der Kuration** → „Suche & Index" → „Vektoren der Ähnlichkeitssuche"; die Auslastungs-Karte bleibt als Statusanzeige ([EmbeddingKorpusSection.tsx](src/plugins/kuration/suche-index/sections/EmbeddingKorpusSection.tsx), [useKorpusBau.ts](src/plugins/kuration/suche-index/hooks/useKorpusBau.ts), [auslastung.md](docs/architecture/auslastung.md))
- **Der Abgleich vergleicht die Signatur, nicht die Anzahl** — ein älterer Vektorraum wird ersetzt statt ergänzt, ein neuerer lokaler nicht überschrieben ([abgleich.ts](src/core/services/embedding-corpus/abgleich.ts), 13 Fälle als Tabelle geprüft)
- **Der Korpus erreicht jeden, der suchen kann**: der Start-Abgleich hing an der Freischaltung des Auslastungs-Moduls — in `zim-dashboard` lief er nie. Jetzt lädt er bedarfsgetrieben, sobald jemand „auch ähnliche Themen" einschaltet ([useEmbeddingKorpusAbgleich.ts](src/core/hooks/useEmbeddingKorpusAbgleich.ts), [runtime-layers.md](docs/architecture/runtime-layers.md))
- **„Inkrementell" sieht geänderten Text**: ein Hash je Vorhaben macht aus „fehlt" ein „fehlt ODER Text hat sich geändert" — vorher übersprang der Lauf genau die Vorhaben, die der Wochen-Export `9052_PrjBsp` mit Inhalt füllt ([texthashes.ts](src/core/services/embedding-corpus/texthashes.ts))
- **Ein Rechner kann nachziehen lassen** — opt-in, gerätelokal, ausgelöst von neuen CSV-Daten statt vom Kalender, mit acht benannten Vorbedingungen statt stiller Untätigkeit ([korpus-nachlauf.ts](src/plugins/auslastung/services/matching/korpus-nachlauf.ts))

### v4.126.0 — Feldschluessel gegen Mapping: VN-Eingang, alle Antraege da und Bemerkung angeschlossen (August 2026)

MINOR — Nachtrag zu §G.3 aus Schnitt 2: dieselbe Klasse, nur eine Schicht tiefer. Vier Spalten galten als „ungemappt" und lagen in Wahrheit unter Custom-Keys — nachgemessen sind es **fünf**, und zwei davon (`D_XTEC`, `D_ADV`, zusammen 21 526 Werte) liest der kanonische Weg gar nicht: die Auslastung löst sie längst selbst über das Schema auf. Übrig bleiben drei echte, und alle drei tragen etwas, das die Oberfläche behauptet hat, ohne es zu haben.

- **Der Verwendungsnachweis ist da**: `D_VBE` liegt unter `eingang_vn_sach` (5 793 Sätze) — die Zelle sagte für 344 Vorgänge „kein Verwendungsnachweis eingegangen", während das Datum im Export stand; jetzt läuft die VN-Uhr, wie die Engine sie seit jeher vorsieht ([list-view.ts](src/core/services/csv/list-view.ts), Projektion v9)
- **Der wirksame Eingang gilt wieder**: `D_XTE` („alle Anträge da", 10 282 Sätze) erreicht die Liste als `alle_antraege_da` — 178 Fristen rechnen ab dem späteren der beiden Eingangsdaten, 12 Zeilen sind damit nicht mehr fälschlich überfällig ([fristAnzeige.ts](src/plugins/antraege/fristAnzeige.ts))
- **2 420 Verbünde tragen eine Bemerkung**: `T_HINT` liegt unter `bemerkung` (3 169 Sätze) — die Box im Auslastungs-Zuweisungscockpit war für den ganzen Bestand leer ([verbund-aggregation.ts](src/plugins/auslastung/services/verbund/verbund-aggregation.ts) unverändert, die Projektion liefert jetzt)
- **Die Verlaufs-Schicht sah VBE nie**: kanonisch angebundene Kürzel tragen als `feldId` den Record-Key, Regel 2 der Auflösung greift bei ihnen nie — sie fragt jetzt zusätzlich nach `D_<code>` ([feld-aufloesung.ts](src/core/status/feld-aufloesung.ts)); von den vier Kürzeln ändert sich genau VBE, gemessen an den echten Schemas
- **Die Frist-Hilfe nennt wieder drei Felder**, weil die Zelle sie jetzt wirklich liest — der Guard prüft das am Verhalten statt an einer abgeschriebenen Liste ([spaltenHilfe.ts](src/plugins/antraege/spaltenHilfe.ts), [zeigtWasDasteht.test.ts](src/plugins/antraege/__tests__/zeigtWasDasteht.test.ts))

### v4.125.0 — Trennzeichen im Namen sind egal (August 2026)

MINOR — Nach dem Stern stand die Frage nach einem Abstandsmaß („meintest du …?") im Raum. Vor dem Bau wurde der Namensraum ausgezählt, und das Ergebnis kippte sie: von 377 Paaren Haupt-↔-Nebenschreibweise rettete ein Abstandsmaß **null**, während 17 Paare verschiedener Netzwerke bei Abstand 1 liegen. Was die Messung stattdessen fand, braucht kein Raten — dieselbe Sache, anders getrennt: `cannabisnet` lieferte 1 Treffer, `cannabis-net` 60.

- **Der Namenskern**: Bindestrich, Leerzeichen, Punkt und Klammer zählen in Akronym und Netzwerk nicht mit — 991 zusätzlich gefundene Anträge, 19 Anfragen, die vorher **null** lieferten ([namensKern.ts](src/core/services/search/namensKern.ts)); Zahlen + Preis in [suche-relevanz.md §12.2](docs/architecture/suche-relevanz.md)
- **Die Nadel muss an einem Wortanfang beginnen** — sonst fände `bona` das Netzwerk „lab on a chip"; über die 400 häufigsten Titelwörter ändern nur 5 Anfragen ihre Trefferzahl, um zusammen 12 Zeilen ([namensKern.ts](src/core/services/search/namensKern.ts))
- **Nur die beiden Namensfelder**, nicht Titel/Abstract/Snippet: dort liefe die Faltung über einen Satzpunkt hinweg ([suchbereich.ts](src/core/services/search/suchbereich.ts) bleibt unberührt, `KERN_FELDER` zieht die Grenze)
- **Der Kern liegt im Korpus vorberechnet** neben dem rohen Wert (+1 ms je Anfrage statt +8) und ist dieselbe Zeichenkette, wo der Wert keine Fuge trägt ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts))
- **Die Oberfläche zieht mit**: Fundstelle als ein Stück markiert (Bindestrich eingeschlossen), `nw:cannabisnet` schlägt „Cannabis-Net" vor (letzter Rang), eine ausführbare Zeile in der Suchsprache ([markierung.ts](src/core/services/search/markierung.ts), [wert-index.ts](src/plugins/antraege/services/wert-index.ts), [suchsprache.ts](src/plugins/suche/start/suchsprache.ts))

### v4.124.0 — Förderanträge: 100 Befunde der Bug-Jagd (Schnitt 2) behoben (August 2026)

MINOR — Schnitt 2 nahm die andere Hälfte des Plugins (Detailseite, Ausklapp, Suche, Status, Gutachten, Aufbereitung, Artefakt-Nachbarn) und fand eine Klasse mit dem meisten Ertrag: **eine Stelle liest einen Feldschlüssel, den der echte Bestand nicht führt**, weil das Mapping die Spalte umbenennt. Dazu kamen Flächen, die etwas Falsches behaupten statt zu schweigen — eine unerreichbare Feld-Historie, eine phasenblinde Frist, ein Freigabe-Tor über leerem Text. 95 Brillen-Befunde + 5 eigene Mess-Befunde, dazu 15 der 25 offenen Kandidaten aus Schnitt 1.

- **Feldschlüssel gegen Mapping**: `T_XSW` liegt unter `wiedereinreicher` (1 452 Sätze), `LFZ_TV_*` unter `tv_beginn`/`tv_ende` (14 131), „beantragte Kosten" scheiterte an Klammern (8 105), `ANWEND_*` fehlte im Suchkorpus (9 614) — alle über Alias-/Normalisierungs-Auflösung nachgezogen ([xsw.ts](src/plugins/antraege/xsw.ts), [glanceFacts.ts](src/plugins/antraege/alleFelder/glanceFacts.ts), [descriptor-text.ts](src/plugins/antraege/services/descriptor-text.ts), Projektion v8 in [list-view.ts](src/core/services/csv/list-view.ts))
- **Die Feld-Historie ist erreichbar**: der `↻ N`-Knopf hing am Verbund an einem fest verdrahteten `{}`, am TV am nie befüllten `antrag_historie` — beide lesen jetzt das Import-Diff-Journal ([useFeldHistorie.ts](src/plugins/antraege/alleFelder/useFeldHistorie.ts))
- **Uhren und Zähler sagen, was sie messen**: die Artefakt-Karte verließ die phasenblinde Altregel (11 003 auseinanderlaufende Vorgänge), die Chronik zeigt ihre Textspalte nur noch, wenn sie etwas hinzufügt (62,2 % Echo), Kürzel-Angaben, Trichter-Zähler und Termin-Zahlen tragen ihre Einheit ([useArtefaktLeiste.ts](src/plugins/antraege/artefakte/useArtefaktLeiste.ts), [StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx))
- **Kein Tor über leerem Text**: leerer Bescheid ist nicht freigabereif, ein NF-Punkt ohne Baustein trägt seine `[TODO]`-Marke, das Freigabe-Tor rechnet mit dem Prüfstand der Erzeugung ([nf-service.ts](src/plugins/antraege/nachforderungen/nf-service.ts), [WerkbankSection.tsx](src/plugins/antraege/werkbank/WerkbankSection.tsx))
- **Kein Zustand über den Wechsel hinweg**: Entwürfe, Prompt-Ansicht, Werkbank-Auswahl und Suchkorpus folgen dem Verbund bzw. dem Bestandsstand ([useNachforderungen.ts](src/plugins/antraege/nachforderungen/useNachforderungen.ts), [antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)) — Bericht: `~/.claude/plans/bug-jagd-antraege-schnitt-2.md`

### v4.123.0 — Die Suche kennt den Stern (August 2026)

MINOR — Das Fragezeichen (v4.101) verlangt, dass man abzählt: `mobi?nspec` findet die beiden Schreibweisen dieses Netzwerks nur, weil sie sich in genau einem Zeichen unterscheiden — `mob?nspec` liefert 0. Wer eine Namensdrift sucht, kennt ihre Länge aber nicht. Dazu kam der Platzhalter in keiner Zeile der Oberfläche vor: gefragt wurde nach einer Sache, die es seit zwei Monaten gibt.

- **`*` steht für beliebig viele Zeichen, auch für keines**: `mob*spec` liefert dieselben 33 Treffer wie `mobi?nspec`, ohne die Abweichung zu kennen ([wortstamm.ts](src/core/services/search/wortstamm.ts)) — Kosten wie ein gewöhnliches Wort, am Bestand gemessen ([suche-relevanz.md](docs/architecture/suche-relevanz.md))
- **Der Stern bleibt im Wort** (`[\p{L}\p{N}]*`, nicht `.*`): `mob*technik` findet 2 statt 119, weil er nicht über Leerzeichen spannt ([wortstamm.ts](src/core/services/search/wortstamm.ts))
- **Die Fundstelle wird als Muster markiert**, nicht als getippte Nadel — bis v4.122 kam ein Platzhalter-Treffer unmarkiert an ([markierung.ts](src/core/services/search/markierung.ts))
- **Die Suchsprache lehrt ihn**: eine ausführbare Zeile mehr im Startzustand, am echten Bestand gegengezählt ([suchsprache.ts](src/plugins/suche/start/suchsprache.ts))
- Erbt Feldpräfix und Anführungszeichen: `fkz:16KN0830*` (32), `nw:mob*spec` (33), `"mob*spec"` (0 — zitiert ist wörtlich gemeint)

### v4.122.0 — Förderantrags-Tabelle: 17 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Die read-only-Jagd über die meistgenutzte Seite fand ein Muster: **die Oberfläche verspricht eine Menge, eine Uhr oder eine Einheit, die die Liste darunter nicht einlöst.** Die Filterleiste zählte über den Vollbestand (14 225) und bot Werte an, die im aktuellen Reiter null Zeilen liefern; die Vorgabe-Sortierung „Frist" las ein anderes Feld als die Frist-Spalte zeigt; Massenleiste und Export rechneten auf der Liste vor den drei letzten Einschränkungen der Tabelle.

- **Zähler und Liste auf einer Grundmenge**: die Filterleiste holt ihre Facetten-Basis wie jede andere zählende Oberfläche aus `countBase`, ein vb_phase-Filter ohne die 9 schaltet den Irrläufer-Vorfilter nicht mehr ab, und „Auch außerhalb meiner Anträge" gilt auch für die Reiter-Zahlen ([FilterSidebar.tsx](src/plugins/antraege/filter/FilterSidebar.tsx), [useFilteredAntraege.ts](src/plugins/antraege/useFilteredAntraege.ts)) — Pitfall #46
- **Eine Uhr, nicht zwei**: „Frist (kürzeste)" sortiert über dieselbe Engine, die die Zelle zeigt — angehaltene Vorgänge sinken ans Ende statt an die Spitze ([sort.ts](src/plugins/antraege/sort.ts)); `daysUntilFrist` ist entfallen ([views.ts](src/plugins/antraege/views.ts))
- **Was dasteht, ist die Grundlage**: Massenleiste, beide Export-Wege und die schmale Spalte im Detail lesen die Meldung der Ansicht statt `filtered`; der Export nimmt die eigenen Spalten mit ([tabellenSicht.ts](src/plugins/antraege/tabellenSicht.ts), [export-xlsx.ts](src/plugins/antraege/services/export-xlsx.ts))
- **Kein Schalter ohne Wirkung**: „Gruppierung: Keine" gilt auch im Reiter „Fristen", der Nachlade-Fühler folgt seinem Knoten statt einer Zeilenzahl, ein angehakter Facetten-Wert bleibt abwählbar ([store.ts](src/plugins/antraege/store.ts), [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx), [MultiSelectFacet.tsx](src/plugins/antraege/filter/facets/MultiSelectFacet.tsx))
- **Erklärungen, die stimmen**: `custom`-Mappings zählen als Mapping (kein „bleibt leer" über einer vollen Spalte), „Branche"/„Fördergeber" nennen ihren Grund, die Frist-Hilfe nur noch die Felder ihres Rechenwegs ([spalten-inventar.ts](src/core/services/csv/spalten-inventar.ts), [spaltenHilfe.ts](src/plugins/antraege/spaltenHilfe.ts))

### v4.121.0 — To-do-Regeln und Klaerfragen: 15 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Der zweite Schnitt der Jagd, über die beiden in v4.120 ausgeklammerten Reiter. Ein Muster trägt fast alles: **ein Ergebnis überlebt seinen Parameter und wird dem gerade gewählten zugeschrieben.** Der Wirkungs-Lauf lief unter AB und stand nach einem Pillen-Klick als „Regelsatz FB" da — samt einer Warnung, die einen falschen Grund nannte. Dazu Zahlen, die eine andere Liste zählen als die daneben.

- **Eine Messung nennt ihren Regelsatz**: Wirkungs-Lauf, Probe am Fall und Termin-Befunde sagen, unter welchem Satz sie liefen; fremde Zahlen werden nicht mehr gezeigt ([useRegelWirkung.ts](src/plugins/status-cockpit/useRegelWirkung.ts), [RegelProbelauf.tsx](src/plugins/status-cockpit/RegelProbelauf.tsx), [TerminBefundeBlock.tsx](src/plugins/status-cockpit/TerminBefundeBlock.tsx)) — neue Bug-Klasse [#25](docs/architecture/recurring-bug-classes.md)
- **Zwei Kaskaden, zwei Nummernkreise**: Nummer, „Position i von n" und Pfeile folgen dem eigenen Regelsatz, fremde Sperren stehen vorn und tragen keine Stelle ([todoRegelnAnsicht.ts](src/plugins/status-cockpit/todoRegelnAnsicht.ts), [TodoRegelKarte.tsx](src/plugins/status-cockpit/TodoRegelKarte.tsx))
- **Zähler zählen, was dasteht**: die Regelsatz-Pille sagte „AB 26" über 30 Zeilen und „FB 0" über vier; die Reiter-Lasche zählte alle Sätze zusammen ([TodoRegelnBereich.tsx](src/plugins/status-cockpit/TodoRegelnBereich.tsx), [StatusCockpitPage.tsx](src/plugins/status-cockpit/StatusCockpitPage.tsx))
- **Auslassungen in Fragen, nicht in Anlässen**: „243 ruhende Kürzel ausgelassen" stand über einer Liste mit einer Frage, obwohl keine unterdrückt war; die Kurzlabel-Spitze kappte still ([klaerfragen/index.ts](src/core/status/klaerfragen/index.ts), [KlaerfragenTab.tsx](src/plugins/status-cockpit/KlaerfragenTab.tsx))
- **Eine Id, eine Zeile**: zwei Schreibweisen desselben Statuswerts erzeugten zwei Klärfragen mit derselben ID — dem Schlüssel, über den die Antworten zurückkommen ([ableitung.ts](src/core/status/klaerfragen/ableitung.ts))

### v4.120.0 — Status-Cockpit: 24 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Die read-only-Jagd über „Ebenen · Statuswerte · Kürzel" fand ein Muster: **die Oberfläche beschreibt einen anderen Stand als den, der bearbeitet wird.** Der Reiter „Ebenen" las die Zuordnung aus der gespeicherten Fassung, während der Baum daneben den Entwurf zeigte; „neu berechnen" warf den Entwurf weg; der Lösch-Dialog verschickte die Phase, die er löscht. Dazu drei Zähler, die eine andere Grundmenge messen als der Filter neben ihnen.

- **Ein Stand, eine Antwort**: „Ebenen" folgt jetzt dem Entwurf (`schnittVon` statt Snapshot), „neu berechnen" lässt ihn stehen, und der Lösch-Dialog kann sich nicht mehr selbst als Ziel schicken ([ebenenModell.ts](src/plugins/status-cockpit/ebenenModell.ts), [useStatusCockpit.ts](src/plugins/status-cockpit/useStatusCockpit.ts), [PhaseLoeschenDialog.tsx](src/plugins/status-cockpit/PhaseLoeschenDialog.tsx))
- **Zähler und Filter sprechen dasselbe Vokabular**: Status statt Katalogzeilen (60 → 30), „Vorkommen" statt „Vorgänge", Chips mit Facetten-Zahl, Suche filtert nach dem Falten ([katalogZeilen.ts](src/plugins/status-cockpit/katalogZeilen.ts), [KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx))
- **Keine Zusage ohne Mechanik**: die Arbeitsliste „folgt dem Code", nicht dem Verfahrensschritt; Zieltage nennen die Phasen aus `zieltageRelevant` statt einer festen Liste ([katalogSpalten.tsx](src/plugins/status-cockpit/katalogSpalten.tsx), [ZieltageUebernahmeDialog.tsx](src/plugins/status-cockpit/ZieltageUebernahmeDialog.tsx))
- **Nichts verschwindet still**: Sammelordner sind nicht löschbar (340 Kürzel), ein Zug nach unten landet nicht mehr eine Position zu weit, Kurzform-Zeile und Reihenfolge-Feld überleben das Tippen ([katalog-edit.ts](src/core/status/katalog-edit.ts), [phasenDrag.ts](src/plugins/status-cockpit/phasenDrag.ts), [KurzLabelPflege.tsx](src/plugins/status-cockpit/KurzLabelPflege.tsx))
- **Leere Grundlage heißt „unbeantwortbar", nicht „nichts"**: ohne geladene CSV-Spalten ruht kein Kürzel mehr, und kein Relevanz-Vorschlag markiert ruhende ([ruhende-kuerzel.ts](src/core/status/ruhende-kuerzel.ts), [katalog-edit.ts](src/core/status/katalog-edit.ts))

### v4.119.0 — Kuration-Hub: 23 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Sieben Sidebar-Seiten wurden mit v4.34 ein Hub; die Jagd suchte, **was beim Umzug liegen blieb**. Das Muster: die Oberfläche spricht weiter von etwas, das nicht mehr da ist — tote Plugin-Ids in drei Knöpfen, eine Karte ohne Inhalt, ein Untertitel, der eine verborgene Gruppe nennt, und die Zusage „nur lesbar", die drei Panels nicht hielten.

- **Alte Wege kommen an**: in prod endete jede `/kuration…`-Adresse auf leerer Fläche, drei Knöpfe zeigten auf Plugin-Ids, die es nicht mehr gibt, und das Lesezeichen „Programme" trägt jetzt seinen Abschnitts-Anker ([Router.tsx](src/core/Router.tsx), [routes.ts](src/core/routes.ts), [CsvAutoRefreshBanner.tsx](src/plugins/csv-sources-kuration/components/CsvAutoRefreshBanner.tsx))
- **„Nur nach Freischaltung" gilt für alle**: Sichtbarkeits-Marken und die Dienste-URL schrieben bei gesperrter Sitzung weiter team-weit; die Sperrseite nennt den Grund, den dieser Build wirklich hat, und „Sperren" hat einen Rückweg ([SichtbarkeitPanel.tsx](src/plugins/kuration/sichtbarkeit/SichtbarkeitPanel.tsx), [ModulSchlossGate.tsx](src/core/components/ModulSchlossGate.tsx), [useKuratorSeiten.ts](src/core/hooks/useKuratorSeiten.ts))
- **Keine Karte ohne Inhalt, kein Versprechen ohne Deckung** — `SettingsGruppe traegt` plus Guard `settings-karte-ohne-inhalt`, der eine dritte Fundstelle in den Einstellungen mitgefunden hat ([settings-layout.tsx](src/components/settings/settings-layout.tsx), [conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts))
- **Schreibende Wege halten, was sie beschriften**: „Nur Labels" schreibt nur Labels, ein Unterprogramm-Label lässt sich leeren, das gelöschte Standard-Programm bleibt gelöscht, der Filter-Assistent nennt das gewählte Feld ([unterprogrammLabelXlsx.ts](src/core/services/csv/unterprogrammLabelXlsx.ts), [programmRegistry.ts](src/core/services/csv/programmRegistry.ts), [FilterEditDialog.tsx](src/plugins/kuration/foerderprogramme/filter/dialogs/FilterEditDialog.tsx))
- **Zahlen und Statuszeilen nennen ihre Reichweite**: „nicht prüfbar" statt „noch kein Import", „Anträge mit Code", Zustand über alle Programme — und Dokument-Review hat ein eigenes Handbuch statt dem der Nachbarseite ([dokument-review.md](docs/feedback-kontext/dokument-review.md))

### v4.118.0 — Meilensteine & Fristen: 21 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Die read-only-Jagd über die Meilenstein-Oberfläche fand ein Muster: **die Anzeige behauptet mehr, als das Modell trägt.** Eine Restzeit, für die kein Meilenstein gilt; eine Reißquote ohne ihren Nenner; ein Leer-Satz, der eine Tatsache meldet, wo ein Filter greift. Dazu zwei stille Verluste — der geltende Plan fiel nach 21 Speicherungen aus der Historie, und „nur meine" traf 81 der 112 Kürzel im Bestand nie.

- **Kürzel folgen dem App-Vertrag** (uppercase, Komma-Trennung, „alle" = kein Filter, TIB **und** BIB; Vergleichs- und Anzeigeform getrennt) ([useMeilensteinStand.ts](src/plugins/meilensteine/useMeilensteinStand.ts), [monitoringLogic.ts](src/plugins/meilensteine/monitoringLogic.ts))
- **Die jüngste freigegebene Fassung überlebt die Historien-Kappung**; eine Bedingung `ist`/`ist nicht` **ohne Wert** wird verworfen statt für jeden Verbund wahr zu sein ([versionierung.ts](src/core/meilensteine/versionierung.ts), [plan-storage.ts](src/core/meilensteine/plan-storage.ts))
- **Betrachtungsbereich gilt für beide Hälften** — Abschlüsse waren ungefiltert (5.885 gegen 2.046) ([useMeilensteinStand.ts](src/plugins/meilensteine/useMeilensteinStand.ts))
- **Anzeige sagt, was sie weiß**: Prognose statt erfundener Restzeit, „Betrachtet"-Spalte als Nenner, „heute fällig" statt „in 0 T", markierte Ist-Termine vor dem Eingang, lesbare Zustands-Spalte, benannte Fassung ([meilensteine.md → Was die Anzeige nicht behaupten darf](docs/architecture/meilensteine.md))
- **Das Home-Widget „Fristen" bündelt je Vorgang** wie das Modul — acht Zeilen zeigten drei Akronyme ([fristAnlaesse.ts](src/plugins/home/widgets/fristAnlaesse.ts))

### v4.117.0 — Vorbelegung der Sichtbarkeit nachgezogen (August 2026)

MINOR — Die Vorbelegung aus v4.112 war ein Vorschlag; das Team ist sie durchgegangen und entscheidet an 13 Stellen anders. Solche Entscheidungen gehören zurück in den Katalog statt als Abweichung auf dem Share zu verharren — sonst erklärt die Sidecar irgendwann die halbe App.

- **Auf Standard**: Gutachten, Kurzfassung, Meilensteine, „Alle Felder" (Verbund-Detail) sowie „Suchsprache" und „Fragen" (Suche) ([katalog.ts](src/core/sichtbarkeit/katalog.ts))
- **Auf `beta`**: Statuseinträge, Werkbank, Widerspruch (Verbund-Detail) und die Seite „Dokumente"
- **Auf `experte`**: „Programme" und „CSV-Datenimport" der Datenpflege
- Bilanz: 199 Einträge, 46 markiert (23 `beta` / 18 `experte` / 5 beides); mit beiden Schaltern aus fehlen 8 der 18 Nav-Einträge ([sichtbarkeitsstufen.md](docs/architecture/sichtbarkeitsstufen.md))
- Kurator-Abweichungen auf dem Share bleiben unberührt — sie liegen über dem Katalog und schlagen ihn weiterhin

### v4.116.0 — Einstellungen: 48 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Die read-only-Jagd über 4.886 Zeilen fand ein Muster, nicht Einzelfälle: **zwei Stellen entscheiden dieselbe Frage, und nur eine wurde nachgezogen.** Registry gegen Anker, Seite gegen Bauteil, Einstellung gegen Startseite, Klick gegen Neustart. Dazu ein zweiter Faden — Zusagen, die niemand einlöst: ein Zähler ohne Nachzug, ein Häkchen an einer Farbe, die nicht mehr gilt, ein Suchtreffer, der auf nichts zeigt.

- **Alle vier Layout-Bauteile fragen die Beta-/Experten-Achse** — `SettingsKlappe`/`SettingsBlock` rendertem ihren Anker bedingungslos, 9 von 16 markierten Abschnitten blieben stehen (Guard `sichtbarkeit-alle-bauteile`, [settings-layout.tsx](src/components/settings/settings-layout.tsx))
- **Die Primärfarbe speichert alle drei Werte** (`theme.sat`/`lit`), Bestands-Profile werden über den Farbton geheilt; das Profil wird bei jeder Änderung in den persönlichen Ordner gespiegelt ([theme.ts](src/components/ui/theme.ts), [useProfile.ts](src/core/hooks/useProfile.ts))
- **Fachprofil**: Ersatz-Befüllung nimmt die Kompetenzen mit, beide Hydrationen weichen einer laufenden Eingabe aus, der Auto-Save fasst nach statt zu verwerfen ([useFachprofil.ts](src/plugins/einstellungen/profil/useFachprofil.ts))
- **Suche + Deep-Links**: Rangfolge statt Reihenfolge, Groß-/Kleinschreibung egal, sechs unerreichbare Anker registriert, unauflösbare Ziele sagen es (Guard „jeder DOM-Anker steht in der Registry", [panels.ts](src/components/settings/panels.ts), [SettingsHubPage.tsx](src/components/settings/SettingsHubPage.tsx))
- **Tags, Ordner, KI-Karten**: Umbenennen erreicht die Dokumente, Zähler aus dem Bestand, acht Ordner-Aktionen melden ihre Fehler, Entwurf und wirksame Adresse getrennt ([tags.ts](src/core/services/tags.ts), [OrdnerGruppe.tsx](src/plugins/einstellungen/daten/OrdnerGruppe.tsx), [VerbindungGruppe.tsx](src/plugins/einstellungen/ki/VerbindungGruppe.tsx))

### v4.115.2 — Guard: die Kontext-Reserve muss das Output-Budget decken (August 2026)

PATCH — v4.115.1 hat die Reserve korrigiert, aber nichts hielt sie am Output-Budget fest: zwei unabhängige Zahlen, deren Verhältnis niemand nachrechnete. Genau daran scheiterte sie jahrelang unbemerkt — ein Kontext-Überlauf meldet sich nicht, er schiebt den System-Prompt hinaus.

- **Guard `reserve-deckt-output-budget`** — `RESERVE_TOKENS` muss `DEFAULT_MAX_TOKENS + THINKING_OUTPUT_HEADROOM` decken **und** jedes Seed-`maxTokens` tragen ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts))
- Adversarisch geprüft: mit der alten Reserve (4.096) schlagen beide Testfälle an — der Guard hätte den Bug gefangen
- Positiv-Kontrolle im Scan (22 gefundene Budgets): ein Guard, der nichts mehr findet, ist grün statt wirksam
- Die drei Konstanten sind dafür exportiert; `map-infografik` (8192) trägt eine begründete Ausnahme — es läuft über `runBaustein`, das nie `capVbMarkdown` ruft ([map-infografik.seed.ts](src/core/services/skills/registry/map-infografik.seed.ts))
- Nebenbefund: neun Seeds liegen bei genau 4096 — die 12.288 sind exakt die bindende Grenze, nicht großzügig gewählt

### v4.115.1 — Zeichen-Cap an der gemessenen Token-Quote (August 2026)

PATCH — Ein 220.000-Zeichen-Antrag (~20.000 Wörter, 23 Tabellen) galt als „länger als das Kontextfenster", obwohl er in der internen KI nur 42k von 62k Tokens belegt. Der Cap ist abgeleitet, nicht gesetzt — und beide Faktoren der Ableitung waren geraten, nicht gemessen.

- **Zeichen/Token-Quote 3 → 4,8** — gemessen statt als Sicherheitsmarge gesetzt (220.000 Zeichen ≙ 42k Tokens = 5,24, davon ~8 % Abzug); die alte Quote unterschätzte um Faktor 1,7 ([llm-context.ts](src/core/services/ai/llm-context.ts))
- **Token-Reserve 4.096 → 12.288** — bei aktivem Thinking belegt allein der Output 10.240 Tokens, das deckte die alte Reserve nie ([run-skill.ts](src/core/services/skills/run/run-skill.ts))
- Cap der Standard-KI damit 173.712 → **238.617** Zeichen, Default-Fenster → 334.233, agentisch → 1.198.617
- `computeVbCharCap` rundet ab — die Quote ist gebrochen, ein Zeichen-Cap ist eine ganze Zahl
- Beide Konstanten tragen Messwert + Verfahren im Kommentar: bei Wechsel des internen Modells neu messen

### v4.115.0 — Sichtbarkeits-Katalog als Baum (August 2026)

MINOR — 192 Zeilen in 21 Kästen hießen, an neunzig Zeilen vorbeizuscrollen, um eine zu finden. Und der An-Zustand einer Marke unterschied sich vom Aus-Zustand nur durch einen Hauch kräftigeren Rand.

- **Baum statt Kästen** — zugeklappt 21 Zeilen auf 490 px, also eine Bildschirmhöhe ohne Seiten-Scroll; die Seite ist ihr eigener Ordner und trägt ihre Marken in derselben Zeile ([sichtbarkeitBaum.ts](src/plugins/kuration/sichtbarkeit/sichtbarkeitBaum.ts), `TfTree`)
- **„N markiert" an der zugeklappten Seite** — sonst müsste man alle 21 öffnen, um zu sehen, wo überhaupt etwas festgelegt ist
- **Der An-Zustand trägt Fläche** — `Beta` in der Farbe des Abzeichens, das es erzeugt (6,3:1), `Experte` neutral gefüllt (19,5:1), aus bleibt ein Umriss (5,3:1) ([SichtbarkeitPanel.tsx](src/plugins/kuration/sichtbarkeit/SichtbarkeitPanel.tsx))
- **Rückstellen als Zeichen statt als Satz** — „zurück auf Vorgabe (Standard)" sprengte die Zeile; jetzt ein Pfeil-Knopf, dessen Tooltip die Vorgabe nennt
- Kein neuer Baum-Nachbau: `TfTree` mit `trailing`-Slot und `stopPropagation`, Adapter rein ([tree-komponenten.md](docs/architecture/tree-komponenten.md))

### v4.114.0 — Karten der Fachseiten kennzeichenbar (August 2026)

MINOR — Nachzug zu v4.112: dort endete der Katalog bei Seite und Reiter, die Karten der großen Fachseiten standen nur als JSX da. Jetzt tragen auch sie eine Id — 192 Einträge statt 173.

- **19 Karten aufgenommen** — Vorgangs-Regeln (2), Auslastung (6), Vorgangs-Board (4), Antrag-Aufbereitung (7); Hülle ist `<WennSichtbar>` mit der Id als Literal ([katalog.ts](src/core/sichtbarkeit/katalog.ts), [sichtbarkeitsstufen.md](docs/architecture/sichtbarkeitsstufen.md))
- **Nur eine trägt selbst eine Marke** — die Karte „Externe Recherche" ist `experte` wie der Reiter, auf den sie zeigt; die übrigen 18 sind Griffe für den Kurator, ihre Wirte sind bereits markiert (Regel 1)
- **Kein Verweis mehr auf einen verborgenen Reiter** — „Tab öffnen" im Aufbereitungs-Stepper erscheint nur, wenn es den Reiter für diesen Leser gibt ([UebersichtTab.tsx](src/plugins/antraege/aufbereitung/UebersichtTab.tsx))
- **Trennstriche verschwinden mit ihrer Karte** — die Verwaltungs-Sektionen der Auslastung stehen als gefilterte Liste, nicht als feste JSX-Folge ([EinstellungenView.tsx](src/plugins/auslastung/views/EinstellungenView.tsx))
- **Guard `sichtbarkeit-ids-existieren`** in beiden Richtungen: keine Id ohne Katalog-Eintrag, kein Karten-Eintrag ohne Hülle ([katalog-konventionen.test.ts](src/core/sichtbarkeit/__tests__/katalog-konventionen.test.ts))

### v4.113.0 — Zehn Befunde der Aehnlichkeitsstufe behoben (August 2026)

MINOR — Aus der erschöpfenden Bug-Jagd an der Ähnlichkeitsstufe: zehn Befunde, alle am echten Bestand gemessen (14 225 Anträge, 14 065 Vektoren) und adversarisch geprüft. Der schwerste zuerst — der Vektor eines Vorhabens kannte nie seinen Inhalt, nur seinen Titel.

- **Der Vektorkorpus kennt die Projektbeschreibung** — die Quell-Spalten kommen aus dem CSV-Schema statt aus geratenen Schlüsseln; `projektbeschreibung_text` war in 0 von 14 225 Sätzen gefüllt. Build-Version v3, **einmal neu bauen nötig** ([embedding-corpus.ts](src/plugins/auslastung/services/matching/embedding-corpus.ts), Guard in [conventions-daten](src/__tests__/conventions-daten.test.ts))
- **Der Korpus führt eine Signatur** — Modell, Dimension, Präfix, Textversion; ein inkrementeller Lauf verlängert keinen fremden Vektorraum mehr, und das Manifest stempelt den erzeugenden statt den aktiven Stand ([signatur.ts](src/core/services/embedding-corpus/signatur.ts))
- **Der Suchbereich gilt auch für die Ähnlichkeit** — „nur Einrichtung" und „nur Dokumente" legen die Stufe still, statt das ausgeschlossene Thema zurückzugeben; die Zeile sagt es an ([suchbereich.ts](src/core/services/search/suchbereich.ts))
- **Der Deckel verwirft keine neuen Treffer mehr** und der Rechenschaftssatz nennt die Zahl VOR dem Deckel plus das, was er zurückhielt ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts), [aehnlichkeitsSatz.ts](src/plugins/suche/aehnlichkeitsSatz.ts))
- Sechs Kleinere: trainierter Anfrage-Präfix statt selbst formuliertem, Modell lädt erst bei Bedarf, „lädt" heißt nicht mehr „fehlgeschlagen", Halbkorpus heilt, Einschalten verliert keinen Dokumenttreffer, der Indexer räumt alte Chunks ([suche-relevanz.md §8](docs/architecture/suche-relevanz.md))

### v4.112.0 — Beta-Funktionen und Expertenmodus (August 2026)

MINOR — 19 Plugins, ~75 Reiter, ~68 Abschnitte, 16 Widgets: vieles davon ist Erprobung oder Tiefenwerkzeug und stand doch gleichberechtigt neben dem Tagesgeschäft. Eine vierte Sichtbarkeits-Achse räumt auf — sie beantwortet „will ich das sehen?", nicht „darf ich das?".

- **Zwei unabhängige Marken, UND-verknüpft** — Reife (`beta`) und Zielgruppe (`experte`); was beides trägt, braucht beide Schalter. Eine einzige Stufe hätte „neu für alle" und „neu für Profis" in denselben Topf geworfen ([sichtbarkeitsstufen.md](docs/architecture/sichtbarkeitsstufen.md), Pitfall #54)
- **Zwei Schalter im Profil** (beide aus), mit Zähler, der den echten Zugewinn im aktuellen Stand des anderen nennt ([UmfangGruppe.tsx](src/plugins/einstellungen/profil/UmfangGruppe.tsx))
- **Kurator-GUI „Sichtbarkeit"** im Datenpflege-Hub: Baum aus Seite → Reiter → Abschnitt plus Widgets, zwei Marken je Zeile, Abweichungs-Sidecar `_intern/sichtbarkeit.json` über der Code-Vorbelegung ([SichtbarkeitPanel.tsx](src/plugins/kuration/sichtbarkeit/SichtbarkeitPanel.tsx))
- **173 Einträge vorbelegt**, 43 markiert (20 Beta, 19 Experte, 4 beides) — mit beiden Schaltern aus verschwinden 7 der 18 Nav-Einträge samt ihrer Reiter ([katalog.ts](src/core/sichtbarkeit/katalog.ts))
- Sieben Guards halten die Regeln: eine Frage-Stelle, keine Doppelmarke, Unantastbares unantastbar, keine Seite ohne Reiter ([katalog-konventionen.test.ts](src/core/sichtbarkeit/__tests__/katalog-konventionen.test.ts))

### v4.111.0 — Die Suchseite haelt ihre Zusagen (August 2026)

MINOR — Aus der erschöpfenden Bug-Jagd auf der Suchseite: sieben Befunde, alle gemessen und adversarisch geprüft. Gemeinsamer Nenner — die Seite sagte etwas zu („die häufigsten fünf", „+385 seit zuletzt", „422 Treffer"), das an der Stelle daneben nicht galt.

- **Ein Spaltenfilter gilt für beide Ansichten** und steht als entfernbarer Chip neben den Facetten; die Liste sortiert die spaltengefilterte Menge, nicht die davor ([SpaltenFilterChips.tsx](src/plugins/suche/SpaltenFilterChips.tsx), Guard in [conventions-ui](src/__tests__/conventions-ui.test.ts))
- **„Die häufigsten fünf" sind es jetzt** — die Stöbern-Vorschau ordnet nach Häufigkeit statt alphabetisch; Sachsen (2 742) statt Bremen (306) ([suche-relevanz.md §9.3](docs/architecture/suche-relevanz.md))
- **Werte mit Anführungszeichen sind wieder auffindbar**: Anfrage und Korpus legen dasselbe ab (13 von 5 407 Einrichtungen, `ast:"EIKBOOM …"` 0 → 2) ([suche-relevanz.md §9.4](docs/architecture/suche-relevanz.md))
- **„Häufig gesucht" zählt wirklich** und „+N seit zuletzt" misst beide Seiten mit derselben Latte ([anfrage-verlauf.ts](src/core/services/search/anfrage-verlauf.ts), [useGespeicherteSuchen.ts](src/plugins/suche/useGespeicherteSuchen.ts))
- Kleiner: `ort:Dresden` verspricht kein Bundesland mehr, das Merk-Datum ist der lokale Tag ([suchsprache.ts](src/plugins/suche/start/suchsprache.ts), [gespeicherteSuchen.ts](src/plugins/suche/gespeicherteSuchen.ts))

### v4.110.0 — Die Aehnlichkeitsstufe legt Rechenschaft ab (August 2026)

MINOR — Gemeldet: „auch ähnliche Themen" eingeschaltet, Trefferzahl unverändert, nach 20 s dieselbe KI-Antwort. Nachgemessen: die Stufe lief und fand 2 Kandidaten, einer neu — sichtbar war davon nichts. Ein Messfeld ohne Urteil meldet keinen Stillstand.

- **Der Schalter legt Rechenschaft ab**: „9 thematisch verwandte Vorhaben, 8 davon neu" / „alle standen schon im Wortlaut-Ergebnis" / „kein Vorhaben über der Schwelle" ([aehnlichkeitsSatz.ts](src/plugins/suche/aehnlichkeitsSatz.ts))
- **Die Reichweite steht dabei** — „Vergleichbar sind 1.086 von 14.225 Vorhaben"; ohne Vektor kann nichts ähnlich sein ([suche-relevanz.md §8.5](docs/architecture/suche-relevanz.md))
- **Relative Schwelle 0,85 statt 0,90** — nicht Floor und nicht TOP_K bremsten, sondern das enge Band; Messtabelle über fünf Fragen im Service ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts))
- Am selben Lauf gemessen: **2 Kandidaten → 9, davon 8 neu; 136 → 143 Treffer**
- Unverändert: der Deckel für reine Ähnlichkeitstreffer (nie über einem Wortlaut-Treffer)

### v4.109.0 — Das Suchfeld schlaegt Fragen vor (August 2026)

MINOR — Gewünscht: das Dropdown im Frage-Modus der Suche nach dem Vorbild der Förderanträge. Dort schwieg die Vervollständigung (niemand tippt `ort:` in einen Satz), übrig blieb der nackte Verlauf — und der beantwortet nicht, was man hier überhaupt fragen kann.

- **Mechanik geteilt, Katalog je Seite**: Abschnitte, Lücken `‹…›` und Tastatur liegen jetzt in [frage-vorschlaege](src/components/frage-vorschlaege/abschnitte.ts), beide Seiten reichen ihren `FrageKatalog` herein
- **Der Katalog der Suche** kennt Thema, Ort, Jahr und Stand — die Achsen, die ihr Frageplan wirklich setzt ([katalog.ts](src/plugins/suche/frage/katalog.ts))
- **Eine Liste, zwei Orte**: `FRAGEN` speist Dropdown und Reiter „Fragen" des Startzustands; zwei Vorräte liefen auseinander
- **Eine halbe Frage erreicht die KI nie** — `frageStellen` bricht bei offener Lücke ab, der Knopf ist gesperrt ([suche-relevanz.md §8.4](docs/architecture/suche-relevanz.md))
- **Erst ab dem ersten Zeichen**, damit die Reiterleiste des Startzustands frei bleibt (Regel aus v4.107.1)

### v4.108.0 — Suchfeld ziehbar, Quickfilter gehoeren zum Reiter (August 2026)

MINOR — Gewünscht: „Suchfeld breiter machen (die Breite von Suche in Stichworten nehmen). Bei Suche mit Frage Textfeld vertikal resizable machen." Dazu die Zusage von v4.107.2, die Quickfilter in die Reiter-Räumung zu ziehen — beim Bauen zeigte sich, dass sie stattdessen zum Reiter gehören müssen.

- **Ein Feld, zwei Betriebsarten**: Stichworte einzeilig, Frage mehrzeilig mit ziehbarer Unterkante und gemerkter Höhe ([SuchFeld.tsx](src/plugins/antraege/SuchFeld.tsx))
- **Gleiche Breite in beiden**: die Zeile bricht um, statt das Feld zu stauchen (gemessen 640 px hier wie dort)
- **Die Quickfilter-Pillen gehören zum eigenen Reiter** — gespeichert, wiederhergestellt und identitätsstiftend; ein Reiter „PreCheck offen" trug bisher nur den Namen ([eigeneReiter.ts](src/plugins/antraege/eigeneReiter.ts))
- **Ältere gemerkte Reiter** bekommen beim Laden „keine Einschränkung" nachgefüllt (`ergaenzeQuickfilter`)
- **Höhe im Callback-Ref herstellen und überwachen**, nicht im Effekt (Bug-Klasse 23): das Element wechselt mit dem Modus die Sorte

### v4.107.2 — Vom eigenen Reiter zurueck auf einen festen (August 2026)

PATCH — Gemeldet: „wenn ich eigene Suche als Tab gespeichert habe, geht die Umschaltung zu anderen Tabs (insb. zum ersten Tab Antragsphase) nicht mehr." Die Markierung des eigenen Reiters hängt an der Signatur des Stands — sitzt er auf derselben Basis, ändert `setActiveView` nichts an ihr, und der Klick war ein Nichts.

- **Der Klick auf einen festen Reiter verlässt den eigenen** (`verlasseEigenenReiter`) ([reiterZustand.ts](src/plugins/antraege/reiterZustand.ts))
- **Abgeräumt wird der Ausschnitt, nicht die Anordnung**: Filterleiste, Kopf-Auswahl und Beendet-Sicht gehen, Spaltensatz und Dichte bleiben eine Vorliebe
- **Gemessen in dev:local**: eigener Reiter 799 → Antragsphase 845 → und zurück, Filterzähler 1 → 0 ([verlasseEigenenReiter.test.ts](src/plugins/antraege/__tests__/verlasseEigenenReiter.test.ts))

### v4.107.1 — Das Vorschlags-Dropdown deckt die Suchhilfen nicht mehr zu (August 2026)

PATCH — Gemeldet: das Verlaufs-Dropdown verdeckt die Reiterleiste der Suchhilfen komplett. Es zeigte dort denselben Verlauf, den der Reiter „Zuletzt" zwei Zeilen tiefer ungekürzt führt — und nahm dafür „Alle · Zuletzt · Suchsprache · Fragen · Stöbern" weg.

- **Beim leeren Feld bleibt die Liste zu** — eine Bedingung für Anzeige, Tastatur und `aria-expanded` ([vervollstaendigung.ts](src/plugins/suche/vervollstaendigung.ts))
- Nicht durchsichtig gemacht: die Fläche fängt die Klicks weiterhin ab, und Text auf Text fällt unter AA ([DESIGN_GUIDE.md](DESIGN_GUIDE.md))

### v4.107.0 — Die getippte Frage filtert die Liste nicht mehr (August 2026)

MINOR — Gemeldet: „habe getestet, es wurde gar keine KI genutzt." Der Fragesatz lief beim Tippen sofort als Wortlaut-Suche mit und traf über Titel und Antragsteller nichts: die Liste war leer, alle Pillen standen auf „Alle" — es sah aus wie ein KI-Ergebnis. Gefragt worden war nie jemand.

- **Der Fragesatz ist kein Suchbegriff** — eine Quelle für Liste und Hybrid-Suche, statt zweier Leser von `search` ([suchtext.ts](src/plugins/antraege/frage/suchtext.ts), [antrags-frage.md](docs/architecture/antrags-frage.md))
- **Auch ein erfolgreicher Lauf ohne Themen sucht nicht im Wortlaut**: der Normalfall (Status + Jahr + PreCheck) nennt kein Thema und hätte leer zurückgegeben
- **Knopf „Frage stellen"** wie in der Dokumenten-Suche, dazu die Zeile „Noch nicht gestellt …" ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx))
- **Umschalter und Knopf stehen rechts vom Feld** — erst schreiben, dann die Suchart, dann abschicken
- **`frageModus`/`frageGestellt` im Antrags-Store** statt in einem eigenen: die Frage entscheidet mit, ob der Feldtext eine Anfrage ist ([store.ts](src/plugins/antraege/store.ts))

### v4.106.1 — Frage stellen ist ein Knopf wie die anderen (August 2026)

PATCH — Gemeldet: der Knopf neben dem Suchfeld ist größer als die CTAs sonst in der App. Er war auch keiner — ein hand-gebauter `<button>` mit eigenem Fill, am `<Button>` vorbei, den [DESIGN_GUIDE.md](DESIGN_GUIDE.md) dafür vorschreibt.

- **„Frage stellen" ist jetzt `<Button variant="primary" size="sm">`** — 28 statt 36 px, wie die 412 anderen `size="sm"` in der App ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Kein Text-Tausch mehr im Ladezustand** („Übersetze…"): Spinner + Sperre kommen aus `loading`, wie im Design-Guide vorgeschrieben

### v4.106.0 — Vorschlaege fuer den Frage-Modus der Foerderantraege (August 2026)

MINOR — Gewünscht waren Vorschläge für den Frage-Modus: vergangene Fragen, konkrete Beispiele und Vorlagen zum Ausfüllen. Ein leeres Feld, das einen ganzen Satz erwartet, zeigte bis dahin genau ein Beispiel im Platzhalter — welche Achsen es sonst gibt, stand nirgends.

- **Drei Abschnitte in einer Liste** — Zuletzt gefragt · Beispielfragen · Zum Ausfüllen, mit einer Auswahlmarke über alle ([vorschlagsAbschnitte.ts](src/plugins/antraege/frage/vorschlagsAbschnitte.ts), [antrags-frage.md](docs/architecture/antrags-frage.md))
- **Fertige Frage gegen halbe Frage**: Verlauf und Beispiel werden gestellt, eine Vorlage nur eingesetzt — der Cursor landet markiert auf der ersten Lücke `‹…›` ([useFrageVorschlaege.ts](src/plugins/antraege/frage/useFrageVorschlaege.ts))
- **Enter springt zur nächsten Lücke**, statt eine halbe Frage an die KI zu schicken ([FrageVorschlaege.tsx](src/plugins/antraege/frage/FrageVorschlaege.tsx))
- **Gemerkt wird erst, was übersetzt werden konnte** — gerätelokal und getrennt vom Verlauf der Dokumenten-Suche ([frageVerlauf.ts](src/plugins/antraege/frage/frageVerlauf.ts))
- **Die Verlaufs-Mechanik steht jetzt einmal** statt in der Such-Seite, die eine React-Komponente hinter sich herzöge ([anfrage-verlauf.ts](src/core/services/search/anfrage-verlauf.ts))

### v4.105.1 — Die gezaehlte Gruppe steht in den Belegen (August 2026)

PATCH — Gemeldet: „die Antwort ist nicht hilfreich, wenn die 4 nicht gelistet sind". Der Befund zählte „4 von 499 tragen ALLE gefragten Themen", die Antwort erklärte sie für nicht im Auszug enthalten — sie standen auf den Plätzen 1 bis 4. Keine Belegzeile wies die Gruppe aus, also konnte das Modell sie zählen, aber nicht benennen.

- **Die Belegzeile beschriftet die Gruppe** („trägt ALLE gefragten Themen", erst ab zwei gefragten Sachen) ([assistentKontext.ts](src/plugins/suche/assistentKontext.ts))
- **Die Auswahl zieht sie nach vorn** — Relevanz allein garantiert nicht, dass sie unter die 40 Belege kommt ([suche-relevanz.md §8.3](docs/architecture/suche-relevanz.md))
- **Die Prompt-Regel hängt an der Marke selbst**: einzeln nennen statt zählen, und nie behaupten, sie fehlten ([frageantwort-lauf.ts](src/core/services/search/frageantwort-lauf.ts))
- **Eine Schwelle für Zählen und Beschriften** (`traegtAlleThemen`) statt zweier Vergleiche auf dieselbe Gruppe ([trefferstelle.ts](src/core/services/search/trefferstelle.ts))

### v4.105.0 — Frage an die Foerderantrags-Liste (August 2026)

MINOR — Gewünscht war die Frage in natürlicher Sprache auch für die Förderanträge. Die Fragen dort sind aber anderer Art als in der Dokumenten-Suche: sie nennen kein Thema, sondern Metadaten-Kombinationen („alle Netzwerke, die für Phase 2 abgelehnt wurden"). Übernommen wurde deshalb das Muster, nicht der Frageplan.

- **Die Frage setzt die vorhandenen Filter** statt einer eigenen Trefferliste — Pillen und Chips zeigen, was verstanden wurde, und bleiben einzeln korrigierbar ([antrags-frage.md](docs/architecture/antrags-frage.md))
- **Stillstand als eigene Achse**: „seit wann kein neues Kürzel", auch ohne Frage per Klick. Ohne datierbares Kürzel lautet das Urteil **„nicht prüfbar"**, nie „läuft" ([letzteAktivitaet.ts](src/plugins/antraege/frage/letzteAktivitaet.ts))
- **Kürzel-Ausschnitt aus einer Frage** — die Liste konnte bisher nur das eigene Profil-Kürzel; bei fester Identität (MA-Login) greift er bewusst nicht ([useBearbeiterSicht.ts](src/core/hooks/useBearbeiterSicht.ts))
- **Eine tote Statuskategorie wird gar nicht erst angeboten**: `abgelehnt` hat im Katalog null Rohwerte, ein Filter darauf verglich nichts ([antragsplan.ts](src/plugins/antraege/frage/antragsplan.ts))
- **Die sechs Pflichten eines einschüssigen KI-Laufs stehen jetzt einmal** statt in drei Dateien; Frageplan, Frageantwort und Wortformen-Prüfung laufen darüber ([ein-schuss-lauf.ts](src/core/services/ai/ein-schuss-lauf.ts))

### v4.104.0 — Belege und Vorschlaege getrennt an die KI (August 2026)

MINOR — Vorgeschlagen wurde, dem großen Kontext mehr Treffer zuzumuten und die Ähnlichkeits-Treffer als zweite Menge zu schicken, damit das Modell selbst entscheidet, ob einer dazugehört. Beides trifft zu: 20 Belege waren eine Vorsicht ohne Grund, und untergemischte Vorschläge waren von Funden nicht zu unterscheiden.

- **40 statt 20 Belege** — gemessen 355 Zeichen je Zeile über 12 180 Anträge, also 14 209 statt 7 105 unter einem Deckel von 24 000 ([useFrageAntwort.ts](src/plugins/suche/antwort/useFrageAntwort.ts))
- **Ähnlichkeits-Treffer fahren als eigene, benannte Menge mit** (bis zu 12) — das Modell prüft sie einzeln und muss „(thematisch verwandt)" hinter das Kennzeichen schreiben ([frageantwort-lauf.ts](src/core/services/search/frageantwort-lauf.ts), [assistentKontext.ts](src/plugins/suche/assistentKontext.ts))
- **Eine Gesamtzahl bleibt eine**: der Befund nennt die Zusammensetzung in derselben Zeile („671, davon 75 nur thematisch ähnlich") ([frageBefund.ts](src/plugins/suche/frageBefund.ts))
- **Kandidaten allein reichen für einen Lauf** — eine Frage, die nur thematisch trifft, bekommt trotzdem eine Antwort statt „keine Treffer"
- **Warum das die Rang-Frage erledigt**: die Vorschläge konkurrieren nicht mehr um die 40 Plätze ([suche-relevanz.md §8.2](docs/architecture/suche-relevanz.md))

### v4.103.1 — Der Schalter sagt, was er bei einer Frage tut (August 2026)

PATCH — Gefragt wurde, ob „auch ähnliche Themen" bei einer Frage überhaupt Sinn ergibt und was der Haken dort bewirkt. Er tut dort etwas anderes als bei Stichworten — verglichen wird die ganze Frage —, und das stand nirgends außer im Quelltext.

- **Eigener Tooltip im Frage-Modus**: ganze Frage statt Suchbegriffe, bis zu 50 zusätzliche Vorhaben, gedeckelt auf „mittel", nichts davon bei einer einschränkenden Frage ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx))
- **Nicht gebaut, weil vorhanden**: schränkt der Plan ein, steht an der Stelle des Hakens schon seit v4.66 „ohne Ähnlichkeitssuche" samt Begründung
- **Nicht automatisch eingeschaltet** — die Antwort-KI liest die ersten 20 Treffer, gedeckelte Ähnlichkeits-Treffer erreichen sie fast nie, zählen aber im Befund mit ([useFrageAntwort.ts](src/plugins/suche/antwort/useFrageAntwort.ts))
- **Die Zahlen stehen im Seiten-Kontext-Doc** ([suche.md](docs/feedback-kontext/suche.md))

### v4.103.0 — Vorgangs-Board und Vorgangs-Regeln laden beim Wiederbesuch sofort (August 2026)

MINOR — Beide Seiten rechneten bei JEDEM Menü-Aufruf den ganzen Bestand neu — gemessen 7,8–18,2 s (Board) bzw. 10,8–12,4 s (Regeln), auch beim Wiederbesuch. Gemeldet als „dauert es bei jedem Aufruf 5 Sekunden ehe die Seiten Inhalte anzeigen".

- **Ergebnis überlebt den Seitenwechsel**: Wiederbesuch < 1 s (Board) bzw. 126 ms (Regeln), mit sichtbarem Alter + „neu berechnen" ([boardCache.ts](src/plugins/vorgangs-board/boardCache.ts), [cockpitCache.ts](src/plugins/status-cockpit/cockpitCache.ts), [BestandsFrische.tsx](src/components/ui/BestandsFrische.tsx))
- **Fassungs-Indizes einmal je Fassung statt je Antrag** — Wächter 2 459 → 602 ms, Neuberechnung gesamt 10,5 → 5,3 s ([version-index.ts](src/core/status/version-index.ts))
- **Kompilierter Vorkommen-Plan + Kaskaden-Index** statt Closure/Sortierung je Antrag ([feld-aufloesung.ts](src/core/status/feld-aufloesung.ts), [todo-engine.ts](src/core/status/todo-engine.ts))
- **`stand.json` + Trigger-Parse je Sitzung einmal**, `filterRecord` auf die sechs Kürzel-Spalten eingedampft ([stand.ts](src/core/status/journal/stand.ts), [trigger-share.ts](src/core/status/trigger-share.ts), [boardFilter.ts](src/plugins/vorgangs-board/boardFilter.ts))
- **Gechunktes Lesen wurde gemessen und VERWORFEN** (28 Transaktionen statt einer, ~7 s teurer) — der Absatz steht im Code, damit es niemand erneut „verbessert" ([vorgangs-quelle.ts](src/core/status/vorgangs-quelle.ts))

### v4.102.2 — Der Chip filtert auch die Tabelle (August 2026)

PATCH — Der Chip „nur die genannten 6" filterte Kopfzahl, Liste und Export, die **Tabelle** aber nicht: über 671 Zeilen stand „6 Treffer". Gemeldet als „obwohl ‚nur 6' an ist, werden in der Tabelle weiterhin alle Ergebnisse angezeigt".

- **Die Tabelle bekommt dieselbe Menge wie alle anderen Anzeigestellen** ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Guard `suche-eine-gezeigte-menge`**: Kopfzahl, Liste, Tabelle, Export und KI-Kontext müssen denselben Namen nennen — nachgewiesen scharf (Rückbau ⇒ rot) ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts))
- **Die zweite Meldung („KI-Antwort nur für 5 der 6") war dieselbe Ursache** — der sechste Beleg stand weiter unten in der ungefilterten Tabelle; die Zerlegung liefert für den echten Antworttext sechs Belege ([genannteTreffer.test.ts](src/plugins/suche/antwort/__tests__/genannteTreffer.test.ts))
- **Antwortkarte + Chip stehen jetzt im Seiten-Kontext-Doc** ([suche.md](docs/feedback-kontext/suche.md))

### v4.102.1 — CSV-Quellordner darf nicht der eigene Kopie-Ordner sein (August 2026)

PATCH — Auf der Entwickler-Maschine importierte die App bei JEDEM Reload alle drei CSV-Quellen, obwohl sich kein Export geändert hatte. Nicht die Erkennung war schuld: `dev:local` las den Ordner, in den die App ihre eigene UTF-8-Kopie schreibt, `zah-pl` den echten Export — zwei Dateien, ein Schema-Record, 195× hin- und hergekipptes `encoding` bei null inhaltlicher Änderung.

- **`csvSourceDir` der Variante „local" zeigt auf den Export-Ordner**, nicht mehr in den Daten-Share ([local.config.json](configs/local.config.json))
- **`istEigenerKopieOrdner` meldet den Fall zur Laufzeit** — einmal je Lauf in `collectCandidates`, als Warnung + Audit-Eintrag, ohne den Lauf abzubrechen ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts))
- **Convention-Test `csv-quellordner-nicht-kopieordner`** hält alle Configs davon frei ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts))
- **Wiederholte Encoding-Heilung ist ein eigener Befund** — Hergang, Messung und Audit-Grep als Erstdiagnose ([csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md), [local-variante.md](docs/architecture/local-variante.md))

### v4.102.0 — Die Auswahl fragt selbst (August 2026)

MINOR — Zwei Meldungen aus dem Test, beide über eine Geste zu viel: eine Frage aus dem Verlauf stand nach der Auswahl nur im Feld und wartete auf einen zweiten Klick, und über ihr stand ein Richtlinien-Chip, der noch gar nichts gefiltert hatte.

- **Eine ausgewählte Anfrage läuft sofort** — Verlaufs-Zeile im Vorschlagsfeld wie Zeile unter „Zuletzt gesucht"; im Frage-Modus geht sie damit direkt an die interne KI ([SearchInput.tsx](src/plugins/suche/SearchInput.tsx), [SucheStartzustand.tsx](src/plugins/suche/SucheStartzustand.tsx))
- **Feldnamen und Werte laufen weiterhin nicht los** — sie sind ein Stück Anfrage, kein Auftrag; die Auswahl tut genau das, was die Eingabetaste täte
- **Der Richtlinien-Chip verschwindet bei offener Frage** und steht sonst wie bisher im Ergebniskopf bzw. im Startzustand ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Pitfall #46 präzisiert**: keine heruntergezählte Zahl ohne Chip — und kein Chip, wo keine Zahl steht ([vorgangssystem.md §10](docs/architecture/vorgangssystem.md))

### v4.101.0 — Ein Fragezeichen mitten im Wort (August 2026)

MINOR — 306 der 733 Netzwerke führen mehr als eine Schreibweise ihres Namens; bei `mobiInspec` gegen `mobilnspec` erreichte keine feste Nadel beide Hälften. Dazu zwei Meldungen aus dem Test: die Marke der KI-Antwort fehlte in der Tabellenansicht, und der Richtlinien-Chip stand nicht bei der Zahl, auf die er wirkt.

- **`?` steht für genau ein Zeichen** — überall außer am Wortende, wo es das Fragezeichen einer Frage bleibt ([wortstamm.ts](src/core/services/search/wortstamm.ts))
- **Vor dem Bau gemessen**: der Muster-Pfad kostet 4,7 ms gegen 5,8 ms heute (12 358 Anträge × 6 Felder) — teuer ist nur eine zu weite Anfrage, dagegen steht die Drei-Zeichen-Grenze ([suche-relevanz.md](docs/architecture/suche-relevanz.md))
- **Spalte „KI-Antwort" in der Tabelle** — dieselbe Auskunft wie die Marke in der Liste, Kurzform in der Zelle, ganzer Satz im Tooltip und im Export ([antwortSpalte.ts](src/plugins/suche/antwort/antwortSpalte.ts))
- **Der Richtlinien-Chip steht im Ergebniskopf**, direkt hinter „180 Treffer in 14.225 Anträgen"; ohne Ergebnis weiter über den Facetten ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Am Bestand nachgemessen**: `mobi?nspec` 33 · `16KN0830?1` 14 · `Normung?` 0 · `????` 0

### v4.100.0 — Verwaltungsnotizen raus aus der Suche, Antwort rein in die Liste (August 2026)

MINOR — Zwei Meldungen, eine Wurzel: die Suche zeigte Dinge nebeneinander, die nicht zusammengehören, und trennte, was zusammengehört. Gemeldet als „warum kann ich die Spalte Notiz nicht abwählen, da steht oft was mit Vollmachten" und „wie kann der User die Liste der KI ganz oben mit den Suchergebnissen darunter zusammenbringen?".

- **Die Arbeitsnotizen laufen nicht mehr im Standard mit** — sie hängen am Vorgang, nicht am Vorhaben: 1.054 der 5.345 Notizen nennen eine Vollmacht ([suchbereich.ts](src/core/services/search/suchbereich.ts))
- **Der Standardbereich heißt „alle Vorhabensfelder"** statt „alle Felder"; die drei Ausnahmen stehen benannt in `NICHT_IM_STANDARD`, der Guard hält es bei dreien
- **Der Klick auf ein Kennzeichen in der Antwort springt in die Liste** statt die Suche zu verlassen — die Liste lädt dafür bis zur Zielzeile nach ([useAntwortBruecke.ts](src/plugins/suche/antwort/useAntwortBruecke.ts))
- **Genannte Treffer tragen die Marke „in der Antwort"** und den Satz der KI als Kurzform, den vollen im Tooltip — ohne zweiten KI-Aufruf ([genannteTreffer.ts](src/plugins/suche/antwort/genannteTreffer.ts))
- **Chip „nur die genannten (13)"** hinter den Facetten; der Antwort-Lauf bleibt bewusst auf der ungefilterten Menge ([GenannteChip.tsx](src/plugins/suche/antwort/GenannteChip.tsx))

### v4.99.0 — Ein Ordner sagt, ob er eine Spalte traegt (August 2026)

MINOR — Der Ordnerbaum sah nach Zierrat aus: über 25 Fassungen hat ihn niemand umgebaut, vier seiner 19 Ordner sind leer. Er ist es nicht — aus `kategorieId` entstehen die Ordner-Spalten der Fördertabelle. Ein leerer Ordner ist damit eine Spalte, die nie erscheinen kann, und das stand nirgends.

- **Bilanzzeile über dem Ordnerbaum**, die die Ordner ohne Spalte **namentlich** nennt ([ordnerBilanz.ts](src/plugins/status-cockpit/ordnerBilanz.ts), [KategorieEditor.tsx](src/plugins/status-cockpit/KategorieEditor.tsx))
- **Marke „ohne Spalte" am Ordner** — nur dort, wo etwas fehlt; ein Haken am Regelfall wäre Rauschen
- **Das Kriterium wird geholt, nicht nachgebaut**: `kategorienMitDatumsfeldern` bleibt die einzige Quelle, sonst behauptete die Zeile etwas, das die Tabelle nicht einlöst
- **„Leer" und „ohne Spalte" sind nicht dasselbe** — nötig ist ein aktives Datums-Kürzel mit Prominenz ≠ Ignoriert ([ordnerBilanz.test.ts](src/plugins/status-cockpit/__tests__/ordnerBilanz.test.ts))
- **Korrektur der Analyse vom 18.08.**: der vorgeschlagene Rückbau der Ordner-Achse hätte dem Team Spalten aus der Fördertabelle genommen ([status-achsen.md](docs/architecture/status-achsen.md))

### v4.98.0 — Ein Status ist eine Zeile (August 2026)

MINOR — Der Reiter sagte „Statuswerte 60", der Baum daneben zeigte 30, und die Drift-Zeile schrieb ausdrücklich „gezählt werden Status, keine Katalogzeilen". Drei Stellen, zwei Vokabulare. In der Tabelle stand jeder Status zweimal untereinander — über 25 Fassungen wich kein einziges der 30 Paare in irgendeinem kuratierten Feld ab.

- **Eine Zeile je Status** statt je Katalogzeile; die erste Spalte heißt jetzt **Ebene** und sagt „TV · Verbund" ([katalogZeilen.ts](src/plugins/status-cockpit/katalogZeilen.ts), [katalogSpalten.tsx](src/plugins/status-cockpit/katalogSpalten.tsx))
- **Reiter, Umschalter und Baum zählen dasselbe** — `zaehleStatus` ist die eine Quelle ([StatusCockpitPage.tsx](src/plugins/status-cockpit/StatusCockpitPage.tsx))
- **Eine Änderung trifft beide Katalogzeilen** (`aendereCodeWerte`) — derselbe Schlüssel, den `setzeCodePhasen` und `setzeKurzLabel` längst nehmen ([katalog-edit.ts](src/core/status/katalog-edit.ts))
- **Abweichung wird nicht verschwiegen**: sagen TV und Verbund Verschiedenes, steht ein ≠ neben der Ebene und nennt die Felder ([katalogFaltung.test.ts](src/plugins/status-cockpit/__tests__/katalogFaltung.test.ts))
- **Vorkommen summiert, „zuletzt gesehen" das jüngste** — die Zahl gilt für den Status, nicht für eine seiner zwei Zeilen

### v4.97.1 — Erst suchen, dann speichern; die Relevanz zeigt Striche (August 2026)

PATCH — Zwei Meldungen aus dem Test des Suchkopfs: „Diese Suche speichern" stand rechts vom Menü der gespeicherten Suchen und bot sich schon an, während der Hinweis darunter „Noch nicht gestellt" sagte. Und die Score-Spalte der Tabelle zeigte „0.88", wo die Liste daneben drei Striche und „hoch" zeigt.

- **Erst speichern, dann nachschlagen** — die beiden Kopf-Aktionen sind vertauscht ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Der Speichern-Knopf erscheint erst nach einem Suchlauf**, an derselben Bedingung wie Deutung, Facetten und Trefferzahl; eine getippte, nicht gestellte Frage ist keiner
- **Er steht links vom Menü, damit sein Erscheinen die Nachbarn nicht verschiebt** — gemessen: „Gespeicherte Suchen" und „Hilfe" bleiben in beiden Zuständen auf 831 px / 1.002 px
- **Die Spalte „Score" heißt „Relevanz"** und zeigt den `StufenBalken` der Listenansicht; der rohe Score bleibt Tooltip und Sortierwert ([columns.tsx](src/plugins/suche/columns.tsx))

### v4.97.0 — Die Auswahl zeigt sich ganz, die Zahl sagt wovon (August 2026)

MINOR — Gemeldet an der Richtlinien-Auswahl: die Kurzwahlen brachen um, die Programmliste scrollte, und das Panel legte sich über genau die Zeile, deren Zahl es ändert. Dazu die Rückfrage, ob „0 Treffer in 14.225 Anträgen" unter einer Einschränkung noch stimmt — sie stimmte nicht.

- **Drei Kurzwahlen in einer Zeile, Programme in zwei Spalten** — die volle Liste ohne Scrollen, Deckel ist die von Radix gemessene Resthöhe ([BereichPanel.tsx](src/components/bereich/BereichPanel.tsx))
- **Das Panel geht unter dem Ergebniskopf auf** statt über ihm; der Versatz wird beim Öffnen gemessen, nicht verdrahtet ([BereichAuswahlChip.tsx](src/components/bereich/BereichAuswahlChip.tsx))
- **„94 Treffer in 2.537 von 14.225 Anträgen"** — unter einer Einschränkung nennt die Zeile beide Mengen ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx), [richtlinienWahl.ts](src/plugins/suche/richtlinienWahl.ts))
- **Der Nenner kommt aus dem Slim-Store**, aus dem auch die Index-Zahl kommt, und wird nur bei einer Einschränkung gelesen ([idb-csv.ts](src/core/services/csv/idb-csv.ts))
- **620 px statt 420**: am längsten Programmnamen gemessen, `title` als Reißleine für künftige Label-Importe

### v4.96.0 — Das Board stellt drei Fragen statt fuenf (August 2026)

MINOR — Gemeldet: die Vielfalt der Reiter sei für die PL-Rolle zu verwirrend. Die Leiste mischte drei Sorten Menge: eine Partition (453 + 331 + 3.101 = 3.885), eine Risiko-Teilmenge (538) und die Gesamtmenge (3.885) — gleich aussehend, aber nicht gegeneinander lesbar. Und der größte Zähler war zu 96 % falsch beschriftet.

- **Drei Reiter statt fünf**: Arbeit · Fristen · Auswertung — drei Fragen, nicht fünf Mengen ([VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx))
- **Wer dran ist, wird ein Filter** mit vier Chips, deren Zahlen sich zur Gesamtmenge addieren ([zustaendigkeit.ts](src/plugins/vorgangs-board/zustaendigkeit.ts), [vorgangs-board.md](docs/feedback-kontext/vorgangs-board.md))
- **„Kein To-do ermittelt 3.101" zerfällt in seine zwei Sorten**: 107 echte Regel-Lücke, 2.994 abgeschlossene Verfahren — das eine ein Mangel, das andere ein Ergebnis
- **Vorbelegt ist der Arbeitsvorrat** (meine + wartet = 784); die anderen beiden stehen mit ihrer Zahl daneben, plus Rückweg „zurück zum Arbeitsvorrat" — abgewählt ist nicht versteckt
- **Der letzte Chip lässt sich nicht abwählen**: eine leere Liste läse sich als „nichts zu tun" ([zustaendigkeit.test.ts](src/plugins/vorgangs-board/__tests__/zustaendigkeit.test.ts))

### v4.95.0 — Wirkungslose Regeln stehen mit Namen da (August 2026)

MINOR — Die Kaskade zählte je Regel zwei Zahlen, sprach aber kein Urteil: „trifft 21 · gewinnt 0" las sich wie jede andere Teilverdeckung. Am Bestand gemessen stehen zwei der 30 Regeln drin, ohne je etwas zu bestimmen — und das sah man nur, wer den Messlauf startete und danach dreißig Zeilen absuchte.

- **Bilanzzeile am Kopf der Kaskade**, die die wirkungslosen Regeln **namentlich** nennt statt sie zu zählen ([todoRegelnAnsicht.ts](src/plugins/status-cockpit/todoRegelnAnsicht.ts), [TodoRegelListe.tsx](src/plugins/status-cockpit/TodoRegelListe.tsx))
- **Drei Gründe statt einer Zahl**: `trifft nie` (Bedingung meint etwas anderes), `immer verdeckt` (Position falsch), `greift nie` (Sperre) — [vorgangssystem.md §11b](docs/architecture/vorgangssystem.md)
- **„gewinnt 0" ist jetzt ein Nullbefund**, nicht der generische Verdeckungs-Satz — die Regel bestimmt bei keinem Vorgang etwas
- **Stillgelegte Regeln bleiben draußen** — sonst meldete die Bilanz als Mangel, was jemand absichtlich abgeschaltet hat ([wirkungsBilanz.test.ts](src/plugins/status-cockpit/__tests__/wirkungsBilanz.test.ts))
- Gemessen in `dev:local` an **12.359** Vorgängen (Richtlinien 2015 + 2020 + 2025, Regelsatz AB): `R10` trifft nie, `R23b` trifft 21 und gewinnt bei keinem

