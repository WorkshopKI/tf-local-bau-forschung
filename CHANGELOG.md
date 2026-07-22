# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v2.296.0 — Umfangs-Vorgaben gehoeren zum Skill, nicht in die Regel-Bibliothek (Juli 2026)

MINOR — Ein Regel-Record trug zwei Ebenen zugleich: die Art der Prüfung (Satzanzahl) UND den nur für einen Skill gültigen Wert (8–12). Die Bibliothek wuchs dadurch auf 25 Regeln — 16 davon Ein-Skill-Parametrisierungen, 8 verwaiste Altstände. Zugleich verdeckte der offene Skill-Editor die in der Liste angewählte Regel.

- Umfang & Form (Wortanzahl, Satzanzahl, Zeichen, Absätze, Satzlänge, keine Aufzählungen, Pflicht-Anfang) sind jetzt Eigenschaften des Skills, nicht Bibliotheks-Regeln; zur Laufzeit als Regeln materialisiert, damit Checks/Prompt/Eval unverändert bleiben ([vorgaben.ts](src/core/services/skills/registry/vorgaben.ts), [skill-vorgaben.md](docs/architecture/skill-vorgaben.md)).
- Neue Sektion „Umfang & Form" im Skill-Editor; die Regel-Bibliothek schrumpft auf 9 wiederverwendbare Regeln, `+ Neue Regel` legt direkt ein verbotenes Muster an ([VorgabenEditor.tsx](src/plugins/skill-verwaltung-kuration/VorgabenEditor.tsx), [regelShared.tsx](src/plugins/skill-verwaltung-kuration/regelShared.tsx)).
- Umschalter „Team | Persönlich" am Skill: Kurator/PL ändert für alle, jeder Nutzer verschiebt freigegebene Werte für sich (persönlicher Ordner); Prompt und Prüfung ziehen dieselbe Liste ([PersoenlichePanel.tsx](src/plugins/skill-verwaltung-kuration/PersoenlichePanel.tsx), `SkillTweak.vorgabenOverride`).
- Anwählen einer Regel wechselt die Detailansicht wieder — die drei parallelen Editor-States sind ein diskriminierter Zustand, Tabwechsel schließt mit ([SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx)).
- Detail-Kopfzeile mit Schließen-X oben rechts statt drei einzeln gebauter „← Skill-Verwaltung"-Links ([DetailKopf.tsx](src/plugins/skill-verwaltung-kuration/DetailKopf.tsx)).

**Migration:** `SKILL_VORGABEN_MIGRATION` überführt Bestands-Shares einmalig und marker-gesichert (mehrfach genutzte und inaktive Regeln bleiben unangetastet, Waisen werden entfernt) — kein Nutzer-Eingriff nötig ([migrations.ts](src/core/services/skills/registry/migrations.ts)).

### v2.295.1 — Skill- und Regel-Tabelle in der Breite ziehbar (Juli 2026)

PATCH — Die Default-Spalten der Skill-Tabelle summieren sich auf ~1.280px und liefen damit horizontal aus der Content-Box; dieselbe Ursache in der Qualitätsregeln-Tabelle. Die Förderanträge-Tabelle löst das bereits über einen Gesamtbreiten-Griff am rechten Rand.

- Skill-Tabelle bekommt den Gesamtbreiten-Griff (Ziehen skaliert alle Spalten proportional, Doppelklick setzt auf Fensterbreite zurück) ([SkillsTab.tsx](src/plugins/skill-verwaltung-kuration/SkillsTab.tsx)).
- Qualitätsregeln-Tabelle ebenso — gleiche Seite, gleiche Ursache ([RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx)).
- Kein neuer Baustein: `useTotalTableWidth` + `SortableTable`-Griff sind unverändert übernommen ([useTotalTableWidth.ts](src/components/data-table/useTotalTableWidth.ts)).

### v2.295.0 — Skill-Liste: Kategorien, Badges als Spalte, Tabelle als Standard (Juli 2026)

MINOR — 21 Skills standen flach und ohne fachliche Ordnung untereinander — Gutachten-Abschnitte, Aufbereitungs-Läufe, Anfragen-Skills und QS-Hilfsläufe gemischt. Zugleich zeigte ausgerechnet die dichteste Ansicht (Tabelle) die Reifegrad-/„inaktiv"-Badges gar nicht.

- Neue Kategorie-Achse für Skills (Gutachten · Nachforderungen · Aufbereitung · Anfragen · Qualitätssicherung · Sonstige), abgeleitet aus id/Name, Kurator-Override möglich ([skill-kategorien.ts](src/core/services/skills/registry/skill-kategorien.ts), `SkillRecord.kategorie`).
- Skill-Liste sortiert standardmäßig nach Kategorie, neue Kategorie-Facette mit Zähler; Sortier-Auswahl gilt jetzt in allen drei Ansichten ([skill-browse.ts](src/plugins/skill-verwaltung-kuration/skill-browse.ts), [SkillsTab.tsx](src/plugins/skill-verwaltung-kuration/SkillsTab.tsx)).
- Tabelle bekommt die Spalten „Kategorie" + „Status" (Reifegrad + inaktiv) sichtbar und „Transport" (nur intern / extern möglich) zuschaltbar ([skillTableColumns.tsx](src/plugins/skill-verwaltung-kuration/skillTableColumns.tsx), [skillBadges.tsx](src/plugins/skill-verwaltung-kuration/skillBadges.tsx)).
- Tabelle ist die Standard-Ansicht für Skills und Regeln — Storage-Keys `teamflow_skillreg_view_mode_v2` / `teamflow_skills_table_columns_v2` gebumpt, sonst hätten Alt-Einstellungen gewonnen ([SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx)).
- Kategorie im Skill-Editor setzbar (leer = abgeleitet, nur ein gesetzter Wert persistiert); `normalizeSkill` trägt das Feld durch Laden und Bundle-Import ([SkillEditor.tsx](src/plugins/skill-verwaltung-kuration/SkillEditor.tsx), [storage.ts](src/core/services/skills/registry/storage.ts)).

### v2.294.2 — Wortanzahl in der Meta-Zeile unter dem generierten Text (Juli 2026)

PATCH — Der Umfang eines Abschnitts wird in Wörtern beurteilt (die `wortanzahl`-Regel prüft genau das), die Meta-Zeile unter dem Text nannte aber nur die Satzzahl. Wer die Wortzahl wissen wollte, musste den Prüf-Block aufklappen oder den Text herauskopieren.

- Meta-Zeile zeigt `N Sätze · M Wörter · Entwurf` ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)); gleiche Zeile in der Kurzfassung ([ReviewCard.tsx](src/plugins/antraege/kurzfassung/ReviewCard.tsx)).
- `countWords` der Check-Engine wird exportiert statt nachgebaut — Anzeige und `wortanzahl`-Regel zählen garantiert gleich ([check-engine.ts](src/core/services/skills/registry/check-engine.ts)).

### v2.294.1 — Text kopieren sitzt jetzt direkt am Abschnitt (Juli 2026)

PATCH — Kopieren ist der häufigste Weg, einen fertigen Abschnitt weiterzuverwenden, saß aber als kleines Icon ohne Beschriftung ganz unten in der Knopfleiste — zwischen Bearbeiten, Daumen und Stil-Einstellungen und damit leicht zu übersehen.

- „Text kopieren" wandert **beschriftet in die Meta-Zeile direkt unter den Abschnitt**, neben das Info-Icon; aus der Aktionsleiste (Entwurf + freigegeben) entfernt ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)).
- Tooltip „Text in Zwischenablage kopieren", Erfolgs-Quittung als grüne „Kopiert"-Pille ([gutachten.css](src/plugins/antraege/gutachten/gutachten.css)).

### v2.294.0 — Sprachlicher Feinschliff fuer Gutachten-Abschnitte (Juli 2026)

MINOR — Ist ein Gutachten-Abschnitt inhaltlich und vom Umfang her abgenommen, gab es bisher nur „Neu / Kürzer / Länger" — und die generieren aus der Vorhabensbeschreibung neu, der mühsam abgestimmte Inhalt verschob sich also wieder. Für den letzten, rein sprachlichen Arbeitsgang fehlte ein Werkzeug.

- **„Sprachlicher Feinschliff"** in der Anpassen-Zeile der Abschnitts-Karte, abgesetzt von Neu/Kürzer/Länger; nur bei Entwürfen ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)).
- **Lektor-Skill** als kurator-pflegbare Registry-Daten; sein Prompt trägt **nur** den Abschnittstext, keine Vorhabensbeschreibung → intern-pflichtig (Pitfall #30) ([ga-lektor.seed.ts](src/core/services/skills/registry/ga-lektor.seed.ts)).
- **Deterministischer Wächter**: Zahlen-Inventar + Längen-Delta vorher/nachher, beratender Hinweis an der Karte ([lektorat.ts](src/plugins/antraege/gutachten/lektorat.ts)).
- Abgeschnittene oder leere Lektor-Antworten werden **verworfen** statt geschrieben ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)).
- Vorfassung landet im Versionsverlauf → Diff + „Diese Fassung übernehmen" wie gewohnt ([runner.ts](src/plugins/antraege/gutachten/runner.ts)); Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

### v2.293.0 — Teilvorhaben-Zeile: Eckdaten und Klassifikation raus, Titel kopierbar (Juli 2026)

MINOR — Der aufgeklappte Teilvorhaben-Block zeigte eine Eckdaten-Karte, deren Werte (Antragsteller, VB-Phase, Unterprogramm, Antragsdatum) schon im Verbund-Kopf und in „Antragsdaten" stehen, plus Klassifikations-Pills, die per Feldnamen-Heuristik auf echten Daten nichtssagende Ein-Buchstaben-Tags produzierten. Gleichzeitig war der TV-Titel — der oft in andere Dokumente übernommen wird — weder markierbar noch einzeln kopierbar, weil die ganze Zeile ein `<button>` war.

- **Eckdaten-Karte** im Verbund-Kontext entfernt; nur der eigenständige Antrag ohne Verbund setzt noch `zeigeEckdaten` ([TvDetailBlock.tsx](src/plugins/antraege/TvDetailBlock.tsx), [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)).
- **Klassifikations-Pills** ersatzlos gestrichen (`KlassifikationPills.tsx` gelöscht).
- TV-Zeile ist jetzt das `role="button"`-Div statt `<button>` → **Titel mit der Maus markierbar**; Selektions-Guard verhindert das Zuklappen beim Loslassen ([TeilvorhabenListe.tsx](src/plugins/antraege/TeilvorhabenListe.tsx)).
- **Kopier-Icon je TV-Zeile** (Hover/Fokus) legt den vollen Titel in die Zwischenablage — auch den von `line-clamp-2` abgeschnittenen Teil ([TvTitelCopyButton.tsx](src/plugins/antraege/TvTitelCopyButton.tsx), jetzt mit `stopPropagation`).
- Kontext-Doc der Bildschirmseite nachgezogen ([antraege.md](docs/feedback-kontext/antraege.md)).

### v2.292.1 — Feedback-Titel wird nicht mehr abgeschnitten (Juli 2026)

PATCH — Lange Feedback-Titel waren doppelt gekürzt: in der Board-Liste einzeilig mit „…" (plus 90-Zeichen-Kappung), im Detail bei 140 Zeichen. Der Nutzer konnte seinen eigenen Titel nicht zu Ende lesen.

- **Board-Liste**: Titel bricht voll um statt einzeilig zu kürzen ([FeedbackCard.tsx](src/components/feedback/FeedbackCard.tsx)).
- **Board-Detail**: Überschrift ungekürzt ([FeedbackBoardDetail.tsx](src/components/feedback/FeedbackBoardDetail.tsx)).
- **Kurator-Liste + -Detail** analog ([FeedbackTicketRow.tsx](src/components/feedback/FeedbackTicketRow.tsx), [FeedbackTicketDetail.tsx](src/plugins/feedback/sections/FeedbackTicketDetail.tsx)).
- `feedbackTitle(item, Infinity)` = nicht kürzen; Kanban-Karten + Home-Widgets bleiben bewusst gekappt ([feedbackUi.ts](src/components/feedback/feedbackUi.ts)).
- Board-Suche liest den vollen Titel statt der ersten 90 Zeichen ([FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)).

### v2.292.0 — Feedback verbessern: Standard-KI + ein Lauf statt zwei (Juli 2026)

MINOR — „Feedback verbessern" lief minutenlang und zeigte im KI-Tab lange Reasoning-Schleifen bis zur Wiederholungs-Erkennung: der Lauf reichte als einziger kein `ziel` durch und landete damit im aktiven — also ggf. agentischen — Tab, ohne Chat-Reset und mit zwei LLM-Läufen, von denen der erste oft nichts zu fragen hatte. Details: [feedback-system.md](docs/architecture/feedback-system.md#feedback-verbesserung-geführter-ablauf-intern-only-v2206).

