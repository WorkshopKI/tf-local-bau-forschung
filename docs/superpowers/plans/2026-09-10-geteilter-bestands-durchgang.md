# Geteilter Bestands-Durchgang — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHER SUB-SKILL: `superpowers:executing-plans` (Schritte mit Checkboxen). Gate/Abnahme/Commit bleiben im Hauptlauf.

**Grundlage:** [docs/superpowers/specs/2026-09-10-geteilter-bestands-durchgang-design.md](../specs/2026-09-10-geteilter-bestands-durchgang-design.md)

## Ziel

Ein Lesevorgang über den Bestand, sooft er auch gleichzeitig gebraucht wird. Wer einen
Durchgang startet, während schon einer läuft, **fährt mit** statt die 14 225 Anträge ein
zweites Mal aus IndexedDB zu deserialisieren (3,1 s, nichts davon gecacht).

Zielzahl: die Regeln-Seite kalt mit ihren zwei StrictMode-Läufen fällt von **14 008 ms**
(io 4 975 + 7 694) auf **einen** Lesevorgang.

> **Korrigiert nach der Messung.** Die ursprüngliche Erwartung „zweiter Lauf `io ≈ 0 ms`"
> war falsch: bei *gleichzeitigem* Start warten beide auf dieselbe Promise und melden
> deshalb **denselben** `io`-Wert (beobachtet: `io 4393ms, gelesen` + `io 4393ms,
> 1× mitgefahren`). Nahe null wird `io` nur für einen Mitfahrer, der später dazukommt.
> Der Beleg für die Ersparnis ist nicht die `io`-Zahl, sondern der Lesezähler im Test
> und das Wort `mitgefahren` im Log.

## Architektur

```
        ┌── laufeBestand ────┐
IDB ──▶ │  jedesProgrammRoh  │ ──▶ jederVorgang ──▶ 12 Aufrufer
 3,1s   │  (Runde je         │
        │   bestandGeneration,──▶ ladeBestand (Regeln-Seite)
        │   Nutzerzähler)    │
        └────────────────────┘
```

Die Runde lebt **genau so lange, wie ein Durchgang sie hält**: hochzählen beim Eintritt,
herunterzählen im `finally`, bei 0 verworfen. Kein TTL, kein Sitzungs-Cache — die
Roh-Records sind 284 MB und dürfen den Mount nicht überleben.

Der Schnitt liegt **unter** `jederVorgang`, nicht darin: `ladeBestand` ruft
`sammleVorkommen` je **Verbund** mit allen TVs auf, `jederVorgang` je **Antrag** mit einem.
Bei `art: 'verbund-aus-tv'` gewinnt der erste Treffer — die beiden sind nicht ineinander
überführbar, ohne die Ausgabe zu ändern (Spec 2.7).

## Tech-Stack

TypeScript, kein React im Modul. Vitest mit **injiziertem Leser** statt `vi.mock` — ein
modulweiter Mock zwänge die Datei in `ISOLATED_TESTS`.

## Global Constraints

- **Pitfall #44/#45** — geändert wird, *wann* und *wie oft* gelesen wird, **nie**, was
  herauskommt. Der Rumpf der Programm-Schleife in `ladeBestand` bleibt Zeile für Zeile.
- **Bug-Klasse 5** — dieselbe Spalte liegt je Programm unter einem anderen Record-Key.
  Nichts, was an `aufloesung`/`plan` hängt, darf über die Programmgrenze wandern.
- **Pitfall #1/#2/#5** — `file://`: kein dynamischer Import, kein `fetch`, kein roher
  Worker. Berührt dieses Vorhaben nicht, gilt aber weiter.
- **§17-Warnung** — kein Chunking des IDB-Lesens (gemessen ~7 s teurer).
- **§17-Falle** — `trigger`-Zeiten sind Wartezeit im geteilten `Promise.all`, keine
  Trigger-Kosten. Nicht als Erfolg oder Misserfolg lesen.
- **Innerer Loop** `npm run check:quick`, **Phasen-Gate** `npm run check` (inkl. `cycles`,
  leere Allowlist — neuer Zyklus wird aufgelöst, nicht eingetragen).
