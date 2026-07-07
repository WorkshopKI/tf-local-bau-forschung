# Auslastung
**Zweck:** Der Projektleiter lässt Förderanträge automatisch in Fachkategorien einordnen und weist sie passenden Mitarbeitenden (MA) zu — inkl. quartalsweiser Kapazitätsplanung. Mitarbeitende sehen anonymisiert nur ihre eigene Auslastung/Vorschläge.

**UI-Elemente & Begriffe:** 5 Tabs: „Anträge klassifizieren" (Kategorie-Vorschläge, Badge = offene Vorschläge), „Anträge zuweisen" (50/50-Split-Cockpit mit Top-3-Match-Vorschlägen), „Auslastung MA" (Statistik + MA-Liste + Kapazität pro Quartal; je MA zwei getrennte Balken-Spalten: „Aktuelles Quartal" = Kapazitäts-Auslastung in % (rot bei Überbuchung) und „Altlasten (Rückstand)" = offene Anträge aus bis zu 7 Vorquartalen, gedämpfte Blau-Rampe dunkel→hell = neu→alt; daneben die Zahlenspalten Aktuell/Altlast./Frei), „Kompetenzen & Jahreskapazitäten" (Kompetenz-Matrix, XLSX-Upload), „Einstellungen" (Kategorien, CSV-Import/Export, Themen-Vektoren). MAs erscheinen überall nur als anonyme ID (MA01–MAxx).

**Datenmodell dahinter:** Sidecar `_intern/auslastung.json` (Konfiguration, Kategorien, Klassifizierungen, Mitarbeiter-Profile, Zuweisungen) + `_intern/auslastung-kuerzel-map.json` (Kürzel↔anonId-Mapping). Dreistufiges Matching (Boolean → Regel-Mapping → Embedding-Centroid). Persönliche Profile liegen im User-Ordner (`auslastung-profil.json`).

**Typische Aktionen:**
- Klassifizierungs-Vorschläge pro Verbund prüfen/bestätigen
- Anträge an MAs zuweisen (Top-3-Vorschläge nutzen)
- Kapazität/Auslastung pro Quartal einsehen
- Kompetenz-XLSX hochladen, Kompetenz-Matrix pflegen
- Kategorien/Konfiguration in den Einstellungen anpassen
- MA-seitig: eigene Technologien/Präferenzen pflegen, Anträge „übernehmen"

**Code:** `src/plugins/auslastung/` — Hauptdateien: `index.tsx` (Plugin-Registrierung), `views/AuslastungView.tsx` (Tab-Layout), `views/KlassifizierungsReview.tsx`, `views/ZuweisungsCockpit.tsx`, `views/UebersichtView.tsx`.
