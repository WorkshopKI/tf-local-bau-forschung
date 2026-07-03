# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v2.164.0 — Konsolidierungs-Pass (Juli 2026)

MINOR — Wartungs-/Konsolidierungs-Release nach dem Feature-Sprint seit v2.131. **Verhaltens-invariant**
(keine User-sichtbare Änderung); Ziel: weniger Fehler bei künftigen Feature-Arbeiten durch Ist-Zustand-Doku,
Regressionstests an nachweislichen Bug-Hotspots, konservativen Dead-Code-Abbau und Dekomposition der zwei
größten Mixed-Responsibility-Dateien. Keine Migration, keine neuen Stores/Sidecars, keine Registry-Änderung.

- **Doku (Ist-Zustand):** Architektur-Doc [anfragen-modul.md](docs/architecture/anfragen-modul.md) neu
  (`.msg` → interne Anonymisierung → externer ZIM-FAQ-Assistent → deterministische Wiedereinsetzung, mit
  Export-Guard + 3-stufiger URL-Auflösung + Varianten-/Skill-Gate); [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md)
  neu (Tages-Import, Frische-Ampel „● CSV", Projektions-Rebuild bei Mapping-Nachzug — kohäsionsgetrennt von
  [csv-import.md](docs/architecture/csv-import.md)); [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)
  um **Klasse 9** (abgeleitete Daten rebuilden nicht bei Config-Nachzug) + **Klasse 10** (DOM-Scraping fremder
  UIs ist positionsfragil) ergänzt; CLAUDE.md-Decision-Tree nachgezogen. CHANGELOG.md auf v2.131+ gekürzt
  (v2.130.x abwärts ins [Archiv](docs/CHANGELOG-ARCHIV.md) verschoben).
- **Bridge-Antwort-Auswahl testbar** ([answer-selection.ts](src/core/services/ai/streamlit-bridge/answer-selection.ts)
  + [Tests](src/core/services/ai/streamlit-bridge/__tests__/answer-selection.test.ts)): die Echo-Anker-Logik
  (erste Nicht-User-Nachricht nach dem Prompt-Echo, v2.159.4) als **pure Funktion** extrahiert und im
  Bookmarklet gespiegelt, mit **Co-Ausführungs-Drift-Test** (JS + TS gegen dieselben Roster-Fixtures). Kein
  Verhaltens-Umbau — `BRIDGE_REV` unverändert.
- **Regressionstests + Guard-Härtung:** Cross-Programm-Signatur-Rebuild-Test (Klasse 9,
  [list-view-rebuild.test.ts](src/core/services/csv/__tests__/list-view-rebuild.test.ts)); der `no-raw-cta-fill`-
  Guard fängt jetzt auch **opake Schwarz-Inline-Fills** (`#000`/`black`/`rgb(0,0,0)`) — rgba-Overlays + Pastell-
  Boxen bleiben ausgenommen.
- **Dead-Code:** 12 nachweislich tote Dateien entfernt (Komponenten nirgends gerendert, ganze Service-Dateien
  ungenutzt) — konservativ; Feature-Flag-Prädikate, Test-Helfer, string-/IDB-gebundene Konstanten und
  Migrations-Aliase bewusst behalten.
- **Dekomposition** entlang der dokumentierten Verantwortungs-Grenzen: [SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx)
  (643→372 LOC → `SearchInput` + `useSearchResults`), [CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx)
  (568→225 LOC → `SourceList` + `MaintenanceSection` + `SourceModals` + `csv-file-picker`). FS-API-Gesten-Ketten
  unverändert (Bug-Klasse 2).

### v2.163.0 — Feedback-Kurator: Detail-Panel ziehbar + „Abhaken"-Haken deutlicher (Juli 2026)

MINOR — Die Kurator-Feedback-Tickets nutzen jetzt das kanonische resizable Split-Layout
([MasterDetailLayout](src/components/master-detail/MasterDetailLayout.tsx)) statt eines starren 50/50-Grids:
die Grenze zwischen Ticket-Liste und Detail-Panel lässt sich per Drag-Handle verschieben (Breite
persistiert, `teamflow_feedback_kurator_list_width`), Escape schließt das Detail. Ohne Auswahl nimmt die
Liste die volle Breite ein. Außerdem ist der „Umgesetzt"-Abhaken-Haken (v2.162.0) jetzt deutlich sichtbar.

- Die Filter-Chips (Status/Kategorie/Bereich + „Archivierte einblenden") wandern in den Seitenkopf des
  Tickets-Tabs (bleiben beim Scrollen der Liste stehen) — analog zum öffentlichen Board
  ([FeedbackBoardPage](src/plugins/feedback-board/FeedbackBoardPage.tsx)). [FeedbackTicketList](src/plugins/feedback/sections/FeedbackTicketList.tsx)
  ist dadurch reine Zeilen-Liste (wie `FeedbackBoardList`); die Scroll-Pane stellt `MasterDetailLayout`.
- Der Abhaken-Haken ([FeedbackTicketRow](src/components/feedback/FeedbackTicketRow.tsx)) hat jetzt einen
  klar sichtbaren Rahmen (`--tf-text-tertiary`, 1,5 px) statt des kaum sichtbaren `--tf-border`; beim Hover
  erscheint ein Haken-Preview + dezenter Hintergrund. Umgesetzt = grüner Haken (unverändert).
- Kein neues Layout gebaut (CLAUDE.md „Neue Module bauen KEIN eigenes Layout") — der Testballon
  [AntraegePage](src/plugins/antraege/) bleibt die einzige verbliebene Eigen-Implementierung.

### v2.162.0 — Feedback-Kurator: Tickets per 1-Klick als „Umgesetzt" abhaken (Juli 2026)

MINOR — In der Kurator-Feedback-Liste bekommt jede Zeile links einen Checkbox-artigen Haken. Ein Klick
setzt den Status **sofort** auf „Umgesetzt" (kein Ticket öffnen, kein „Speichern"), nochmal klicken macht
rückgängig (→ „Neu"). Vorher brauchte das 4 Schritte (Ticket wählen → Status-Dropdown → „Umgesetzt" →
Speichern). Feinere Stati (Geplant/In Bearbeitung/Abgelehnt) bleiben dem Status-Dropdown im Detail
vorbehalten.

- Neuer Statushelfer `toggleUmgesetzt` in [feedback-status.ts](src/core/services/feedback/feedback-status.ts)
  (schaltet `umgesetzt` ↔ `neu`; Pitfall #21-konform, keine Status-Literale). Test:
  [feedback-status.test.ts](src/core/services/feedback/__tests__/feedback-status.test.ts).
- Die geteilte [FeedbackTicketRow](src/components/feedback/FeedbackTicketRow.tsx) bekommt eine **optionale**
  `onToggleDone`-Prop → der Haken erscheint nur in der Kurator-Liste, das öffentliche Board bleibt
  unverändert. Der Haken ist ein eigener Button **neben** dem Zeilen-Button (kein verschachteltes
  `<button>`); ein Klick darauf wählt die Zeile nicht aus. Umgesetzte Zeilen zeigen einen grünen Haken +
  dezent abgeschwächten Titel.
- Schreiben über `useAsyncAction` (Doppelklick-Schutz) + `updateFeedback` in
  [FeedbackAdminPage.tsx](src/plugins/feedback/FeedbackAdminPage.tsx): optimistisch sofort umgeschaltet, bei
  Schreibfehler Fehlerzeile + Reload (kein Silent-Fail). Umgesetzte Tickets bleiben in der Liste sichtbar
  (`umgesetzt` ≠ archiviert).

### v2.161.6 — Feedback-Kurator: Filter-Chip-Zähler stimmen jetzt mit der Liste überein (Juli 2026)

PATCH — In der Kurator-Feedback-Verwaltung zeigten die Filter-Chips (Status/Kategorie/Bereich) andere
Zahlen als die Anzahl der tatsächlich gelisteten Tickets: „Bug 5", aber nur 1 sichtbares Bug. Ursache:
die Liste blendet **archivierte** Tickets standardmäßig aus, die Zähler zählten aber über **alle** Tickets
(inkl. archivierte) und ignorierten zudem die anderen aktiven Filter. Mit eingeblendeten Archivierten
passte es zufällig — daher die beobachtete Diskrepanz.

- Neues geteiltes Prädikat + Facetten-Zähler in [feedback-filter.ts](src/plugins/feedback/feedback-filter.ts)
  (`matchesFeedbackFilters` + `countForCategory`/`countForStatus`/`countForArea`). Liste **und** Chip-Zähler
  in [FeedbackAdminPage.tsx](src/plugins/feedback/FeedbackAdminPage.tsx) leiten jetzt aus **derselben** Quelle
  ab: jeder Zähler beantwortet „wie viele zeigt die Liste, wenn ich diese Facette wähle?" (andere aktive
  Filter bleiben fix, die eigene Facette filtert sich nicht selbst) → die ausgewählte Chip-Zahl == angezeigte
  Zeilenzahl, auch beim Kombinieren mehrerer Filter.
- Der frühere Sonderfall für den Status-„Alle"-Zähler (respektierte `showArchived`) fällt weg — die Regel
  gilt nun einheitlich für alle drei Chip-Gruppen. Regressionsschutz: 9 Fälle in
  [feedback-filter.test.ts](src/plugins/feedback/__tests__/feedback-filter.test.ts) inkl. des gemeldeten
  „Bug 5 → 1 sichtbar"-Szenarios.

### v2.161.5 — Such-Spalte „Programm" zeigt jetzt „Programm/Unterprogramm" (Juli 2026)

PATCH — Die Spalte **Programm** in der übergreifenden Suche war wenig aussagekräftig, weil sie für alle
Treffer desselben aktiven Programms denselben Wert (`ZIM`) zeigte. Sie zeigt jetzt zusätzlich das
**Unterprogramm-Label** im Format `Programm/Unterprogramm` (z.B. `ZIM/ZIM FuE-Projekte 2025`); ohne
Unterprogramm bleibt es beim reinen Programm-Namen. Reine Anzeige-Verbesserung, keine Datenänderung.

- Neues optionales Feld `unterprogramm` an [UnifiedSearchResult](src/core/types/search-result.ts). In
  [useUnifiedSearch.ts](src/core/hooks/useUnifiedSearch.ts) trägt `mapAntragHit`/`mapDokumentHit` den rohen
  `unterprogramm_id`-Code mit; das sprechende Label wird **nach** der Streaming-Pipeline in einem reinen
  `useMemo` über den bestehenden Hook [useUnterprogrammLabels](src/plugins/antraege/useUnterprogrammLabels.ts)
  aufgelöst (Fallback = Code). Der Effekt-Dep-Array bleibt unberührt → kein zusätzlicher Such-Re-Run.
- `unterprogramm_id` liegt bereits in der Slim-List-View → **kein** `LIST_VIEW_PROJECTION_VERSION`-Bump,
  keine Migration. Die Suche ist auf ein aktives Programm gescoped, daher genügt eine Label-Map.
- Die `programm`-Spalte in [columns.tsx](src/plugins/suche/columns.tsx) kombiniert Accessor + Render zum
  `Programm/Unterprogramm`-Wert (breiter, `truncate` + Tooltip). Sort/Filter/Export laufen über den
  kombinierten Wert — Filtern nach Unterprogramm wird dadurch erstmals möglich.

### v2.161.4 — „Letzter Monat"-Filter aus dem Changelog-Modal entfernt (Juli 2026)

PATCH — Der Zeit-Filter „Letzter Monat" im „Was ist neu?"-Modal ist **ersatzlos entfernt** (wurde nicht
gebraucht). Die Kategorie-Filter (Alle / Neu & Verbesserungen / Bugfixes) und „Alle auf-/zuklappen"
bleiben. Rein UI, keine Verhaltensänderung an den Daten.

- Gelöscht in [ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx): `timeFilter`-State,
  `TimeFilterKey`, `nowMonthIndex`, der `withinTime`-Filter, der Button und die `timeFilter`-Referenzen in
  den Collapsible-Keys. Der „Alle auf-/zuklappen"-Knopf sitzt jetzt direkt via `ml-auto` rechts.
- Die Datums-Ableitung im Parser (`dateIso`/`monthIndex` in
  [deriveChangelog.ts](src/core/components/changelog/deriveChangelog.ts)) bleibt unangetastet — generische,
  getestete Metadaten, nicht Teil des entfernten Filters.

### v2.161.3 — „Mit KI glätten"-Editor aus dem Changelog-Modal entfernt (Juli 2026)

PATCH — Der In-App-Editor „Mit KI glätten / Auf Share speichern" (dev + Kurator-Session) ist **ersatzlos
entfernt**. Er hing an der instabilen Streamlit/AitisiGPT-Bridge und ist überflüssig, seit der geglättete
Nutzer-Changelog hand-gepflegt in der committed [changelog-user.md](src/core/components/changelog/changelog-user.md)
liegt (v2.161.2). Der Changelog ist damit rein **build-eingebettet** — kein Runtime-Share-Weg mehr.

- Gelöscht: `ChangelogPolishPanel.tsx`, `changelogShare.ts` (Read+Write des Share-Sidecars), das Prädikat
  `canPolishChangelog` ([feature-flags.ts](src/config/feature-flags.ts)) und der Share-Lese-Effekt im
  [ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx). Anzeige jetzt schlicht
  `getDisplayChangelog(derived, committedOverride)`.
- Sidecar `_intern/changelog-user.md` ist damit **obsolet** (wird nicht mehr gelesen/geschrieben); eine
  evtl. vorhandene Datei wird ignoriert und darf gelöscht werden. Pflege-Weg: neue Versionen in der
  committed `changelog-user.md` ergänzen (zusammen mit CHANGELOG.md), Rebuild.

### v2.161.2 — Nutzer-Changelog ab v2.100 durchgängig geglättet + gepflegt (Juli 2026)

PATCH — Der Nutzer-Changelog (`changelog-user.md`) ist ab v2.100 vollständig in nutzerfreundliche
Sprache übersetzt und wird ab jetzt **hand-gepflegt zusammen mit CHANGELOG.md** — der unzuverlässige
„Mit KI glätten"-Bridge-Weg ist damit kein Pflichtschritt mehr. Endnutzer sehen im „Was ist neu?"-Modal
durchgängig verständliche Einträge (Nutzen statt Technik), rein interne Umbauten sind zu je einer
schlichten Zeile eingedampft.

- **`changelog-user.md` gefüllt** (62 Minor-Abschnitte v2.100–v2.161, kanonisches `## vX.Y — JJJJ-MM`
  + `### Neu`/`### Verbesserungen`/`### Bugfixes`). Ältere Versionen (< v2.100) leitet das Modal weiter
  automatisch aus CHANGELOG.md ab.
- **Committed Fassung ist jetzt AUTORITATIV** ([ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx)):
  `override = mergeChangelog(committedOverride, shareStand)` — die gepflegte Fassung gewinnt je Version, ein
  (evtl. veralteter) Share-`_intern/changelog-user.md` füllt nur noch Versionen, die sie nicht kennt. Damit
  kann eine alte Share-Datei die gepflegte Fassung **nicht** mehr überschatten (ergänzt v2.161.1).

### v2.161.1 — Changelog-Modal zeigt die neueste Version wieder zuverlässig (Juli 2026)

PATCH — Behebt, dass das „Was ist neu?"-Modal auf einer älteren Version hängen blieb, obwohl der
Build bereits neuer war. Ursache: Ein kuratierter/geglätteter Changelog-Override (der geglättete
`_intern/changelog-user.md` auf dem Share **oder** die committed Fassung) **ersetzte** die aus
CHANGELOG.md abgeleitete Anzeige komplett — und **verdeckte** damit jede Version, die nach dem letzten
Glätten dazukam (z.B. v2.161, während der Override nur bis v2.160 reichte). Kein KI-Glätten und kein
Rebuild konnte das aus Nutzersicht heilen.

- **Anzeige mischt statt ersetzt** (`getDisplayChangelog`, [deriveChangelog.ts](src/core/components/changelog/deriveChangelog.ts)):
  Der Override **gewinnt weiterhin je Version** (behält die schöne Prosa), aber Versionen, die er nicht
  enthält, werden aus der Build-Ableitung **ergänzt**. Die Anzeige hinkt dem Build damit nie wieder
  hinterher — die neueste Version erscheint immer, geglättet oder (noch) roh. Verdrahtet in
  [ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx); der committed-Override greift
  nur noch mit echten `## vX.Y`-Abschnitten.
- **Glätten warnt statt still zu schlucken** ([ChangelogPolishPanel.tsx](src/core/components/changelog/ChangelogPolishPanel.tsx)):
  Nach dem Merge wird geprüft, ob **jede** frisch selektierte Version den Merge überlebt hat. Kam eine
  nicht als parsebarer `## v…`-Kopf von der KI zurück (Bridge/Modell), wird sie jetzt sichtbar als
  fehlend gemeldet statt kommentarlos aus dem zu speichernden Stand zu fallen.
- **Inkrementell-Basis = angezeigter Override** statt nur des Share-Stands: verhindert, dass das Glätten
  bei leerem Share degeneriert und plötzlich „alles ab v2.6" an die KI schickt.

### v2.161.0 — Förderanträge-Tabelle: Gesamtbreite per Griff ziehbar (Juli 2026)

MINOR — Ergänzt v2.159.2 (Tabelle füllt die Fensterbreite): Am **rechten Tabellenrand** sitzt jetzt ein
Griff, mit dem sich die **gesamte** Tabelle breiter/schmaler ziehen lässt — die Spalten skalieren dabei
**proportional** mit (CSS `table-layout: fixed` verteilt die Gesamtbreite auf die Spalten-Gewichte). So passt
man die Tabelle mit einer Geste an einen breiten Monitor an, statt jede Spalte einzeln.

- **Neue Opt-in-Props an `SortableTable`** ([SortableTable.tsx](src/components/data-table/SortableTable.tsx)):
  `totalWidth` (gepinnte Pixel-Breite, `null` = Default/füllen) + `onTotalWidthChange`. Nur wenn gesetzt,
  rendert der rechte Rand den Griff. Die ~7 anderen `SortableTable`-Nutzer (Skills, Regeln, Feedback-Board,
  Auslastung, Anfragen) übergeben nichts → **unverändert** (früher Early-Return auf das bisherige Markup).
- **Verhalten**: Ziehen nach rechts über die Fensterbreite hinaus → horizontaler Scroll; nach links →
  Tabelle schmaler, Weißraum rechts. **Doppelklick** auf den Griff = Reset auf „Fensterbreite füllen".
  Persistiert pro Nutzer ([useTotalTableWidth.ts](src/components/data-table/useTotalTableWidth.ts),
  localStorage `teamflow_antraege_table_total_width`).
- **Komposition mit dem Spalten-Resize**: Beides bleibt. Die `<col>`-Breiten wirken als Gewichte — der
  Einzel-Griff ändert das Gewicht einer Spalte, der Gesamt-Griff die Tabellenbreite; `table-layout:fixed`
  verteilt immer proportional, die zwei Controls kollidieren nicht.
- Verdrahtet in [AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx).

### v2.160.0 — „Mit KI glätten" auch im Kurator-Build (Juli 2026)

MINOR — Der Editor „Mit KI glätten" im Changelog-Modal (schreibt die geglättete `_intern/changelog-user.md`
auf den Share, die alle Varianten zur Laufzeit lesen) war bisher **nur im Dev-Build** sichtbar — daher blieb
der Nutzer-Changelog auf dem Prod-Share beim letzten Dev-Glätten stehen (zuletzt v2.126). Jetzt kann auch der
**Kurator** in seinem Build den Changelog aktuell halten, ohne dass ein Entwickler einspringt.

