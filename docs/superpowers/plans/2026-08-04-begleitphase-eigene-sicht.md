# Begleitphase als eigene Sicht — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHER SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe umzusetzen. Die Schritte tragen Checkboxen (`- [ ]`).

**Ziel:** Die Förderanträge-Seite trennt Antragsphase und Begleitphase in zwei Sichten, der Profil-Haken verliert seine versteckende Wirkung, und 15 Anträge, die heute in keiner Sicht stehen, kehren zurück.

**Architektur:** Rein additiv auf bestehenden Bausteinen. `views.ts` bekommt einen sechsten View; die Sichtbarkeits-Stufe `filterByBegleitungPhase` entfällt ersatzlos, weil die Sicht sie ersetzt. Der dritte Teil behebt zwei Stellen, an denen abgeleitete Daten eingefroren werden: die Wertemenge der Status-Pille (Modul-Konstante) und die Schreibweisen einer Katalog-Fassung (nie angereichert).

**Tech-Stack:** React 19 + TypeScript, Zustand, Vitest (Projekte `fast`/`isolated`), Vite. Keine neuen Abhängigkeiten.

**Grundlage:** [docs/superpowers/specs/2026-08-04-begleitphase-eigene-sicht-design.md](../specs/2026-08-04-begleitphase-eigene-sicht-design.md)

## Global Constraints

- **Pitfall #12** — `Antrag.status` nie gegen ein Literal vergleichen; nur Helfer aus `@/core/utils/status-canonical` (`isOpenStatus`, `isBegleitungStatus`, `getStatusCategory`). Erzwungen durch `no-direct-status-compare`.
- **Pitfall #43** — Bezeichnung und Schreibweisen der Statuscodes sind **Fremddaten** aus dem Code-Katalog; unsere Kuration (Ordner, Phase, Rang, Zieltage) lebt getrennt und überlebt jede Neugenerierung.
- **Pitfall #45** — Abgeleitetes wird **nicht** daneben persistiert. Der Snapshot rechnet neu, statt eine gespeicherte Fassung zu übernehmen.
- **Innerer Loop:** `npm run check:quick` nach jedem Teilschritt. **Phasen-Gate:** `npm run check` vor dem letzten Commit.
- **Windows-Shell:** keine Heredocs/Here-Strings. Commit-Messages über `git commit -F .git/COMMIT_MSG.tmp` (Message vorher mit dem Write-Tool schreiben). Mehrzeilige Datei-Inhalte nie per `echo`/`cat` bauen.
- **Parallele Session:** vor jedem `git add` mit `git status --short` prüfen, wem eine Datei gehört. Nur eigene Dateien stagen, nie `git add -A`.
- **Testprojekte:** Schlägt ein neuer Test nur im Suite-Lauf fehl, einzeln aber grün (`npx vitest run <pfad>`), gehört die **Datei** alphabetisch in `ISOLATED_TESTS` (`vitest.config.mts`) — nie den Test verbiegen.

---

## Dateien im Überblick

| Datei | Rolle nach der Änderung |
|---|---|
| `src/plugins/antraege/views.ts` | Sechs Sichten; `meine_offenen` = Antragsphase (ohne Begleitung), neu `begleitung`. Kennt den Profil-Haken nicht mehr. |
| `src/plugins/antraege/sort.ts` | Sortier- und Gruppierungs-Default für die neue Sicht. |
| `src/plugins/antraege/bearbeiterFilter.ts` | Nur noch Kürzel-Zuschnitt; `filterByBegleitungPhase` entfällt. |
| `src/plugins/antraege/useFilteredAntraege.ts` | Eine Filterstufe weniger. |
| `src/plugins/home/dashboardAggregate.ts` | Begleitung wird nicht mehr ausgeblendet. |
| `src/plugins/einstellungen/ProfilTab.tsx` | Haken-Text beschreibt nur noch den Kürzel-Zuschnitt. |
| `src/plugins/antraege/filter/statusQuickChips.ts` | Wertemenge wird abgeleitet statt eingefroren. |
| `src/plugins/antraege/filter/phaseQuickfilter.ts` | Hebt die Wertemengen aus der Datensatz-Schleife. |
| `src/core/status/snapshot.ts` | Ergänzt die amtlichen Schreibweisen, bevor er indiziert. |

---

## Task 1: Der Profil-Haken verliert seine Sichtbarkeits-Wirkung

Zuerst, damit die Zahlen ehrlich sind, bevor Task 2 ihnen ein Zuhause gibt.

**Files:**
- Modify: `src/plugins/antraege/bearbeiterFilter.ts` (Modulkopf, `filterByBegleitungPhase` entfernen)
- Modify: `src/plugins/antraege/useFilteredAntraege.ts:16` und `:138-148`
- Modify: `src/plugins/antraege/views.ts:95-125` und `:127-178`
- Modify: `src/plugins/home/dashboardAggregate.ts:248-252`
- Modify: `src/plugins/einstellungen/ProfilTab.tsx:95-98`
- Test: `src/plugins/antraege/__tests__/views.test.ts`, `src/plugins/antraege/__tests__/bearbeiterFilter.test.ts`

**Interfaces:**
- Consumes: nichts aus früheren Tasks.
- Produces: `BearbeiterFilterMode.includeBegleitung` bleibt bestehen und steuert **nur noch** die Spaltenauswahl in `spaltenFuer`. `filterByBegleitungPhase` existiert nicht mehr — spätere Tasks dürfen sie nicht referenzieren. `viewCount(key, antraege, bearbeiter?, applyVbPhasePreFilter?)` und `viewCounts(antraege, bearbeiter?, applyVbPhasePreFilter?)` behalten ihre Signaturen.

- [ ] **Schritt 1: Den Test schreiben, der die alte Wirkung ausschließt**

In `src/plugins/antraege/__tests__/views.test.ts` den kompletten Block `describe('viewCount — Begleitphasen-Filter (Tab-Counts konsistent zur Liste)', …)` (Zeilen 71–90) durch diesen ersetzen:

```ts
describe('viewCount — der Profil-Haken blendet nichts mehr aus', () => {
  // „vn geprüft" → Kategorie begleitung. isOpenStatus schließt Begleitung ein;
  // die Sichtbarkeit hängt seit v2.402 an der Sicht, nicht am Profil-Haken.
  const data = [
    { aktenzeichen: 'BEGLEIT-1', programm_id: 'P', status: 'vn geprüft', _updated_at: '2026-01-01T00:00:00Z' },
    { aktenzeichen: 'OFFEN-1', programm_id: 'P', status: 'techn geprüft', _updated_at: '2026-01-01T00:00:00Z' },
  ] as never;

  it('includeBegleitung=false zählt Begleitung genauso mit wie true', () => {
    const aus = parseBearbeiterFilter('alle', false);
    const an = parseBearbeiterFilter('alle', true);
    expect(viewCount('meine_offenen', data, aus, true)).toBe(2);
    expect(viewCount('meine_offenen', data, an, true)).toBe(2);
  });

  it('ohne bearbeiter-Mode identisch', () => {
    expect(viewCount('meine_offenen', data, undefined, true)).toBe(2);
  });
});
```

In `src/plugins/antraege/__tests__/bearbeiterFilter.test.ts` alle `describe`/`it`-Blöcke streichen, die `filterByBegleitungPhase` aufrufen, samt dem Import. Die Tests zum Kürzel-Matching (`matches Begleitung-Spalten when includeBegleitung is true`, `does NOT match Begleitung lowercase when includeBegleitung=false`) **bleiben** — sie prüfen `spaltenFuer`, nicht die Sichtbarkeit.

- [ ] **Schritt 2: Testlauf, der fehlschlagen muss**

Run: `npx vitest run src/plugins/antraege/__tests__/views.test.ts`
Expected: FAIL — `includeBegleitung=false zählt Begleitung genauso mit wie true` meldet `expected 1 to be 2`.

- [ ] **Schritt 3: Die Sichtbarkeits-Stufe entfernen**

In `src/plugins/antraege/views.ts`: in `viewCount` (bei Zeile 119) und in `viewCounts` (bei Zeile 157) je die Zeile

```ts
    if (!includeBegleitung && isBegleitungStatus(a.status)) continue;
```

löschen, ebenso die beiden vorangehenden `const includeBegleitung = bearbeiter?.includeBegleitung ?? true;`. Die Zeilen `if (isBegleitungStatus(a.status)) return false;` in den Sichten `diese_woche_faellig`/`ueberfaellig` (Zeilen 60 und 72) und `if (open && !isBegleitungStatus(a.status))` in `viewCounts` (Zeile 165) **bleiben unverändert** — das ist Lebenszyklus, kein Schalter.

Die JSDoc-Absätze zum Profil-Toggle über `viewCount` (Zeilen 103–106) und in `viewCounts` (Zeilen 136–139) ersetzen durch:

```ts
 * Die Begleitphase wird NICHT mehr ausgeblendet: sie hat seit v2.402 eine eigene
 * Sicht. Der Profil-Haken `bearbeiter_inkl_begleitung` steuert nur noch, ob
 * ZTP-/PFM-Spalten beim Kürzel-Zuschnitt mitzählen (`spaltenFuer`).
```

In `src/plugins/antraege/bearbeiterFilter.ts` die Funktion `filterByBegleitungPhase` (Zeilen 193–207) und den Import `isBegleitungStatus` (Zeile 3) löschen. Den Doppelwirkungs-Absatz im Modulkopf (Zeilen 24–31) ersetzen durch:

```
 * `bearbeiter_inkl_begleitung` (Profil-Toggle): schneidet die Spaltenauswahl zu.
 * - true:  zusätzlich ZTP_KUERZ / PFM_KUERZ matchen.
 * - false: nur TIB_KUERZ / BIB_KUERZ.
 *
 * Er blendet NICHTS aus. Bis v2.401 tat er beides — und versteckte damit die
 * Begleitphase app-weit, weil er ab Werk aus steht. Sichtbarkeit macht seit
 * v2.402 die Sicht (`views.ts`).
```

Den Hinweis auf die Aufruf-Reihenfolge in `applyBearbeiterFilter` (Zeilen 211–213) auf `isIrrlaeufer → applyBearbeiterFilter` kürzen.

In `src/plugins/antraege/useFilteredAntraege.ts`: `filterByBegleitungPhase` aus dem Import (Zeile 16) entfernen, die Zeilen 138–140 löschen und Zeile 148 von `byPhase` auf `byPreFilter` umstellen:

```ts
    const byBearbeiter = skipBearbeiter ? byPreFilter : applyBearbeiterFilter(byPreFilter, bearbeiterFilter);
```

In `src/plugins/home/dashboardAggregate.ts` die Zeilen 248–252 (Kommentar + `if (isBegleitungStatus(a.status) && !bearbeiterMode.includeBegleitung) continue;`) löschen. Wird `isBegleitungStatus` dadurch im Modul unbenutzt, den Import (Zeile 21) mit entfernen — `npm run check:quick` meldet es.

- [ ] **Schritt 4: Die Home-Zähler nachziehen**

`dashboardCounts.test.ts` prüft den Haken explizit; nach der Änderung liefern `NEUTRAL` und `parseBearbeiterFilter(undefined, true)` überall dasselbe. Die Fixture führt 3× „VN geprüft", davon ist REAL-014 Irrläufer und fällt ohnehin weg — sichtbar bleiben REAL-002 und REAL-017.

In `src/plugins/antraege/__tests__/dashboardCounts.test.ts`:

- Zeile 10–16: Titel auf `'total zaehlt Begleitung mit'`, Kommentar auf `// 18 = 20 minus 2 Irrlaeufer. Begleit-Stati zaehlen seit v2.402 mit.`, Erwartung `16` → **`18`**.
- Zeile 29–36: den Kommentar über dem Test löschen, Titel auf `'offen zaehlt Begleitung mit'`, Erwartung `9` → **`11`**.
- Zeile 46–51: Titel auf `'begleitung = 2 unabhaengig vom Profil-Haken'`, Erwartung `0` → **`2`**.
- Zeile 52–65: die beiden „mit Toggle aktiv"-Tests zu einem zusammenziehen, der die Gleichheit festhält:

