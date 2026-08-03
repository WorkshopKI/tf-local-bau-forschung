# P6 — Rückbau der alten Statusableitung: Inventar

**Erledigt** mit v2.382 – v2.385 (02.08.2026). Erhoben nach v2.379.0, abgearbeitet
nach v2.381.

Dieses Dokument war das Arbeitsprogramm des Rückbaus. Es bleibt als Protokoll
stehen: was geplant war, was tatsächlich anders kam und warum. Der **Ist-Zustand**
steht in [vorgangssystem.md, Abschnitt 7](vorgangssystem.md#7-der-rückbau-der-alten-ableitung-p6-umgesetzt).

## 1. Abnahme-Kriterium — erfüllt

Der Phasen-Vergleichs-Report maß Verbund für Verbund die alte abgeleitete
Spine-Phase gegen die neue ZAH-Phase.

| | 27.07.2026 (Erhebung) | 02.08.2026 (Rückbau) |
|---|---|---|
| gleich | 6 996 | 7 001 |
| abweichend | 490 | **485** |
| nicht vergleichbar | 48 | 48 |

„Null Abweichungen" war nie das Ziel — die 485 sind die beabsichtigte
Verhaltensänderung. Das Kriterium lautete **null *unerklärte*** Abweichungen, und
sie zerfielen durchgehend in **12 Muster** mit zwei Ursachen:

| n | Status (roh) | ZAH-Phase | Spine (alt) | Ursache |
|---|---|---|---|---|
| 260 | beantragt | Eingang | Vollständigkeit | ein Vollständigkeits-Datum hängt dran |
| 68 | VN geprüft | Begleitung | Schluss | terminal-Flag zieht vor |
| 53 | bearbeitungsreif | Vollständigkeit | Fachprüfung | Prüf-Datum vor Statuswechsel |
| 44 | beantragt | Eingang | Fachprüfung | dito, weiter fortgeschritten |
| 25 | bewilligt | Begleitung | Schluss | terminal-Flag |
| 17 | bewilligt | Begleitung | Fachprüfung | terminales Ablehnungs-Feld |
| 8 | ablehnungsreif | Entscheidung | Schluss | terminal-Flag |
| 3 | Anhörung zum Widerruf | Begleitung | Schluss | terminal-Flag |
| 2 | beantragt | Eingang | Bewilligung | Bewilligungs-Datum gesetzt |
| 2 | bearbeitungsreif | Vollständigkeit | Schluss | terminal-Flag |
| 2 | NF gestellt | Vollständigkeit | Fachprüfung | Wert selbst anders eingeordnet |
| 1 | VN techn. geprüft | Begleitung | Schluss | terminal-Flag |

**Beide Ursachen sind dieselbe Aussage**: die alte Ableitung lief dem amtlichen
Status voraus.

**Belegt wurde das so**: der Vergleich lief vor UND nach der Fassaden-Umstellung
und lieferte identisch 7001/485/48 — die Umstellung hat die alte Ableitung nicht
bewegt. Möglich war das nur, weil zwei Koppelstellen (`seed.ts:spineFor`,
`statusZuStepperPosition`) vorher **verhaltensneutral** von
`kategorie === 'offen'` auf Code-Mengen umgestellt wurden; ohne das hätte der
Kategorie-Wechsel von „NL eingegangen" die alte Achse mitbewegt und die Baseline
entwertet.

Der Golden Test, der die 12 Muster synthetisch reproduzierte, ist mit
`ableitung.ts` entfallen — es gibt keine alte Lesart mehr, gegen die man messen
könnte. Was bleibt, sind zwei dauerhafte Guards (siehe §5).

## 2. Umfang — Ist

Geplant: 99 `SpinePhase`-Stellen in 20 Dateien, dazu `rang` (58),
`prominenz` (48), `prioritaet` (10).

Tatsächlich (Summe v2.382 – v2.385): **43 Dateien geändert, −2 219 Zeilen,
+366** im Rückbau-Commit; davor drei Commits mit den Vorarbeiten. Gelöscht:
`ableitung.ts`, `spine-kategorie.ts`, `phasen-vergleich.ts`, `StatusWarum.tsx`,
`KonfliktBadge.tsx`, `DiagnoseSektion.tsx` und vier Test-Dateien.

## 3. Abweichungen vom Plan

**`Prominenz` bleibt** (Plan: entfernen). Sie steuert die Punktgröße in Chronik
und Zeitstrahl sowie den `ignoriert`-Filter — Anzeige, keine Ableitung. Sie
mitzureißen hätte die Chronik plattgemacht, ohne etwas ableitungsfreier zu
machen. Der Prompt erlaubte „entfernen **oder** im Protokoll begründen".

**Code 73 bleibt `abgeschlossen`** (dieses Dokument sagte vorher: „bei Code 73
`abgelehnt`"). Die Umhängung hätte drei getestete Zusagen gebrochen —
`isAbgelehntStatus('abgelehnt/zurückgezogen') === false`, das Stepper-Label
`zurueckgezogen` und die Zugehörigkeit zum Chip „Abgeschlossen" — ohne Gewinn:
die Förderantrag-Domäne hat keinen separaten `abgelehnt`-Endzustand.

**`byte-identitaet` bleibt** (Plan: „ersatzlos gegen den Golden Test tauschen").
Er misst eine **andere Achse**: eingebaute Map ≡ Katalog-Snapshot, also Flag an
gegen Flag aus. Genau diese Zusage trägt „der Kern ist flag-unabhängig", und der
wahrscheinlichste Fehler des Umbaus — eine Schreibweise fehlt im Seed, prod
verhält sich anders als pl — fällt nur hier auf. Er wurde stattdessen **erweitert**
(jede Variante einzeln, Alt-Fassungs-Test, PL-Umhängungs-Test).

**Die Diagnose-Sektion ist entfallen statt umgewidmet.** Der Plan sah vor, sie auf
„Katalog-Fassung A gegen B" umzuhängen. Ohne die alte Ableitung hat sie keinen
Vergleichspartner mehr, und eine Fassungs-Diff ist eine andere Funktion mit
anderem Nutzen — die gehört entworfen, nicht als Resteverwertung angebaut.

**Der Nachmess-Schritt war keine Nutzer-Aufgabe.** Der Plan sah vor, dass die
Zahlen am echten Bestand vom Nutzer gemeldet werden. `npm run dev:local` fährt
den vollständigen Bestand (14 221 Anträge) — die Messungen liefen direkt dort.

## 4. Reihenfolge — so gelaufen

1. **v2.382** Vorab-Fixes: Wächter-Zukunftsfilter, Herleitungs-Popover mit
   Ebenen-Angabe, eine Datums-Anzeigekette.
2. **v2.383** Golden Test einfrieren → Koppelstellen entkoppeln → Fassade auf
   Code + ZAH-Phase → Guards.
3. **v2.384** Anzeige umhängen: Stepper, Filter-Sidebar, Detailseite, Home-Widget.
4. **v2.385** Kern entfernen, Kuration entschlacken, Tests mitziehen.

Fassungen auf dem Share ziehen die entfallenen Felder beim nächsten Speichern von
selbst ab; ein Migrationsschritt war nicht nötig, weil die Felder optional waren.

## 5. Was den Rückbau überlebt

| Guard | Frage |
|---|---|
| [kategorie-ableitung.test.ts](../../src/core/status/__tests__/kategorie-ableitung.test.ts) | Ist die Ableitung richtig? (30-Code-Wahrheitstabelle, von Hand) |
| [byte-identitaet.test.ts](../../src/core/status/__tests__/byte-identitaet.test.ts) | Liefert sie über Snapshot und eingebaute Map dasselbe? |
| [kategorie-deltas.ts](../../src/core/status/__tests__/fixtures/kategorie-deltas.ts) | Welche sechs Werte haben die Kategorie gewechselt — abschließend |

## 6. Offen geblieben (nicht Teil des Rückbaus)

- **Phasen-Schnitt fachlich abnehmen**: die 260 „beantragt → Eingang statt
  Vollständigkeit" sind die größte Einzelgruppe. Ist das die gewollte Lesart?
  Umhängen ist eine Katalog-Zeile, kein Deployment — seit v2.383 wirkt es auch.
- **Verifikationsfragen V1–V4** aus [todo-regeln-ab-seed.md](todo-regeln-ab-seed.md)
  mit den AB-Kollegen klären.
- **Zieltage**: 7 von 74 Statuswerten gepflegt; der Rest ist „nicht bewertbar".