- **Freigabe erweitert** ([ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx)): das Panel
  rendert jetzt via neuem Prädikat `canPolishChangelog(sessionActive)` ([feature-flags.ts](src/config/feature-flags.ts)) —
  dev immer, Kurator-Build zusätzlich mit **aktiver Kurator-Session**. prod/pl/as bleiben außen vor (Nutzer-Changelog
  ist eine Kurations-Aufgabe). Kein neues Auth-Muster; komponiert `isKuratorMenusEnabled()` + Session wie
  `canEditSkillRegistry`.
- **Sicher ohne Crash-Risiko:** der `AIBridge`-Provider hängt app-global über dem Router ([App.tsx](src/core/App.tsx)),
  daher ist `useAIBridge()` im Kurator-Build genauso sicher wie im Dev-Build. Physischer Schreib-Guard bleibt
  `atomicWrite`/`queryPermission`.

### v2.159.4 — Bridge nimmt die ERSTE Antwort nach dem Prompt (AitisiGPT hängt Folge-Begrüßung an) (Juli 2026)

PATCH — Endgültige Ursache, per Live-Console-Dump der AitisiGPT-Seite bewiesen: **AitisiGPT hängt NACH der
eigentlichen Antwort noch eine kanned Folge-Begrüßung an** („Hi! Ich bin Aitisi und recherchiere für dich…").
Das DOM-Roster war `[0] Begrüßung · [1] User-Prompt · [2] JSON-Antwort · [3] Folge-Begrüßung`. Bisher nahm das
Bookmarklet die *letzte* Assistant-Nachricht (v2.159.3: letzte nach dem Echo = `[3]` = Folge-Begrüßung; früher
schlicht die letzte). `isUser` funktioniert korrekt — die Antwort steht nur in der **Mitte**, nicht am Ende.

- **Erste Antwort statt letzter** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  `lastAssistant`): liefert die **erste** Nicht-User-Nachricht **nach** dem Prompt-Echo (`msgs[lastUser+1…]`
  vorwärts). Begrüßung `[0]` steht davor, Folge-Begrüßung `[3]` danach → beide ausgeschlossen; die Antwort `[2]`
  wird getroffen. `lastUser < 0` (Echo nicht gefunden) → `null` statt raten.
- **Marker** `BRIDGE_REV` → `2026-07-02-first-answer`. Diagnose-Roster-Log bleibt.

> ⚠️ **Re-Install nötig** (KI-Tab F5 + Bookmarklet neu ziehen/klicken; Tooltip muss `…first-answer` zeigen).
> Sofort-Alternative ohne Bookmarklet: „Manuell ▾ → Prompt kopieren" + „LLM-Ergebnis einfügen".

### v2.159.3 — Bridge ankert die Antwort am Prompt-Echo statt an einer Zähl-Baseline (Juli 2026)

PATCH — Nachtrag zu v2.159.1: Die LLM-Klassifizierung bekam weiter die AitisiGPT-**Begrüßung** zurück statt
der Antwort (Fehler-Snippet „…Hi! Ich bin Aitisi…"). Bestätigt (Badge-Marker `…baseline` sichtbar → neues
Bookmarklet lief): die v2.159.1-**Zähl-Baseline** ist eine **Race Condition** — sie wird direkt nach dem
Chat-Reset-Rerun erfasst; rendert die Begrüßung auf dem ausgelasteten internen Server erst danach, ist der
Zähler 0 und die Begrüßung gilt fälschlich als „neu" → gegriffen.

- **Prompt-Echo-Anker** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  `lastAssistant`): statt Nachrichten zu zählen, wird die Antwort als **letzte Nicht-User-Nachricht *nach* dem
  Prompt-Echo** (der letzten User-Nachricht) bestimmt. Die Begrüßung steht immer *vor* unserem Prompt →
  render-timing-**unabhängig** ausgeschlossen. Ersetzt die Zähl-Baseline (v2.159.1).
- **Diagnose-Netz:** Beim Finalisieren loggt das Bookmarklet das Nachrichten-Roster (Anzahl, je User/Assistant
  + erste 30 Zeichen) + die gewählte Antwort in die Konsole (F12) — falls es *doch* bricht, sehen wir die echte
  AitisiGPT-Struktur statt zu raten.
- **Marker** `BRIDGE_REV` → `2026-07-02-echo-anchor` (Re-Install im Badge-Tooltip verifizierbar).

> ⚠️ **Re-Install nötig** (KI-Tab F5 + Bookmarklet neu ziehen/klicken; Tooltip muss `…echo-anchor` zeigen).
> Sofort-Alternative ohne Bookmarklet: „Manuell ▾ → Prompt kopieren" + „LLM-Ergebnis einfügen".

### v2.159.2 — Förderanträge-Tabelle nutzt die volle Browserbreite (Juli 2026)

PATCH — Die Tabellen-Ansicht der Förderanträge (`viewMode === 'compact'`) war auf `max-w-6xl` (~1152px)
gedeckelt. Sobald über den Spalten-Picker mehr Spalten eingeblendet wurden, als in diese Box passen
(z.B. FKZ · TIB · Akronym · Status · FB Status · PreCheck Status · Frist · Erstentscheidung), wurden die
rechten Spalten abgeschnitten — und ein breiteres Browserfenster half nicht, weil der Cap die zusätzliche
Breite ignorierte.

- **Cap nur noch für die List-View** ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx),
  `toolbarClass` + `contentClass`): der `max-w-6xl`-Lesbarkeits-Cap wandert vom „list+compact"-Zweig in
  einen `viewMode === 'list'`-only-Zweig. Tabelle (Compact) + Karten nutzen jetzt die **volle** verfügbare
  Breite; auf breiten Monitoren werden alle eingeblendeten Spalten ohne horizontalen Scroll sichtbar.
- **Keine neue Mechanik nötig**: `AntraegeTable` rendert bereits über `SortableTable` mit `fitContentWidth`
  (Tabelle füllt den Container, scrollt erst bei Spaltensumme > Container) + Spalten-Resize inkl.
  Drag-Handle an der letzten Spalte — „am rechten Rand der letzten Spalte breiter ziehen" funktioniert damit
  direkt. Die List-View behält ihren Lesbarkeits-Cap (lange Text-Zeilen).

### v2.159.1 — Bridge greift die Begrüßung statt der Antwort (Baseline-Fix) (Juli 2026)