```ts
  it('der Profil-Haken aendert an den Zahlen nichts mehr', () => {
    const opts = { includeAntraege: true, nowMs: TEST_TODAY_MS } as const;
    const ohne = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, opts);
    const mit = computeDashboardAggregate(
      REAL_CSV_ANTRAEGE, parseBearbeiterFilter(undefined, true), opts,
    );
    expect(mit.stats).toEqual(ohne.stats);
    expect(ohne.stats.begleitung).toBe(2);
    expect(ohne.stats.offen).toBe(11);
  });
```

- `inPruefung = 2` (Zeile 40–45), `nachforderung = 2` und `bewilligt = 4` bleiben unverändert: „VN geprüft" hängt an `begleitung`, nicht an `in_pruefung`.

Run: `npx vitest run src/plugins/antraege/__tests__/views.test.ts src/plugins/antraege/__tests__/bearbeiterFilter.test.ts src/plugins/antraege/__tests__/dashboardCounts.test.ts`
Expected: PASS. Weicht eine Zahl von den obigen ab, ist das ein Befund — nicht die Erwartung nachziehen, sondern die Abweichung klären.

- [ ] **Schritt 5: Den Haken-Text ehrlich machen**

In `src/plugins/einstellungen/ProfilTab.tsx` den `hint` (Zeile 97) ersetzen:

```tsx
              hint="Zählt Anträge, auf denen Ihr Kürzel in der Begleitung steht (ZTP_KUERZ, PFM_KUERZ), zu Ihren eigenen. Sichtbar ist die Begleitphase unabhängig davon — sie hat einen eigenen Reiter. Frist für VN-Anträge: D_VBE + 6 Monate."
```

- [ ] **Schritt 6: Gate + Commit**

Run: `npm run check:quick`

```bash
git add src/plugins/antraege/views.ts src/plugins/antraege/bearbeiterFilter.ts src/plugins/antraege/useFilteredAntraege.ts src/plugins/home/dashboardAggregate.ts src/plugins/einstellungen/ProfilTab.tsx src/plugins/antraege/__tests__/views.test.ts src/plugins/antraege/__tests__/bearbeiterFilter.test.ts src/plugins/antraege/__tests__/dashboardCounts.test.ts
```

Commit-Message per Write-Tool nach `.git/COMMIT_MSG.tmp`, dann `git commit -F .git/COMMIT_MSG.tmp`. Betreff: `refactor(antraege): Profil-Haken blendet die Begleitphase nicht mehr aus`.

---

## Task 2: Antragsphase und Begleitung als zwei Sichten

**Files:**
- Modify: `src/plugins/antraege/views.ts:11-16` (ViewKey), `:45-87` (VIEWS), `:141-178` (viewCounts)
- Modify: `src/plugins/antraege/sort.ts:126-135`, `:183-189`
- Test: `src/plugins/antraege/__tests__/views.test.ts`

**Interfaces:**
- Consumes: aus Task 1 die von `includeBegleitung` befreiten `viewCount`/`viewCounts`.
- Produces: `type ViewKey` enthält `'begleitung'`; `VIEWS` hat sechs Einträge; `viewCounts` liefert `Record<ViewKey, number>` inklusive `begleitung`. `loadActiveView` in `store.ts` validiert gegen `VIEWS` und braucht **keine** Änderung; `sortByView`/`viewModeByTab` sind `Partial<Record<…>>` und brauchen keine Migration.

- [ ] **Schritt 1: Den Test schreiben**

In `src/plugins/antraege/__tests__/views.test.ts` die `EXPECTED`-Tabelle (Zeilen 15–25) ersetzen:

```ts
/** Erwartete Counts pro View gegen die CSV-Rohwert-Fixture.
 *  Die Fixture führt 3× „VN geprüft" (Kategorie begleitung); eine davon
 *  (REAL-014) ist zugleich Irrläufer (vb_phase=9). Antragsphase = offen ohne
 *  Begleitung: 11 − 2 = 9 bzw. 13 − 3 = 10. */
const EXPECTED: Record<ViewKey, { withPreFilter: number; withoutPreFilter: number }> = {
  meine_offenen: { withPreFilter: 9, withoutPreFilter: 10 },
  begleitung: { withPreFilter: 2, withoutPreFilter: 3 },
  // SLA-basiert: diese_woche_faellig = #(offen ∧ daysSinceEingang ∈ [84, 90]),
  // ueberfaellig = #(offen ∧ daysSinceEingang > 90). Fixture: REAL-006
  // ist 87d (SLA-Risk diese Woche), REAL-004 ist 131d (ueberfaellig).
  diese_woche_faellig: { withPreFilter: 1, withoutPreFilter: 1 },
  ueberfaellig: { withPreFilter: 1, withoutPreFilter: 1 },
  bewilligt_jahr: { withPreFilter: 3, withoutPreFilter: 3 },
  alle: { withPreFilter: 18, withoutPreFilter: 20 },
};
```

Und am Ende der Datei anhängen:

```ts
describe('Antragsphase und Begleitung teilen isOpenStatus auf', () => {
  const antragsphase = getView('meine_offenen');
  const begleitung = getView('begleitung');

  it('sind disjunkt', () => {
    const doppelt = REAL_CSV_ANTRAEGE.filter(
      a => antragsphase.predicate(a) && begleitung.predicate(a),
    );
    expect(doppelt).toEqual([]);
  });

  it('ergeben zusammen genau isOpenStatus', () => {
    const zusammen = REAL_CSV_ANTRAEGE.filter(
      a => antragsphase.predicate(a) || begleitung.predicate(a),
    ).length;
    const offen = REAL_CSV_ANTRAEGE.filter(a => isOpenStatus(a.status)).length;
    expect(zusammen).toBe(offen);
  });

  it('viewCounts stimmt je Sicht mit viewCount überein', () => {
    const counts = viewCounts([...REAL_CSV_ANTRAEGE], undefined, true);
    for (const key of Object.keys(EXPECTED) as ViewKey[]) {
      expect(counts[key]).toBe(viewCount(key, [...REAL_CSV_ANTRAEGE], undefined, true));
    }
  });
});
```

