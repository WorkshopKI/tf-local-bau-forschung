# Anlage 5 (Arbeitsplan) pro Teilvorhaben — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein ZIM-Verbund mit N Teilvorhaben zeigt im Aufbereitungs-Zeitplan-Tab pro TV eine eigene Gantt-Sektion aus dessen Anlage 5 (Arbeitsplan) + Kapazität, plus eine Verbund-Summenzeile; fehlende Anlage 5 ist pro TV sichtbar und direkt nachreichbar. Der Einzelvorhaben-Fall (1 TV) bleibt unverändert.

**Architecture:** Rein additiv. Der Solo-Pfad (1 TV) behält den heutigen `baueRun`-Code Byte-genau; der Verbund-Pfad (≥2 TV) kommt als neue optionale Run-Felder (`teilplaene`, `anlagenOhneTv`, `QuelleRef.tvAz`, `Befund.tvAz`) + neuer Render-Zweig dazu. `AufbereitungRun.version` bleibt `1`. TV↔Anlage-5-Zuordnung deterministisch aus dem Dateinamen zur Auflösungszeit (kein Tagging-Umbau, keine Migration, wirkt auf bereits hochgeladene Dateien). LLM-Bausteine bleiben unberührt.

**Tech Stack:** React 19 + TypeScript, Vite single-file (`file://`), IndexedDB `kv`-Store, Vitest. Modul `src/plugins/antraege/aufbereitung/` (dev-Flag `antragAufbereitung`).

**Spec:** [docs/superpowers/specs/2026-07-14-aufbereitung-anlage5-pro-tv-design.md](../specs/2026-07-14-aufbereitung-anlage5-pro-tv-design.md)

**Konventionen dieses Repos:**
- Commit-Messages enden mit `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Multiline via PowerShell Here-String oder `git commit -F -` (Bash-Heredoc). Ein post-commit-Hook pusht automatisch.
- Tests: `npm test -- <pfad>` (Vitest). Typecheck: `npm run typecheck` (Variant-Builds transpilen nur → Typecheck IMMER separat).
- Reine Funktionen werden unit-getestet; IO-Orchestrierung (`computeAufbereitung`, Hook, UI) wird über Typecheck + `file://`-Handprobe verifiziert (Modul-Konvention — `store.test.ts` testet heute schon nur `baueRun` rein).

---

## Datei-Struktur (was ändert sich)

**Neu**
- `src/plugins/antraege/aufbereitung/zeitplanBausteine.tsx` — geteilte Präsentations-Bausteine (`KennzahlenKarte`, `BefundZeile`, `Stat`), damit `ZeitplanTab` und `VerbundZeitplan` sie ohne Import-Zyklus teilen.
- `src/plugins/antraege/aufbereitung/VerbundZeitplan.tsx` — präsentationaler Container (Verbund-Summenzeile + pro-TV `TvZeitplanSektion`) für den Verbund-Zeitplan; enthält auch die `TvZeitplanSektion`-Komponente (eng gekoppelt).
- `src/plugins/antraege/aufbereitung/__tests__/quellen.test.ts` — Node-Tests für `matchTvAusDateiname` + `resolveAnlagenProTv`.

**Ändern**
- `src/plugins/antraege/aufbereitung/tabellen.ts` — `Befund.tvAz?` (additiv).
- `src/plugins/antraege/aufbereitung/types.ts` — `TvPlan`, `QuelleRef.tvAz?`, `AufbereitungRun.teilplaene?`, `AufbereitungRun.anlagenOhneTv?`.
- `src/plugins/antraege/aufbereitung/quellen.ts` — `matchTvAusDateiname`, `resolveAnlagenProTv`.
- `src/plugins/antraege/aufbereitung/store.ts` — `AufbereitungContext.teilvorhaben`, `TvEingang`/`VerbundEingang`, `ernteAnlagePlan`, `verbundZeitplanSummary`, `baueRun`-Verzweigung, `istVeraltet`-Multiset, `computeAufbereitung`.
- `src/plugins/antraege/aufbereitung/useAufbereitung.ts` — `teilvorhaben` in den Kontext, veraltet-Check pro TV.
- `src/plugins/antraege/aufbereitung/ZeitplanTab.tsx` — `KennzahlenKarte`/`BefundZeile`/`Stat` nach `zeitplanBausteine.tsx` ausgelagert (KennzahlenKarte prop-getrieben), Verbund-Render-Zweig, neue Props `ctx`/`onIngested`.
- `src/plugins/antraege/aufbereitung/QuellenPanel.tsx` — pro-TV Anlage-5-Zeilen + „ohne TV-Zuordnung".
- `src/plugins/antraege/aufbereitung/AufbereitungPage.tsx` — `teilvorhaben` in den Kontext, `ctx`/`onIngested` an `ZeitplanTab`.
- `src/plugins/antraege/aufbereitung/__tests__/store.test.ts` — neue Tests (Verbund-`baueRun`, `verbundZeitplanSummary`, `istVeraltet`-Multiset).
- `docs/architecture/antrag-aufbereitung.md`, `docs/feedback-kontext/antraege.md`, `CHANGELOG.md`, `src/core/components/changelog/changelog-user.md`, `package.json`.

---

## Task 1: Additive Typen (Datenmodell)

**Files:**
- Modify: `src/plugins/antraege/aufbereitung/tabellen.ts` (Interface `Befund`, ~Z.55-60)
- Modify: `src/plugins/antraege/aufbereitung/types.ts`

Reine Interface-Erweiterungen — kein Unit-Test (kann nicht fehlschlagen); Gate = `npm run typecheck`.

- [ ] **Step 1: `Befund.tvAz?` ergänzen**

In `tabellen.ts`, Interface `Befund` um ein optionales Feld erweitern:

```ts
export interface Befund {
  typ: 'zeitraum-abweichung' | 'nur-im-text' | 'nur-in-anlage' | 'horizont' | 'kapazitaet';
  schwere: 'warnung' | 'info';
  text: string;
  quellen: Array<{ rolle: 'vb' | 'anlage5'; sektionId?: string }>;
  /** Bei Verbund-Kapazitätsbefunden: das Teilvorhaben, aus dessen Anlage 5 der Befund stammt. */
  tvAz?: string;
}
```

- [ ] **Step 2: `QuelleRef.tvAz?` + `TvPlan` + Run-Felder ergänzen**

In `types.ts`: `QuelleRef` um `tvAz?` erweitern, `TvPlan` neu, und `AufbereitungRun` um zwei optionale Felder:

```ts
export interface QuelleRef {
  name: string;
  hash: string;
  gelesenAm: string;
  rolle: 'vb' | 'anlage5' | 'verwertung';
  /** Bei `rolle:'anlage5'` im Verbund: das Teilvorhaben, zu dem diese Anlage 5 gehört. */
  tvAz?: string;
}

/**
 * Ein Teilvorhaben-Plan im Verbund: die Anlage-5-Ernte EINES TV. Nur im echten
 * Verbund (≥2 TV) gesetzt; `anlage`/`zeitplan` null = Anlage 5 für dieses TV fehlt.
 */
export interface TvPlan {
  nr: number;
  tvAz: string;
  tvAkronym: string | null;
  tvTitel: string | null;
  anlage: QuelleRef | null;
  zeitplan: { zeilen: ApZeile[]; achseMax: number } | null;
}
```

In `AufbereitungRun` (nach `risiken?`, vor `hinweis?`) einfügen:

```ts
  /**
   * Pro-TV-Zeitpläne im echten Verbund (≥2 TV, Paket „Anlage 5 pro TV"). Gesetzt NUR
   * im Verbund; im Solo-Fall `undefined` → heutiges Single-`zeitplan`-Rendering. Additiv,
   * `version` bleibt 1.
   */
  teilplaene?: TvPlan[];
  /** Dateinamen von Anlage-5-Dokumenten, die keinem TV zugeordnet werden konnten. */
  anlagenOhneTv?: string[];
```

`TvPlan` braucht `ApZeile` — der Import `import type { ApZeile, Befund, KlassifizierteTabelle } from './tabellen';` steht oben in `types.ts` bereits.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (keine Fehler).

- [ ] **Step 4: Commit**

