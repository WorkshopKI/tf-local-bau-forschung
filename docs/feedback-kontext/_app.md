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

- **Kuration** — Suchindex, Programme, CSV-Quellen, Dokumentenquellen, Anfragen-Konfiguration, Filter, Feedback-Dashboard, Dokument-Review

## Wiederkehrende Bedienelemente

Die **Einstellungen** stehen als Zahnrad unten in der Seitenleiste, „Über die App" hinter der Versionsnummer daneben. Jede Seite trägt oben rechts einen **Hilfe**-Knopf mit einer Kurzanleitung zu genau dieser Seite; in dessen Kopfzeile stehen auch die **Einführungs-Tour** und „Über die App". Rückmeldungen gehen über den runden Knopf unten rechts.

„**Eigenes Fenster**" in der Kopfzeile des Hilfe-Dialogs stellt dieselbe Anleitung in ein schmales Fenster neben die App — zum Mitlesen, während Sie die Schritte ausprobieren. Es zeigt immer die Seite, auf der Sie gerade sind; „Anleitung festhalten" lässt es auf der aktuellen stehen, und solange es festgehalten ist, sagt es Ihnen, wo die App inzwischen steht. Blockiert der Browser das Fenster, bleibt der Dialog offen und weist darauf hin.

## Begriffe

- **Antrag** — ein Förderantrag, identifiziert über FKZ (Förderkennzeichen, Format `16KN######` oder `16EP######`)
- **Verbund vs. Teilvorhaben** — ein Verbundprojekt bündelt mehrere Teilvorhaben (Teilanträge) unter einer gemeinsamen Projektbeschreibung; Anträge können Teil eines Verbunds oder eigenständig sein
- **Ausgabe und Berechtigung** — welche Fassung der App jemand benutzt und was er darin ändern darf: die normale Ausgabe liest mit und schreibt nur in die eigenen Bereiche, die Projektleitung (PL) pflegt zusätzlich die Kurations-Daten des Teams, der Kurator kommt nach Passwort-Login an die Verwaltung
- **Fachrolle** — wer im Verfahren zuständig ist: AB (administrative Bearbeitung), FB (fachliche Bearbeitung), PA (Projektadministration), QS (Qualitätssicherung), Juristen. Die Fachrolle stammt aus dem Kürzel-Katalog des Fachsystems und steuert, welche Aufgaben als eigene und welche als „wartet auf …" erscheinen; Einträge ohne Rollenvermerk darf jeder setzen und sie bleiben unter jeder Rollenwahl sichtbar. Beide Achsen sind unabhängig: dieselbe Person kann AB sein und zugleich die Projektleitungs-Ausgabe benutzen
- **Status** — der amtliche Zustand eines Antrags im Fachsystem. Dort wird er nicht von Hand gesetzt: jemand trägt ein Kürzel ein, und eine Regel des Fachsystems setzt daraufhin den Status. Die App liest nur das Ergebnis und kann über die Trigger-Tabelle zeigen, wodurch es entstanden ist. Unabhängig davon können Artefakte wie Gutachten oder Nachforderungen existieren
- **Verfahrensschritt** — die Gliederung des Verfahrens, die die App über die Status legt: Eingang, In Prüfung, Erstentscheidung, Begleitung, Abgeschlossen; einige Statuswerte laufen bewusst ohne Schritt daneben her. Das ist keine amtliche Einteilung, sondern eine Lesebrille — mit der Fachseite abgestimmt und im Katalog änderbar. Sie bestimmt Auswertung, Zieltage und Stillstandserkennung
- **Arbeitsliste** — die gröbere Einteilung danach, wer am Zug ist; sie bestimmt Reiter, Gruppierung und Farbe in „Förderanträge". Sie steht fest, während der Verfahrensschritt beweglich ist — genau darin unterscheiden sich die beiden

## Technik

Alles ab hier bekommt nur die KI — der Überblick in „Über die App" schneidet es weg.

**Deployment:** Läuft ausschließlich über `file://` (Doppelklick auf eine HTML-Datei in Chrome/Edge) — kein Backend, kein Node.js zur Laufzeit, kein HTTP-Server. Die gesamte App ist in EINE `index.html` kompiliert (Single-File-Build). Daten liegen in IndexedDB (Cache) + auf einem SMB-Daten-Share (Source of Truth, Zugriff über File System Access API). Kein `fetch()` auf relative URLs, kein `import()`, keine Service Worker.

**Build-Varianten:** Die App wird pro Einsatz-Kontext gebaut (dev/pl/prod) — welche Bereiche sichtbar sind, hängt von Variante, Feature-Flags und den per Zusatzpasswort freigeschalteten Modulen (Auslastung, Kuration) ab. `chat` ist ein `hideFromNav`-Redirect auf `/suche` (der Chat lebt als angedocktes Panel in der Suche); `einstellungen` trägt seit v2.360 ebenfalls `hideFromNav` und sitzt als Zahnrad in der Fußzeile.
