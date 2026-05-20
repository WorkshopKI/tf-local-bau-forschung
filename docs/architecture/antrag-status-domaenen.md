# Antrag-Status: zwei Domänen, eine Kategorie (CLAUDE.md Pitfall #12)

## Werte-Sätze

`AntragListItem.status` trägt entweder **Bauantrag-Snake-Case-Werte** (`neu`, `in_pruefung`, `genehmigt`, `abgelehnt`, `archiviert`, …) oder **Förderantrag-CSV-Rohwerte** aus dem Foyer-Quellsystem (`beantragt`, `VN geprüft`, `NF gestellt`, `bewilligt`, `Schlussvermerk`, `abgelehnt/zurückgezogen`, …).

## Strukturelle Sicherung (Mai 2026)

`Antrag.status`, `AntragListItem.status` und `Verbund.status` sind seit dem Branding-Patch als `AntragStatusRaw = string & { __brand }` typisiert. Direkte Schreib-Aktionen mit String-Literal (`antrag.status = 'bewilligt'`) sind TS-Compile-Errors. An Boundary-Stellen (CSV-Merger, Test-Fixtures, Seed-Loader) wird `asAntragStatusRaw(s)` aufgerufen — kein Branding-Cast im Plugin-Code.

## Vergleichs-Pflicht: Kategorie-Helper

Views, Dashboard, Eingangs-Ampel und Workflow-Logik **NIE direkt** gegen einen der Werte-Sätze vergleichen (`status === 'bewilligt'`). Stattdessen die Kategorie-Helper aus [src/core/utils/status-canonical.ts](../../src/core/utils/status-canonical.ts) nutzen:

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

`Ablehnung` / `Widerruf` / `Anhörung zum Widerruf` zählen als Kategorie `entscheidung` (= noch im Verfahren, `isOpenStatus`-true). Der final-negative Pfad geht über `abgelehnt/zurückgezogen` (Kategorie `abgeschlossen`). Nur die Bauantrag-Domain hat `abgelehnt` als finalen Endzustand.

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

Tests in [src/plugins/antraege/__tests__/](../../src/plugins/antraege/__tests__/) laufen mit zwei handgeschriebenen Fixture-Sätzen (`seed-antraege.ts` Bauantrag, `real-csv-antraege.ts` Förderantrag) plus den echten Real-Fixture-CSVs (`realCsvImport.test.ts`) — wenn ein Test mit Bauantrag-Fixture passt aber mit Förderantrag-Fixture failt, ist genau das ein Domain-Mismatch-Bug.