```bash
git add src/plugins/antraege/aufbereitung/tabellen.ts src/plugins/antraege/aufbereitung/types.ts
git commit -F - <<'EOF'
feat(aufbereitung): additive Typen für Anlage 5 pro Teilvorhaben

TvPlan + AufbereitungRun.teilplaene/anlagenOhneTv + QuelleRef.tvAz + Befund.tvAz
(alle optional, version bleibt 1).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 2: `matchTvAusDateiname` (reine Zuordnung TV aus Dateiname)

**Files:**
- Modify: `src/plugins/antraege/aufbereitung/quellen.ts`
- Test: `src/plugins/antraege/aufbereitung/__tests__/quellen.test.ts` (neu)

- [ ] **Step 1: Failing Test schreiben**

Neue Datei `src/plugins/antraege/aufbereitung/__tests__/quellen.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { matchTvAusDateiname } from '../quellen';

describe('matchTvAusDateiname', () => {
  const tvs = ['16KN123456', '16KN123457', '16KN123458'];

  it('findet das TV-FKZ im Dateinamen (mit Trennern/Groß-Klein)', () => {
    expect(matchTvAusDateiname('Anlage_5_16kn123457_final.pdf', tvs)).toBe('16KN123457');
    expect(matchTvAusDateiname('16KN 12 34 58 - Arbeitsplan.docx', tvs)).toBe('16KN123458');
  });

  it('ohne erkennbares TV-FKZ → null', () => {
    expect(matchTvAusDateiname('Arbeitsplan_ohne_kennung.pdf', tvs)).toBeNull();
    expect(matchTvAusDateiname('Anlage 5.docx', tvs)).toBeNull();
  });

  it('bei Präfix-Kollision gewinnt das längste passende TV-FKZ', () => {
    const kollision = ['16KN1234', '16KN12345'];
    expect(matchTvAusDateiname('anlage5-16kn12345.pdf', kollision)).toBe('16KN12345');
  });
});
```

- [ ] **Step 2: Test schlägt fehl**

Run: `npm test -- src/plugins/antraege/aufbereitung/__tests__/quellen.test.ts`
Expected: FAIL (`matchTvAusDateiname` ist nicht exportiert).

- [ ] **Step 3: Implementieren**

In `quellen.ts` den `normId`-Import ergänzen und die Funktion (z.B. direkt nach `ANLAGE5_RE`) hinzufügen:

```ts
import { normId } from '@/core/components/dokumentAufnahmeFkz';
```

```ts
/**
 * Ordnet einen Dateinamen dem Teilvorhaben zu, dessen Aktenzeichen (normalisiert)
 * als Substring im Dateinamen steckt. Matcht NUR gegen TV-Aktenzeichen (nicht gegen
 * die Verbund-ID) — so gewinnt bei „Verbund- UND TV-FKZ im Namen" das TV. Bei
 * Präfix-Kollision (ein Az ist Präfix eines anderen) gewinnt das längste. Rein.
 */
export function matchTvAusDateiname(filename: string, tvAzListe: string[]): string | null {
  const hay = normId(filename);
  let best: string | null = null;
  for (const az of tvAzListe) {
    const n = normId(az);
    if (n.length > 0 && hay.includes(n) && (best === null || n.length > normId(best).length)) best = az;
  }
  return best;
}
```

- [ ] **Step 4: Test grün**

Run: `npm test -- src/plugins/antraege/aufbereitung/__tests__/quellen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/antraege/aufbereitung/quellen.ts src/plugins/antraege/aufbereitung/__tests__/quellen.test.ts
git commit -F - <<'EOF'
feat(aufbereitung): matchTvAusDateiname — TV-Zuordnung aus dem Dateinamen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 3: `resolveAnlagenProTv` (Multi-Auflösung aus IDB)

**Files:**
- Modify: `src/plugins/antraege/aufbereitung/quellen.ts`
- Test: `src/plugins/antraege/aufbereitung/__tests__/quellen.test.ts`

Auflösung ist IDB-only (die Inline-Upload-Fläche schreibt in den Dokumente-Store = IDB). Der persönliche Ordner-Fallback bleibt dem Solo-`resolveAnlage5` vorbehalten (v1-Grenze, siehe Spec).

- [ ] **Step 1: Failing Test ergänzen**

In `__tests__/quellen.test.ts` anhängen:

```ts
import { resolveAnlagenProTv } from '../quellen';
import type { IDBStore } from '@/core/services/storage';

/** Minimaler IDB-Fake: nur keys(prefix) + get(key). */
function fakeIdb(docs: Record<string, unknown>): IDBStore {
  return {
    keys: async (prefix: string) => Object.keys(docs).filter(k => k.startsWith(prefix)),
    get: async (key: string) => docs[key] ?? null,
  } as unknown as IDBStore;
}

describe('resolveAnlagenProTv', () => {
  const VERBUND = 'ZEP-1';
  const tvs = ['16KN123456', '16KN123457'];
  const mkDoc = (tags: string[], filename: string, markdown: string, created: string) =>
    ({ tags, filename, markdown, created });

  it('gruppiert Anlage-5-Dokumente pro TV; jüngstes gewinnt; Unzuordenbare separat', async () => {
    const idb = fakeIdb({
      'doc:a': mkDoc([VERBUND, 'arbeitsplan'], 'AP_16KN123456.pdf', 'ALT', '2026-01-01'),
      'doc:b': mkDoc([VERBUND, 'arbeitsplan'], 'AP_16KN123456_neu.pdf', 'NEU', '2026-02-01'),
      'doc:c': mkDoc([VERBUND], 'Anlage 5 16KN123457.docx', 'TV2', '2026-01-15'),
      'doc:d': mkDoc([VERBUND, 'arbeitsplan'], 'Arbeitsplan_ohne_fkz.pdf', 'X', '2026-01-20'),
      'doc:e': mkDoc([VERBUND, 'vorhabensbeschreibung'], 'VB_16KN123456.pdf', 'VB', '2026-01-01'),
    });
    const { proTv, unzugeordnet } = await resolveAnlagenProTv(idb, VERBUND, tvs);
    expect(proTv.get('16KN123456')?.markdown).toBe('NEU'); // jüngstes
    expect(proTv.get('16KN123457')?.markdown).toBe('TV2'); // per Dateiname-Regex + Tag
    expect(unzugeordnet).toEqual(['Arbeitsplan_ohne_fkz.pdf']);
    expect(proTv.has('16KN123456') && proTv.get('16KN123456')?.quelleName).toBe('AP_16KN123456_neu.pdf');
  });

  it('ignoriert Dokumente anderer Verbünde (nicht mit dem Verbund-Key getaggt)', async () => {
    const idb = fakeIdb({
      'doc:x': mkDoc(['ANDERER-VERBUND', 'arbeitsplan'], 'AP_16KN123456.pdf', 'FREMD', '2026-01-01'),
    });
    const { proTv } = await resolveAnlagenProTv(idb, VERBUND, tvs);
    expect(proTv.size).toBe(0);
  });
});
```

- [ ] **Step 2: Test schlägt fehl**

Run: `npm test -- src/plugins/antraege/aufbereitung/__tests__/quellen.test.ts`
Expected: FAIL (`resolveAnlagenProTv` nicht exportiert).

- [ ] **Step 3: Implementieren**

In `quellen.ts` ergänzen (nutzt das vorhandene modul-private `ANLAGE5_RE` + `DocumentFull`-Import):

```ts
/** Ergebnis der Multi-Auflösung: Anlage 5 je TV + nicht zuordenbare Dokumente. */
export interface AnlagenProTvErgebnis {
  proTv: Map<string, AnlageAufloesung>;
  /** Dateinamen von Anlage-5-Dokumenten ohne erkennbares TV-FKZ. */
  unzugeordnet: string[];
}

/**
 * Löst pro Teilvorhaben die (jüngste) Anlage 5 aus dem IDB-Dokumentenspeicher auf.
 * Ein `doc:`-Scan; Kandidat = mit `verbundKey` getaggt UND (Tag `'arbeitsplan'` ODER
 * Dateiname matcht `ANLAGE5_RE`); Zuordnung per `matchTvAusDateiname`. IDB-only
 * (Verbund-Intake läuft über die Inline-Aufnahme); der persönliche Ordner-Fallback
 * bleibt dem Solo-`resolveAnlage5` vorbehalten.
 */
export async function resolveAnlagenProTv(
  idb: IDBStore, verbundKey: string, tvAzListe: string[],
): Promise<AnlagenProTvErgebnis> {
  const keys = await idb.keys('doc:');
  const juengste = new Map<string, DocumentFull>();
  const unzugeordnet: string[] = [];
  for (const key of keys) {
    const doc = await idb.get<DocumentFull>(key);
    if (!doc) continue;
    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    if (!tags.includes(verbundKey)) continue;
    const istAnlage = tags.includes('arbeitsplan') || ANLAGE5_RE.test(doc.filename ?? '');
    if (!istAnlage) continue;
    const tv = matchTvAusDateiname(doc.filename ?? '', tvAzListe);
    if (!tv) { unzugeordnet.push(doc.filename); continue; }
    const bisher = juengste.get(tv);
    if (!bisher || (doc.created ?? '').localeCompare(bisher.created ?? '') > 0) juengste.set(tv, doc);
  }
  const proTv = new Map<string, AnlageAufloesung>();
  for (const [tv, doc] of juengste) {
    proTv.set(tv, { markdown: doc.markdown, herkunft: 'idb', quelleName: doc.filename });
  }
  return { proTv, unzugeordnet };
}
```

