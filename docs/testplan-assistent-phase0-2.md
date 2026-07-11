# Manueller Testplan — Assistent Phase 0–2

Durchnummerierte Schritt-für-Schritt-Checkliste für den Betreiber über alle drei Phasen des persönlichen Assistenten. Voraussetzung: ein **dev-Build** (`npm run build:dev` → `dist-single/dev/zah-dev.html`), per Doppelklick unter `file://` in Chrome/Edge geöffnet, mit eingerichtetem Daten-Share (Onboarding durchlaufen). Die interne KI (Streamlit-Bookmarklet) muss für die KI-abhängigen Punkte verbunden sein.

Je Punkt: **Aktion → erwartetes Ergebnis → ☐**. „KI nötig" markiert Schritte, die eine erreichbare interne KI voraussetzen.

---

## A — Phase 0: Arbeitsprotokoll

1. **Opt-in aus (Default).** Einstellungen → „Assistent & Gedächtnis" öffnen. → Der Protokoll-Schalter ist AUS; unter „Meine Daten" steht 0 Ereignisse. ☐
2. **Kein Write ohne Opt-in.** Bei ausgeschaltetem Schalter einen Antrag öffnen, eine Suche absetzen. Zurück in die Einstellungen. → „Meine Daten" zeigt weiterhin 0 Ereignisse. ☐
3. **Opt-in an.** Den Protokoll-Schalter einschalten. → Schalter an; ein Ereignis „Einstellung geändert" erscheint (nach Reload/erneutem Öffnen der Sektion). ☐
4. **8 Ereignistypen.** Nacheinander auslösen und je in „Meine Daten" (Chips + „Letzte N Ereignisse") prüfen:
   - a) Antrag/Verbund-Detail öffnen → „Antrag geöffnet". ☐
   - b) Ein Dokument/VB öffnen → „Dokument geöffnet". ☐
   - c) Suche absetzen → „Suche". ☐
   - d) einen KI-Lauf starten (KI nötig) → „KI-Lauf gestartet". ☐
   - e) …und dessen Abschluss → „KI-Lauf beendet". ☐
   - f) einen Gutachten-Abschnitt im Editor übernehmen → „Abschnitt bearbeitet". ☐
   - g) Fristen/Arbeitsvorrat auf der Startseite ansehen → „Fristen angesehen". ☐
   - h) eine (assistent-relevante) Einstellung ändern → „Einstellung geändert". ☐
5. **Kein Dokumenttext.** In der Ereignistabelle die Detailspalte prüfen. → Nur Entität/Typ/Zeit, NIE Dokument-/Gutachtentext, keine Verweildauern. ☐
6. **Entprellung Abschnitts-Edit.** Denselben Abschnitt mehrfach schnell hintereinander speichern. → Nicht jede Tastenfolge, nur ein (entprelltes) „Abschnitt bearbeitet". ☐
7. **JSON-Export.** „Als JSON exportieren". → Eine `assistent-protokoll-<datum>.json` wird heruntergeladen; Inhalt = die Ereignisse, nichts sonst. ☐
8. **Löschen.** „Alle Protokolldaten löschen" → bestätigen. → Zähler auf 0; Chips leer. ☐
9. **Retention-Stichprobe (optional).** Über die DevTools-Konsole/IndexedDB ein Ereignis mit `zeitstempel` älter als 90 Tage einfügen, App neu laden. → Der Alt-Eintrag ist nach dem Start weg (Retention beim Init). ☐

---

## B — Phase 1: Assistenz-Panel

10. **Panel öffnen.** Den „Assistent"-Reiter am rechten Rand (oder Command-Palette „Assistent öffnen") anklicken. → Das Panel dockt rechts an, auf jeder Route verfügbar. ☐
11. **Kontext-Chips.** Auf einer Verbund-Detailseite den Chip oben im Panel prüfen. → Zeigt „Verbund … · Phase · N Fristen" — den Kontext der aktuellen Ansicht. ☐
12. **Beispiel-Chips.** Ohne Eingabe die Vorschlag-Buttons prüfen. → „Was ist mein nächster Schritt?" / „Welche Fristen stehen an?" (+ ein VB-Beispiel bei geladenem Index). ☐
13. **Frage + Fundstellen (KI nötig).** „Was ist mein nächster Schritt?" senden. → Antwort auf Deutsch; stützt sie sich auf ein Dokument, erscheinen `[n]`-Zitate + Quellen-Chips; Klick auf ein Zitat öffnet das Quellen-Popover. ☐
14. **Nur Kontext geht ins Modell.** Beliebige Frage stellen, deren Antwort NICHT im Kontext steht. → Der Assistent sagt offen, dass die Information nicht vorliegt (rät nicht). ☐
15. **Degradation bei getrennter Bridge.** Die interne KI trennen (Bookmarklet-Tab schließen) und eine Frage senden. → Verständliche Meldung „interner KI-Dienst nicht erreichbar"; die Frage bleibt im Eingabefeld, die Historie unverändert. ☐
16. **Historie über Navigationswechsel.** Eine Frage stellen, dann zu einer anderen Ansicht navigieren, Panel offen lassen, weitere Frage. → Die bisherige Unterhaltung bleibt (session-only); die Chips ändern sich mit der neuen Ansicht. „Neue Unterhaltung" leert sie. ☐