PATCH — Nachtrag zu v2.157.1: die LLM-Klassifizierung kam trotz sichtbar korrektem JSON weiterhin nicht in
der App an (am echten Rechner reproduziert: 3× Prompt+Reset, jedes Mal „0/0, 1 Fehler"). Bestätigte Ursache:
Das Bookmarklet las **die falsche Chat-Nachricht**.

- **Baseline im Bookmarklet** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  `runRequest`): `lastAssistant()` lieferte schlicht die *letzte* Nicht-User-Nachricht — nach jedem Reset ist das
  die AitisiGPT-**Begrüßung** („Informationen sprechen…"), bis die echte Antwort kommt. Die Bridge finalisierte
  darauf → `parseLLMResponse` fand kein `[` → Fehler → Retry → dasselbe. Neu wird **vor dem Absenden** die
  Nachrichtenzahl als `baseline` gemerkt; nur Nachrichten **ab** diesem Index gelten als Antwort auf diese
  Anfrage. Schützt auch bei fehlgeschlagenem Reset und im Chat-Modus mit Verlauf. (Die Doku beschrieb diese
  „Baseline-Nachrichtenzahl vor dem Senden" bereits — im Code fehlte sie.)
- **Versions-Marker im Bookmarklet** (`BRIDGE_REV`): Badge-Tooltip im KI-Tab + `window.__teamflowBridgeRev` +
  Konsolen-Log beim Aktivieren — damit „läuft das neue Bookmarklet?" ohne Rätselraten prüfbar ist.
- **Diagnostischer Fehler** ([llm-klassifizierung.ts](src/plugins/auslastung/services/klassifizierung/llm-klassifizierung.ts)
  + [LLMKlassifizierungButtons.tsx](src/plugins/auslastung/components/LLMKlassifizierungButtons.tsx)):
  `parseLLMResponse`-Fehler tragen jetzt einen Antwort-Snippet („Antwort-Anfang: „…""), und die UI zeigt bei
  0 Ergebnissen die **erste** Fehlermeldung persistent statt nur „(N Fehler)".

> ⚠️ **Re-Install nötig:** Bookmarklet erst nach KI-Tab-Reload (F5) + Neu-Ziehen + Klick aktiv. Verifizieren
> über den Badge-Tooltip (zeigt `rev 2026-07-02-baseline`).

### v2.159.0 — Sidebar-Statusleiste zweizeilig + kontextuelles „Zeig es mir" (Juli 2026)

MINOR — Die Sidebar-Fußzeile war einzeilig überfüllt (`Neu hier?` + Ampeln `● Sync ● CSV ● KI` +
Versionsnummer), und ab Breite < 200 px wurde `Neu hier?` ganz ausgeblendet. Weil der User die Sidebar oft
schmal zieht (Bildschirmbreite für die Listenansichten), fehlte dann der Einstieg. Neu ist die Fußzeile
**zweizeilig**, damit auch schmal alles sichtbar bleibt:

- **Zeile 1**: „Neu hier?" / „Zeig es mir" (links, **ohne** Icon) + Versionsnummer (rechts).
- **Zeile 2**: nur die Status-Ampeln `● Sync ● CSV ● KI`, linksbündig (Punkt+Wort „Variante D" bleibt).
- **Kontextuell**: auf **Home** heißt der Button „Neu hier?" und startet die Onboarding-Tour; auf jeder
  **anderen** Seite heißt er „Zeig es mir" und öffnet einen kleinen Info-Dialog, der ankündigt, dass hier
  bald ein seitenspezifischer Anwendungsfall gezeigt wird (Suche: Suche + Trefferfilterung/KI-Suche ·
  Auslastung: kompletter Zuweisungs-Weg über alle Tabs). Die eigentlichen Use-Case-Touren sind Folgearbeit.
- **Rail (eingeklappt, 52 px)**: die drei Ampeln nur noch als reine Punkte (neues optionales `compact`-Flag
  an `SyncStatusIndicator`/`CsvFreshnessIndicator`/`BridgeStatusIndicator`), zentriert.
- Additiv, keine User-Aktion, kein Daten-Share-/IDB-Layout-Wechsel. Neu: [FooterShowcaseButton.tsx](src/core/components/FooterShowcaseButton.tsx);
  Umbau der Fußzeile in [ShellLayout.tsx](src/core/ShellLayout.tsx) (`FOOTER_NARROW_THRESHOLD`/`footerNarrow` entfallen).

### v2.158.2 — Spalten „FB Status" / „PreCheck Status" bleiben nicht mehr leer nach Mapping-Nachzug (Juli 2026)

PATCH — Auf manchen Rechnern/Varianten blieben die einblendbaren Tabellen-Spalten **„FB Status"** und
**„PreCheck Status"** leer, obwohl Schema-Mapping **und** Rohdaten vorhanden waren (belegt: auf demselben
Rechner `kurator`-DB befüllt, `pl`-DB leer bei identischem Schema + 11.633 Roh-Datumswerten). Ursache: Die
FB/PC-Label werden bei der **List-View-Projektion** berechnet, indem die Legacy-Datums-Codes (`D_PC+`,
`D_XPC+`, …) gegen die Schema-`column_mapping` aufgelöst werden. Wurden diese Spalten **nachträglich**
gemappt, ändert das **keinen** Antrag-Record → weder der count-basierte Backfill noch der inkrementelle
Snapshot-Diff bauen die Projektion neu, und der Code-Versions-Marker blieb gleich ⇒ der Altbestand behielt
dauerhaft leere `fb_/precheck_status_label`.

- **Sofort-Fix (flotten-weit)**: `LIST_VIEW_PROJECTION_VERSION` **4 → 5** ([list-view-migration.ts](src/core/services/csv/list-view-migration.ts))
  → Marker-Mismatch löst beim ersten Start je Variante **einen** Voll-Rebuild aus (~5 s bei 14k, bestehende
  Boot-Statuszeile; crash-safe, Marker erst nach Erfolg). Danach sind die Spalten befüllt.
- **Härtung (schließt die Bug-Klasse)**: zusätzlicher **Schema-Signatur-Guard** — eine deterministische
  Signatur der aufgelösten FB/PC-Felder (code→feld→label über alle Programme, `murmurhash3`) wird neben dem
  Marker persistiert (`list-view-projection-schema-sig`). Ändert sich die Signatur (Mapping neu/ge-`ignore`d/
  Label geändert), erzwingt der Boot-Guard automatisch einen Rebuild — **ohne** künftig den Code-Marker von
  Hand bumpen zu müssen. Eine *fehlende* Signatur (Bestand vor v2.158.2) löst **keinen** Rebuild aus (das
  deckt der v4→v5-Bump ab) und wird nur lazy nachgetragen; der „Marker aktuell → No-op/Backfill"-Pfad bleibt
  unangetastet. `isListViewProjectionCurrent` (inkrementeller Sync) bleibt bewusst marker-only — Mapping-
  Änderungen greifen beim nächsten Start.
- Additiv, **keine User-Aktion**, kein Daten-Share-/IDB-Layout-Wechsel (nur ein neuer `kv`-Key). Tests:
  [list-view-rebuild.test.ts](src/core/services/csv/__tests__/list-view-rebuild.test.ts) (Signatur-Guard löst
  Rebuild aus / fehlende Signatur ist No-op).

### v2.158.1 — Aktuelles Quartal rollt automatisch mit dem Kalender (Juli 2026)

PATCH — `config.aktuellesQuartal` wurde beim Setup einmal aus dem Datum abgeleitet und danach nie
weitergerollt: nach dem Quartalswechsel am 1.7. hing das ganze Auslastungs-Modul auf `2026-Q2`, obwohl
schon Q3 war (Übersicht, Zuweisung, Matching, Home-Selbsteintragung). Neu wird der Wert **read-time beim
Laden** nie mehr hinter das heutige Kalenderquartal zurückfallen — `effektivesAktuellesQuartal()`
([types.ts](src/plugins/auslastung/types.ts)) hebt einen veralteten Wert auf das heutige Quartal an, lässt
ein bewusst in die **Zukunft** gesetztes Quartal (Voraus-Planung) aber unberührt (fixed-width-Format →
lexikalischer = chronologischer Vergleich, auch über Jahresgrenzen). Angewandt im Load-Chokepoint
`normalizeAuslastungData()` ([auslastung-store.ts](src/plugins/auslastung/services/auslastung-store.ts)),
daher greift es modulweit ohne Änderung der vielen `aktuellesQuartal`-Leser und **ohne erzwungenen
Config-Write** (read-only-User bekommen das korrekte Quartal ebenfalls). Der Quartals-Vergleich aus v2.158.0
bietet damit korrekt Q2 + Q1 an. Tests: [statistik.test.ts](src/plugins/auslastung/__tests__/statistik.test.ts).

### v2.158.0 — Statistik-Übersicht: Quartals-Vergleich (Delta-Overlay) (Juli 2026)

MINOR — Die Statistik-Übersicht im Auslastungs-Tab „Auslastung MA" zeigt weiterhin standardmäßig das
aktuelle Quartal, bietet aber jetzt ein Dropdown „Vergleichen mit" mit den **vergangenen Quartalen des
aktuellen Jahres** an. Wählt der User eines aus, wird es als dezentes **Delta-Overlay** eingeblendet — kein
zweiter Datenspeicher, nur ein zusätzlicher Aufruf der bereits reinen, per `quartal` parametrisierten
Aggregatoren.

- **Reiner Helper** `vergangeneQuartaleImJahr(aktuellesQuartal)` in [statistik.ts](src/plugins/auslastung/services/kapazitaet/statistik.ts):
  `2026-Q2 → ['2026-Q1']`, `2026-Q4 → ['2026-Q3','2026-Q2','2026-Q1']`, Q1/ungültig → `[]`.
- **Vergleichs-Statistik-Hook** [useVergleichStatistik.ts](src/plugins/auslastung/hooks/useVergleichStatistik.ts):
  ruft `computeQuartalsAuslastung` + `computeQuartalsStatistik` direkt für das gewählte Quartal auf (NICHT über
  den auf `aktuellesQuartal` gekeyten `cachedIndex` aus [useAuslastungIndex.ts](src/plugins/auslastung/hooks/useAuslastungIndex.ts)
  — der würde sonst thrashen). Kosten O(antraege) fallen nur bei aktivem Vergleich an.
- **UI**: Dropdown [StatistikVergleichControl.tsx](src/plugins/auslastung/views/uebersicht/StatistikVergleichControl.tsx)
  (shadcn-Select, nur gerendert wenn es frühere Quartale im Jahr gibt); Delta-Overlay in
  [HeadlineInsight.tsx](src/plugins/auslastung/views/uebersicht/HeadlineInsight.tsx) (zweite Balkenmarkierung +
  Referenz-/Δ-Zeile) und [KpiGrid.tsx](src/plugins/auslastung/views/uebersicht/KpiGrid.tsx)/[KpiCard.tsx](src/plugins/auslastung/views/uebersicht/KpiCard.tsx)
  (dezente `Q1: …`-Vergleichszeile je Karte). Abschnitts-Kopf zeigt bei aktivem Vergleich `2026-Q2 vs 2026-Q1`.
- **Caveat (bewusst)**: MA-Bestand + Kapazitäts-Config sind Ist-Zustand und werden rückwirkend angewandt
  (Näherung; `abgemeldet` ist quartalsgenau); ein vergangenes Quartal ist zu 100 % verstrichen → der Vergleich
  zeigt den End-Buchungsstand. Alles additiv — ohne gewähltes Vergleichsquartal ändert sich nichts.
- Tests: [statistik.test.ts](src/plugins/auslastung/__tests__/statistik.test.ts) (Helper + Vergangenheits-Quartal-Sanity).

### v2.157.1 — Bridge erkennt Generierungs-Ende im Auslastungs-Modul wieder (Juli 2026)

PATCH — Seit der Bridge-„Optimierung" für das Modul Anfragen (v2.134.1, `SETTLE_MS 2500→5000`) kam die
„Anträge mit LLM klassifizieren"-Antwort nicht mehr in der App an: die vollständige JSON-Antwort stand
sichtbar im KI-Tab, wurde aber nie zurückgesendet. Ursache + Fix in drei Schichten:

- **Bookmarklet — Ende an Inhalts-Stabilität statt DOM-Ruhe** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  `runRequest`): Der Finalisierungs-Timer hing an einem modul-weiten `lastDomActivity`, das ein
  MutationObserver auf den **gesamten** Streamlit-Container bei *jeder* DOM-Mutation zurücksetzte. Generierungs-
  unabhängige Churn der KI-Seite (Status-Widget, Reruns) hielt `idle` dauerhaft unter dem — seit v2.134.1
  strengeren — 5-s-Fenster → es wurde nie finalisiert (180-s-Hard-Cap bzw. 200-s-App-Timeout). Neu misst der
  Timer nur noch die **Inhalts-Stabilität der Antwort** (`lastContentChange`, zurückgesetzt bei echter
  Antwort-Änderung + laufendem `isRunning()` als Pausen-Schutz). `isRunning()` bleibt das Pausen-Signal.
- **Auslastungs-Caller gehärtet wie Anfragen** ([llm-klassifizierung.ts](src/plugins/auslastung/services/klassifizierung/llm-klassifizierung.ts),
  `klassifiziereBatch`): **Ping-Guard** vor dem Lauf (getrennte KI ⇒ sofort „Interne KI nicht erreichbar"
  statt Endlos-Spinner durch einen bookmarklet-losen Auto-Tab); **Chat-Reset je Versuch** (`safeResetChat`,
  keine `lastAssistant()`-Staleness über Batches); **bounded Retry** nur auf Parse-Fehler (Timeout/Abort werden
  NICHT retryt). Test [llm-klassifizierung.test.ts](src/plugins/auslastung/services/klassifizierung/__tests__/llm-klassifizierung.test.ts).
- **Button spiegelt Live-Status** ([LLMKlassifizierungButtons.tsx](src/plugins/auslastung/components/LLMKlassifizierungButtons.tsx)):
  bei explizit getrennter KI (`useBridgeStatus === 'disconnected'`) deaktiviert + Hinweis „Interne KI nicht
  verbunden" — nicht bei `'unknown'` (Boot); der Ping-Guard bleibt der Backstop.

> ⚠️ **Re-Install nötig:** Die Bookmarklet-Änderung wirkt erst nach **einmaligem Neu-Installieren** des
> Bridge-Bookmarklets im KI-Tab (Einstellungen → Streamlit-Bridge). Bis dahin läuft das alte Bookmarklet weiter.

### v2.157.0 — Auslastungs-Filter überleben die Session (Juli 2026)

MINOR — Die Filter-Segmente der Auslastungs-Tabs lagen bisher in reinem `useState` und gingen bei jedem
Reload verloren. Neu werden sie pro Tab in localStorage gehalten und beim nächsten Aufruf wieder angewandt
— und Segmente mit einem vom Standard abweichenden Wert klappen dabei automatisch auf, sodass der User
sieht „hier ist etwas gefiltert".

- **Neuer Helfer [filterPersistence.ts](src/plugins/auslastung/views/filterPersistence.ts)** — eine Heimat
  für die Filter-Persistenz des Moduls: safe `readJson`/`writeJson` (try/catch + defensive Enum-Validierung,
  Fallback auf Default bei Müll) und drei typisierte Read/Persist-Paare. Reine UI-Preference in localStorage
  (kein Varianten-Suffix, origin-weit wie `SPLIT_STORAGE_KEY`). Keys `tf-auslastung-{zuweisung,klassifizierung,maliste}-filters`.
- **Verdrahtet** in [ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx) (Kategorie/
  Antragstyp/Status/Sortierung), [KlassifizierungsReview.tsx](src/plugins/auslastung/views/KlassifizierungsReview.tsx)
  (Sicht-Filter/Kategorie/Antragstyp) und [MaListSection.tsx](src/plugins/auslastung/views/uebersicht/MaListSection.tsx)
  (Kategorie/Antragstyp/Inaktive-Toggle; die View-Umschaltung war schon persistiert): Lazy-Init aus dem Store,
  ein `useEffect` schreibt Änderungen zurück.
- **Kein Eingriff in `CollapsibleSeg`:** das Auto-Aufklappen bei `value !== defaultValue` existiert bereits;
  der Auf-/Zuklapp-Zustand (`manualClosed`) wird bewusst **nicht** persistiert (Reset beim Reload). Das
  „Sortiert nach"-Segment bleibt bewusst eingeklappt (`startCollapsed`) — Wert wird persistiert & angewandt,
  die eingeklappte Pille zeigt ihn ohnehin; eine Sortierung blendet keine Daten aus.
- **Härtung:** eine zwischenzeitlich entfernte Überkategorie wird beim Laden gegen `config.ueberKategorien`
  abgeglichen (Cold-Start-safe) und auf „Alle" zurückgesetzt, statt still 0 Ergebnisse zu filtern.
- Test [filter-persistence.test.ts](src/plugins/auslastung/__tests__/filter-persistence.test.ts).

### v2.156.1 — „Erzwungen neu prüfen" nur noch in dev + kurator (Juli 2026)

PATCH — Der ● CSV-Panel-Knopf „Erzwungen neu prüfen" (v2.155) ist ein Diagnose-/Kurations-Werkzeug und
verwirrte End-User in pl/as/prod. Er wird jetzt hinter `isKuratorMenusEnabled()` gegated
([CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx)) → sichtbar nur in dev + kurator,
weg in pl/as/prod. „Jetzt importieren" (bei neuen Exporten) + die Fixture-/Datei-fehlt-Warnzeilen bleiben in
allen Varianten.

### v2.156.0 — Leerer Unterprogramm-Store verwirft nicht mehr den ganzen Master-Import (Juli 2026)

MINOR (Bugfix + Härtung) — Root-Cause des Prod-Vorfalls „Import läuft durch, neue Anträge fehlen": Der
Master-Import baut aus den **aktiven** Unterprogramm-Codes eine Allowlist und verwirft jede Zeile, deren
`unterprogramm_id` (Spalte `FM_NUMMER`) nicht darin steht ([importer.ts](src/core/services/csv/importer.ts),
[unterprogrammRegistry.ts](src/core/services/csv/unterprogrammRegistry.ts) `getActiveUnterprogrammCodes`). Auf
Prod war der `unterprogramme`-Store nach dem Fixture-Vorfall **leer** → **leere Allowlist** → **jede** neue
Master-Zeile fiel durch → seit Tagen kamen 0 neue Anträge rein (Stand eingefroren), ohne Fehler. Dev (16 aktive
Codes) importierte normal.

- **Fix:** `getActiveUnterprogrammCodes` liefert bei **leerem** Store (`all.length === 0`) jetzt `null` =
  **kein Filter** (alles importieren) statt einer leeren, alles-verwerfenden Allowlist. „Nie konfiguriert" ≠
  „alle deaktiviert" — Letzteres (Einträge vorhanden, alle `aktiv:false`) bleibt bewusst Skip-all. Damit heilt
  sich eine Umgebung ohne kuratierte Unterprogramme beim nächsten Import selbst. Test `unterprogramm-registry.test.ts`.
- **Sichtbarkeit (gleiche Klasse wie v2.155):** der aufsummierte `skippedInactiveUnterprogramm`-Zähler wandert in
  den `RefreshReport` ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)), die
  `[data-update]`-Zeile und `localStorage.teamflow_last_data_update_timing` (`csv.skippedInactiveUnterprogramm`).
  >0 heißt: die Allowlist greift und schluckt Anträge — jetzt diagnostizierbar statt still.

### v2.155.0 — CSV-Auto-Refresh: still übersprungene Quellen sichtbar + erzwungener Re-Import (Juli 2026)

MINOR — Härtung gegen den „Import läuft durch, aber nichts kommt an"-Fall (Fixtures-Nachgang / Citrix-False-
Negative): der Auto-Refresh verwarf bisher drei Skip-Zustände **still** — Fixture-Quellen (`local_fixture`,
hart ausgeschlossen), unerreichbare Dateien (`file_missing`) und als „unverändert" erkannte Quellen
(`up_to_date`). Auf einem Produktions-pl konnte so eine Fehlkonfiguration (echte Exporte werden nie importiert)
als grünes „Aktuell" erscheinen, ohne Weg, den Erkennungs-Fast-Path zu umgehen.

- **`collectCandidates` meldet die verschluckten Zustände** ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)):
  `CollectResult` trägt jetzt zusätzlich `fixtures` / `fileMissing` / `upToDate` (bisher stillschweigend verworfen).
- **● CSV-Panel ist ehrlich** ([CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx)): In einem
  Prod-Build (`!isDevFixturesEnabled()`) ist der Punkt bei Fixture-/`file_missing`-Quellen **nicht mehr grün**,
  sondern rot mit Warn-Zeile („N Quelle(n) sind Demo-/Fixture-Quellen — vom Import ausgeschlossen"). Reine
  Entscheidungslogik ausgelagert nach [csv-freshness-state.ts](src/plugins/csv-sources-kuration/services/csv-freshness-state.ts)
  (`deriveCsvFreshnessState`), Test `csv-freshness-state.test.ts` (Regression: prod-Fixture ⇒ nie „fresh").
- **„Erzwungen neu prüfen"** im ● CSV-Dialog: neuer `forceRecheck`-Pfad
  ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts) `decideSourceUpdateState`/
  `checkSourceForUpdate`, durchgereicht via `collectCandidates` + `runDataUpdate`), der mtime/Größe/Checksum
  komplett umgeht → jede erreichbare, verknüpfte Quelle wird re-importiert (Importer difft per Row-Hash,
  schreibt nur bei echtem Delta). Selbstbedienungs-Weg für pl gegen einen Citrix-False-Negative, ohne kurator-
  Build. Fixtures/Permission bleiben ausgeschlossen. Test in `decide-source-update-state.test.ts`.