- **Windows-Shell** — keine Heredocs; mehrzeilige Inhalte über Write/Edit; Commit-Message
  über `.git/COMMIT_MSG.tmp`.
- **Parallele Sessions** — eine zweite Session arbeitet am selben Repo (v6.47.1 kam von
  dort). Vor dem Commit `git status --porcelain` prüfen und **nur eigene Dateien** stagen.
- **Ein Server** — `dev:local` läuft auf 5179 (`local-e`), weil 5175 belegt ist.

## Dateien im Überblick

| Datei | Rolle |
|---|---|
| [src/core/status/roh-halter.ts](../../../src/core/status/roh-halter.ts) | **neu** — die Runde: Roh-Arrays je Programm, Nutzerzähler, Generations-Schlüssel |
| [src/core/status/vorgangs-quelle.ts](../../../src/core/status/vorgangs-quelle.ts) | `jederVorgang` fährt auf dem Halter; Rumpf unverändert |
| [src/plugins/status-cockpit/ladeBestand.ts](../../../src/plugins/status-cockpit/ladeBestand.ts) | gibt seinen duplizierten Lesecode ab; Rechenteil unverändert |
| [src/core/status/index.ts](../../../src/core/status/index.ts) | Barrel-Export des neuen Moduls |
| [src/core/status/\_\_tests\_\_/roh-halter.test.ts](../../../src/core/status/__tests__/roh-halter.test.ts) | **neu** — Mitfahrt, Nicht-Cache, Generationswechsel, Fehlerfall |
| [docs/architecture/vorgangssystem.md](../../architecture/vorgangssystem.md) | §17 fortschreiben **inkl. Korrektur der „12–15 s"** |
| CHANGELOG.md · package.json | Version + Eintrag |

## Tasks

### - [x] T1 — `roh-halter.ts` anlegen

**Dateien:** `src/core/status/roh-halter.ts` (neu)

**Schnittstelle:**
```ts
export interface ProgrammRoh {
  programmId: string;
  verbuende: Verbund[];
  antraege: Antrag[];
  schemas: CsvSchema[];
}
export interface RohLeser {
  programme: (idb: IDBStore) => Promise<Programm[]>;
  roh: (idb: IDBStore, programmId: string) => Promise<Omit<ProgrammRoh, 'programmId'>>;
}
export async function* jedesProgrammRoh(
  idb: IDBStore,
  leser?: RohLeser,
): AsyncGenerator<{ roh: ProgrammRoh; takt: RohTakt }>
export function halterZustand(): { runde: boolean; nutzer: number; programme: number };
```

> **Als Callback gebaut, als Generator geliefert.** Die erste Fassung nahm ein
> `besuche`-Callback; damit wanderte der Rumpf der Programm-Schleife in eine Closure und
> der Lauf wurde bei byte-identischem Rumpf ~400 ms langsamer (Heap-Kontext statt
> Stack-Slots). Mit `for await` ist die Rechenzeit auf 1 ms identisch zum Stand vorher.
> Preis des Generators: ein Aufrufer kann `break`en — dafür gibt es zwei eigene Tests.

**Schritte:**
1. Modul-lokale `runde: { generation, programme, roh: Map<string, Promise<…>>, nutzer } | null`.
2. Eintritt: passt `bestandGeneration()` zur laufenden Runde → mitfahren, sonst neue Runde.
   `nutzer += 1`.
3. Je Programm: `roh.get(id)` oder `roh.set(id, leser.roh(...))`. `gelesen` = ob dieser
   Aufrufer die Promise erzeugt hat.
4. `finally`: `nutzer -= 1`; bei 0 **und** wenn es noch die eigene Runde ist → `runde = null`.
5. Fehlerfall: Promise bleibt abgelehnt und erreicht jeden Mitfahrer; Runde verwerfen.
6. Doc-Kommentar in der Stimme des Repos: **warum kein Cache** (284 MB, Spec 2.5) und
   **warum die Generation der Schlüssel ist**.

**Verifikation:** `npm run check:quick`.

