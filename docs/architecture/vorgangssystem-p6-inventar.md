# P6 — Rückbau der alten Statusableitung: Inventar

Stand: 01.08.2026 · Grundlage für den separaten P6-Lauf · Erhoben nach v2.379.0

P0–P5 haben das Vorgangssystem **neben** die alte Ableitung gestellt. P6 nimmt
die alte weg. Dieses Dokument sagt, was dafür anzufassen ist, in welcher
Reihenfolge, und woran der Erfolg gemessen wird.

## 1. Abnahme-Kriterium

Der **Phasen-Vergleichs-Report** (Status-Katalog → Diagnose, dev-only) misst
Verbund für Verbund die alte abgeleitete Spine-Phase gegen die neue ZAH-Phase.
Gemessen am Bestand (7 534 Verbünde, Import 27.07.2026):

| | Anzahl |
|---|---|
| gleich | 6 996 |
| abweichend | 490 |
| nicht vergleichbar | 48 |

**„Null Abweichungen" ist nicht erreichbar und war nie das Ziel** — die 490 sind
die beabsichtigte Verhaltensänderung. Die alte Ableitung liest das ganze
`D_`-Feld-Ensemble (höchster Rang gewinnt, terminal schlägt Rang), die ZAH-Phase
nur den Statustext. Das Abnahme-Kriterium lautet deshalb **null *unerklärte*
Abweichungen**, und die 490 zerfallen in 12 erklärte Muster:

| n | Status (roh) | ZAH-Phase | Spine (alt) | Erklärung |
|---|---|---|---|---|
| 264 | beantragt | Eingang | Vollständigkeit | ein Vollständigkeits-Datum hängt dran, der Status ist noch „beantragt" |
| 68 | VN geprüft | Begleitung | Schluss | terminal-Flag der alten Ableitung zieht vor |
| 51 | bearbeitungsreif | Vollständigkeit | Fachprüfung | Prüf-Datum vor Statuswechsel |
| 47 | beantragt | Eingang | Fachprüfung | dito, weiter fortgeschritten |
| 25 | bewilligt | Begleitung | Schluss | terminal-Flag |
| 17 | bewilligt | Begleitung | Fachprüfung | Prüf-Datum dominierte den Rang |
| 8 | ablehnungsreif | Entscheidung | Schluss | terminal-Flag |
| … | (4 weitere Muster) | | | dieselben zwei Ursachen |

**Beide Ursachen sind dieselbe Aussage**: die alte Ableitung lief dem amtlichen
Status voraus. Genau das soll das Companion-Prinzip beenden — die App zeigt den
Status, wie das Fachsystem ihn führt.

**Für P6 zu tun:** den Vergleichs-Report zu einem **Golden Test** einfrieren
(Muster + Anzahl als Fixture), damit der Rückbau nicht unbemerkt eine 13. Ursache
erzeugt. Er ersetzt damit die Idee hinter dem `byte-identitaet`-Guard.

## 2. Umfang

Gemessen mit `grep -rn 'SpinePhase|spinePhase' src/ --include=*.ts --include=*.tsx`:

- **99 Stellen in 20 Dateien** (ohne Tests)
- **128 Stellen** inklusive Tests
- Dazu die mitzurückbauenden Konzepte: `rang` (58), `prominenz` (48),
  `prioritaet` (10)

## 3. Was womit ersetzt wird

### 3.1 Der Kern — zuerst

| Datei | Stellen | Vorschlag |
|---|---|---|
| [ableitung.ts](../../src/core/status/ableitung.ts) | 15 | **entfällt vollständig.** Sie ist die Rang-Engine; ohne Ränge gibt es nichts abzuleiten. Ihre Konsumenten sind unten einzeln aufgeführt. |
| [spine-kategorie.ts](../../src/core/status/spine-kategorie.ts) | 6 | **entfällt.** Die Kategorie→Spine-Abbildung wird von der ZAH-Phasen-Tabelle abgelöst. |
| [seed.ts](../../src/core/status/seed.ts) + [seed-codes.ts](../../src/core/status/seed-codes.ts) + [seed-kanonisch.ts](../../src/core/status/seed-kanonisch.ts) | 14 | `spinePhase`/`rang`/`terminal` aus den Seed-Einträgen entfernen. **Achtung:** `terminal` wird ausserhalb der Ableitung gelesen — vorher prüfen. |
| [typen.ts](../../src/core/status/typen.ts) | 9 | `SpinePhase` als Typ streichen; `rang`, `prominenz`, `spinePhase` an den Einträgen entfernen. Optional lassen, bis der Share-Bestand nachgezogen ist. |
| [cockpit-berechnung.ts](../../src/core/status/cockpit-berechnung.ts) | 12 | `simuliere`/`verteilung`/`diffPhasen` entfallen mit der Simulations-Leiste. `baueVerbundFelder`, `zaehleVorkommen` und `csvSpaltenJeFeld` **bleiben** — sie sind vom Vorgangssystem in Gebrauch. |

### 3.2 Anzeige

