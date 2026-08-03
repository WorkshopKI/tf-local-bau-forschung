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

## Zwei Schichten

1. **Katalog** ([katalog-store.ts](../../src/core/status/katalog-store.ts), Seed
   [seed.ts](../../src/core/status/seed.ts)) — jedes Statusfeld + jeder Statuswert
   bekommt Kategorie, ZAH-Phase und Prominenz; Statuswerte zusätzlich Zieltage.
   Versioniert im
   dedizierten IDB-Store `status_katalog`. Unbekanntes wird beim Import als
   `unkuratiert` gesammelt, nie automatisch gemappt.
   Seit v2.348 führt er die **505 Codes des Fachsystems** aus der Kürzel-Zuarbeit
   in einem Ordnerbaum (Verbund und Teilvorhaben getrennt), jeweils mit den
   Rollen, die den Eintrag setzen dürfen — Herkunft, Spalten-Konvention und
   Wirkung: [KATALOG-CODES.md](KATALOG-CODES.md).
2. **Historie** ([HISTORIE.md](../_archiv/HISTORIE.md)) — append-only `StatusEvent`-Log
   (`status_event`), per idempotentem Post-Import-Reconcile befüllt.

> **Eine dritte Schicht gab es bis v2.384**: eine Ableitungs-Engine, die aus dem
> ganzen Feld-Ensemble einen Hauptstatus errechnete (höchster Rang gewinnt,
> `terminal` schlägt Rang, Widerspruch ⇒ Konflikt). Sie lief dem amtlichen Status
> regelmäßig voraus — bei 485 von 7 534 Verbünden sagten beide etwas anderes —
> und ist mit dem Rückbau entfallen. Die App leitet keinen Status ab
> (Pitfall #44); was von der Achse bleibt, ist die **ZAH-Phase** am amtlichen
> Code: [vorgangssystem.md §7](../architecture/vorgangssystem.md#7-der-rückbau-der-alten-ableitung-p6-umgesetzt).

## Anzeigeflächen

- **Cockpit** (Plugin `status-cockpit`, [status-cockpit.md](../feedback-kontext/status-cockpit.md)) —
  Katalog/Kürzel/To-dos kuratieren, Versionieren, JSON-Export/Import.
  Der Ordnerbaum ist seit v2.351 ein **echter Baum** ([KategorieEditor.tsx](../../src/plugins/status-cockpit/KategorieEditor.tsx)):
  Zweige klappen zu, umgehängt wird per Ziehen (Regeln rein in
  [ordnerDrag.ts](../../src/plugins/status-cockpit/ordnerDrag.ts) — Ebenen bleiben
  getrennt, kein Nachfahre als Elternknoten).
- **Detailseite** — `#status`-Abschnitt (ZAH-Phase + Verlauf + Navigator).
  Zwei Sichten auf den Verlauf: **Chronik** (Standard,
  [chronik.ts](../../src/core/status/chronik.ts)) liest die Termine aus den
  Datumsfeldern und steht damit nach jedem Import bereit; der **Zeitstrahl**
  ([StatusTimeline.tsx](../../src/plugins/antraege/status/StatusTimeline.tsx))
  zeigt das gerätelokale Ereignis-Protokoll und bleibt leer, bis diese
  Installation die erste Änderung mitgeschrieben hat. Beide filtern
  `ignoriert`/`nebensaechlich` nach derselben Regel.
- **Fördertabelle** — Info-Icon je Zeile mit der Status-Erklärung.
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
- **Eine Phasen-Achse**: die ZAH-Phase am amtlichen Code. `STEPPER_STATIONS`
  speist sich seit v2.384 daraus, statt eine zweite Wirbelsäule zu führen. Das
  Zwei-Achsen-Prinzip bleibt — amtlicher Status **vs. Artefakte** (GA/NF/ABL/RNE),
  nicht amtlicher Status vs. abgeleitete Position.

## Weitere Docs

- [KATALOG-CODES.md](KATALOG-CODES.md) — die ~180 Codes des Fachsystems:
  Spalten-Konvention (`D_`/`T_`/`X`), Ordnerbaum, AB/FB, ZAH-Phase je Feld,
  Ordner-Spalten in der Fördertabelle.
- [KATALOG-V1.md](KATALOG-V1.md) — Seed-Defaults. **Historisch**: die dort beschriebenen Rang-/Spine-/Terminal-Defaults sind mit v2.385 entfallen.
- Im Archiv (Momentaufnahmen, nicht beim Arbeiten am Code lesen): [BESTANDSAUFNAHME.md](../_archiv/BESTANDSAUFNAHME.md) — verifizierter Ausgangszustand; [HISTORIE.md](../_archiv/HISTORIE.md) — Event-Modell + Reconcile.