### - [x] T2 — Test, einmal rot gesehen

**Dateien:** `src/core/status/__tests__/roh-halter.test.ts` (neu)

**Schritte:** Zählender Fake-`RohLeser`. Vier Fälle aus Spec 3.5. Dann den Nutzerzähler
absichtlich sabotieren (`nutzer` nie erhöhen), sehen, dass „zwei Durchgänge = ein
Lesevorgang" **rot** wird, zurückbauen, grün.

**Verifikation:** `npx vitest run src/core/status/__tests__/roh-halter.test.ts`, danach
`npm run check:quick` (läuft die Datei im `fast`-Projekt mit? sonst `ISOLATED_TESTS`).

### - [x] T3 — `jederVorgang` auf den Halter heben

**Dateien:** `src/core/status/vorgangs-quelle.ts`

**Schritte:** Die `for (const p of await listProgramme(idb))`-Schleife samt `Promise.all`
durch `jedesProgrammRoh` ersetzen. `ioMs` aus dem Halter beziehen. **Alles ab
`baueVorkommenPlan` unverändert lassen** — Plan je Programm, `vbRecords`, Antrags-Schleife,
`takt`. Den Doc-Absatz „Ein `getAll` je Programm, bewusst nicht gechunkt" behalten und um
die Mitfahrt ergänzen.

**Verifikation:** `npm run check:quick` — die 11 anderen Aufrufer und ihre Tests müssen
ohne Änderung grün bleiben.

### - [x] T4 — `ladeBestand` gibt seinen Lesecode ab

**Dateien:** `src/plugins/status-cockpit/ladeBestand.ts`

**Schritte:** `listProgramme` + `Promise.all` durch `jedesProgrammRoh` ersetzen.
`schemas.push(...)`, `aufloesung`, `byVb`, `programmAntraege`, `antraegeOhneProgramm`,
`programmUneinheitlich` und die drei `baueVerbundFelder`-Schleifen **wortgleich** stehen
lassen. `tfPerfLog` um „gelesen/mitgefahren" ergänzen, damit die Messung in T6 die Mitfahrt
belegen kann.

**Verifikation:** `npm run check` (Phasen-Gate, inkl. `cycles` — der neue Import darf
keinen Zyklus über die Plugin-Grenze aufmachen).

### - [x] T5 — Barrel

**Dateien:** `src/core/status/index.ts` — `jedesProgrammRoh` + `ProgrammRoh` exportieren.

### - [x] T6 — Abnahme in `dev:local`

**Schritte:** `local-e` (Port 5179) → `await window.__tf.bereit()` → Regeln-Seite kalt.

**Ergebnis (10.09.2026, 14 225 Anträge / 7 535 Verbünde):**
- Zweiter Lauf meldet `1× mitgefahren` bei **identischem** `io` zum ersten
  (`io 4393ms, gelesen` + `io 4393ms, 1× mitgefahren`) — ein `getAll` statt zwei. ✅
- `7535 Verbünde, 3 Schemas` unverändert — die Wahrheitsprobe (Pitfall #44/#45). ✅
- `window.__tf.fehler()` = 0, Seite rendert vollständig. ✅
- **Gepaart gemessen** (Boden – 3 Läufe – Boden, je Stand): die Rechenzeit ist identisch
  (3 413 vs. 3 414 ms). Der `io`-Unterschied von 255 ms liegt in der Streuung der
  Maschine — deren Boden schwankte über die Sitzung um ±33 % (2 207 · 3 129 · 3 293 ms),
  teils innerhalb einer Minute. Ein Effekt dieser Größe ist hier nicht auflösbar.

### - [x] T7 — Docs, Version, Commit

**Schritte:** §17 fortschreiben **inklusive der Richtigstellung**, dass die dort notierten
„12–15 s" der Dev-StrictMode waren und die Seite produktiv kalt bei ~6,4 s liegt.
`npm run version:bump -- minor "…"`, Changelog-Skeleton füllen (3 Zeilen + max. 5 Bullets),
`npm run build:devpl` im Hintergrund starten und **den Exit-Code prüfen**, dann committen.
