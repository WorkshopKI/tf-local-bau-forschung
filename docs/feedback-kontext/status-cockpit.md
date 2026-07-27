# Status-Katalog (Cockpit)

Vollbild-Admin-Seite (`/status-cockpit`, Flag `statusCockpit`; dev/pl/kurator).
Hier wird der **Status-Katalog** gepflegt — die kuratierbaren Daten hinter der
Statusanzeige der App.

## Zweck

Der Katalog ordnet jedem Statuswert und Statusfeld **Kategorie**, **Spine-Phase**
(Eingang → Vollständigkeit → Fachprüfung → Bewilligung → Schluss), **Rang**,
**Prominenz** und **Terminal**-Flag zu. Daraus leitet sich der Hauptstatus eines
Verbunds ab: höchster Rang, terminal schlägt Rang, Widersprüche gelten als
**Konflikt** und werden nie stillschweigend aufgelöst.

## Bereiche

- **Katalog**: alle Statuswerte mit Inline-Bearbeitung (Label, Kategorie,
  Spine-Phase, Rang, Prominenz, terminal, aktiv), **Vorkommen**, **zuletzt
  gesehen**, Feldname und **CSV-Spalte** als Herkunft. Leeres Label heißt: es gilt
  der Rohwert. Neue Werte erscheinen als **unkuratiert** und werden per
  „Übernehmen" geholt — nie automatisch gemappt.
- **Felder**: der **Ordnerbaum des Fachsystems** (~180 Einträge), Verbund und
  Teilvorhaben getrennt. Editierbar je Eintrag: Bezeichnung, Ordner,
  Zuständigkeit AB/FB, Prominenz, Spine-Phase, **Rang**, terminal — ohne Rang
  wird ein Eintrag angezeigt, hebt aber keine Phase (bei Wert-Feldern hängen
  Phase und Rang am Wert). „Ordner bearbeiten" legt an, benennt um, hängt um,
  legt still. Zwei Übernahme-Blöcke: Auslieferung nachziehen, gefundene
  CSV-Spalten einsortieren. Filter: Ebene, Zuständigkeit, „nur mit Rang".
- **Regeln**: priorisierte Nächste-Schritte-Regeln (Bedingung → Schritt, optional
  mit Werkzeug-Verweis). aktiv/Priorität/Beschreibung editierbar.

## Simulation + Versionen

Die **Simulations-Leiste** über den Tabs zeigt Phasenverteilung (Aktiv →
Entwurf), Konfliktzahl und die Verbünde, die dadurch wechseln — das
Abnahme-Instrument vor jeder Rang-Änderung. Änderungen sind ein **Entwurf**;
„Für das Team speichern" legt eine Fassung an. Ältere sind als Entwurf ladbar.

## Wichtig

- Der Katalog gilt **team-weit**: Speichern legt ihn auf dem Daten-Share ab, alle
  übernehmen ihn beim nächsten App-Start. Ohne erreichbaren Share bleibt die
  Fassung lokal — die Seite sagt das und bietet „Erneut veröffentlichen" an.
- Die **Historie** (Statusverlauf) bleibt auf dem eigenen Rechner: sie hält fest,
  wann dieser Rechner eine Änderung gesehen hat.
- JSON-Export/Import dient der Sicherung, nicht dem Team-Abgleich.
- Ändert nichts am amtlichen Legacy-System — reine Anzeige-/Ableitungslogik.