- [ ] **Step 4: Test grün**

Run: `npm test -- src/plugins/antraege/aufbereitung/__tests__/quellen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/antraege/aufbereitung/quellen.ts src/plugins/antraege/aufbereitung/__tests__/quellen.test.ts
git commit -F - <<'EOF'
feat(aufbereitung): resolveAnlagenProTv — Anlage 5 je Teilvorhaben aus IDB

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 4: `verbundZeitplanSummary` (reine Verbund-Kennzahlen)

**Files:**
- Modify: `src/plugins/antraege/aufbereitung/store.ts`
- Test: `src/plugins/antraege/aufbereitung/__tests__/store.test.ts`

- [ ] **Step 1: Failing Test ergänzen**

In `store.test.ts` (oben `verbundZeitplanSummary` mit importieren) anhängen:

```ts
import { verbundZeitplanSummary } from '../store';
import type { TvPlan } from '../types';

describe('verbundZeitplanSummary', () => {
  const tp = (nr: number, tvAz: string, zeilen: unknown, achseMax: number): TvPlan => ({
    nr, tvAz, tvAkronym: `TV${nr}`, tvTitel: null,
    anlage: { name: `a${nr}.docx`, hash: 'h', gelesenAm: NOW, rolle: 'anlage5', tvAz },
    zeitplan: zeilen ? { zeilen: zeilen as never, achseMax } : null,
  });

  it('summiert PM, MA-Zahl (pro TV distinct) und längsten Horizont; fehlende TVs zählen 0', () => {
    const tps: TvPlan[] = [
      tp(1, 'A', [
        { nummer: '1', bezeichnung: 'x', istUnterAp: false, monatStart: 1, monatEnde: 3, pm: 4, maNr: 'MA01' },
        { nummer: '2', bezeichnung: 'y', istUnterAp: false, monatStart: 2, monatEnde: 4, pm: 2, maNr: 'MA02' },
      ], 4),
      tp(2, 'B', [
        { nummer: '1', bezeichnung: 'z', istUnterAp: false, monatStart: 1, monatEnde: 6, pm: 5, maNr: 'MA01' },
      ], 6),
      tp(3, 'C', null, 1), // Anlage 5 fehlt
    ];
    const s = verbundZeitplanSummary(tps);
    expect(s.summePm).toBe(11);      // 4+2 (TV A) + 5 (TV B)
    expect(s.maAnzahl).toBe(3);      // 2 (A: MA01,MA02) + 1 (B: MA01) — TV-lokal, nicht global dedupliziert
    expect(s.horizont).toBe(6);
    expect(s.tvMitAnlage).toBe(2);
    expect(s.tvGesamt).toBe(3);
  });
});
```

- [ ] **Step 2: Test schlägt fehl**

Run: `npm test -- src/plugins/antraege/aufbereitung/__tests__/store.test.ts`
Expected: FAIL (`verbundZeitplanSummary` nicht exportiert).

- [ ] **Step 3: Implementieren**

In `store.ts` importieren und die Funktion ergänzen:

```ts
import { summePm } from './tabellen';
import type { AufbereitungRun, QuelleRef, RunTabelle, TvPlan } from './types';
```

```ts
/** Aggregierte Verbund-Kennzahlen über alle TV-Pläne (rein, für die Summenzeile). */
export interface VerbundSummary {
  summePm: number;
  /** Summe der TV-LOKALEN Distinct-MA-Zahlen (MA-Nummern sind je TV eigen, kein globales Dedup). */
  maAnzahl: number;
  horizont: number;
  tvMitAnlage: number;
  tvGesamt: number;
}

export function verbundZeitplanSummary(teilplaene: TvPlan[]): VerbundSummary {
  let pm = 0;
  let ma = 0;
  let horizont = 0;
  let mitAnlage = 0;
  for (const tp of teilplaene) {
    if (!tp.zeitplan) continue;
    mitAnlage += 1;
    pm += summePm(tp.zeitplan.zeilen);
    ma += new Set(tp.zeitplan.zeilen.map(z => z.maNr?.trim()).filter((m): m is string => !!m)).size;
    horizont = Math.max(horizont, tp.zeitplan.achseMax);
  }
  return { summePm: pm, maAnzahl: ma, horizont, tvMitAnlage: mitAnlage, tvGesamt: teilplaene.length };
}
```

- [ ] **Step 4: Test grün**

Run: `npm test -- src/plugins/antraege/aufbereitung/__tests__/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/antraege/aufbereitung/store.ts src/plugins/antraege/aufbereitung/__tests__/store.test.ts
git commit -F - <<'EOF'
feat(aufbereitung): verbundZeitplanSummary — Σ PM / MA / Horizont pro Verbund

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 5: `baueRun`-Verbund-Zweig + `ernteAnlagePlan`

**Files:**
- Modify: `src/plugins/antraege/aufbereitung/store.ts`
- Test: `src/plugins/antraege/aufbereitung/__tests__/store.test.ts`

Neue Eingänge werden als EIN optionaler Trailing-Parameter `verbund?` an `baueRun` gehängt — die bestehenden 5-Argument-Aufrufe (Solo) bleiben unverändert.

- [ ] **Step 1: Failing Test ergänzen**

In `store.test.ts` anhängen (nutzt `VB_MD`/`ANLAGE_MD`/`NOW` aus der Datei):

```ts
describe('baueRun — Verbund (Anlage 5 pro TV)', () => {
  const anlageTvA = [
    '| AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 1 | Konzept A | 01.01.2023 | 28.02.2023 | MA01 | 2 |',
  ].join('\n');
  const anlageTvB = [
    '| AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 1 | Kern B | 01.04.2023 | 15.04.2023 | MA02 | 4 |',
    '| 2 | Erweiterung B | 16.04.2023 | 30.04.2023 | MA02 | 3 |',
  ].join('\n');

  const teilvorhaben = [
    { nr: 1, tvAz: '16KN0001', akronym: 'ALPHA', titel: 'TV Alpha' },
    { nr: 2, tvAz: '16KN0002', akronym: 'BETA', titel: 'TV Beta' },
    { nr: 3, tvAz: '16KN0003', akronym: 'GAMMA', titel: 'TV Gamma' },
  ];
  const anlagenProTv = new Map([
    ['16KN0001', { markdown: anlageTvA, name: 'AP_16KN0001.docx' }],
    ['16KN0002', { markdown: anlageTvB, name: 'AP_16KN0002.docx' }],
  ]);
  const run = baueRun('VBND', { markdown: VB_MD, name: 'p.docx' }, null, [], NOW,
    { teilvorhaben, anlagenProTv, unzugeordnet: ['fremd.pdf'] });

  it('baut ein teilplaene-Array mit einem Eintrag je TV (fehlende TV = anlage null)', () => {
    expect(run.teilplaene?.map(t => t.tvAz)).toEqual(['16KN0001', '16KN0002', '16KN0003']);
    expect(run.teilplaene?.map(t => t.tvAkronym)).toEqual(['ALPHA', 'BETA', 'GAMMA']);
    expect(run.teilplaene?.[0]?.zeitplan?.zeilen.length).toBe(1);
    expect(run.teilplaene?.[2]?.anlage).toBeNull();       // GAMMA ohne Anlage 5
    expect(run.teilplaene?.[2]?.zeitplan).toBeNull();
  });

  it('Top-Level zeitplan ist null; quellen tragen VB + je TV eine anlage5-Quelle mit tvAz', () => {
    expect(run.zeitplan).toBeNull();
    const anlageQ = run.quellen.filter(q => q.rolle === 'anlage5');
    expect(anlageQ.map(q => q.tvAz)).toEqual(['16KN0001', '16KN0002']);
    expect(run.quellen.find(q => q.rolle === 'vb')).toBeDefined();
  });

  it('Kapazitäts-Befunde sind pro TV geflacht (mit tvAz + TV-Kürzel im Text)', () => {
    const kap = run.befunde.filter(b => b.typ === 'kapazitaet');
    expect(kap.length).toBeGreaterThan(0);
    expect(kap.every(b => b.tvAz === '16KN0002')).toBe(true); // nur BETA ist überplant
    expect(kap[0]!.text.startsWith('BETA:')).toBe(true);
  });

  it('unzuordenbare Anlagen landen in anlagenOhneTv', () => {
    expect(run.anlagenOhneTv).toEqual(['fremd.pdf']);
  });

  it('Regression: 1 TV bzw. kein verbund-Arg → Solo-Pfad unverändert (kein teilplaene)', () => {
    const solo = baueRun('S', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, [], NOW);
    expect(solo.teilplaene).toBeUndefined();
    expect(solo.zeitplan?.herkunft).toBe('beide');
    // Auch mit verbund-Arg, aber nur 1 TV → Solo-Pfad.
    const einTv = baueRun('S1', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, [], NOW,
      { teilvorhaben: [{ nr: 1, tvAz: '16KN0001', akronym: 'ALPHA', titel: null }],
        anlagenProTv: new Map(), unzugeordnet: [] });
    expect(einTv.teilplaene).toBeUndefined();
    expect(einTv.zeitplan?.herkunft).toBe('beide');
  });
});
```