- **Diagnose ohne DevTools**: die `[data-update]`-Zeile + `localStorage.teamflow_last_data_update_timing` führen
  jetzt `skipped(fixtures/fileMissing/upToDate)` bzw. `csv.fixturesExcluded/fileMissing/upToDate`
  ([data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts) `logTiming`) — „warum wurde 0
  importiert" ist damit ablesbar.

### v2.154.0 — CSV-Schema-Konfiguration zwischen Umgebungen übertragbar (Export/Import) (Juli 2026)

MINOR — Neuer Weg, eine kuratierte CSV-Quellen-Konfiguration (Anzeige-Name, Spalten-Mapping **inkl.
Labels/Gruppen**, join_key, priority, encoding, separator) von einer Umgebung in eine andere zu übernehmen —
gedacht für den Fixture-Überschreib-Nachgang, bei dem Produktion falsche Namen + Teil-Mapping trägt, die
korrekte Konfiguration aber lokal liegt.

- Im CSV-Quellen-Detaildialog ([CsvSchemaDetailDialog.tsx](src/plugins/csv-sources-kuration/CsvSchemaDetailDialog.tsx))
  neuer Abschnitt „Konfiguration übertragen": **Exportieren** (JSON-Download) + **Importieren** (JSON-Datei).
- Der Import übernimmt Name + Mapping **in das bestehende Schema hinein** und **behält dessen ID** — keine
  Row-Hash-/Snapshot-Migration, kein Daten-Reset. Instanz-Felder (id, programm_id, created_at, source_file_name,
  Checksums, last_*) und das strukturelle `is_master` bleiben beim Ziel. Weil das Mapping danach neu ist, ist
  **ein** Re-Import nötig („CSV neu wählen") — Hinweis wird angezeigt.
- Reine Funktionen + Validierung in [schema-config-transfer.ts](src/plugins/csv-sources-kuration/services/schema-config-transfer.ts)
  (`buildSchemaConfigExport` / `parseSchemaConfig` / `applyConfigToSchema`, Kennung `teamflow-csv-schema-config` v1),
  Tests: `schema-config-transfer.test.ts`. Audit-Actions `csv_schema_config_exported` / `csv_schema_config_imported`.

### v2.153.2 — CSV-Status zeigt importierte Datei + Export-Datum pro Quelle (Juli 2026)

PATCH — Der Sidebar-CSV-Status (● CSV → Dialog „CSV-Datenimport") zeigte bisher nur den Zeitpunkt des
letzten Import-*Laufs*. Damit man sieht, ob wirklich der nächtliche Export eingelesen wurde, listet der Dialog
jetzt **pro Quelle**: Dateiname, **„Export vom …"** (Datei-mtime `source_last_modified`), Import-Zeitpunkt
(`last_imported_at`) und Zeilenzahl (`last_row_count`). Reine Anzeige vorhandener Schema-Felder in
[CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx) — kein Datenmodell-/Verhaltens-Change.
Das „Export vom"-Datum ist der Beleg, welche Datei-Version tatsächlich importiert wurde.

### v2.153.1 — CSV-Auto-Refresh: reine Zusatzspalten blockieren den Tages-Import nicht mehr (Juli 2026)

PATCH — Der tägliche automatische CSV-Import zeigte in kurator/pl/as jeden Morgen den blockierenden Dialog
„Auto-Refresh abgeschlossen — N Quellen brauchen deine Aufmerksamkeit" (z. B. „139/190 neue Spalten"),
sobald die echte CSV mehr Spalten hatte als im Schema gemappt. Ursache: `hasDrift()` blockierte bei **jeder**
nicht gemappten Zusatzspalte hart ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)
`continue`), obwohl der Importer solche Spalten ohnehin ignoriert — und nichts persistierte eine Auflösung,
also wiederholte es sich täglich (Nachwirkung des Fixture-Überschreib-Vorfalls v2.139/v2.140: die 2 Quellen
tragen ein unvollständiges, aus Fixtures konvertiertes Mapping).

- **Reine `newColumns`-Drift** (nichts fehlt, nur Zusatzspalten) wird im Auto-Refresh jetzt **headless als
  `{ ignore: true }` ins Schema übernommen** (`adoptNewColumnsAsIgnored` → reuse `mergeNewColumns`), dann
  normal importiert. Drift verschwindet dauerhaft (idempotent), kein Start-Modal. Audit: neue Action
  `csv_schema_columns_auto_ignored`. Nicht-blockierende Info-Zeile im Dialog (falls dieser aus anderem Grund
  öffnet).
- **`missingFromCsv > 0`** (eine gemappte Spalte verschwindet) bleibt **blockierend** (`report.drift` → Modal) —
  der gefährliche Fall, der echte Felder leeren kann.
- Neuer Klassifikator `isNewColumnsOnlyDrift` ([csv-drift-check.ts](src/plugins/csv-sources-kuration/services/csv-drift-check.ts)),
  Tests: `csv-drift-check.test.ts` (neu) + `new-column-mapping.test.ts` (Auto-Adopt + Drift-Idempotenz).
- **Ergänzend (Daten, einmalig durch Kurator/PL):** die 2 Quellen „Antragsbasis (Master)" / „Bewilligungsdetails"
  über „CSV neu wählen" sauber gegen den echten Export registrieren (Encoding Windows-1252), damit tatsächlich
  benötigte Felder gemappt sind statt nur ignoriert.

### v2.153.0 — Anfragen-Modul auch in pl + as verfügbar (Juni 2026)

MINOR — `features.anfragen` ist jetzt in den Varianten **pl** und **as** aktiv (vorher nur dev). Das
Workflow-Plugin „Anfragen" (id `anfragen`, `kuratorOnly:false`) erscheint damit in der pl- und as-Sidebar;
das Kuration-Pendant (`anfragen-kuration`, `category:'kuration'`) bleibt mangels Kurator-Menüs unsichtbar.
Reine Config-Änderung (`configs/pl.config.json` + `configs/as.config.json`). **Das Recall-Gate des
Anonymisierers gilt unverändert:** pl/as sind `variant:'production'` → der Skill bleibt `aktiv:false`, die
Anonymisierung zeigt „Skill nicht freigeschaltet", bis Thomas manuell freigibt (vgl. v2.152.1: dev-only
Runtime-Override). Aufnahme/Review/Wiedereinsetzung funktionieren auch ohne aktiven Skill.

### v2.152.1 — Anfragen: Anonymisierer in dev immer freigeschaltet (Gate nur Produktion) (Juni 2026)

PATCH — Der Anonymisierungs-Skill ist in **dev** (`isDevContext()`) jetzt immer freigeschaltet, sobald
er geladen ist — damit der Entwickler testen kann, ohne den geteilten Seed anzufassen. Das Recall-Gate
(`aktiv: true` erst nach manueller Freigabe) gilt unverändert für alle **Produktions-Varianten**
(prod/pl/kurator/as). Reiner Runtime-Override (`istAnonymisiererFreigeschaltet`, anonymisierung.ts); der
Seed bleibt `aktiv: false`. Die pure `istAnonymisiererAktiv`-Semantik (und ihr Gate für Produktion) ist
unverändert.

### v2.152.0 — Anfragen: Zwei-Stufen-Anonymisierung (Pseudonymisieren + Verallgemeinern) (Juni 2026)

MINOR — Die interne KI im Modul „Anfragen" trennt jetzt zwei Mechanismen in EINEM Lauf, damit der
externe ZIM-FAQ-Assistent den fachlichen Sinn behält (bisher schluckten opake `[SONSTIGES_N]`-Platzhalter
den Inhalt). Skill bleibt `aktiv: false` (Recall-Gate ausstehend — Freischaltung manuell durch Thomas).

- **Stufe A — Pseudonymisieren** (`mapping`, unverändert): harte Identifikatoren → `[TYP_N]`, werden
  wörtlich wiedereingesetzt.
- **Stufe B — Verallgemeinern** (`verallgemeinerungen`, NEU): beschreibender Freitext wird inline auf die
  fachliche Abstraktionsebene gehoben (Branche/Technologiefeld bleibt, Identität weg). Wird NIE
  wiedereingesetzt, hat keinen Platzhalter, verunreinigt `mapping` nicht. `verallgemeinerungen[].original`
  ist sensibel (nur lokal) — vom Convention-Guard `anfrage-no-mapping-in-transport` mitgeschützt.
- **Skill-Seed** auf Zwei-Stufen-Vertrag gehoben (`version: 2`, Entscheidungsregel im System-Prompt,
  JSON-Beispiel mit beiden Stufen). Parser parst `verallgemeinerungen` additiv-tolerant (fehlt → `[]`,
  Stufe-A-only bleibt gültig); `normalizeAnfrage` macht Alt-Records migrationssicher.
- **UI:** Verallgemeinerungs-Drawer (Original → Verallgemeinert) analog zum Mapping-Drawer; dezenter
  Platzhalter-Export-Hinweis („Diese Platzhalter müssen in der Antwort erhalten bleiben") + Kopier-Button.
- **AntwortView:** fehlende Platzhalter werden zur deutlichen Warnung verschärft (externe KI hat sie
  aufgelöst → kein Wiedereinsetzen); weicher Längen-Hinweis ab ~0,5 A4 (`MAX_ANTWORT_ZEICHEN = 1800`).

### v2.151.2 — App-weit: kein Schwarz/Weiß mehr in Aktiv-/Emphasis-Flächen (Juni 2026)

PATCH — Letzter Schliff: auch die übrigen schwarzen **Aktiv-/Emphasis-Flächen** tragen jetzt den
Profil-Akzent (`--tf-primary`) statt `--tf-text`. Body-Text + Hintergründe bleiben unverändert (Lesbarkeit).

- **Tab-Unterstriche → Akzent:** `ScopeTabs` (Förderanträge + Chat, `variant='tabs'`) und die generische
  `Tabs`-Komponente (Einstellungen-/Section-Nav) — aktiver Tab = `--tf-primary`-Text + `--tf-primary`-
  Unterstrich. Ebenso die hand-gebauten Tab-Leisten (SkillVerwaltung, SkillEditor, KalibrierungsReport)
  und der Reifegrad-Facet-Filter.
- **Badges/Kreise → Akzent:** `empfohlen`-Reifegrad-Badge + der Nummernkreis im Tweak-Editor
  (`bg-[var(--tf-primary)]` + weißer Text).
- **Progress + Step-Dots → Akzent:** `ProgressBar`, Onboarding-Step-Dots, CSV-Wizard- + Filter-Dialog-
  Step-Dots, CSV-Step4-Fortschrittsbalken.
- **Toggles/Inputs → Akzent:** der Regel-Switch (on-Zustand), der Thinking-Toggle (aktiv = Akzent-Light),
  Input-Focus-Border im Antrag-Autocomplete.
- **Guard `no-parallel-scope-tabs`** auf die neue Akzent-Signatur (`border-b-2 border-[var(--tf-primary)]`)
  umgestellt, damit hand-gebaute Unterstrich-Tabs weiter gefangen werden.

### v2.151.1 — App-weit: schwarz-aktive Pills + Segment-Toggles auf Akzent-Light (Juni 2026)

PATCH — Abschluss des Schwarz→Akzent-Durchgangs: alle verbliebenen **Selektions-Pills** und
**Segment-Toggles** mit schwarzem Aktiv-Zustand (`bg-[var(--tf-text)] text-[var(--tf-bg)]`) tragen jetzt
die **Akzent-Light**-Auswahl (`bg-[var(--tf-primary-light)]` + `text-[var(--tf-primary)]`) — konsistent mit
Suche/Auslastung/Alle-Felder und den `ScopeTabs`-Pills. Rein kosmetisch, keine Verhaltensänderung.

- **Filter-Pills:** ReviewPanel (Gutachten), ChangelogDialog (3×), DokumentAufnahme, DokumenteListe,
  dokument-review/FilterBar (inkl. Aktiv-Border → transparent), csv-sources (`PILL_ACTIVE` in NewColumnRow
  + RemapCsvColumnsDialog + Step1Metadata), AdminPanel (dev), FeedbackAnnotator (2×).
- **Segment-Toggles:** MarkdownEditor-View-Mode (2×), Schweregrad (RegelEditor), Modus
  (MusterErkennungEditor), Artefakt-Typ (WorkflowsTab), Abschnitte (StartDialog), Aufnahme-Zuordnung
  (AufnahmeZeile), Setup-StepDots (SetupWizard), Workflow-Stepper (neutrale Aktiv-Stufe).
- **Bewusst gelassen:** der `empfohlen`-Reifegrad-Badge (semantische Skala) + der dekorative
  Nummernkreis im Tweak-Editor; die `SegmentedToggle`-Komponente (Tabelle|Karten) war bereits
  neutral-weiß-aktiv (kein Schwarz).

### v2.151.0 — Auslastung-Modul: CTAs + Filter-Pills auf Profil-Akzent (Juni 2026)

MINOR — Fortsetzung von v2.150: das **Auslastungs-Modul** trug seine Primär-CTAs noch schwarz —
hier aber über **inline `style={{ background: 'var(--tf-text)' }}`** (nicht Tailwind-Klassen), weshalb
sie sowohl die v2.150-Migration als auch den `no-raw-cta-fill`-Guard umgingen. Jetzt durchgängig Akzent.

- **~19 inline-Style-CTAs → `<Button variant="primary">`** über das ganze Modul: „LLM-Klassifizierung
  starten", „Export (mit Kürzeln)" (Cockpit + Import/Export), „HTML generieren", „Mit Kürzeln (XLSX)",
  „+MA hinzufügen", „Corpus aufbauen", „Freigeben" (Klassifizierungs-/Verbund-Tabellen), „Zuweisen",
  „Speichern" (MA-Detail / Antragstyp-Override), Dialog-CTAs (Passwort, Zugang, Onboarding-/Kompetenz-
  Import inkl. Datei-Wähler als `<Button asChild><label>`), Setup-Wizard-Schritte, Kalibrierungs-Report.
  Inline-Style entfernt, `busy → loading`, Icons via `icon={…}`; co-lokalisierte Zweitaktionen → Outline.
