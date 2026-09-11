# Regelbereich als Karten

## 0. Anlass

> „es ist immer noch nicht sehr übersichtlich (screen 2) bitte weitere design ideen" — „mir gefällt C
> nebeneinander sehr gut" — „ja diese kombi und die ‚und‘ ‚oder‘ schalter aus C3, bitte als prototypen"
> — „ja einbauen und dann alles umsetzen, sieht gut aus"

Nachfrage am Prototyp: „warum sind immer zwei zahlen hinter den feldnamen?" — daraus die Regel, dass jede
Zahl ihre Beschriftung trägt.

## 1. Befund

- Der Bedingungs-Editor aus v6.59 (benannte Gruppen, „alle | eine", ⋯-Menü) war der PL weiter nicht
  übersichtlich genug. Die Verknüpfung stand zweimal: als Schalter im Kopf und als Wort in der Rinne.
- Beim Auslesen der Probe (Richtlinie 2025, Entwurf zu Fassung 37) fielen echte Fehler im Plan auf, die
  die alte Oberfläche nicht zeigte:
  - MST 4.3 ist bei **allen** 1 094 offenen Verbünden erfüllt, weil „VB Kurzname ist gefüllt" jeden trifft.
    Ohne diese Bedingung wären es 870; 224 offene und 209 abgeschlossene erfüllen ihn nur darüber und
    bekommen damit keinen Ist-Termin.
  - MST 5 enthält „Status ist Stellungnahme zur Rücknahmeempf." mit 0 Treffern.
  - MST 2 (Kürzel TIB/BIB) und MST 5 (Status) liefern kein Datum — Ist-Termin und Abweichung bleiben leer.
- Entwürfe und Prototyp: https://claude.ai/code/artifact/5834b72f-7410-4cdb-b2fe-a84908862630 — Seite
  „Prototyp" (klickbar, echte Zahlen), „Varianten von C" (C1–C4), „Erste Runde" (A, B, D).

## 2. Entscheidungen

- **Ein Editor, überall**: Meilensteine, To-do-Regeln, „Eigene Spalte". Probe-Zahlen und Befunde nur bei
  den Meilensteinen, über Render-Props — der Editor bleibt domänenfrei.
- **Ziehen bleibt** für Bedingungen (in eine andere Karte, an eine Stelle in der Karte); Karten wandern ⋯.
- **Verbinder sind die Schalter**: die Pille „und" / „oder" zwischen Karten bzw. Bedingungen. Der Schalter
  „alle | eine" entfällt.
- **Zuklappen einzelner Gruppen entfällt**: Karten sind kompakt, der Kopfsatz sagt die Regel.
- **Befunde sind Fakten, keine Schwellen**: „trifft keinen / jeden Verbund", „erfüllt bei allen / keinem",
  „kein Datum", „N ohne Termin" — exakt aus der Bewertung.
- **Zahlen immer beschriftet**: „872 offen · 213 abgeschl.", im Titel mit Gesamtzahlen und dem Satz zur
  Kontrollgruppe.
- Kein neues Flag (Modul hinter `meilensteinMonitoring`, der Editor ist Bestandsfläche). Version minor.

## 3. Umsetzung

- **Rein** (`src/core/`): `bedingungKopfsatz` ([bedingung-text.ts](../../../src/core/status/bedingung-text.ts)),
  `dupliziereBedingung` / `loeseGruppeAuf` / `aufloesenAendertAussage`
  ([bedingung-baum.ts](../../../src/core/status/bedingung-baum.ts)),
  `istTerminErklaerung` / `istDatumsFeldAus` ([ist-termin.ts](../../../src/core/meilensteine/ist-termin.ts)),
  `KnotenProbe.ohneDatum` und `probeBefund` ([probe.ts](../../../src/core/meilensteine/probe.ts)).
- **Editor** (`src/plugins/meilensteine/`): Karten, Innenkarten, Einzelkarten, Kopfsatz
  ([BedingungEditor.tsx](../../../src/plugins/meilensteine/BedingungEditor.tsx)); Zellen-Layout
  ([BlattZeile.tsx](../../../src/plugins/meilensteine/BlattZeile.tsx)); `Verbinder`
  ([BedingungsFugen.tsx](../../../src/plugins/meilensteine/BedingungsFugen.tsx)); Menü-Einträge vom Aufrufer
  ([ZeilenAktionen.tsx](../../../src/plugins/meilensteine/ZeilenAktionen.tsx)); `FeldWaehler` mit
  `variante: 'leise'` und `kennzahl` ([FeldWaehler.tsx](../../../src/components/ui/FeldWaehler.tsx)).
- **Meilenstein-Seite**: „gilt für" im Kopf, Befund-Punkt, Wirkungsleiste, Sammel-Meilenstein mit
  Kinderkarten ([KonfigurationTab.tsx](../../../src/plugins/meilensteine/KonfigurationTab.tsx),
  [ProbeAnzeige.tsx](../../../src/plugins/meilensteine/ProbeAnzeige.tsx)); Treffer je Feld für die
  Feld-Suche ([useMeilensteinProbe.ts](../../../src/plugins/meilensteine/useMeilensteinProbe.ts)).

## 4. Abweichungen beim Bau

- **„ohne Termin" exakt statt geschätzt**: der Prototyp rechnete „Regel minus Regel ohne datumslose
  Bedingungen" und durfte das nur, wo diese unter „eine" hängen. Die App zählt je Verbund „erreicht, aber
  `istDatum === null`" aus demselben Bewertungslauf.
- **Treffer je Feld**: die Probe-Kontexte kennen nur die Felder, die der Plan benutzt. Für die Feld-Suche
  baut der Hook einmal Kontexte über alle Katalog-Felder und zählt mit dem vorhandenen `zaehleBedingung` —
  kein zweiter Evaluator.
- **Klicks im Regelbereich**: die Karten sind Flächen; ein Klick darauf klappte den Bereich zu. Der
  Regelbereich trägt deshalb `data-regelbereich`, und der Zeilen-Klick ignoriert ihn.

## 5. Verifikation

- Tests: `bedingung-kopfsatz.test.ts`, `ist-termin.test.ts`, `bedingung-baum.test.ts` (Duplizieren,
  Auflösen, „ändert die Aussage"), `probe.test.ts` (`ohneDatum`, `probeBefund`).
- Abnahme in `dev:local` gegen die Zahlen des Prototyps (Richtlinie 2025, Entwurf zu Fassung 37;
  Detail in [meilensteine.md § Probe am Bestand](../../architecture/meilensteine.md)):
  - MST 3: Verbinder zwischen den Karten auf „oder" → 1.080 offen · 415 abgeschl. (+92 / +68); Karte AB
    auf „und" → 3 · 3; Zelle „PreCheck positiv - Verbund" → 872 offen · 213 abgeschl.
  - MST 4.3: „VB Kurzname" trifft jeden Verbund, ohne sie 870 · 220; „erfüllt bei allen"; 224 ohne Termin
    (exakt, 224 offene und 209 abgeschlossene).
  - MST 5: „trifft keinen Verbund" und „kein Datum"; MST 4 als Sammel mit fünf Kinderkarten; MST 9 (misst
    nur den Zeitpunkt) ohne Befund.
  - To-do-Regel-Detail und Dialog „Eigene Spalte": Karten ohne Zahlen, kein Überlauf.
  - `window.__tf.fehler()` = 0 nach hartem Neuladen.
- Nicht in `dev:local`: Speichern und Neuladen auf dem Share (lokaler Share mit einer parallelen Sitzung
  geteilt) und der `file://`-Build.