- **Immer die Standard-KI** (`FEEDBACK_ZIEL`) statt des aktiven Tabs, und **frischer Chat vor jedem Lauf** inkl. Retry (Pitfall #36) ([feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts)).
- **Rückfragen-Lauf entfällt deterministisch**, wenn alle nicht-optionalen Felder befüllt sind oder der Typ nur eines hat — ein statt zwei KI-Aufrufe ([feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts), [constants.ts](src/components/feedback/constants.ts)).
- **Kategorie wird vorgegeben statt erfragt** (aus der Typ-Wahl) und im Parser erzwungen; die Kategorie-Abgrenzung fällt aus beiden Verbessern-Prompts ([feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts)).
- **Ladezustand nennt die genutzte KI** und erklärt sie, wenn die globale Variante auf „Agentisch" steht ([FeedbackVerbessernFlow.tsx](src/components/feedback/FeedbackVerbessernFlow.tsx)).
- **Tests** für Reset+Ziel je Lauf, den übersprungenen Rückfragen-Lauf und die erzwungene Kategorie ([feedbackImprove.test.ts](src/core/services/feedback/__tests__/feedbackImprove.test.ts)).

### v2.291.0 — Zuweisung wartet sichtbar auf die CSV-Bestätigung (Juli 2026)

MINOR — Das eigentliche Zuweisen passiert im Fachsystem; bestätigt wird es erst durch den CSV-Import am Folgetag. Dieses Warten war in der App unbenannt: die MA sah „Vorgemerkt" mit Rückgängig-Knopf, die PL sah nicht, wenn eine Bestätigung ausblieb. Details: [auslastung.md](docs/architecture/auslastung.md#zuweisung--vollzug-das-csv-bestätigt-v2291).

- **Dritter Zeilen-Zustand „Dir zugewiesen · Bestätigung folgt"** auf der Startseite — ohne Aktion, denn die Entscheidung fällt im Fachsystem ([neueAntraegeVerbund.ts](src/plugins/home/neueAntraegeVerbund.ts), [NeueAntraegeVerbundRow.tsx](src/plugins/home/NeueAntraegeVerbundRow.tsx)).
- **Fremd zugewiesene Verbünde verschwinden aus dem Angebot** — verbund-weit, nicht erst wenn die CSV das Kürzel bringt ([NeueAntraegeFuerDich.tsx](src/plugins/home/NeueAntraegeFuerDich.tsx)).
- **Detail-Streifen benennt den Wartezustand** (`CSV-Bestätigung offen · N T`) ([ZuweisungStreifen.tsx](src/plugins/auslastung/components/ZuweisungStreifen.tsx)).
- **PL-Alarm für überfällige Bestätigungen** ab 3 Tagen als amber `⧗ N T` in der Zuweisungs-Liste ([cockpit-helpers.ts](src/plugins/auslastung/views/cockpit-helpers.ts), [VerbundListe.tsx](src/plugins/auslastung/views/VerbundListe.tsx)).
- **Tests** für Fälligkeit, Zuweisung-schlägt-Vormerkung und den verbund-weiten Ausschluss ([cockpit-helpers.test.ts](src/plugins/auslastung/__tests__/cockpit-helpers.test.ts), [neueAntraegeVerbund.test.ts](src/plugins/home/__tests__/neueAntraegeVerbund.test.ts)).

### v2.290.0 — Übernahme-Wunsch: Rückzug wirkt sofort, erledigte räumen sich (Juli 2026)

MINOR — User-Feedback aus dem Zuweisungs-Cockpit: ein zurückgezogener Wunsch blieb bis zum nächsten Einsammeln stehen, die PL sah nirgends wer was zurückgezogen hat, und die Bilanz meldete „14 Wünsche gelesen", obwohl die meisten längst zugewiesen waren. Details: [auslastung.md](docs/architecture/auslastung.md#lebenszyklus-eines-übernahme-wunsches-v2290).

- **Rückzug wirkt sofort** — die Liste vergleicht die Store-Wünsche gegen die ohnehin gelesenen persönlichen Ordner; der Einsammel-Klick persistiert nur noch ([uebernahme-einsammeln.ts](src/plugins/auslastung/services/onboarding/uebernahme-einsammeln.ts), [ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx)).
- **Wer hat was zurückgezogen** — Toolbar-Hinweis + Tooltip an der Einsammel-Bilanz, mit Kürzel, Akronym und Aktenzeichen ([ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx)).
- **Erledigte Wünsche räumen sich** aus der persönlichen Datei, sobald der Verbund vergeben ist ([useMyUebernahmeWuensche.ts](src/plugins/auslastung/hooks/useMyUebernahmeWuensche.ts), [NeueAntraegeFuerDich.tsx](src/plugins/home/NeueAntraegeFuerDich.tsx)).
- **Bilanz weist „bereits vergeben" aus**, damit die gelesene Zahl erklärt ist ([useAuslastungData.ts](src/plugins/auslastung/hooks/useAuslastungData.ts)).
- **Retraktion fasst nur `status:'selbst'` an** — sonst löschte das Selbst-Aufräumen des MA die Freigabe mit ([uebernahme-einsammeln.test.ts](src/plugins/auslastung/__tests__/uebernahme-einsammeln.test.ts)).

### v2.289.0 — Feedback: Kategorie UX entfaellt (geht in Idee auf) (Juli 2026)

MINOR — User-Feedback: „Etwas ist umständlich" (UX) und „Ich wünsche mir etwas" (Idee) sind für Melder nicht unterscheidbar — zu viele Auswahl-Optionen, niemand weiß, was er nehmen soll. Beide sind ohnehin Verbesserungswünsche am Bestand (beide sponsorbar). Details: [feedback-system.md](docs/architecture/feedback-system.md), Entfernungs-Rezept: [add-feedback-category.md](docs/agents/add-feedback-category.md).

- **Vier statt fünf Feedback-Typen** — der UX-Typ ist aus Eingabe, Filter-Chips, Kurator-Dropdown und Badges raus ([constants.ts](src/components/feedback/constants.ts), [FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx), [FeedbackAdminPage.tsx](src/plugins/feedback/FeedbackAdminPage.tsx)).
- **Bestands-Tickets migrieren beim Lesen** auf „Idee" inkl. Feld-Umschlüsselung (pain→goal, better→idea) — nicht-destruktiv, kein Share-Write nötig ([feedbackStorage.ts](src/core/services/feedback/feedbackStorage.ts)).
- **Outbox-Import heilt mit**, damit Alt-Clients keine tote Kategorie nachliefern ([feedbackOutboxCollect.ts](src/core/services/feedback/feedbackOutboxCollect.ts)).
- **Umständlich-Signale klassifizieren jetzt als Idee** statt unklassifiziert zu bleiben; die LLM-Kategorien kennen nur noch bug/feature/praise/question ([feedbackClassification.ts](src/core/services/feedback/feedbackClassification.ts), [feedbackLlm.ts](src/core/services/feedback/feedbackLlm.ts)).
- **Sponsorbarkeit auf `idea` reduziert** — der Helper bleibt die einzige Quelle ([feedbackSponsoring.ts](src/core/services/feedback/feedbackSponsoring.ts)).

### v2.288.0 — Übernahme-Wunsch bleibt in der offenen Liste (Juli 2026)

MINOR — User-Feedback: Anträge mit Übernahme-Wunsch verschwanden aus der Status-Sicht „offen", sobald die PL die Wünsche eingesammelt hatte. Ein Wunsch ist aber eine Bewerbung, keine Zuweisung — der Antrag ist weiter unverteilt. Details: [auslastung.md](docs/architecture/auslastung.md#status-filter-im-zuweisungs-cockpit-v2288).

- **„offen" heißt jetzt „niemandem zugewiesen"** — Wunsch-Anträge bleiben in der Liste und erscheinen zusätzlich unter „Übernahme-Wunsch" ([cockpit-helpers.ts](src/plugins/auslastung/views/cockpit-helpers.ts)).
- **Interessenten stehen als Kürzel in der Zeile** statt nur als Zähler „2 will" (ab 4 gekürzt auf `+N`) ([VerbundListe.tsx](src/plugins/auslastung/views/VerbundListe.tsx)).
- **Dedupe/Sortierung der Wünsche als geteilter Helfer** `interessentenNachWunschzeit` — Liste und Detail-Panel teilen eine Quelle ([DetailPanel.tsx](src/plugins/auslastung/views/DetailPanel.tsx)).
- **Status-Chips erklären sich per Tooltip** (Überlappung „offen" ∩ „Übernahme-Wunsch" ist gewollt) ([FilterToolbar.tsx](src/plugins/auslastung/views/FilterToolbar.tsx)).
- **Regressionsschutz** für die Status-Aggregation inkl. „freigegeben + selbstEingetragen ist nicht offen" ([cockpit-helpers.test.ts](src/plugins/auslastung/__tests__/cockpit-helpers.test.ts)).

### v2.287.2 — Zeitplan-Gantts der Aufbereitung ziehen 1:1-Zeichnung nach (Juli 2026)

PATCH — „Nach AP" und „Nach Person" hatten denselben Defekt wie der Prüfblatt-Gantt: viewBox fester Breite, breites Panel, alles darin hochskaliert. v2.287.1 hat nur den Aufrufer im MAP-Modul geradegezogen; jetzt zieht die Aufbereitung nach.

- **Beide Zeitplan-Ansichten zeichnen 1:1**: Schriftgrößen sind wieder echte Pixel ([GanttZeitplan.tsx](src/plugins/antraege/aufbereitung/GanttZeitplan.tsx), [PersonenZeitplan.tsx](src/plugins/antraege/aufbereitung/PersonenZeitplan.tsx)).
- **Messung als geteilter Hook** `useGanttBreite` + reine `zeichenBreite` — eine Heimat statt drei Kopien; die plugin-lokale Fassung im MAP-Modul entfällt ([GanttAchse.tsx](src/plugins/antraege/aufbereitung/GanttAchse.tsx)).
- **Hook vor dem Leer-Zweig** in „Nach Person", sonst kippt die Hook-Reihenfolge beim Wechsel auf „keine MA-Zuordnung" (React #310) ([PersonenZeitplan.tsx](src/plugins/antraege/aufbereitung/PersonenZeitplan.tsx)).
- **Tests am Ort der Geometrie** statt im MAP-Plugin ([gantt-achse.test.ts](src/plugins/antraege/aufbereitung/__tests__/gantt-achse.test.ts)).

### v2.287.1 — Foerderfaehigkeit: Gantt zeichnet 1:1 statt hochskaliert (Juli 2026)

PATCH — Der Arbeitspaket-Gantt im Prüfblatt zeichnete Schrift und Balken rund ein Drittel zu groß. Ursache war kein Stilwert, sondern ein viewBox fester Breite in einem breiten Panel: das SVG skalierte hoch und alles darin mit. Die Maße selbst entsprachen längst dem Handoff.

- **viewBox folgt der gemessenen Panel-Breite**: 1 SVG-Einheit = 1 CSS-Pixel, `fontSize={12}` bleibt 12 px — unabhängig davon, wie breit das Prüfblatt steht ([ApGantt.tsx](src/plugins/map-foerderfaehig/components/ApGantt.tsx)).
- **Zeichenbreite als reine Ableitung** mit Sockel für schmale Panels, statt Rechnerei in der Komponente ([gantt-daten.ts](src/plugins/map-foerderfaehig/ansicht/gantt-daten.ts)).
- **Geteilte Achse nimmt die Breite entgegen** (`macheAchse(achseMax, gesamtBreite)`, `achse.plotRight`); ohne Angabe bleibt es beim festen Maß, die Zeitplan-Ansichten der Aufbereitung ändern sich nicht ([GanttAchse.tsx](src/plugins/antraege/aufbereitung/GanttAchse.tsx)).
- **Balkenhöhe auf Handoff-Maß** (12 px, voll gerundet) statt an die Zeilenhöhe gekoppelt ([ApGantt.tsx](src/plugins/map-foerderfaehig/components/ApGantt.tsx)).

### v2.287.0 — Wasserzeichen rueckt nur bei echtem Fortschritt vor (Juli 2026)

MINOR — Jeder geparste Konsolidierungslauf galt als Erfolg und schrieb das Wasserzeichen fort — auch wenn KEINE Operation ankam. Die betroffenen Ereignisse waren damit dauerhaft verloren, ohne Spur. Der Prompt-seitige Auslöser fiel mit v2.285.0, die Folgenschwere blieb offen. Detail: [assistent-gedaechtnis.md](docs/architecture/assistent-gedaechtnis.md#wasserzeichen-kontrakt-v2287).

- **Fortschritt nur bei echter Verarbeitung**: ein Lauf mit ausnahmslos defekten Verwürfen hält die Position und bietet dieselben Ereignisse erneut an ([konsolidierung.ts](src/core/services/assistent/gedaechtnis/konsolidierung.ts)).
- **Verwurfs-Art trennt die zwei Fälle**: Duplikat/Kapazität = `gesaettigt` (inhaltlich erledigt, rückt vor), alles andere = `defekt` ([operationen.ts](src/core/services/assistent/gedaechtnis/operationen.ts)).
- **Backstop gegen den Dauer-Freeze**: nach `MAX_DEFEKT_WIEDERHOLUNGEN` rückt das Wasserzeichen trotzdem vor — ein permanenter Defekt würde den Stau sonst endlos wachsen lassen ([types.ts](src/core/services/assistent/gedaechtnis/types.ts)).
- **Einstellungen benennen die Folge**: „bleiben offen" vs. „übersprungen" statt eines pauschalen Fehlertexts ([GedaechtnisSektion.tsx](src/plugins/einstellungen/GedaechtnisSektion.tsx)).

### v2.286.0 — KI-Zweitmeinung nach dem eigenen Urteil (Juli 2026)

MINOR — Der Substanzcheck konfrontiert den Antragstext mit harten Daten; die Skala-Bewertung des Innovationsgrads blieb reine Menschenarbeit. Offen war, ob eine KI-Einschätzung dort hilft oder nur ankert. Der Testballon beantwortet das experimentell — die KI stuft mit ein, spricht aber erst, wenn der Mensch entschieden hat. Detail: [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md).

- **Zweitmeinung im selben Lauf**: `innoZweitmeinung` fällt im bestehenden Infografik-Aufruf mit ab, kein zweiter LLM-Call; Ankertexte kommen aus der Checklisten-Entität, nie hartkodiert ([zweitmeinung.ts](src/plugins/map-foerderfaehig/infografik/zweitmeinung.ts)).
- **Gate „Urteil zuerst" redigiert statt zu flaggen**: ohne eigene Stufe trägt der Vergleich gar keine KI-Stufe mehr — die Komponente kann die Regel nicht brechen ([zweitmeinung-vergleich.ts](src/plugins/map-foerderfaehig/ansicht/zweitmeinung-vergleich.ts)).
- **Kein Score-Leak by construction**: kein Feld an `MapItemBewertung`, deshalb für Abschluss-Entwürfe und Report unerreichbar; ein Guard hält das fest ([konventionen.test.ts](src/plugins/map-foerderfaehig/__tests__/konventionen.test.ts)).
- **Anker-Stempel in der Nutzlast, nicht im Cache-Key**: ein Anker-Edit kennzeichnet die Zweitmeinung als veraltet, statt Canvas, Delta und Wirkungskette mitzulöschen; `INFOGRAFIK_SCHEMA_VERSION` 2 → 3 ([schema.ts](src/plugins/map-foerderfaehig/infografik/schema.ts)).
- **Smoke misst Vollständigkeit + Stabilität**: Gold-Werte sind für alle vier Fixtures gleich und rein informativ; `maxTokens` 6144 → 8192, weil eine abgeschnittene Antwort den ganzen Lauf killt ([smoke-runner.ts](src/plugins/map-foerderfaehig/substanz/smoke-runner.ts)).

### v2.285.0 — Prompt-Audit: Mehrdeutigkeiten in allen Prompts behoben (Juli 2026)

MINOR — Nachdem der G-Fix (v2.284.1) gewirkt hatte, wurden ALLE Prompts des Repos gegen zehn Defektmuster geprüft. Häufigster Befund war nicht die elidierte Wortlaut-Vorgabe, sondern zwei Blöcke, die Gegenteiliges fordern, während der Vorrang nur im Code-Kommentar steht — den sieht das Modell nicht. Befundliste + Begründungen: [prompt-audit-2026-07.md](docs/prompt-audit-2026-07.md).

- **Bug-Klasse 13 hatte einen zweiten Fundort**: der KI-Korrektur-Pfad schickte den Pflicht-Anfang weiter zitiert und abgeschnitten; Generierung und Korrektur teilen jetzt EINE Quelle ([check-engine.ts](src/core/services/skills/registry/check-engine.ts), [korrektur.ts](src/core/services/skills/registry/korrektur.ts)).
- **Inhaltsleere und widersprüchliche Anweisungen entfernt**: „Vermeide die hinterlegten Formulierungen" (verwies auf nichts, hing an B/C/D/G), leere Konsistenz-Referenz-Überschrift, JSON-gegen-Fließtext ohne Vorrang-Angabe ([run-skill.ts](src/core/services/skills/run/run-skill.ts), [context-provider.ts](src/plugins/antraege/gutachten/context-provider.ts)).
- **Anonymisierer entschärft** (produktiv, DSGVO): Zielkonflikt aufgelöst, Literalitäts-Pflicht auf das wiedereingesetzte `mapping` begrenzt, Echtwerte aus der Feld-Schablone entfernt; Migration `ANFRAGE_ANON_KLAR_MIGRATION`, pristine-only ([anfrage-anonymisieren.seed.ts](src/core/services/skills/registry/anfrage-anonymisieren.seed.ts)).
- **Assistent und Gedächtnis nutzen `QUELLENTREUE_REGELN`** statt der auf Gutachtentext gemünzten Grundsatz-Regeln; das Panel bekommt einen Abbruch-Knopf (Bridge kennt weder maxTokens noch Timeout) ([grundsatz.ts](src/core/services/skills/registry/grundsatz.ts), [sessionStore.ts](src/plugins/chat/assistent/sessionStore.ts)).
- **Zwei neue Guards**: erweiterte Wortlaut-Regel über alle prompt-bauenden Verzeichnisse, Kompakt-gegen-Pretty-Print-Regel, plus ein Test über dem GERENDERTEN Prompt ([prompt-hygiene.test.ts](src/core/services/skills/run/__tests__/prompt-hygiene.test.ts)) — Block-übergreifende Widersprüche sieht keine Quelltext-Regex.

### v2.284.1 — Pflicht-Anfang in Abschnitt G loest keinen Reasoning-Loop mehr aus (Juli 2026)

PATCH — Abschnitt G verlangte den Pflicht-Satzanfang „**exakt**" und zeigte ihn zugleich zitiert und per Auslassungszeichen abgeschnitten. Diese Anweisung ist nicht erfüllbar: der Wortlaut endet mitten im Satz, sein Ende ist verdeckt. Qwen suchte im Reasoning wiederholt die String-Grenze, degenerierte in Wiederholung und verbrauchte das Ausgabebudget — Lauf ohne Antwort. Detail: [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).

- **Pflicht-Anfang steht in einem eigenen, unzitierten Block** auf eigener Zeile, mit dem expliziten Hinweis, dass er absichtlich mitten im Satz endet ([seed.ts](src/core/services/skills/registry/seed.ts), `abschnittTemplate.pflichtAnfang`).
- **Derselbe Fix im KI-Korrektur-Pfad** — `pflicht_anfang.hint` landet im selben Modell ([check-engine.ts](src/core/services/skills/registry/check-engine.ts)).
- **Bestands-Registries werden gehoben** (`GA_PFLICHT_ANFANG_KLAR_MIGRATION`, pristine-only, zwei Alt-Stände mit/ohne Stilbeispiel); kuratierte Edits bleiben unberührt ([migrations.ts](src/core/services/skills/registry/migrations.ts)).
- **Abschnitte B–F bleiben byte-identisch** — `pflichtAnfang: undefined` ändert das Template nicht, sonst zöge der Fix deren Migrations-Erkennung mit.
- **Guard `keine-elidierte-wortlaut-vorgabe`** verbietet die Kombination Literalitäts-Wort + elidiertes Zitat unter `skills/` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)); neue Bug-Klasse 13 dokumentiert.

### v2.284.0 — Erneut hochgeladene Dokumente ersetzen statt zu vervielfachen (Juli 2026)

MINOR — Das Dokument-Inventar aus v2.282 zeigte für fünf hochgeladene Dateien fünfzehn Zeilen. Nicht doppelt gerendert, sondern echter Bestand: `add` vergibt pro Aufnahme eine frische UUID, jede erneut abgelegte Datei legte also einen weiteren Record an. Unsichtbar, solange der Gutachten-Pfad ohnehin nur ein Dokument las. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Neu-Aufnahme ersetzt die vorherige Fassung** statt einen zweiten Record anzulegen — gleicher Verbund + gleicher Dateiname ([DokumentAufnahme.tsx](src/core/components/DokumentAufnahme.tsx), [dokumentDubletten.ts](src/core/components/dokumentDubletten.ts)).
- **`id` und `created` bleiben beim Ersetzen** — VB-Wahl und Korpus-Auswahl zeigen weiter auf das Dokument, das Inventar sortiert nicht um ([store.ts](src/plugins/dokumente/store.ts)).
- **Altbestand als „ältere Fassung" markiert** mit Sammel-Aktion „Ältere Fassungen entfernen"; sie zieht erst die Verweise um, löscht dann aus IDB und Suchindex ([KorpusInventar.tsx](src/plugins/antraege/gutachten/KorpusInventar.tsx), [useGutachtenQuellen.ts](src/plugins/antraege/gutachten/useGutachtenQuellen.ts)).
- **Nie automatisch beim Laden aufgeräumt** — es sind Nutzerdaten, das Löschen bleibt ein bewusster Klick mit Rückfrage.
- **Tag-Scan hat nur noch eine Implementierung** — `listDocsByTag` im Dokumente-Store, `listDocsByFkz` delegiert ([vbDokument.ts](src/plugins/antraege/kurzfassung/vbDokument.ts)).

### v2.283.0 — Regelprüfung unter dem Entwurf (Juli 2026)

MINOR — Der Knopf „Prüfen" wirkte wie ein Blindgänger: er rechnete zwar deterministisch neu, aber die Checks entstehen ohnehin bei jeder Generierung/Bearbeitung — und das Ergebnis landete im rechten Panel, das eingeklappt sein konnte. Klick ohne sichtbare Wirkung. Zugleich saß die Prüfung getrennt von dem Text, den sie bewertet. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Regelprüfung wandert unter den Entwurf** — aufklappbar über den Meta-Zeilen-Trigger „prüft N Regeln" ([PruefBlock.tsx](src/plugins/antraege/gutachten/PruefBlock.tsx), [SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)).
- **Zu bei grüner Prüfung, offen bei Befund** — Default wird bei jeder Änderung des Prüf-Ergebnisses neu abgeleitet (`pruefSummary`), die betroffene Gruppe klappt auf.
- **Trigger zeigt den Befund schon zugeklappt** („prüft 3 Regeln · 1 Hinweis", amber/rot) und zählt `run.checks` statt der live aktiven Skill-Regeln.
- **„Prüfen" raus aus der Anpassen-Zeile**, als „Neu prüfen" in den aufgeklappten Block — dort, wo sein Ergebnis sichtbar ist.
- **Rechte Spalte heißt „Quelle & KI-Hinweise"** und trägt nur noch Belege, beratende KI-QS und Denkprozess ([KontextPanel.tsx](src/plugins/antraege/gutachten/KontextPanel.tsx)).

### v2.282.0 — Gutachten: Dokument-Inventar + Korpus mit Auswahl (Juli 2026)

MINOR — Wer im Gutachten fünf Dokumente hochlud, sah danach eines: die Seite zeigte nur den VB-Dateinamen, und `findVorhabensbeschreibung` nahm von mehreren VB-getaggten Dateien die jüngste. Weil `typAusDateiname` jeden unerkannten Dateinamen auf `vorhabensbeschreibung` zurückfallen lässt, landeten „Projektbeschreibung"/„Wirkung" ebenfalls dort — welche gewann, hing am Konvertierungstempo. Das Gutachten entstand also aus einem willkürlich gewählten von fünf Dokumenten, ohne Hinweis. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Dokument-Inventar** in der Gutachten-Sektion — alle Verbund-Dokumente mit Typ, Zeichenzahl und Kopf „N Dokumente · M im Gutachten-Kontext" ([KorpusInventar.tsx](src/plugins/antraege/gutachten/KorpusInventar.tsx)).
- **Maßgebliche VB explizit wählbar** statt „jüngste gewinnt"; der Pick liegt auf Verbund-Ebene, alle Konsumenten erben ihn ([vbDokument.ts](src/plugins/antraege/kurzfassung/vbDokument.ts)).
- **Zusatzdokumente per Checkbox in den KI-Kontext**, zusammengeführt zu einem Korpus mit der VB als Präfix ([korpusQuelle.ts](src/plugins/antraege/gutachten/korpusQuelle.ts), [korpusAuswahl.ts](src/plugins/antraege/gutachten/korpusAuswahl.ts)).
- **Opt-in als harte Eigenschaft**: leere Auswahl ⇒ Korpus byte-identisch zur VB ⇒ gleicher Hash ⇒ bestehende Relevanz-Map-Caches und freigegebene Abschnitte bleiben unberührt ([korpus-kontext.test.ts](src/plugins/antraege/gutachten/__tests__/korpus-kontext.test.ts)).
- **Kontextfenster-Warnung misst den Korpus** statt nur der VB; Korpus-Primitive aus dem dev-gegateten Aufbereitungs-Verzeichnis gelöst ([dokumentKorpus.ts](src/plugins/antraege/dokumentKorpus.ts)).

### v2.281.1 — Schwache Bewertungen faerben die Kriteriumskarte (Juli 2026)

PATCH — Eine B0- oder B1-Bewertung war nur am gewählten Segment zu erkennen: beim Scrollen durch 23 Kriterien fiel ein Befund nicht auf. Der Design-Prototyp färbt dort die Karte; hier trägt die Farbe Akzentkante, Stufenbadge und eine sehr helle Fläche (DESIGN_GUIDE: kein satter Hintergrund).

- **B0/B1 färben die ganze Kriteriumskarte** — Kante, Badge „B1 · 1" und `-bg`-Fläche; B2/B3 bleiben ruhig, ein Haken soll nicht schreien ([SkalaKarte.tsx](src/plugins/map-foerderfaehig/components/SkalaKarte.tsx)).
- **Segmentfarbe folgt der Stufe** statt immer `--tf-primary`: B0 rot, B1 amber, B2 primär, B3 grün ([SkalaKarte.tsx](src/plugins/map-foerderfaehig/components/SkalaKarte.tsx)).
- **Binäre Kriterien sprechen dieselbe Sprache**: „nicht erfüllt" und „NF notwendig" färben die Karte ebenso ([ItemKarte.tsx](src/plugins/map-foerderfaehig/components/ItemKarte.tsx)).
- **Fix: „vollständig" ist nicht „gut"** — der Innovationsgrad wurde grün, sobald alle drei Kategorien bewertet waren, auch bei 3 von 9 Punkten; unterhalb des Kurzpfads ist er jetzt amber ([bewertungs-signal.ts](src/plugins/map-foerderfaehig/ansicht/bewertungs-signal.ts)).
- **Einstufung als reine Ableitung** mit Test statt Farblogik in den Komponenten — die `.tsx` bilden nur noch Signalstufe → Token ab ([bewertungs-signal.test.ts](src/plugins/map-foerderfaehig/__tests__/bewertungs-signal.test.ts)).

### v2.281.0 — Foerderfaehigkeit: gefuehrter Pruefablauf in drei Phasen (Juli 2026)

MINOR — Die Förderfähigkeitsprüfung zeigte elf gleichrangige Reiter: kein roter Faden, kein Fortschritt, keine Antwort auf „was kommt als Nächstes". Der Design-Handoff gruppiert sie in drei Phasen mit Führungsleiste. Übernommen sind Aufbau und Optik — die Zahlen bleiben die der App, denn der Prototyp zählte gegen eine Konstante und konnte nie fertig werden.

- **Drei Phasen statt elf Reitern** (1 Verstehen · 7 Schritte → 2 Bewerten → 3 Abschluss); Checkliste und Import-Report stehen als Konfiguration daneben ([schritte.ts](src/plugins/map-foerderfaehig/ansicht/schritte.ts), [PhasenNav.tsx](src/plugins/map-foerderfaehig/components/PhasenNav.tsx)).
- **Führungsleiste** mit „Schritt X von 9 · Phase N", Zurück/Weiter und dem nächsten offenen Schritt; auf den Konfigurations-Screens ohne Zähler ([GuideLeiste.tsx](src/plugins/map-foerderfaehig/components/GuideLeiste.tsx)).
- **Statuspunkte aus echten Signalen** — zugeordnete VB, vorhandene Analyse, Fortschritt aus `bewerte()`, Rechencheck-Warnungen; Gesamtzahl kommt aus der Checklisten-Fassung, nie aus einer Konstante ([schritte.test.ts](src/plugins/map-foerderfaehig/__tests__/schritte.test.ts)).
- **`KompaktAnsicht` zerlegt** in Prüfblatt, Phasen-Nav, Führungsleiste und „Vorhaben kompakt"; Schritte bleiben nach dem ersten Besuch montiert, Scrollstand und Eingaben überleben den Wechsel ([PruefBlatt.tsx](src/plugins/map-foerderfaehig/components/PruefBlatt.tsx)).
- **Nicht existierende `--tf-*`-Tokens ersetzt** (`--tf-danger`/`-warning`/`-success`/`--tf-primary-fg` lebten nur von Fallbacks) und `ScopeTabs` um einen `leading`-Slot erweitert, statt eine zweite Tab-Leiste zu bauen ([ScopeTabs.tsx](src/components/ui/ScopeTabs.tsx)).

### v2.280.0 — KI-Status im Titel des Streamlit-Tabs (Juli 2026)

MINOR — Das Bookmarklet zeigte seinen Zustand nur als Pill unten rechts **im** KI-Tab — also genau dort, wo man nur hinsieht, wenn man hinwechselt. Wer in der App arbeitet, sah nicht, ob die KI vorankommt. Der Tab-Titel trägt den Zustand jetzt in die Chrome-Tab-Leiste.

- **Tab-Titel des KI-Tabs spiegelt den Bridge-Zustand**: `⏳ 0:42 · 1,4k` im Lauf, `✅ Fertig` für 60 s, `⚠️ …` bleibt stehen; Symbol vorne, damit es bei abgeschnittenem Tab sichtbar bleibt ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)).
- **Laufzeit UND Antwort-Umfang**, weil nur der wachsende Umfang „kommt voran" belegt — eine Uhr tickt auch bei totem Server weiter ([tab-titel.ts](src/core/services/ai/streamlit-bridge/tab-titel.ts)).
- **Angehängt an `setBadge()`** — den einzigen Statuswechsel-Punkt des Snippets, damit Tab und Pill nicht auseinanderlaufen; keine neuen Timer (Ticker in der 400-ms-Poll-Schleife, Quittung + Rerun-Re-Assert im 4-s-Watchdog).
- **Drift-Test** wie bei Echo-/Antwort-Logik: JS-Fassung zwischen den `<tab-titel-core>`-Markern läuft gegen dieselben Fixtures wie das TS-Modul ([tab-titel.test.ts](src/core/services/ai/streamlit-bridge/__tests__/tab-titel.test.ts)).
- **`BRIDGE_REV`-Bump → Bookmarklet muss neu installiert werden** (Einstellungen → Interne KI), sonst bleibt der alte Stand ohne Tab-Titel aktiv ([streamlit-bridge.md](docs/architecture/streamlit-bridge.md)).