- [ ] **Step 2: Test schlägt fehl**

Run: `npm test -- src/plugins/antraege/aufbereitung/__tests__/store.test.ts`
Expected: FAIL (`baueRun` kennt keinen 6. Parameter / kein `teilplaene`).

- [ ] **Step 3: Implementieren**

In `store.ts`:

(a) Importe/Helfer-Typen ergänzen (oben bei den Imports steht `pruefeKapazitaet`, `ernteTabellen`, `normalisiereAnlage5` bereits über `./tabellen`; `ApZeile`/`Befund` via `./tabellen`):

```ts
import {
  ernteTabellen, normalisiereAnlage5, normalisiereZeitplanText, verglichZeitplaene, pruefeKapazitaet,
  summePm, type ApZeile, type Befund,
} from './tabellen';
```

(b) Neue Eingangs-Typen + Ernte-Helfer (vor `baueRun`):

```ts
/** Ein Teilvorhaben als Eingang der Verbund-Assemblierung. */
export interface TvEingang {
  nr: number;
  tvAz: string;
  akronym: string | null;
  titel: string | null;
}

/** Verbund-Eingang von `computeAufbereitung` an `baueRun` (nur bei ≥2 TV wirksam). */
export interface VerbundEingang {
  teilvorhaben: TvEingang[];
  anlagenProTv: Map<string, QuellEingang>;
  unzugeordnet: string[];
}

/** Anlage-5-Markdown → reiner Zeitplan (nur `klasse:'anlage5'`), oder null. Geteilt. */
function ernteAnlagePlan(markdown: string): { zeilen: ApZeile[]; achseMax: number } | null {
  const zeilen = ernteTabellen(markdown)
    .filter(t => t.klasse === 'anlage5')
    .flatMap(t => normalisiereAnlage5(t));
  if (zeilen.length === 0) return null;
  const achseMax = Math.max(zeilen.reduce((m, z) => Math.max(m, z.monatEnde ?? z.monatStart ?? 0), 0), 1);
  return { zeilen, achseMax };
}
```

(c) `baueRun`-Signatur um den optionalen `verbund`-Parameter erweitern und am Anfang verzweigen. Die Signatur wird:

```ts
export function baueRun(
  antragKey: string, vb: QuellEingang | null, anlage: QuellEingang | null,
  narrativeDocs: QuellEingang[], now: string, verbund?: VerbundEingang,
): AufbereitungRun {
```

> **Achtung:** die heutige Reihenfolge war `(antragKey, vb, anlage, narrativeDocs, now)`. `narrativeDocs` und `now` bleiben an Position 4/5; `verbund` wird 6. optional. Bestehende Aufrufe unverändert.

Direkt am Funktionsanfang, VOR dem heutigen Code, den Verbund-Zweig einsetzen:

```ts
  // ── Verbund-Zweig (≥2 TV): pro TV eine Anlage-5-Ernte, kein Text-Abgleich. ──
  if (verbund && verbund.teilvorhaben.length >= 2) {
    return baueVerbundRun(antragKey, vb, narrativeDocs, verbund, now);
  }
  // ── Solo-Pfad (1 TV / kein verbund-Arg): heutiger Code unverändert darunter. ──
```

(d) Den Verbund-Assembler als eigene Funktion (nach `baueRun`) ergänzen. Er wiederverwendet Gliederung/Tabellen/Risiken-Logik des Solo-Pfads für die VB, ergänzt aber `teilplaene` statt eines Einzel-Zeitplans:

```ts
function baueVerbundRun(
  antragKey: string, vb: QuellEingang | null, narrativeDocs: QuellEingang[],
  verbund: VerbundEingang, now: string,
): AufbereitungRun {
  const quellen: QuelleRef[] = [];
  if (vb) quellen.push({ name: vb.name, hash: hashText(vb.markdown), gelesenAm: now, rolle: 'vb' });
  for (const d of narrativeDocs) quellen.push({ name: d.name, hash: hashText(d.markdown), gelesenAm: now, rolle: 'verwertung' });

  const korpus = vb ? baueKorpus(vb, narrativeDocs) : '';
  const gliederung = korpus ? parseVbGliederung(korpus) : [];
  const vbTabellen: RunTabelle[] = vb ? ernteTabellen(vb.markdown).map(t => ({ ...t, rolle: 'vb' as const })) : [];
  const risiken = ernteRisiken(vbTabellen, gliederung);

  const teilplaene: TvPlan[] = verbund.teilvorhaben.map(tv => {
    const a = verbund.anlagenProTv.get(tv.tvAz) ?? null;
    return {
      nr: tv.nr, tvAz: tv.tvAz, tvAkronym: tv.akronym, tvTitel: tv.titel,
      anlage: a ? { name: a.name, hash: hashText(a.markdown), gelesenAm: now, rolle: 'anlage5' as const, tvAz: tv.tvAz } : null,
      zeitplan: a ? ernteAnlagePlan(a.markdown) : null,
    };
  });
  for (const tp of teilplaene) if (tp.anlage) quellen.push(tp.anlage);

  // Kapazitäts-Befunde pro TV, geflacht in run.befunde (tvAz + Kürzel im Text → eindeutiger befundKey).
  const befunde: Befund[] = teilplaene.flatMap(tp => {
    if (!tp.zeitplan) return [];
    const label = tp.tvAkronym ?? tp.tvAz;
    return pruefeKapazitaet(tp.zeitplan.zeilen).map(b => ({ ...b, tvAz: tp.tvAz, text: `${label}: ${b.text}` }));
  });

  return {
    version: 1,
    antragKey,
    erzeugtAm: now,
    quellen,
    gliederung,
    tabellen: vbTabellen,
    zeitplan: null,
    befunde,
    offenePunkte: [],
    teilplaene,
    ...(verbund.unzugeordnet.length ? { anlagenOhneTv: verbund.unzugeordnet } : {}),
    ...(risiken.length ? { risiken } : {}),
    ...(vb ? {} : { hinweis: 'Keine Vorhabensbeschreibung gefunden — bitte VB zum Antrag aufnehmen, dann neu aufbereiten.' }),
  };
}
```

> `ernteRisiken` und `parseVbGliederung` und `baueKorpus` sind bereits in `store.ts` importiert (`ernteRisiken` aus `./risiken`, `parseVbGliederung` aus `./gliederung`, `baueKorpus` aus `./quellen`). `hashText` ebenfalls.

- [ ] **Step 4: Tests grün (inkl. Regression)**

Run: `npm test -- src/plugins/antraege/aufbereitung/__tests__/store.test.ts`
Expected: PASS (alle bestehenden Solo-Tests + neue Verbund-Tests).

- [ ] **Step 5: Commit**

