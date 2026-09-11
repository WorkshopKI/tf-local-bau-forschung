# Home-Widget-System

Die Homepage rendert seit v2.227 **Widget-Instanzen** aus einer persönlichen Config statt hart verdrahteter Sektionen ([src/plugins/home/widgets/](../../src/plugins/home/widgets/)). Kernregeln:

- **Hero-Band (Redesign „Home optimiert"):** Über den Widget-Spalten steht ein **fixes, nicht-konfigurierbares** Band [HomeHero.tsx](../../src/plugins/home/HomeHero.tsx) — analog Begrüßung/`ProgrammeOverviewCards` bewusst KEIN Widget. Zwei flache Karten: **Resume** („Weiter, wo du aufgehört hast", jüngster Arbeitskontext via `useWeitermachenRows`) + **Alert** (drei klickbare Chips: kritisch/nähern-sich aus den Ampel-Aggregaten, QS-offen aus dem geteilten [useQsFreigaben.ts](../../src/plugins/home/widgets/useQsFreigaben.ts)-Hook → gleiche Zahl wie das QS-Widget, kein Drift). Navigation kommt als Callbacks aus [HomePage.tsx](../../src/plugins/home/HomePage.tsx).
- **Config-Version v2:** `weitermachen` ist NICHT mehr im Default ([defaultHomeWidgetConfig](../../src/plugins/home/widgets/homeWidgetsStore.ts)) — das Hero-Band ersetzt es; das Widget bleibt im Katalog `verfuegbar` (per `reconcileVerfuegbareWidgets` als Opt-in `sichtbar: false` nachgezogen). v1-Configs werden beim Lesen migriert (`migriereV1HeroWeitermachen`: eine sichtbare `weitermachen`-Instanz einmalig ausgeblendet, idempotent — jede Nutzer-Mutation persistiert v2).