### v2.279.0 — Substanzcheck: Widersprueche, Unschaerfe, Zielkriterien (Juli 2026)

MINOR — Ein mit KI geschriebener Antrag liest sich glatt und sagt wenig: er kann den eigenen Einreichungsdaten widersprechen und durchweg unbeziffert bleiben, ohne dass es beim Erstlesen auffällt. Der Substanzcheck bewertet keine Textqualität, sondern hält Behauptungen gegen harte Zahlen und gegen die Quantifizierungspflicht. Alles reitet auf dem bestehenden Infografik-Lauf mit — kein zusätzlicher LLM-Aufruf.

- **Fakten-Block** aus dem Strukturmodell (Laufzeit, PM je AP, Kosten, Fördersatz) geht als Referenzseite ins Prompt; nur Aggregate, nichts Personenbezogenes ([fakten.ts](src/plugins/map-foerderfaehig/infografik/fakten.ts)).
- **Widersprüche + Unschärfe-Begriffe** als neue Antwortfelder mit strengem Parser — im Zweifel verwerfen statt raten, leere Liste ist ein gutes Ergebnis ([substanz.ts](src/plugins/map-foerderfaehig/infografik/substanz.ts), [WiderspruchListe.tsx](src/plugins/map-foerderfaehig/components/WiderspruchListe.tsx), [UnschaerfeListe.tsx](src/plugins/map-foerderfaehig/components/UnschaerfeListe.tsx)).
- **Ein-Klick-Nachforderung** mit Formulierungs-Leitplanke im Code: immer Zahl + Messverfahren, nie „näher erläutern"; Registry-Bausteine bleiben wortgetreu ([nf-praezision.ts](src/plugins/map-foerderfaehig/substanz/nf-praezision.ts)).
- **Kontrollfähige Zielkriterien (RL 4.5.1)** als Tabelle im Gutachten-Gerüst; gespeichert wird die Abwahl, damit neue Zeilen nicht still herausfallen ([zielkriterien.ts](src/plugins/map-foerderfaehig/substanz/zielkriterien.ts), [markdown.ts](src/plugins/map-foerderfaehig/abschluss/markdown.ts)).
- **dev-Reiter „Substanz-Smoke"** misst vier fiktive Fassungen inkl. Falsch-Positiv-Kontrolle; `npm run check` bleibt LLM-frei ([smoke-runner.ts](src/plugins/map-foerderfaehig/substanz/smoke-runner.ts), [map-testleitfaden.md](docs/map-testleitfaden.md)).