Die Import-Zeile 2 auf `import { getView, viewCount, viewCounts, type ViewKey } from '../views';` erweitern und `import { isOpenStatus } from '@/core/utils/status-canonical';` ergänzen.

- [ ] **Schritt 2: Testlauf, der fehlschlagen muss**

Run: `npx vitest run src/plugins/antraege/__tests__/views.test.ts`
Expected: FAIL — TypeScript meldet `begleitung` als unbekannten Schlüssel in `Record<ViewKey, …>`, und `getView('begleitung')` fällt auf `alle` zurück.

- [ ] **Schritt 3: Die zweite Sicht anlegen**

In `src/plugins/antraege/views.ts` den `ViewKey` erweitern:

```ts
export type ViewKey =
  | 'meine_offenen'
  | 'begleitung'
  | 'diese_woche_faellig'
  | 'ueberfaellig'
  | 'bewilligt_jahr'
  | 'alle';
```

Den ersten `VIEWS`-Eintrag ersetzen und den neuen dahinter setzen:

```ts
  {
    // Der Schlüssel bleibt `meine_offenen`: daran hängen die persistierte
    // Sicht, die Sortier-Vorlieben und die Sprünge von der Startseite.
    // Antragsphase = Eingang bis Bewilligung (ca. 3–9 Monate, TIB/BIB).
    key: 'meine_offenen',
    label: 'Antragsphase',
    predicate: a => isOpenStatus(a.status) && !isBegleitungStatus(a.status),
  },
  {
    // Begleitphase = nach der Bewilligung, während der Antragsteller umsetzt
    // (3–4 Jahre, ZTP/PFM). Eigene Uhr: `computeFristDatum` rechnet hier ab
    // vn_eingang_datum + 6 Monate statt antragsdatum + 90 Tage. Beide Uhren in
    // einer Zahl zu addieren ergibt kein Arbeitssignal.
    key: 'begleitung',
    label: 'Begleitung',
    predicate: a => isBegleitungStatus(a.status),
  },
```

In `viewCounts` das Zähler-Objekt um `begleitung: 0,` ergänzen (nach `meine_offenen: 0,`) und die Zählschleife so umbauen, dass `isBegleitungStatus` einmal je Datensatz läuft:

```ts
    counts.alle++;

    const open = isOpenStatus(a.status);
    const begl = isBegleitungStatus(a.status);
    if (open && !begl) counts.meine_offenen++;
    if (begl) counts.begleitung++;

    if (open && !begl) {
      const d = daysSinceEingang(a);
      if (d !== null) {
        if (d >= 84 && d <= 90) counts.diese_woche_faellig++;
        if (d > 90) counts.ueberfaellig++;
      }
    }
```

- [ ] **Schritt 4: Die Defaults nachziehen**

In `src/plugins/antraege/sort.ts` beide Records um die neue Sicht ergänzen — `Record<ViewKey, …>` ist total, der Typecheck verlangt es:

```ts
export const DEFAULT_SORT_BY_VIEW: Record<ViewKey, SortKey> = {
  meine_offenen: 'frist_asc',
  // `frist_asc` ist hier richtig, obwohl die Begleitung eine andere Uhr hat:
  // `computeFristDatum` schreibt in `frist_datum` bereits die VN-Frist
  // (vn_eingang_datum + 6 Monate). Die Sortierung liest das fertige Feld.
  begleitung: 'frist_asc',
  diese_woche_faellig: 'frist_asc',
  ueberfaellig: 'frist_asc',
  bewilligt_jahr: 'bewilligung_desc',
  alle: 'eingang_desc',
};
```

Den vorhandenen Wert für `alle` **nicht** ändern — er steht dort mit eigener Begründung; nur die Zeile `begleitung` einfügen. Ebenso in `DEFAULT_GROUPING_BY_VIEW`:

```ts
  begleitung: 'none',
```

`BEWILLIGUNG_VIEWS` bleibt unverändert: Bewilligungsdatum-Sort ergibt in der Begleitung keinen Sinn.

- [ ] **Schritt 5: Testlauf, der grün sein muss**

Run: `npx vitest run src/plugins/antraege/__tests__/views.test.ts src/plugins/antraege/__tests__/sortDefaults.test.ts src/plugins/antraege/filter/__tests__/quickfilterExpanded.test.ts`
Expected: PASS.

- [ ] **Schritt 6: Gate + Commit**

Run: `npm run check:quick`

```bash
git add src/plugins/antraege/views.ts src/plugins/antraege/sort.ts src/plugins/antraege/__tests__/views.test.ts
```

Betreff: `feat(antraege): Antragsphase und Begleitung als eigene Sichten`

---

## Task 3: Die Status-Pille liest den aktiven Katalog

**Files:**
- Modify: `src/plugins/antraege/filter/statusQuickChips.ts:43-60`
- Modify: `src/plugins/antraege/filter/phaseQuickfilter.ts:109-136`
- Test: `src/plugins/antraege/filter/__tests__/statusQuickChips.test.ts`
- Test: `src/plugins/antraege/filter/__tests__/phaseQuickfilter.test.ts`
- Test: `src/plugins/antraege/__tests__/statusCanonical.test.ts`
- Modify: `vitest.config.mts` (`ISOLATED_TESTS`)

**Interfaces:**
- Consumes: nichts aus Task 1/2.
- Produces: `chipStatusValues(chipId: StatusQuickChipId): ReadonlySet<string>` behält die Signatur, leitet aber bei **jedem** Aufruf aus `getStatusValuesByCategory` ab. Aufrufer in Schleifen müssen das Ergebnis vorher herausheben.

- [ ] **Schritt 1: Den Test schreiben**

An `src/plugins/antraege/filter/__tests__/statusQuickChips.test.ts` anhängen:

```ts
import { setStatusKatalogSnapshotMap, type StatusCategory } from '@/core/utils/status-canonical';

describe('chipStatusValues folgt dem aktiven Katalog', () => {
  afterEach(() => { setStatusKatalogSnapshotMap(null); });

  it('nimmt eine Schreibweise auf, die erst der Snapshot kennt', () => {
    expect(chipStatusValues('offen').has('sonderfall xy')).toBe(false);
    setStatusKatalogSnapshotMap(new Map<string, StatusCategory>([
      ['sonderfall xy', 'entscheidung'],
    ]));
    expect(chipStatusValues('offen').has('sonderfall xy')).toBe(true);
  });

  it('verliert eine Schreibweise, die der Snapshot nicht führt', () => {
    setStatusKatalogSnapshotMap(new Map<string, StatusCategory>([
      ['beantragt', 'offen'],
    ]));
    expect(chipStatusValues('offen').has('bearbeitungsreif')).toBe(false);
  });
});
```

Den Import von `afterEach` in der bestehenden `vitest`-Import-Zeile ergänzen.

- [ ] **Schritt 2: Testlauf, der fehlschlagen muss**

Run: `npx vitest run src/plugins/antraege/filter/__tests__/statusQuickChips.test.ts`
Expected: FAIL — beide neuen Tests, weil `CHIP_VALUES` beim Modul-Laden eingefroren wurde.

- [ ] **Schritt 3: Die Modul-Konstante entfernen**

In `src/plugins/antraege/filter/statusQuickChips.ts` den `CHIP_VALUES`-IIFE-Block (Zeilen 43–55) samt Kommentar löschen und `chipStatusValues` ersetzen:

```ts
/**
 * Die Status-Werte eines Chips — abgeleitet bei jedem Aufruf, nicht gecacht.
 *
 * Die Menge hing bis v2.401 an einer Modul-Konstante, die beim Import lief —
 * also BEVOR `setStatusKatalogSnapshot` den kuratierten Katalog setzt. Die
 * Pille rechnete deshalb dauerhaft mit dem eingebauten Code-Seed, der Rest der
 * App mit dem Katalog; im echten Bestand gingen die beiden um 15 Anträge
 * auseinander. Wer das Ergebnis in einer Schleife braucht, hebt es heraus
 * (siehe `getPhaseItems`).
 */
export function chipStatusValues(chipId: StatusQuickChipId): ReadonlySet<string> {
  const werte = new Set<string>();
  const chip = STATUS_QUICK_CHIPS.find(c => c.id === chipId);
  if (!chip) return werte;
  for (const cat of chip.categories) {
    for (const v of getStatusValuesByCategory(cat)) werte.add(v);
  }
  return werte;
}
```

- [ ] **Schritt 4: Den heißen Pfad entlasten**

In `src/plugins/antraege/filter/phaseQuickfilter.ts` `getPhaseItems` so umbauen, dass die Mengen einmal vor der Schleife entstehen (bisher stand der Aufruf **in** der Schleife — bei 14k Datensätzen × 5 Chips):

```ts
export function getPhaseItems(antraege: AntragListItem[]): CollapsibleSegItem[] {
  const counts: Record<PhaseLabel, number> = {
    'Alle': antraege.length,
    'Offen': 0,
    'NF': 0,
    'Bewilligt': 0,
    'Begleitung': 0,
    'Abgeschl.': 0,
  };
  // Einmal vor der Schleife: `chipStatusValues` leitet seit dem Wegfall der
  // Modul-Konstante bei jedem Aufruf aus dem aktiven Katalog ab.
  const buckets = STATUS_QUICK_CHIPS.map(chip => ({
    label: PHASE_LABEL_BY_CHIP_ID[chip.id],
    werte: chipStatusValues(chip.id),
  }));
  for (const a of antraege) {
    const s = typeof a.status === 'string' ? a.status.toLowerCase().trim() : '';
    if (!s) continue;
    for (const b of buckets) {
      if (b.werte.has(s)) {
        counts[b.label]++;
        break;
      }
    }
  }
  return [
    { label: 'Alle', count: counts['Alle'] },
    { label: 'Offen', count: counts['Offen'] },
    { label: 'NF', count: counts['NF'] },
    { label: 'Bewilligt', count: counts['Bewilligt'] },
    { label: 'Begleitung', count: counts['Begleitung'] },
    { label: 'Abgeschl.', count: counts['Abgeschl.'] },
  ];
}
```

- [ ] **Schritt 5: Die zwei Wachen aus dem Entwurf setzen**

Erstens der Rundlauf zwischen den beiden Leserichtungen derselben Kategorien-Map — er hält fest, dass Zähler und Klassifikation nie wieder auseinanderlaufen können. An `src/plugins/antraege/__tests__/statusCanonical.test.ts` anhängen:

```ts
describe('getStatusValuesByCategory und getStatusCategory sind Umkehrungen', () => {
  const KATEGORIEN: StatusCategory[] = [
    'offen', 'in_pruefung', 'nachforderung', 'entscheidung',
    'bewilligt', 'begleitung', 'abgelehnt', 'abgeschlossen', 'sonstige',
  ];

  afterEach(() => { setStatusKatalogSnapshotMap(null); });

  function pruefeRundlauf(): void {
    for (const kat of KATEGORIEN) {
      for (const wert of getStatusValuesByCategory(kat)) {
        expect(getStatusCategory(wert), `Wert "${wert}" aus Kategorie ${kat}`).toBe(kat);
      }
    }
  }

  it('gilt ohne Snapshot (eingebaute Map)', () => {
    pruefeRundlauf();
  });

  it('gilt mit Snapshot', () => {
    setStatusKatalogSnapshotMap(new Map<string, StatusCategory>([
      ['beantragt', 'offen'],
      ['sonderfall xy', 'entscheidung'],
      ['vn geprüft', 'begleitung'],
    ]));
    pruefeRundlauf();
  });
});
```

