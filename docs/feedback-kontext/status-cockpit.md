# Status-Katalog (Cockpit)

Vollbild-Admin-Seite (`/status-cockpit`, Flag `statusCockpit`; dev/pl/kurator). Hier
wird der **Status-Katalog** gepflegt — die kuratierbaren Daten hinter der
Statusanzeige der App (löst die früher hartkodierte Status→Kategorie-Map ab).

## Zweck

Der Katalog ordnet jeden rohen Statuswert der CSV einer **Kategorie**, einer
**Spine-Phase** (amtliche Wirbelsäule: Eingang → Vollständigkeit → Fachprüfung →
Bewilligung → Schluss), einem **Rang** (Position im Lebenszyklus), einer
**Prominenz** und einem **Terminal**-Flag zu. Aus dem Ensemble aller aktuellen
Feldwerte eines Verbunds wird der Hauptstatus abgeleitet (höchster Rang; ein
terminaler Wert schlägt den Rang; Widersprüche werden als **Konflikt** angezeigt,
nie stillschweigend aufgelöst).

## Bereiche

- **Katalog**: Tabelle aller Statuswerte mit Inline-Bearbeitung (Label, Kategorie,
  Spine-Phase, Rang, Prominenz, terminal, aktiv), plus Spalten **Vorkommen** (in
  wie vielen Verbünden aktuell) und **zuletzt gesehen**. Filter-Pills + Suche.
  Beim Import neu aufgetauchte Werte erscheinen als **unkuratiert** (Warn-Badge)
  und werden per „Übernehmen" in den Katalog geholt — nie automatisch gemappt.
- **Felder**: Tabelle der Statusfelder (z. B. `status`, `verbund_status`,
  `vb_phase`, Datumsfelder). Prominenz-Default + aktiv editierbar (z. B. ein
  „Termin"-Feld auf „ignoriert" setzen).
- **Regeln**: priorisierte Nächste-Schritte-Regeln (Bedingung → Schritt, optional
  mit Werkzeug-Verweis). aktiv/Priorität/Beschreibung editierbar.

## Simulation + Versionen

Über den Tabs zeigt eine **Simulations-Leiste** die abgeleitete Phasenverteilung
(Aktiv → Entwurf), die Konfliktzahl und die Verbünde, die durch die Änderung die
Phase wechseln. Änderungen sind ein **Entwurf**; „Als neue Version speichern"
legt eine versionierte Fassung an und aktiviert sie. Ältere Versionen sind
einsehbar und als Entwurf ladbar (Kopie). **Export/Import** als JSON.

## Wichtig

- Der Katalog ist **gerätelokal** (pro Build-Variante in IndexedDB), nicht auf dem
  Daten-Share. Abgleich im Team läuft ausschließlich über den JSON-Export/Import.
- Ändert nichts am amtlichen Legacy-System — reine Anzeige-/Ableitungslogik.
