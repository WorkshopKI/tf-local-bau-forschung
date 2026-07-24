# Status-System neu — Übersicht

Ersetzt die früher hartkodierte Status→Kategorie-Map durch **kuratierbare Daten +
Historie + deterministische Ableitung**. Rein deterministisch, kein LLM,
gerätelokal. Gated hinter dem Flag `statusCockpit` (dev/pl/kurator).

## Drei Schichten

1. **Katalog** ([katalog-store.ts](../../src/core/status/katalog-store.ts), Seed
   [seed.ts](../../src/core/status/seed.ts)) — jedes Statusfeld + jeder Statuswert
   bekommt Kategorie, Spine-Phase, Rang, Prominenz, Terminal-Flag. Versioniert im
   dedizierten IDB-Store `status_katalog`. Unbekanntes wird beim Import als
   `unkuratiert` gesammelt, nie automatisch gemappt.
2. **Historie** ([HISTORIE.md](HISTORIE.md)) — append-only `StatusEvent`-Log
   (`status_event`), per idempotentem Post-Import-Reconcile befüllt.
3. **Ableitung** ([ableitung.ts](../../src/core/status/ableitung.ts)) — Hauptstatus
   = höchster Phasenrang über alle berücksichtigten Feldwerte (robust gegen
   veraltete Einzelfelder); Terminal schlägt Rang; Widerspruch ⇒ Konflikt
   (ausgewiesen, nie stillschweigend aufgelöst); priorisierte Nächste-Schritte-Regeln.

## Anzeigeflächen

- **Cockpit** (Plugin `status-cockpit`, [status-cockpit.md](../feedback-kontext/status-cockpit.md)) —
  Katalog/Felder/Regeln kuratieren, Simulieren, Versionieren, JSON-Export/Import.
- **Detailseite** — `#status`-Abschnitt (Timeline + „Warum" + nächste Schritte).
- **Fördertabelle** — Konflikt-Badge auf Multi-TV-Verbund-Zeilen.
- **Home-Widget** „Status & Verlauf".

## Harte Regeln

- **`getStatusCategory` ist snapshot-basiert** ([status-canonical.ts](../../src/core/utils/status-canonical.ts)):
  liest den aktiven Katalog-Snapshot, Fallback = eingebaute `CATEGORY_MAP`; bei
  identischem Mapping **bitweise identisch** (Test `byte-identitaet`).
- **Katalog + Event-Log sind gerätelokal** — nie in `registry.json`, Daten-Share,
  SMB-Snapshot oder Personal-Mirror. Portabilität nur über JSON-Export/Import
  (Guard `status-system-local-only`).
- **Event-Log ist append-only** — nie mutieren/löschen (auch kein „Aufräumen"
  ignorierter Felder).
- **Spine = amtliche Wirbelsäule** (`STEPPER_STATIONS`); die bestehende
  `statusZuStepperPosition.ts` bleibt unverändert (Zwei-Achsen-Prinzip: amtlicher
  Status vs. Artefakte GA/NF/ABL/RNE).

## Weitere Docs

- [BESTANDSAUFNAHME.md](BESTANDSAUFNAHME.md) — verifizierter Ausgangszustand.
- [KATALOG-V1.md](KATALOG-V1.md) — Seed-Defaults (Rang/Spine/Prominenz/Terminal, Regeln).
- [HISTORIE.md](HISTORIE.md) — Event-Modell + Reconcile.
