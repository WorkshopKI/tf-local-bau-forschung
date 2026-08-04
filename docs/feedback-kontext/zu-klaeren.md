# Zu klären

## Zweck

Hier stehen Fachfragen, die das Team gemeinsam beantwortet — jeder wann er Zeit
hat, nicht alle gleichzeitig in einer Sitzung. Eine Klärung ist ein Fragebogen mit
festen Punkten; jeder trägt sein Urteil ein und kann kommentieren.

Die Seite **ändert nichts**. Sie sammelt Antworten. Was daraus folgt, wird
anschließend als Programm-Änderung umgesetzt und mit der nächsten Fassung
ausgeliefert.

Die erste Klärung ist der **ZAH-Phasenschnitt**: welche ZAH-Phase zu welchem
Status gehört. Diese Zuordnung ist eine Lesebrille der App — sie bestimmt, wie
Vorgänge gruppiert, gefiltert und mit Zieltagen versehen werden, und war bisher
nirgends sichtbar.

## UI-Elemente & Begriffe

- **Zuordnungstabelle** — 30 Zeilen, eine je Statuscode. Gruppiert nach der Phase,
  der er heute zugeordnet ist; die Phase steht in der Gruppenüberschrift, nicht in
  jeder Zeile.
- **Gruppenüberschrift** — nennt Anzahl der Codes und Summe der Vorgänge. Eine
  Zuordnung, die 222 Vorgänge betrifft, wiegt anders als eine mit dreien.
- **Marker (ohne Phase)** — die letzte Gruppe, abgesetzt dargestellt. Diese Codes
  laufen als Kennzeichen neben dem Verfahren und haben bewusst keine Phase.
- **Antwort je Zeile** — drei Möglichkeiten: „passt", „gehört nach …" (dann eine
  Zielphase wählen) und „unklar". Denselben Knopf noch einmal drücken zieht die
  eigene Antwort zurück.
- **Stand** — die Marke in der Zeile. „strittig" heißt: zwei oder mehr Personen
  haben verschiedene Zielphasen genannt. „Rückfrage" heißt: jemand konnte es nicht
  beurteilen. Ein Pfeil zeigt eine Zielphase, auf die sich alle einig sind, die
  aber von der heutigen abweicht.
- **Beiträge** — das Sprechblasen-Symbol mit Zähler klappt die Zeile auf. Darunter
  stehen die Beiträge chronologisch mit Kürzel und Datum, darunter das Eingabefeld.
- **Reiter über der Tabelle** — „Alle Zuordnungen", „Nur strittige" und „Offene
  Rückfragen", jeweils mit Zähler. Uneinigkeit ist das erwartete Ergebnis einer
  Abstimmung, kein Fehler — sie ist deshalb ruhig markiert und filterbar.
- **Grundsatzfragen** — sieben Fragen unter der Tabelle, die den Schnitt als Ganzes
  betreffen. Sie werden nur mit Text beantwortet; ein „passt / gehört nach …" wäre
  hier Scheinpräzision. Sie sind immer sichtbar und verschwinden nicht durch einen
  Filter.
- **Zähler im Seitenkopf** — wie viele der 37 Punkte man selbst beantwortet hat.
  Zurückgezogene Antworten zählen nicht mit.
- **Neu laden** — liest die Antworten der anderen frisch. Die Seite aktualisiert
  sich nicht von allein; die Uhrzeit daneben sagt, von wann der Stand ist.

## Typische Aktionen

- Eine Zeile durchgehen und „passt", „gehört nach …" oder „unklar" wählen.
- Bei „gehört nach …" die Zielphase auswählen; „ohne Phase" ist eine gültige Wahl.
- Eine Zeile aufklappen und begründen, warum man anderer Meinung ist.
- Auf „Nur strittige" umschalten und die offenen Punkte für den Termin sammeln.
- Eine Grundsatzfrage beantworten.
- Eine eigene Antwort oder einen eigenen Beitrag zurückziehen.
- „Neu laden" drücken, um zu sehen, was die anderen inzwischen eingetragen haben.

## Wichtig

- **Zum Antworten braucht es das eigene Kürzel** im Profil. Ein Sammel-Kürzel
  („alle") oder eine Vertretungsliste reicht nicht — sonst ließe sich nicht
  auseinanderhalten, wer was gesagt hat. Mitlesen kann jeder.
- **Nichts wird überschrieben.** Jede Äußerung wird angehängt; jeder schreibt in
  seine eigene Datei. Zurückziehen löscht nichts, es nimmt die Aussage nur aus der
  Auswertung.
- **Einig heißt gleicher Zielwert, nicht gleicher Knopf.** Wer „passt" wählt und
  wer ausdrücklich dieselbe Phase auswählt, sind sich einig — die Seite macht daraus
  keinen Konflikt.
- **„unklar" ist keine Gegenstimme**, sondern eine Rückfrage. Es macht eine Zeile
  nicht strittig, wird aber eigens gezählt.

## Technik

Route `/zu-klaeren`, Feature-Flag `vorgangssystem` (dev, pl, as) — in prod und
kurator unsichtbar. Antworten liegen als JSONL auf dem Daten-Share unter
`_intern/klaerung/<klaerungId>/<autor>.jsonl`, eine Datei je Person: `appendToFile`
ist read-modify-write, eine gemeinsame Datei verlöre bei gleichzeitigen Antworten
still eine Zeile.

Punkte entstehen zur Laufzeit aus `STATUS_CODE_KATALOG`, `SEED_CODE_ZU_ZAH_PHASE`
und `SEED_MARKER_CODES` (`src/plugins/zu-klaeren/seed-phasenschnitt.ts`); die
Faltung folgt der Dateireihenfolge, nicht dem Zeitstempel (`fold.ts`), die
Auswertung normalisiert auf den Zielwert (`konsens.ts`). Schreibrecht über
`canWriteDatenShare`, Identität über `useMeinKuerzel`.

Architektur-Doku: `docs/architecture/klaerung.md`.
