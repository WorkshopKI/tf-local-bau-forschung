# Suche

## Zweck

Nutzer durchsucht Förderanträge und Dokumente programmweit mit einer hybriden Suche (Wortlaut + optional Wortstämme + optional semantische Ähnlichkeit), sieht je Treffer die Fundstelle mit Relevanz und kann Treffer per KI begründen lassen.

## UI-Elemente & Begriffe

- **Kopfzeile:** Titel „Suche" · **Gespeicherte Suchen** (Menü, gerätelokal, mit Trefferzahl und letztem Lauf) · **Diese Suche speichern** · Hilfe.
- **Suchfeld** oben — mehrzeilig und an der Ecke in beide Richtungen ziehbar (die Größe wird gemerkt). Enter startet/übernimmt, Shift+Enter macht einen Zeilenumbruch.
- **Feld direkt in der Eingabe:** `ast:Fraunhofer`, `fkz:16KN08`, `ort:Dresden` — vor dem Doppelpunkt steht das Feld, dahinter der Wert (auch mit Leerzeichen: `FKZ: 16KN08`). Feldnamen: `titel` · `inhalt` · `akronym` · `fkz` · `vb` · `ast` · `ort` · `deskriptor` · `web` · `nw` · `wahlkreis` · `notiz`, dazu die Spaltencodes der Fördertabelle (`ORG_AST:`, `VB_TITEL:`, `ORT_AST:` …). Mehrere Felder in einer Anfrage sind erlaubt (`titel:Laser ort:Dresden`).
- **Die Kennzeichen:** `fkz:` findet das Teilvorhaben in beiden Schreibweisen — als Förderkennzeichen (`16KN065624`) und als Aktenzeichen des Fachsystems (`KNF065624`); `akz:` und `kennzeichen:` sind dasselbe Feld. `vb:` findet den **Verbund** und damit alle seine Teilvorhaben auf einmal (`vb:ZKN073232` → 9). Das Netzwerk heißt seit v4.53 `nw:` (`netz:` wird weiter gelesen).
- Ein genanntes Feld **schlägt die Auswahl „Suche in"** und gilt nur für sein Wort; Wörter ohne Präfix folgen weiter dem Dropdown. Solange ein Feld genannt ist, laufen **Dokumentenindex und Ähnlichkeitssuche nicht mit** — beide können eine Feldangabe nicht einhalten; die Deutungszeile schreibt „· nur in den Antragsfeldern" dazu. Ein unbekanntes Wort vor dem Doppelpunkt bleibt gewöhnlicher Suchtext (`projekt:laser`).
- **Optionszeile** darunter, fünf Elemente:
  - **Art der Suche** (noch in Erprobung, nicht in allen Ausgaben der App vorhanden): „mit Stichworten suchen" (Standard) · „mit natürlicher Sprache suchen". Im Frage-Modus wird nicht beim Tippen gesucht — die Frage geht per **Enter** oder über den Knopf **„Frage stellen"** neben dem Feld an die interne KI, die daraus Suchbegriffe macht. Ist die interne KI nicht verbunden, öffnet sich der app-weite Verbinden-Dialog; die Eingabe bleibt stehen.
  - **„Wortverknüpfung":** alle Wörter (UND, Standard) · irgendein Wort (ODER) · genaue Wortfolge. Wirkt auf Wortlaut-Treffer. Sobald eine Frage übersetzt ist, steht daneben **„von der KI bestimmt"** und die Auswahl ist ausgegraut: der Plan verknüpft seine Begriffe immer mit ODER, sonst könnte die Wertung nicht zählen, wie viele der gefragten Sachen ein Vorhaben behandelt. „Wortformen mitsuchen" gibt aus demselben Grund ab — die KI hat die Wortformen selbst benannt.
  - **„Wortformen mitsuchen":** dasselbe Wort in anderer Form — deterministischer Wortstamm-Vergleich („Normen" findet „Normung"). Kostenlos, lädt nichts nach.
  - **Suchbereich:** eine Auswahl, deren Optionen die Frage selbst tragen — „Suche in: **alle Felder**" (Standard) · „… nur Titel & Kurzbeschreibung" · „… nur Dokumente" · „… nur Einrichtung" · „… nur Ort, Bundesland & Wahlkreis". Daneben steht keine Beschriftung mehr: aufgeklappt liegt die Liste über der Seite, dort steht jede Zeile für sich.
  - „alle Felder" heißt wörtlich alle: Titel, Kurzbeschreibung, Deskriptoren, Akronym, Aktenzeichen, Verbundkennzeichen, Einrichtung, Web-Adresse, Ort und Bundesland, Netzwerk, Wahlkreis und die Arbeitsnotizen — dazu die Dokumente. Wer nicht weiß, wo sein Wort steht, muss es nicht wissen. Jede andere Wahl nimmt etwas weg und markiert sich deshalb farbig. „nur Einrichtung" umfasst neben Antragsteller und ausführender Stelle auch die **Web-Adresse** — sonst wären Einrichtungen, die ihr Kürzel nicht im Namen führen, über das Kürzel unauffindbar („GMBU" steht in keinem Namensfeld, wohl aber in `gmbu.de`).
  - **„Ähnlichkeitssuche":** dasselbe Thema in anderen Worten — semantische Treffer, lädt beim ersten Mal ein Embedding-Modell (~200 MB). Nicht zu verwechseln mit „Wortformen mitsuchen": der eine Schalter geht über das Wort, der andere über den Inhalt.
  - Rechts der **Index-Hinweis** („Index: 14.225 Anträge · n Textabschnitte").
- **Deutungszeile „Gesucht wird":** die Suchwörter als **abwählbare** Chips (gelb), dazwischen der Operator (UND/ODER/„gefolgt von"), dahinter die gefundenen Wortstamm-Varianten (türkis, ebenfalls abwählbar). Ein abgewähltes Wort fällt aus der Suche — das Feld bleibt unverändert. Trug ein Wort ein Feld-Präfix, steht das Feld im Chip selbst („Einrichtung: GMBU"); das Präfix bleibt beim Abwählen anderer Wörter erhalten.
- **Dieselbe Zeile nach einer Frage, dann „Gesucht wurde nach":** ein Chip je **Leitbegriff**, mit einem Zähler für seine weiteren Schreibweisen („Normung **+4**"; der Tooltip nennt sie vollständig). Ein Leitbegriff, den die Frage als **Einschränkung** nennt, steht hinter „UND NUR" und trägt sein Feld („Ort: Bayern") — er muss zutreffen, während die Themen Alternativen bleiben. Abwählen wirkt sofort und kostet **keinen** weiteren KI-Aufruf. Was aus der Frage nicht übersetzt werden konnte, steht am Ende der Zeile („· nicht berücksichtigt: …") — es wird benannt, nicht verschwiegen.
- **Facettenzeile:** Status · Antragstyp · Jahr · Trefferstelle, je mit Trefferzahl. Gesetzte Filter erscheinen zusätzlich als entfernbarer Chip, daneben „Filter zurücksetzen".
- **Ergebniskopf:** „n Treffer in m Anträgen" — solange der erste Lauf einer Anfrage noch läuft, steht dort „… Treffer" statt einer Zahl (eine 0 vor der Messung wäre kein Ergebnis) · **Darstellung** (Sortierung + Dichte in einem Menü) · **Liste/Tabelle** · **Spalten** (nur in der Tabelle) · **Mit KI analysieren** (öffnet den Assistenten) · **Alle begründen** · **Begründungen entfernen** · **Export-Menü** (CSV / XLSX / Zwischenablage).
- **Trefferliste** (Standard), drei Zeilen je Treffer:
  - Kopfzeile: FKZ · Status · Bewilligungsdatum · Trefferstellen-Tags mit Anzahl.
  - Titel, Suchwörter markiert — klickt in den Antrag.
  - Fundstelle: Textstelle mit Quellenangabe bzw. Antragsteller/Akronym, dahinter die Belege, die sonst nirgends stünden („Ort Dresden · Sachsen", „Deskriptoren …", „Web-Adresse gmbu.de", „Netzwerk »LOHCmobil« 16KN065602_AM", „Wahlkreis …", „Notiz …", „Verbund-Nr. ZKN073232", ebenfalls markiert).
  - Rechts am Rand: Relevanzbalken (hoch/mittel/gering) und **„Warum?"**.
- **„Warum?"** klappt die KI-Begründung unter der Zeile auf, mit den Aktionen **Antrag öffnen** · **Ähnliche Anträge** · **Als unpassend melden** (öffnet das Feedback-Formular vorbefüllt; ändert kein Ranking). Ist keine interne KI verbunden, öffnet „Warum?" **keinen** KI-Tab, sondern den app-weiten Verbinden-Dialog; im aufgeklappten Bereich steht der Grund.
- **Ergebnistabelle** (Alternative): sortier-/filterbare, konfigurierbare Spalten. Die Suchwörter sind auch hier markiert (Titel/Inhalt, FKZ bzw. Dateiname, Verbund-Nr., AST, Ort AST, Ort & Bundesland, Deskriptoren, Web-Adresse, Netzwerk, Wahlkreis, Notiz); Sortierung, Filter und Export arbeiten weiter auf dem Rohwert.
- **Automatisch eingeblendete Spalten:** Wer im Ortsbereich sucht — oder wessen Treffer im Ort, in den Deskriptoren, in der Web-Adresse, im Netzwerk, im Wahlkreis, in einer Arbeitsnotiz oder über das Verbundkennzeichen gefunden wurden —, bekommt die zugehörige Spalte dazu, damit sichtbar ist, warum ein Treffer erscheint. Im Aufklapper „Spalten" stehen sie angehakt mit der Marke „auto"; sie ändern die persönliche Spaltenwahl nicht und verschwinden mit ihrem Grund wieder.
- **Mehrfachauswahl:** Kästchen je Zeile, dunkle Leiste unten mit Exportieren · Mit KI vergleichen · Auswahl leeren.
- **ASSISTENT-Streifen** am rechten Rand (auf jeder Seite): schaltet hier das andockende KI-Chat-Panel mit den Treffern als Kontext.
- **Startzustand** (noch nichts getippt): vier Spalten — letzte Suchen, gespeicherte Suchen, häufig gesucht (je mit echter Trefferzahl) und „Aus dem Index". Fehlt der Dokumentenindex, steht unten eine gedämpfte Info-Zeile (kein Button — der Index ist Kurator-Aufgabe).
- **„So kannst du suchen"** darunter, über die ganze Breite: neun Beispiele mit je einer Erklärung (ein Thema · zwei Wörter · Förderkennzeichen · `vb:ZKN073232` · `nw:ProAnimalLife` · `ast:Fraunhofer` · `ort:Dresden` · `titel:Laser ort:Dresden` · `notiz:Einbehalt`). Jede Zeile ist anklickbar und führt die Suche aus; darunter stehen die erlaubten Feldnamen.
- **„Oder stell eine Frage"** (nur, wo die Frage-Suche freigeschaltet ist): drei Beispielfragen in ganzen Sätzen. Ein Klick setzt Frage **und** Modus und startet die Übersetzung — eine Frage, die als Stichwortsuche liefe, fände nichts.
- **Kein-Treffer-Zustand:** „Keine Treffer für …" plus geprüfte Anpassungen mit ihrer echten Trefferzahl (Wort weglassen, ODER statt UND, Wortstämme an, Filter entfernen). Hilft nichts, sagt der Zustand das offen.
- **Status-Badges:** „Embedding-Modell lädt…", die Lade-Phasen (Wortlaut-/Ähnlichkeits-/Dokumente-Treffer) und der laufende Begründungs-Batch mit „Abbrechen".

## Typische Aktionen

- Suchbegriff eingeben (oder Beispiel-Chip im Startzustand klicken), Treffer durchsehen
- Auf „mit natürlicher Sprache suchen" umschalten und eine ganze Frage stellen, statt die Wortformen des Bestands zu erraten
- In der Deutungszeile ein Wort, eine Stamm-Variante oder einen Leitbegriff der Frage abwählen und die Treffermenge korrigieren
- Zwischen „alle Wörter", „irgendein Wort" und „genaue Wortfolge" umschalten
- Den Suchbereich einschränken, z. B. den Firmennamen ausschließen (die Auswahl färbt sich, solange sie nicht auf „alle Felder" steht)
- Ein Feld direkt in der Eingabe nennen (`ast:Fraunhofer`, `fkz:16KN08`) — oder ein Beispiel unter „So kannst du suchen" anklicken, das es vormacht
- Nach Status, Antragstyp, Jahr oder Trefferstelle filtern
- Zwischen Liste und Tabelle wechseln, Sortierung und Dichte im Darstellungs-Menü einstellen
- Einen Treffer per „Warum?" begründen lassen oder alle auf einmal
- Assistenten öffnen (Streifen rechts oder „Mit KI analysieren") und zu den Treffern fragen
- Eine Suche speichern und später aus dem Menü oder dem Startzustand erneut ausführen
- Ergebnisse als CSV/XLSX exportieren oder in die Zwischenablage kopieren
- Auf einen Treffer klicken → springt zur Antrags-Detailseite; von dort führt „Zurück zur Suche" (oder der Browser-Zurück-Knopf) auf dieselben Treffer zurück

## Technik

**Datenmodell dahinter:** Orama-Hybrid-Index (BM25 + Vektor via EmbeddingGemma) über Anträge + Dokumente; Ergebnisse als `UnifiedSearchResult` mit `trefferfelder`, `relevanzStufe` und optionaler `textstelle`. Dokumenttreffer mit bekanntem Antrag werden unter diesen gefaltet. Der Score trägt die berechnete Relevanz (Feldgewicht × Breite × Wort-Abdeckung) — Details in [suche-relevanz.md](../architecture/suche-relevanz.md). Sucheinstellungen in `useSuchVerknuepfung` + `useSuchOptionen`; Anfrage, Facettenwahl und abgewählte Wörter liegen sitzungs-lokal im `useSucheStore`, Ansicht/Sortierung/Dichte persistiert.

**Natürliche Sprache** (Flag `sucheNatuerlicheSprache`, dev + pl)**:** Die interne KI übersetzt die Frage in einen **Frageplan** (Leitbegriffe mit ihren Schreibweisen, Einschränkungen, Status-/Jahr-Facetten) — genau EIN Aufruf, nur intern, Ziel `standard`, kein Retry. Die Suchstufe läuft danach unverändert weiter: ein Leitbegriff wird ein Suchteil, seine Schreibweisen dessen Nadeln, und `abdeckung` zählt damit die gefragten SACHEN statt der Schreibweisen. Der Plan liegt sitzungs-lokal im `useSucheStore` und stirbt, sobald der Feldtext von der Frage abweicht. Ohne Plan verhält sich die Suche bitweise wie zuvor — Details in [suche-relevanz.md §8](../architecture/suche-relevanz.md).

**Code:** `src/plugins/suche/` — `SuchSeite.tsx` (Orchestrator), `SuchOptionenZeile`/`DeutungsZeile`/`FacettenZeile`/`TrefferListe`/`TrefferZeile`/`SucheStartzustand`/`KeinTrefferZustand` (Ansicht), `deutung.ts`/`facetten.ts`/`auswege.ts`/`gespeicherteSuchen.ts`/`darstellungsAchsen.ts` (reine Logik), `analyse/pipeline.ts` (KI-Begründungen), `herkunft.ts` (Rückweg aus dem Antrags-Detail). Such-Schicht: `src/core/services/search/trefferstelle.ts`, `wortstamm.ts`, `suchbereich.ts`, `feldpraefix.ts` (Feld in der Eingabe), `markierung.ts`, `frageplan.ts` + `frageplan-lauf.ts` (natürliche Sprache).
