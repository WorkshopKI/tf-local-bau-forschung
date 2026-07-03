# TeamFlow Local — App-Überblick
**Was:** Serverlose Browser-App für ein Förderanträge-Team (ZIM-Förderanträge, Forschung/Entwicklung). Verwaltet Förderanträge, Kapazitätsplanung, Dokument-Klassifizierung und KI-gestützte Hybrid-Suche — ganz ohne eigene IT-Infrastruktur oder Server.

**Deployment/Technik:** Läuft ausschließlich über `file://` (Doppelklick auf eine HTML-Datei in Chrome/Edge) — kein Backend, kein Node.js zur Laufzeit, kein HTTP-Server. Die gesamte App ist in EINE `index.html` kompiliert (Single-File-Build). Daten liegen in IndexedDB (Cache) + auf einem SMB-Daten-Share (Source of Truth, Zugriff über File System Access API). Kein `fetch()` auf relative URLs, kein `import()`, keine Service Worker.

**Hauptbereiche (Sidebar):**
- **Home** — persönliches Dashboard (offene Anträge, Fristen, KI-Status)
- **Förderanträge** — Kernmodul: Anträge verwalten, Verbünde/Teilvorhaben, Gutachten-Kurzfassung
- **Anfragen** — E-Mail-Anfragen anonymisiert an einen externen FAQ-Assistenten weiterleiten
- **Auslastung** (nicht in allen Builds) — Kategorisierung + Mitarbeiter-Zuweisung + Kapazitätsplanung
- **Dokumente** (Dev) — Dokumentenverwaltung/-vorschau
- **Suche** — Hybrid-Suche (Volltext + semantisch) über Anträge/Dokumente
- **Chat** — KI-Assistent-Chat
- **Einstellungen** — persönliches Profil, Darstellung, KI-Provider, Tags
- **Kuration** (nur für Kuratoren, nach Login) — Suchindex, Programme, CSV-Quellen, Dokumentenquellen, Anfragen-Config, Filter, Feedback-Dashboard, Dokument-Review

**Datenmodell (Kurzreferenz):**
- **Antrag** — ein Förderantrag, identifiziert über FKZ (Förderkennzeichen, Format `16KN######` oder `16EP######`)
- **Verbund vs. Teilvorhaben** — ein Verbundprojekt bündelt mehrere Teilvorhaben (Teilanträge) unter einer gemeinsamen Projektbeschreibung; Anträge können Teil eines Verbunds oder eigenständig sein
- **Rollen** — normale User (Sachbearbeiter/Gutachter, lesend + eigene Bereiche), Projektleitung (PL, schreibt Kurations-Daten), Kurator (voller Verwaltungszugriff nach Passwort-Login)
- Anträge durchlaufen einen amtlichen Status (z.B. eingegangen, in Begutachtung, bewilligt, abgelehnt) — unabhängig davon können Artefakte wie Gutachten oder Nachforderungen existieren

**Build-Varianten:** Die App wird pro Einsatz-Kontext gebaut (dev/prod/kurator/pl/as) — welche Bereiche sichtbar sind, hängt von der jeweiligen Variante und Feature-Flags ab.