---

## C — Phase 2: Persönliches Gedächtnis

17. **Toggle-Abhängigkeit.** Bei AUSgeschaltetem Protokoll-Opt-in in die Sektion „Persönliches Gedächtnis" schauen. → Der Gedächtnis-Schalter ist deaktiviert, mit Hinweis „Aktiviere zuerst das Arbeitsprotokoll". ☐
18. **Erklärtext angepasst.** Beim Protokoll-Text (Sektion „Arbeitsprotokoll") prüfen. → Statt „gar nicht an eine KI" steht jetzt die Gedächtnis-abhängige Formulierung (interne Auswertung nur bei aktivem Gedächtnis, nie extern/über das Internet). ☐
19. **Gedächtnis aktivieren.** Protokoll-Opt-in an, dann den Gedächtnis-Schalter an. → Schalter an; die Lauf-Status-Zeile erscheint („Noch kein Konsolidierungslauf"). ☐
20. **Manueller Lauf (KI nötig).** Zuvor ein paar Protokoll-Ereignisse erzeugen (A4). Dann „Jetzt konsolidieren". → Nach kurzem Lauf: Status-Meldung („Konsolidierung abgeschlossen"), Lauf-Zeile aktualisiert (angewandt/verworfen), es erscheinen Einträge in den Blocks. ☐
21. **Einträge + Belege.** Einen Eintrag aufklappen. → Zeigt Aktualisiert-Zeitstempel, ggf. Vorgänger-Hinweis, und die Belege als aufgelöste Ereignisse (Typ · Zeit · Entität). ☐
22. **Panel-Chip.** Panel öffnen. → Neben den Kontext-Chips steht „Gedächtnis: N Einträge". Eine Frage stellen (KI nötig) → der Assistent kann Hintergrundwissen berücksichtigen (klar als „kann veraltet sein" markiert). ☐
23. **Einzellöschung.** Bei einem Eintrag das Papierkorb-Icon klicken. → Der Eintrag verschwindet; die Block-/Panel-Zähler sinken. ☐
24. **Invalidierte anzeigen.** „Invalidierte anzeigen" einschalten (nachdem ein `UPDATE` einen Eintrag ersetzt hat). → Der invalidierte Vorgänger erscheint durchgestrichen/gedimmt mit „(invalidiert)". ☐
25. **„Alles vergessen".** Den Button klicken → bestätigen. → Alle Blocks leer; Panel-Chip „Gedächtnis" verschwindet. ☐
26. **Verhalten bei laufendem Skill (KI nötig).** Einen längeren Skill-Lauf (z. B. Gutachten-Kurzfassung) starten und WÄHRENDDESSEN „Jetzt konsolidieren". → Die Konsolidierung meldet „Bridge belegt" oder bricht ab (Vorrang für den Skill-Lauf); der Skill-Lauf läuft ungestört weiter, kein vermischter Chat. ☐
27. **Abschalten lässt Daten stehen.** Gedächtnis-Schalter aus, dann wieder an. → Die Einträge bleiben erhalten (Abschalten stoppt nur neue Läufe; „Alles vergessen" löscht). ☐

---

## Automatisiertes Gate (Referenz)

Das manuelle Zwischentesten der Konsolidierungs-**Qualität** wird durch das Eval ersetzt:

- `npm run eval:gedaechtnis -- --dry-run` → deterministische Assertions 100 % (Harness-Selbsttest, kein LLM). ☐
- `npm run eval:gedaechtnis -- --models eval/gedaechtnis-gen.json --judge eval/gedaechtnis-judge.json --n 3` → Live-Baseline (Judge-Zahlen protokollieren). ☐