| Datei | Vorschlag |
|---|---|
| [StatusWarum.tsx](../../src/plugins/antraege/status/StatusWarum.tsx) (7) | **Ersetzt durch das Herleitungs-Popover aus P1** ([HerleitungPopover.tsx](../../src/plugins/antraege/status/HerleitungPopover.tsx)). Es beantwortet dieselbe Frage aus dem amtlichen Status statt aus Rängen. Der Konflikt-Tooltip entfällt mit den Konflikten. |
| [StatusDetailSection.tsx](../../src/plugins/antraege/status/StatusDetailSection.tsx) (1) | Die Vorschau-Phase im Kopf auf die ZAH-Phase umhängen; das „Warum?"-Feld und die abgeleiteten „Nächsten Schritte" entfallen — beide haben ihre Nachfolger schon daneben stehen (Herleitung, Navigator). |
| [StatusVerlaufWidget.tsx](../../src/plugins/home/widgets/StatusVerlaufWidget.tsx) (1) | **Umhängen, nicht stilllegen.** Es zeigt Status + Mini-Verlauf + ersten Schritt; alle drei gibt es weiterhin (ZAH-Phase, Chronik, Navigator). Nur `SPINE_LABEL` weicht `zahPhaseLabel`. |
| [StatusChronik.tsx](../../src/plugins/antraege/status/StatusChronik.tsx) (2) + [labels.ts](../../src/plugins/antraege/status/labels.ts) (2) | `SPINE_LABEL` durch `zahPhaseLabel` ersetzen. Rein kosmetisch. |

### 3.3 Kuration (Status-Katalog-Plugin)

| Datei | Vorschlag |
|---|---|
| [KatalogTab.tsx](../../src/plugins/status-cockpit/KatalogTab.tsx) (3) | Spalten `Spine-Phase`, `Rang`, `Prominenz` **entfernen**; `Zieltage`, `Code`, `ZAH-Phase` bleiben. Vorkommen und „zuletzt gesehen" bleiben als Drift-Anzeige. |
| [FelderTab.tsx](../../src/plugins/status-cockpit/FelderTab.tsx) (3) | Dieselben drei Spalten entfernen, dazu den Filter „nur mit Rang". **Ordner bleiben** als Gliederung, Ordner-Ränge entfallen ersatzlos (inkl. 999-Sentinel). |
| [useStatusCockpit.ts](../../src/plugins/status-cockpit/useStatusCockpit.ts) (5) | Simulation (`aktivVerteilung`, `entwurfVerteilung`, `phasenWechsel`, `konflikte*`) entfällt mitsamt der Simulations-Leiste. |
| [DiagnoseSektion.tsx](../../src/plugins/status-cockpit/DiagnoseSektion.tsx) (2) | **Zuletzt entfernen** — sie ist das Messinstrument des Rückbaus. Vorher in den Golden Test überführen. |
| [labels.ts](../../src/plugins/status-cockpit/labels.ts) (4) | `SPINE_LABEL`/`SPINE_WERTE` entfernen. |
| [RegelnTab.tsx](../../src/plugins/status-cockpit/RegelnTab.tsx) | Der Bereich „Nächste-Schritte-Regeln (alte Ableitung)" entfällt; die To-do-Kaskade bleibt allein. Vorher prüfen, ob die 5 Alt-Regeln inhaltlich in R1–R25 aufgehen (Erwartung: ja — sie haben dieselbe WENN-Status-DANN-Schritt-Form), und das Ergebnis dokumentieren. |

### 3.4 Fassade

[status-canonical.ts](../../src/core/utils/status-canonical.ts) bleibt als
**Fassade** erhalten (`isOpenStatus`, `isTerminalStatus`, `getStatusCategory` …)
— sie ist app-weit in Gebrauch, unter anderem in `frist.ts`, den Kanban-Lanes und
`bearbeiterFilter.ts`. Vorschlag für die Speisung aus Code + ZAH-Phase:

| ZAH-Phase | StatusCategory |
|---|---|
| eingang | offen |
| vollstaendigkeit | offen, bei Code 35–37 `nachforderung` |
| pruefung | in_pruefung |
| entscheidung | entscheidung |
| begleitung | `bewilligt` bei Code 59, sonst `begleitung` |
| abgeschlossen | `abgeschlossen`, bei Code 73 `abgelehnt` |
| Marker (29/88/93/94) | sonstige |

**Vorsicht:** die Bauantrag-Domäne (dev/demo) hängt an derselben Map und hat
keine Codes. Sie bleibt auf dem eingebauten Fallback — der Snapshot-Weg ist schon
heute `snapshot-first mit CATEGORY_MAP-Fallback`, das trägt.

### 3.5 Guard

[byte-identitaet.test.ts](../../src/core/status/__tests__/byte-identitaet.test.ts)
sichert, dass `getStatusCategory` über den Snapshot bitweise dasselbe liefert wie
über die eingebaute Map. **Er bleibt gültig**, solange die Fassade dieselben
Kategorien liefert — er misst die Fassade, nicht die Ableitung. Ergänzt wird er
um den Golden Test aus Abschnitt 1.

## 4. Reihenfolge

1. **Golden Test** aus dem Vergleichs-Report (Muster + Anzahl einfrieren).
2. **Fassade** umstellen (`status-canonical.ts` aus Code + ZAH-Phase speisen),
   `byte-identitaet` muss grün bleiben.
3. **Anzeige** umhängen (3.2) — ab hier sieht der Nutzer die ZAH-Phase.
4. **Kuration** entschlacken (3.3), Diagnose als Letztes.
5. **Kern** entfernen (3.1), Tests mitziehen.
6. Fassungen auf dem Share ziehen die entfallenen Felder beim nächsten Speichern
   von selbst ab; ein Migrationsschritt ist **nicht** nötig, solange die Felder
   optional bleiben.

## 5. Offen vor P6

- **Phasen-Schnitt fachlich abnehmen** (Konzept 5, Verifikationsfrage 3): die
  264 „beantragt → Eingang statt Vollständigkeit" sind die größte Einzelgruppe.
  Ist das die gewollte Lesart?
- **`terminal` ausserhalb der Ableitung**: prüfen, wer es noch liest, bevor es
  aus dem Datenmodell fällt.
- **Verifikationsfragen V1–V4** aus [todo-regeln-ab-seed.md](todo-regeln-ab-seed.md)
  mit den AB-Kollegen klären — sie betreffen die Kaskade, nicht den Rückbau,
  sollten aber vorher stehen.