- **Filter-Pills auf Akzent-Light** (Selektion, nicht gefüllter CTA-Akzent): die Status-Pills der
  Klassifizierungs-Review („Alle/Review nötig/LLM-Vorschlag/Freigegeben/Unvollständig") und die
  Förderanträge-„Alle Felder"-Tabs (`.af-tab.on`, [felder.css](src/plugins/antraege/alleFelder/felder.css))
  — `--tf-primary-light`-Fläche + `--tf-primary`-Text, wie die `ScopeTabs`-Pills (analog v2.150.1 Suche).
- **Guard `no-raw-cta-fill` gehärtet:** erkennt jetzt auch die **inline-Style**-Variante
  (`background:'var(--tf-text)',color:'var(--tf-bg)'`), nicht nur Tailwind-Klassen — schließt die
  Recall-Lücke, durch die die Auslastungs-Buttons durchrutschten.
- **Bewusst NICHT geändert:** Segment-Toggles (Tabelle|Karten, Manuell ▾, Setup-StepDots,
  Schweregrad/Modus/Artefakt-Typ), Kategorie-Chips (✓ IT/DT/…), Status-Badges, Confidence-Dots,
  Progress-Bars/Marker. Andere Module mit schwarz-aktiven Filter-Pills (ReviewPanel, ChangelogDialog,
  csv-sources, dokument-review, FeedbackAnnotator …) bleiben vorerst — separater App-weiter Sweep offen.

### v2.150.1 — Suche: Typ-Filter-Chips auf Akzent statt Schwarz (Juni 2026)

PATCH — Die Typ-Filter-Pillen auf der Suche-Seite („Alle · Förderanträge · Dokumente",
[SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx)) trugen im Aktiv-Zustand noch einen schwarzen Fill
(`bg-[var(--tf-text)]`) — hand-gebaut am kanonischen `ScopeTabs` vorbei. Jetzt die gleiche **Akzent-Light**-
Auswahl wie die `ScopeTabs`-Pills (Chat-Historie): `bg-[var(--tf-primary-light)]` + `--tf-primary`-Text.
Selektionszustand = subtiler Profil-Akzent (nicht der laute gefüllte CTA-Akzent — der bleibt Aktions-
Buttons vorbehalten). Border immer 0,5px (transparent wenn aktiv) → kein Größen-Sprung; `aria-pressed`
ergänzt. Andere hand-gebaute Segment-Toggles (Schweregrad, Modus, Artefakt-Typ) bleiben vorerst schwarz.

### v2.150.0 — CTA-Buttons app-weit auf die Profil-Primärfarbe (Juni 2026)

MINOR — Reiner Style-/Komponenten-Refactor, keine Verhaltensänderung. Die im Profil/Darstellung
wählbare **Primärfarbe `--tf-primary`** (Akzent) erschien bisher nur auf den CTAs, die schon die
kanonische `<Button>`-Komponente nutzten (z.B. Einstellungen). Viele Module bauten Primär-CTAs aber
hand-gebaut nach — entweder mit `bg-[var(--tf-text)]` (wirkte **schwarz** statt Akzent) oder roh mit
`bg-[var(--tf-primary)]` (Farbe ok, aber an der Komponente vorbei). Jetzt durchgängig über `<Button>`.

- **~70 hand-gebaute CTAs migriert** auf `<Button variant="primary|secondary|ghost">` aus
  `@/components/ui/button` (Vorbild: v2.149-Anfrage-Detail-Migration). Betroffen: Skill-/Workflow-/
  Regel-Verwaltung (`skill-verwaltung-kuration/`), Kurzfassung + Nachforderungen (lokale
  `BTN_PRIMARY`/`BTN_SECONDARY`-Klassen-Konstanten **entfernt**), Aufnahme + Gutachten-Batch,
  Anfragen-Einstellungen/Recall-Eval, Suche-Analyse-Dialog, `data-table/ColumnFilterDropdown`,
  `ErrorBoundary`, alle Feedback-Touchpoints (FAB-Panel, Sponsoring, FAQ, Tickets) und der
  Streamlit-Bookmarklet-Anker (`<Button asChild>`). `loading`-Prop ersetzt die `busy`-Text-Swaps,
  Icons via `icon={…}`.
- **DESIGN_GUIDE** „Button"-Tabelle korrigiert: Primary = `--tf-primary` (wählbarer Akzent) über
  `<Button>`, nicht mehr `--tf-text` (schwarz). Hand-gebaute gefüllte CTAs ausdrücklich verboten.
- **Neuer Convention-Guard `no-raw-cta-fill`** ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)):
  flaggt `bg-[var(--tf-text)]`/`bg-[var(--tf-primary)]`-Fill **mit** `hover:opacity` in `.tsx`. Die
  `hover:opacity`-Signatur trifft nur gefüllte Klick-CTAs — Toggle-Pills, Badges, Switch-Thumbs,
  Chat-Bubbles und der Vorschau-Chip (ohne `hover:opacity`) bleiben unberührt. Inline `// allow-cta-fill`.
- Bewusst NICHT migriert: die `.g-btn.primary`-Buttons der Gutachten-Werkstatt (scoped CSS, rendern
  bereits `var(--tf-primary)`).

### v2.149.1 — Feedback-Board: Status-Filter „Offen" als Default (Juni 2026)

PATCH — Öffentliches Board „Feedback Übersicht" ([FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)):
Status-Filter startet jetzt auf **„Offen"** statt „Alle" (offene Themen zuerst); der Chip ist dadurch
standardmäßig aufgeklappt (CollapsibleSeg expandiert bei `value ≠ defaultValue`). Die Auswahl des
Users wird in `localStorage` (`tf-feedback-board-status-filter`) gemerkt — wie schon Ansicht +
Kategorie-Collapse. Kein Datenmodell-Eingriff.

### v2.149.0 — Feedback: Archiviert-Filter + feinere Aufwand-Skala (Juni 2026)

MINOR — Zwei Verbesserungen im Kurator-Feedback-Modul (aus dem Board-Feedback).

- **Archivierte ausblenden:** Im Status-Filter gibt es jetzt einen eigenen Chip „Archiviert" plus
  eine Checkbox „Archivierte einblenden" ([FeedbackTicketList.tsx](src/plugins/feedback/sections/FeedbackTicketList.tsx)).
  Standardmäßig sind archivierte Tickets **überall ausgeblendet** — auch unter „Alle" (der „Alle"-Zähler
  zeigt entsprechend die nicht-archivierte Zahl). Die Checkbox blendet sie additiv in „Alle" ein
  (Preference in `localStorage`); der „Archiviert"-Chip zeigt gezielt nur die Archivierten, unabhängig
  von der Checkbox. Filter-/Zähler-Logik in [FeedbackAdminPage.tsx](src/plugins/feedback/FeedbackAdminPage.tsx)
  über `istArchiviert` (Pitfall #21, kein Literal-Vergleich).
- **Feinere Aufwand-Skala** (7 statt 4 Stufen): `XS=2h, S=4h, M=8h, L=2 Tage, XL=4 Tage, XXL=1 Woche,
  Epic=>2 Wochen` ([feedback.ts](src/core/types/feedback.ts)). Neuer geordneter Export `EFFORT_ORDER`
  ersetzt die hartkodierten Stufen-Arrays in Aufwand-Dropdown + Sponsoring-Schwellen-Editor (DRY).
  `EFFORT_HOURS` / `EFFORT_LABELS` / `EFFORT_SHORT_LABELS` / `DEFAULT_SPONSORING_THRESHOLDS` entsprechend
  erweitert (`Record<EffortEstimate, …>` erzwingt Vollständigkeit). **Keine Daten-Migration** — die
  Codes `S/M/L/XL` bleiben gültig; Anzeige-Labels werden am Render-Punkt abgeleitet.

### v2.148.0 — Konventions-Guard `no-parallel-scope-tabs` (Layout-Schicht Phase 5) (Juni 2026)

MINOR (test-only) — Drift-Schutz: verhindert, dass unterstrichene Listen-Sicht-Tabs außerhalb
des `ScopeTabs`-Primitivs neu hand-gebaut werden.

- **Neuer Guard** `no-parallel-scope-tabs` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)):
  scannt `.tsx` auf die kanonische Aktiv-Tab-Signatur `border-b-2 border-[var(--tf-text)]` außerhalb
  von `ScopeTabs.tsx`. `@/components/ui/tabs` (Inline-Style-Border) trifft das Muster nicht.
- **Grandfatherte Bestands-Tabs** (außerhalb des schlanken Umfangs, Migration später):
  `SkillVerwaltungPage.tsx` (gezählte Tabs, ScopeTabs-Kandidat) + `SkillEditor.tsx` (2-Tab-Nav mit
  Border-Container, anderes Muster) — per Pfad-Allowlist, dokumentiert in
  [docs/layout-audit.md](docs/layout-audit.md). Echte Ausnahme weiter über `// allow-scope-tabs`.
- `MAX_FILE_LOC` 1095→1135 (Guard-Zuwachs in der Aggregator-Datei).

### v2.147.0 — PageHeader / StatusDot / FilterChip adoptiert (Layout-Schicht Phase 4) (Juni 2026)

MINOR — Drei byte-invariante Umstellungen auf die neuen Primitive (gleiches Aussehen, jetzt aus
der Schicht). Stellen, die nicht 1:1 invariant wären, bewusst aufgeschoben (dokumentiert in
[docs/layout-audit.md](docs/layout-audit.md) → „Adoptions-Status").

- **PageHeader** ← Förderanträge-Titel ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx))
  — exakter Match (gleiche Wrapper-/H1-Klassen, Meta-Slot für die Bearbeiter-Filter-Pill).
- **StatusDot** ← [StatusDotRow.tsx](src/plugins/antraege/StatusDotRow.tsx) (Farbe weiter via
  `getStatusCategoryColor()`; `title`/`ariaLabel` erhalten).
- **FilterChip** ← [ActiveFilterChips.tsx](src/plugins/antraege/filter/ActiveFilterChips.tsx).
- **Bewusst nicht adoptiert:** PageHeader an Auslastung/Einstellungen (abweichendes
  `leading`/`tracking`/`gap` → nicht invariant) und StatusBadge (keine byte-invariante Fundstelle;
  `StatusBarRow` rendert Balken, `KategoriePill` ist reicher). Beide stehen bereit/smoke-getestet.

### v2.146.0 — ScopeTabs-Konsolidierung: Förderanträge-Tabs + Chat-Pills (Layout-Schicht Phase 3) (Juni 2026)

MINOR — Die zwei driftenden „Listen-Sichten-mit-Zähler"-Implementierungen laufen jetzt durch
das geteilte `ScopeTabs`-Primitiv. Förderanträge ist klassen-identisch (struktureller No-op);
die Chat-Filter sind die **eine bewusste** Konsistenz-Änderung (waren schon Pills, jetzt aus
einem Bauteil).

- **Förderanträge-Header-Tabs** ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx)):
  Inline-`<button>`-Render → `ScopeTabs variant='tabs'`. Gleiche View-Counts (`de-DE`), gleiche
  Klassen → visuell identisch.
- **Chat-Historie-Filter** ([ConversationSidebar.tsx](src/plugins/chat/components/ConversationSidebar.tsx)):
  `sf-chip`-Buttons → `ScopeTabs variant='pills'`. `counts` aus `groupConversations` unverändert.
  Die nun ungenutzten `.sf-chip`/`.sf-n`-Regeln aus [chat.css](src/plugins/chat/chat.css) entfernt
  (Pill-Styles leben jetzt im Primitiv).
- Regressions-Anker (Tabs/Counts/Gruppierung) blieben unverändert grün.

### v2.145.0 — Vier fehlende Layout-Primitive (Layout-Schicht Phase 2) (Juni 2026)

MINOR — Additive, domänenfreie Primitive in `src/components/ui/`; noch **keine** Modul-
Umstellung (die kommt in Phase 3/4). Ergänzen die bereits bestehende Schicht
(MasterDetailLayout, SortableTable, SectionHeader, tabs, button, badge).

- **[PageHeader.tsx](src/components/ui/PageHeader.tsx)** — großer Seitentitel + optionale
  Meta-Zeile / Aktionen (aus den hand-rolled H1s destilliert).
- **[StatusBadge.tsx](src/components/ui/StatusBadge.tsx)** — `StatusBadge` (Pill) + `StatusDot`
  (farbiger Punkt). Farbe kommt immer vom Aufrufer — keine Status-Domänenlogik in der Schicht.
- **[FilterChip.tsx](src/components/ui/FilterChip.tsx)** — abgerundeter „Label: Wert"-Chip,
  optional entfernbar (aus `ActiveFilterChips` destilliert).
- **[ScopeTabs.tsx](src/components/ui/ScopeTabs.tsx)** — Listen-Sicht-Tabs mit Zähler,
  `variant: 'tabs' | 'pills'` (breit/unterstrichen = Förderanträge · kompakt = Chat). EIN
  Bauteil, zwei Darstellungen; Abgrenzung zu `ui/tabs.tsx` (generische Navigation).
- Smoke-Tests ([layout-primitives.test.ts](src/components/ui/__tests__/layout-primitives.test.ts)):
  Render via `renderToStaticMarkup` (node-Env), `variant` schaltet die Darstellung, Token-Klassen.

### v2.144.0 — CTA-Primärfarbe gekoppelt + Kontrast-Guard (Layout-Schicht Phase 1) (Juni 2026)

MINOR — Erster Schritt der schlanken Layout-Schicht ([docs/layout-audit.md](docs/layout-audit.md)):
der Default-Button (CTA) trägt jetzt die **gewählte Primärfarbe** statt anthrazit. Additiv,
keine Migration.

- **Token-Fix** ([src/theme.css](src/theme.css)): `--primary` von `var(--tf-text)` auf
  `var(--tf-primary)` umgestellt — `bg-primary`/`text-primary` (Default-CTA, `link`-Button,
  `switch`-checked, `slider`-range) erben damit die User-Farbe. CTA-Vordergrund über neues
  `--tf-on-primary: #fff` (bewusst **ohne** Dark-Flip — anders als `--tf-primary-foreground`,
  das im Dark-Block auf `--tf-bg` kippt und u.a. in `Step2KindFilterToggle` genutzt wird).
  `--tf-primary` wird im Dark-Block nicht aufgehellt → Weiß ist in beiden Modes kontrastsicher.
- **Bernstein-Preset** ([src/components/ui/theme.ts](src/components/ui/theme.ts)): `l` von 42 % auf
  40 % gesenkt — einziges Preset unter 4,5:1 gegen Weiß (4,21:1 → 4,58:1).
- **Kontrast-Guard** `preset-contrast-contract` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)):
  rechnet je `PRESET_COLORS`-Preset HSL→sRGB→relative Luminanz→WCAG-Kontrast gegen `#fff` und
  erzwingt ≥ 4,5:1 — verhindert, dass ein künftig zu helles Preset den weißen CTA-Text bricht.

### v2.143.0 — Sidebar-Status „CSV-Import aktuell?" + Import-Modal (Juni 2026)

MINOR — Dritter Status-Indikator unten links in der Sidebar (neben **● Sync** und **● KI**),
der den Stand der täglichen Legacy-CSV-Exporte gegen den importierten Datenbestand zeigt.
Additiv, keine Migration; nur in Import-Rollen (pl/kurator/dev) sichtbar.

- **Neuer Indikator** ([CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx)):
  Punkt+Wort „● CSV" im Muster von [BridgeStatusIndicator.tsx](src/components/ui/BridgeStatusIndicator.tsx).
  **Grün** = alle verknüpften Exporte importiert · **rot** = es gibt neuere/geänderte Exporte ·
  **grau** = nicht prüfbar (offline / Ordner nicht verknüpft / vor dem ersten Check) ·
  **amber+pulse** = Import läuft.
- **Inhaltsbasierte Erkennung**: Wiederverwendung von `collectCandidates`
  ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)) — Checksumme +
  Größen-Guard, derselbe Pfad wie „Jetzt aktualisieren". Kein Kalendertag-Vergleich (Datei-mtime
  über SMB unzuverlässig, vgl. v2.137.1). Die nur am Wochenende exportierte Projektbeschreibungs-
  Quelle braucht **keinen** Sonderfall: sie zählt nur als „neuer", wenn ihr Inhalt sich wirklich
  geändert hat — ein älterer, unveränderter Stand bleibt grün.
