# Einstellungen

## Zweck

Persönliche App-Konfiguration: Profil, Technologien, Darstellung & Bedienung, KI-Anbindung, Daten & Verbindungen — jeder User pflegt seine eigenen.

## UI-Elemente & Begriffe

- **Settings-Sidebar links** mit Suchfeld (Strg+Komma fokussiert, springt zum Abschnitt und hebt ihn kurz hervor) und zwei Gruppen — **Persönlich** (Mein Profil, Meine Technologien) und **System** (Darstellung & Bedienung, Daten & Verbindungen, Interne KI); rechts das gewählte Panel.
- **Mein Profil:** Name/Kürzel/Avatar, Bearbeiter-Filter, Home-Dashboard-Anzahl, Kurator-Login (nur Kurator-Build); in dev/pl/kurator/as zusätzlich das Assistent-Arbeitsprotokoll (Opt-in, Export/Löschen, KI-Gedächtnis) — gefaltet statt als eigener Menüpunkt. Der Avatar trägt bei gewähltem Kürzel das Kürzel (z.B. „THÜ"), sonst die Namens-Initialen.
- **Meine Technologien:** Programmkennung, Kategorien, Antragstypen, Auto-Tags, Zusätzliche Kompetenzen (für Auslastung).
- **Darstellung & Bedienung:** Primärfarbe-Presets, Dark-Mode, „Tastatur Shortcuts" + „Widgets auf der Startseite" (zwei Spalten, Reihenfolge/Sichtbarkeit/Config, je Gerät).
- **Daten & Verbindungen:** „Speicherorte" (Datenordner mit „Letzter CSV-Import" + „Jetzt aktualisieren" in der Zeile, Persönlicher Ordner, CSV-Quellen; unter den CSV-Quellen der vorgegebene Import-Pfad zum Kopieren, wo konfiguriert), „Persönliche Dokumentenquellen", „Tags" (Umbenennen/Löschen/Neu-zählen), „Team-Status" (nur pl/dev; je Ordner-Gruppe eine Verbinden-Zeile, solange sie fehlt, und eine Meldung, aus welcher Gruppe wie viel gelesen wurde).
- **Interne KI** (nur wo verfügbar): „LLM & Reasoning" (Kontextlänge in Tokens, Thinking-Toggle) und „Browser-KI-Verbindung" (Endpoint, Speichern/Testen, Lesezeichen; Dev: Provider).

## Typische Aktionen

- Panel wählen oder per Suche springen
- Profil ändern, Primärfarbe/Dark Mode umschalten
- KI konfigurieren, Kurator-Modus aktivieren (Passwort)
- Datenordner aktualisieren, Ordner verbinden/trennen, vorgegebenen Pfad kopieren
- Tags umbenennen/löschen, Technologien/Kompetenzen pflegen

## Technik

**Datenmodell dahinter:** `useProfile` (Profil inkl. `theme.hue`/`theme.dark`, `bearbeiter_kuerzel`, `home_meine_antraege_count`), `useMAIdentity` (Session-Kürzel im MA-Login), `useTags` (Zählung über `vorgang:`/`doc:`-IDB-Keys), AI-Provider-Config im `idb`-Store (Key `ai-provider`, `AIProviderConfig`), SMB-/CSV-Handles über den Infrastructure-Layer (`smb-handle`, `csv-source-handle`).

**Code:** `src/plugins/einstellungen/` — Rahmen `EinstellungenPage.tsx` + `SettingsNav.tsx` + `settingsPanels.tsx` (Panel-/Such-Registry); Panel-Inhalte in den `*Tab.tsx`-Dateien (Profil, MeineTechnologien, Darstellung, Tastatur, AIProvider + StreamlitBridgeSection, Speicher, Dokumentenquellen, Tags, Online); gemeinsame Bauteile in `_shared/settings-primitives.tsx`.
