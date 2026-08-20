# Auslastung

## Zweck

Der Projektleiter lässt Förderanträge automatisch in Fachkategorien einordnen und weist sie passenden Mitarbeitenden (MA) zu — inkl. quartalsweiser Kapazitätsplanung. Mitarbeitende sehen anonymisiert nur ihre eigene Auslastung/Vorschläge.

## UI-Elemente & Begriffe

Fünf Tabs:

- **„Anträge klassifizieren":** Kategorie-Vorschläge, Badge = offene Vorschläge. Unvollständige Anträge ohne Sammel-Datum werden zurückgehalten („wartet auf Vollständigkeit") — sie stehen nur unter dem Chip „Unvollständig" und werden nicht klassifiziert.
- **„Anträge zuweisen":** 50/50-Split-Cockpit mit Top-3-Match-Vorschlägen. Über den Filtern steht die **Datenbasis**: der Arbeitsvorrat folgt dem Betrachtungsbereich (Chip daneben, Klick wechselt), die **Kompetenz-Basis** dagegen ist immer der gesamte Bestand (14 221 Anträge, unabhängig vom Bereich) — sonst verlöre ein Bearbeiter, der nur in Richtlinien außerhalb des Bereichs gearbeitet hat, sein Profil.
- **„Auslastung MA":** Statistik + MA-Liste + Kapazität pro Quartal. Je MA zwei getrennte Balken-Spalten:
  - **„Aktuelles Quartal"** = Kapazitäts-Auslastung in % (rot bei Überbuchung).
  - **„Altlasten (Rückstand)"** = offene Anträge aus bis zu 7 Vorquartalen, gedämpfte Blau-Rampe (dunkel→hell = alt→neu, ältestes Quartal links); Hover zeigt die konkreten Anträge des Bands.
  - Daneben die Zahlenspalten Aktuell / Altlast. / Frei.
- **„Kompetenzen & Jahreskapazitäten":** Kompetenz-Matrix, XLSX-Upload.
- **„Verwaltung":** Kategorien, CSV-Import/Export, Konfiguration inkl. Zugangspasswort-Verwaltung & E-Mail-Vorlage, Themen-Vektoren; hieß bis v2.205 „Einstellungen". Die Themen-Vektoren stehen dort seit v4.127 nur noch als Statusanzeige — wie viele es auf diesem Rechner und auf dem Datenspeicher gibt, wann sie zuletzt gebaut wurden und ob ihre Textfassung überholt ist. Gebaut, geholt und nachgezogen werden sie in der Datenpflege unter „Suche & Index", weil dieselben Vektoren auch die Ähnlichkeitssuche tragen.

Durchgängig:

- **Anonymität:** MAs erscheinen überall nur als anonyme ID (MA01–MAxx).
- **Filter-Pillen zählen facettiert:** die Zahl an einer Pille ist die Zeilenzahl nach dem Klick (andere aktive Filter sind eingerechnet).
- **Einsammeln aus mehreren Ordner-Gruppen:** Die persönlichen Ordner der Teammitglieder liegen unter mehreren Wurzeln (z. B. PL-Ordner und Bearbeiter-Ordner). Solange eine Gruppe nicht verbunden ist, steht eine Zeile mit ihrem Namen und einem eigenen Knopf über dem Bereich — eine Freigabe je Klick, mehr erlaubt der Browser nicht. Die Meldung nach dem Einsammeln nennt jede Gruppe einzeln („PL-Ordner: 4 gelesen · Bearbeiter-Ordner: nicht verbunden"), damit eine fehlende Gruppe sichtbar ist statt stillzuschweigen. Eingesammelt wird trotzdem aus allen verbundenen Gruppen.

## Typische Aktionen

- Klassifizierungs-Vorschläge pro Verbund prüfen/bestätigen
- Anträge an MAs zuweisen (Top-3-Vorschläge nutzen)
- Kapazität/Auslastung pro Quartal einsehen
- Kompetenz-XLSX hochladen, Kompetenz-Matrix pflegen
- Kategorien/Konfiguration in der Verwaltung anpassen (inkl. Zugangspasswörter erzeugen/versenden)
- Übernahme-Wünsche einsammeln (Bilanz: neu / zurückgezogen / bereits vergeben / nicht mehr zuweisbar)
- Team-Profile einsammeln; eine noch nicht verbundene Ordner-Gruppe über ihren eigenen Knopf verbinden
- MA-seitig: eigene Technologien/Präferenzen pflegen, Anträge „übernehmen"

## Technik

**Datenmodell dahinter:** Sidecar `_intern/auslastung.json` (Konfiguration, Kategorien, Klassifizierungen, Mitarbeiter-Profile, Zuweisungen) + `_intern/auslastung-kuerzel-map.json` (Kürzel↔anonId-Mapping). Dreistufiges Matching (Boolean → Regel-Mapping → Embedding-Centroid). Persönliche Profile liegen im User-Ordner (`auslastung-profil.json`).

**Code:** `src/plugins/auslastung/` — Hauptdateien: `index.tsx` (Plugin-Registrierung), `views/AuslastungView.tsx` (Tab-Layout), `views/KlassifizierungsReview.tsx`, `views/ZuweisungsCockpit.tsx`, `views/UebersichtView.tsx`.
