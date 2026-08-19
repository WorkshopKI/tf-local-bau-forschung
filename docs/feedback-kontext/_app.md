# ZAH (ZIM-Arbeitshilfe) — App-Überblick

## Was

Die ZAH-App (ZIM-Arbeitshilfe) unterstützt bei der Textarbeit zu Förderanträgen und beim Controlling der eigenen Anträge.

## Hauptbereiche (Seitenleiste)

Die Liste ist in Blöcke geteilt — oben unbeschriftet der tägliche Weg, darunter „Werkzeuge", darunter „In Erprobung".

### Täglicher Weg

- **Home** — persönliches Dashboard aus konfigurierbaren Widgets (offene Anträge, Fristen, Rückstände)
- **Förderanträge** — Kernmodul: Anträge und Verbünde/Teilvorhaben verwalten, Gutachten-Werkstatt, Artefakt-Werkbank, Antrag-Aufbereitung
- **Auslastung** (nicht in allen Ausgaben) — Anträge in Überkategorien einsortieren, Mitarbeitenden zuweisen, Quartals-Kapazität planen

### Werkzeuge — stabil, aber seltener gebraucht

- **Suche** — Hybrid-Suche (Volltext + semantisch) über Anträge und Dokumente; der KI-Assistent dockt hier rechts an
- **Skill-Verwaltung** — Skills und Prüfregeln der KI-Bausteine pflegen (Schreiben nur mit Kurator- bzw. PL-Recht)
- **Feedback** — öffentliches Board: Probleme, Ideen, Bearbeitungsstand aller Rückmeldungen
- **Zu klären** — Fachfragen, die das Team gemeinsam beantwortet: jeder trägt sein Urteil ein, wann er Zeit hat
- **Dokumente** (nur Entwickler-Ausgabe) — Dokumentenverwaltung und -vorschau

### In Erprobung

Noch nicht ausgereift, Rückmeldungen ausdrücklich erwünscht; die Gruppe lässt sich zuklappen.

- **Fristen & Meilensteine** — Bearbeitungs-Meilensteine je Verbund, gemessen ab Antragseingang
- **E-Mail Anfragen** — Anfragen anonymisiert an einen externen FAQ-Assistenten geben und die Antwort zurückführen
- **Förderfähigkeit** — Einreichung prüfen: Rechenchecks, editierbare Checkliste, Abschluss-Entwurf
- **Vorgangs-Board** — was an jedem Antrag als Nächstes zu tun ist, abgeleitet aus einer geordneten Regel-Kaskade; die App leitet ab, gehandelt wird im Fachsystem
- **Vorgangs-Regeln** — Statuswerte, Kürzel und die To-do-Regeln des Verfahrens kuratieren und als Fassung für das Team veröffentlichen

### Nur für Kuratoren nach Login

Eine eigene, zuklappbare Gruppe „Kuration" mit zwei Einträgen:

- **Datenpflege** — eine Seite mit Unterseiten: Übersicht (was ansteht, wie die Daten stehen), CSV-Quellen, Förderprogramme (mit Unterprogrammen und Filtern), Suche & Index (mit den Dokumentenquellen), Dienste (externe Gegenstellen) und Sichtbarkeit (was nur mit Beta-Funktionen oder Expertenmodus erscheint)
- **Dokument-Review** — eigene Arbeitsfläche: die vorsortierten Dokumente prüfen, Typ korrigieren, Antrag zuordnen

## Wiederkehrende Bedienelemente

Die **Einstellungen** stehen als Zahnrad unten in der Seitenleiste, „Über die App" hinter der Versionsnummer daneben. Jede Seite trägt oben rechts einen **Hilfe**-Knopf mit einer Kurzanleitung zu genau dieser Seite; in dessen Kopfzeile stehen auch die **Einführungs-Tour** und „Über die App". Rückmeldungen gehen über den runden Knopf unten rechts.

„**Eigenes Fenster**" in der Kopfzeile des Hilfe-Dialogs stellt dieselbe Anleitung in ein schmales Fenster neben die App — zum Mitlesen, während Sie die Schritte ausprobieren. Es zeigt immer die Seite, auf der Sie gerade sind; „Anleitung festhalten" lässt es auf der aktuellen stehen, und solange es festgehalten ist, sagt es Ihnen, wo die App inzwischen steht. Blockiert der Browser das Fenster, bleibt der Dialog offen und weist darauf hin.

## Begriffe

Abkürzungen und Begriffe des Verfahrens — Antrag, Verbund und Teilvorhaben, Fachrolle, Status, Verfahrensschritt, Arbeitsliste und die Kurzformen wie NF, RNE oder ZuwB — stehen im **Glossar** unter „Werkzeuge", mit einem Suchfeld darüber. Dort erklären sie sich einmal und nicht an drei Stellen nebeneinander.

## Technik

Alles ab hier bekommt nur die KI — der Überblick in „Über die App" schneidet es weg.

**Deployment:** Läuft ausschließlich über `file://` (Doppelklick auf eine HTML-Datei in Chrome/Edge) — kein Backend, kein Node.js zur Laufzeit, kein HTTP-Server. Die gesamte App ist in EINE `index.html` kompiliert (Single-File-Build). Daten liegen in IndexedDB (Cache) + auf einem SMB-Daten-Share (Source of Truth, Zugriff über File System Access API). Kein `fetch()` auf relative URLs, kein `import()`, keine Service Worker.

**Build-Varianten:** Die App wird pro Einsatz-Kontext gebaut (dev/pl/prod) — welche Bereiche sichtbar sind, hängt von Variante, Feature-Flags und den per Zusatzpasswort freigeschalteten Modulen (Auslastung, Kuration) ab. `chat` ist ein `hideFromNav`-Redirect auf `/suche` (der Chat lebt als angedocktes Panel in der Suche); `einstellungen` trägt seit v2.360 ebenfalls `hideFromNav` und sitzt als Zahnrad in der Fußzeile.
