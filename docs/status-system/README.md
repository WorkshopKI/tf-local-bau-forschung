# Status-System neu — Übersicht

Ersetzt die früher hartkodierte Status→Kategorie-Map durch **kuratierbare Daten +
Historie + deterministische Ableitung**. Rein deterministisch, kein LLM. Gated
hinter dem Flag `statusCockpit` (dev/pl/kurator).

**Der Katalog ist Team-Daten, die Historie ist gerätelokal.** Seit v2.332 liegt
der kuratierte Katalog als Sidecar `_intern/status-katalog.json` auf dem
Daten-Share — vorher wirkte eine Kuration nur auf dem Rechner, auf dem sie
stattfand, sodass entweder niemand kuratierte oder jeder neu. Das Event-Log
wandert bewusst NICHT mit: es hält fest, wann *diese Installation* eine Änderung
beobachtet hat, und ergäbe zusammengeführt eine widersprüchliche Historie.

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
- **Der Katalog geht auf genau einem Weg auf den Share**: die Sidecar
  ([katalog-share.ts](../../src/core/status/katalog-share.ts)), Profil
  idempotent-overwrite + Backup-Rotation, self-gated über `queryPermission`.
  Nie `registry.json`, nie SMB-Snapshot, nie Personal-Mirror (Guard
  `status-katalog-share-only`). Der Abgleich läuft **einmal beim App-Start**
  (`initStatusKatalog`) — `ladeAktiveVersion` bleibt IDB-only, weil sie an jedem
  Import hängt. Vor der ersten Übernahme sichert
  `uebernehmeKatalogVomShare` den lokalen Stand einmalig unter
  `status-katalog:vor-share-uebernahme`; lokale Fassungen mit Nummern, die der
  Share nicht kennt, bleiben stehen.
- **Das Event-Log bleibt gerätelokal** — nie Share/Snapshot/Personal-Mirror
  (Guard `status-event-log-local-only`). Ebenso der Unkuratiert-Puffer: er hält
  fest, was *diese* Installation gesehen hat; was die PL inzwischen team-weit
  kuratiert hat, räumt `pruneKuratierte` beim nächsten Import heraus.
- **JSON-Export/Import im Cockpit bleibt** — nicht mehr als einziger
  Portabilitätsweg, sondern für Sicherung und Transfer zwischen Installationen.
- **Event-Log ist append-only** — nie mutieren/löschen (auch kein „Aufräumen"
  ignorierter Felder).
- **Spine = amtliche Wirbelsäule** (`STEPPER_STATIONS`); die bestehende
  `statusZuStepperPosition.ts` bleibt unverändert (Zwei-Achsen-Prinzip: amtlicher
  Status vs. Artefakte GA/NF/ABL/RNE).

## Weitere Docs

- [BESTANDSAUFNAHME.md](BESTANDSAUFNAHME.md) — verifizierter Ausgangszustand.
- [KATALOG-V1.md](KATALOG-V1.md) — Seed-Defaults (Rang/Spine/Prominenz/Terminal, Regeln).
- [HISTORIE.md](HISTORIE.md) — Event-Modell + Reconcile.