- **Klick → Detail-Dialog** (analog „Interne KI"): Status, „Letzter CSV-Import" (jüngstes
  `last_imported_at`), Liste der betroffenen Quellen, **„Jetzt importieren"** (`runDataUpdate` —
  exakt der Einstellungen-Pfad, via [useAsyncAction](src/core/hooks/useAsyncAction.ts), Pitfall #15)
  und „Zu den Einstellungen".
- Hintergrund-Check ohne Permission-Prompt (`collectCandidates` nutzt nur `queryPermission`);
  re-prüft beim Start-Pass-`done`, bei SMB-online und auf jedes `csvSourcesSignal` (nach Import,
  Ordner-Verknüpfen, Snapshot-Sync). Verdrahtet in [ShellLayout.tsx](src/core/ShellLayout.tsx).

### v2.142.0 — Anfrage-Detail „Layout A": Vorher/Nachher-Zwei-Spalten (Juni 2026)

MINOR — Umsetzung des Claude-Design-Handoffs (`_design/handoff/Anfragen`): die Detailansicht
einer Anfrage ([AnfrageDetail.tsx](src/plugins/anfragen/AnfrageDetail.tsx)) wird von vertikal
gestapelten Blöcken auf ein **Zwei-Spalten-Vorher/Nachher**-Layout umgebaut. Additiv, keine
Migration; sämtliche Funktion (Live-Export-Guard, editierbarer Anon-Text, Finalisierung, mailto)
bleibt erhalten.

- **Stepper als View-Umschalter** ([AnfrageStepper.tsx](src/plugins/anfragen/AnfrageStepper.tsx)):
  Schritte 1–3 zeigen Paar 1 (Original ↔ Anonymisiert), 4–5 Paar 2 (Anonyme Antwort ↔ Finale
  Antwort). Echter Pipeline-Status bleibt am `active`-Schritt; die gezeigte View bekommt eine
  zusätzliche `viewing`-Markierung.
- **View 1** ([AnonymisierungView.tsx](src/plugins/anfragen/AnonymisierungView.tsx), absorbiert
  `AnfrageAnonymisierung` + `ReviewEditor`): Original mit PII amber, anonymisierter Text editierbar
  mit Platzhaltern blau + Live-Leaks rot; Badge „Keine PII"/„… PII-Treffer" vom Guard getrieben;
  Mapping-Lade (mit „Alias"-Badge bei doppeltem Platzhalter); Actbar Kopieren/FAQ-öffnen/Erneut.
- **View 2** ([AntwortView.tsx](src/plugins/anfragen/AntwortView.tsx), absorbiert
  `RueckimportFinalisierung` + `FinaleAntwortAusgabe`): Antwort-Textarea ↔ Live-de-anonymisierte
  Finale (eingesetzte Originale blau); Warnzeile für fehlende/unbekannte Platzhalter; „Antwort
  übernehmen" konsolidiert in On-blur-Persist (Status monoton).
- **Gemeinsam resizable Panes** ([useSyncedPaneHeight.ts](src/plugins/anfragen/useSyncedPaneHeight.ts),
  ein Höhen-State zieht beide Spalten, persistiert), **Synchron-Scrollen** + **Untereinander**-Stack,
  **Hervorheben**-Schalter (geteilt). Mehr-Art-Highlight additiv in
  [highlight.ts](src/plugins/anfragen/highlight.ts) (`buildKindedSegments`, Prioritäts-Merge) +
  [HighlightedText.tsx](src/plugins/anfragen/HighlightedText.tsx); Finale-Segmente via
  `wiedereinsetzenSegmente`. Co-located Scoped CSS
  [anonymisierung-detail.css](src/plugins/anfragen/anonymisierung-detail.css) (nur `--tf-*`-Tokens,
  Dark-Mode flippt).

### v2.141.0 — Anfragen: UI-Parität mit Förderanträgen (Ansichten, Collapse, Löschen) (Juni 2026)

MINOR — das Anfragen-Modul ([src/plugins/anfragen/](src/plugins/anfragen/), dev) übernimmt
die Layout-Patterns der Förderanträge für mehr Konsistenz. Additiv, keine Migration.

- **Drei Ansichten** Liste/Tabelle/Karten über einen store-agnostischen, jetzt geteilten
  `ViewModeToggle` ([src/components/ui/ViewModeToggle.tsx](src/components/ui/ViewModeToggle.tsx) —
  promoviert aus der Skill-Verwaltung, die per dünnem Re-Export unverändert weiterläuft).
  `viewMode` persistiert pro Browser (localStorage). Tabelle nutzt den generischen
  `SortableTable` ([AnfrageTabelle.tsx](src/plugins/anfragen/AnfrageTabelle.tsx)), Karten ein
  Tile-Grid ([AnfrageKarten.tsx](src/plugins/anfragen/AnfrageKarten.tsx)).
- **Collapse-to-Rail**: `MasterDetailLayout` ([src/components/master-detail/MasterDetailLayout.tsx](src/components/master-detail/MasterDetailLayout.tsx))
  bekommt opt-in `collapsible`/`listCollapsedKey`/`collapsedRailLabel` + Render-Funktions-`list`
  (Collapse-API). Default aus → die 4 anderen Konsumenten bleiben unverändert. Im schmalen
  Sidebar-Modus wird die Listenansicht erzwungen.
- **Prominenter Status** als farbiger Badge (Fortschritt-Semantik, `STATUS_VARIANT` in
  [status.ts](src/plugins/anfragen/status.ts)) im Detail-Header und in allen Listen-Ansichten.
- **Löschen** im Detail-Header und als Zeilen-/Karten-Hover-Aktion über die wiederverwendbare
  [AnfrageDeleteControl.tsx](src/plugins/anfragen/AnfrageDeleteControl.tsx) (Inline-Zwei-Schritt-
  Bestätigung, `useAsyncAction`).
- **Einklappbare Detail-Abschnitte** (Stammdaten/Mailtext/Anonymisierung/Antwort) über die um
  ein optionales `storageKey` (Persistenz) erweiterte
  [CollapsibleSection.tsx](src/components/ui/CollapsibleSection.tsx).

### v2.140.1 — Snapshot-Write schließt Fixture-Quellen aus (Defense-in-depth) (Juni 2026)

PATCH — schließt die Lücke, durch die der Fixture-Vorfall überhaupt entstehen konnte.
**Ursache des Vorfalls:** Ein versehentlich gegen den echten Share geöffneter **Dev-Build**
(nur dort `demoDataBundled: true`) auto-seedet die `fixture-real-*`-Demo-Quellen; der
nächste Snapshot-Write serialisierte den **gesamten** Schema-Store ([snapshot.ts](src/core/services/csv/snapshot.ts))
inkl. dieser Fixtures auf den Share → überschrieb die echten Quellen → alle pl/kurator-
Rechner zogen sich den Demo-Snapshot. (Build-Zeit-Schutz gegen `demoDataBundled` auf
`production` gibt es, aber keinen Laufzeit-Schutz am Publish-Boundary.)

- **Fix:** `loadSmallStoreData` (Choke-Point für Voll- UND Delta-Write) filtert
  `fixture-real-*`-Schemas (`isFixtureSchemaId`) aus dem publizierten Snapshot — Demo-Daten
  gelangen nie auf den Share; der lokale Dev-Store behält die Fixtures.
- Regressions-Test [snapshot-fixture-exclusion.test.ts](src/core/services/csv/__tests__/snapshot-fixture-exclusion.test.ts):
  echtes + Fixture-Schema → publizierte `csv_schemas.jsonl` enthält nur das echte.

### v2.140.0 — CSV-Kuration: „Demo-Quelle → echte Quelle umwandeln" (Juni 2026)

MINOR — Abschluss der Fixture-Härtung: ein Kurator kann eine fälschlich auf einem
Produktiv-Share gelandete Demo-/Fixture-Quelle (`fixture-real-*`) in eine echte Quelle
umwandeln, **ohne neu zu mappen**.

- **Button „In echte Quellen umwandeln (Mapping bleibt)"** im roten Fixture-Banner der
  CSV-Sources-Seite ([CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx)).
  Wandelt alle `fixture-real-*`-Quellen um: `column_mapping`/`join_key`/`priority`/`is_master`/
  `encoding`/`separator` bleiben erhalten, es gibt eine neue **Nicht-Fixture-ID** (vom
  Quellnamen abgeleitet, slugifiziert, kollisionssicher), der Import-Zustand wird zurückgesetzt.
  Danach läuft der Auto-Refresh für diese Quellen normal; die echten CSVs spielt man via
  „CSV neu wählen"/Auto-Refresh ein, dann „Antrags-Daten zurücksetzen".
- Logik in [convert-fixture-source.ts](src/plugins/csv-sources-kuration/services/convert-fixture-source.ts)
  (`deriveRealSchemaId` / `buildRealSchemaFromFixture` / `convertAllFixtureSources`), TDD-getestet
  inkl. der Endlosschleifen-Falle (ein Quellname, der selbst zu `fixture-real-…` slugifiziert,
  bekommt einen `q-`-Präfix vor der Kollisions-Schleife). Audit-Event `csv_fixture_converted`.

### v2.139.0 — CSV-Kuration: Encoding-Wahl im Re-Import + Warnung bei Demo-/Fixture-Quellen (Juni 2026)

MINOR — zwei Härtungen aus dem „Produktion lief unbemerkt auf Demo-Fixtures"-Vorfall
(echte Legacy-CSVs wurden nie importiert, weil nur `fixture-real-*`-Quellen registriert
waren — die sind per `isFixtureSchemaId` vom Auto-Refresh ausgeschlossen).

- **Encoding-Selektor im „CSV neu wählen"-Dialog** ([CsvSourceReimportDialog.tsx](src/plugins/csv-sources-kuration/CsvSourceReimportDialog.tsx)):
  bisher las der Re-Import stur mit dem **gespeicherten** `schema.encoding` (oft UTF-8) →
  Windows-1252-Umlaute wurden zu `�`. Jetzt: Dropdown UTF-8 / Windows-1252 **plus
  Auto-Erkennung** (`readWithEncodingFallback`) — weicht das erkannte Encoding vom Schema
  ab, wird die Auswahl einmalig automatisch korrigiert und ein Hinweis gezeigt. Die Wahl
  fließt als `encodingOverride` in den Import **und** wird aufs Schema persistiert
  (`persistCsvSourceMeta` schreibt `encoding` mit), damit der nächste Auto-Refresh dieselbe
  Kodierung nutzt. Die Header-Validierung re-läuft bei jedem Encoding-Wechsel.
- **Warn-Banner bei Fixture-Quellen** ([CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx)):
  in einem Nicht-Dev-Build (`!isDevFixturesEnabled()`) mit registrierten `fixture-real-*`-
  Quellen erscheint ein rotes Banner („Nur Demo-/Fixture-Quellen … echte CSV-Exporte werden
  nie importiert"). Entscheidung in der getesteten Pure-Funktion
  [`fixtureSourceWarning`](src/plugins/csv-sources-kuration/services/fixture-source-warning.ts)
  (allFixtures vs. gemischt). Hätte den Vorfall sofort sichtbar gemacht.

### v2.138.0 — Einstellungen/Speicher: „Letzter CSV-Import" mit Datum/Uhrzeit (Juni 2026)

MINOR — die Datenaktualisierung-Sektion (Einstellungen → Speicher) zeigt jetzt, von
wann die CSV-Daten stammen, damit der User sofort sieht, ob er auf aktuellen Daten
arbeitet.

- **Neue Info-Zeile „Letzter CSV-Import: <Datum, Uhrzeit>"** unter der Datenaktualisierung-
  Beschreibung ([SpeicherTab.tsx](src/plugins/einstellungen/SpeicherTab.tsx)). Quelle ist
  das jüngste `last_imported_at` über alle CSV-Schemas (ISO-Strings sortieren chronologisch);
  Format wie anderswo via `toLocaleString('de-DE')`.
- **Live nach „Jetzt aktualisieren"**: nach einem manuellen Update werden die Schemas neu
  eingelesen, sodass der Zeitstempel ohne Browser-Reload stimmt.
- Sichtbar in dev/pl/kurator (wo CSV-Schemas geladen werden); in prod ohne CSV-Import bleibt
  die Zeile aus. Ergänzt den Erkennungs-Fix aus v2.137.1 um die nötige Sichtbarkeit.

### v2.137.1 — CSV-Auto-Refresh: stille Nicht-Erkennung geänderter Quellen auf Citrix behoben (Juni 2026)

PATCH — eine nächtlich aktualisierte CSV-Quelle wurde auf einem Citrix-Produktivrechner
(pl-Variante) nicht als „neu importieren" erkannt; auf einem Dev-Laptop mit demselben
Build funktionierte es. Ursache + Fix:

- **Root Cause**: `decideSourceUpdateState` ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts))
  schloss über einen reinen mtime-Fast-Path (`file.lastModified <= source_last_modified`)
  zu `up_to_date` kurz — **ohne den Inhalt zu lesen**. Die Baseline `source_last_modified`
  reist (nicht-portabel) per Snapshot zu den pl-Rechnern; trägt die nächtlich neu
  geschriebene CSV über SMB/Citrix eine mtime, die die Baseline nicht überschreitet
  (Timestamp-Preserve, Uhr-Skew, Metadaten-Cache), verschluckte der Fast-Path die
  Inhaltsänderung still. Der bestehende „Cold-Start"-Fix adressierte nur die
  False-Positive-Richtung; die False-Negative-Richtung blieb offen. Auf dem Laptop
  erzwangen die frisch kopierten Dateien / die fehlende Baseline den Hash-Pfad → erkannt.
- **Fix — Size-Guard**: neues Schema-Feld `CsvSchema.last_file_size` (`File.size`, Byte;
  **portabel** wie `file_checksum`, reist im Snapshot mit). Der billige Skip greift jetzt
  nur noch bei `mtime <= Baseline` **UND** unveränderter Byte-Größe; bei abweichender
  (oder unbekannter) Größe fällt der Pfad in den autoritativen `file_checksum`-Vergleich.
  Eine stale/nicht-fortgeschrittene mtime kann eine Inhaltsänderung damit nicht mehr
  verstecken. `last_file_size` wird überall gestempelt, wo `source_last_modified` gesetzt
  wird (Import, Auto-Refresh, Reselect). Alt-Schemas ohne Feld fallen einmalig in den
  Hash-Pfad und heilen mit dem nächsten Import. Rest-Blindfleck (bewusst): identische
  Byte-Größe + geänderter Inhalt + stale mtime.
- **Sofort-Workaround (bis Deploy)**: auf dem betroffenen Rechner „CSV neu wählen" /
  Force-Import überspringt den mtime-Pfad und importiert die aktuellen Daten direkt.
- Regressions-Tests in [decide-source-update-state.test.ts](src/plugins/csv-sources-kuration/__tests__/decide-source-update-state.test.ts)
  (mtime ≤ Baseline + geänderte Größe ⇒ `update_available`) + Übergangsfall ohne Baseline.

### v2.137.0 — Anfragen: Kuration-Seite „Anfragen" + team-weit editierbare ZIM-FAQ-Assistent-URL (Juni 2026)

MINOR — neue Kuration-Seite zum Pflegen der Anfragen-Modul-Einstellungen, plus
Konsolidierung der URL-Default-Literale.

- **Neuer Sidebar-Punkt „Anfragen" unter Kuration** (Plugin `anfragen-kuration`,
  `category: 'kuration'`, `kuratorOnly: true`, `featureFlag: 'anfragen'`, Route
  `/kuration/anfragen`) — sichtbar in dev/kurator nach dem Kurator-Toggle, nur wenn
  das Anfragen-Modul aktiv ist.
- **ZIM-FAQ-Assistent-URL im GUI editierbar**: Settings-Seite im Stil von
  Einstellungen/Profil (`SectionHeader` + URL-Feld + Speichern/Auf-Standard-
  zurücksetzen), bewusst erweiterbar für künftige Anfragen-Einstellungen.
- **Persistenz team-weit auf dem Daten-Share**: Sidecar `_intern/anfragen-settings.json`
  (idempotent-overwrite via `atomicWrite`, kurator-gated über `requireOnline()` +
  `canWriteDatenShare()`, Audit-Event `anfragen_settings_updated`). Mirror, nicht
  Master: Auflösung **GUI-Override → IDB-Cache → Build-Default**, bleibt offline über
  den Fallback funktional. Der Export-Link im Review liest die URL jetzt override-aware.
- **Default-Konsolidierung**: die ZIM-FAQ-Assistent-URL hat als Code-Default jetzt
  EINE Quelle (`DEFAULT_ANFRAGEN_DASHBOARD_URL` in `feature-flags.ts`);
  `scripts/config-schema.mjs` trägt sie nicht mehr doppelt (nur noch optionaler
  Per-Variant-Override-Slot, `null` = Default). Interne Bezeichner unverändert.

Neue Dateien `src/plugins/anfragen/settings.ts` + `AnfragenEinstellungenPage.tsx`;
Plugin-Def + Registrierung in `plugins.config.ts`; angepasst `ReviewEditor.tsx`,
`feature-flags.ts`, `config-schema.mjs`, `docs/architecture/data-layout.md`. Keine
Migration (der Sidecar wird beim ersten Speichern angelegt).

### v2.136.3 — Anfragen: Recall-Eval-Panel startet eingeklappt (Juni 2026)