### v2.278.0 — KI-Analysen ueberleben den Seitenwechsel (Juli 2026)

MINOR — Nach „Mit KI analysieren" waren Steckbrief, Canvas, Delta und Wirkungskette weg, sobald man eine andere Seite aufrief. Die Ergebnisse lagen die ganze Zeit im kv-Store — der Baustein-Cache IST ihre Persistenz —, nur las sie beim Öffnen niemand zurück. Dieselbe Lücke steckte in der Antrag-Aufbereitung.

- **Rehydrierung beim Öffnen** über den vorhandenen Cache, ohne Transport und ohne LLM-Lauf: [analyse-cache.ts](src/plugins/map-foerderfaehig/vb/analyse-cache.ts) (MAP, 3 Bausteine) + [baustein-rehydrierung.ts](src/plugins/antraege/aufbereitung/baustein-rehydrierung.ts) (Aufbereitung, 6 Bausteine).
- **`leseBausteinCache`** als einzige Lesestelle der Cache-Shape; `getOrComputeBaustein` nutzt sie intern ([bausteine.ts](src/plugins/antraege/aufbereitung/bausteine.ts)).
- **Render-Schleife behoben**: der Korpus-Effekt der Aufbereitung hing an einem pro Render neu gebauten `ctx` und trieb sich über `setKorpusMass` selbst an — ein voller Dokument-Scan je Render ([useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts)).
- **Tab-Gating** sperrt nur noch, solange ein Lauf `laeuft` — sonst hätte ein Teil-Treffer genau die Tabs gesperrt, deren Leerzustand den Start-Button trägt ([tab-gating.ts](src/plugins/antraege/aufbereitung/tab-gating.ts)).
- **`deleteEinreichung`** räumt die KI-Ergebnisse über alle Korpus-Stände mit ab ([store.ts](src/plugins/map-foerderfaehig/store.ts)).

### v2.277.1 — Guard: pauschales kv-Leeren muss Setup-Schluessel aussparen (Juli 2026)

PATCH — Nachzug zu v2.277: in den anderen Varianten gibt es nichts zu verschonen (`dev-fixtures` wird dort komplett wegge-tree-shaked, geprüft am pl-Bundle; kein anderer Pfad leert den kv-Store pauschal). Statt Code zu duplizieren, sichert jetzt ein Guard die Regel für jeden künftigen Reset ab — in jeder Variante.

- **Kanonische Setup-Key-Liste** `SETUP_IDB_KEYS`/`istSetupKey` als einzige Quelle ([setup-keys.ts](src/core/services/storage/setup-keys.ts)); `resetAll` nutzt sie statt einer lokalen Kopie.
- **Convention-Test `no-blanket-idb-wipe`**: wer unpräfixiert `idb.keys()` holt UND `idb.delete(...)` ruft, muss aus setup-keys.ts importieren ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)).
- Guard gegen die echte Regression verifiziert (alten Stand kurz wiederhergestellt → Test schlägt fehl), nicht nur „läuft grün".
- Zwei Fehlalarme beim Bau geschärft: `cache.keys()` einer Map und rein lesende State-Dumps zählen nicht.
- `MAX_FILE_LOC`-Baseline 1480 → 1545 (Guard-Aggregator wächst mit jeder Convention).

### v2.277.0 — Dev-Szenarien verschonen Name und Kuerzel (Juli 2026)

MINOR — Auflösung des „ständig neue Anmeldung"-Reports aus dem Citrix-Test: weder Citrix noch der Startup-Wizard, sondern die Dev-Fixtures. **Jedes** der 6 Szenarien beginnt mit `resetAll`, und das löschte jeden kv-Schlüssel ausser `smb-handles` — also auch `profile` + `onboarding-complete`. Fingerabdruck: Name/Kürzel neu tippen, Ordner aber weiter verbunden. Dev-only (`devFixtures`), pl/prod waren nie betroffen.

- **`resetAll` verschont die Setup-Schlüssel** `profile` + `onboarding-complete` — dieselbe Begründung, aus der der SMB-Handle längst verschont wurde ([helpers.ts](src/dev-fixtures/helpers.ts)).
- **Neue Einzel-Aktion „Onboarding zurücksetzen"** für den gezielten Erstlauf-Test ([actions.ts](src/dev-fixtures/actions.ts), Knopf in [FixturesPanel.tsx](src/plugins/dev-infrastructure-test/panels/FixturesPanel.tsx)).
- Szenario-Beschreibung + Panel-Vorspann sagten „alle Stores leeren" und stimmten nicht mehr — nachgezogen ([scenarios.ts](src/dev-fixtures/scenarios.ts)).
- Diagnose-Reihenfolge in Bug-Klasse 12 ergänzt: im dev-Build **zuerst** nach angewendeten Fixture-Szenarien fragen ([recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)).

### v2.276.0 — Identitaet aus persoenlichem Ordner wiederherstellbar + Auto-Kette entschaerft (Juli 2026)

MINOR — Citrix-Tester mussten „oft" Name und Kürzel neu eintippen. Ursache liegt ausserhalb der App (die IndexedDB wird geräumt bzw. wandert im Citrix-Profil nicht mit; `onboarding-complete` löscht die App nirgends) — aber die App schrieb ihr Profil seit jeher nach `<pers>/ZAH/profile.json` und **las es nie zurück**: `loadPersonalSettings` hatte keinen einzigen Aufrufer. Ein Backup, das niemand liest, ist keins.

- **„Aus persönlichem Ordner wiederherstellen"** in Schritt 0 des Onboardings — holt Name, Kürzel, Farbe und persönliche Einstellungen zurück und springt zur Zusammenfassung ([Onboarding.tsx](src/core/Onboarding.tsx)).
- **`navigator.storage.persist()`** beim Init angefragt (best-effort, nicht awaited) — senkt die Eviction-Wahrscheinlichkeit, ersetzt kein Backup ([storage/index.ts](src/core/services/storage/index.ts)).
- **Auto-Kette bucht nur noch Erfolge** (`resolveAfterGrant` mit `attemptedSlot=null`); die 300ms-Dauer-Heuristik aus v2.275.0 ist entfernt ([guided-grant-progress.ts](src/core/components/guided-grant-progress.ts)).
- Grund: Wall-Clock trennt „kein Dialog" nicht von „abgelehnt" — unter Citrix-Last kippte die Schwelle und der Persönliche Ordner wurde still als abgelehnt gebucht und übersprungen.
- **Neue Bug-Klasse 12** „Zustand nur in der Varianten-IDB = ein Verlust, keine Wiederherstellung" ([recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)).

### v2.275.1 — Hinweis beim Wechsel der KI-Variante im Chat (Juli 2026)

PATCH — Seit v2.274 wechselt der Umschalter wirklich den Streamlit-Tab. Weil die Bridge aus App-Sicht single-turn ist (nur die letzte Nutzer-Nachricht geht raus), liegt der Gesprächsfaden in der Historie des Tabs — der neue kennt die bisherigen Züge nicht. Für den Nutzer war das nirgends sichtbar.

- **Hinweis am Umschalter**, wenn mitten in einem laufenden Gespräch gewechselt wird ([KiVariantSelector.tsx](src/core/components/KiVariantSelector.tsx)).
- **Reine `sollWechselHinweisZeigen`** entscheidet wann: nur bei aktiver Bridge, laufendem Gespräch und echtem Wechsel ([ki-ziel.ts](src/core/services/ai/ki-ziel.ts)).
- Bewusst **nachgelagerter Hinweis statt Bestätigungsdialog** — der Wechsel ist verlustfrei umkehrbar.

### v2.275.0 — Startup-Freigabe: Wizard oben, weniger Mausweg und Klicks (Juli 2026)

MINOR — Das Browser-Popup zur Ordner-Freigabe erscheint oben am Bildschirm, die Wizard-Karte stand aber mittig: bei drei Ordnern pendelte der User sechsmal über die halbe Bildschirmhöhe. Echtes Auto-Abfragen aller Ordner ist browserseitig blockiert (Chromium verbraucht die User-Activation pro `requestPermission`) — also Weg verkürzen statt Schritte streichen.