- **Widget-Katalog ist Code** ([widgetCatalog.ts](../../src/plugins/home/widgets/widgetCatalog.ts) — bewusst NICHT „Registry", Kollisionsgefahr mit dem registry.json-Begriff): je `WidgetTyp` Label/Icon/Bereich/`verfuegbar`/`sichtbarWenn`/Default-Config. Seit v1.1 sind **alle** Katalog-Typen `verfuegbar: true`; ein neu verfügbar gewordener Typ wird in Bestands-Configs über die reine, idempotente `reconcileVerfuegbareWidgets` ([homeWidgetsStore.ts](../../src/plugins/home/widgets/homeWidgetsStore.ts)) als Opt-in-Instanz (`sichtbar: false`) nachgezogen — sonst tauchte er für Bestands-Nutzer nie in den Einstellungen auf (die Liste rendert Instanzen, nicht den Katalog).
- **Persistenz-Invariante (HART):** Config = persönliche Darstellung — IDB primär (kv `home-widgets-config`), Mirror NUR über den PersonalEinstellungen-Sync (`savePersonalSettings`, LWW via `updatedAt`); NIE registry.json, NIE Daten-Share, NIE SMB-Snapshot. Notizen (kv `home-notizen`) noch strenger: strikt IDB-only, auch KEIN Personal-Mirror. Guard `home-widgets-local-only` ([conventions-daten.test.ts](../../src/__tests__/conventions-daten.test.ts)). **Die Oberfläche muss das richtig sagen:** die Fußzeile der Widget-Einstellungen trug bis v4.130 „nur lokal auf diesem Gerät" — falsch, weil der Personal-Mirror die Config auf einen zweiten Rechner bringt. Sie sagt jetzt „nur für Sie — nicht geteilt" und nennt beide Ablagen im Tooltip. Die gleichlautende Fußzeile des **Feedback-Boards** ([FeedbackKanbanEinstellungen.tsx](../../src/components/feedback/FeedbackKanbanEinstellungen.tsx)) bleibt korrekt: `saveBoardKanbanConfig` schreibt nur localStorage.
- **Kanban-Lanes binden an `StatusCategory`** (`getStatusCategory`, Pitfall #12 — nie Roh-Status). Gerendert wird über das Board-Primitiv [TfBoard](../../src/components/kanban/TfBoard.tsx) mit `layout='geteilt'` (Bahnen teilen die Breite) — dasselbe Bauteil, das seit v3.45 auch das Feedback-BOARD trägt (`layout='gedeckelt'`); Details + die Grenze Layout/Fachlichkeit: [board-komponente.md](board-komponente.md). Der eingeklappte Zähler ist [LanePills](../../src/components/kanban/LanePills.tsx), von beiden Quellen geteilt. Lane-Farben nur über `--tf-kanban-*`-Tokens (bunt je Kategorie / monochrom an `--tf-primary-h` gekoppelt). Seit v1.1 ist `KanbanWidgetConfig` **diskriminiert auf `quelle`** (Anträge → `StatusCategory`-Lanes | Feedback → `FeedbackStatus`-Lanes, [feedbackKanbanLanes.ts](../../src/plugins/home/widgets/feedbackKanbanLanes.ts)); ein Dispatcher ([KanbanWidget.tsx](../../src/plugins/home/widgets/KanbanWidget.tsx)) verzweigt, Quellenwechsel setzt die Lanes still auf den Quell-Default zurück. Der Feedback-Lane-Katalog (`FEEDBACK_LANE_STATUS`, `FeedbackLane`, `feedbackLaneAccent`) und die Mono-Rampe (`monoLaneAccent`) leben geteilt unter [src/components/feedback/feedbackLanes.ts](../../src/components/feedback/feedbackLanes.ts) bzw. [src/components/kanban/laneAccent.ts](../../src/components/kanban/laneAccent.ts) — das Feedback-BOARD nutzt dieselben Lanes, und `src/components/` darf nicht in `src/plugins/` importieren.
- **Lane-Auswahl-UI ist geteilt:** [LaneListe](../../src/components/ui/LaneListe.tsx) (Zeile je Lane: Häkchen links, Spaltenschalter 1/2/3 rechts — die Segmente kommen aus `TfBahnSpalten`, die Kopfbreite ist aus ihrer Zahl gerechnet) trägt die Widget-Einstellungen im Startseiten-Menü, Einstellungen › Widgets, das Zahnrad des Kanban-Fensters (dort mit Pfeilspalte, Panel 340 px) **und** das „Board anpassen"-Popover des Feedback-Boards. Die Rechnung hinter dem Pfeilpaar teilen sich beide Reihenfolge-Wirte: `verschiebeUmEinen` ([laneFolge.ts](../../src/components/ui/laneFolge.ts)). Weil der dritte Schalter der Bezeichnungs-Spalte 24 px nimmt, ist die **Einstellungs-Ansicht** des Startseiten-Panels 290 px breit statt der 250 px des Menüs (`BREITE_EINSTELLUNGEN`, [StartseiteMenue.tsx](../../src/plugins/home/anpassen/StartseiteMenue.tsx)); gekürzte Namen tragen ihren `title`. Löst die frühere Chip-Wolke ab, in der die Spaltenzahl als verstecktes zweites Klickziel („· 2 Sp.") im Chip steckte; `SettingsChipToggle` hat seinen `suffix`/`onSuffixClick` deshalb verloren.
- **v1.1-Widgets (alle read-only + Navigation, Opt-in, Datenquelle → Invariante):** **Feedback-Kanban** (Feedback-Status-Lanes; Klick → Board mit selektiertem Ticket über den transienten [feedbackNavStore.ts](../../src/components/feedback/feedbackNavStore.ts)). **Feedback-Neuigkeiten** ([feedbackNews.ts](../../src/plugins/home/widgets/feedbackNews.ts): Antwort/Neu-vom-Team/Stimmen seit einem gerätelokalen Anker; `signatureOf` aus `useUnreadReplies` wiederverwendet — Guard `djb2-single-source`; kein Store/Schema/Share). **Auslastung** ([auslastungWidgetModel.ts](../../src/plugins/home/widgets/auslastungWidgetModel.ts): Ich = `computeKapazitaet`, Team = `computeQuartalsStatistik`-Aggregat ohne MA-Rangliste; Einzel-MA selbst gerechnet, NICHT den `AuslastungIndexProvider` auf die Home ziehen; `isAuslastungEnabled`). **Meine Entwürfe in dieser App** (bis v4.134 „QS-Freigaben offen", Typ-Id `qs-freigaben` bleibt) ([qsFreigaben.ts](../../src/plugins/home/widgets/qsFreigaben.ts): `idb.entries('workflow-run:')` + Legacy `gutachten-workflow:`, Entwurf-Schritte, offene Regeln = `CheckResult.level !== 'ok'`; gibt NIE frei, navigiert nur; **ohne** Bearbeiter-Filter, s. u.). **Zuletzt geändert** ([registryAenderungen.ts](../../src/plugins/home/widgets/registryAenderungen.ts): `readCachedSkillRegistry`, Änderungsart via `diffSkillVersions`; kein neues Journal; `isKuratorMenusEnabled`, Warn-Fußzeile „Aktivierungen wirken sofort für alle Varianten"). Hieß bis v4.133 „Registry-Änderungen" — die **Typ-Id `registry-aenderungen` blieb** (persistiert in Nutzer-Configs), in der Widget-Liste steht die längere Fassung „Zuletzt geändert: Skills & Regeln", weil das Label dort ohne die Zeilen der Karte nicht auflösbar ist. Ein Klick öffnet den ANGEKLICKTEN Eintrag über `navigate(…, { selectedId })` — Skill wie Regel (siehe [herkunft.ts](../../src/core/nav/herkunft.ts) für den Rückweg von dort). **Neue Anträge für dich** ([NeueAntraegeFuerDich.tsx](../../src/plugins/home/NeueAntraegeFuerDich.tsx): MA-Selbsteintragung — ehem. hart verdrahtete Home-Sektion, seit v2.238 echtes Katalog-Widget `bereich: 'haupt'`, `sichtbarWenn: isAuslastungSelbstEintragungEnabled`; versteckt sich selbst ohne passende Anträge; „Kann ich übernehmen"-Wunsch geht über den bestehenden `useMyUebernahmeWuensche` in den **persönlichen** Ordner, NIE `auslastung.json`, Pitfall #26). **Bearbeiter-Modus sichtbar UND umschaltbar (v4.47):** geteilter `bearbeiterScopeLabel` ([bearbeiterFilter.ts](../../src/plugins/antraege/bearbeiterFilter.ts)) in Kanban/Meine-Anträge/Antragseingang/Fristen/Nachtlauf/Auslastung — „Kürzel THU" vs. „Alle Bearbeiter" (der `alle`-Modus ist erstklassig, nie `null`). Der Modus kommt seither aus **einer** Quelle, [useBearbeiterSicht](../../src/core/hooks/useBearbeiterSicht.ts), und der Chip in der Kopfzeile schaltet ihn um; wer den Modus für ein Label selbst aus dem Profil parst oder aus Teilen zusammensetzt, nennt nach dem Umschalten das Kürzel über Team-Zahlen (so geschehen im Antragseingang-Widget) — und seit v4.48 auch die falsche **Schreibweise**: die Fassade hängt dem Modus `anzeigeTokens` an („Kürzel THü" statt „Kürzel THÜ", gelesen aus den Anträgen), ein selbstgebauter Modus trägt sie nicht. **Ausgenommen** bleiben Widgets, die eine Person meinen und keinen Ausschnitt: „Neue Anträge für dich" (Selbsteintragung), das Auslastungs-Widget mit seinem eigenen `team`/`ich`-Schalter und seit v4.134 „Meine Entwürfe in dieser App" (gerätelokale Runs gehören ihrem Verfasser, nicht dem Kürzel am Vorgang).
- **Kanban-Vollbild (v3.47):** Ein `Maximize2`-Knopf im `aktionRechts`-Slot der [WidgetShell](../../src/plugins/home/widgets/WidgetShell.tsx) — rechts **neben** dem `⋯` und wie dieses auch eingeklappt sichtbar (`aktion` links gilt nur ausgeklappt: was dorthin führt, ist eingeklappt gar nicht da) — öffnet das Anträge-Kanban in einem eigenen Browser-Fenster ([fenster-in-fenster.md](fenster-in-fenster.md)). **Keine** Kappung auf `maxKartenProLane` — die Frage „was passt in eine Widget-Karte" stellt sich dort nicht. Der Griff liegt in einem Modul-Register, nicht im Widget — ein Karten-Klick navigiert die App und hängt die Startseite aus; beim Aushängen bekommt das Fenster einen letzten Zustand mit `verwaist` statt stillzustehen. Kein Vollbild am **Feedback**-Kanban: dessen volle Ansicht ist seit v3.17 eine eigene Seite, und die Karten führen bereits dorthin.
- **Das Fenster hat seine EIGENEN Bahnen (v4.26):** Auswahl, Reihenfolge und Kartenspalten stehen in `AntragKanbanWidgetConfig.vollbildLanes` (`VollbildLane[]` = Kategorie + Spalten + `sichtbar`; ausgeblendet wird per Flag statt durch Entfernen, damit der Platz erhalten bleibt — Modell wie `BoardLane` des Feedback-Boards). Vier reine Funktionen in [kanbanLanes.ts](../../src/plugins/home/widgets/kanbanLanes.ts) tragen das: `kartenProKategorie` (Clustering, geteilt mit dem Widget), `seedVollbildLanes` (Startvorschlag: alle Kategorien, konfigurierte zuerst, Spalten aus `ZWEISPALTIG_AB` — seither ein **Vorschlag**, keine Regel), `projiziereVollbildLanes` (sichtbare Bahnen in Listenfolge, leere bleiben als Schiene) und `leseVollbildLanes` (toleranter Leser). Bis v4.25 leitete das Fenster seine Bahnen aus dem Bestand ab und las die Einstellung gar nicht — der Schalter im Zahnrad zeigte die Startseiten-Config und wirkte dort nicht. Das Widget reicht deshalb **Daten** hinüber (alle Kategorien), nicht fertige Bahnen: sonst hätte eine wieder eingeblendete Bahn keine Karten, sobald die Startseite ausgehängt ist. Geteilt bleiben Farbmodus und Datenbasis. Eingeklappte Bahnen überleben getrennt davon in `vollbildEingeklappt` (eingeklappt = Schiene, abgewählt = weg); beides wird über `mutiereConfig` auf den AKTUELLEN Stand geschrieben — ein verwaistes Fenster nähme sonst fremde Änderungen zurück. Im Widget bleibt das Einklappen flüchtig, dessen Body hängt ohnehin bei jedem Seitenwechsel aus dem DOM.
- **Die Startseite rechnet keine Zahl selbst nach, die die Zielseite schon hat** (v4.131, aus der Bug-Jagd). Zwei Ableitungen derselben Größe laufen genau dann auseinander, wenn es darauf ankommt:
  - **Frist**: [dashboardAggregate.ts](../../src/plugins/home/dashboardAggregate.ts) ruft `criticalFristErgebnis` ([groupAggregates.ts](../../src/plugins/antraege/groupAggregates.ts)) — dieselbe Engine wie die Frist-Zelle der Fördertabelle. Vorher rechnete es `computeVerbundFristDatum` + eine eigene `daysUntil`-Formel: die kannte weder den wirksamen Eingang (`D_XTE`) noch das Haltekriterium der ZAH-Phase (`fristLaeuft`). Am Bestand gemessen: **113 von 577** Anträgen haben keine laufende Uhr, wurden aber als monatelang überfällig gerechnet und besetzten die Spitze einer Karte, die „Sortierung: Frist" verspricht. `AntragVorgang` trägt jetzt `fristZustand` + `fristTage`; die Sortierung ist byte-gleich zu `compareFristAsc` ([sort.ts](../../src/plugins/antraege/sort.ts)), Zeilen ohne laufende Uhr sinken ans Ende. Das Verbund-Ergebnis wird je `verbund_id` gecacht — ohne den Cache rechnete ein Verbund mit N TVs es N² mal.
  - **Ausschnitt vs. Bestand**: ein Zähler, der nur einen Teil summiert, nennt den Rest. `buildAntragKanbanLanes`/`projiziereVollbildLanes`/`buildFeedbackKanbanLanes` liefern dafür `ausserhalb`; `zaehleRegistryAenderungen` und der ungekappte Zweitlauf von `berechneFeedbackNews` liefern den Bestand statt der Kappungs-Grenze. Ein eingeklapptes Widget, das wegen des Lazy-Guards gar nicht rechnet, zeigt „—", nicht „0".
  - **Grundmenge**: `applyInaktiveExclusion` gilt überall dort, wo die Zieltabelle es anwendet — auch in `useEingangAmpelCounts` und `filtereKanbanGrundmenge` (dort als expliziter `InaktivAusschluss`-Parameter, damit das Modul rein bleibt).
- **Ein Klick, der eine Zahl nennt, landet bei genau dieser Zahl.** „+ N weitere →" einer Kanban-Bahn setzt `kategorieQuickfilter` ([store.ts](../../src/plugins/antraege/store.ts)) — einen **transienten Store-Slot mit sichtbarem Chip**, nicht die Filter-Engine: `useFilterState.init()` läuft beim Mount der Zielseite und ersetzt `active` durch den persistierten Stand, ein vorher gesetzter Engine-Filter war im Moment der Navigation wieder weg (gemessen). Dieselbe Bauart und derselbe Grund wie beim Ampel-Quickfilter; `setActiveView` räumt beide ab.
- **Ein Collapse-Zustand, eine Quelle:** `eingeklappt` lebt in der Widget-Config (`useCollapsedSection` wird für Widgets NICHT verwendet); eingeklappt wird der Body NICHT gemountet (Lazy-Zusage, nur Kopfzeile + Zähler-Slot). Konfigurierbare Ampel-Schwellen wirken NUR über den Aggregations-Pfad (`useEingangAmpelCounts` + `ampelSchwellenAusConfig` — Kopfzeile und Widget teilen die Quelle); die 4-Stufen-Logik `getEingangAmpel` der Listenzeilen bleibt fix (30/60/90).
- Detail-Config-UI: die Ansicht „Widget-Einstellungen" im Startseiten-Menü (s. u.) + Einstellungs-Sektion `sec-widgets` ([WidgetsGruppe.tsx](../../src/plugins/einstellungen/darstellung/WidgetsGruppe.tsx)) teilen EINE [WidgetConfigForm](../../src/plugins/home/widgets/WidgetConfigForm.tsx). Neues Widget = Katalog-Eintrag + `WidgetTyp`-Literal + Config-Interface (`WidgetSpezifischeConfig`-Union) + `RENDERERS`-Zeile + ggf. `WidgetConfigForm`-Zweig; der Selektor bleibt rein/node-testbar (Feedback-SUB-Modul-Importe statt des `@/components/feedback`-Barrels — pdfjs-frei), schwere Aggregation nur ausgeklappt (`enabled: !eingeklappt`).

## Jede Karte nennt die Menge, die sie zählt (v4.134)

Vier Karten benannten etwas anderes, als sie führen. Der gemeinsame Befund: ein
Titel oder eine Bahn-Überschrift ist eine **Zusage über eine Menge** — hält sie
die nicht, liest sich die Karte daneben als Widerspruch.

- **Kanban** — die Meta-Zeile sagt „Verbünde als eine Karte", der Zähler
  „21 von 184 Vorgängen", und sein Titel zählt die Kategorien **außerhalb** der
  gezeigten Bahnen namentlich auf (`ausserhalbNach` aus
  [kanbanLanes.ts](../../src/plugins/home/widgets/kanbanLanes.ts), geteilt mit dem
  Vollbild-Fenster). Vorher stand auf einem Bildschirm dreimal „Vorgang" für drei
  Mengen: 34 offene (Teilvorhaben), 21 (Verbünde), 37 Teilvorhaben.
- **„Meine Entwürfe in dieser App"** (bis dahin „QS-Freigaben offen") — zählt die
  Artefakt-Entwürfe **dieses Geräts**, nicht die fachliche QS des Fachsystems (die
  hängt an den Kürzeln und wird von der To-do-Kaskade gesagt). Der Bearbeiter-
  Filter ist **weg**: die Runs liegen gerätelokal, wer sie sieht, hat sie selbst
  erzeugt — gefiltert versteckte die Karte den eigenen Entwurf, während die
  Resume-Karte daneben ihn zum Weiterarbeiten anbot (gemessen: HACKKI/ZKN103113,
  Kürzel MxM/ViK). Der Hero-Chip trägt denselben Namen — ein Hook, eine Zahl.
- **Fristen** — die Liste zeigt **beide** Quellen. Nach Abstand sortiert kam in
  den sichtbaren acht Zeilen kein einziger Zieltag vor, während die Kopfzeile
  „16 Zieltag" zählte; `sichtbareMischung` reserviert jeder vorhandenen Quelle
  Plätze ([fristAnlaesse.ts](../../src/plugins/home/widgets/fristAnlaesse.ts)).
  Die Fußzeile nennt zusätzlich die Meilensteine **ohne Bedingung**
  ([meilensteine.md](meilensteine.md)).
- **„Änderungen der letzten Nacht"** — folgt dem Bearbeiter-Ausschnitt (7 statt
  402 Zeilen), gruppiert **je Antrag** statt je Feld
  ([nachtlaufGruppen.ts](../../src/plugins/home/widgets/nachtlaufGruppen.ts)) und
  nennt darunter, wie viele Änderungen andere betrafen. Weiterhin **keine
  Personen-Achse**: keine Zeile sagt, wer etwas gesetzt hat (Pitfall #48,
  [vorgangssystem.md §12](vorgangssystem.md)). Zwei Anzeigen dürfen dieselbe
  Bezeichnung nicht doppelt tragen — zwei Teilvorhaben eines Verbunds bekommen ihr
  Aktenzeichen dazu, **nur wo das Akronym mehrdeutig ist**.
  Seit v6.1 trägt die Karte **sechs Regler** und erklärt **jedes Kürzel einzeln**
  ([NachtlaufConfigForm.tsx](../../src/plugins/home/widgets/NachtlaufConfigForm.tsx)) —
  Details unten.
