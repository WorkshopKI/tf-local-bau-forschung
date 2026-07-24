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

Kleine Default-Regelmenge ([seed.ts](../../src/core/status/seed.ts) `baueSeedRegeln`),
alle aktiv. Werkzeug-Verweise sind reine Navigation, nie selbst ein Status.

| id | Priorität | Bedingung (status ist …) | Schritt (→ Werkzeug) |
|---|---|---|---|
| `nf-offen` | 10 | `nf gestellt` | Nachforderung bearbeiten → nachforderung |
| `ga-fertig` | 20 | `gutachten fertig` | Erstentscheidung vorbereiten → gutachten |
| `bewilligungsreif` | 20 | `bewilligungsreif` | Bewilligung vorbereiten |
| `ablehnungsreif` | 20 | `ablehnungsreif` | Ablehnung vorbereiten → ablehnung |
| `eingang-vollstaendigkeit` | 40 | `beantragt` | Vollständigkeit prüfen |

Alle zutreffenden aktiven Regeln steuern Schritte bei (dedupliziert nach
Label+Werkzeug, nach Priorität aufsteigend). Bedingungen unterstützen
`ist`/`istNicht`/`gefuellt`/`leer` und `datumVor`/`datumNach` (relativ zu heute)
sowie verschachtelte `alle`/`einige`-Gruppen.

## Ableitung (Engine)

- **Hauptstatus = höchster Rang** über alle berücksichtigten Feldwerte
  ([ableitung.ts](../../src/core/status/ableitung.ts)); unkuratierte / `rang:0` /
  inaktive Werte tragen nicht bei (stehen aber mit Grund in `beitraege`).
- **Terminal schlägt Rang** (Ablehnung/Widerruf/Schluss).
- **Konflikt** wenn berücksichtigte, nicht-terminale Werte ≥ `KONFLIKT_SCHWELLE`
  (= 2) Spine-Stufen auseinanderliegen — das Ergebnis bleibt der Max-Rang, der
  Widerspruch wird nur ausgewiesen. (Ein 1-Stufen-Abstand wie
  `bearbeitungsreif`↔`gutachten fertig` ist bewusst KEIN Konflikt.)

## Offene Kurations-/v2-Punkte

- Labels der Wert-Einträge sind in v1 der (kleingeschriebene) Rohwert — im Cockpit
  editierbar; die bestehende UI nutzt weiter `status-mappings.ts` und ist
  unberührt.
- Terminal-Semantik von `schlussvermerk` (positiv-terminal) vs. Verbund-
  Aggregation über divergierende TV-Stände — im Zweifel Konflikt-Anzeige.
- Flache Wert→Kategorie-Kollabierung im Snapshot nimmt an, dass ein Rohwert
  feld-unabhängig dieselbe Kategorie trägt (im Seed erfüllt).
