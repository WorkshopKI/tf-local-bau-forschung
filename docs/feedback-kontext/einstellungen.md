# Einstellungen

## Zweck

Persönliche App-Konfiguration: wer Sie sind, was Ihnen angezeigt wird, wie die App aussieht, woher sie ihre Daten liest und wie die interne KI angebunden ist. Jeder pflegt seine eigenen Einstellungen.

## UI-Elemente & Begriffe

- **Navigation links** mit Suchfeld und vier Seiten: Mein Profil, Darstellung & Bedienung, Daten & Verbindungen, Interne KI. Die Suche findet Einstellungen über alle vier Seiten hinweg; jeder Treffer nennt unter seinem Namen den Weg dorthin („Mein Profil › Persönlicher Assistent"). Ein Klick springt hin, klappt den nötigen Bereich auf und **markiert die Zeile so lange, bis Sie das nächste Mal klicken oder tippen**.

- **Zwei Spalten je Seite:** links der Hauptbereich in weißen Karten, rechts eine getönte Nebenspalte mit dem, was daran hängt. Ist das Fenster zu schmal, stehen beide Spalten untereinander.

- **Das kleine ⓘ** hinter Beschriftungen öffnet auf Klick eine Erklärung und bleibt stehen, bis Sie danebenklicken oder Esc drücken. Dort steht alles, was länger als eine Zeile ist.

- **Eingeklappte Bereiche** tragen rechts in ihrer Zeile eine Angabe, was dahinter liegt — etwa „8 von 28 aktiv", „13 von 15 sichtbar", „3 Dienste" oder „5 Schritte".

- **Mein Profil:** links Ihr Account (Avatar, Name ändern, Kürzel, Zusammenfassung aus Programm, Hauptkategorie und Antragstypen) und Ihr Fachprofil (Hauptkategorie, ergänzende Erfahrungen, Antragstypen; eingeklappt die Themen aus Ihren Anträgen und Ihre eigenen Kompetenzen). Rechts: welche Anträge Sie sehen (Rolle, Bearbeiter-Kürzel, inaktive Bearbeiter, ZTP-/PFM-Zuständigkeiten, Anzahl auf der Startseite), die Zusatz-Module mit ihrer Restlaufzeit und der persönliche Assistent.

- **Persönlicher Assistent** (nur wo freigeschaltet): zwei Schalter — Arbeitsprotokoll und persönliches Gedächtnis. Das Gedächtnis bleibt gesperrt und gedimmt, solange das Arbeitsprotokoll aus ist, und nennt den Grund in seiner Zeile. Darunter die Zusicherung, dass alles auf diesem Gerät bleibt, und eingeklappt die aufgezeichneten Daten (Kennzahlen, Ereignisliste, Export, Löschen) sowie die Gedächtnis-Einträge.

- **Darstellung & Bedienung:** links Erscheinungsbild (Farbschema hell/dunkel, sieben Primärfarben, eingeklappt eine Farb-Vorschau) und die Tastenkürzel. Rechts die Startseiten-Widgets: ein Verweis auf die Rechtsklick-Anpassung der Startseite und, eingeklappt, die vollständige Liste — je Widget ein Schalter, ausgeschaltete Zeilen gedimmt, die Reihenfolge über Pfeile innerhalb der eigenen Spalte.

- **Daten & Verbindungen:** links die Ordner (Datenordner mit „Letzter CSV-Import" und Aktualisieren, persönlicher Ordner, CSV-Quellen; eingeklappt der lokale Arbeitsverlauf) und die verbundenen Verzeichnisse. Rechts der Team-Status (Ordner verbinden, eingeklappt wer online ist), die Tags (umbenennen, löschen, neu zählen) und die persönlichen Dokumentenquellen.

- **Interne KI:** links die Verbindung mit einer Statuskarte (Punkt, Klartext, Adresse), den Knöpfen „Verbindung testen" und „Interne KI öffnen", dem Adressfeld mit eigenem Speichern-Knopf und, eingeklappt, der Einrichtung in fünf Schritten samt ziehbarem Lesezeichen. Rechts das Antwortverhalten (Thinking, KI-Variante, Kontextfenster als Automatik oder Manuell samt Klartext-Angabe, für wie viele Zeichen es reicht) und die externen Recherche-Ziele.

## Typische Aktionen

- Seite wählen oder per Suche zu einer Einstellung springen
- Namen und Kürzel pflegen, Fachprofil setzen, Themen ab- oder anwählen
- Farbschema und Primärfarbe umschalten, Startseiten-Widgets ein- und ausschalten
- Datenordner aktualisieren, Ordner verbinden oder trennen, Tags neu zählen
- Interne KI verbinden, testen und ihr Antwortverhalten einstellen
- Zusatz-Module mit dem Zusatzpasswort freischalten oder wieder sperren

## Technik

**Datenmodell dahinter:** `useProfile` (Profil inkl. `theme.hue`/`theme.dark`, `bearbeiter_kuerzel`, `status_rolle`, `home_meine_antraege_count`), `useMAIdentity` (Session-Kürzel im MA-Login), das persönliche Auslastungs-Profil (`writeAuslastungProfil` in den persönlichen Ordner, Pitfall #24), `useTags` (Zählung über `vorgang:`/`doc:`-IDB-Keys), AI-Provider-Config im `idb`-Store (Key `ai-provider`, `AIProviderConfig`), SMB-/CSV-Handles über den Infrastructure-Layer (`smb-handle`, `csv-source-handle`). Assistent-Protokoll und -Gedächtnis liegen ausschließlich in der IndexedDB dieses Geräts (Pitfalls #37/#38).

**Code:** `src/plugins/einstellungen/` — Rahmen `EinstellungenPage.tsx` + `SettingsNav.tsx` + `settingsPanels.tsx` (Panel-/Such-Registry, Single Source of Truth für Navigation und Suchindex); je Seite ein Ordner (`profil/`, `darstellung/`, `daten/`, `ki/`) mit einer Datei je Gruppe. Die geteilte Layout-Schicht (`SettingsZweiSpalten`, `SettingsGruppe`, `SettingsOption`, `SettingsKlappe`, `SettingsStepper`, `InfoHint`) liegt in `_shared/settings-layout.tsx` + `_shared/settings-primitives.tsx`; der Zweispalten-Umbruch misst per Container-Query die Inhaltsbreite (`einstellungen-layout.css`), nicht den Viewport.