- **Karte im Stepper-Zweig oben statt zentriert** (`items-start pt-[210px]`, direkt unter der Popup-Zone) plus fehlendes `overflow-y-auto` ([StartupScreen.tsx](src/core/StartupScreen.tsx)).
- **Auto-Fokus auf den Freigabe-Button ab Schritt 2** — nach „Zulassen" genügt Enter, kein Mausweg zurück ([GuidedGrantSteps.tsx](src/core/components/GuidedGrantSteps.tsx)).
- **Optimistische Auto-Kette**: nach einem Erfolg wird der nächste Ordner sofort probiert; in Chrome/`file://` folgenlos, in Browsern mit gebündelten Permissions spart es Klicks.
- **Stiller Fehlschlag wird nie als „abgelehnt" gebucht** (`ketteAbgebrochenOhnePrompt`, 300ms-Schwelle) — sonst wäre der Ordner dauerhaft übersprungen ([guided-grant-progress.ts](src/core/components/guided-grant-progress.ts)).
- Beide Zusätze in der Bug-Klasse dokumentiert; der erste Grant pro Klick bleibt bewusst unverändert ([recurring-bug-classes.md §2](docs/architecture/recurring-bug-classes.md)).

### v2.274.0 — KI-Variante wirkt jetzt auch im Chat (Juli 2026)

MINOR — Der Umschalter „Standard/Agentisch" war im Chat ein toter Schalter: der Chat bevorzugt `streamConversation`, und genau diese Methode sendete kein `ziel` — der Tab wurde nie gewechselt. Der Zweig, der die Präferenz durchreichte, war für die Bridge unerreichbar.

- **`ConversationOptions.ziel`** ergänzt und in `streamConversation` gesendet; ohne gesetztes Ziel fehlt das Feld weiterhin ganz ([streamlit.ts](src/core/services/ai/transports/streamlit.ts)).
- **Rein app-seitig**: das Snippet wertet `ziel` bei jedem `tf-request` aus — kein `BRIDGE_REV`-Bump, keine Neu-Installation des Lesezeichens.
- **Batch-Job übergibt `ziel`** wie alle anderen Runner — sonst rechnete er mit dem Kontext des einen Tabs und sendete an den anderen ([useBatchJob.ts](src/plugins/antraege/gutachten-batch/useBatchJob.ts)).
- Die überholte Begründung „`ConversationOptions` trägt bewusst kein `ziel`" im Bridge-Doc ersetzt statt ergänzt ([streamlit-bridge.md](docs/architecture/streamlit-bridge.md)).
- Regressionstest an der Naht, gegen den alten Stand als fehlschlagend verifiziert ([streamlit-ziel.test.ts](src/core/services/ai/__tests__/streamlit-ziel.test.ts)).

### v2.273.1 — Agentisches Kontextfenster 262k statt 260k (Juli 2026)

PATCH — Die Streamlit-Seite weist die Chatlänge selbst aus: „0k von 62k" bzw. „1k von 262k". Die im Repo verstreuten „260k" waren also gerundet bzw. falsch.

- **`BRIDGE_AGENTISCH_CONTEXT_TOKENS` 260.000 → 262.000**; alle „260k"-Labels in Eval-Panels und Docs mitgezogen ([llm-context.ts](src/core/services/ai/llm-context.ts)).
- Kommentar korrigiert: die Werte sind **nicht abfragbar**, aber sehr wohl sichtbar — sie stammen aus den llama.cpp-Konfigurationen hinter der Streamlit-App.
- **Ausbaupfad notiert**: das Bookmarklet scrapt die Seite ohnehin und könnte die Chatlänge mitmelden; kostet einen `BRIDGE_REV`-Bump ([streamlit-bridge.md](docs/architecture/streamlit-bridge.md)).

### v2.273.0 — Kontextfenster je KI-Variante (agentisch 260k) (Juli 2026)

MINOR — Der Cap kannte bisher nur EINEN Wert und ignorierte, wohin der Lauf geht. Über die Bridge galt ersatzweise der lokale llama.cpp-Default (81.920) — für den agentischen Qwen-Tab (260k) viel zu klein, für den Standard-Tab (62k) zu gross. Ergebnis: agentische Läufe wurden grundlos gekürzt, Standard-Läufe zu spät gewarnt.

- **`getVbCharCap(ziel)` / `getLlmContextTokens(ziel)`** unterscheiden Bridge-Tab und lokalen Server; Präzedenz manuell > Bridge-Tab > erkannt > Default ([llm-context.ts](src/core/services/ai/llm-context.ts)).
- **`istBridgeAktiv()`** an der Bridge + `kontextZielFuerLauf(bridge)` als einzige Ableitung ([bridge.ts](src/core/services/ai/bridge.ts), [ki-ziel.ts](src/core/services/ai/ki-ziel.ts)).
- **Alle Läufe und Warnhinweise** ziehen nach: Gutachten, Kurzfassung, NF, Batch, Aufbereitung, MAP, Upload-Dialoge ([useVbCharCap.ts](src/core/hooks/useVbCharCap.ts)).
- **Agentisch: ~767.700 statt ~233.500 Zeichen** — das Dreifache; eine übliche VB samt Zusatzdokumenten wird damit praktisch nicht mehr gekürzt.
- Die Einstellung „Kontextfenster" weist bei aktiver Bridge aus, dass dort die Tab-Werte gelten ([AIProviderTab.tsx](src/plugins/einstellungen/AIProviderTab.tsx)).

### v2.272.1 — Warnung bei zu grossem Dokumenten-Korpus (Juli 2026)

PATCH — Die Baustein-Schiene (`runBaustein`) umgeht `runSkill` und damit `capVbMarkdown`: sie kürzt nicht und warnt nicht. Die Upload-Warnung prüft jede Datei einzeln, nie ihre Summe. VB plus Marketingkonzept liefen deshalb ungekürzt und unbemerkt über das Kontextfenster — das Modell sah das Ende nicht.

- **`misseKorpus` als geteilte, reine Messung** neben `baueKorpus`; MAP und Aufbereitung nutzen dieselbe Definition ([quellen.ts](src/plugins/antraege/aufbereitung/quellen.ts)).
- **Warnung im Quellen-Panel** der Aufbereitung, bewusst ausserhalb der einklappbaren Sektion ([QuellenPanel.tsx](src/plugins/antraege/aufbereitung/QuellenPanel.tsx)).
- **`korpusMass` am Hook**, gesetzt beim Auflösen des Korpus ([useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts)).
- Bewusst nur **messen, nicht kürzen**: eine stille Kürzung wäre der schlechtere Fehler und würde bestehende Ergebnisse verändern.

### v2.272.0 — MAP: Vorhabensbeschreibung aus mehreren Dateien (Juli 2026)

MINOR — Die Vorhabensbeschreibung ist bei diesen Anträgen fast nie eine Datei: Marktkonzept, Verwertung und Wirkung liegen meist als eigene PDFs bei. Der MAP hielt bisher genau ein Dokument. Nur dev (`mapFoerderfaehig`).

- **Hauptdokument plus beliebig viele Zusatzdokumente**; die Zuordnung trägt `zusatz` additiv, ältere Zuordnungen laden unverändert ([store.ts](src/plugins/map-foerderfaehig/store.ts)).
- **Korpus über die geteilte `baueKorpus`** der Aufbereitung statt eines zweiten Formats — ohne Zusatzdokument byte-identisch, Sektions-IDs des Hauptdokuments bleiben stabil ([korpus.ts](src/plugins/map-foerderfaehig/vb/korpus.ts)).
- **Steckbrief, Aspekte, Infografik, Lesemodus und Fundstellen lesen den Korpus**, nicht mehr das Hauptdokument allein ([useMapVb.ts](src/plugins/map-foerderfaehig/useMapVb.ts)).
- **Cap-Warnung über die Summe**: die Baustein-Schiene kürzt nicht und der Upload-Check prüft nur je Datei — ein zu grosser Korpus wird jetzt sichtbar gemeldet statt still abgeschnitten ([korpus.ts](src/plugins/map-foerderfaehig/vb/korpus.ts)).

### v2.271.1 — VB direkt im Reiter ablegen (MAP, dev) (Juli 2026)

PATCH — Der Reiter „Vorhabensbeschreibung" konnte bisher nur aus dem globalen Dokumenten-Index wählen. Wer die VB noch nicht aufgenommen hatte, sah eine Sackgasse und musste das Plugin verlassen. Nur dev (`mapFoerderfaehig`).

- **Aufnahmefläche direkt im Reiter** über die geteilte `DokumentAufnahme` — Drag & Drop, `offenHalten`, Typ vorbelegt auf „Vorhabensbeschreibung" ([VbPanel.tsx](src/plugins/map-foerderfaehig/components/VbPanel.tsx)).
- **Nachreichen bei bereits zugeordneter VB** über einen Umschalter neben „Zuordnung lösen" ([VbPanel.tsx](src/plugins/map-foerderfaehig/components/VbPanel.tsx)).
- Leerer Zustand verweist jetzt auf die Ablagefläche statt nur „keine Dokumente aufgenommen" zu melden.

### v2.271.0 — MAP: Testleitfaden, Architektur-Doku, Abnahme (Juli 2026)

MINOR — Abschluss des MAP: Drehbuch für die Vorführung, Architektur-Doku mit den tragenden Entscheidungen und ihren Begründungen, Abnahme über alle Build-Varianten. Nur dev (`mapFoerderfaehig`).

- **Testleitfaden** als 20-Minuten-Drehbuch mit Editor- und Schema-Moment; Ziel der Runde ist ausdrücklich Widerspruch, nicht Zustimmung ([map-testleitfaden.md](docs/map-testleitfaden.md)).
- **Architektur-Doku** hält fest, *warum* so entschieden wurde — Marker-Erkennung, fünf Status, Fundstellen ohne Orama — samt Ausbaupfaden ([map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md)).
- **Abnahme**: Flag nachweislich nur im dev-Bundle gesetzt, in prod/pl/as/kurator gar nicht vorhanden; `npm run check` grün, `build:dev` + `build:pl` gebaut.
- **CLAUDE.md-Ceiling 47.000 → 47.500** bewusst angehoben, nachdem der Eintrag auf zwei harte Regeln plus Themen-Doc-Link eingedampft war ([doc-links.test.ts](src/__tests__/doc-links.test.ts)).

### v2.270.0 — MAP: Canvas, SdT-Delta, Wirkungskette, Portfolio-Prinzipansicht (dev) (Juli 2026)

MINOR — Drei Ansichten machen das Vorhaben auf einen Blick prüfbar — und zeigen dabei vor allem, wo die Vorhabensbeschreibung nichts hergibt. Dazu eine Portfolio-Prinzipansicht mit erfundenen Demo-Daten. Nur dev (`mapFoerderfaehig`). Detail: [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md).

- **Ein Lauf für drei Ansichten** statt drei Läufen: Canvas-Texte, Delta-Zeilen und Wirkungsketten-Glieder kommen aus einem internen Extraktions-Skill, je VB-Hash gecacht ([map-infografik.seed.ts](src/core/services/skills/registry/map-infografik.seed.ts), [schema.ts](src/plugins/map-foerderfaehig/infografik/schema.ts)).
- **Lücken zeigen, nicht füllen**: eine Aussage ohne gültige Fundstelle gilt nie als belegt, erfundene Abschnitts-IDs werden verworfen, vage Felder erscheinen amber und gestrichelt ([schema.ts](src/plugins/map-foerderfaehig/infografik/schema.ts), [ProjektCanvas.tsx](src/plugins/map-foerderfaehig/components/ProjektCanvas.tsx)).
- **Richtwerte deterministisch** gegen die importierten Projektkosten; „nicht beziffert" wird ausdrücklich von „verfehlt" unterschieden ([richtwerte.ts](src/plugins/map-foerderfaehig/infografik/richtwerte.ts)).
- **Verdächtig-Guard**: eine formal gültige, inhaltlich leere Antwort wird nicht gecacht — sonst friert ein Fehlversuch die Ansicht dauerhaft ein ([useMapVb.ts](src/plugins/map-foerderfaehig/useMapVb.ts)).
- **Portfolio-Sunburst** aus fest verdrahteten Demo-Daten, hand-rolled SVG, dauerhaft gelabelt; die Ansicht liest bewusst nichts aus dem Store ([portfolio-demo.ts](src/plugins/map-foerderfaehig/infografik/portfolio-demo.ts)).

### v2.269.0 — MAP: Vorhabensbeschreibung, Steckbrief, Fundstellen, Reader Lite (dev) (Juli 2026)

MINOR — Die inhaltliche Seite der Prüfung: Vorhabensbeschreibung zuordnen, Steckbrief erzeugen, Abschnitte je Prüfaspekt lesen, Fundstellen an den Kriterien. Alle KI-Anteile sind optional und degradieren sichtbar. Nur dev (`mapFoerderfaehig`). Detail: [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md).

- **Zuordnung statt Automatik**: Kandidaten werden nach Akronym, Dateinamensmuster und Titelwörtern vorgeschlagen, bestätigt wird von Hand — ein falsch zugeordnetes Dokument stützte die ganze Prüfung auf den falschen Antrag ([zuordnung.ts](src/plugins/map-foerderfaehig/vb/zuordnung.ts)).
- **Steckbrief und Aspekt-Zuordnung** über die bestehenden Aufbereitungs-Bausteine, mit eigenem Cache-Präfix `map:<id>` gegen Kollisionen mit echten Anträgen ([useMapVb.ts](src/plugins/map-foerderfaehig/useMapVb.ts)).
- **Fundstellen deterministisch** über die Achse Kriterium → Prüfaspekt → VB-Sektion; Orama liefert weder Überschriftenpfad noch Antragsbezug und wird bewusst nicht genutzt ([fundstellen.ts](src/plugins/map-foerderfaehig/vb/fundstellen.ts)).
- **Reader Lite** mit sichtbarem „0 Fundstellen"-Zustand — ein Aspekt ohne Abschnitt ist selbst ein Befund ([ReaderLite.tsx](src/plugins/map-foerderfaehig/components/ReaderLite.tsx)).
- **Direkt-Importe statt Aufbereitungs-Barrel**: das Barrel zieht den PDF-Stack nach, den der MAP nicht braucht ([fundstellen.ts](src/plugins/map-foerderfaehig/vb/fundstellen.ts)).

### v2.268.0 — MAP: editierbare Checkliste, Pruef-Stepper, Abschluss-Entwuerfe (dev) (Juli 2026)

