# Status-Katalog (Cockpit)

Vollbild-Verwaltungsseite für Kuratoren. Hier wird der **Status-Katalog** gepflegt
— die Daten hinter der Statusanzeige.

## Zweck

Der Katalog ordnet jedem Statuswert und Statusfeld **Kategorie**, **Spine-Phase**
(Eingang → Vollständigkeit → Fachprüfung → Bewilligung → Schluss), **Rang**,
**Prominenz** und **Terminal**-Flag zu. Daraus leitet sich der Hauptstatus ab:
höchster Rang, terminal schlägt Rang, Widersprüche gelten als **Konflikt** und
werden nie stillschweigend aufgelöst.

## Bereiche

- **Katalog**: alle Statuswerte mit Inline-Bearbeitung (Label, Kategorie,
  Spine-Phase, Rang, Prominenz, **Zieltage**, terminal, aktiv), **Vorkommen**,
  **zuletzt gesehen**, Feldname und **CSV-Spalte** als Herkunft. Leeres Label
  heißt: Rohwert gilt. Neue Werte erscheinen als **unkuratiert** und werden per
  „Übernehmen" geholt, nie automatisch.
  - **Zieltage** speisen den Stillstands-Wächter: nach wie vielen Tagen ohne
    Vorgangs-Aktivität gilt dieser Status als hängend? Leer heißt „nicht
    bewertbar", nicht „unauffällig". Neben dem Feld steht ein ⌀-Vorschlag aus
    der Ist-Verteilung (Median, Stichprobengröße im Tooltip); er wird pro Zeile
    einzeln übernommen, nie im Block — er beschreibt das Ist, nicht das Soll.
- **Kürzel**: der **Ordnerbaum des Fachsystems** (505 Einträge), Verbund und
  Teilvorhaben getrennt.
  - Editierbar je Eintrag: Bezeichnung, Ordner, **wird gesetzt von**
    (AB/FB/QS/PA/Juristen, Mehrfachauswahl; leer = jeder darf), **relevant**,
    Prominenz, Spine-Phase, **Rang**, terminal — ohne Rang wird er angezeigt,
    hebt aber keine Phase (bei Wert-Feldern hängen beide am Wert).
  - Das **Relevanz-Häkchen** markiert die Kürzel, die für die
    Antragsbearbeitung zählen; es grenzt Navigator, Wächter und die
    Status-Erklärung ein.
  - Trägt ein Kürzel Trigger-Zeilen, steht neben dem Code ein **Blitz mit
    Anzahl** — Klick klappt auf, was das Setzen im Foyer auslöst (Satzform).
    Jede Zeile beginnt mit `Richtlinie/Folge`, weil dasselbe Kürzel je
    Richtlinie etwas anderes auslöst.
  - „Ordner bearbeiten" ist ein **Baum**: Zweige klappen zu, Ziehen hängt um,
    Klick auf den Namen benennt um.
  - Vier Übernahme-Blöcke: Auslieferung nachziehen, Bezeichnung/Rollen der
    Kürzel-Zuarbeit übernehmen, **AB-Dashboard-Spalten als relevant markieren**
    (setzt nur, nimmt nie weg), gefundene CSV-Spalten einsortieren.
  - Filter: Ebene, Rolle, „nur mit Rang", „nur relevante", „nur mit CSV-Spalte".
- **Regeln**: priorisierte Nächste-Schritte-Regeln (Bedingung → Schritt, optional
  mit Werkzeug). aktiv/Priorität/Beschreibung editierbar.

## Simulation + Versionen

Die **Simulations-Leiste** über den Tabs zeigt Phasenverteilung (Aktiv →
Entwurf), Konfliktzahl und die wechselnden Verbünde — das Abnahme-Instrument.
Änderungen sind ein **Entwurf**; „Für das Team speichern"
legt eine Fassung an. Ältere sind als Entwurf ladbar.

## Wichtig

- Der Katalog gilt **team-weit**: Speichern legt ihn auf dem Daten-Share ab, alle
  übernehmen ihn beim nächsten App-Start. Ohne erreichbaren Share bleibt die
  Fassung lokal — die Seite sagt das und bietet „Erneut veröffentlichen" an.
- Die **Historie** (Statusverlauf) bleibt auf dem eigenen Rechner: sie hält fest,
  wann er eine Änderung gesehen hat.
- JSON-Export/Import dient der Sicherung, nicht dem Team-Abgleich.
- Ändert nichts am Legacy-System — reine Anzeige-/Ableitungslogik.
- Die **Trigger-Tabelle gilt je Richtlinie**. Der Bereich „Referenzdaten" nennt
  Stand, Zeilenzahl und die geführten Programme; die Vorschau vor der Übernahme
  zählt Zeilen und Kürzel je Programm und nennt die Programme des Bestands, für
  die die Datei nichts führt (mit Antragszahl). Zeilen aus einem Import vor
  v2.380 tragen keine Richtlinie und greifen an keinem Vorhaben — die Seite sagt
  das und bittet um einen neuen Import.

## Technik

**Route & Sichtbarkeit:** `/status-cockpit`, Flag `statusCockpit`; dev/pl/kurator.

**Datenmodell dahinter:** Katalog als Team-Sidecar `_intern/status-katalog.json` (Zugriff nur über `katalog-share.ts`), Event-Log `status_event` + Unkuratiert-Puffer gerätelokal. Siehe `docs/status-system/README.md` und `KATALOG-CODES.md`.