```bash
git add src/plugins/antraege/aufbereitung/store.ts src/plugins/antraege/aufbereitung/__tests__/store.test.ts
git commit -F - <<'EOF'
feat(aufbereitung): baueRun-Verbund-Zweig — teilplaene je TV, Solo unverändert

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 6: `istVeraltet`-Multiset für den Verbund

**Files:**
- Modify: `src/plugins/antraege/aufbereitung/store.ts`
- Test: `src/plugins/antraege/aufbereitung/__tests__/store.test.ts`

- [ ] **Step 1: Failing Test ergänzen**

In `store.test.ts` anhängen (nutzt `teilvorhaben`/`anlagenProTv` sind lokal in Task-5-`describe`; hier eigene Minimaldaten):

```ts
describe('istVeraltet — Verbund (Anlage-5-Multiset)', () => {
  const anlage = (pm: string) => [
    '| AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM |',
    '| --- | --- | --- | --- | --- | --- |',
    `| 1 | X | 01.01.2023 | 31.01.2023 | MA01 | ${pm} |`,
  ].join('\n');
  const run = baueRun('VBND', { markdown: VB_MD, name: 'p.docx' }, null, [], NOW, {
    teilvorhaben: [
      { nr: 1, tvAz: '16KN0001', akronym: 'A', titel: null },
      { nr: 2, tvAz: '16KN0002', akronym: 'B', titel: null },
    ],
    anlagenProTv: new Map([
      ['16KN0001', { markdown: anlage('1'), name: 'a1.docx' }],
      ['16KN0002', { markdown: anlage('2'), name: 'a2.docx' }],
    ]),
    unzugeordnet: [],
  });
  const vbH = run.quellen.find(q => q.rolle === 'vb')!.hash;
  const anlagenHashes = run.quellen.filter(q => q.rolle === 'anlage5').map(q => q.hash);

  it('gleiches Multiset → nicht veraltet', () => {
    expect(istVeraltet(run, { vbHash: vbH, anlage5Hashes: anlagenHashes })).toBe(false);
  });
  it('eine Anlage 5 entfernt/geändert → veraltet', () => {
    expect(istVeraltet(run, { vbHash: vbH, anlage5Hashes: [anlagenHashes[0]!] })).toBe(true);
    expect(istVeraltet(run, { vbHash: vbH, anlage5Hashes: [anlagenHashes[0]!, 'anders'] })).toBe(true);
  });
});
```

- [ ] **Step 2: Test schlägt fehl**

Run: `npm test -- src/plugins/antraege/aufbereitung/__tests__/store.test.ts`
Expected: FAIL (`istVeraltet` kennt `anlage5Hashes` nicht / Verbund-Run nutzt Solo-Zweig).

- [ ] **Step 3: Implementieren**

`istVeraltet` in `store.ts` ersetzen (Solo-Verhalten bleibt identisch; Verbund nutzt Multiset):

```ts
export function istVeraltet(
  run: AufbereitungRun,
  aktuell: { vbHash?: string; anlage5Hash?: string; anlage5Hashes?: string[]; verwertungHashes?: string[] },
): boolean {
  const gestempelt = (rolle: 'vb' | 'anlage5'): string | undefined => run.quellen.find(q => q.rolle === rolle)?.hash;
  if (gestempelt('vb') !== aktuell.vbHash) return true;

  // Anlage 5: im Verbund ein Multiset (pro TV), im Solo ein Einzel-Hash.
  const gleichMultiset = (a: string[], b: string[]): boolean => {
    const x = a.slice().sort();
    const y = b.slice().sort();
    return x.length === y.length && x.every((h, i) => h === y[i]);
  };
  if (run.teilplaene) {
    const gestempeltAnlagen = run.quellen.filter(q => q.rolle === 'anlage5').map(q => q.hash);
    if (!gleichMultiset(gestempeltAnlagen, aktuell.anlage5Hashes ?? [])) return true;
  } else if (gestempelt('anlage5') !== aktuell.anlage5Hash) {
    return true;
  }

  // Narrative Zusatzdokumente: veraltet, sobald sich die Menge der Hashes ändert.
  const gestempelteVw = run.quellen.filter(q => q.rolle === 'verwertung').map(q => q.hash);
  return !gleichMultiset(gestempelteVw, aktuell.verwertungHashes ?? []);
}
```

- [ ] **Step 4: Tests grün**

Run: `npm test -- src/plugins/antraege/aufbereitung/__tests__/store.test.ts`
Expected: PASS (bestehende Solo-`istVeraltet`-Tests + neue Verbund-Tests).

- [ ] **Step 5: Commit**

```bash
git add src/plugins/antraege/aufbereitung/store.ts src/plugins/antraege/aufbereitung/__tests__/store.test.ts
git commit -F - <<'EOF'
feat(aufbereitung): istVeraltet erkennt Anlage-5-Multiset im Verbund

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 7: `computeAufbereitung` + `AufbereitungContext.teilvorhaben` verdrahten

**Files:**
- Modify: `src/plugins/antraege/aufbereitung/store.ts`

IO-Orchestrierung — kein Unit-Test (Modul-Konvention); Gate = Typecheck + bestehende Tests grün + spätere `file://`-Handprobe.

- [ ] **Step 1: `AufbereitungContext` erweitern**

```ts
export interface AufbereitungContext {
  key: string;
  knownIds: string[];
  /** Teilvorhaben des Verbundes (Lead-TV zuerst) — Labels + TV-Liste für die Anlage-5-Zuordnung. */
  teilvorhaben?: TvEingang[];
}
```

- [ ] **Step 2: `computeAufbereitung` verzweigen**

`computeAufbereitung` ersetzen — im Verbund (≥2 TV) die Anlagen pro TV auflösen und als `verbund` an `baueRun` reichen:

```ts
export async function computeAufbereitung(idb: IDBStore, ctx: AufbereitungContext): Promise<AufbereitungRun> {
  const now = new Date().toISOString();
  const vorher = await loadAufbereitung(idb, ctx.key);
  const korpus = await resolveKorpus(idb, ctx);

  const vb: QuellEingang | null = korpus?.vb ?? null;
  const narrative: QuellEingang[] = korpus?.narrative ?? [];

  const tvs = ctx.teilvorhaben ?? [];
  let roh: AufbereitungRun;
  if (tvs.length >= 2) {
    const { proTv, unzugeordnet } = await resolveAnlagenProTv(idb, ctx.key, tvs.map(t => t.tvAz));
    const anlagenProTv = new Map<string, QuellEingang>();
    for (const [tvAz, a] of proTv) anlagenProTv.set(tvAz, { markdown: a.markdown, name: a.quelleName });
    roh = baueRun(ctx.key, vb, null, narrative, now, { teilvorhaben: tvs, anlagenProTv, unzugeordnet });
  } else {
    const anlageA = await resolveAnlage5(idb, ctx).catch(() => null);
    const anlage: QuellEingang | null = anlageA ? { markdown: anlageA.markdown, name: anlageA.quelleName } : null;
    roh = baueRun(ctx.key, vb, anlage, narrative, now);
  }

  const mitOffen = uebernehmeOffenePunkte(roh, vorher?.offenePunkte ?? []);
  const run = uebernehmeErledigtePunkte(mitOffen, vorher?.erledigtePunkte ?? []);
  await idb.set(aufbereitungKey(ctx.key), run);
  return run;
}
```

`resolveAnlagenProTv` in den Import aus `./quellen` aufnehmen:

```ts
import { resolveAnlage5, resolveKorpus, baueKorpus, resolveAnlagenProTv } from './quellen';
```

- [ ] **Step 3: Typecheck + bestehende Tests**

Run: `npm run typecheck && npm test -- src/plugins/antraege/aufbereitung/__tests__/store.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/antraege/aufbereitung/store.ts
git commit -F - <<'EOF'
feat(aufbereitung): computeAufbereitung löst Anlage 5 pro TV im Verbund auf

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 8: `useAufbereitung` — teilvorhaben + veraltet pro TV

**Files:**
- Modify: `src/plugins/antraege/aufbereitung/useAufbereitung.ts`

- [ ] **Step 1: Veraltet-Effekt pro TV**

Im veraltet-`useEffect` (nutzt schon `resolveKorpus`/`resolveAnlage5`) den Anlage-5-Teil verbund-bewusst machen. `resolveAnlagenProTv` importieren:

```ts
import { resolveKorpus, resolveAnlage5, resolveAnlagenProTv } from './quellen';
```

Den `aktuell`-Block im Effekt ersetzen:

```ts
        const korpus = await resolveKorpus(storage.idb, ctx);
        const tvs = ctx.teilvorhaben ?? [];
        let anlage5Hash: string | undefined;
        let anlage5Hashes: string[] | undefined;
        if (tvs.length >= 2) {
          const { proTv } = await resolveAnlagenProTv(storage.idb, ctx.key, tvs.map(t => t.tvAz));
          anlage5Hashes = [...proTv.values()].map(a => hashText(a.markdown));
        } else {
          const anlageA = await resolveAnlage5(storage.idb, ctx).catch(() => null);
          anlage5Hash = anlageA ? hashText(anlageA.markdown) : undefined;
        }
        const aktuell = {
          vbHash: korpus ? hashText(korpus.vb.markdown) : undefined,
          anlage5Hash,
          anlage5Hashes,
          verwertungHashes: korpus ? korpus.narrative.map(n => hashText(n.markdown)) : [],
        };
        if (!cancelled) setVeraltet(istVeraltet(run, aktuell));
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