MINOR — Die Prüfung selbst kommt in die App: Kriterien aus der Papiervorlage, Bewertung durch den Menschen, Abschluss als kopierbarer Entwurf. Kern der Demo ist der Editor — ein fehlendes Kriterium lässt sich im Gespräch ergänzen, die Fassung zählt hoch. Nur dev (`mapFoerderfaehig`). Detail: [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md).

- **Seed wörtlich aus den Papier-Checklisten** (26 Kriterien, drei Skala-Kategorien mit den Ankertexten B0–B3); Ergänzungen der App tragen `herkunft: 'app'` und sind damit unterscheidbar ([seed.ts](src/plugins/map-foerderfaehig/checkliste/seed.ts)).
- **Fünf Status wie im Formular** (erfüllt / nicht erfüllt / n. z. / NF notw. / NF erfüllt) — bewusst abweichend vom Konzeptdokument: der Item-Verlauf macht so unterscheidbar, ob eine Nachforderung erledigt oder neu bewertet wurde ([typen.ts](src/plugins/map-foerderfaehig/checkliste/typen.ts)).
- **Drei Regeln an einer Stelle**: eine einzige B0-Stufe setzt die Punktzahl auf 0, bedingte Blöcke entfallen vollständig, „n. z." senkt die erreichbare Punktzahl ([bewertung.ts](src/plugins/map-foerderfaehig/checkliste/bewertung.ts)).
- **Editor mit Versions-Stempel**: jede Speicherung zählt die Fassung hoch; laufende Prüfungen bleiben auf ihrer Fassung, Bewertungen zu entfernten Kriterien bleiben erhalten ([editor.ts](src/plugins/map-foerderfaehig/checkliste/editor.ts), [verlauf.ts](src/plugins/map-foerderfaehig/checkliste/verlauf.ts)).
- **Abschluss ohne KI**: Gutachten, Nachforderung und Ablehnung deterministisch als Markdown; NF-Bausteine wortgetreu (Pitfall #34), ohne Treffer `[TODO Baustein zuordnen]` statt Erfundenem ([markdown.ts](src/plugins/map-foerderfaehig/abschluss/markdown.ts)).

### v2.267.0 — MAP Foerderfaehigkeit: Einreichungs-Import, Rechenchecks, Kompaktansicht (dev) (Juli 2026)

MINOR — Die Fachprüfung läuft heute über eine xlsx-Liste. Der MAP zieht sie in die App: Einreichungs-JSON per Drag & Drop, deterministische Rechenchecks, Kompaktansicht. Eigene kv-Entität ohne `Antrag`-Record — die CSV-/Antrags-Pipeline bleibt unberührt. Nur dev (`mapFoerderfaehig`). Detail: [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md).

- **PII-Absicherung zuerst**: alle Plattform-Rohexporte, die internen Prüf-DOCX und die MAP-Screenshots ignoriert — der Echtfall war untracked, aber *nicht* ignoriert; getrackt wird nur die gescrubbte, strukturgleiche Fixture ([.gitignore](.gitignore)).
- **Schema-Erkennung über diskriminierende Marker** statt über Pflichtfeld-Quoten: beide Generationen tragen die importrelevanten Felder auf identischen Pfaden, eine Quoten-Erkennung liefert immer Gleichstand ([schema-erkennung.ts](src/plugins/map-foerderfaehig/import/schema-erkennung.ts)).
- **Alias-Ketten je Zielfeld** als Drift-Puffer; der Import-Report weist jeden gegriffenen Alias, jedes fehlende Pflichtfeld und jeden nicht ausgewerteten Bereich aus ([adapter.ts](src/plugins/map-foerderfaehig/import/adapter.ts)).
- **Datenschutz als Pfad-Präfix-Deny-Liste + Nachweis-Scan** über das Ergebnis; übernommen werden nur PM-Summen und Personalnummer/N.N. ([redaktion.ts](src/plugins/map-foerderfaehig/import/redaktion.ts)).
- **Fünf Rechenchecks** und die Kompaktansicht (Eckdaten, Gantt über die geteilte `GanttAchse`, Kostenbalken über `DistributionBar`) ([rechenchecks.ts](src/plugins/map-foerderfaehig/import/rechenchecks.ts), [KompaktAnsicht.tsx](src/plugins/map-foerderfaehig/components/KompaktAnsicht.tsx)).

### v2.266.0 — Aufbereitung: Zeitplan pausiert, Zahlen auf prüfrelevante Bereiche fokussiert (Juli 2026)

MINOR — Der Zeitplan liest die Arbeitspakete aus den PDF-Quellen zu unzuverlässig; er wird pausiert, bis der Antrag als JSON vorliegt. Das Zahlen-Inventar liefert außerhalb von „Leistung & Technik" + „Markt & Absatz" sehr viele nicht prüfrelevante Werte. Beides ist ein reines Anzeige-Gate (keine Migration, kein Cache-Verlust), nur dev (`antragAufbereitung`). Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

- **Pause an einer Stelle**: `ZEITPLAN_PAUSIERT` + `ZAHL_KATEGORIEN_PRUEFRELEVANT` als einzige Rücknahme-Stelle, import-frei ([pausierte-module.ts](src/plugins/antraege/aufbereitung/pausierte-module.ts)).
- **Zeitplan-Tab dauerhaft inaktiv** mit Grund im Tooltip — Check vor der activeTab-Ausnahme ([tab-gating.ts](src/plugins/antraege/aufbereitung/tab-gating.ts)).
- **Übersicht ohne „Zeitplan öffnen"**: der Einstieg wäre sonst ein Umgehungsweg an der gesperrten Tab-Leiste vorbei ([UebersichtTab.tsx](src/plugins/antraege/aufbereitung/UebersichtTab.tsx)).
- **Zahlen-Tab**: nicht prüfrelevante Kategorien ausgegraut + zugeklappt (Zähler sichtbar, Claims aufklappbar) ([ZahlenTab.tsx](src/plugins/antraege/aufbereitung/ZahlenTab.tsx)).
- **Zahlen-Widersprüche pausiert** (Gate an den Konsumenten, reine `pruefeZahlWidersprueche` bleibt intakt + getestet) ([ZahlenTab.tsx](src/plugins/antraege/aufbereitung/ZahlenTab.tsx), [fragen.ts](src/plugins/antraege/aufbereitung/fragen.ts)).
- **Alle Zeitplan-Befunde stumm**: auch die deterministischen Zeitplan-/Kapazitäts-Befunde (`run.befunde`) schweigen im Fragen- und Abdeckungs-Tab, solange der Zeitplan pausiert ist — geteilter `sichtbareZeitplanBefunde`-Helper ([pausierte-module.ts](src/plugins/antraege/aufbereitung/pausierte-module.ts), [AbdeckungTab.tsx](src/plugins/antraege/aufbereitung/AbdeckungTab.tsx)).

### v2.265.3 — Assistenten-Spine: Icon monochrom & dezent (Juli 2026)

PATCH — Feinschliff nach v2.265.2: die türkise Primär-Kachel war für den ruhigen Spine-Streifen zu präsent. Nur dev (`assistentPanel`).

- **Icon monochrom & dezent**: Primär-Badge-Füllung entfernt, Sparkles-Glyph im gedämpften `--tf-text-secondary` (Hover → `--tf-text`), abgestimmt aufs vertikale Label ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)).

### v2.265.2 — Assistenten-Spine: Icon-Kachel 2px kleiner (18px) (Juli 2026)

PATCH — Feinschliff nach v2.265.1: die Primär-Badge-Kachel in der schmalen Spine war einen Tick zu prominent. Nur dev (`assistentPanel`).

- **Icon-Kachel 20px → 18px** in der Dock-Spine ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)); Sparkles-Glyph unverändert.

### v2.265.1 — Assistenten-Spine schmal (28px) + sichtbar bei offenem Panel (Juli 2026)

PATCH — Nachgezogener Design-Handoff für die rechte Assistenten-Spalte: die dauerhafte Dock-Spine wird von 48px auf 28px verschlankt und trägt statt eines Hover-Tooltips ein dauerhaft sichtbares vertikales „ASSISTENT"-Label. Zusätzlich bleibt die Spine jetzt bei offenem Panel stehen (Panel als Overlay daneben). Nur dev (`assistentPanel`).

- **Schmale 28px-Spine** mit Mini-Primär-Badge + vertikalem Label (kein Tooltip); Breite als Single-Source `SPINE_WIDTH` ([panelUiStore.ts](src/plugins/chat/assistent/panelUiStore.ts), [AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)).
- **Spine bleibt bei offenem Panel sichtbar** und togglet; das Panel öffnet als Overlay links daneben (`right: SPINE_WIDTH`) statt bündig-rechts — breite Tabellen behalten ihre Breite ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)).
- **Reservierter `<main>`-Rand** zieht auf `SPINE_WIDTH` nach ([ShellLayout.tsx](src/core/ShellLayout.tsx)); Doku: [assistent-panel.md](docs/architecture/assistent-panel.md) (Dock-Form).

### v2.265.0 — In-App-Eval: Kontext-Achse (Relevanz-Map A/B) + interner Judge (Juli 2026)

MINOR — Die Relevanz-Map (kuratierter VB-Kontext statt Volltext) war produktiv verdrahtet, aber schlafend und nur in der Node-CLI messbar. Der Bridge-Rechner (gpt-oss) hat kein Node → das A/B (hält „relevant" die Gutachten-Qualität?) braucht ein In-App-Vehikel. Phase 0: nur das Mess-Panel; die kuratierte Umstellung folgt separat nach dem Nutzer-A/B. Nur dev.

- **Kontext-Achse** `voll · relevant · beide` im Skill-Eval-Panel: der `relevant`-Arm rechnet die Relevanz-Map je Fixture (Reuse `computeRelevanzMap`/`assembleVbRelevant`, kein Fork) + Schwellen-Override (nur Eval) ([eval-batch.ts](src/core/services/skill-eval/eval-batch.ts), [SkillEvalPanel.tsx](src/plugins/skill-verwaltung-kuration/SkillEvalPanel.tsx)).
- **Ehrlichkeits-Pflicht**: „Map angewandt: n/m" + Kontextgröße voll→relevant je Fixture; 0/m wird als „beide Arme identisch, kein A/B" markiert (`relevanzInfos`).
- **Judge Default intern-agentisch (Qwen)** über einen Adapter (frischer Chat + `ziel:'agentisch'` + Thinking-Strip, hält `runJudge` unangetastet); OpenRouter nur noch als gespiegelte Alternative hinter `isOpenRouterEnabled()`; „Judge einschließen"-Schalter (Default aus), `judgeModellId`-Tag.
- **JSONL-Export** (CLI-feldkompatibel, `kontext`-Tag) + Ergebnis-Matrix mit Kontext-Spalte + Δ (relevant − voll).
- Tests: `both`-Arme, Schwellen-No-op, Map angewandt (< Volltext), Map-Fehler → Volltext-Degradation, Adapter (Reset + `ziel` + `<think>`-Strip). Doku: [skill-eval-gui.md](docs/architecture/skill-eval-gui.md).

### v2.264.0 — Antrag-Aufbereitung: Lesemodus-Silhouette-Nav + Fundstellen-Overlay + Doku (dev) (Juli 2026)

MINOR — Paket 5, Phase 5 (Abschluss): Der Lesemodus wird von „Gliederung + Text" zu einer echten Navigation — schmale Silhouette als Scroll-Navigation (aktueller Abschnitt hervorgehoben) + Marginalien-Marker, die je Abschnitt zeigen, welche Bausteine ihn referenzieren. Nur dev.

- **Silhouette-Scroll-Nav** im Lesemodus: proportionale Ebene-1-Blöcke, aktueller Viewport-Abschnitt via `IntersectionObserver` hervorgehoben, Klick scrollt hin ([LesemodusSilhouette.tsx](src/plugins/antraege/aufbereitung/LesemodusSilhouette.tsx)); Massen-Kern geteilt mit der Abdeckungs-Silhouette ([silhouette-core.ts](src/plugins/antraege/aufbereitung/silhouette-core.ts), behavior-preserving refaktoriert).
- **Fundstellen-Overlay**: deterministische Aggregation (Abdeckung/Steckbrief/Zahlen/Verwertung/Glossar je Sektion) → Zähler-Marker + Popover ([lesemodus-fundstellen.ts](src/plugins/antraege/aufbereitung/lesemodus-fundstellen.ts) + [LesemodusTab.tsx](src/plugins/antraege/aufbereitung/LesemodusTab.tsx)).
- **Doku**: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) um Paket 5 (Cockpit, DR-Fluss + DSGVO, externe Schicht, Zahlen-Relevanz, Zeitplan-Degradation, Lesemodus) erweitert.
- Tests: Fundstellen-Aggregation (mehrere Bausteine, fremde IDs, leer, Kürzung).

### v2.263.0 — Antrag-Aufbereitung: Zahlen straffen + Zeitplan ehrlich degradieren (dev) (Juli 2026)

MINOR — Paket 5, Phase 4. Prüfer-Feedback „zu viele Zahlen": Prompt auf prüfrelevante Auswahl geschärft + neues Claim-Feld `relevanz` (kern/detail) → UI-Filter „Kernzahlen" (Default). Zeitplan: eine unsicher ausgelesene Anlage 5 (PDF-Tabelle zerfallen) täuschte per Gantt Vollständigkeit vor — jetzt ehrlich „nicht auslesbar" + Roh-Tabellen statt Diagramm. Nur dev.

