# Förderanträge

## Zweck

Zentrale Arbeitsseite für Förderanträge — suchen/filtern, bearbeiten, Status/Dokumente verwalten.

## UI-Elemente & Begriffe

- **Liste links:** sortier-/gruppierbar. Bei offenem Detail schrumpft sie zur **Kompakt-Spalte** und lässt sich ganz einklappen (**Fokus-Modus**: alle Listen-Werkzeuge weg, Titel + „Aufnehmen" bleiben). Je Ordner des Fachsystems ist in der Tabelle eine Statusspalte einblendbar.
- **Drei Schalter über der Liste**, frei kombinierbar:
  - **Ansicht** (nur Tabelle) — was eine Zeile ist. „Antrag" (Standard) zeigt einen Verbund als **eine** Zeile mit der Anzahl seiner Teilvorhaben am FKZ; „Antrag mit TV" faltet ihn auf und gibt jedem Teilvorhaben eine eigene Zeile.
  - **Gruppierung** — die Abschnitts-Bänder darüber: **Keine**, **Status**, **NW** (Netzwerk, aus dem 16KN-Förderkennzeichen; Bänder heißen nach dem Netzwerk-Akronym, alles ohne Netzwerk steht gesammelt am Ende), **FB** (TIB-Kürzel) und **AB** (BIB-Kürzel) — die beiden letzten alphabetisch, Zeilen ohne Kürzel im letzten Abschnitt.
  - **Beendet** (nur Reiter „Alle") — ob abgeschlossene und abgelehnte Anträge in der Liste stehen. Standard **ausgeblendet**: unter der Liste steht dann ein Streifen „Beendet 2.474 · Schlussvermerk 1.364 · abgelehnt/zurückgez. 1.110", ein Klick blendet sie ein. Der Schalter gilt unter **jeder** Gruppierung; bei „Gruppierung: Keine" trennen zwei Bänder (**Arbeitsvorrat** / **Beendet**) die eingeblendeten Hälften. Eine laufende Suche zeigt den ausgeblendeten Teil immer — sonst fehlten Treffer.
  - Karten- und Listen-Ansicht haben nur Gruppierung (Keine/Status/NW/NW-Größe) und Beendet — dort werden Verbünde nicht verdichtet.
- **Zuständigkeits-Spalten:** das Fachsystem führt je Rolle **und** je Phase eine eigene Spalte — Antragsphase **TIB** (FB) / **BIB** (AB), Begleitphase **ZTP** (FB) / **PFM** (AB). BIB ist ab Werk eingeblendet, die übrigen über „Spalten". Sie erklären den Reiter **Begleitung**: der zeigt Anträge mit einem Begleit-Status, gefiltert nach dem eigenen Kürzel in den **Antragsphasen**-Spalten — ein Antrag steht dort also auch dann, wenn ihn inzwischen jemand anderes begleitet. Der Profil-Haken „Begleitungen einschließen" nimmt ZTP/PFM in diesen Filter auf.
- **Der Spalten-Picker ist nach Rubriken geordnet:** Antrag · Zuständigkeit · Status · Termine · Ordner · Teilvorhaben · Ordner · Verbund. Die beiden Ordner-Rubriken sind getrennt, weil beide Ebenen gleichnamige Ordner führen („Antragsbearbeitung"). Die Kürzel-Spalten nennen im Menü zusätzlich ihre Rolle.
- **FKZ** `16KN######` / `16EP######`: beim Überfahren einer Zeile erscheint rechts vom FKZ ein **Kopier-Icon** (Verbund-Zeile: das Verbund-FKZ).
- **Spaltenfilter „Antragseingang"** (Chevron im Spaltenkopf): zweistufig **Jahr → Monat**, neueste zuerst, Jahre beim Öffnen zugeklappt. Das Häkchen am Jahr wählt alle seine Monate. „Werte suchen…" findet Monatsnamen **und** Jahreszahlen und klappt die Treffer vorübergehend auf. Zeilen ohne lesbares Datum stehen als **„(leer)"** am Ende und bleiben damit wählbar.
- **Filter:** als drittes Panel. Der Bereich **Status** ist ein Checkbox-Baum ZAH-Phase → Status: das Häkchen an der Phase wählt alle ihre Stati (Balken = teilweise), Shift-Klick tut dasselbe. Bedienbar mit Pfeiltasten und Pos1/Ende. „Status suchen…" findet auch über abweichende Schreibweisen („Nachforderung gestellt" für „NF gestellt"); nach dem Leeren steht der vorherige Aufklapp-Zustand wieder. Maus auf einen Status zeigt Gruppe, Anzahl und Herkunft (kuratiert vs. „nicht im Katalog").
- **Alle Zähler der Seite zählen Teilvorhaben** — die Reiter oben (Antragsphase / Begleitung / Diese Woche / Überfällig / Bewilligt / Alle), die Pille **„Status in dieser Sicht"** und die **Trefferzahl** rechts über der Liste. Die Zahl an einer Status-Pille ist genau die Trefferzahl, die ihr Klick liefert.
  - Die Pille fasst die neun **Arbeitslisten** zu fünf Töpfen zusammen: **Vor Entscheidung** (zu bearbeiten + in Arbeit + entscheidungsreif), **Wartet auf Antragsteller**, **Bewilligt**, **Begleitung**, **Beendet** (erledigt + abgelehnt). In der Leiste stehen Kurzformen („Vor Entsch.", „Bei Antragst."), der volle Name im Tooltip. Zusammenfassungen tragen bewusst einen eigenen Namen — sonst hieße ein Reiter wie eine der Kategorien darin ([status-achsen.md](../architecture/status-achsen.md)).
  - Dieselben Namen tragen die **Abschnittsköpfe** bei „Gruppiert: Status"; im Reiter „Alle" trennt zusätzlich der Schalter **Beendet** den **Arbeitsvorrat** (noch in Arbeit) vom Beendeten.
  - **Antragsphase** (TIB/BIB, +90 Tage) und **Begleitung** (ZTP/PFM, +6 Monate ab D_VBE) ersetzen den alten Reiter „Offen"; fehlt D_VBE, bleibt die Frist leer. „Offen" ist jetzt nur die Status-Phase; der Profil-Haken „Begleitungen einschließen" blendet nichts aus, steuert nur das ZTP-/PFM-Matching.
  - Die **Trefferzahl** nennt ihre Einheit: „294 Teilvorhaben"; fasst sie mehrere Teilvorhaben zu einer Zeile zusammen (Ansicht „Antrag" in der Tabelle, Status-/Netzwerk-Gruppierung in der Listen-Ansicht), steht die Zeilenzahl daneben: „17 Teilvorhaben · 12 Verbund-Zeilen". Ohne Treffer verschwindet sie ganz — nie die Zahl der vorherigen Auswahl.
- **Betrachtungsbereich-Chip** im Seitenkopf: „Anzeige: letzte 3 Richtlinien (12 Programme) · 1.866 ausgeblendet". Er sagt, welche Förder-Richtlinien zum Arbeitsvorrat zählen und wie viele Anträge das ausblendet. Gemeint sind die drei jüngsten ZIM-Generationen — 2015, 2020, 2025; draußen bleibt nur die Generation 2012.
  - **Klick öffnet die Auswahl:** Standard-Bereich / alle Richtlinien / eigene Liste, mit Klartext-Namen und **nach Generation gruppiert** („Richtlinie 2025 / 2020 / 2015").
  - **Eigene Auswahl:** der Chip sagt dann „Anzeige: eigene Auswahl (N Programme)", und das Panel nennt, wovon sie abweicht.
  - Die **Suche bleibt immer am ganzen Bestand** — Treffer außerhalb sind gekennzeichnet und lassen sich öffnen.
- **Detail rechts:** Kopf (Titel + Meta + Stepper, rechts „Antrag-Aufbereitung öffnen"), klappbare **Kurzbeschreibung** (offen), Gutachten-Werkstatt, dann — eingeklappt — „Antragsdaten" (Fakten + Verbundpartner/Teilvorhaben), Artefakt-Werkbank, „Alle Felder", „Historie".
  - **„Status & Verlauf":** die **ZAH-Phase** des amtlichen Status; **Chronik** der Termine oder **Zeitstrahl**; darunter **Offene Aufgaben** je Teilvorhaben und je Rolle mit „warum?"-Herleitung (geliehene Einträge sind als solche markiert); darunter **Belegte Änderungen** aus dem Änderungs-Journal — was sich seit dem Nullpunkt wirklich geändert hat, auch wo der Export die frühere Setzung inzwischen überschrieben hat; unklare Zeiträume stehen als Spanne. Der Nullpunkt steht immer dabei, und ein Antrag, für den kein Journal geführt wird, sagt das ausdrücklich. Zuletzt die **Statuseinträge** nach den Ordnern des Fachsystems, rollen-vorgefiltert.
  - **„Nächste Schritte (in C16 zu setzen)":** die Kürzel, deren Trigger-Vorbedingungen zum aktuellen Status passen, mit Wirkung und Rolle, vorgefiltert auf die eigene Rolle; die App setzt nichts selbst. Maßgeblich sind **nur die Trigger der Richtlinie des Vorhabens** (FM-Nummer): fehlen sie, steht das da („Für Programm 47 sind keine Trigger importiert"); die einer anderen werden nie ersatzweise gezeigt. **Testkürzel** (TTV1/TTV2/TVB1) stehen nicht in der Liste, die Fußzeile zählt sie.
  - **Info-Icon am Status:** beantwortet „warum dieser Status?" aus den amtlichen Daten — Code, Text, seit wann, letzter Vorgang, ausgelöste Trigger. Es benennt die **Ebene** und stellt einen abweichenden Status der Gegenseite darunter („Verbund-Status: 31 · beantragt / TV-Status: 72 · …").
  - **Kürzel und Codes sind erklärt:** in den Regelsätzen des Info-Icons und unter „Nächste Schritte" ist gepunktet unterstrichen, wozu der Katalog eine Bezeichnung führt — Maus darauf zeigt sie an. Kürzel nennen zusätzlich, wer sie setzt, Statuscodes ihre ZAH-Phase, die Rollenkürzel ihren Klartext. Ohne Unterstreichung heißt: dazu ist nichts hinterlegt — entweder kennt der Katalog das Zeichen nicht, oder die Zeile ist gar nicht gedeutet.
  - **„Fristen & Meilensteine":** Prognose + Restzeit.
  - **Offenes Teilvorhaben:** Felder, Netzwerk, Dokumente.

## Gutachten-Werkstatt (wenn aktiv)

- **„Dokumente des Verbundes"** (oben): Typ + Umfang je Datei, maßgebliche **Vorhabensbeschreibung** markiert; weitere per „ins Gutachten aufnehmen".
- **Kontext-Warnung** über der Karte, wenn die Unterlagen nicht ins Fenster der gewählten KI passen: sie nennt die fehlenden Zeichen und empfiehlt entweder den Wechsel auf die andere KI (deren Fenster ist rund viermal so groß) oder das Kürzen der Unterlagen. Sie erscheint **vor** dem Erzeugen, blockiert aber nichts.
- **Noch nicht generierter Abschnitt:** „{Abschnitt} generieren" + **Persönlicher Stil** + **Prompt ansehen**.
- **„Prompt ansehen":** zeigt den vollständigen Auftrag, der an die KI geht — als Vorschau des nächsten Laufs und, nach einem Lauf, als das tatsächlich Gesendete. Oben die Maße (Zeichen gesamt, davon Vorhabensbeschreibung, geschätzte Tokens, Platz im Fenster), darunter die Liste der enthaltenen Bausteine, darunter der Wortlaut. Die Vorhabensbeschreibung ist eingeklappt. Wer die Werkstatt öffnen darf, findet in der Fußzeile zusätzlich **„Anweisung bearbeiten"**.
- **„Anweisung an die KI bearbeiten"** (Stift am Abschnittskopf; sichtbar für pl, as, dev und den angemeldeten Kurator): Prompt-Vorlage, Umfang &amp; Form, Abnahme-Kriterien und die **Regeln dieses Abschnitts** direkt am Antrag ändern, ohne in die Skill-Verwaltung zu wechseln.
  - **Regeln:** ein Stift je Regel öffnet ihre Parameter im selben Dialog, „+ Neue Regel" legt eine an. Die Schritte des Gutachtens liegen hinter „← Alle Schritte".
  - **„Was daraus wirklich an die KI geht"** (aufklappbar unter der Vorlage): Maße, die Reihenfolge der angehängten Bausteine und der Wortlaut ohne die Vorhabensbeschreibung. Die Vorlage ist nicht der fertige Auftrag — was weiter unten hängt, hat das letzte Wort.
  - **Ein Band oben erinnert:** Änderungen gelten **für alle Nutzer**. Wer nur seinen eigenen Ton verschieben will, wird auf „Persönlicher Stil" verwiesen.
  - **Warnung**, wenn ein Platzhalter wie `{{vbMarkdown}}` herausgelöscht wurde: der nächste Lauf sieht den Antrag dann nicht mehr und schreibt trotzdem — ohne Fehlermeldung.
  - **Nach dem Speichern** meldet ein Band über der Karte die neue Version und bietet „Abschnitt neu erzeugen" an; bei freigegebenem Abschnitt stattdessen „Erneut öffnen". Nie automatisch.
- **Abschnitts-Karte**, vier Ebenen:
  - **Kopf:** Titel, Entwurf/Freigegeben, Version, Stift „Anweisung bearbeiten", „Formuliert · Feinschliff", ggf. „Standard-KI (Fallback)", ⋯-Menü (Feinschliff/Zweitfassung/Vorfassungen/Prompt ansehen/Verwerfen).
  - **Text:** satzweise markierbar.
  - **Werkzeugzeile:** Neu/Kürzer/Länger · **Bearbeiten mit KI** · **Persönlicher Stil** · Bearbeiten · **Kopier-Icon** ⧉ neben Bearbeiten · QS prüfen · „Freigeben und weiter" mit QS-Badge. Freigegeben: Erneut öffnen · QS prüfen · Kopieren · Stil.
  - **„Bearbeiten mit KI":** eigene Anweisung eingeben, wie der Abschnitt überarbeitet werden soll („technische Risiken auf die des Lösungswegs beschränken", „Lösungsweg vertiefen"). Feld erscheint in der Karte, letzte 5 Anweisungen als Chips; gilt für genau einen Lauf, der bisherige Text bleibt die Grundlage.
  - **„Zweitfassung mit der …":** erzeugt denselben Abschnitt noch einmal mit der jeweils anderen internen KI. Die bisherige Fassung wandert in die **Vorfassungen**, wo beide nebeneinander stehen, sich als Unterschied vergleichen lassen und eine davon übernommen werden kann. Jede Fassung ist mit der KI beschriftet, die sie geschrieben hat. Der Eintrag fehlt, wenn die aktive KI-Verbindung keine zwei Varianten kennt.
  - **Fußzeile:** Sätze/Wörter/Regeln/Skill, verwendete KI „Standard-KI"/„Agentische KI" + 👍/👎.
- **Am Text:** **Abschnitts-QS** („n von m Kriterien ok") + **Regelprüfung** (Messwert/Limit + KI-Korrektur). Generieren hängt den **Feinschliff** an.
- **Rechts „Quelle & KI-Hinweise"** (eingeklappt): **Beleg-Karten** (Klick → Satz), Abdeckung, Denkprozess.
- **Offline:** Bearbeiten/Prüfen ja, KI aus.

## Typische Aktionen

- Antrag suchen/filtern, Verbund öffnen, Teilvorhaben wechseln
- Dokumente hochladen + Gutachten-Kontext wählen
- Abschnitt erzeugen, per KI korrigieren, QS prüfen
- Vor dem Erzeugen nachsehen, was an die KI geht
- Anweisung, Umfang oder eine Regel des Abschnitts am offenen Antrag anpassen und neu erzeugen
- Zwei Fassungen von verschiedenen KIs vergleichen und eine übernehmen
- Vom Befund zum Satz springen

## Technik

**Datenmodell dahinter:** `useAntraegeStore` (CSV-Schema `Antrag`/`Verbund`/`AntragListItem`), Hybrid-Suche (`useAntraegeHybridSearch`, Orama BM25+Vector), Filter-State, Feld-Historie, Dokument-Tags (`kv`).

**Code:** `src/plugins/antraege/` — `AntraegePage.tsx`, `AntraegeTable.tsx`, `VerbundDetail.tsx`, `store.ts`, `filter/`; Werkstatt in `gutachten/`. Kompakt-Spalte = `KompaktListe`, Teilvorhaben-Block = `TvDetailBlock`, Abschnitts-Karte = `SectionReviewCard`, Dokumente des Verbundes = `KorpusInventar`, Quellen-Panel = `KontextPanel`.