PATCH — das dev-only Recall-Eval-Panel (`AnfrageRecallEval`) startet jetzt **eingeklappt**
statt offen (`useState(false)`). Sauberere Startseite; das Panel wird erst bei Bedarf per
Chevron aufgeklappt. Verhalten sonst unverändert (Chevron, Card, „Recall-Eval starten").

### v2.136.2 — Anfragen: flachere Drop-Zone + Umbenennung „ZIM-Dashboard" → „ZIM FAQ-Assistent" (Juni 2026)

PATCH — zwei UX-/Wording-Tweaks im Anfragen-Modul, keine Verhaltens-/Datenänderung.

- **Drop-Zone flacher**: die `.msg`-Aufnahmefläche frisst weniger vertikalen Platz
  (`p-8` → `px-6 py-4`, Mail-Icon 20 → 18 px). Dafür hat `FileDropZone` jetzt einen
  optionalen `padding`-Prop (Default `p-8` — die anderen drei Aufrufer Dokumente/Anträge
  bleiben unverändert); nur der Anfragen-Aufruf nutzt die kompakte Variante.
- **„ZIM-Dashboard" → „ZIM FAQ-Assistent"**: das externe Claude-Artifact heißt in der UI
  jetzt „ZIM FAQ-Assistent" — Export-Button (`Kopieren & ZIM FAQ-Assistent öffnen`),
  Button-Tooltip und der Rückimport-Placeholder. Die internen Bezeichner
  (`anfragen.dashboardUrl`, `getAnfragenDashboardUrl`) bleiben unverändert (kein
  Config-/API-Bruch); aktive Doc-Kommentare wurden mitgezogen.

Die URL des Assistenten ist und bleibt ein Konfigwert: Default in `scripts/config-schema.mjs`
(`anfragen.dashboardUrl`, genutzt von `npm run dev`) + Fallback in `src/config/feature-flags.ts`
(`getAnfragenDashboardUrl`); pro Build-Variante via `anfragen.dashboardUrl` in der jeweiligen
`configs/*.config.json` überschreibbar.

Betrifft `src/components/ui/FileDropZone.tsx`, `src/plugins/anfragen/AnfrageAufnahme.tsx`,
`src/plugins/anfragen/ReviewEditor.tsx`, `src/plugins/anfragen/RueckimportFinalisierung.tsx`
+ Doc-Kommentare in den Config-/Schema-Dateien. Keine Migration.

### v2.136.1 — Anfragen: Recall-Eval einklappbar + Tooltip in der E-Mail-Liste (Juni 2026)

PATCH — zwei kleine UX-Tweaks im Anfragen-Modul, keine Verhaltens-/Datenänderung.

- **Recall-Eval-Panel (dev) klar einklappbar**: das native `<details>` (unauffällige
  Aufklapp-Marke) ist jetzt ein design-konsistenter Collapse mit rotierendem Chevron
  (gleiches Pattern wie `CollapsibleSection`), Card-Rahmen + Flask-Icon bleiben. Der lange
  Recall-Report lässt sich nach dem Lauf bewusst wegklappen, statt die Master-Detail-Ansicht
  nach unten zu drücken. Default offen; „Recall-Eval starten" unverändert über `useAsyncAction`.
- **Voller Betreff/Absender bei Hover**: in der Anfragen-Master-Liste tragen die trunkierten
  Betreff- und Absender-Zeilen jetzt ein natives `title`-Attribut — bei schmaler Spalte ist
  der vollständige Titel per Mouse-Over lesbar (etabliertes Codebase-Pattern, kein Tooltip-Bundle).

Betrifft `src/plugins/anfragen/AnfrageRecallEval.tsx`, `src/plugins/anfragen/AnfrageListe.tsx`.
Keine Migration.

### v2.136.0 — Sidebar-Statusleiste „Variante D": Punkt + Wort (Juni 2026)

MINOR — Redesign der unteren Sidebar-Statusleiste nach Design-Handoff
(`_design/handoff/sidebar-status-bar/`). Die beiden icon-only Zustände (Bot / Database)
waren nicht selbsterklärend — der Nutzer musste jedes Mal den Tooltip aufrufen.

- **Jeder Zustand jetzt als farbiger Punkt + kurzes Wort** (`● Sync`, `● KI`) statt Icon —
  sofort lesbar, kein Tooltip nötig. Das Wort bleibt neutral, nur der 7-px-Punkt trägt die
  Live-Status-Farbe. Reihenfolge: `Neu hier?` · `● Sync` · `● KI` · `Version`.
- **Schmaler Zustand**: wird die ausgeklappte Sidebar unter 200 px gezogen (Power-User),
  entfällt „Neu hier?" komplett; der Platz geht an Status + Version (Version rechtsbündig).
- **„Getrennt" jetzt amber statt rot** (handlungsbarer Zustand, kein harter Fehler) — betrifft
  KI-getrennt und Sync-offline. KI-Boot-Zustand (`unknown`, vor erstem KI-Tab) bleibt grau.
- Bestehende Dialogs (Synchronisierung / Interne KI) + Live-Status-Logik unverändert; nur die
  Trigger-Darstellung + das Footer-Layout wurden überarbeitet.

Betrifft `src/components/ui/SyncStatusIndicator.tsx`, `src/components/ui/BridgeStatusIndicator.tsx`,
`src/core/ShellLayout.tsx`, `src/core/components/BuildInfo.tsx`. Keine Migration.

### v2.135.2 — Fix: „Anfragen → Anonymisieren" hängt mit lokalem llama.cpp nie endet (Juni 2026)

PATCH — der Anonymisieren-Schritt (Modul Anfragen) blieb mit dem lokalen llama.cpp/qwen-
Server ewig im Spinner, obwohl der Server seine Tokens längst generiert hatte. Ursache:
`runSkill` fuhr immer dann den **Streaming-Pfad** (`streamConversation`), wenn Thinking
aktiv war (`thinkingBudget !== 'none'`) — auch ohne Live-Vorschau-Consumer. Der
DirectLLM-Stream-Loop terminiert aber nur über `[DONE]`/Verbindungsschluss und hat
**keinen Timeout**; liefert der Server kein erkanntes Abschluss-Signal, settlet das
Promise nie. Der gut funktionierende Auslastungs-Klassifizierungs-Batch nutzt dagegen den
non-streaming-Pfad (`submitMessage` → `res.json()`, gebundene Completion).

- **Fix:** `runSkill` streamt jetzt **nur noch, wenn ein Delta-Consumer existiert**
  (`onContentDelta`/`onThinkingDelta`). Thinking allein triggert kein Streaming mehr.
- **Wirkung:** Anonymisieren + Glätten (kein Consumer) laufen über den robusten
  non-streaming-Pfad — dieselbe Completion wie die Klassifizierung. Reasoning +
  `<think>`-Bereinigung bleiben erhalten. Interaktive Flows (Gutachten/Kurzfassung,
  Live-Vorschau mit Callbacks) streamen unverändert weiter.

Betrifft `src/core/services/skills/run/run-skill.ts` (+ präzisierte Kommentare in
`anonymisierung.ts`/`finalisierung.ts`, Regressions-Test in `run-skill.test.ts`).
Keine Migration.

### v2.135.1 — Sidebar-Status: zwei kompakte Farb-Icons (Juni 2026)

PATCH — Feinschliff der Fußzeilen-Statusanzeige (aus v2.135.0). In der oft schmal
eingestellten Sidebar war die Mischung aus Datenbank-Icon + farbigem Punkt + Text
„Verbunden" + KI-Icon zu breit; der Punkt/das KI-Icon rutschten an den rechten Rand
und waren kaum klickbar.

- Jetzt **zwei farbige Icons nebeneinander** (links **KI** / Bot, rechts **Datenbestand**
  / Database), eng gruppiert und rechts ausgerichtet — beide klickbar (Dialog wie bisher).
- **Punkt + „Verbunden"-Text entfernt** (kein Platz in schmaler Sidebar); der Status
  steckt in der **Icon-Farbe** (grün = verbunden, rot = getrennt/offline, gelb-pulsierend =
  Sync läuft) + Tooltip. Icons **etwas größer** (KI 15 px, Datenbestand 14 px).

Betrifft `SyncStatusIndicator.tsx`, `BridgeStatusIndicator.tsx`, `ShellLayout.tsx`. Keine Migration.

### v2.135.0 — Live-Verbindungsstatus der internen KI (Juni 2026)

MINOR — die Verbindung zur internen KI (Streamlit-Bridge) wird jetzt **automatisch erkannt und überall
angezeigt**; der manuelle „Verbindung testen"-Klick entfällt.

- **Zentrale Status-Quelle** ([bridge-status.ts](src/core/services/ai/bridge-status.ts), Zustand-Store):
  der `StreamlitBridgeTransport` spiegelt jedes Inbound-Signal des Bookmarklets (`tf-bridge-ready`/`tf-pong`/
  `tf-app-ping`/`tf-stream`/`tf-response`) als `connected`; Ping-Timeout/geschlossener Tab → `disconnected`;
  URL-Wechsel → `unknown`. Status `'unknown'` (Boot) bleibt grau (kein falsches Rot).
- **Auto-Erkennung** ([useBridgeHeartbeat.ts](src/core/hooks/useBridgeHeartbeat.ts)): passiver Poller (öffnet
  nie selbst einen Tab). Zwei-Stufen-Takt ~3 s — günstiger `window.closed`-Check (fängt den geschlossenen
  KI-Tab in ~3 s) + alle ~15 s ein passiver Ping (fängt „Tab offen, aber Bridge tot").
- **Homepage-Karte** ([AiAssistantCard.tsx](src/plugins/home/AiAssistantCard.tsx)): zeigt den echten Status
  (grün/grau) und einen **„Verbinden"**-Button — die interne KI lässt sich direkt von der Startseite öffnen
  (vorher nur über Einstellungen → KI-Assistent).
- **Sidebar-Fußzeile**: neues **KI-Icon** (Bot, grün/rot/grau) neben dem Datenbestand-Indikator, der zusätzlich
  ein **Datenbank-Icon** bekommt. Klick aufs KI-Icon öffnet einen kleinen Verbinden-Dialog.
- **Trennungs-Hinweis** ([BridgeDisconnectHint.tsx](src/components/ui/BridgeDisconnectHint.tsx)): schließt der
  Nutzer den KI-Tab versehentlich, erscheint unten rechts „Interne KI getrennt — wurde der KI-Tab geschlossen?"
  mit „Erneut verbinden". Nur beim Übergang `verbunden → getrennt` (kein Fehlalarm beim Start).
- **Gemeinsamer Verbinden-Helper** ([connect-ki.ts](src/core/services/ai/connect-ki.ts)) — eine Quelle für
  Einstellungen, Homepage, Sidebar und Hinweis (kein Code-Duplikat).
- **Bookmarklet-Selbsttest** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)):
  die KI-Tab-Leiste prüft nach dem Aktivieren automatisch die Gegenrichtung und zeigt „ZAH App erreichbar"
  ohne manuellen Klick. **Das Bookmarklet muss dafür einmal neu installiert (neu in die Lesezeichenleiste
  gezogen) werden** — die App-seitige Auto-Erkennung funktioniert auch ohne.

Keine Migration. Betrifft `ShellLayout.tsx`, `SyncStatusIndicator.tsx`, `HomePage.tsx`, `StreamlitBridgeSection.tsx`.

### v2.134.2 — Skill-Verwaltung: „Speichern" fragt nicht mehr fälschlich nach (Juni 2026)

PATCH — der Editor-interne **„Speichern"**-Button (Skill-Editor + Workflow-Schritt-Editor) löste nach
erfolgreichem Speichern die Leave-Guard-Nachfrage **„Ungespeicherte Änderungen — speichern, bevor Sie
wechseln?"** aus, statt einfach zu schließen.

- **Ursache:** Beide Editoren verdrahteten den Speichern-Erfolg (`useAsyncAction(doSave, { onSuccess })`)
  mit dem **guarded** `onBack` (`requestClose → guardLeave`). Der Guard sah den Editor weiterhin als
  `dirty` (`editStateRef` lädt erst nach dem Render-Commit nach; zudem bleibt `dirty` strukturell `true`,
  weil `doSave` `version+1`/`geaendert_am`/`historie` schreibt, die der `draft` nicht trägt, und der
  `skill`-Prop nach dem Persist nie aktualisiert wird) → Nachfrage trotz gerade erfolgtem Speichern.
- **Fix:** eigener, **ungeguardeter** Close-Callback `onSaved` (= `closeEditor`) für den Speichern-/
  Rollback-Erfolg; Zurück-Link/„Abbrechen" bleiben auf dem guarded `onBack`. Damit verhält sich der
  Skill-/Workflow-Editor wie der bereits korrekte `RegelEditor` (Save schließt direkt). Nachfrage erscheint
  nur noch beim Verlassen **ohne** Speichern.

Betrifft `SkillEditor.tsx`, `WorkflowEditor.tsx`, `SkillVerwaltungPage.tsx` (Kuration). Keine Migration.

### v2.134.1 — Anfragen: Anonymisierung robust gegen Eigenheiten der internen KI (Juni 2026)

PATCH — zwei Fixes am Anonymisierer des Moduls „Anfragen" (dev), der an Eigenheiten der internen KI
(Streamlit-Bridge, Reasoning IMMER an) scheiterte („…nicht im erwarteten JSON-Format {anonymisiert,
mapping}").

- **Thinking-Block inline:** `runAnonymisierung`/`polishAntwort` gaben kein `thinkingBudget` → `runSkill`
  übersprang `extractThinking` → der inline `<think>…</think>`-Reasoning-Block (oft mit einem
  JSON-Format-Beispiel darin) blieb im `raw`, und der Parser griff das Beispiel statt der echten Antwort.
  Fix: `thinkingBudget: 'medium'` wie bei allen anderen Skill-Läufen; Parser ankert zusätzlich auf das
  Feld `"anonymisiert"`.
- **Früh-Finalisierung „Starte…":** das Bridge-Bookmarklet
  ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js))
  finalisierte die Antwort nach `SETTLE_MS = 2500 ms` DOM-Idle ohne Schutz gegen kurze, noch wachsende
  Teil-Antworten; unter Last pausiert das Thinking-Modell nach einem ersten „Starte…"-Token > 2,5 s →
  `submitMessage` bekam „Starte…" statt des JSON (kein Stream-Fallback; der Chat maskiert es via Streamlits
  eigener Darstellung). Fix Ebene 1 (App, kein Re-Install): bounded **Retry** in `runAnonymisierung`
  (3 Versuche). Fix Ebene 2 (Bookmarklet): `SETTLE_MS` 2500 → 5000 + doppeltes Idle-Fenster für sehr kurze
  Antworten (< 40 Zeichen). **Das Bookmarklet muss einmal neu installiert werden**, damit Ebene 2 greift.

Dev-only (Modul „Anfragen"), keine Migration.

### v2.134.0 — Gutachten: Workflow-Auswahl im Antrag (dev-Test) (Juni 2026)

MINOR — Folgeschnitt zu v2.133.0: In **dev** kann man im Antrag auswählen, **welchen** GA-Workflow der
Gutachten-Stepper fährt, um einen frisch gebauten **Entwurf**-Workflow an einem echten Antrag testweise
durchzuspielen. Greift **nur** wenn Entwürfe erlaubt sind **und** es >1 wählbaren Workflow gibt — sonst
kein Dropdown, **GA byte-identisch** (prod/pl/as unverändert). Bewusst klein: kein neues Run-Keying, keine
Output-Typen, kein zweiter Skill-/Generierungs-Pfad.

- **Eine Erkennungs-/Auflösungs-Quelle** ([active-workflow.ts](src/plugins/antraege/gutachten/active-workflow.ts)):
  `resolveWorkflowSteps` nimmt optional `opts.workflowId` — eine explizite, gültige + verfügbare Wahl
  gewinnt über den Tie-Break, sonst byte-identisch. Kandidaten-Prädikat `istWorkflowKandidat` als EINE
  Quelle; neue reine `verfuegbareWorkflows(file, typ, {erlaubeEntwuerfe})` fürs Dropdown.
- `buildSkillMap` ([skill-context.ts](src/plugins/antraege/gutachten/skill-context.ts)) nimmt optional
  `{ artefaktTyp, workflowId }` und nutzt **denselben** Auflöser (ohne Opts byte-identisch → `useBatchJob`
  unberührt).
- **Dropdown** ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts) +
  [GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)): lokaler `testWorkflowId`-State
  (resettet pro Reload), Lade-Effekt speist `{ workflowId }` ein und lädt bei Wechsel Run/Steps/SkillMap neu;
  das `select` „Workflow (dev-Test)" erscheint nur bei `erlaubeWorkflowEntwuerfe() && >1` Workflow.
