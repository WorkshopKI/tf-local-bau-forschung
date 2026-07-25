# Status-Katalog (Cockpit)

Vollbild-Admin-Seite (`/status-cockpit`, Flag `statusCockpit`; dev/pl/kurator). Hier
wird der **Status-Katalog** gepflegt — die kuratierbaren Daten hinter der
Statusanzeige der App.

## Zweck

Der Katalog ordnet jeden rohen Statuswert der CSV einer **Kategorie**, einer
**Spine-Phase** (Eingang → Vollständigkeit → Fachprüfung → Bewilligung →
Schluss), einem **Rang**, einer **Prominenz** und einem **Terminal**-Flag zu. Aus
dem Ensemble aller aktuellen Feldwerte eines Verbunds wird der Hauptstatus
abgeleitet (höchster Rang; ein terminaler Wert schlägt den Rang; Widersprüche
werden als **Konflikt** angezeigt, nie stillschweigend aufgelöst).

## Bereiche

- **Katalog**: Tabelle aller Statuswerte mit Inline-Bearbeitung (Label, Kategorie,
  Spine-Phase, Rang, Prominenz, terminal, aktiv), plus **Vorkommen** und
  **zuletzt gesehen**. Je Zeile steht das Feld unter seinem kuratierten Namen
  („TV-Status") und daneben die **CSV-Spalte** als Herkunft. Leeres Label heißt:
  es gilt der Rohwert. Filter-Pills + Suche. Beim Import neu aufgetauchte Werte
  erscheinen als **unkuratiert** und werden per „Übernehmen" in den Katalog
  geholt — nie automatisch gemappt.
- **Felder**: Tabelle der Statusfelder (`status` = TV-Status, `verbund_status`,
  `vb_phase`, Datumsfelder) mit CSV-Spalte. Label, Prominenz-Default und aktiv
  editierbar (z. B. ein „Termin"-Feld auf „ignoriert" setzen).
- **Regeln**: priorisierte Nächste-Schritte-Regeln (Bedingung → Schritt, optional
  mit Werkzeug-Verweis). aktiv/Priorität/Beschreibung editierbar.

## Simulation + Versionen

Über den Tabs zeigt eine **Simulations-Leiste** die abgeleitete Phasenverteilung
(Aktiv → Entwurf), die Konfliktzahl und die Verbünde, die dadurch die Phase
wechseln. Änderungen sind ein **Entwurf**; „Für das Team speichern" legt eine
versionierte Fassung an und aktiviert sie. Ältere Fassungen sind einsehbar und
als Entwurf ladbar.

## Wichtig

- Der Katalog gilt **team-weit**: „Für das Team speichern" legt ihn auf dem
  Daten-Share ab, alle anderen übernehmen ihn beim nächsten App-Start. War der
  Share nicht erreichbar, bleibt die Fassung lokal — die Seite sagt das und
  bietet „Erneut veröffentlichen" an.
- Die **Historie** (Statusverlauf) bleibt dagegen auf dem eigenen Rechner: sie
  hält fest, wann dieser Rechner eine Änderung gesehen hat.
- JSON-Export/Import dient der Sicherung, nicht dem Team-Abgleich.
- Ändert nichts am amtlichen Legacy-System — reine Anzeige-/Ableitungslogik.