> `AufbereitungContext` trägt `teilvorhaben?` seit Task 7 — der Hook nimmt `ctx: AufbereitungContext | null` und reicht es weiter; keine weitere Signaturänderung nötig.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/antraege/aufbereitung/useAufbereitung.ts
git commit -F - <<'EOF'
feat(aufbereitung): veraltet-Check pro TV im Verbund

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 9: Geteilte Präsentations-Bausteine auslagern (`zeitplanBausteine.tsx`)

**Files:**
- Create: `src/plugins/antraege/aufbereitung/zeitplanBausteine.tsx`
- Modify: `src/plugins/antraege/aufbereitung/ZeitplanTab.tsx`

`KennzahlenKarte`/`BefundZeile`/`Stat` werden aus `ZeitplanTab.tsx` **herausgelöst** in ein eigenes Modul, das sowohl `ZeitplanTab` als auch `VerbundZeitplan` importieren — **ohne Import-Zyklus**. `KennzahlenKarte` wird dabei prop-getrieben (Quelle-Name/-Hash statt `run`/`herkunft`). Präsentational — Gate = Typecheck (visuelle Gleichheit im Solo-Fall wird in Task 13 per `file://` geprüft).

- [ ] **Step 1: `zeitplanBausteine.tsx` erstellen**

```tsx
/**
 * Geteilte, präsentationale Bausteine des Zeitplan-Tabs (Kennzahlen-Karte,
 * Befund-Zeile, Stat) — von `ZeitplanTab` (Solo) UND `VerbundZeitplan` (pro TV)
 * genutzt. Eigenes Modul, um einen Import-Zyklus zwischen beiden zu vermeiden.
 */
import { StatusDot } from '@/components/ui/StatusBadge';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { befundKey } from './store';
import { summePm } from './tabellen';
import type { ApZeile, Befund } from './tabellen';

const WARN = '#f59e0b';
const INFO = 'var(--tf-text-secondary)';

export function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[11px] text-[var(--tf-text-tertiary)]">{label}</div>
      <div className="text-[13px] text-[var(--tf-text)]">{value}</div>
    </div>
  );
}

export function KennzahlenKarte({
  zeilen, quelleName, quelleHash,
}: {
  zeilen: ApZeile[];
  quelleName: string;
  quelleHash: string | null;
}): React.ReactElement {
  const gesamtPm = summePm(zeilen);
  const oberCount = zeilen.filter(z => !z.istUnterAp).length;
  const unterCount = zeilen.filter(z => z.istUnterAp).length;
  const maCount = new Set(zeilen.map(z => z.maNr).filter((m): m is string => !!m && m.trim() !== '')).size;
  const hashKurz = quelleHash ? (quelleHash.length > 6 ? `${quelleHash.slice(0, 4)}…${quelleHash.slice(-2)}` : quelleHash) : '–';

  return (
    <div className="shrink-0 w-[210px] rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="text-[13px] font-medium text-[var(--tf-text)] mb-3">Kennzahlen</div>
      <Stat label="Gesamt-PM" value={gesamtPm > 0 ? String(gesamtPm) : '–'} />
      <Stat label="APs" value={`${oberCount}${unterCount > 0 ? ` (+${unterCount} Unter-APs)` : ''}`} />
      <Stat label="Quelle" value={`${quelleName} (Hash ${hashKurz})`} />
      <Stat label="Eingesetzte MA" value={maCount > 0 ? String(maCount) : '–'} />
    </div>
  );
}

export function BefundZeile({
  befund, offen, toggle,
}: {
  befund: Befund;
  offen: boolean;
  toggle: UseAsyncActionResult<[string]>;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <StatusDot color={befund.schwere === 'warnung' ? WARN : INFO} size={7} className="mt-1.5"
        title={befund.schwere === 'warnung' ? 'Warnung' : 'Hinweis'} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[var(--tf-text)] leading-snug">{befund.text}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {befund.quellen.map((q, i) => (
            <span key={i} className="text-[10.5px] px-1.5 py-0.5 rounded text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)]"
              style={{ border: '0.5px solid var(--tf-border)' }}>
              {q.rolle === 'anlage5' ? 'Anl. 5' : q.sektionId ? `§ ${q.sektionId}` : 'Text-Projektplan'}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => toggle.run(befundKey(befund))}
        disabled={toggle.busy}
        title="wird später an Nachforderungen angebunden"
        className="shrink-0 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-50"
      >
        {offen ? '✓ Offener Punkt' : 'Als offenen Punkt übernehmen'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `ZeitplanTab.tsx` auf das neue Modul umstellen**

In `ZeitplanTab.tsx`: die lokalen `KennzahlenKarte`, `BefundZeile`, `Stat` **entfernen** und stattdessen importieren. Die nicht mehr benötigten Imports (`StatusDot`, `summePm`) aus `ZeitplanTab` entfernen, sofern sie nur diese Bausteine nutzten. `befundKey` bleibt in `ZeitplanTab` importiert (für `abweichungsNummern`/`offenePunkte.includes`). Import ergänzen:

```ts
import { KennzahlenKarte, BefundZeile } from './zeitplanBausteine';
```

- [ ] **Step 3: Solo-Aufruf von `KennzahlenKarte` prop-getrieben machen**

In `ZeitplanInhalt` den Aufruf ersetzen — Werte wie bisher aus `run`/`herkunft` berechnen, aber als Props übergeben:

```tsx
        <KennzahlenKarte
          zeilen={zeilen}
          quelleName={herkunft === 'vb' ? 'Text-Projektplan' : 'Anlage 5'}
          quelleHash={run.quellen.find(q => q.rolle === (herkunft === 'vb' ? 'vb' : 'anlage5'))?.hash ?? null}
        />
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (`ZeitplanTab` nutzt jetzt die ausgelagerten Bausteine; keine ungenutzten Imports).

- [ ] **Step 5: Commit**

```bash
git add src/plugins/antraege/aufbereitung/zeitplanBausteine.tsx src/plugins/antraege/aufbereitung/ZeitplanTab.tsx
git commit -F - <<'EOF'
refactor(aufbereitung): Zeitplan-Bausteine auslagern, KennzahlenKarte prop-getrieben

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 10: `VerbundZeitplan.tsx` (Container + `TvZeitplanSektion`)

**Files:**
- Create: `src/plugins/antraege/aufbereitung/VerbundZeitplan.tsx`

Präsentational — Gate = Typecheck + Task-13-Handprobe.

- [ ] **Step 1: Komponente erstellen**

```tsx
/**
 * Verbund-Rendering des Zeitplan-Tabs: schlanke Verbund-Summenzeile + je TV eine
 * Sektion. Hat ein TV eine Anlage 5 → Gantt/Person + Kennzahlen + Kapazitäts-Hinweise;
 * fehlt sie → Platzhalter mit direkter Drop-Zone (Anlage 5 nachreichen). Präsentational
 * über die vom Run gelieferten `TvPlan[]` — keine eigene IO.
 */
import { useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { DokumentAufnahme } from '@/core/components/DokumentAufnahme';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { GanttZeitplan } from './GanttZeitplan';
import { PersonenZeitplan } from './PersonenZeitplan';
import { KennzahlenKarte, BefundZeile } from './zeitplanBausteine';
import { verbundZeitplanSummary, befundKey } from './store';
import type { AufbereitungRun, TvPlan } from './types';
import type { Befund } from './tabellen';

interface Props {
  run: AufbereitungRun;
  teilplaene: TvPlan[];
  toggle: UseAsyncActionResult<[string]>;
  ctx: { key: string; knownIds: string[] };
  onIngested: () => void;
}

export function VerbundZeitplan({ run, teilplaene, toggle, ctx, onIngested }: Props): React.ReactElement {
  const s = verbundZeitplanSummary(teilplaene);
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2 rounded-xl px-4 py-3 text-[13px]"
        style={{ border: '0.5px solid var(--tf-border)' }}>
        <SummenWert label="Teilvorhaben" value={`${s.tvMitAnlage} / ${s.tvGesamt} mit Anlage 5`} />
        <SummenWert label="Gesamt-PM (Verbund)" value={s.summePm > 0 ? String(s.summePm) : '–'} />
        <SummenWert label="Eingesetzte MA" value={s.maAnzahl > 0 ? String(s.maAnzahl) : '–'} />
        <SummenWert label="Längster Horizont" value={s.horizont > 0 ? `M${s.horizont}` : '–'} />
      </div>

      {teilplaene.map(tp => (
        <TvZeitplanSektion
          key={tp.tvAz}
          tp={tp}
          befunde={run.befunde.filter(b => b.tvAz === tp.tvAz)}
          offenePunkte={run.offenePunkte}
          toggle={toggle}
          ctx={ctx}
          onIngested={onIngested}
        />
      ))}

      {run.anlagenOhneTv?.length ? (
        <div className="mt-4 text-[12px] text-[var(--tf-warning-text)]">
          ⚠ {run.anlagenOhneTv.length} Anlage-5-Dokument(e) ohne erkennbares TV-Förderkennzeichen im Dateinamen —
          keinem Teilvorhaben zugeordnet: {run.anlagenOhneTv.join(', ')}
        </div>
      ) : null}
    </div>
  );
}