- Bekannte Vereinfachung: Run-Keying bleibt `(artefaktTyp, scope)` — zwei GA-Workflows teilen den Run;
  abweichende Schritt-IDs starten leer (gewolltes Test-Verhalten). Per-Workflow-Keying erst, wenn nötig.

### v2.133.1 — Streamlit-Bridge: Status-Leiste über der neuen Tab-Leiste sichtbar (Juni 2026)

PATCH — auf der geänderten internen-KI-Seite (`gpt.vdivde-it.de`, jetzt volle-Breite-Tab-Leiste mit
hohem eigenem Stacking-Context) verschwand die Bridge-Status-Leiste **hinter** den Tabs — `z-index:99999`
reichte nicht mehr. Symptom: „Bookmarklet geht nicht / Klick macht nichts". Tatsächlich war die Bridge
**funktional installiert und von der App erreichbar**, nur die Leiste unsichtbar (und der „Klick macht
nichts"-Effekt war der gewollte Doppel-Install-Guard).

- `z-index` der Leiste ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js))
  von `99999` auf das Maximum **`2147483647`** angehoben. Live auf `gpt.vdivde-it.de` bestätigt.
- **Bookmarklet-Änderung ⇒ einmal neu installieren** (aus Einstellungen → Bridge-Sektion neu ziehen).

### v2.133.0 — Workflow-Verwaltung: alle Workflows pflegen + variantenbewusste dev-Freigabe (Juni 2026)

MINOR — der Workflows-Tab der Skill-Verwaltung zeigte bisher genau **einen** fest verdrahteten Workflow
(`zim-ep`). Jetzt verwaltet er **alle** Workflows (Gutachten, NF, …) und bekommt ein **variantenbewusstes
Freigabe-Modell**: in **dev** Entwürfe bauen + ausführen, per **Freigabe** in pl/prod/as/kurator verfügbar
machen. Additiv (`params`/Feld-Defaults, kein Schema-Bump, kein neuer Object-Store/Transport); **GA
byte-identisch**.

- **Freigabe-Achse** ([types.ts](src/core/services/skills/registry/types.ts), [storage.ts](src/core/services/skills/registry/storage.ts)):
  `WorkflowDef.freigabe?: 'entwurf'|'freigegeben'` (normalize defaultet fehlend → `'freigegeben'`, fail-safe —
  zim-ep/nf bleiben überall verfügbar). Getrennt von `aktiv` (globaler An/Aus, geteilte `registry.json`).
  Neuer Artefakt-Typ `'precheck'`.
- **Flag** `features.workflowEntwuerfe` ([runtime-config.ts](src/config/runtime-config.ts), nur dev `true`) +
  Ableitung `erlaubeWorkflowEntwuerfe()` ([feature-flags.ts](src/config/feature-flags.ts)); reine Gate-Funktion
  `istWorkflowVerfuegbar` ([workflow-steps.ts](src/core/services/skills/registry/workflow-steps.ts), kein
  `runtimeConfig`-Import).
- **Kuration** ([SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx) +
  neue Komponenten `WorkflowSwitcher`/`WorkflowMetaEditor`): Switcher über alle Workflows (Typ-Badge +
  Status), Anlegen (`blankWorkflow` → Entwurf), Metadaten (Name/Typ/Ebene/Aktiv), Freigeben/Zurückstellen,
  Löschen (eigene) bzw. Deaktivieren (Seeds, Remerge-Schutz). Tab-Zähler = Anzahl Workflows.
- **Laufzeit** ([active-workflow.ts](src/plugins/antraege/gutachten/active-workflow.ts)): neue reine
  `resolveWorkflowSteps(file, artefaktTyp, {erlaubeEntwuerfe})` (Tie-Break freigegeben-vor-Entwurf, dann
  Version; ga-Fallback `ZIM_EP_DEF`). `resolveActiveWorkflow` bleibt dünner GA-Wrapper — alle drei
  GA-Aufrufer (inkl. `useBatchJob`) unberührt; dev sieht/fährt Entwürfe, andere Varianten nur Freigegebenes.
- Abgrenzung: PreCheck-**Laufzeit** (Einstiegspunkt im Antrag, Workflow-Auswahl-UI je Typ, PreCheck-Outputs)
  ist bewusst der nächste Schnitt (Prompt B), nicht Teil dieser Version.

### v2.132.1 — Streamlit-Bridge: „Prompt-Vorlagen"-Spalte automatisch ausblenden (Juni 2026)

PATCH — das Bridge-Bookmarklet blendet beim Aktivieren die rechte **„Prompt-Vorlagen"**-Spalte der
internen KI-Seite aus und gibt dem (von der App ferngesteuerten) Chat die volle Breite. Übernimmt den
bewährten CSS-Trick des alten ZIM-Bookmarklets, additiv im Snippet — Bridge-Kernlogik unverändert.

- **Rein per CSS** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  neue `installTemplateHide()`): injiziertes `<style id="tf-bridge-layout">` blendet
  `[data-testid="stColumn"]:has(#prompt-vorlagen)` aus und setzt die Geschwister-Chat-Spalte auf volle
  Breite. Verankert am Streamlit-Auto-Anker `#prompt-vorlagen` → wird bei jedem Rerun neu erzeugt, die
  Regel greift **flackerfrei ohne Observer**.
- **Sicherheitsnetz `ensureVorlagenHook()`**: fehlt der Anker mal (Streamlit-Änderung), wird die
  „Prompt-Vorlagen"-Überschrift per Text-Match (`/prompt[\s-]*vorlagen/i`) gefunden und der Anker
  nachgesetzt. Re-Check im **bestehenden** `MutationObserver` (kein zweiter Observer; im Normalfall
  `getElementById`-Early-Return).
- **Bookmarklet-Änderung ⇒ einmal neu installieren** (aus Einstellungen → Bridge-Sektion neu ziehen).

### v2.132.0 — Regel-Editor: Erkennung ohne Regex-Wissen + zweiseitiger KI-Hinweis + Typ-Transparenz (Juni 2026)

MINOR — `verbotenes_muster`-Regeln lassen sich jetzt ohne Regex-Kenntnis pflegen; der generierte
KI-Hinweis leakt keinen rohen Regex mehr. Alles **additiv in `params.*`** (kein Schema-Bump, keine
`normalize`-Änderung); **Phrasen-Bestand byte-identisch** in Check *und* Hinweis.

- **Eine Erkennungs-Quelle** ([check-engine.ts](src/core/services/skills/registry/check-engine.ts)):
  neue reine Helfer `eingabeModusOf` / `kompiliereGruppe` / `erkennungsEintraege` (über das Dach-Barrel
  exportiert). Drei Eingabe-Modi — **Phrasen** (Default, wörtlich auto-escaped), **Synonym-Gruppen**
  (Stamm + Varianten → App kompiliert die Alternation), **Regex** (Experten, Literal-Fallback bei
  Parse-Fehler). Check-Engine **und** Live-Tester nutzen dieselbe Funktion (kein zweiter Matcher).
- **Zweiseitiger, regexfreier Hinweis**: `verbotenes_muster.hint` baut aus `hinweisVermeiden`/
  `hinweisStattdessen` bzw. menschenlesbaren Labels „Vermeide … Formuliere stattdessen …" — nie roher
  `(?:…)`/`\b` im Prompt (`buildPromptHinweis`/`buildPromptVorgaben` profitieren automatisch).
- **Editor** ([MusterErkennungEditor.tsx](src/plugins/skill-verwaltung-kuration/MusterErkennungEditor.tsx),
  neue Plugin-Komponente): Modus-Umschalter, Synonym-Builder mit Stamm + Varianten-Chips + generiertem
  Muster, Regex-Live-Validierung pro Zeile, **modusunabhängiger Live-Tester** (markiert Treffer
  clientseitig), zwei KI-Hinweis-Felder. Die alte „Muster sind reguläre Ausdrücke"-Checkbox entfällt;
  Alt-Regeln öffnen via `eingabeModusOf` im richtigen Modus.
- **Typ-Transparenz** ([RegelEditor.tsx](src/plugins/skill-verwaltung-kuration/RegelEditor.tsx)):
  read-only Typ-Chip (Schloss-Icon, „Typ · Check-Engine") + bewusster „Typ ändern"-Pfad mit Warnung,
  der die typ-spezifischen `params` auf `DEFAULT_PARAMS[neu]` zurücksetzt (pure `wechsleRegelTyp`).
- Hinweis: Die Seed-Regel `seed-passiv-stil` (Passiv-Floskel, `istRegex:true`) zeigt damit im Hinweis
  statt des rohen Regex den generischen Satz — die Umstellung auf Synonym-Gruppen + gepflegte
  KI-Hinweise erfolgt bewusst nachträglich über die UI (kein Seed-Write).

### v2.131.5 — Qualitätsregeln: Intro-Text hinter Info-Icon (vertikaler Platz) (Juni 2026)

PATCH — der Intro-Absatz „Jede Regel kodiert eine Erfahrung …" kostete vor der Tabelle eine ganze Zeile.
Jetzt hinter einem **Info-Icon in der Suchleisten-Zeile** ([SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx),
`TAB_HELP` + `Tooltip`) versteckt; der `<p>`-Absatz in [RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx)
ist entfernt. Der Nutzer sieht die Tabelle sofort, die Erklärung bleibt per Hover/Fokus abrufbar.

### v2.131.4 — Regel-Filter: Typ-Facette entfernt (Overlap mit Kategorie/Prüfart) (Juni 2026)

PATCH — die Kategorie („Art") wird per `effektiveKategorie()` aus `typ` + `pruefart` abgeleitet
([kategorien.ts](src/core/services/skills/registry/kategorien.ts)); die grob gruppierte **Typ**-Facette war
damit redundant: „Fachlich/Administrativ" standen doppelt (Typ *und* Prüfart), „Umfang & Länge" ≈ Kategorie
„Umfang".

- **Typ-Facette aus der Filter-Leiste entfernt** ([RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx)).
  Facetten jetzt: **Kategorie · Prüfart · Schweregrad · Aktiv** (Zeile 1) + **Verwendet in** (Zeile 2).
- Tote Gruppierungs-Helfer entfernt (`TYP_GRUPPE`/`typGruppeLabel`/`REGEL_TYP_GRUPPE_ORDER` aus
  [regelShared.tsx](src/plugins/skill-verwaltung-kuration/regelShared.tsx); `typ` aus dem Facetten-Hook
  [useRegelFilters.ts](src/plugins/skill-verwaltung-kuration/useRegelFilters.ts)). **`typLabel` bleibt** — die
  Tabellen-**Spalte** „Typ" zeigt weiter den granularen Typ pro Regel.
- Kategorie = Inhalts-Achse, Prüfart = Mechanismus (textlich/fachlich/administrativ) bewusst behalten.

### v2.131.3 — Qualitätsregeln-Tabelle: breitere Standard-Spaltenbreiten (Juni 2026)

PATCH — Folge der content-width-Umstellung (v2.131.2): ohne die alte `width:100%`-Streckung rendert die
Qualitätsregeln-Tabelle ihre Default-Breiten exakt → die „Regel"-Spalte (180px) war beim ersten Laden zu
schmal für die langen Regel-Namen, die „Parameter"-Spalte (300px) unnötig breit.

- **Neue Defaults** in [regelTableColumns.tsx](src/plugins/skill-verwaltung-kuration/regelTableColumns.tsx):
  Regel 180→290, Art 150→160, Parameter 300→200, Schweregrad 120→110, Verwendet in 160→230 (Typ/Aktiv
  unverändert). Proportionen wie vom Nutzer per Screenshot vorgegeben (breite Namens- + Verwendet-Spalte).
- Wirkt nur auf den **Erst-Lade**-Zustand; bereits per Drag gespeicherte Breiten (localStorage
  `teamflow_regeln_table_col_widths`) bleiben unangetastet.

### v2.131.2 — Spalten-Resize springt nicht mehr beim Greifen (Juni 2026)

PATCH — beim Greifen des Spalten-Resize-Handles in der geteilten `SortableTable`
([SortableTable.tsx](src/components/data-table/SortableTable.tsx)) sprang die Spalte breiter und der
Handle stand nicht mehr bündig am Spaltenende (Bug bestand „schon immer").

- **Ursache**: Die Tabelle rendert `table-layout: fixed; width: 100%`. Liegt die Summe der Spaltenbreiten
  unter der Container-Breite, streckt der Browser jede Spalte proportional → die gerenderte `th.offsetWidth`
  ist größer als die `<col>`-Breite. Der Resize-Seed (`startWidth = th.offsetWidth`) überschätzte damit und
  pinnte die Spalte auf ihre gestreckte Breite, die erneut gestreckt wurde → Sprung + Handle-Drift.
- **Fix**: resizbare Tabellen rendern jetzt **content-width** (so breit wie die Spaltensumme, wie die
  Förderanträge- und Suche-Tabelle) — keine Streckung mehr, `th.offsetWidth == col-Breite`, Seed stimmt,
  kein Sprung. Während des Drags wächst die Tabellenbreite live mit (`table.style.width = Summe`), damit
  `table-layout:fixed` die Nachbarspalten nicht staucht, sondern horizontal scrollt. Spiegelt das
  bestehende `SearchResultsTable`-Modell.
- **Sichtbare Folge**: schmale resizbare Tabellen (Regeln 1140px, Skills 1004px, Feedback-Board 1416px)
  füllen die Breite nicht mehr proportional, sondern sind genau so breit wie ihre Spalten (ggf. Leerraum
  rechts / Scroll bei Bedarf). Förderanträge (war schon content-width via `fitContentWidth`) unverändert.

### v2.131.1 — Typ-Gruppe: „Keine Aufzählungen" → „Muster & Pflichttext" (Juni 2026)

PATCH — die Typ-Facette ([regelShared.tsx](src/plugins/skill-verwaltung-kuration/regelShared.tsx)
`typGruppeLabel`) bündelt `keine_aufzaehlungen` jetzt mit in **„Muster & Pflichttext"** (zuvor eigene
Gruppe). Damit nur noch drei Textregel-Gruppen: Umfang & Länge / Muster & Pflichttext / (QS-Fallback).

### v2.131.0 — Qualitätsregeln-Filter: aufgeräumt (Typ-Gruppen, Skill-Zeile, kein Zähler) (Juni 2026)

MINOR — Feinschliff der Facetten-Leiste ([RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx)),
damit man „den Wald vor lauter Bäumen" sieht:

- **Typ-Facette gruppiert** statt jeden Einzel-Typ aufzulisten ([regelShared.tsx](src/plugins/skill-verwaltung-kuration/regelShared.tsx)
  `typGruppeLabel`): **„Umfang & Länge"** (Zeichen/Wörter/Sätze/Satzlänge/Absätze) und **„Muster & Pflichttext"**
  (Verbotenes Muster + Pflicht-Anfang); „Keine Aufzählungen" + QS-Fallback (Textlich/Fachlich/Administrativ)
  bleiben. Die Tabellen-**Spalte** „Typ" bleibt granular (`typLabel`) — nur die Facette bündelt.
- **„Verwendet in" in eine eigene zweite Zeile** — aufgeklappt wird die Skill-Liste sehr breit und
  verdrängte sonst die übrigen Pillen.
- **Treffer-Zähler entfernt** (kein „20 Regeln" mehr).
