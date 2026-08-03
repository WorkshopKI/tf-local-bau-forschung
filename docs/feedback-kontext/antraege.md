# Förderanträge

## Zweck

Zentrale Arbeitsseite für Förderanträge — suchen/filtern, bearbeiten, Status/Dokumente verwalten.

## UI-Elemente & Begriffe

- **Liste links:** sortier-/gruppierbar. Bei offenem Detail schrumpft sie zur **Kompakt-Spalte** und lässt sich ganz einklappen (**Fokus-Modus**: alle Listen-Werkzeuge weg, Titel + „Aufnehmen" bleiben). Je Ordner des Fachsystems ist in der Tabelle eine Statusspalte einblendbar.
- **FKZ** `16KN######` / `16EP######`: beim Überfahren einer Zeile erscheint rechts vom FKZ ein **Kopier-Icon** (Verbund-Zeile: das Verbund-FKZ).
- **Filter:** als drittes Panel.
- **Betrachtungsbereich-Chip** im Seitenkopf: „Anzeige: letzte 3 Richtlinien (9 Programme) · 6 952 ausgeblendet". Er sagt, welche Förder-Richtlinien gerade zum Arbeitsvorrat zählen und wie viele Anträge das ausblendet; Klick öffnet die Auswahl (Standard-Bereich / alle Richtlinien / eigene Liste, mit Klartext-Namen). Die **Suche bleibt immer am ganzen Bestand** — Treffer außerhalb sind gekennzeichnet und lassen sich öffnen.
- **Detail rechts:** Kopf (Titel + Meta + Stepper, rechts „Antrag-Aufbereitung öffnen"), klappbare **Kurzbeschreibung** (offen), Gutachten-Werkstatt, dann — eingeklappt — „Antragsdaten" (Fakten + Verbundpartner/Teilvorhaben), Artefakt-Werkbank, „Alle Felder", „Historie".
  - **„Status & Verlauf":** die **ZAH-Phase** des amtlichen Status; **Chronik** der Termine oder **Zeitstrahl**; darunter **Offene Aufgaben** je Teilvorhaben und je Rolle mit „warum?"-Herleitung (geliehene Einträge sind als solche markiert); darunter **Belegte Änderungen** aus dem Änderungs-Journal — was sich seit dem Nullpunkt wirklich geändert hat, auch wo der Export die frühere Setzung inzwischen überschrieben hat; unklare Zeiträume stehen als Spanne. Der Nullpunkt steht immer dabei, und ein Antrag, für den kein Journal geführt wird, sagt das ausdrücklich. Zuletzt die **Statuseinträge** nach den Ordnern des Fachsystems, rollen-vorgefiltert.
  - **„Nächste Schritte (im Foyer zu setzen)":** die Kürzel, deren Trigger-Vorbedingungen zum aktuellen Status passen, mit Wirkung und Rolle, vorgefiltert auf die eigene Rolle; die App setzt nichts selbst. Maßgeblich sind **nur die Trigger der Richtlinie des Vorhabens** (FM-Nummer): führt die Zuarbeit dazu keine, steht das da („Für Programm 47 sind keine Trigger importiert") — die einer anderen Richtlinie werden nie ersatzweise gezeigt.
  - **Info-Icon am Status:** beantwortet „warum dieser Status?" aus den amtlichen Daten — Code, Text, seit wann, letzter Vorgang, ausgelöste Trigger. Es benennt die **Ebene** und stellt einen abweichenden Status der Gegenseite darunter („Verbund-Status: 31 · beantragt / TV-Status: 72 · …").
  - **„Fristen & Meilensteine":** Prognose + Restzeit.
  - **Offenes Teilvorhaben:** Felder, Netzwerk, Dokumente.

## Gutachten-Werkstatt (wenn aktiv)

- **„Dokumente des Verbundes"** (oben): Typ + Umfang je Datei, maßgebliche **Vorhabensbeschreibung** markiert; weitere per „ins Gutachten aufnehmen".
- **Kontext-Warnung** über der Karte, wenn die Unterlagen nicht ins Fenster der gewählten KI passen: sie nennt die fehlenden Zeichen und empfiehlt entweder den Wechsel auf die andere KI (deren Fenster ist rund viermal so groß) oder das Kürzen der Unterlagen. Sie erscheint **vor** dem Erzeugen, blockiert aber nichts.
- **Noch nicht generierter Abschnitt:** „{Abschnitt} generieren" + **Persönlicher Stil** + **Prompt ansehen**.
- **„Prompt ansehen":** zeigt den vollständigen Auftrag, der an die KI geht — als Vorschau des nächsten Laufs und, nach einem Lauf, als das tatsächlich Gesendete. Oben die Maße (Zeichen gesamt, davon Vorhabensbeschreibung, geschätzte Tokens, Platz im Fenster), darunter die Liste der enthaltenen Bausteine, darunter der Wortlaut. Die Vorhabensbeschreibung ist eingeklappt.
- **Abschnitts-Karte**, vier Ebenen:
  - **Kopf:** Titel, Entwurf/Freigegeben, Version, „Formuliert · Feinschliff", ggf. „Standard-KI (Fallback)", ⋯-Menü (Feinschliff/Zweitfassung/Vorfassungen/Prompt ansehen/Verwerfen).
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
- Zwei Fassungen von verschiedenen KIs vergleichen und eine übernehmen
- Vom Befund zum Satz springen

## Technik

**Datenmodell dahinter:** `useAntraegeStore` (CSV-Schema `Antrag`/`Verbund`/`AntragListItem`), Hybrid-Suche (`useAntraegeHybridSearch`, Orama BM25+Vector), Filter-State, Feld-Historie, Dokument-Tags (`kv`).

**Code:** `src/plugins/antraege/` — `AntraegePage.tsx`, `AntraegeTable.tsx`, `VerbundDetail.tsx`, `store.ts`, `filter/`; Werkstatt in `gutachten/`. Kompakt-Spalte = `KompaktListe`, Teilvorhaben-Block = `TvDetailBlock`, Abschnitts-Karte = `SectionReviewCard`, Dokumente des Verbundes = `KorpusInventar`, Quellen-Panel = `KontextPanel`.