Zweitens die Invariante der Pille unter einem abweichenden Katalog — bisher prüft `phaseQuickfilter.test.ts` sie nur gegen die eingebaute Map. An die Datei anhängen:

```ts
describe('Zähler = Filter gilt auch mit gesetztem Katalog-Snapshot', () => {
  afterEach(() => { setStatusKatalogSnapshotMap(null); });

  it('eine Schreibweise, die nur der Snapshot kennt, wird gezählt UND gefiltert', () => {
    const daten = [
      { aktenzeichen: 'A', programm_id: 'P', status: 'Sonderfall XY', _updated_at: '2026-01-01T00:00:00Z' },
    ] as never as AntragListItem[];
    setStatusKatalogSnapshotMap(new Map<string, StatusCategory>([
      ['sonderfall xy', 'entscheidung'],
    ]));
    const gezaehlt = getPhaseItems(daten).find(i => i.label === 'Offen')?.count ?? 0;
    expect(gezaehlt).toBe(1);

    let geschrieben: string[] = [];
    applyPhase('Offen', (_id, v) => { geschrieben = v; }, () => {});
    expect(geschrieben).toContain('sonderfall xy');
  });
});
```

Die nötigen Importe (`afterEach`, `setStatusKatalogSnapshotMap`, `StatusCategory`, `getStatusValuesByCategory`, `getStatusCategory`) in den jeweiligen Dateien ergänzen.

- [ ] **Schritt 6: Testlauf + Isolation**

Run: `npx vitest run src/plugins/antraege/filter/__tests__/statusQuickChips.test.ts src/plugins/antraege/filter/__tests__/phaseQuickfilter.test.ts src/plugins/antraege/__tests__/statusCanonical.test.ts`
Expected: PASS.

Dann die volle Suite: `npx vitest run`. Alle drei Dateien setzen eine **modul-globale** Snapshot-Map; schlägt eine davon nur im Suite-Lauf fehl, einzeln aber grün, gehört sie alphabetisch in `ISOLATED_TESTS` in `vitest.config.mts`. Dasselbe gilt für `schreibweisen-fremddaten.test.ts` aus Task 4. Nie das `afterEach`-Zurücksetzen weglassen — ein hängengebliebener Snapshot verfälscht jede spätere Datei im selben Worker.

- [ ] **Schritt 7: Gate + Commit**

Run: `npm run check:quick`

```bash
git add src/plugins/antraege/filter/statusQuickChips.ts src/plugins/antraege/filter/phaseQuickfilter.ts src/plugins/antraege/filter/__tests__/statusQuickChips.test.ts src/plugins/antraege/filter/__tests__/phaseQuickfilter.test.ts src/plugins/antraege/__tests__/statusCanonical.test.ts vitest.config.mts
```

Betreff: `fix(antraege): Status-Pille liest den kuratierten Katalog statt des Seeds`

---

## Task 4: Schreibweisen sind Fremddaten, nicht Kuration

**Files:**
- Modify: `src/core/status/snapshot.ts:33-44`
- Test: `src/core/status/__tests__/schreibweisen-fremddaten.test.ts` (neu)

