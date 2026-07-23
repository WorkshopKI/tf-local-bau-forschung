# Protokoll — Artefakt-Werkbank (NF / RNE / ABL) + Textbaustein-Katalog

Laufendes Arbeitsprotokoll des Mehr-Phasen-Umbaus. Hält fest, **welche Default-Entscheidung
wo getroffen wurde** und **was bewusst verschoben** ist — damit die Nachfolge nicht rät.

Startpunkt: v2.307.0, Branch `master`, Baseline `npm run check` grün.

---

## Ausgangs-Inventur (Read-first, gegen den Klon verifiziert)

Fünf Befunde weichen vom Auftrags-Stand (v2.305.2) ab und haben den Zuschnitt geändert:

| Befund | Konsequenz |
|---|---|
| `MapEinreichung` trägt **kein** FKZ/Aktenzeichen (`map-foerderfaehig/types.ts`) — nur `titel`/`akronym`. Es gibt aber `map-vb:<einreichungId>` → `{docId, zusatz[]}` und `IDBStore.entries(prefix)`. | Verbund↔Einreichung als **Rückwärtssuche** über die VB-Doc-ID. Trägt Phase 1 (Zeitplan-Prädikat), Phase 4 (Punkt-Übernahme), Phase 5 (Konsistenz-Checks). |
| RNE/ABL brauchen **keinen** neuen `VorlagenTyp`: `VorlageDialog` nimmt freie `ArtefaktBlock[]` mit eigenem `anker` + `dateiPrefix`; `ANKER_EP` gilt nur für GA (NF beweist das Muster). | `anchor-mapping.ts` bleibt unangetastet; Phase 5.2 schrumpft auf „anderer Präfix + Anker". |
| `sucheNfBausteine` ist **rein** über das Modul-globale `NF_BAUSTEINE`; der Katalog-Service lädt async. | Der geteilte Suchkern bleibt rein und bekommt den Katalog als **Argument** — kein `async` in den MAP-Aufrufpfad. |
| `pausierte-module.ts` ist bewusst **import-frei** (Zyklus-Schutz). | `zeitplanVerfuegbar(hatEinreichungsJson: boolean)` nimmt ein Boolean und ermittelt nichts selbst. |
| `ArtefaktTyp` enthält bereits `'precheck'`; `extractPlatzhalter` ist exportiert. | Kein Typ-Bump; **kein** zweiter Platzhalter-Parser. |

---

## Arbeitsmodus

- Gate je Phase: `npm run check` grün, danach `npm run build:dev` + `npm run build:pl`.
- **Visuelle Abnahme liegt beim Nutzer** (die App braucht SMB-Onboarding unter `file://`,
  Screenshots sind aus der Entwicklungs-Session nicht erzeugbar). Je Phase steht unten eine
  Abnahme-Checkliste; offene Abnahmen bleiben markiert, bis der Nutzer sie bestätigt.
- **STOPP-R** vor jedem Schreibvorgang in `_intern/skills/registry.json` oder
  `_intern/skills/textbausteine.json` — Diff zeigen, Freigabe abwarten.

---

## Phase 0 — Baseline

- `npm run check` auf unverändertem v2.307.0: **grün** (Typecheck, Lint, Zyklen, Vitest,
  `build:dev`).
- Protokollblock angelegt (diese Datei).

**Default-Entscheidungen:** keine.
**Offene Punkte:** keine.

---

## Phase 1 — Ehrliche Gates: Fragen, Abdeckung, Zeitplan (v2.308.0)

**Default-Entscheidungen**

1. **Zeitplan wird nicht nur freigeschaltet, sondern umgestellt.** Ein Gate, das den Tab
   öffnet und darin weiter die PDF-geernteten Zeilen zeigt, hätte genau das ausgeliefert,
   was die Pause verhindern soll. Liegt eine Einreichungs-JSON vor, zeigt der Tab
   **ausschliesslich** die JSON-Zeilen (`EinreichungsPlan.tsx`), sonst bleibt er gesperrt.
2. **Der `aspekte`-Baustein läuft weiter**, obwohl sein Tab gesperrt ist — er füllt Caches
   und den Kontext anderer Bausteine. Un-Pausieren bleibt dadurch eine reine
   Anzeige-Änderung ohne Neuberechnung. Im Stepper trägt der Schritt statt des
   „Tab öffnen"-Links den Pausen-Grund.
3. **Keine `maNr` im JSON-Zeitplan.** Die Einsatzplanung führt je Arbeitspaket mehrere
   Personen, `ApZeile` trägt eine. Eine willkürlich gewählte erste Person wäre schlechter
   als der (bereits vorhandene) deaktivierte „Nach Person"-Umschalter.
4. **Nur Typ-Importe aus dem MAP-Plugin.** Die Laufzeit-Import-Richtung bleibt
   map → antraege; `map-verknuepfung.ts` liest ausschliesslich `kv`-Keys. `datumAbsolut`/
   `monatslaenge` wurden aus `tabellen.ts` exportiert statt nachgebaut — die
   Positions-Herleitung bleibt dadurch single-source mit `normalisiereAnlage5`.
5. **Bestehende Gating-Tests auf `zahlen`/`glossar` umgestellt.** `abdeckung` ist jetzt
   pausiert und hätte die Lauf-Gating-Aussagen überdeckt; die Logik wird weiter geprüft,
   nur über einen nicht pausierten gebundenen Tab.

**Gate:** `npm run check` grün (413 Test-Dateien, 4671 Tests, 0 Zyklen), `build:dev` +
`build:pl` grün.

**Abnahme-Checkliste (offen, beim Nutzer)**
- [ ] Aufbereitung öffnen: **Fragen** und **Abdeckung** ausgegraut mit Hinweis-Tooltip.
- [ ] **Zeitplan** ohne zugeordnete MAP-Einreichung weiter gesperrt (Hinweistext unverändert).
- [ ] Mit zugeordneter Einreichung: Zeitplan klickbar, zeigt Gantt + Kennzahlen aus der
      JSON, Quelle namentlich benannt, keine Plausibilitäts-Sektion.
- [ ] Übersicht: Aspekte-Schritt ohne „Tab öffnen", dafür mit Pausen-Grund; Block 3 nennt
      Zeitplan- und Fragen-Pause.
- [ ] Übrige Tabs unverändert nutzbar.

**Verschoben**
- Die Einsatzplanung (Personen je Arbeitspaket) bleibt ungenutzt — Kandidat für eine
  spätere „Nach Person"-Ansicht aus der JSON.
- Ein Verbund mit mehreren TV bekommt aktuell den Plan **einer** Einreichung; die
  TV-Aufteilung aus JSON-Quellen ist nicht abgebildet.

---

## Phase 2 — Textbaustein-Katalog

*(offen)*

---

## Phase 3 — Verwaltungs-Tab + Word-Import

*(offen)*

---

## Phase 4 — Werkbank NF

*(offen)*

---

## Phase 5 — RNE + ABL

*(offen)*

---

## Phase 6 — Widerspruch/Stellungnahme

*(offen)*