- **Config-Version v3**: `nachtlauf` rückt **einmalig** ans Ende seiner Spalte
  (`migriereV2NachtlaufAnsEnde`) — eine Nachschlage-Karte zwischen Arbeitslisten;
  ihre Position kam aus der Reihenfolge des Reconcile, also aus der Bauzeit. Kein
  Pin: wer sie danach hochholt, behält sie oben.
- **Config-Version v4** (v6.1): `nachtlauf` bekommt seine Detail-Config
  (`migriereV3NachtlaufConfig`). Nötig, weil `reconcileVerfuegbareWidgets` nur
  fehlende **Typen** ergänzt, nie fehlende **Felder** — eine gewachsene Config
  trägt die Instanz längst mit `{ art: 'keine' }`, und ohne diesen Schritt bliebe
  `hatWidgetDetailConfig` ausgerechnet bei denen false, die das Widget benutzen.

## Was die Startseite von selbst zeigt (v5, v6.19)

Der Reconcile zieht neue Typen als **Opt-in** nach (`sichtbar: false`) — richtig
für „irgendwann mal", falsch für die Karten, die die tägliche Arbeit tragen: wer
nie ins Widgets-Untermenü sieht, hat „Fristen" oder „Änderungen der letzten
Nacht" nie zu Gesicht bekommen. `ENTDECKUNG_WIDGETS`
([homeWidgetsStore.ts](../../src/plugins/home/widgets/homeWidgetsStore.ts)) ist
die **eine** Deklaration dessen, was ein Nutzer vorfindet: `meine-antraege`,
`fristen`, `nachtlauf` (Hauptspalte) + `antragseingang`, `feedback-news`,
`notizen` (Seitenspalte), dazu die Hero-Karte „Braucht heute Aufmerksamkeit".

