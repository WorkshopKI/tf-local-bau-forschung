# Antrag-Status: Rohwert vs. Kategorie (CLAUDE.md Pitfall #12)

## Werte-Satz

`AntragListItem.status` trägt **CSV-Rohwerte aus dem C16-Quellsystem** (`beantragt`, `VN geprüft`, `NF gestellt`, `bewilligt`, `Schlussvermerk`, `abgelehnt/zurückgezogen`, …). Die Kategorie leitet sich daraus über den Code-Katalog ab: Rohtext → Code → ZAH-Phase → `StatusCategory` ([kategorie-ableitung.ts](../../src/core/status/kategorie-ableitung.ts)).

Bis v2.395 lief daneben ein zweiter, handgepflegter Werte-Satz mit Snake-Case-Werten der mit v2.88 entfernten Bauantrag-Demo (`neu`, `in_pruefung`, `genehmigt`, `archiviert`, …). Er ist entfernt; im echten Bestand kam keiner dieser Werte vor (gemessen: 14 221 Anträge, 26 Status-Werte, 0 Treffer). Was der Katalog nicht kennt, ist `sonstige` — das ist eine eigene Aussage, kein Verfahrensschritt.

## Strukturelle Sicherung (Mai 2026)

`Antrag.status`, `AntragListItem.status` und `Verbund.status` sind seit dem Branding-Patch als `AntragStatusRaw = string & { __brand }` typisiert. Direkte Schreib-Aktionen mit String-Literal (`antrag.status = 'bewilligt'`) sind TS-Compile-Errors. An Boundary-Stellen (CSV-Merger, Test-Fixtures, Seed-Loader) wird `asAntragStatusRaw(s)` aufgerufen — kein Branding-Cast im Plugin-Code.

## Vergleichs-Pflicht: Kategorie-Helper

Views, Dashboard, Eingangs-Ampel und Workflow-Logik **NIE direkt** gegen einen Rohwert vergleichen (`status === 'bewilligt'`). Stattdessen die Kategorie-Helper aus [src/core/utils/status-canonical.ts](../../src/core/utils/status-canonical.ts) nutzen:

- `isOpenStatus()`
- `isBewilligtStatus()`
- `isNachforderungStatus()`
- `isBegleitungStatus()`
- `isClosedStatus()`
- `getStatusCategory()`

**Hinweis**: TypeScript erlaubt `===` zwischen branded und literal noch wegen string-overlap (Sprach-Quirk). Die Pflicht ist über den Vitest-Convention-Test in [src/__tests__/codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts) abgesichert (Test `no-direct-status-compare`, Pattern fängt eindeutige Antrag-Status-Strings).

Die Filter-Sidebar ([statusGroups.ts](../../src/plugins/antraege/filter/statusGroups.ts)) zeigt weiter Förderantrag-Rohwerte als Phasen-Gruppen — sie ist hiervon unberührt.

**Neuer Förderantrag-Status**: in `statusGroups.ts` UND `status-canonical.ts` UND `status-mappings.ts` ergänzen.

## Semantik-Detail

### (a) Förderantrag hat keinen final-`abgelehnt`-Endzustand

`Ablehnung` / `Widerruf` / `Anhörung zum Widerruf` zählen als Kategorie `entscheidung` (= noch im Verfahren, `isOpenStatus`-true). Der final-negative Pfad geht über `abgelehnt/zurückgezogen` (Kategorie `abgeschlossen`).

Die Kategorie `abgelehnt` ist deshalb **unbesetzt** — sie bleibt trotzdem im Union-Type: Farbe, Label, Quickchip und Kanban-Lane hängen an ihr, und eine kuratierte Katalog-Fassung kann sie besetzen. `isAbgelehntStatus` ist mit v2.395 entfallen (hätte immer `false` geliefert); `isAbgelehntZurueckgezogenStatus` prüft weiter beides.

### (b) Begleit-Phase

Status-Werte mit Präfix `VN ` (Verwendungsnachweis) oder `ZB ` (Zwischenbericht) **plus die Widerrufs-Stati `Widerruf` und `Anhörung zum Widerruf`** zählen als Kategorie `begleitung` — die Phase nach Bewilligung. Bekannte Vertreter: `VN geprüft`, `VN techn. geprüft`, `Widerruf`, `Anhörung zum Widerruf`. Unbekannte VN-/ZB-Varianten werden automatisch via Pattern-Fallback (`/^(vn|zb)[\s.]/`) erkannt; Widerruf-Stati sind explizit gelistet (das Pattern fängt sie nicht).

