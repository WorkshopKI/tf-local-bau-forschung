# TeamFlow Local — App-Überblick

**Was:** Serverlose Browser-App für ein Förderanträge-Team (ZIM-Förderanträge, Forschung/Entwicklung). Verwaltet Förderanträge, Fristen, Kapazitätsplanung, Dokument-Klassifizierung und KI-gestützte Hybrid-Suche — ganz ohne eigene IT-Infrastruktur oder Server.

**Hauptbereiche (Seitenleiste):**
- **Home** — persönliches Dashboard aus konfigurierbaren Widgets (offene Anträge, Fristen, Rückstände)
- **Förderanträge** — Kernmodul: Anträge und Verbünde/Teilvorhaben verwalten, Gutachten-Werkstatt, Artefakt-Werkbank, Antrag-Aufbereitung
- **Auslastung** (nicht in allen Ausgaben) — Anträge in Überkategorien einsortieren, Mitarbeitenden zuweisen, Quartals-Kapazität planen
- **Fristen & Meilensteine** — Bearbeitungs-Meilensteine je Verbund, gemessen ab Antragseingang
- **E-Mail Anfragen** — Anfragen anonymisiert an einen externen FAQ-Assistenten geben und die Antwort zurückführen
- **Förderfähigkeit** — Einreichung prüfen: Rechenchecks, editierbare Checkliste, Abschluss-Entwurf
- **Suche** — Hybrid-Suche (Volltext + semantisch) über Anträge und Dokumente; der KI-Assistent dockt hier rechts an
- **Status-Katalog** — Statuswerte des Fachsystems kuratieren, ihre Wirkung simulieren, Fassungen versionieren
- **Feedback** — öffentliches Board: Probleme, Ideen, Bearbeitungsstand aller Rückmeldungen
- **Dokumente** (nur Entwickler-Ausgabe) — Dokumentenverwaltung und -vorschau
- **Skill-Verwaltung** — Skills und Prüfregeln der KI-Bausteine pflegen (Schreiben nur mit Kurator- bzw. PL-Recht)
- **Kuration** (nur für Kuratoren, nach Login) — Suchindex, Programme, CSV-Quellen, Dokumentenquellen, Anfragen-Konfiguration, Filter, Feedback-Dashboard, Dokument-Review

**Wiederkehrende Bedienelemente:** Die **Einstellungen** stehen als Zahnrad unten in der Seitenleiste, „Über die App" hinter der Versionsnummer daneben. Jede Seite trägt oben rechts einen **Hilfe**-Knopf mit einer Kurzanleitung zu genau dieser Seite. Rückmeldungen gehen über den runden Knopf unten rechts.

**Begriffe:**
- **Antrag** — ein Förderantrag, identifiziert über FKZ (Förderkennzeichen, Format `16KN######` oder `16EP######`)
- **Verbund vs. Teilvorhaben** — ein Verbundprojekt bündelt mehrere Teilvorhaben (Teilanträge) unter einer gemeinsamen Projektbeschreibung; Anträge können Teil eines Verbunds oder eigenständig sein
- **Rollen** — normale User (Sachbearbeitung/Gutachten, lesend + eigene Bereiche), Projektleitung (PL, schreibt Kurations-Daten), Kurator (voller Verwaltungszugriff nach Passwort-Login)
- **Status** — Anträge durchlaufen einen amtlichen Status (z.B. eingegangen, in Begutachtung, bewilligt, abgelehnt); unabhängig davon können Artefakte wie Gutachten oder Nachforderungen existieren

## Technik

Alles ab hier bekommt nur die KI — der Überblick in „Über die App" schneidet es weg.

**Deployment:** Läuft ausschließlich über `file://` (Doppelklick auf eine HTML-Datei in Chrome/Edge) — kein Backend, kein Node.js zur Laufzeit, kein HTTP-Server. Die gesamte App ist in EINE `index.html` kompiliert (Single-File-Build). Daten liegen in IndexedDB (Cache) + auf einem SMB-Daten-Share (Source of Truth, Zugriff über File System Access API). Kein `fetch()` auf relative URLs, kein `import()`, keine Service Worker.

**Build-Varianten:** Die App wird pro Einsatz-Kontext gebaut (dev/prod/kurator/pl/as) — welche Bereiche sichtbar sind, hängt von Variante und Feature-Flags ab. `chat` ist ein `hideFromNav`-Redirect auf `/suche` (der Chat lebt als angedocktes Panel in der Suche); `einstellungen` trägt seit v2.360 ebenfalls `hideFromNav` und sitzt als Zahnrad in der Fußzeile.