function SummenWert({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <div className="text-[11px] text-[var(--tf-text-tertiary)]">{label}</div>
      <div className="text-[13px] text-[var(--tf-text)]">{value}</div>
    </div>
  );
}

function TvZeitplanSektion({
  tp, befunde, offenePunkte, toggle, ctx, onIngested,
}: {
  tp: TvPlan;
  befunde: Befund[];
  offenePunkte: string[];
  toggle: UseAsyncActionResult<[string]>;
  ctx: { key: string; knownIds: string[] };
  onIngested: () => void;
}): React.ReactElement {
  const [ansicht, setAnsicht] = useState<'ap' | 'person'>('ap');
  const titel = `TV ${tp.nr} — ${tp.tvAkronym ?? tp.tvAz}${tp.tvAkronym ? ` · ${tp.tvAz}` : ''}`;

  return (
    <section className="mt-8 first:mt-0">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionHeader label={titel} />
        {tp.zeitplan ? (
          <ScopeTabs
            variant="pills"
            items={[
              { key: 'ap', label: 'Nach AP' },
              { key: 'person', label: 'Nach Person' },
            ]}
            activeKey={ansicht}
            onChange={(k) => setAnsicht(k === 'person' ? 'person' : 'ap')}
            aria-label="Zeitplan-Ansicht"
          />
        ) : null}
      </div>

      {tp.zeitplan ? (
        <>
          <div className="flex gap-6 items-start flex-wrap">
            <div className="flex-1 min-w-[420px]">
              {ansicht === 'person' ? (
                <PersonenZeitplan zeilen={tp.zeitplan.zeilen} achseMax={tp.zeitplan.achseMax} quelleLabel="Anlage 5" />
              ) : (
                <GanttZeitplan zeilen={tp.zeitplan.zeilen} achseMax={tp.zeitplan.achseMax}
                  abweichungsNummern={new Set()} quelleLabel="Anlage 5" />
              )}
            </div>
            <KennzahlenKarte zeilen={tp.zeitplan.zeilen} quelleName="Anlage 5" quelleHash={tp.anlage?.hash ?? null} />
          </div>
          {befunde.length ? (
            <div className="mt-4">
              {befunde.map((b, i) => (
                <BefundZeile key={i} befund={b} offen={offenePunkte.includes(befundKey(b))} toggle={toggle} />
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-2 rounded-[10px] px-4 py-4" style={{ border: '0.5px dashed var(--tf-border)' }}>
          <p className="text-[13px] text-[var(--tf-warning-text)] mb-2">
            ⚠ Anlage 5 (Arbeitsplan) für dieses Teilvorhaben fehlt — ohne sie kein Zeitplan / keine Kapazitätsprüfung.
          </p>
          <p className="text-[12.5px] text-[var(--tf-text-secondary)] mb-2">
            Datei hier ablegen — das Förderkennzeichen wird aus dem Dateinamen erkannt.
          </p>
          <DokumentAufnahme
            relationTag={ctx.key}
            knownIds={ctx.knownIds}
            defaultTyp="arbeitsplan"
            onIngested={onIngested}
          />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/antraege/aufbereitung/VerbundZeitplan.tsx
git commit -F - <<'EOF'
feat(aufbereitung): VerbundZeitplan — pro-TV Sektionen + Summenzeile + Nachreich-Drop

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 11: `ZeitplanTab` + `AufbereitungPage` verdrahten (Verbund-Zweig)

**Files:**
- Modify: `src/plugins/antraege/aufbereitung/ZeitplanTab.tsx`
- Modify: `src/plugins/antraege/aufbereitung/AufbereitungPage.tsx`

- [ ] **Step 1: `ZeitplanTab` um Props + Verbund-Zweig erweitern**

Props-Interface ergänzen:

```ts
interface Props {
  run: AufbereitungRun | null;
  loading: boolean;
  neu: UseAsyncActionResult<[]>;
  toggle: UseAsyncActionResult<[string]>;
  /** Für die Nachreich-Drop-Zone der fehlenden TV-Anlagen (Verbund). */
  ctx: { key: string; knownIds: string[] };
  onIngested: () => void;
}
```

Import ergänzen:

```ts
import { VerbundZeitplan } from './VerbundZeitplan';
```

Im Render (nach dem `loading`-Guard, VOR dem `!run`-Zweig) den Verbund-Fall abfangen:

```tsx
  if (run?.teilplaene) {
    return (
      <div>
        {neu.error ? (
          <div className="mb-4 rounded-lg px-3 py-2 text-[13px] text-[var(--tf-danger-text)]"
            style={{ border: '0.5px solid var(--tf-border)' }}>
            Fehler bei der Aufbereitung: {neu.error}
          </div>
        ) : null}
        <VerbundZeitplan run={run} teilplaene={run.teilplaene} toggle={toggle} ctx={ctx} onIngested={onIngested} />
      </div>
    );
  }
```

Signatur der Funktion um die neuen Props erweitern: `export function ZeitplanTab({ run, loading, neu, toggle, ctx, onIngested }: Props)`.

- [ ] **Step 2: `AufbereitungPage` reicht `ctx`/`onIngested` durch**

Den `ZeitplanTab`-Aufruf ersetzen:

```tsx
        {tab === 'zeitplan' ? (
          <ZeitplanTab
            run={aufb.run}
            loading={aufb.loading}
            neu={aufb.neu}
            toggle={aufb.toggle}
            ctx={{ key: ctx.key, knownIds: ctx.knownIds }}
            onIngested={aufb.requestRecompute}
          />
        ) : tab === 'steckbrief' ? (
```

Und den Aufbereitungs-Kontext um `teilvorhaben` erweitern — der `useAufbereitung`-Aufruf:

```tsx
  const aufb = useAufbereitung(
    ctx ? {
      key: ctx.key,
      knownIds: ctx.knownIds,
      teilvorhaben: tvs.map((tv, i) => ({
        nr: i + 1,
        tvAz: tv.aktenzeichen,
        akronym: typeof tv.akronym === 'string' && tv.akronym.trim() ? tv.akronym.trim() : null,
        titel: typeof tv.titel === 'string' && tv.titel.trim() ? tv.titel.trim() : null,
      })),
    } : null,
  );
```

> `tvs` ist bereits in `AufbereitungPage` vorhanden (`const { verbund, antraege: tvs } = useVerbundDetailData(...)`), lead-first sortiert. `tv.akronym`/`tv.titel` sind `unknown` auf dem strukturellen Typ → defensiv prüfen.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/antraege/aufbereitung/ZeitplanTab.tsx src/plugins/antraege/aufbereitung/AufbereitungPage.tsx
git commit -F - <<'EOF'
feat(aufbereitung): Zeitplan-Tab rendert Verbund pro TV (teilvorhaben im Kontext)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 12: `QuellenPanel` — pro-TV Anlage-5-Zeilen

**Files:**
- Modify: `src/plugins/antraege/aufbereitung/QuellenPanel.tsx`

- [ ] **Step 1: Pro-TV-Zeilen rendern, wenn `teilplaene` vorhanden**

Im `QuellenPanel` den Anlage-5-Block verbund-bewusst machen. Nach dem Auslesen der Quellen ergänzen:

```tsx
  const teilplaene = run?.teilplaene ?? null;
```

Und die einzelne „Arbeitsplan / Anlage 5"-Zeile durch eine Fallunterscheidung ersetzen:

```tsx
          {teilplaene ? (
            <>
              {teilplaene.map(tp => (
                <QuelleZeile
                  key={tp.tvAz}
                  label={`Anlage 5 — TV ${tp.nr} (${tp.tvAkronym ?? tp.tvAz})`}
                  name={tp.anlage?.name ?? null}
                  fehltHinweis="fehlt — ohne sie kein Zeitplan für dieses TV"
                  warnen={!tp.anlage}
                />
              ))}
              {run?.anlagenOhneTv?.length ? (
                <QuelleZeile
                  label="Anlage 5 — ohne TV-Zuordnung"
                  name={run.anlagenOhneTv.join(', ')}
                  fehltHinweis=""
                />
              ) : null}
            </>
          ) : (
            <QuelleZeile
              label="Arbeitsplan / Anlage 5"
              name={anlageQuelle?.name ?? null}
              fehltHinweis="fehlt — ohne sie kein Zeitplan / keine Kapazitätsprüfung"
              warnen={anlageFehlt}
            />
          )}
```

> `anlageQuelle`/`anlageFehlt` bleiben für den Solo-Zweig. Der `anlageFehlt`-getriggerte Auto-Öffnen der Aufnahme (`aufnahmeSichtbar`) bleibt unverändert — im Verbund kann `anlageFehlt` `false` sein (kein Single-`anlage5`-Quelleneintrag), die Nachreich-Drop-Zone steckt dann pro TV im Zeitplan-Tab; die manuelle „Dokument hinzufügen"-Option im Panel bleibt zusätzlich verfügbar.

- [ ] **Step 2: Kollaps-Zusammenfassung (Kopfzeile) verbund-bewusst**

Die eingeklappte Zusammenfassung (`!offen`-Block) so anpassen, dass sie im Verbund die TV-Abdeckung zeigt:

```tsx
        {!offen && (
          <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)]">
            VB {vbQuelle ? '✓' : '–'}
            {teilplaene
              ? ` · Anlage 5 ${teilplaene.filter(t => t.anlage).length}/${teilplaene.length} TV`
              : ` · Anlage 5 ${anlageQuelle ? '✓' : '–'}`}
            {marketingNamen.length ? ` · Marketing ✓` : ''}
          </span>
        )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/antraege/aufbereitung/QuellenPanel.tsx
git commit -F - <<'EOF'
feat(aufbereitung): Quellen-Panel zeigt Anlage 5 pro Teilvorhaben im Verbund

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 13: Doku, Version, Gesamt-Verifikation

**Files:**
- Modify: `docs/architecture/antrag-aufbereitung.md`
- Modify: `docs/feedback-kontext/antraege.md`
- Modify: `CHANGELOG.md`, `src/core/components/changelog/changelog-user.md`, `package.json`

- [ ] **Step 1: Architektur-Doc ergänzen**

In `docs/architecture/antrag-aufbereitung.md` einen Abschnitt „Anlage 5 pro Teilvorhaben (Verbund)" ergänzen (Ist-Zustand-Regel): Verbund (≥2 TV) → `run.teilplaene` mit pro-TV Anlage-5-Ernte (Gantt + Kapazität), Verbund-Summenzeile, fehlende Anlage 5 pro TV mit Nachreich-Drop; Solo unverändert (Single-`zeitplan` + Text-Abgleich); TV-Zuordnung deterministisch aus dem Dateinamen (`matchTvAusDateiname`/`resolveAnlagenProTv`, IDB-only); additiv (`version` bleibt 1); `run.befunde` bleibt einzige Befund-Liste (pro-TV Kapazität mit `tvAz`).

- [ ] **Step 2: feedback-kontext via Skill nachziehen**

Die `feedback-kontext-pflege`-Skill aufrufen und `docs/feedback-kontext/antraege.md` prüfen/aktualisieren (sichtbare UI-Änderung: pro-TV Zeitplan-Sektionen, Verbund-Summenzeile, pro-TV Quellen-Zeilen). Budget ≤ 2500 Zeichen beachten (Guard).

- [ ] **Step 3: Version + Changelog**

`package.json` `version` auf `2.244.0` (MINOR). `CHANGELOG.md` (append, chronologisch absteigend) + `src/core/components/changelog/changelog-user.md` (nutzerfreundliche Fassung) je einen v2.244.0-Block:

- CHANGELOG.md (technisch): „Antrag-Aufbereitung: Anlage 5 pro Teilvorhaben — Verbund zeigt pro TV eine eigene Gantt-Sektion (+Kapazität) aus dessen Anlage 5, Verbund-Summenzeile, fehlende Anlage 5 pro TV mit Nachreich-Drop-Zone; TV-Zuordnung deterministisch aus dem Dateinamen; additiv (`teilplaene`/`QuelleRef.tvAz`/`Befund.tvAz`), Solo unverändert."
- changelog-user.md: „Bei Verbundprojekten zeigt die Antrags-Aufbereitung jetzt für jedes Teilvorhaben seinen eigenen Zeitplan aus der jeweiligen Anlage 5 — mit Gesamtübersicht oben. Fehlt für ein Teilvorhaben die Anlage 5, kannst du sie direkt an Ort und Stelle nachreichen."

- [ ] **Step 4: Vollständige Verifikation**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm test`
Expected: PASS (gesamte Suite grün — die Solo-Regressions-Tests inklusive).

Run: `npm run build:dev && npm run build:pl`
Expected: beide Builds erfolgreich (`dist-single/dev/zah-dev.html`, `dist-single/zah-pl.html`).

- [ ] **Step 5: `file://`-Handprobe (dev-Build)**

`dist-single/dev/zah-dev.html` per Doppelklick öffnen (SMB-Onboarding), einen **Verbund mit ≥2 TV** öffnen → Aufbereitung. Prüfen:
1. 2–3 Anlage-5-Dateien (TV-FKZ im Namen) im Quellen-Panel/Zeitplan-Tab ablegen → pro TV eine Sektion mit eigenem Gantt + Kapazität; Verbund-Summenzeile stimmig.
2. Für ein TV keine Anlage 5 → Sektion „Anlage 5 fehlt" mit Drop-Zone; Nachreichen → Auto-Recompute füllt die Sektion.
3. Datei ohne TV-FKZ ablegen → „ohne TV-Zuordnung"-Hinweis (kein stilles Verschwinden).
4. Gegenprobe: Einzelantrag (1 TV) → unverändert (eine Sektion, Text-vs-Anlage-5-Abgleich vorhanden).

- [ ] **Step 6: Commit (Doku + Version)**

```bash
git add docs/architecture/antrag-aufbereitung.md docs/feedback-kontext/antraege.md CHANGELOG.md src/core/components/changelog/changelog-user.md package.json
git commit -F - <<'EOF'
docs(aufbereitung): Anlage 5 pro Teilvorhaben — Doku + Changelog (v2.244.0)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Selbst-Review (nach dem Schreiben, vor der Umsetzung)

- **Spec-Abdeckung:** pro-TV Gantt (Task 5/10) · Kapazität pro TV (Task 5) · Verbund-Summenzeile (Task 4/10) · fehlende Anlage 5 mit Nachreich-Drop (Task 10) · TV-Zuordnung aus Dateiname (Task 2/3) · Solo unverändert inkl. Text-Abgleich (Task 5 Regressions-Test) · Quellen-Panel pro TV (Task 12) · additiv/`version` 1 (Task 1) · `run.befunde` einzige Liste (Task 5) · Doku/feedback-kontext/Version (Task 13). ✅
- **Typ-Konsistenz:** `TvPlan`, `TvEingang`, `VerbundEingang`, `AnlagenProTvErgebnis`, `VerbundSummary` einheitlich benannt; `baueRun(...now, verbund?)` überall gleich; `KennzahlenKarte({zeilen, quelleName, quelleHash})`/`BefundZeile` in Task 9 in `zeitplanBausteine.tsx` definiert und in Task 10 (VerbundZeitplan) + `ZeitplanTab` von dort importiert; `matchTvAusDateiname`/`resolveAnlagenProTv`/`verbundZeitplanSummary` Signaturen konsistent zwischen Definition und Aufruf.
- **Kein Import-Zyklus:** geteilte Bausteine liegen in `zeitplanBausteine.tsx`; `ZeitplanTab` → `VerbundZeitplan` → `zeitplanBausteine` ist azyklisch (keine Rück-Kante `VerbundZeitplan` → `ZeitplanTab`).
- **Scope-Grenzen honoriert:** LLM-Bausteine unberührt · kein Tagging-Umbau/Migration · kein neuer IDB-Store · resolveAnlagenProTv IDB-only (dokumentiert).
```
