# Auslastung
**Zweck:** Der Projektleiter lässt Förderanträge automatisch in Fachkategorien einordnen und weist sie passenden Mitarbeitenden (MA) zu — inkl. quartalsweiser Kapazitätsplanung. Mitarbeitende sehen anonymisiert nur ihre eigene Auslastung/Vorschläge.

**UI-Elemente & Begriffe:** 5 Tabs: „Anträge klassifizieren" (Kategorie-Vorschläge, Badge = offene Vorschläge; unvollständige Anträge ohne Sammel-Datum werden zurückgehalten „wartet auf Vollständigkeit", nur unter Chip „Unvollständig", nicht klassifiziert), „Anträge zuweisen" (50/50-Split-Cockpit mit Top-3-Match-Vorschlägen), „Auslastung MA" (Statistik + MA-Liste + Kapazität pro Quartal; je MA zwei getrennte Balken-Spalten: „Aktuelles Quartal" = Kapazitäts-Auslastung in % (rot bei Überbuchung) und „Altlasten (Rückstand)" = offene Anträge aus bis zu 7 Vorquartalen, gedämpfte Blau-Rampe (dunkel→hell = alt→neu, ältestes Quartal links; Hover zeigt die konkreten Anträge des Bands); daneben die Zahlenspalten Aktuell/Altlast./Frei), „Kompetenzen & Jahreskapazitäten" (Kompetenz-Matrix, XLSX-Upload), „Verwaltung" (Kategorien, CSV-Import/Export, Konfiguration inkl. Zugangspasswort-Verwaltung & E-Mail-Vorlage, Themen-Vektoren; hieß bis v2.205 „Einstellungen"). MAs erscheinen überall nur als anonyme ID (MA01–MAxx). Filter-Pillen zählen facettiert: die Zahl an einer Pille ist die Zeilenzahl nach dem Klick (andere aktive Filter sind eingerechnet).

**Datenmodell dahinter:** Sidecar `_intern/auslastung.json` (Konfiguration, Kategorien, Klassifizierungen, Mitarbeiter-Profile, Zuweisungen) + `_intern/auslastung-kuerzel-map.json` (Kürzel↔anonId-Mapping). Dreistufiges Matching (Boolean → Regel-Mapping → Embedding-Centroid). Persönliche Profile liegen im User-Ordner (`auslastung-profil.json`).

**Typische Aktionen:**
- Klassifizierungs-Vorschläge pro Verbund prüfen/bestätigen
- Anträge an MAs zuweisen (Top-3-Vorschläge nutzen)
- Kapazität/Auslastung pro Quartal einsehen
- Kompetenz-XLSX hochladen, Kompetenz-Matrix pflegen
- Kategorien/Konfiguration in der Verwaltung anpassen (inkl. Zugangspasswörter erzeugen/versenden)
- Übernahme-Wünsche einsammeln (Bilanz: neu / zurückgezogen / bereits vergeben / nicht mehr zuweisbar)
- MA-seitig: eigene Technologien/Präferenzen pflegen, Anträge „übernehmen"

**Code:** `src/plugins/auslastung/` — Hauptdateien: `index.tsx` (Plugin-Registrierung), `views/AuslastungView.tsx` (Tab-Layout), `views/KlassifizierungsReview.tsx`, `views/ZuweisungsCockpit.tsx`, `views/UebersichtView.tsx`.
