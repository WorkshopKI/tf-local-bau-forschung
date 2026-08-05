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
- **Antwort je Zeile** — ein Streifen aus drei zusammenhängenden Knöpfen: „passt",
  „andere" (dann eine Zielphase wählen) und „unklar". Denselben Knopf noch einmal
  drücken zieht die eigene Antwort zurück.
- **Stand** — die Marke in der Zeile. „strittig" heißt: zwei oder mehr Personen
  haben verschiedene Zielphasen genannt. „Rückfrage" heißt: jemand konnte es nicht
  beurteilen. Ein Pfeil zeigt eine Zielphase, auf die sich alle einig sind, die
  aber von der heutigen abweicht. **Die Spalte erscheint erst, wenn eine Zeile
  etwas zu melden hat** — sind sich alle einig, stünde sie nur leer da.
- **Ist-Stand** — was der Status-Katalog zu diesem Code heute wirklich führt, und
  ob der Beschluss dort schon angekommen ist. „umgesetzt" heißt, beides stimmt
  überein. „noch offen" heißt, die Entscheidung ist notiert, aber im Katalog nicht
  vollzogen. „abweichend beschlossen" heißt, der Katalog trägt eine Änderung, zu
  der es hier keinen oder einen anderen Beschluss gibt — genau der Fall, der sonst
  erst beim Vergleich zweier Exporte auffällt. Auch diese Spalte erscheint nur,
  wenn eine Zeile etwas zu vermerken hat. **Angeglichen wird nichts**: der Vermerk
  stellt fest, geändert wird von Hand.
- **Beiträge** — das Sprechblasen-Symbol mit Zähler klappt die Zeile auf. Darunter
  stehen die Beiträge chronologisch mit Namen und Datum, darunter das Eingabefeld.
- **Reiter über der Tabelle** — „Alle Zuordnungen", „Nur strittige", „Offene
  Rückfragen" und „Nicht umgesetzt", jeweils mit Zähler. Uneinigkeit ist das
  erwartete Ergebnis einer Abstimmung, kein Fehler — sie ist deshalb ruhig
  markiert und filterbar. „Nicht umgesetzt" zeigt in einem Klick, was beschlossen,
  aber im Katalog noch nicht (oder anders) vollzogen ist — gedacht für das Ende
  einer Sitzung.
- **Grundsatzfragen** — dreizehn Fragen unter der Tabelle, die den Schnitt als
  Ganzes betreffen. Sie werden nur mit Text beantwortet; ein „passt / andere"
  wäre hier Scheinpräzision. Sie sind immer sichtbar und verschwinden nicht
  durch einen Filter. Sechs davon kamen aus Messungen am Bestand: PreCheck-Lücke,
  PreCheck-Vollständigkeit, Zieltage als Soll oder Ist, Abgrenzung 31/33/34, eine
  Regel ohne Treffer und eine verdeckte Fristüberwachung. Wo eine Messung eine
  Frage im Kern beantwortet hat, ist sie zur **Bestätigungsfrage** verengt —
  umformuliert wird aber nur, solange niemand geantwortet hat.
- **Zähler im Seitenkopf** — wie viele der 43 Punkte man selbst beantwortet hat.
  Zurückgezogene Antworten zählen nicht mit.
- **Neu laden** — liest die Antworten der anderen frisch. Die Seite aktualisiert
  sich nicht von allein; die Uhrzeit daneben sagt, von wann der Stand ist.
- **Ergebnis mitnehmen** — drei Ausgaben unter der Tabelle. Arbeitsmappe und
  Kurzfassung berichten über die **Antworten**: alle Stimmen nebeneinander für den
  Termin, nur das Abweichende fürs Protokoll. Die **Seed-Änderungen** kommen
  dagegen aus dem gepflegten **Katalog**, nicht aus den Antworten — beschlossen
  wird auf dieser Seite, vollzogen wird im Verfahrensschritt-Baum, und nur der
  Baum ist der Stand, der wirken soll.

## Typische Aktionen

- Eine Zeile durchgehen und „passt", „andere" oder „unklar" wählen.
- Bei „andere" die Zielphase auswählen; „ohne Phase" ist eine gültige Wahl.
- Eine Zeile aufklappen und begründen, warum man anderer Meinung ist.
- Auf „Nur strittige" umschalten und die offenen Punkte für den Termin sammeln.
- Am Ende einer Sitzung auf „Nicht umgesetzt" schalten und sehen, was noch in den
  Katalog nachzutragen ist.
- Eine Grundsatzfrage beantworten.
- Eine eigene Antwort oder einen eigenen Beitrag zurückziehen.
- „Neu laden" drücken, um zu sehen, was die anderen inzwischen eingetragen haben.
- Die Seed-Änderungen herunterladen, um den gepflegten Katalog ins Programm zu
  übernehmen.

## Wichtig

- **Zum Antworten braucht es den eigenen Namen** im Profil — sonst ließe sich
  nicht auseinanderhalten, wer was gesagt hat. Das Bearbeiter-Kürzel spielt hier
  keine Rolle: Autorschaft ist eine Person, nicht eine Rolle im Fachsystem, und
  Projektleitung und Kuration haben gar kein Kürzel. Mitlesen kann jeder.
- **Nichts wird überschrieben.** Jede Äußerung wird angehängt; jeder schreibt in
  seine eigene Datei. Zurückziehen löscht nichts, es nimmt die Aussage nur aus der
  Auswertung.
- **Einig heißt gleicher Zielwert, nicht gleicher Knopf.** Wer „passt" wählt und
  wer ausdrücklich dieselbe Phase auswählt, sind sich einig — die Seite macht daraus
  keinen Konflikt.
- **„unklar" ist keine Gegenstimme**, sondern eine Rückfrage. Es macht eine Zeile
  nicht strittig, wird aber eigens gezählt.
- **Beschluss und Umsetzung sind zwei Dinge.** Hier wird entschieden, im
  Verfahrensschritt-Baum wird es vollzogen. Die Seite gleicht beides nie von
  selbst an — sie zeigt nur, wo es auseinandergeht.

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