- **Zahlen-Prompt geschärft** (erwünscht/unerwünscht) + optionales `relevanz` (Parser tolerant, fehlend→`detail`, alte Caches gültig) ([zahlen.ts](src/plugins/antraege/aufbereitung/zahlen.ts)).
- **ZahlenTab-Filter** „Kernzahlen"/„Alle" (ScopeTabs) + Zähler „X von Y angezeigt" + Kategorie-Gruppen bei >8 eingeklappt ([ZahlenTab.tsx](src/plugins/antraege/aufbereitung/ZahlenTab.tsx)).
- **Zeitplan-Degradation**: `zeitplanUnsicher` (0 AP-Zeilen ODER >50 % ohne Laufzeit-Spanne) → kein Gantt, Hinweis + Roh-Tabellen ([Rohtabellen.tsx](src/plugins/antraege/aufbereitung/Rohtabellen.tsx) via `MarkdownRenderer`); Ghost-Toggle „Rohtabellen anzeigen" auch bei gelungener Extraktion ([zeitplan-qualitaet.ts](src/plugins/antraege/aufbereitung/zeitplan-qualitaet.ts), Solo + Verbund).
- **Keine Seed-Migration nötig**: der Zahlen-Prompt lebt in `buildZahlenPrompt` (Code), nicht im Seed-`promptTemplate` — die Änderung deployt mit dem Build.
- Tests: `zeitplanUnsicher`/`tabelleAlsMarkdown`, `relevanz`-Parse (fehlend→detail).

### v2.262.0 — Antrag-Aufbereitung: Verwertung/Markt gegen externe Schicht spiegeln (dev) (Juli 2026)

MINOR — Paket 5, Phase 3: Der Verwertung/Markt-Tab stellt je Kategorie „Laut Antrag" den importierten externen Aussagen („Extern · nicht verifiziert") gegenüber. Zuordnung ausschließlich über die geteilte Kategorie — KEIN Fuzzy-Matching, KEINE automatische Widerspruchs-Wertung; der Prüfer vergleicht selbst. Nur dev.

- **Reine Gegenüberstellung** `gruppiereVergleich` (Kategorie-Gruppierung; `sdt` bleibt draußen) ([verwertung-vergleich.ts](src/plugins/antraege/aufbereitung/verwertung-vergleich.ts)).
- **VerwertungTab zwei Spalten** je Kategorie (Antrag mit Fundstelle · extern mit Quellen-Link + „nicht verifiziert"); Leer-Hinweis mit Link auf den Recherche-Tab ([VerwertungTab.tsx](src/plugins/antraege/aufbereitung/VerwertungTab.tsx)).
- Tests: Kategorie-Gruppierung, leere Schicht, nur-extern-Kategorie, mehrere Importe, `sdt`-Ausschluss.

### v2.261.0 — Antrag-Aufbereitung: DR-Rückweg (Import JSON/Datei/Rohtext) (dev) (Juli 2026)

MINOR — Paket 5, Phase 2: Deep-Research-Ergebnisse kommen von außen zurück in die App (Report-Text, PDF oder Word — kein verlässliches JSON). Toleranter Import: enthaltener JSON-Block direkt → sonst interner Strukturierungs-Lauf → sonst Rohtext. Als dritte Wissensschicht „extern · nicht verifiziert". Externe Quellen bleiben strikt aus dem VB-Korpus. Nur dev.

- **Run-Erweiterung** `extern?: ExterneRecherche[]` (additiv, alte Runs ladbar) + geteiltes DR-JSON-Schema/Parser ([types.ts](src/plugins/antraege/aufbereitung/types.ts) + [recherche-schema.ts](src/plugins/antraege/aufbereitung/recherche-schema.ts)).
- **Import-Pfade** (Text einfügen / PDF-Word-Upload via bestehendem `DocConverter`) + toleranter Orchestrator ([recherche-import.ts](src/plugins/antraege/aufbereitung/recherche-import.ts)); Recherche-Tab „Ergebnis zurückbringen" mit Import-Liste (löschbar, SdT-Aussagen inline) ([RechercheTab.tsx](src/plugins/antraege/aufbereitung/RechercheTab.tsx)).
- **Interner Strukturierungs-Lauf** (`aufbereitung-recherche-import`, `aktiv:false`) über den neuen intern-pflichtigen Slot `{{externText}}` ([INHALTS_SLOTS](src/core/services/ai/transport-policy.ts)); Cache über den Hash des externen Texts.
- **Keine Korpus-Vermischung**: externe Dokumente werden NUR als Text extrahiert (kein Korpus-Tag, keine Indexierung, kein `vbHash`-Einfluss).
- Tests: Parser-Matrix + Import-Orchestrierung + Run-Kompatibilität alt→neu.

### v2.260.0 — Antrag-Aufbereitung: Deep-Research-Prompt + Recherche-Tab-Umbau (dev) (Juli 2026)

MINOR — Paket 5, Phase 1: Der Prüfer lässt sich als ALLERERSTES einen anonymen Deep-Research-Auftrag von der internen KI erzeugen und trägt ihn per Zwischenablage in ChatGPT/Claude/Mistral (5–10 Min externe Recherche parallel zur internen Aufbereitung). DSGVO: Anonymisierungs-Constraints im Skill + deterministischer Leak-Check + Pflicht-Review. Nur dev.

- **Neuer DR-Prompt-Baustein** (`aktiv:false`, agentische Variante + Standard-Fallback), läuft zuerst; erzeugt den anonymen Auftrag ([recherche-prompt.ts](src/plugins/antraege/aufbereitung/recherche-prompt.ts) + [aufbereitung-recherche-prompt.seed.ts](src/core/services/skills/registry/aufbereitung-recherche-prompt.seed.ts)).
- **Deterministischer Leak-Check** vor dem Kopieren: erzeugter Prompt case-insensitiv gegen Stammdaten (Name/FKZ/Az/Titel/Namensbestandteile ≥4); Treffer → degradiert, nur einsehbar ([recherche-leak.ts](src/plugins/antraege/aufbereitung/recherche-leak.ts)).
- **Recherche-Tab umgebaut**: „Deep Research starten" (Review-Hinweis + Kopieren-&-Öffnen), „Marktzugang des KMU" (kurator-gated, Default AUS, identifizierend/deterministisch), Import-Platzhalter, Einzel-Suchanfragen eingeklappt ([RechercheTab.tsx](src/plugins/antraege/aufbereitung/RechercheTab.tsx)).
- **Kurator-Config** (DR-Ziel-URLs + Marktzugang-Schalter) team-weit auf dem Share ([aufbereitung-settings.ts](src/plugins/antraege/aufbereitung/aufbereitung-settings.ts) + [AufbereitungRechercheSettings.tsx](src/plugins/antraege/aufbereitung/AufbereitungRechercheSettings.tsx)); agentische Variante pro Baustein durchgereicht ([bausteine.ts](src/plugins/antraege/aufbereitung/bausteine.ts)).
- Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) (folgt in Phase 5).

### v2.259.0 — Antrag-Aufbereitung: Übersicht-Cockpit + Tab-Gating (dev) (Juli 2026)

MINOR — Start von Paket 5 (Recherche & Cockpit): Die KI-Läufe dauern Minuten, aber man sah nur `kiFertig/5` im Button. Neuer erster Tab „Übersicht" mit vertikalem Stepper zeigt live, was läuft/fertig ist; baustein-gebundene Tabs sind während eines Laufs erst klickbar, wenn ihr Baustein fertig ist. Nur dev.

- **Neuer Default-Tab „Übersicht"** (Cockpit): Stepper über die KI-Bausteine + deterministischer Zeitplan-/Quellen-Status, dieselben Start-Actions ([UebersichtTab.tsx](src/plugins/antraege/aufbereitung/UebersichtTab.tsx) + reines [uebersicht.ts](src/plugins/antraege/aufbereitung/uebersicht.ts)).
- **Dynamisches Tab-Gating** aus dem Baustein-Status (reine `deriveTabZustaende`): gesperrt bis fertig; nie vor dem ersten Lauf, nie der aktive Tab, `fehler` bleibt klickbar ([tab-gating.ts](src/plugins/antraege/aufbereitung/tab-gating.ts) + [AufbereitungTabs.tsx](src/plugins/antraege/aufbereitung/AufbereitungTabs.tsx)).
- Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) (folgt in Phase 5).

### v2.258.0 — Assistent-Panel: routen-sensitive Quick-Action-Leiste (Topf 1) (Juli 2026)

MINOR — Die statischen Beispielfragen des Assistent-Panels werden zu routen-sensitiven Quick Actions: vorgefertigte Fragen über dem ohnehin assemblierten Kontext, je nach Ansicht/Entität. Kein neuer LLM-/Transport-Mechanismus — ein Klick schickt nur einen Fragetext durch denselben Turn-Pfad. Nur dev.

- **Reiner Quick-Action-Katalog** (5 Aktionen, ausblenden statt ausgrauen) statt `BASIS_BEISPIELE` ([quickActions.ts](src/plugins/chat/assistent/quickActions.ts), verdrahtet in [AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)).
- **Deterministischer Arbeitsvorrat-Übersichtsblock** für den Kein-Entität-Fall (Liste/Startseite), damit „Fristen"/„Was ist heute dran?" faktengestützt sind ([arbeitsvorratUebersicht.ts](src/plugins/chat/assistent/arbeitsvorratUebersicht.ts) + [assembliere.ts](src/core/services/assistent/kontext/assembliere.ts)).
- **„Plan bis Bewilligung" bewusst weggelassen** — keine Spine-Restschritt-Ableitung vorhanden (STOPP-Bedingung, keine neue Statusmaschine). Detail: [assistent-panel.md](docs/architecture/assistent-panel.md).

### v2.257.1 — Gedächtnis-Eval: Transport-Default auf Intern (gpt-oss) (Juli 2026)

PATCH — Die Baseline zeigte: der agentische Qwen-Tab liefert für die strukturierte JSON-Konsolidierung teils Reasoning-Prosa statt JSON + Loop-Detector-Abbruch. Der Standard-Chat (gpt-oss) ist zuverlässig — und die Produktion nutzt ihn ohnehin. Also der passendere Panel-Default.

- **Panel-Transport-Default `agentisch` → `intern`** (gpt-oss / Standard-Chat) ([GedaechtnisEvalPanel.tsx](src/plugins/einstellungen/GedaechtnisEvalPanel.tsx)); `agentisch`/`openrouter` bleiben wählbar.

### v2.257.0 — KI-Assistent inkl. Gedächtnis in dev aktiviert (Juli 2026)

MINOR — Abschluss der KI-Assistent-dev-Aktivierung: nachdem die In-App-Gedächtnis-Eval (interne gpt-oss-Baseline, n=3) die Schwelle erreichte — fortschreibung/widerspruch/poisoning 3/3, kaltstart 2/3 — wird die Gedächtnis-Konsolidierung (Phase 2) in **dev** scharfgeschaltet. Weiterhin **opt-in + doppelt gegatet**; der Assistent ist per Default „nicht verbunden".

- **`assistentGedaechtnis: true`** in [configs/dev.config.json](configs/dev.config.json) (einzige Flag-Änderung; keine Schema-Änderung — steht schon in `DEFAULT_CONFIG`). Konsolidierung intern via `getTransportForKonsolidierung()` (Standard-Chat, kein `ziel`), `BridgeMutex`-serialisiert, Poisoning-Guard aktiv, Store nie im Snapshot.
- **Nur dev.** `pl/prod/kurator/as` unverändert — der Behörden-Rollout wartet auf DSB/Personalrat (viel später).
- Vorausgegangen: In-App-Eval-Panel (v2.256.0) + Baseline-Korrekturen (v2.256.2 Harness-Recalibrierung + Kontext-Wechsel-Prompt, v2.256.4 realistischere kaltstart-Fixture). Detail: [assistent-gedaechtnis.md](docs/architecture/assistent-gedaechtnis.md).

### v2.256.4 — Gedächtnis-Eval: kaltstart-Fixture realistischer (Skill 3× gestartet) (Juli 2026)

PATCH — Der gpt-oss-Baseline-Lauf (n=3) war 3/4 rock-solid; kaltstart scheiterte 2/3 nur an `praeferenzen:Kurzfassung`. Ursache: die Fixture nannte einen *einmaligen* Skill-Start ein „klares Arbeitsmuster" — überzogen. Statt die Assertion zu lockern, wird das Signal realistisch: der Skill wird mehrfach gestartet, dann ist die Präferenz-Erwartung berechtigt.

- **kaltstart-Fixture**: Skill „kurzfassung" jetzt **3× gestartet** (k4/k5/k6) statt 1× → echtes wiederkehrendes Muster; stubOps-Belege + Text angepasst; Erwartung + `maxHinzugefuegt` unverändert ([gedaechtnis-fixtures.ts](src/core/services/skill-eval/gedaechtnis-fixtures.ts)).
- Dry-Run bleibt 100 %, voller Gate grün (3713 Tests). Flag-Flip (`assistentGedaechtnis` in dev) folgt nach dem Nutzer-Re-Run (gpt-oss, n=3).

### v2.256.3 — Gedächtnis-Eval: Judge-einschließen-Schalter (Default aus, schnellerer Lauf) (Juli 2026)

PATCH — Der Baseline-Lauf dauerte über die Bridge sehr lang: jeder Fixture-Lauf machte reset + Generierung + reset + Judge, der Judge verdoppelte die Bridge-Runden. Für die Schwellen-Frage sind die deterministischen Assertions das harte Gate — der Judge ist optionale Zusatz-Sicht.

- **„Judge einschließen"-Schalter** im Panel (Default **aus**): ohne Judge ist ein Lauf nur reset + Generierung je Fixture → grob halbe Bridge-Last; Judge bei Bedarf zuschaltbar ([GedaechtnisEvalPanel.tsx](src/plugins/einstellungen/GedaechtnisEvalPanel.tsx)).

### v2.256.2 — Gedächtnis-Eval: Harness-Recalibrierung + Kontext-Wechsel-Prompt (dev) (Juli 2026)

PATCH — Konsequenzen der ersten Qwen-Baseline (v2.256.0/.1): ein Teil der roten Assertions waren Mess-Artefakte, nicht Modellfehler. Poisoning „scheiterte", obwohl Qwen die Injektion korrekt ignorierte; Judge-Parse-Fehler drückten den Schnitt. Der einzige echte Rotpunkt (Kontext-Wechsel) bekommt einen Prompt-Tweak. Flag-Flip in dev folgt erst nach zufriedenstellender Re-Baseline.

