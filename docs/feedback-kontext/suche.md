# Suche

## Zweck

Nutzer durchsucht Förderanträge und Dokumente programmweit mit einer hybriden Suche (Wortlaut + optional Wortstämme + optional semantische Ähnlichkeit), sieht je Treffer die Fundstelle mit Relevanz und kann Treffer per KI begründen lassen.

## UI-Elemente & Begriffe

- **Kopfzeile:** Titel „Suche" · **Gespeicherte Suchen** (Menü, gerätelokal, mit Trefferzahl und letztem Lauf) · **Diese Suche speichern** · Hilfe.
- **Suchfeld** oben — mehrzeilig und an der Ecke in beide Richtungen ziehbar (die Größe wird gemerkt). Enter startet/übernimmt, Shift+Enter macht einen Zeilenumbruch.
- **Optionszeile** darunter, vier Elemente:
  - **„Wortverknüpfung":** alle Wörter (UND, Standard) · irgendein Wort (ODER) · genaue Wortfolge. Wirkt auf Wortlaut-Treffer.
  - **„Wortformen mitsuchen":** dasselbe Wort in anderer Form — deterministischer Wortstamm-Vergleich („Normen" findet „Normung"). Kostenlos, lädt nichts nach.
  - **„Suchen in":** **alle Felder** (Standard) · nur Titel & Kurzbeschreibung · nur Dokumente · nur Einrichtung · nur Ort & Bundesland. „alle Felder" heißt wörtlich alle: Titel, Kurzbeschreibung, Deskriptoren, Akronym, Aktenzeichen, Einrichtung, Web-Adresse, Ort und Bundesland — dazu die Dokumente. Wer nicht weiß, wo sein Wort steht, muss es nicht wissen. Jede andere Wahl nimmt etwas weg und markiert sich deshalb farbig. „nur Einrichtung" umfasst neben Antragsteller und ausführender Stelle auch die **Web-Adresse** — sonst wären Einrichtungen, die ihr Kürzel nicht im Namen führen, über das Kürzel unauffindbar („GMBU" steht in keinem Namensfeld, wohl aber in `gmbu.de`).
  - **„Ähnlichkeitssuche":** dasselbe Thema in anderen Worten — semantische Treffer, lädt beim ersten Mal ein Embedding-Modell (~200 MB). Nicht zu verwechseln mit „Wortformen mitsuchen": der eine Schalter geht über das Wort, der andere über den Inhalt.
  - Rechts der **Index-Hinweis** („Index: 14.225 Anträge · n Textabschnitte").
- **Deutungszeile „Gesucht wird":** die Suchwörter als **abwählbare** Chips (gelb), dazwischen der Operator (UND/ODER/„gefolgt von"), dahinter die gefundenen Wortstamm-Varianten (türkis, ebenfalls abwählbar). Ein abgewähltes Wort fällt aus der Suche — das Feld bleibt unverändert.
- **Facettenzeile:** Status · Antragstyp · Jahr · Trefferstelle, je mit Trefferzahl. Gesetzte Filter erscheinen zusätzlich als entfernbarer Chip, daneben „Filter zurücksetzen".
- **Ergebniskopf:** „n Treffer in m Anträgen" · **Darstellung** (Sortierung + Dichte in einem Menü) · **Liste/Tabelle** · **Spalten** (nur in der Tabelle) · **Mit KI analysieren** (öffnet den Assistenten) · **Alle begründen** · **Begründungen entfernen** · **Export-Menü** (CSV / XLSX / Zwischenablage).
- **Trefferliste** (Standard), drei Zeilen je Treffer:
  - Kopfzeile: FKZ · Status · Bewilligungsdatum · Trefferstellen-Tags mit Anzahl.
  - Titel, Suchwörter markiert — klickt in den Antrag.
  - Fundstelle: Textstelle mit Quellenangabe bzw. Antragsteller/Akronym, dahinter die Belege, die sonst nirgends stünden („Ort Dresden · Sachsen", „Deskriptoren …", „Web-Adresse gmbu.de", ebenfalls markiert).
  - Rechts am Rand: Relevanzbalken (hoch/mittel/gering) und **„Warum?"**.
- **„Warum?"** klappt die KI-Begründung unter der Zeile auf, mit den Aktionen **Antrag öffnen** · **Ähnliche Anträge** · **Als unpassend melden** (öffnet das Feedback-Formular vorbefüllt; ändert kein Ranking). Ist keine interne KI verbunden, öffnet „Warum?" **keinen** KI-Tab, sondern den app-weiten Verbinden-Dialog; im aufgeklappten Bereich steht der Grund.
- **Ergebnistabelle** (Alternative): sortier-/filterbare, konfigurierbare Spalten. Die Suchwörter sind auch hier markiert (Titel/Inhalt, FKZ bzw. Dateiname, AST, Ort AST, Ort & Bundesland, Deskriptoren, Web-Adresse); Sortierung, Filter und Export arbeiten weiter auf dem Rohwert.
- **Automatisch eingeblendete Spalten:** Wer in „nur Ort & Bundesland" sucht — oder wessen Treffer im Ort, in den Deskriptoren oder in der Web-Adresse gefunden wurden —, bekommt die zugehörige Spalte dazu, damit sichtbar ist, warum ein Treffer erscheint. Im Aufklapper „Spalten" stehen sie angehakt mit der Marke „auto"; sie ändern die persönliche Spaltenwahl nicht und verschwinden mit ihrem Grund wieder.
- **Mehrfachauswahl:** Kästchen je Zeile, dunkle Leiste unten mit Exportieren · Mit KI vergleichen · Auswahl leeren.
- **ASSISTENT-Streifen** am rechten Rand (auf jeder Seite): schaltet hier das andockende KI-Chat-Panel mit den Treffern als Kontext.
- **Startzustand** (noch nichts getippt): vier Spalten — letzte Suchen, gespeicherte Suchen, häufig gesucht (je mit echter Trefferzahl) und „Aus dem Index" mit den Beispiel-Chips. Fehlt der Dokumentenindex, steht unten eine gedämpfte Info-Zeile (kein Button — der Index ist Kurator-Aufgabe).
- **Kein-Treffer-Zustand:** „Keine Treffer für …" plus geprüfte Anpassungen mit ihrer echten Trefferzahl (Wort weglassen, ODER statt UND, Wortstämme an, Filter entfernen). Hilft nichts, sagt der Zustand das offen.
- **Status-Badges:** „Embedding-Modell lädt…", die Lade-Phasen (Wortlaut-/Ähnlichkeits-/Dokumente-Treffer) und der laufende Begründungs-Batch mit „Abbrechen".

## Typische Aktionen

- Suchbegriff eingeben (oder Beispiel-Chip im Startzustand klicken), Treffer durchsehen
- In der Deutungszeile ein Wort oder eine Stamm-Variante abwählen und die Treffermenge korrigieren
- Zwischen „alle Wörter", „irgendein Wort" und „genaue Wortfolge" umschalten
- Den Suchbereich einschränken, z. B. den Firmennamen ausschließen (die Auswahl färbt sich, solange sie nicht auf „alle Felder" steht)
- Nach Status, Antragstyp, Jahr oder Trefferstelle filtern
- Zwischen Liste und Tabelle wechseln, Sortierung und Dichte im Darstellungs-Menü einstellen
- Einen Treffer per „Warum?" begründen lassen oder alle auf einmal
- Assistenten öffnen (Streifen rechts oder „Mit KI analysieren") und zu den Treffern fragen
- Eine Suche speichern und später aus dem Menü oder dem Startzustand erneut ausführen
- Ergebnisse als CSV/XLSX exportieren oder in die Zwischenablage kopieren
- Auf einen Treffer klicken → springt zur Antrags-Detailseite; von dort führt „Zurück zur Suche" (oder der Browser-Zurück-Knopf) auf dieselben Treffer zurück

## Technik

**Datenmodell dahinter:** Orama-Hybrid-Index (BM25 + Vektor via EmbeddingGemma) über Anträge + Dokumente; Ergebnisse als `UnifiedSearchResult` mit `trefferfelder`, `relevanzStufe` und optionaler `textstelle`. Dokumenttreffer mit bekanntem Antrag werden unter diesen gefaltet. Der Score trägt die berechnete Relevanz (Feldgewicht × Breite × Wort-Abdeckung) — Details in [suche-relevanz.md](../architecture/suche-relevanz.md). Sucheinstellungen in `useSuchVerknuepfung` + `useSuchOptionen`; Anfrage, Facettenwahl und abgewählte Wörter liegen sitzungs-lokal im `useSucheStore`, Ansicht/Sortierung/Dichte persistiert.

**Code:** `src/plugins/suche/` — `SuchSeite.tsx` (Orchestrator), `SuchOptionenZeile`/`DeutungsZeile`/`FacettenZeile`/`TrefferListe`/`TrefferZeile`/`SucheStartzustand`/`KeinTrefferZustand` (Ansicht), `deutung.ts`/`facetten.ts`/`auswege.ts`/`gespeicherteSuchen.ts`/`darstellungsAchsen.ts` (reine Logik), `analyse/pipeline.ts` (KI-Begründungen), `herkunft.ts` (Rückweg aus dem Antrags-Detail). Such-Schicht: `src/core/services/search/trefferstelle.ts`, `wortstamm.ts`, `suchbereich.ts`, `markierung.ts`.
