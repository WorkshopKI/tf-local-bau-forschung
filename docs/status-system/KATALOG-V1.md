# Status-Katalog v1 — Seed-Defaults

Dokumentiert die deterministische Auslieferungs-Fassung (Version 1) des
Status-Katalogs, erzeugt von [`baueSeedVersion()`](../../src/core/status/seed.ts).
Die Wert→Kategorie-Zuordnung stammt **1:1** aus
[`status-canonical.ts`](../../src/core/utils/status-canonical.ts) — angereichert
wird nur additiv (Spine-Phase, Rang, Prominenz, Terminal). Alles hier ist
**kuratierbar** im Cockpit (Phase 4); v1 ist bewusst konservativ.

## Felder

| feldId | Label | typ | Prominenz-Default |
|---|---|---|---|
| `status` | TV-Status | wert | normal |
| `verbund_status` | Verbund-Status | wert | normal |
| `vb_phase` | Verbund-Phase (Fördervariante) | wert | nebensächlich |
| `antragsdatum` | Antragseingang | datum | meilenstein |
| `erstentscheidung` | Vorläufige Erstentscheidung | datum | meilenstein |
| `bewilligung_datum` | Bewilligung | datum | meilenstein |
| `vn_eingang_datum` | VN-Eingang (Begleitphase) | datum | normal |

Das Statuswert-Vokabular wird unter **beiden** Wert-Feldern (`status` +
`verbund_status`) geführt — TV- und Verbund-Status tragen dieselben Rohwerte.
`vb_phase` bekommt **kein** geseedetes Wert-Enum: seine Werte (1–5, 9) sind eine
Fördervarianten-Klassifikation, keine Lebenszyklus-Position. Sie tauchen beim
ersten Import als `unkuratiert` auf (rang 0, tragen nicht zur Ableitung bei) und
können im Cockpit auf `nebensächlich`/`ignoriert` gestellt werden.

## Spine-Phase je Kategorie (deckungsgleich mit `statusZuStepperPosition.ts`)

| Kategorie | Spine-Phase | Bemerkung |
|---|---|---|
| offen | eingang | Wert-Override: `bearbeitungsreif`/`nl eingegangen` → **vollständigkeit** |
| in_pruefung | fachprüfung | |
| nachforderung | fachprüfung | |
| entscheidung | fachprüfung | Entscheidungs-Vorbereitung (bewilligungsreif/ablehnungsreif …) |
| bewilligt | bewilligung | |
| begleitung | bewilligung | VN/ZB-Prüfung + Widerruf (nach Bewilligung) |
| abgeschlossen | schluss | inkl. finaler Negativpfad `abgelehnt/zurückgezogen` |
| abgelehnt | fachprüfung | Bauantrag-Domäne: bricht an Fachprüfung ab (`terminal`) |
| sonstige | keine | trägt nicht zur Ableitung bei |

## Rang (höchster Rang = weiteste Lebenszyklus-Position)

Basisrang je Spine-Phase (Zehnerlücken) + additiver Feinrang je Kategorie:

| Spine-Phase | Basis | Kategorie-Feinrang (additiv) |
|---|---|---|
| eingang | 10 | — |
| vollständigkeit | 20 | — |
| fachprüfung | 30 | in_pruefung +0, nachforderung +2, entscheidung +6 |
| bewilligung | 40 | bewilligt +0, begleitung +4 |
| schluss | 50 | — |
| keine | 0 | (trägt nicht bei) |

So gewinnt z. B. `Gutachten fertig` (in_pruefung → 30) gegen ein veraltetes
`bearbeitungsreif` (vollständigkeit → 20): der Verbund steht in **Fachprüfung**,
der Widerspruch wird als Konflikt ausgewiesen (Phase 3), nicht stillschweigend
aufgelöst.

## Prominenz (Meilensteine)

`meilenstein` (die Fixpunkte der amtlichen Reise): Rohwerte `beantragt`,
`bewilligt`, `schlussvermerk`, `abgelehnt/zurückgezogen`; sowie die Datumsfelder
`antragsdatum`, `erstentscheidung`, `bewilligung_datum`. Alles übrige `normal`
(bzw. `vb_phase` → `nebensächlich`). **v1 seedet nichts auf `ignoriert`** — das
ist der prominenteste Kurations-Handgriff (z. B. „Termin erste
Zahlungsanforderung" nach dem ersten Import auf `ignoriert` setzen).

## Terminal

`terminal: true` für alle Werte der Kategorien **abgeschlossen** und **abgelehnt**
(= `TERMINAL_STATUS_CATEGORIES`, deckt `schlussvermerk`, `beendet`, `abgebrochen`,
`abgelehnt/zurückgezogen` sowie die Bauantrag-`abgelehnt`). Bewusst **ohne**
`bewilligt` (danach folgt noch die Begleitphase). In der Ableitung (Phase 3)
schlägt ein terminaler Wert den Max-Rang.

## Regeln (nächste Schritte)

v1 seedet `regeln: []`. Die Default-Regelmenge kommt in **Phase 3** dazu (z. B.
„Gutachten fertig ⇒ Erstentscheidung vorbereiten") und wird hier ergänzt.

## Offene Kurations-/v2-Punkte

- Labels der Wert-Einträge sind in v1 der (kleingeschriebene) Rohwert — im Cockpit
  editierbar; die bestehende UI nutzt weiter `status-mappings.ts` und ist
  unberührt.
- Terminal-Semantik von `schlussvermerk` (positiv-terminal) vs. Verbund-
  Aggregation über divergierende TV-Stände — im Zweifel Konflikt-Anzeige.
- Flache Wert→Kategorie-Kollabierung im Snapshot nimmt an, dass ein Rohwert
  feld-unabhängig dieselbe Kategorie trägt (im Seed erfüllt).