**Begründung**: Widerruf ist post-Bewilligungs-Verfahren (Bescheid wurde erteilt und soll zurückgenommen werden) — gleicher Lebenszyklus wie VN-Prüfung, andere Frist-Logik als Antragsphase. Zuständigkeit wechselt von TIB/BIB (Antrag) zu ZTP/PFM (Begleitung).

### (c) Bearbeiter-Filter-Toggle `bearbeiter_inkl_begleitung` (Doppelwirkung, Mai 2026 erneut revidiert)

Steuert BEIDES — Phase-Sichtbarkeit UND KUERZ-Spalten:

(i) **Phase-Filter**: ohne Toggle werden Begleit-Stati (VN-/ZB-) universell ausgeblendet (Home + Antrags-Liste + Aggregate), auch wenn das TIB-/BIB-Kuerzel matched. Mit Toggle bleiben sie sichtbar. Implementiert in `filterByBegleitungPhase` ([src/plugins/antraege/bearbeiterFilter.ts](../../src/plugins/antraege/bearbeiterFilter.ts)) und dem Phase-Gate in `computeDashboardAggregate` ([src/plugins/home/dashboardAggregate.ts](../../src/plugins/home/dashboardAggregate.ts)).

(ii) **KUERZ-Match**: ohne Toggle matchen nur TIB/BIB-Spalten, mit Toggle zusätzlich ZTP/PFM.

(iii) **Frist-Berechnung phasen-abhängig**:
- Antragsphase = `antragsdatum + 90 Tage` (Bearbeitungs-SLA)
- Begleitphase = `vn_eingang_datum + 6 Monate` (VN-Frist, D_VBE in Bgl-CSV)
- Wenn D_VBE leer ist, hat ein VN-Antrag keine Frist (`frist_datum = null`)
- Zentraler Helper: `computeFristDatum` in [src/core/services/csv/frist.ts](../../src/core/services/csv/frist.ts)

Zwischenstand-Doku (Mai 2026 kurzzeitig, dann revidiert): Toggle steuerte NUR KUERZ-Spalten, TIB-Match überstimmte die Phase — diese Variante gilt nicht mehr.

## Test-Fixtures

Tests in [src/plugins/antraege/__tests__/](../../src/plugins/antraege/__tests__/) laufen gegen `real-csv-antraege.ts` (CSV-Rohwerte) plus die echten Real-Fixture-CSVs (`realCsvImport.test.ts`). Bis v2.395 lief daneben eine zweite Fixture mit Bauantrag-Werten, gegen dieselben Erwartungen — ein Test, der nur mit einer der beiden passte, zeigte einen Domain-Mismatch. Mit dem Wegfall der zweiten Domäne entfällt dieser Doppellauf.

---

## CLAUDE.md-Pitfalls (Detail)

### Pitfall #9 — Status-Mappings sind domain-getrennt

`src/core/utils/status-mappings.ts` ist NUR für die Anzeige des Antrags-Rohwerts (`beantragt`, `VN geprüft`, `bewilligt`, …). Feedback-Status (`neu`, `geplant`, `in_bearbeitung`, `umgesetzt`, `abgelehnt`, `archiviert`) hat seine eigenen Maps in `src/components/feedback/constants.ts` — bewusst getrennt, weil andere Semantik (siehe [feedback-system.md](feedback-system.md) Pitfall #21). Beim Hinzufügen neuer Status-Werte: Vorgang-Status zentral (`status-mappings.ts` + `status-canonical.ts` + `statusGroups.ts`), Feedback-Status in der Feedback-Domain.

### Pitfall #12 — Antrag-Status: Rohwert vs. Kategorie

`[test: no-direct-status-compare]` — Die gesamte Datei oben ist die Detail-Heimat. Kernregel: `Antrag.status` / `AntragListItem.status` / `Verbund.status` (`AntragStatusRaw = string & { __brand }`) nie gegen ein Literal vergleichen (`status === 'bewilligt'`) — Kategorie-Helper aus [status-canonical.ts](../../src/core/utils/status-canonical.ts) nutzen (`isOpenStatus`, `isBewilligtStatus`, `isBegleitungStatus`, `isClosedStatus`, `getStatusCategory`). **Maschinell erzwungen** durch `no-direct-status-compare` (Inline-Ausnahme: `// allow-status-literal: <grund>`).