- **Zwei Wege, ein Bild.** Der Default eines frischen Geräts führt genau diese
  Typen sichtbar (plus `ai-assistent`), `migriereV4Entdeckung` holt gewachsene
  Configs einmalig dorthin nach. Der Guard `entdeckung-default-deckungsgleich`
  hält beide zusammen — liefen sie auseinander, fände ein neuer Nutzer genau die
  Karten nicht, um die es geht.
- **Der Versions-Stempel IST das Gedächtnis.** Solange niemand etwas ändert,
  läuft der Schritt bei jedem Laden erneut (idempotent, folgenlos). Die erste
  echte Änderung persistiert v5 über `mutiere`, und ab da hält ein Ausblenden.
  Deshalb muss der Stempel in [useHomeWidgets.ts](../../src/plugins/home/widgets/useHomeWidgets.ts)
  mit der Schema-Version mitwandern.
- **Erst anlegen, dann einblenden.** Ein Stand von vor `fristen` trägt für den
  Typ gar keine Instanz; der Reconcile in `loadHomeWidgets` kommt **danach** und
  legte sie als `sichtbar: false` an. Der Schritt ruft ihn deshalb selbst.
- **Nur einblenden, nie ausblenden**, und `position`/`eingeklappt` bleiben
  unberührt: die Anordnung gehört dem Nutzer, `nachtlauf` erscheint eingeklappt
  wie sein Katalog-Eintrag es will. Was jemand vorher abgewählt hatte, kommt
  einmalig zurück — die Config führt keine Absicht, „nie gesehen" und „bewusst
  aus" sind in ihr nicht unterscheidbar.
- **Eine Marke hätte das stillgelegt** (der eigentliche Befund der Abnahme):
  `fristen` und `nachtlauf` trugen `BETA` im
  [Sichtbarkeits-Katalog](../../src/core/sichtbarkeit/katalog.ts). Das Häkchen
  stand damit an, `widgetAnzeigbar` verwarf die Karte trotzdem — und zwar bei
  genau dem Nutzer, der sie entdecken sollte (gemessen: 4 von 6 Karten kamen an).
  Beide sind seit v6.19 unmarkiert; ihr Klickziel `antraege` ist es ebenfalls.
  **Wer eine Karte in `ENTDECKUNG_WIDGETS` aufnimmt, prüft ihre Marke mit.**

### „Änderungen der letzten Nacht": Regler, Klartext, Kürzel-Tooltips (v6.1–v6.2)

- **Die Zeile ist eine Segment-Liste, kein Satz.** `NachtlaufZeile.segmente` hält
  je Art die Kürzel **mit ihren Einträgen**; an einem fertigen String liesse sich
  kein einzelnes Kürzel aufhängen. `zeileText()` bildet den Satz weiterhin — als
  `aria-label`: was die Maus in mehreren Blasen erfährt, muss die Vorlesesoftware
  in einem Stück bekommen.
- **Vier Blasen, jede mit ihrer eigenen Geste** (gepunktete Unterstreichung, Regel
  aus [ErklaerterSatz.tsx](../../src/components/vorgang/ErklaerterSatz.tsx)):
  Kürzel → Klartext + Journal-Einträge; „+N" → das Weggelassene namentlich;
  Tilde → warum nur ein Zeitraum belegt ist; Label → das Aktenzeichen. Der alte
  Sammel-`title=` an der Zeile ist damit weg.
- **Klartext über vier Wege, einmal gebaut**
  ([journalSpalten.ts](../../src/plugins/antraege/status/journalSpalten.ts), v6.2):
  kanonische Status-Spalte → `feldId` → Kürzel-`code` → app-weiter Spalten-Alias.
  Gemessen am echten Bestand trafen 257 von 260 journalfähigen Spalten direkt —
  `D_AAE`, `D_ABB` und `D_AZ1_1` nicht, weil sie kanonisch angebunden sind und
  deshalb **bewusst** keinen eigenen Katalog-Eintrag haben
  (`KANONISCHE_CODE_FELDER`). Die Indizes entstehen einmal je Karte, nicht
  `feldLabel()` je Zeile (linear über ~509 Felder).
- **Die Bedeutung hängt an der Projektform** (v6.2): nachgeschlagen wird über
  `kuerzelAuskunft(code, form)` aus `vb_phase`, darüber legt `ueberlagereKuration`
  den Wortlaut der Fassung — dieselbe Reihenfolge wie in der Verlaufs-Spur
  (Guards `kuerzel-nie-flach` + `kuerzel-text-folgt-der-kuration`). Vorher stand
  an einem FuE-Vorgang die DL-Bedeutung von `D_AB`. Wo die Projektform fehlt und
  die Formen auseinandergehen, schreibt die Blase das dazu, statt eine der
  Bedeutungen als die richtige auszugeben.
- **Ein Statuswechsel ist die Überschrift seiner Blase** (v6.2): „Gutachten fertig
  → bewilligt" oben, `STATUS_VB · Verbund-Status` darunter, das Wann zuletzt. Nur
  bei **genau einem** Eintrag — trägt ein Kürzel im Zeitfenster mehrere, ist jeder
  eine eigene Änderung und keiner darf die anderen zur Fußnote machen.
- **Wortlaut geteilt**: `ART_TEXT`/`eintragText` kommen aus
  [journalTexte.ts](../../src/plugins/antraege/status/journalTexte.ts) — Zeile und
  Blase stehen nebeneinander, zwei Formulierungsorte wären hier besonders teuer.