- **`guardMussGreifen` outcome-basiert**: gilt als bestanden, wenn der Guard verwarf ODER kein instruktiver Eintrag aktiv wurde — ein resistentes Live-Modell (0 verworfen, sauberer Bestand) ist nicht mehr fälschlich rot; nur durchgerutschte Injektion fällt durch ([gedaechtnis-assertions.ts](src/core/services/skill-eval/gedaechtnis-assertions.ts)).
- **Judge-Parse-Fehler** (nicht-JSON-Antwort → 0/0) fließen nicht mehr ins Judge-Mittel, sondern werden separat gezählt/angezeigt ([gedaechtnis-eval-runner.ts](src/core/services/skill-eval/gedaechtnis-eval-runner.ts), [GedaechtnisEvalPanel.tsx](src/plugins/einstellungen/GedaechtnisEvalPanel.tsx)).
- **Prompt-Tweak Kontext-Wechsel**: bei Wechsel des Arbeitsfokus (andere Entität als der Bestands-Eintrag) UPDATE/INVALIDATE auf den alten Eintrag — kein Nebeneinander von altem und neuem Fokus ([prompt.ts](src/core/services/assistent/gedaechtnis/prompt.ts)).
- Tests: Guard-Recalibrierung (resistent/dry-run/durchgerutscht) + Judge-Parse-Fehler-Exklusion; CLI-Dry-Run bleibt 100 % ([gedaechtnis-assertions.test.ts](src/core/services/skill-eval/__tests__/gedaechtnis-assertions.test.ts), [gedaechtnis-eval-runner.test.ts](src/core/services/skill-eval/__tests__/gedaechtnis-eval-runner.test.ts)).

### v2.256.1 — Gedächtnis-Eval: responsives Abbrechen + Fixture-Auswahl (dev) (Juli 2026)

PATCH — Beim ersten Baseline-Lauf klebte der Eval an `degradation-1` (20 Zyklen × n=3 = bis zu 60 Bridge-Runden); „Abbrechen" wirkte erst nach dem laufenden Durchgang, weil das AbortSignal nicht in die Innenschleife durchgereicht war.

- **Responsives Abbrechen**: AbortSignal fließt in `laufeFixture` → `submitMessage` + Prüfung zwischen den Zyklen; ein abgebrochener (Teil-)Lauf/Fixture wird verworfen, nicht gewertet ([gedaechtnis-eval-lib.ts](src/core/services/skill-eval/gedaechtnis-eval-lib.ts), [gedaechtnis-eval-runner.ts](src/core/services/skill-eval/gedaechtnis-eval-runner.ts), [gedaechtnis-judge.ts](src/core/services/skill-eval/gedaechtnis-judge.ts)).
- **Fixture-Auswahl** im Panel (Checkboxen je Szenario, `degradation` Default AUS) — schnelle Baseline aus den 4 Ein-Zyklus-Fixtures, Degradation optional ([GedaechtnisEvalPanel.tsx](src/plugins/einstellungen/GedaechtnisEvalPanel.tsx)).
- Tests: Vorab-Abort bricht `laufeFixture` vor dem ersten Submit ab und `laufeGedaechtnisEval` ohne Aggregat ([gedaechtnis-eval-runner.test.ts](src/core/services/skill-eval/__tests__/gedaechtnis-eval-runner.test.ts)); CLI-Dry-Run byte-identisch.

### v2.256.0 — In-App-Gedächtnis-Eval-Panel (dev) (Juli 2026)

MINOR — Die Gedächtnis-Qualität (Assistent Phase 2) muss vor dem dev-Scharfschalten gemessen werden — aber der Rechner mit Zugang zur internen KI hat kein Node, das CLI `eval:gedaechtnis` läuft dort nicht. Daher ein In-App-Eval-Panel, das die fiktiven Fixtures über die laufende Bridge (Qwen) fährt. Nur Messung — keine Aktivierung. Detail: [assistent-gedaechtnis.md](docs/architecture/assistent-gedaechtnis.md).

- **Gedächtnis-Eval-Panel** (Einstellungen → KI, gegated `isDevFixturesEnabled()`): 5 fiktive Fixtures über die interne Bridge (Default `agentisch`/Qwen), Generator + Judge intern, resetChat pro Submit, Report + JSONL-Download ([GedaechtnisEvalPanel.tsx](src/plugins/einstellungen/GedaechtnisEvalPanel.tsx)).
- **Geteilte, node-freie Eval-Orchestrierung** — CLI und Panel teilen Läufe-/Judge-Logik + JSONL-Feldform ([gedaechtnis-eval-runner.ts](src/core/services/skill-eval/gedaechtnis-eval-runner.ts), [gedaechtnis-judge.ts](src/core/services/skill-eval/gedaechtnis-judge.ts)); die CLI ist nur noch der Node-Rahmen ([gedaechtnis-eval.ts](src/core/services/skill-eval/gedaechtnis-eval.ts)).
- **`laufeFixture`** nahm einen additiven `{ ziel, resetVorZyklus }`-Parameter auf (Bridge-Reset + Qwen-Tab); CLI-Aufrufe byte-identisch ([gedaechtnis-eval-lib.ts](src/core/services/skill-eval/gedaechtnis-eval-lib.ts)).
- Transport intern-only via `getTransportForAssistent()` (Guard #30); `openrouter` nur gespiegelt in dev (fiktiv-Provenienz-Guard); Panel schreibt **nicht** in den Gedächtnis-Store und braucht das Flag nicht.

### v2.255.2 — Assistent-Spine: schwarzes Custom-Tooltip entfernt, natives Label behalten (Juli 2026)

PATCH — Korrektur zu v2.255.1: dort war die Diagnose verdreht — entfernt wurde das native `title`-Tooltip (das dezente, das bleiben sollte), während das hart schwarze Custom-Bubble (`--tf-text`-Grund) übrig blieb. Jetzt umgekehrt richtig.

- **Schwarzes Custom-Tooltip-Bubble entfernt, natives `title` wiederhergestellt** ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)): beim Überfahren der Spine erscheint nur noch **ein** Label — nativ wie bei allen anderen Icon-Buttons der App (kein zweites, hart schwarzes Bubble).

### v2.255.1 — Assistent-Spine: doppelten Tooltip entfernt (Juli 2026)

PATCH — *(Diagnose verdreht — korrigiert durch v2.255.2)* Nach der v2.255.0-Abnahme zeigte die neue Assistent-Spine beim Überfahren **zwei** Tooltips. Dieser Patch entfernte fälschlich das native `title` statt des schwarzen Custom-Bubbles.

- **Natives `title`-Tooltip der Spine entfernt** ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)): war die falsche Hälfte — in v2.255.2 rückgängig gemacht, stattdessen das schwarze Custom-Bubble entfernt.

### v2.255.0 — Home-Redesign (optimiert): Hero-Band + Karten-Restyle + Assistent-Spine (Juli 2026)

MINOR — Umsetzung des Design-Handoffs „Home optimiert". Da die Startseite bereits ein reifes, konfigurierbares Widget-System ist, ist das ein visueller Restyle + wenige neue Präsentations-Elemente, kein Rebuild — die Konfigurierbarkeit bleibt. Additiv; Handoff-Abweichungen an den DESIGN_GUIDE angeglichen (kein Verlauf, keine Deko-Schatten, Gewicht 500). Detail: [home-widgets.md](docs/architecture/home-widgets.md).

- **Hero-Band** (fixes Element, kein Widget): Resume-Karte „Weiter, wo du aufgehört hast" + Alert-Karte mit drei klickbaren Chips (kritisch / nähern sich / QS-Freigaben offen) ([HomeHero.tsx](src/plugins/home/HomeHero.tsx)).
- **Config v2:** `weitermachen` aus dem Default (Hero ersetzt es, bleibt Opt-in im Katalog); v1→v2-Migration blendet eine sichtbare Instanz einmalig aus ([homeWidgetsStore.ts](src/plugins/home/widgets/homeWidgetsStore.ts)); geteilter [useQsFreigaben.ts](src/plugins/home/widgets/useQsFreigaben.ts)-Hook (Hero-QS-Zahl = Widget-Zahl).
- **Widget-Karten-Restyle** ([WidgetShell.tsx](src/plugins/home/widgets/WidgetShell.tsx)): Titel 14px/500, Karten-Fläche `--tf-card-surface`, eingeklappt nur noch Titel + Zähler.
- **Kanban** ([AntragKanbanWidget.tsx](src/plugins/home/widgets/AntragKanbanWidget.tsx) / [KanbanBoard.tsx](src/components/kanban/KanbanBoard.tsx)): neutraler grauer Karten-Streifen statt Lane-Farbe, kein Deko-Schatten, Köpfe/Karten 500 statt 600.
- **Assistent-Dock** ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)): schwebender Reiter → dauerhafte 48px-Spine mit Primär-Badge + Hover-Tooltip; das Blatt reserviert die 48px ([ShellLayout.tsx](src/core/ShellLayout.tsx), dev-Flag `assistentPanel`).

### v2.254.1 — Umfang single-source auch für Abschnitt C + D (Folgepaket) (Juli 2026)

PATCH — Zieht die Umfang-Single-Source aus v2.254.0 auf die Abschnitte C (Technische Risiken) und D (Markt) nach: auch dort stand die feste „300–350 Wörter"-Angabe zusätzlich in der Prompt-Prosa und lief bei Regel-Edits auseinander. Eigener, append-only Migrations-Marker (die A/B-Migration war bereits ausgeliefert).

- **Feste „300–350 Wörter" aus C/D-Prosa entfernt** ([seed.ts](src/core/services/skills/registry/seed.ts)): Umfang kommt allein aus den Regeln (`seed-c-umfang` hinweis / `seed-d-wortanzahl`); Struktur (C: 3-Abschnitt Entwurf→Fließtext) unverändert. Alt-Wortlaut eingefroren als `C_ABSCHNITT_OPTS_NEU_UMFANG_ALT` / `D_ABSCHNITT_OPTS_UMFANG_ALT`.
- **Migration `ga-umfang-dedup-cd-2026-07`** ([migrations.ts](src/core/services/skills/registry/migrations.ts)): eigener Marker, hebt nur unveränderte C/D-Prompts byte-genau nach; greift auch nach `applyRisikenEntwurf` (C landet direkt de-dupliziert).
- Der Editor-Warnhinweis aus v2.254.0 deckt C/D bereits generisch mit ab.

### v2.254.0 — Umfang single-source: Regel statt doppelter Prompt-Prosa (A/B) (Juli 2026)

MINOR — Regel-Edits im Workflow-Werkstatt/Skill-Editor (z. B. Wortanzahl 750 → 450–550) wirkten nur halb: die neue Zahl erschien im Auto-Block „Formale Vorgaben", aber der Prompt-Text trug die alte Zahl weiter. Grund war eine Doppelquelle — die Wort-/Absatz-/Satzzahl stand zusätzlich fest in der Prompt-Prosa (Seed). Jetzt ist die Regel die EINZIGE numerische Quelle. Additiv (einmalige, kuratier-sichere Migration), keine Datenmigration im Layout-Sinn.

- **Feste Umfangs-Zahlen aus der Prompt-Prosa entfernt (A + B)** ([seed.ts](src/core/services/skills/registry/seed.ts)): „Gesamtumfang mindestens 750 Wörter"/„vier Absätze" (B) und „ca. 10 Sätze" (A/Kurzfassung) fallen weg; Umfang kommt allein aus den Regeln. Weiche Teil-Richtwerte (≥150/≥150/≥450) bleiben.
- **Byte-genaue Reconcile-Migration `ga-umfang-dedup-2026-07`** ([migrations.ts](src/core/services/skills/registry/migrations.ts)): hebt nur UNVERÄNDERTE A/B-Prompts auf dem Share auf die de-duplizierte Fassung; kuratierte Edits bleiben unangetastet.
- **Skill-Editor warnt bei Prosa↔Regel-Konflikt** ([SkillEditor.tsx](src/plugins/skill-verwaltung-kuration/SkillEditor.tsx) + `findeUmfangKonflikte` in [check-engine.ts](src/core/services/skills/registry/check-engine.ts)): nennt der Prompt-Text eine Zahl abweichend zur Regel, erscheint ein Hinweis (Sicherheitsnetz für kuratierte Templates).

### v2.253.0 — Bundle-Diaet: ONNX-WASM gzip-inline + Dependency-Hygiene (Juli 2026)

MINOR — Die Single-File-HTML war ~73 MB (dev) und wird bei jedem Start komplett vom SMB-Share geladen; dominiert von der ~21-MB-ONNX-WASM, die zweimal byte-identisch als base64-`data:`-URL im Bundle lag. Zusätzlich tote Pakete + offene npm-audit-Findings bereinigt.

- **ONNX-WASM als Inline-gzip + `wasmBinary`** ([ort-wasm-init.ts](src/core/services/search/ort-wasm-init.ts) + [generate-ort-wasm-module.mjs](scripts/generate-ort-wasm-module.mjs)): Post-Build-Strip leert die inlined `data:`-URLs ([strip-inline-wasm.mjs](scripts/strip-inline-wasm.mjs)) → Bundle dev 73→19,5 MB, prod 71→17,4 MB (−73/−75 %). Detail: [runtime-layers.md](docs/architecture/runtime-layers.md), Pitfall #39.
- **4 tote Pakete entfernt** ([package.json](package.json)): `@zip.js/zip.js`, `file-saver`, `@types/file-saver`, `docx` (nirgends importiert); `shadcn` bleibt (build-relevant via `theme.css`).
- **`xlsx` 0.18.5 → 0.20.3** (SheetJS-Registry-Tarball) — behebt High-Findings (Prototype-Pollution + ReDoS).
- **`npm audit` 15 → 0 Findings** via `audit fix` (react-router/qs/vite); akzeptierte/beobachtete Findings dokumentiert ([docs/audit-akzeptiert.md](docs/audit-akzeptiert.md)).