**Interfaces:**
- Consumes: nichts aus Task 1–3.
- Produces: `setStatusKatalogSnapshot(version: MappingVersion | null): void` behält die Signatur; die gebaute Laufzeit-Map kennt zusätzlich die amtlichen Schreibweisen jedes Eintrags mit `code`. Die persistierte Fassung wird **nicht** verändert (Pitfall #45).

**Warum hier und nicht in `reichereWerteAn`:** `reichereWerteAn` steigt bei `if (w.code !== undefined) return w;` aus ([status-codes.ts:174](../../../src/core/status/status-codes.ts)) und läuft ohnehin nur beim Seed-Bau ([seed.ts:72](../../../src/core/status/seed.ts)). Eine vom Share geladene Fassung erreicht sie nie. Der Snapshot-Bau ist die Stelle, an der jede Fassung vorbeikommt.

- [ ] **Schritt 1: Den Test schreiben**

Neue Datei `src/core/status/__tests__/schreibweisen-fremddaten.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { setStatusKatalogSnapshot } from '../snapshot';
import { getStatusCategory } from '@/core/utils/status-canonical';
import type { MappingVersion, StatusWertEintrag } from '../typen';

/** Eine Fassung, die Code 72 nur unter der ABKÜRZUNG führt — genau der Stand,
 *  den der Daten-Share am 2026-08-04 als Fassung 12 auslieferte. Im Bestand
 *  steht dort 15× die Langform und 0× die Abkürzung. */
const KURZFORM: StatusWertEintrag = {
  id: 'status::stellungnahme zur rücknahmeempf.',
  feldId: 'status',
  wert: 'stellungnahme zur rücknahmeempf.',
  varianten: ['Stellungnahme zur Rücknahmeempf.'],
  kategorie: 'entscheidung',
  code: 72,
  zahPhaseId: 'entscheidung',
  prominenz: 'normal',
  aktiv: true,
  unkuratiert: false,
};
```

> `rang`, `terminal` und `spinePhase` **nicht** ergänzen: die im Daten-Share liegende Fassung führt sie noch, der Typ `StatusWertEintrag` kennt sie seit dem P6-Rückbau (v2.385) nicht mehr. Ein Objekt-Literal mit diesen Feldern ist ein Typfehler.

```ts

function fassung(werte: StatusWertEintrag[]): MappingVersion {
  return {
    version: 1,
    autor: 'test',
    zeitstempel: '2026-08-04T00:00:00.000Z',
    kommentar: '',
    felder: [{
      feldId: 'status', label: 'TV-Status', typ: 'wert', ebene: 'tv',
      prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
    }],
    werte,
    regeln: [],
  };
}

afterEach(() => { setStatusKatalogSnapshot(null); });

describe('Schreibweisen eines codierten Werts kommen aus dem Code-Katalog', () => {
  it('die amtliche Langform löst auf, auch wenn die Fassung sie nicht führt', () => {
    setStatusKatalogSnapshot(fassung([KURZFORM]));
    expect(getStatusCategory('Stellungnahme zur Rücknahmeempfehlung')).toBe('entscheidung');
  });

  it('die kuratierte Schreibweise löst weiterhin auf', () => {
    setStatusKatalogSnapshot(fassung([KURZFORM]));
    expect(getStatusCategory('stellungnahme zur rücknahmeempf.')).toBe('entscheidung');
  });

  it('die Kuration der Fassung gewinnt gegen den Seed', () => {
    // Der Seed hängt Code 72 an `entscheidung`. Hängt die PL ihn um, gilt ihre
    // Fassung — ergänzt werden NUR Schreibweisen, nie Kategorien.
    setStatusKatalogSnapshot(fassung([{ ...KURZFORM, zahPhaseId: 'abgeschlossen' }]));
    expect(getStatusCategory('Stellungnahme zur Rücknahmeempfehlung')).toBe('abgeschlossen');
  });
});
```

- [ ] **Schritt 2: Testlauf, der fehlschlagen muss**

Run: `npx vitest run src/core/status/__tests__/schreibweisen-fremddaten.test.ts`
Expected: FAIL — erster Test meldet `expected 'sonstige' to be 'entscheidung'`.

- [ ] **Schritt 3: Den Snapshot die Schreibweisen ergänzen lassen**

In `src/core/status/snapshot.ts` `setStatusKatalogSnapshot` umbauen:

```ts
export function setStatusKatalogSnapshot(version: MappingVersion | null): void {
  aktiveVersion = version;
  if (!version) {
    setStatusKatalogSnapshotMap(null);
    return;
  }
  const kuratiert = version.werte.filter(w => !w.unkuratiert);
  const idx = indexNachSchreibweise(kuratiert.map(mitAmtlichenSchreibweisen));
  const m = new Map<string, StatusCategory>();
  for (const [key, w] of idx) m.set(key, kategorieAusFassung(w));
  setStatusKatalogSnapshotMap(m);
}

/**
 * Ergänzt die Schreibweisen eines Eintrags um die amtlichen aus dem
 * Code-Katalog. **Nur Schreibweisen** — Kategorie, Phase, Rang und Zieltage
 * bleiben, wie die PL sie kuratiert hat (Pitfall #43: Bezeichnungen sind
 * Fremddaten, unsere Kuration lebt daneben).
 *
 * Ohne diesen Schritt friert eine Fassung, die eine Schreibweise nicht führt,
 * sie dauerhaft aus: Fassung 12 kannte Code 72 nur als „stellungnahme zur
 * rücknahmeempf.", im Bestand stand 15× die Langform — die fielen auf
 * `sonstige` und standen damit in keiner Sicht. `reichereWerteAn` half nicht:
 * sie steigt bei gesetztem Code sofort aus und läuft nur beim Seed-Bau.
 *
 * Rein: das Ergebnis wird NICHT zurückgeschrieben (Pitfall #45).
 */
function mitAmtlichenSchreibweisen(w: StatusWertEintrag): StatusWertEintrag {
  if (w.code === undefined) return w;
  const amtlich = statusCodeEintrag(w.code);
  if (!amtlich) return w;
  const gesehen = new Set<string>([normalisiereWert(w.wert)]);
  const varianten: string[] = [];
  for (const s of [...(w.varianten ?? []), amtlich.text, ...amtlich.varianten]) {
    const k = normalisiereWert(s);
    if (!k || gesehen.has(k)) continue;
    gesehen.add(k);
    varianten.push(s);
  }
  return { ...w, varianten };
}
```

> **Nicht** über `varianten.length === (w.varianten ?? []).length` abkürzen und `w` unverändert zurückgeben: die gepflegte Variante kann dieselbe Normalform wie `wert` haben (Fassung 12 führt zu Code 72 genau das — `wert` „stellungnahme zur rücknahmeempf." und Variante „Stellungnahme zur Rücknahmeempf."). Sie fällt dann aus der Liste, und wenn der Code-Katalog genau eine Schreibweise beisteuert, sind beide Längen 1 — die Anreicherung ginge still verloren. Die Funktion läuft einmal je Snapshot über ~74 Einträge; das Objekt immer neu zu bauen kostet nichts.

Die Importe am Kopf ergänzen: `statusCodeEintrag` aus `./status-codes`, `normalisiereWert` und `StatusWertEintrag` aus `./typen` (sofern noch nicht vorhanden).

Prüfen, dass daraus **kein** Laufzeit-Zyklus entsteht: `npm run cycles` läuft in Schritt 5 mit. `snapshot.ts` importiert bereits aus `./wert-index` und `./typen`; `status-codes.ts` ist ein Blatt.

Den Modulkopf-Absatz zu den Varianten (Zeilen 16–19) um einen Satz ergänzen:

```
 * Zusätzlich kommen die **amtlichen** Schreibweisen aus dem Code-Katalog dazu
 * (`mitAmtlichenSchreibweisen`) — eine Fassung, die eine davon nicht führt,
 * darf sie nicht aus der Auflösung nehmen.
```

- [ ] **Schritt 4: Testlauf, der grün sein muss**

Run: `npx vitest run src/core/status/__tests__/schreibweisen-fremddaten.test.ts src/core/status/__tests__/byte-identitaet.test.ts src/core/status/__tests__/kategorie-projektion.test.ts`
Expected: PASS. `byte-identitaet` muss unverändert grün bleiben — sie ist die Wache dafür, dass Snapshot-Weg und eingebaute Map dasselbe liefern.

- [ ] **Schritt 5: Gate + Commit**

Run: `npm run check:quick` und `npm run cycles`

```bash
git add src/core/status/snapshot.ts src/core/status/__tests__/schreibweisen-fremddaten.test.ts
```

Betreff: `fix(status): amtliche Schreibweisen ueberleben eine Katalog-Fassung`

---

## Task 5: Doku, Version, Abnahme

**Files:**
- Modify: `docs/feedback-kontext/antraege.md`
- Modify: `docs/architecture/recurring-bug-classes.md`
- Modify: `package.json`, `CHANGELOG.md`, `src/core/components/changelog/changelog-user.md` (über das Script)

- [ ] **Schritt 1: Das Bildschirmseiten-Kontext-Doc nachziehen**

In `docs/feedback-kontext/antraege.md` den Abschnitt zu den Sicht-Reitern auf sechs Reiter umschreiben und festhalten:

- Die Reiter heißen **Antragsphase** (Eingang bis Bewilligung, ca. 3–9 Monate, Kürzel TIB/BIB) und **Begleitung** (nach der Bewilligung, 3–4 Jahre, Kürzel ZTP/PFM). Zusammen ergeben sie, was bis v2.401 der Reiter „Offen" war.
- Das Wort „Offen" bezeichnet ab v2.402 nur noch die **Status-Phase** (vor der Nachforderung) — in der Pille, den Gruppen-Bändern und den Kanban-Lanes.
- Der Profil-Haken „Begleitungen einschließen" blendet nichts mehr aus; er entscheidet nur, ob ZTP-/PFM-Zuordnungen als eigene zählen.
- Die Frist der Begleitung rechnet ab `vn_eingang_datum` + 6 Monate, die der Antragsphase ab `antragsdatum` + 90 Tage.

- [ ] **Schritt 2: Die Bug-Klasse fortschreiben**

In `docs/architecture/recurring-bug-classes.md` Klasse 15 („Zähler und Filter aus zwei Vokabularen") um die dritte Ausprägung ergänzen: **Seed gegen kuratierten Katalog**. Kernsatz: wer eine abgeleitete Menge beim Modul-Laden einfriert, friert den Stand *vor* dem Snapshot ein; und Schreibweisen eines codierten Werts gehören dem Code-Katalog, nicht der Fassung. Auf beide neuen Tests verweisen.

- [ ] **Schritt 3: Version + Changelog**

Run: `npm run version:bump -- minor "Begleitphase als eigene Sicht" --user`

Das Skelett in `CHANGELOG.md` im Kompaktformat füllen: max. 3 Zeilen Motivation, max. 5 Bullets à 1 Zeile (WAS + Datei-Link, kein WIE). Die Nutzer-Fassung in `changelog-user.md` muss die zwei sichtbaren Änderungen benennen: der Reiter „Offen" heißt jetzt „Antragsphase" und hat einen Nachbarn „Begleitung"; die Begleitphase ist ohne Profil-Einstellung sichtbar, dadurch steigen die Zahlen in „Alle" und auf der Startseite.

**Achtung:** `package.json` und `CHANGELOG.md` hält zeitweise eine parallele Session. Vor dem Bump `git status --short` prüfen; sind die Dateien fremd geändert, den Bump zurückstellen und im Abschlussbericht benennen — nicht fremde Änderungen mit-committen.

- [ ] **Schritt 4: Selbst ansehen (Pflicht)**

Run: `npm run dev:local` (Port 5175), dann im Browser `await window.__tf.bereit()`, `/antraege`.

Gegenprüfen — die **gerenderte** Zeichenkette lesen, nicht die Absicht im Code:

1. Reiter: **Antragsphase 907 · Begleitung 193**; „Alle" **7.661**.
2. In beiden neuen Reitern: Pillen-Summe = Reiter-Zahl = gerenderte Zeilenzahl.
3. Pille „Offen" nennt in **jedem** Reiter dieselbe Zahl (**802**). Vor Task 4 waren es 787 — dass sich das erst mit Task 4 auf 802 hebt, ist der Beleg, dass beide Teilschritte wirken.
4. Profil-Haken an/aus: **keine** Zahl darf sich ändern, solange kein eigenes Kürzel gesetzt ist.
5. In „Begleitung" einen Datensatz aufschlagen und die Frist gegen `vn_eingang_datum` + 6 Monate prüfen.
6. `window.__tf.fehler()` muss `[]` sein.

Weicht eine Zahl ab, **nicht** die Erwartung anpassen: die Abweichung ist der Befund.

- [ ] **Schritt 5: Volles Gate + Commit**

Run: `npm run check`

```bash
git add docs/feedback-kontext/antraege.md docs/architecture/recurring-bug-classes.md
```

`package.json`, `CHANGELOG.md` und `changelog-user.md` nur stagen, wenn `git status --short` sie als eigene Änderung zeigt. Betreff: `docs(antraege): Begleitphase-Sicht dokumentiert und Changelog nachgezogen`.

- [ ] **Schritt 6: Builds**

Run: `npm run build:dev && npm run build:pl`

Varianten-Builds typechecken **nicht** — deshalb erst nach dem grünen `npm run check` bauen. Liegen fremde Dateien mit Compile-Fehlern im Baum, den Build zurückstellen und das im Abschlussbericht benennen.

---

## Was dieser Plan bewusst nicht tut

- **Keinen zweiten Melde-Weg für unbekannte Statuswerte bauen.** Der Unkuratiert-Puffer ist leer, weil Auto-Discovery beim Import läuft und die Kuration danach — eine Fassung, die eine Schreibweise verliert, prüft niemand gegen den Bestand nach. Task 4 nimmt dieser Klasse für **codierte** Werte die Grundlage: die amtlichen Schreibweisen kommen künftig aus dem Code-Katalog. Ein Melde-Weg für Werte **ohne** Code bleibt offen und ist ein eigener Vorgang, falls er sich als nötig zeigt.
- **Den Katalog-Eintrag zu Code 72 nicht von Hand ändern.** Nach Task 4 ist die Fassung nicht mehr die Autorität über Schreibweisen; eine Datenkorrektur wäre eine Symptombehandlung, die beim nächsten Kurations-Schritt wiederkäme.
- **Die Status-Phase „Offen" nicht umbenennen.** Sie ist die amtliche Phasen-Sprache und steht zusätzlich in Gruppen-Bändern, Kanban-Lanes und `groupAggregates`.
- **`reichereWerteAn` nicht anfassen.** Ihr Frühausstieg schützt die Kuration und ist im Seed-Pfad richtig; der fehlende Nachzug wird dort behoben, wo jede Fassung vorbeikommt.