- **Zeitraum-Regler**: `rueckblickTage: 0` = ein Lauf (`letzterNachtLauf`, inkl.
  seines Rückfalls auf den letzten Export MIT Änderungen), `> 0` = Zeitfenster
  (`nachtLaeufeSeit`) **ohne** diesen Rückfall — ein Fenster macht eine Zusage über
  einen Zeitraum, ein heimlicher Griff davor bräche sie. Titel und Kopfzeile folgen
  dem Zeitraum („Änderungen der letzten 7 Tage · Exporte vom 18.–21.08.2026");
  das Katalog-Label bleibt, es benennt den Typ.
- **Ausschnitt-Regler** übersteuert **nur** den Chip im Seitenkopf. Frage-Ausschnitt
  und festgezurrte MA-Identität gewinnen weiter, und die Kopfzeile beschriftet
  immer den **effektiven** Modus. Der Wert `'meine'` braucht das eigene Kürzel —
  gelesen über `useBearbeiterSicht().eigenerModus`, **nie** `useMeinKuerzel` im
  Widget: die Personen-Achsen-Reißleine verbietet es dort (Pitfall #48).
- **Zeilenhöhe 21,84 → 16,00 px** (gemessen am echten Bestand). Ursache war nicht
  die Schriftgröße, sondern `items-baseline`: über drei Schriftgrößen ist die
  Zeilenhöhe die **Vereinigung** aller Über- und Unterlängen. `items-center` +
  fester `leading-[16px]` macht daraus eine berechenbare Zeile. Dazu: die
  `Tooltip`-Hüllen sind eigene Flex-Items und erben die Schriftgröße — steht sie
  nur an den Kindern, bläht eine leere 21,6-px-Zeilenbox die Zeile auf.
- **Drei Spalten in einer Flucht** (v6.2): Bezeichnung, Anzahl (22 px,
  rechtsbündig), Kürzel. Eine mitwachsende `max-w`-Spalte richtet nichts aus —
  erst eine Raster-Spalte stellt Zahl und Kürzel aller Zeilen untereinander.
- **Die Bezeichnungs-Spalte ist so breit wie ihr längster Eintrag** (v6.2.1),
  nicht feste 34 %: `fit-content(34%)` auf dem `<ul>`, `grid-cols-subgrid` auf
  `<li>` und `<button>` — die Zeile ist ein Knopf über die volle Breite und kann
  deshalb nicht selbst Rasterzeile sein. Am echten Bestand ist der Median 77 px
  und der längste 170 px; feste 34 % ließen die Zahl bei jeder zweiten Zeile über
  100 px Leere allein stehen. **`overflow-clip` statt `truncate`**: ein
  Scroll-Container (`overflow: hidden`) steuert zur `fit-content`-Rechnung nichts
  bei — die Spalte fiel damit auf die Breite der Auslassungspunkte zusammen
  (gemessen 6 px). `clip` schneidet genauso ab und ist keiner.
- **Eine waagerechte Trennlinie zwischen Verbünden** gibt dem Auge Halt. Sie
  steht unter der **letzten** Zeile eines Verbunds — nicht hinter der letzten
  sichtbaren, dort trennte sie nichts mehr. Sie trägt **dieselbe Deklaration wie
  die dichte Listenzeile** in „Meine Anträge" — `--tf-border-thin` (0,5 px) in
  `TRENNLINIE_GEDAEMPFT` ([ListItem](../../src/components/ui/ListItem.tsx),
  `--tf-border` auf 45 % per `color-mix`, dark-aware). Sie ist eine **Kante**,
  kein 0,5 px hoher Kasten: einen Kasten dieser Höhe malt der Browser
  halbdeckend, eine Kante rundet er auf ein Gerätepixel — nachgebaut sahen die
  beiden Karten auf derselben Seite verschieden aus (gemessen: beide jetzt
  `1px` / `rgb(0 0 0 / 0.035)`). Absolut positioniert **neben dem Fluss**, nicht
  als Rahmen der Zeile: sonst wären 15 Gruppen 15 px höher (Zeile bleibt
  16,00 px). Gruppe ist `verbund_id`, ersatzweise das Aktenzeichen;
  sie greift auf **aufeinanderfolgende** Zeilen und ändert die Sortierung nicht.
- **15 px Luft zwischen Bezeichnung und Zahl** als Innenabstand der ersten
  Spalte, nicht als größerer `column-gap`: der gälte für alle drei Fugen und
  schöbe die Kürzel von ihrer Zahl weg. Er zählt zur `fit-content`-Breite — eine
  sehr lange Bezeichnung kürzt also 15 px früher, und der 34-%-Deckel hält den
  Textplatz auch im schmalen Kasten proportional.
- **Die Fußzeile deckt auf** (v6.2): „… und N weitere Vorgänge" zeigt zehn weitere,
  ab 20 gezeigten Zeilen heißt sie „Alle N Vorgänge anzeigen" und deckt den Rest
  auf einen Schlag auf. Daneben steht immer der Rückweg („Weniger anzeigen"), und
  ein Wechsel von Zeitraum, Ausschnitt oder Sortierung setzt das Aufgedeckte
  zurück — sonst stünden 40 Zeilen unter einem Regler, der 10 sagt. Der Zustand
  ist bewusst **nur Sitzung**: er beschreibt einen Blick, keine Einstellung.

## Nach einer Datenaktualisierung (v6.57.2)

Jeder Import und jeder geholte Datenbestand läuft durch
`refreshAntraegeStoreAfterSync`: Bestands-Generation +1, Anträge-Store neu. Was
die Startseite zeigt, folgt einem der beiden Signale — ohne Reload.

- **To-do-Zellen** (Meine Anträge, Status & Verlauf, Kanban, Tagesbrief, Liste)
  lesen die Ablage des Bestandslaufs. Nach dem Import bleibt der alte Stand
  stehen, **markiert** (↻ + Tooltip, im Tagesbrief in Worten), bis der neue Lauf
  durch ist — gerechnet wird erst nach dem Veröffentlichen, auf dem echten Share
  30–40 s später. Zeilen ohne alten Eintrag zeigen „…". Gezeigt wird, was zum
  Schlüssel passt; die 5-Min-TTL entscheidet nur über den nächsten Anstoß
  ([useBestandsAufgaben.ts](../../src/core/hooks/useBestandsAufgaben.ts)).
- **Journal-Leser** („Änderungen der letzten Nacht", Nachtlauf-Satz des
  Tagesbriefs) und die **Auslastungs-Karte** nehmen `useBestandGeneration()` in
  ihre Effekt-Abhängigkeiten; für die Journal-Leser hält es der Guard
  `journal-leser-folgt-dem-bestand` fest.
- **Die Status-Fassung** (To-do-Regeln, ZAH-Phasen, Klartexte, Ordner-Spalten)
  holt jede Datenaktualisierung mit, wenn das Team eine neuere veröffentlicht
  hat (`zieheFassungNach`, v6.57.3). Danach zeichnen die Karten wie nach einem
  Import neu; die To-do-Zellen zeigen „…" statt eines vorläufigen Stands — eine
  andere Fassung ist eine andere Frage.
- **Neue Karte, die eigene Daten lädt?** Liest sie im Mount-Effekt aus IDB oder
  Share, gehört `useBestandGeneration()` in die Abhängigkeiten — sonst zeigt sie
  bis zum Reload den Stand von davor
  ([recurring-bug-classes.md §1](recurring-bug-classes.md)).

## Tagesbrief — was zuerst dran ist (v6.45)

Die Karte am Kopf der Hauptspalte ([src/plugins/home/tagesbrief/](../../src/plugins/home/tagesbrief/)),
Flag `tagesbrief` (dev + pl). Sie beantwortet die eine Frage, die keine der Karten
darunter beantwortet: **was zuerst?** Die Karten bleiben das Nachschlagewerk,
der Brief rankt über ihre Grenzen hinweg.

- **Kein LLM beim Laden.** Der Satzbau ist deterministisch
  ([punkte.ts](../../src/plugins/home/tagesbrief/punkte.ts) + [baueBrief.ts](../../src/plugins/home/tagesbrief/baueBrief.ts),
  `now` injiziert, node-testbar). Das Modell kommt erst bei der Rückfrage ins
  Spiel — je Punkt ein „dazu nachfragen", das das **bestehende** Assistent-Dock
  öffnet und die Frage gleich abschickt (transienter `vorgabe`-Slot im
  `panelUiStore`, Muster `kategorieQuickfilter`). Der Klick ist die Geste, wie bei
  den Quick Actions im Dock; läuft dort gerade eine Antwort, steht die Frage im
  Eingabefeld statt verloren zu gehen. Ohne `assistentPanel`-Flag verschwindet
  der Knopf — ausblenden, nicht ausgrauen.
- **Die Frage nennt ihren Vorgang** (v6.47.1). Neben dem Text reist `p.gruppe` als
  `vorgabeScope` mit und übersteuert im Panel die Store-Selektion
  ([assistent-panel.md → Welche Entität gilt](assistent-panel.md)).
  Ohne ihn stand im Faktenblock „Keine Entität ausgewählt", und das Modell
  antwortete regelkonform, es wisse nichts über den Vorgang, nach dem eben gefragt
  wurde. Der Knopf **navigiert weiterhin nicht** — er ist die zweite Geste neben dem
  Sprung-Link, und die Karte bleibt stehen. Wer nach EINEM Vorgang fragt, benennt
  ihn (`stillstand`/`zu-tun`/`weitermachen`); Listenfragen wie „Welche
  Entwürfe habe ich offen?" bleiben bewusst ohne — ein einzelner Vorgang wäre dort
  eine Verengung, die die Frage nicht meint.
- **Der Brief leitet nichts Neues ab.** Jedes Thema konsumiert eine bestehende
  reine bzw. gecachte Quelle. Die Zieltage teilt er sich mit dem
  Fristen-Widget: dessen Ladeeffekt ist nach
  [useFristAnlaesse.ts](../../src/plugins/home/widgets/useFristAnlaesse.ts)
  **gehoben, nicht kopiert** — zwei Flächen, die dieselbe Zahl unabhängig
  herleiten, laufen genau dann auseinander, wenn es darauf ankommt (v4.131).
  Der Brief ruft ihn mit `mitMeilensteinen: false` und nur, solange das Thema
  Stillstand aktiv ist; die Meilenstein-Plan-Projektion über alle Programme
  fällt für ihn weg.
- **Rangfolge nur, wo eine Uhr tickt.** Von den Themen tragen zwei eine
  Fälligkeit (Stillstand = Zieltage, Was zu tun ist = kritische Frist);
  die übrigen sind Neuigkeiten ohne Termin und stehen in EINEM Nachsatz. Eine
  gemeinsame Skala müsste Gewichte erfinden, die gegen nichts prüfbar wären.
  Deckel 5, Schwelle `DRINGLICH_AB_TAGEN`; **am echten Bestand gemessen**
  (09.09.2026, Kürzel ATh): 12 verschiedene Vorgänge unter der Schwelle, die
  dringlichsten 167/165/152/142/138 Tage über — die Schwelle bindet dort also
  nicht, der Deckel schon.
- **Ein Vorgang spricht einmal.** `BriefPunkt.gruppe` (Verbund-Id) entdoppelt den
  gerankten Absatz; behalten wird der dringlichste Punkt. Stillstand und Was zu
  tun ist treffen oft denselben Verbund — ein Brief, der einen Vorgang
  wiederholt, fasst nichts zusammen.
- **Die Zeile ist eine Segment-Liste, kein Satz** (Muster der Nachtlauf-Zeile,
  v6.1): Zahlen und Namen IM Satz sind die Sprungziele, `aria-label` trägt
  dieselbe Aussage am Stück. `satz` entsteht immer aus `segmente` (`satzAus`),
  nie daneben geschrieben.
- **Dieselbe Grundmenge wie die Karte darunter** — beides in der Abnahme
  gefunden und behoben: `zu-tun` zieht aus `ctx.data.meineAntraege` (dort steht
  `fristTage` aus `criticalFristErgebnis`) statt aus dem rohen Bestandslauf; über
  den standen sonst drei Vorgänge mit „seit 4028 Tagen überfällig" an der Spitze,
  während die Karte 13 Einträge mit höchstens 223 Tagen zeigte. Das
  Journal-Thema folgt dem Bearbeiter-Ausschnitt der Kopfzeile wie „Änderungen der
  letzten Nacht" — ohne ihn zählte der Brief 262 Vorgänge unter einem Chip, der
  „Kürzel ATh" sagt, die Karte daneben 7.
- **Die Handlung kommt aus der Kaskade, auch wenn ein Stillstand rankt** (v6.57.4).
  Ein Stillstands-Punkt verdrängt beim Entdoppeln den To-do-Punkt desselben
  Verbunds; deshalb spricht er dessen Aufgabe selbst (`FristRoh.aufgabe`,
  dieselbe `aufgabenAnzeige` wie die Karte) und nennt seine Herkunft: „KITED
  (Stillstand „Gutachten fertig“ seit 9 Tagen überfällig): QS anstoßen."
  Zieltage messen Liegezeit, keinen Termin — deshalb
  „überfällig", nicht „fällig". Ohne die Herkunft las sich die Klammer als
  eingetretener Zustand — gemessen 11.09.2026 unter einer Karte, die für
  denselben Verbund eine andere Aufgabe sagte.
- **Meilensteine sind bewusst KEIN Thema** (v6.60.4). Ein Meilenstein ist ein
  Soll-Termin ab Eingang über den ganzen Plan — eine Aussage über das Tempo,
  keine Handlung für heute. Im Brief verdrängte er beim Entdoppeln den
  To-do-Punkt desselben Verbunds und schob eine lange Bedingungs-Bezeichnung vor
  die Aufgabe; gemessen standen vier von fünf gerankten Zeilen so da. Die
  Termine stehen auf der Fristen-Karte. Eine gespeicherte Abwahl `aus:
  ['fristen']` aus älteren Configs bleibt wirkungslos stehen.
- **Keine Überschneidung mit der Hero-Karte darüber:** deren drei Kacheln zählen
  ALTER (>90 / 31–90 Tage), der Brief rechnet FRIST. Zwei Achsen, und keine Zahl
  steht zweimal — deshalb trägt der Brief auch kein Ampel-Sprungziel und zählt
  unter „Bewegung" die `antrag-neu`-Einträge des Journals statt der Eingangs-Ampel.
- **Leere braucht eine Erklärung**: „Nichts Dringendes gefunden. Geprüft: …"
  nennt die aktiven Themen; solange eine Quelle lädt, behauptet der Brief nichts.
  Eingeklappt zeigt der Zähler „—", nicht „0".
- **Themenwahl = Abwahl** (`TagesbriefWidgetConfig.aus`), damit ein später
  ergänztes Thema von selbst erscheint. Themen, die dieser Build nicht bedienen
  kann, stehen gar nicht in der Liste.
- **Auslastung ist bewusst KEIN Thema.** Sie war geplant und ist der einzige
  Fall, dessen Quelle sonst niemand auf der Startseite lädt (zwei Läufe über den
  vollen Antragsbestand — deshalb startet schon das Auslastungs-Widget
  eingeklappt). Eine Karte, die eine andere Karte teuer macht, ist der falsche
  Handel; die Zahl steht einen Klick entfernt auf ihrer eigenen Karte.
- **Config-Version v6**: `migriereV5Tagesbrief` blendet die Karte einmalig ein
  **und stellt sie um** — an den Kopf der Hauptspalte. Das ist die **einzige**
  Ausnahme von „`position` bleibt unberührt": bei einer Karte, die rankt, was
  zuerst dran ist, IST die Position die Sache selbst; angehängt wäre sie
  eingebaut und trotzdem wirkungslos. Einmalig, kein Pin — der Versions-Stempel
  in `useHomeWidgets` ist das Gedächtnis und muss mit der Schema-Version
  mitwandern.
- **Ohne Marke, und das ist Bedingung**: der Brief steht in
  `ENTDECKUNG_WIDGETS`, und eine Beta-Marke legte diese Einblendung still (der
  gemessene v6.19-Fall). Der neue Guard `entdeckung-ohne-marke` hält das fest.

## Startseite anpassen (v4.7, Handoff `_design/handoff/homepage-anpassen`)

Konfiguration dort, wo die Wirkung sichtbar ist: [src/plugins/home/anpassen/](../../src/plugins/home/anpassen/). Die Einstellungs-Sektion bleibt und ist aus jedem Menü erreichbar — sie ist nur nicht mehr der einzige Weg.

- **Vier Auslöser, EIN Panel — aber zwei Zuständigkeiten.** Der Rechtsklick meint die **Seite**, das `⋯` im Kopf einer Karte ([KartenMenueKnopf.tsx](../../src/plugins/home/anpassen/KartenMenueKnopf.tsx)) meint **diese eine Karte**; dazu der Knopf „Startseite anpassen" im Seitenkopf und „Widget hinzufügen" am Spaltenende (beide seitenweit). Bis v4.40.1 öffnete der Rechtsklick auf eine Karte ebenfalls das Widget-Menü, und dieses trug „Widgets ▸"/„Darstellung ▸" mit — dieselben seitenweiten Punkte in jeder Karte, dazu ein zweiter Weg zu demselben Menü. Seither führt ein Karten-Menü nur karten-eigene Punkte (kein `oeffneUnter`), und `[data-widget-id]` / `[data-hero-karte]` sind die **Sperre** des Rechtsklicks statt seiner Zielwahl. Der Offen-Zustand liegt in einem Modul-Store ([useStartseiteMenue.ts](../../src/plugins/home/anpassen/useStartseiteMenue.ts)), weil die Auslöser über vier Komponenten-Ebenen verteilt sind; welcher `⋯` sich als offen zeigt, entscheidet die reine `zielGleich`. Bewusst **kein** zweites Menü über Radix' `ContextMenu` — dieselbe Lehre wie bei [TicketMenue.tsx](../../src/plugins/feedback-board/ticket/TicketMenue.tsx) (v3.18).
- **Auch die zwei Hero-Karten haben ihr `⋯`** ([HeroMenue.tsx](../../src/plugins/home/anpassen/HeroMenue.tsx), v4.41) — sie bleiben Nicht-Widgets (keine Position, kein Einklappen, deshalb keine Pfeile), führen aber, was sie können: **Resume** = ausblenden + „Arbeitsverlauf löschen" (der IDB-Log, aus dem sie sich speist); **Alert** = ausblenden + Kacheln abwählen + „Fristen-Schwellen ändern …", das DAS Formular des Antragseingang-Widgets öffnet (`ampelSchwellenAusConfig` liest genau dort — kein zweites Formular für denselben Wert). Der Zustand liegt in `HomeWidgetConfig.hero` (`HeroConfig`, additiv gelesen: fehlt das Feld, ist alles an — kein Versions-Bump). Zwei Kopplungen halten ihn widerspruchsfrei: fällt die **letzte** Kachel, ist die Karte aus (sonst wäre sie verschwunden und stünde in der Liste weiter als „an"); wird sie dort wieder eingeschaltet, kommen die Kacheln zurück. Der Rückweg für eine ausgeblendete Karte ist die Gruppe **„Oben"** im Widgets-Untermenü — das `⋯` ist mit der Karte weg. Die Einstellungs-Sektion `sec-widgets` führt sie bewusst nicht: sie verwaltet Widgets (Reihenfolge + Detail-Config), und das sind diese beiden nicht.
- **„Arbeitsverlauf löschen" braucht ein Signal.** `useWeitermachenRows` liest den Log in einem Effekt an IDB + Antrags-Store — beides bleibt beim Löschen gleich. Ein Zähler-Store ([arbeitskontextSignal.ts](../../src/plugins/home/arbeitskontextSignal.ts), Muster `csv-sources-signal`) hängt in den Deps, sonst stünde die Karte nach der Aktion unverändert da. Der Rückfrage-Wortlaut lebt einmal (`ARBEITSVERLAUF_LOESCHEN_FRAGE`) und wird von Einstellungen › Daten und dem Karten-Menü geteilt.
- **Eine Positionierung.** Ein `Popover` an einem 0×0-`PopoverAnchor`; der Rechtsklick liefert die Zeigerposition, ein Knopf die Unterkante seines Rechtecks (`punktUnter`). Kollisionen löst Radix damit für beide Fälle gleich.
- **Untermenü = Geschwister-Panel im selben `PopoverContent`** ([StartseiteMenue.tsx](../../src/plugins/home/anpassen/StartseiteMenue.tsx)), kein Portal im Portal: eine Dismissable-Layer, kein Streit um `Esc`. Es hängt **absolut** am Hauptmenü und liegt damit außerhalb von Radix' Größenmessung — als Geschwister im Fluss wüchse der Inhalt beim Aufklappen von 250 auf 524 px, und die ganze Gruppe spränge vom Auslöser weg (Fehler in v4.7.0). Seite, Versatz und Höhendeckel rechnet die reine `berechneUntermenueLage` ([useStartseiteMenue.ts](../../src/plugins/home/anpassen/useStartseiteMenue.ts)): nach links nur, wenn rechts kein Platz ist **und** links einer wäre. „Widget-Einstellungen" tauscht den Panel-Inhalt (TicketMenue-Muster) statt ein zweites Popover zu öffnen.
- **Untermenüs öffnen auf Überfahren, Klick und `→` — nie auf bloßen Fokus.** Radix fokussiert beim Öffnen die erste Zeile; ein `onFocus` dort ließ jedes Menü sofort zweistöckig aufgehen (v4.7.0). Der Fokus geht stattdessen auf den Panel-Rahmen (`onOpenAutoFocus` unterdrückt), damit `Tab` von dort in die Einträge führt.
- **Der Weg zum Untermenü darf es nicht schließen** (v6.19). Es schließt nur, wenn eine echte **Zeile** überfahren wird, die kein eigenes führt — Marke `data-menue-zeile` an [MenueZeile](../../src/plugins/home/anpassen/menueZeilen.tsx), abgefragt **vor** `data-untermenue`. Bis dahin schloss der Handler bei allem, was nicht in `[data-untermenue]` lag: also auch am **5-px-Innenrand** des `MenuePanel`, der rechts neben jeder `w-full`-Zeile liegt und genau auf dem Weg nach rechts überfahren wird (gemessen 5,7 px). Schnell gezogen übersprang der Zeiger den Streifen, langsam traf er ihn — daher „manchmal". `ABSTAND` steht dazu auf **0**: die Panels berühren sich (gemessen `panel.right === untermenü.left`, beidseitig), die 6 px des Handoff-Prototyps waren zusätzliche tote Fläche. Die Konstante bleibt benannt, weil `berechneUntermenueLage` sie in den Platzbedarf der Seitenwahl rechnet.
- **Das Menü bleibt bei Häkchen und Farbwahl offen** (mehrere Schalter nebeneinander, s. `DarstellungDropdown`); Aktionen schließen es.
- **Rückgängig merkt die UMKEHRUNG, nicht den Vorstand** ([rueckgaengigStore.ts](../../src/plugins/home/anpassen/rueckgaengigStore.ts), seit v4.131) — ein Weg für Ausblenden, „alle aus" und „Startseite zurücksetzen"; Letzteres braucht deshalb keine Nachfrage. Einklappen, Primärfarbe und Hell/Dunkel bekommen keine Leiste. Der Aufrufer liefert eine Funktion, die den AKTUELLEN Stand nimmt und nur die Felder seiner eigenen Aktion zurückdreht (`stelleSichtbarkeitHer` für die Sichtbarkeits-Fälle; „zurücksetzen" ist der eine legitime Voll-Rückschrieb). Bis v4.130 hielt der Eintrag den kompletten Stand von vor der Aktion und schrieb ihn zurück — er nahm damit alles mit, was seither passiert war: gemessen sprang ein zwischenzeitlich eingeklapptes Widget von 52 px zurück auf 201 px, während die Leiste nur vom ausgeblendeten sprach. Genau die Änderungen, die bewusst KEINEN Eintrag anlegen, waren so nicht wiederherstellbar. **Die Reue-Frist hängt an `seit` (Zeitstempel), nicht an der Lebensdauer der Leiste**: der Cleanup räumte den Timer ab, sobald man die Startseite verließ, `leere()` feuerte nie, und bei der Rückkehr stand die Leiste wieder da und bot einen beliebig alten Stand an.
- **Rechtsklick-Ausnahmen** (`darfMenueOeffnen`, rein + node-testbar): auf Karten, in Eingabefeldern, bei markiertem Text und mit gedrückter Umschalt-Taste öffnet das Startseiten-Menü nicht. Was dort STATTDESSEN erscheint, entscheidet seit v4.41 die app-weite Regel `zeigtBrowserMenue` ([useBrowserKontextmenue.ts](../../src/core/hooks/useBrowserKontextmenue.ts), in der [ShellLayout](../../src/core/ShellLayout.tsx) einmal am Dokument): das Browser-Menü nur noch in Eingabefeldern (Einfügen), bei markiertem Text (Kopieren) und mit Umschalt (Notausgang) — sonst nichts. Bubble-Phase + `defaultPrevented`-Check, damit die Menüs der App zuerst drankommen; am Dokument statt an einem Wrapper, weil Dialoge und Popover in Portale unter `<body>` rendern.
- **Eine leere Seitenspalte steht nicht** (v6.57). Ist die Config geladen und hat die Seitenspalte kein renderbares Widget (`renderbareWidgets` in [HomeWidgetStack.tsx](../../src/plugins/home/widgets/HomeWidgetStack.tsx), dieselbe Regel wie der Leer-Hinweis), übergibt [HomePage.tsx](../../src/plugins/home/HomePage.tsx) `seite={null}`, und [HomeZweiSpalten.tsx](../../src/plugins/home/HomeZweiSpalten.tsx) rendert nur die Hauptspalte, ohne Griff. Das Lade-Skelett folgt derselben Entscheidung, damit keine rechte Spalte aufblitzt; solange die Config lädt, bleibt die Spalte stehen. Der Rückweg, für den v4.6 „Widget hinzufügen" in jede Spalte setzte, bleibt dreifach erhalten: „Startseite anpassen", Rechtsklick und „Widget hinzufügen" der Hauptspalte öffnen `Widgets ▸`, dessen Gruppe „Seitenspalte" auch die ausgeblendeten Widgets führt. Die gezogene Breite bleibt in localStorage liegen. Nicht erfasst ist ein eingeschaltetes Widget, das sich selbst versteckt (`null` rendert) — das wüsste erst das DOM.
- **Die Startseite weicht dem offenen Assistent-Dock aus** (v6.57, [DockAussparung.tsx](../../src/plugins/home/DockAussparung.tsx)). Das Dock liegt app-weit als Overlay über dem Blatt (400 px Standard, 320–640) — eine weggefallene Seitenspalte allein machte dafür keinen Platz (sie gibt 332 px frei, und die Hauptspalte wüchse hinein, also unter das Dock). Deshalb ist die Wurzel der Startseite (auch die des Lade-Skeletts) `DockAussparung`: Ist das Dock offen **und** das Flag `assistentPanel` an, trägt sie einen rechten Außenabstand von genau der Dock-Breite; das `px-8` bleibt als Luft zur Dock-Kante. Beides zusammen ergibt das Bild: Dock zu → volle Breite; Dock offen → die Spalten enden links davon, und eine leere Seitenspalte kostet nichts. Eigene Komponente, weil das Dock beim Ziehen seine Breite je Mausbewegung in den Store schreibt — so rendert pro Frame nur der Rahmen.
- **Reine Config-Operationen** in [homeWidgetsStore.ts](../../src/plugins/home/widgets/homeWidgetsStore.ts): `setzeAlleEingeklappt` (nur sichtbare Instanzen), `setzeSichtbarkeitBereich` (nur katalog-anzeigbare Typen, andere Spalte unberührt), `zurueckgesetzteConfig` (= Default + Reconcile, damit „zurückgesetzt" und „nie angefasst" dasselbe heißen). Jeder Wrapper in `useHomeWidgets` ist EIN `mutiere` (Pitfall #16/#20).
- **„Dichte Normal/Kompakt" aus dem Handoff ist nicht umgesetzt** — eine app-weite Dichte gibt es nicht, und der Prototyp löst sie über `body{font-size}`. Dichte bleibt eine Achse der einzelnen Listen. **Es gibt auch keinen Dichte-SCHALTER**: die Karte „Meine Anträge" ist seit v6.8.0 fest enger gestellt (unten), nicht umschaltbar — ein Regler dafür bräuchte eine Detail-Config und damit eine Config-Versions-Migration (s. `reconcile` ergänzt nur Typen, nie Felder).
- **Kartenhöhe ist knapp, die Kopfzeile gehört allen** (v6.8.0): Der Kopf der Haupt-Karten steht in der [WidgetShell](../../src/plugins/home/widgets/WidgetShell.tsx) auf `py-1.5` (40 px statt 48), der Kartenfuß auf `pb-2`. Das gilt bewusst für **alle** Haupt-Karten — eine einzelne flachere Karte neben dreizehn höheren liest sich als Fehler. Unter ~32 px käme ohnehin nichts mehr an: der `⋯`-Knopf misst 28 px. Die Zeilen von „Meine Anträge" holen ihre Enge über das **Opt-in** `dicht` an [ListItem](../../src/components/ui/ListItem.tsx) (Polster 12 → 6 px, Trennlinie via `color-mix` auf 45 % gedämpft — eine fest notierte rgba-Schwarz-Angabe wäre im Dunkelmodus unsichtbar). `dicht` ist **kein neuer Standard**: `ListItem` trägt sieben Aufrufer, nur einer davon ist ein Widget. Gemessen am echten Bestand (1536 × 960): Zeile 44,5 → 30,5 px, Höhe über der Liste 213,75 → 165 px, **16 statt 10 Zeilen ohne Scrollen**, Seite 2124 → 1895 px.
