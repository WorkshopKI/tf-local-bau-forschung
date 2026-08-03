# Einfache ZIP-Aufnahme + Batch-Generierung von Gutachten-Entwürfen — Implementierungsplan

> **Für agentische Worker:** Pflicht-Sub-Skill: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, Task für Task. Schritte als Checkbox (`- [ ]`).
>
> **Zwei Teile, NACHEINANDER.** Teil A komplett + Zwischenabnahme **STOP**, dann Teil B. Teil B setzt auf der von Teil A erzeugten Dateiablage auf.

**Goal:** Ein Gutachter nimmt seine Antrags-ZIPs als Markdown in seinen persönlichen Ordner auf (Teil A) und erzeugt anschließend für ~10 Anträge sequenziell Gutachten-**Entwürfe** über den bestehenden Workflow-Runner (Teil B) — nur Entwürfe, Freigaben bleiben Handarbeit.

**Architecture:** Teil A ist ein rein dateibasierter Flow (jszip → `DocConverter` → `atomicWrite` in den persönlichen Ordner), **kein** LLM/Index/Triage, **kein** Schreiben in IDB außer trivialem UI-Zustand. Teil B ist eine dünne, sequenzielle Schleife um den vorhandenen `runSkill` + die reinen Runner-Reducer (`applyGeneration` → `putWorkflowRun`); pro Antrag Abschnitte A oder A–G in Definitionsreihenfolge, mit injizierbarer „Abschnitt-erzeugen"-Abhängigkeit (Tests ohne LLM). Beide Teile teilen die Ordnerstruktur über **eine** Layout-Datei.

**Tech Stack:** React 19 + TS strict, Zustand (UI-Zustand), `jszip` (vorhanden), `DocConverter`, `atomicWrite`/`getPersoenlichHandle` (Infrastructure), `runSkill`/Skill-Registry/`applyGeneration`/`putWorkflowRun` (Gutachten-Workflow), `bridge.getActiveTransport()` (AI). **Keine neuen Dependencies.** Deutsch. DESIGN_GUIDE strikt.

---

## 0. Pre-Flight — Entscheidungen & Abweichungen von der Spec

Drei Spec-Annahmen über „vorhandene Bausteine" stimmen mit dem Code nicht überein. Auflösung (mit dem User abgestimmt):

| # | Spec-Annahme | Realität | Auflösung |
|---|---|---|---|
| D1 | „zentrale Transport-Policy mit `enthaeltDokumentInhalte`" existiert | Existiert nicht. Einzellauf nutzt direkt `bridge.getActiveTransport()`; Prod sperrt externe Provider per `validateConfig`. | **Teil B nutzt `bridge.getActiveTransport()` exakt wie der Einzellauf** — kein neuer Policy-Code, keine eigene Transportwahl. Status/Modellname über `getActiveProviderName()` + `transport.name` + `transport.ping()`. |
| D2 | Datei-Spiegelung nach `antraege/{FKZ}/gutachten/` passiert „am bestehenden Runner-Persistenzpunkt" | Kein Disk-Spiegel; `WorkflowRun` liegt nur in IDB (`gutachten-workflow:<az>`). Spiegel am geteilten Punkt würde Einzellauf ändern (STOPP). | **Batch-lokaler Spiegel:** NUR die Batch-Schleife schreibt nach jedem persistierten Abschnitt den Entwurf zusätzlich als `.md` (Einzellauf unverändert). |
| D3 | `mockup-batch-upload/triage/generierung` als Design-Referenz | Nicht im Repo. | UI aus DESIGN_GUIDE + Spec-Text (reduzierte Liste, Start-Dialog, Monitor). |

**D4 — Ordner-Basis:** Die Spec-Ordnerstruktur zeigt `antraege/` und `eingang/` auf Wurzel-Ebene. Der persönliche Ordner ist aber durchgängig unter `ZAH/` genamespaced (`ZAH/gutachten/…`, `ZAH/skill-tweaks.json`, `ensurePersoenlichFolders` legt `ZAH/` an). **Wir nesten konsistent unter `ZAH/`:** `ZAH/antraege/{FKZ}/…`, `ZAH/eingang/…`. (Bei Einwand des Users: Basis-Konstante in `personal-layout.ts` auf `''` setzen — Single Point of Change.)

**D5 — `quelle`-Parameter:** Ein bestehender Test (`gutachten/__tests__/context-provider.test.ts:54`) ruft `buildVorherigeAbschnitte(run,'B',ZIM_EP_WORKFLOW,200)` mit `capPerSection` als 4. Positions-Arg. Daher kommt `quelle` als **5. Positions-Parameter** (`quelle: 'freigegeben' | 'entwurf' = 'freigegeben'`) — nicht als Options-Objekt. Default `'freigegeben'` ⇒ Einzellauf byte-identisch.

**Keine STOPP-Eskalation nötig:** `personal-storage` kann verschachtelt anlegen/schreiben (`atomicWrite` mit `navigateToDir(create:true)`); die `vorherigeAbschnitte`-Quelle ist ohne Einzellauf-Änderung per Parameter steuerbar (D5); der Disk-Spiegel erfordert keinen Runner-Eingriff (D2 batch-lokal).

---

## 1. Source-Tree (beide Teile)

```
src/core/services/personal-storage/
  personal-layout.ts            (NEU) Pfad-Konstanten/Helfer — Single Source für ZAH/antraege + ZAH/eingang
  antraege-eingang.ts           (NEU) FS-Schreiber: Dokument-MD, Eingang-ZIP, Manifest, Löschen, Auflisten, VB-aus-Ordner

src/plugins/antraege/aufnahme-einfach/                (TEIL A)
  types.ts                      (NEU) Flow-Typen (IntakeFile, AufnahmeStatus …)
  dateiTyp.ts                   (NEU) statische Keyword→Typ-Map (pure)
  frontmatter.ts                (NEU) Frontmatter bauen/parsen (pure)
  manifest.ts                   (NEU) Manifest-Schema + Löschbar-Logik (pure)
  zip-durchlauf.ts              (NEU) jszip flach durchlaufen + Skip/Reject-Regeln
  useAufnahmeUiStore.ts         (NEU) trivialer Zustand-Store {open, toggle}
  useAufnahme.ts                (NEU) Orchestrator-Hook (Parse → Liste → Konvertieren&Ablegen)
  AufnahmeOverlay.tsx           (NEU) Overlay-Hülle (Dialog) — hält Panel + (später) Batch
  AufnahmePanel.tsx             (NEU) Drop-Fläche + Liste + Bestandsblock + Abschluss
  AufnahmeZeile.tsx             (NEU) eine Datei-Zeile (FKZ-Chip, Typ-Pills, Status)
  BestandsBlock.tsx             (NEU) ZIP-Bestand mit Löschbarkeit
  AbschlussPanel.tsx            (NEU) Zusammenfassung + Einstieg Teil B
  index.ts                      (NEU) Barrel

src/plugins/antraege/kurzfassung/
  context-builder.ts            (NEU) buildKurzfassungContext(verbund, antraege, headerId) — aus VerbundDetail extrahiert
  vbDokument.ts                 (MOD) + resolveVb(idb, persHandle, ctx) — IDB-VORRANG, Ordner-Fallback (A4)

src/plugins/antraege/gutachten/
  context-provider.ts           (MOD) buildVorherigeAbschnitte: 5. Param `quelle` + „(Entwurf)"-Marker
  useGutachtenWorkflow.ts       (MOD) VB-Auflösung via resolveVb (additiver Fallback)

src/core/services/gutachten-batch/                    (TEIL B)
  types.ts                      (NEU) BatchJob, BatchEintrag, Status-Enums
  batch-store.ts                (NEU) IDB-Persistenz (kv `gutachten-batch:aktiv`)
  job-state.ts                  (NEU) reine Zustandsübergänge auf BatchJob
  mengen.ts                     (NEU) Mengen-/Ausschluss-Berechnung (pure)
  gutachten-mirror.ts           (NEU) batch-lokaler Disk-Spiegel (.md)
  runner.ts                     (NEU) sequenzielle Schleife mit injizierbaren Deps
  index.ts                      (NEU) Barrel

src/plugins/antraege/gutachten-batch/                 (TEIL B UI)
  useBatchJob.ts                (NEU) Hook: reale Deps + Runner antreiben + Resume
  StartDialog.tsx               (NEU) Mengen, Abschnitts-Pills, Transport-Status, Start
  BatchMonitor.tsx              (NEU) Live-Status-Zeilen + Pausieren/Fortsetzen/Abbrechen
  index.ts                      (NEU) Barrel

src/plugins/antraege/
  AntraegeHeader.tsx            (MOD) Button „Dokumente aufnehmen" (flag-gated)
  AntraegePage.tsx              (MOD) AufnahmeOverlay rendern (flag-gated)
  VerbundDetail.tsx             (MOD) Kontext-Bau via context-builder (verhaltensgleiche Extraktion)
```

**Gating:** Alles hinter `isGutachtenWorkflowEnabled()` (dev-only, existiert bereits). Kein neues Plugin, kein Routing, kein neues Feature-Flag.

---

# TEIL A — Dokument-Aufnahme (ZIP → Markdown)

## Task A0: Shared — `personal-layout.ts` (Pfad-Layout)

**Files:**
- Create: `src/core/services/personal-storage/personal-layout.ts`
- Test: `src/core/services/personal-storage/__tests__/personal-layout.test.ts`

- [ ] **A0.1 Test schreiben** (`personal-layout.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import {
  dokumenteDir, dokumentMdPath, gutachtenMdPath, eingangZipPath, eingangManifestPath,
  mdFilename, sanitizeSegment,
} from '../personal-layout';

describe('personal-layout', () => {
  it('nestet unter ZAH/', () => {
    expect(dokumenteDir('16EP001234')).toBe('ZAH/antraege/16EP001234/dokumente');
    expect(eingangZipPath('paket')).toBe('ZAH/eingang/paket.zip');
    expect(eingangManifestPath('paket')).toBe('ZAH/eingang/paket.manifest.json');
  });
  it('mdFilename ersetzt nur die Endung, behält den Stamm', () => {
    expect(mdFilename('Vorhabensbeschreibung.pdf')).toBe('Vorhabensbeschreibung.md');
    expect(mdFilename('Anlage 3.DOCX')).toBe('Anlage 3.md');
    expect(mdFilename('ohne-endung')).toBe('ohne-endung.md');
  });
  it('sanitiert unzulässige Pfadzeichen', () => {
    expect(sanitizeSegment('a/b:c\\d*?')).toBe('a_b_c_d__');
    expect(mdFilename('te/st.pdf')).toBe('te_st.md');
  });
  it('gutachtenMdPath: {stepId}-{slug}.md', () => {
    expect(gutachtenMdPath('16EP001234', 'A', 'kurzfassung')).toBe(
      'ZAH/antraege/16EP001234/gutachten/A-kurzfassung.md');
  });
});
```

- [ ] **A0.2 Run → FAIL** (`npm run test -- personal-layout`) — „Cannot find module".

- [ ] **A0.3 Implementieren**

```ts
/**
 * EINZIGE Quelle für das Layout des persönlichen Antrags-/Eingang-Bereichs.
 * Alles unter dem bestehenden `ZAH/`-Namespace (D4). Von Teil A (Dokumente,
 * Eingang) UND Teil B (Gutachten-Spiegel) genutzt — nirgends Pfade verstreuen.
 */
import { PERSOENLICH_ZAH_DIR } from '@/core/services/infrastructure/types';

const BASE = PERSOENLICH_ZAH_DIR; // 'ZAH'

/** Ersetzt alles außer Wort-/Punkt-/Leer-/Bindestrich-Zeichen durch '_'. */
export function sanitizeSegment(s: string): string {
  return s.replace(/[^\p{L}\p{N}._ -]/gu, '_');
}

/** Original-Stamm behalten, Endung durch `.md` ersetzen, Segment sanitisieren. */
export function mdFilename(originalName: string): string {
  const dot = originalName.lastIndexOf('.');
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${sanitizeSegment(stem)}.md`;
}

export const antragDir = (fkz: string): string => `${BASE}/antraege/${sanitizeSegment(fkz)}`;
export const dokumenteDir = (fkz: string): string => `${antragDir(fkz)}/dokumente`;
export const dokumentMdPath = (fkz: string, originalName: string): string =>
  `${dokumenteDir(fkz)}/${mdFilename(originalName)}`;
export const gutachtenDir = (fkz: string): string => `${antragDir(fkz)}/gutachten`;
export const gutachtenMdPath = (fkz: string, stepId: string, slug: string): string =>
  `${gutachtenDir(fkz)}/${sanitizeSegment(stepId)}-${sanitizeSegment(slug)}.md`;

export const EINGANG_DIR = `${BASE}/eingang`;
export const eingangZipPath = (zipname: string): string => `${EINGANG_DIR}/${sanitizeSegment(zipname)}.zip`;
export const eingangManifestPath = (zipname: string): string =>
  `${EINGANG_DIR}/${sanitizeSegment(zipname)}.manifest.json`;
```

> **Hinweis:** `PERSOENLICH_ZAH_DIR` aus `infrastructure/types.ts` bestätigen (= `'ZAH'`). Falls dort nicht exportiert, Konstante lokal mit Kommentar spiegeln.

- [ ] **A0.4 Run → PASS.** **A0.5 Commit:** `feat(aufnahme): personal-layout Pfad-Helfer (ZAH/antraege, ZAH/eingang)`

---

## Task A1: `dateiTyp.ts` — Typ-Vorschlag aus Dateiname (pure)

**Files:** Create `src/plugins/antraege/aufnahme-einfach/dateiTyp.ts`; Test `…/__tests__/dateiTyp.test.ts`

- [ ] **A1.1 Test**

```ts
import { describe, it, expect } from 'vitest';
import { typVorschlag, AUFNAHME_TYPEN, type AufnahmeTyp } from '../dateiTyp';

describe('typVorschlag', () => {
  it('vorhabensbeschreibung / vb', () => {
    expect(typVorschlag('Vorhabensbeschreibung_16EP.pdf')).toBe('vorhabensbeschreibung');
    expect(typVorschlag('16EP001234-VB.docx')).toBe('vorhabensbeschreibung');
  });
  it('teilvorhaben / tvb', () => {
    expect(typVorschlag('Teilvorhabenbeschreibung TV2.pdf')).toBe('teilvorhabensbeschreibung');
    expect(typVorschlag('tvb_partnerB.docx')).toBe('teilvorhabensbeschreibung');
  });
  it('stellungnahme', () => {
    expect(typVorschlag('Stellungnahme_Gutachter.pdf')).toBe('stellungnahme');
  });
  it('unklar als Fallback', () => {
    expect(typVorschlag('Anlage 3.pdf')).toBe('unklar');
  });
  it('trenner-/case-tolerant', () => {
    expect(typVorschlag('16EP__VORHABENS-BESCHREIBUNG.PDF')).toBe('vorhabensbeschreibung');
  });
  it('AUFNAHME_TYPEN enthält genau die vier Werte', () => {
    expect(AUFNAHME_TYPEN).toEqual<AufnahmeTyp[]>(
      ['vorhabensbeschreibung', 'teilvorhabensbeschreibung', 'stellungnahme', 'unklar']);
  });
});
```

- [ ] **A1.2 Run → FAIL.** **A1.3 Implementieren**

```ts
/**
 * Dateiname-basierter Typ-Vorschlag (statisch, KEIN Inhaltssignal). Zulässig,
 * weil die Dateien vom User selbst benannt/exportiert sind. Reihenfolge zählt:
 * TVB vor VB (sonst fängt „vb" in „teilvorhaben…" nicht). Trennzeichen werden
 * entfernt, damit „Vorhabens-Beschreibung" / „vorhabens_beschreibung" greifen.
 */
export type AufnahmeTyp = 'vorhabensbeschreibung' | 'teilvorhabensbeschreibung' | 'stellungnahme' | 'unklar';

export const AUFNAHME_TYPEN: AufnahmeTyp[] =
  ['vorhabensbeschreibung', 'teilvorhabensbeschreibung', 'stellungnahme', 'unklar'];

export const AUFNAHME_TYP_LABEL: Record<AufnahmeTyp, string> = {
  vorhabensbeschreibung: 'Vorhabensbeschreibung',
  teilvorhabensbeschreibung: 'Teilvorhabensbeschreibung',
  stellungnahme: 'Stellungnahme',
  unklar: 'unklar',
};

/** Keyword → Typ, in Prüf-Reihenfolge (spezifisch vor allgemein). */
const REGELN: ReadonlyArray<{ keys: string[]; typ: AufnahmeTyp }> = [
  { keys: ['teilvorhaben', 'tvb'], typ: 'teilvorhabensbeschreibung' },
  { keys: ['vorhabensbeschreibung', 'vb'], typ: 'vorhabensbeschreibung' },
  { keys: ['stellungnahme'], typ: 'stellungnahme' },
];

export function typVorschlag(filename: string): AufnahmeTyp {
  const norm = filename.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const { keys, typ } of REGELN) {
    if (keys.some(k => norm.includes(k))) return typ;
  }
  return 'unklar';
}
```

> „vb"-Match nach Normalisierung: `16EP001234-VB.docx` → `16ep001234vbdocx` enthält `vb`. „teilvorhaben" wird zuerst geprüft, damit TVB nicht fälschlich als VB klassifiziert wird.

- [ ] **A1.4 Run → PASS.** **A1.5 Commit:** `feat(aufnahme): Dateiname-Typ-Vorschlag (statische Keyword-Map)`

---

## Task A2: `frontmatter.ts` — YAML-Frontmatter bauen/parsen (pure)

**Files:** Create `…/frontmatter.ts`; Test `…/__tests__/frontmatter.test.ts`

- [ ] **A2.1 Test**

```ts
import { describe, it, expect } from 'vitest';
import { buildMarkdownMitFrontmatter, parseFrontmatter } from '../frontmatter';

describe('frontmatter', () => {
  const meta = { fkz: '16EP001234', typ: 'vorhabensbeschreibung' as const,
    quelle: 'VB.pdf', konvertiert_am: '2026-06-11T10:00:00.000Z' };

  it('baut Frontmatter + Inhalt', () => {
    const md = buildMarkdownMitFrontmatter(meta, '# Titel\n\nText');
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toContain('fkz: 16EP001234');
    expect(md).toContain('typ: vorhabensbeschreibung');
    expect(md).toContain('quelle: VB.pdf');
    expect(md.endsWith('# Titel\n\nText')).toBe(true);
  });

  it('round-trip: parse liest die Meta zurück', () => {
    const md = buildMarkdownMitFrontmatter(meta, 'Body');
    const parsed = parseFrontmatter(md);
    expect(parsed?.meta).toEqual(meta);
    expect(parsed?.body).toBe('Body');
  });

  it('Werte mit Doppelpunkt werden gequotet', () => {
    const md = buildMarkdownMitFrontmatter({ ...meta, quelle: 'a: b.pdf' }, 'x');
    expect(parseFrontmatter(md)?.meta.quelle).toBe('a: b.pdf');
  });

  it('ohne Frontmatter → null', () => {
    expect(parseFrontmatter('# nur Inhalt')).toBeNull();
  });
});
```

- [ ] **A2.2 Run → FAIL.** **A2.3 Implementieren**

```ts
import type { AufnahmeTyp } from './dateiTyp';

export interface DokumentMeta {
  fkz: string;
  typ: AufnahmeTyp;
  quelle: string;          // Originaldateiname
  konvertiert_am: string;  // ISO
}

const KEYS: (keyof DokumentMeta)[] = ['fkz', 'typ', 'quelle', 'konvertiert_am'];

function quote(v: string): string {
  // Minimal-YAML: nur quoten, wenn nötig (führende/anhängende Spaces, : , # " ).
  return /[:#"]|^\s|\s$/.test(v) ? JSON.stringify(v) : v;
}
function unquote(v: string): string {
  const t = v.trim();
  return t.startsWith('"') && t.endsWith('"') ? JSON.parse(t) as string : t;
}

export function buildMarkdownMitFrontmatter(meta: DokumentMeta, body: string): string {
  const lines = ['---'];
  for (const k of KEYS) lines.push(`${k}: ${quote(String(meta[k]))}`);
  lines.push('---', '');
  return `${lines.join('\n')}${body}`;
}

export interface ParsedDokument { meta: DokumentMeta; body: string; }

export function parseFrontmatter(md: string): ParsedDokument | null {
  if (!md.startsWith('---\n')) return null;
  const end = md.indexOf('\n---', 4);
  if (end < 0) return null;
  const block = md.slice(4, end);
  const body = md.slice(end + 4).replace(/^\n/, '');
  const meta: Partial<DokumentMeta> = {};
  for (const line of block.split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim() as keyof DokumentMeta;
    if ((KEYS as string[]).includes(key)) meta[key] = unquote(line.slice(i + 1)) as never;
  }
  if (!meta.fkz || !meta.typ || !meta.quelle || !meta.konvertiert_am) return null;
  return { meta: meta as DokumentMeta, body };
}
```

- [ ] **A2.4 Run → PASS.** **A2.5 Commit:** `feat(aufnahme): Frontmatter bauen/parsen für aufgenommene .md`

---

## Task A3: `manifest.ts` — Manifest-Schema + Löschbar-Logik (pure)

**Files:** Create `…/manifest.ts`; Test `…/__tests__/manifest.test.ts`

- [ ] **A3.1 Test**

```ts
import { describe, it, expect } from 'vitest';
import { leeresManifest, setDateiStatus, istLoeschbar, zusammenfassung } from '../manifest';

describe('manifest', () => {
  it('löschbar erst bei Vollständigkeit', () => {
    let m = leeresManifest('paket', ['a.pdf', 'b.pdf']);
    expect(istLoeschbar(m)).toBe(false);
    m = setDateiStatus(m, 'a.pdf', 'konvertiert');
    expect(istLoeschbar(m)).toBe(false);
    m = setDateiStatus(m, 'b.pdf', 'konvertiert');
    expect(istLoeschbar(m)).toBe(true);
  });
  it('übersprungene zählen als „fertig" für Löschbarkeit', () => {
    let m = leeresManifest('p', ['a.pdf', 'b.doc']);
    m = setDateiStatus(m, 'a.pdf', 'konvertiert');
    m = setDateiStatus(m, 'b.doc', 'uebersprungen');
    expect(istLoeschbar(m)).toBe(true);
  });
  it('fehlgeschlagene blocken Löschbarkeit NICHT (manuell entscheidbar)', () => {
    let m = leeresManifest('p', ['a.pdf']);
    m = setDateiStatus(m, 'a.pdf', 'fehlgeschlagen');
    expect(istLoeschbar(m)).toBe(true); // kein „offen" mehr
  });
  it('offen (noch nicht verarbeitet) blockt', () => {
    const m = leeresManifest('p', ['a.pdf', 'b.pdf']);
    expect(zusammenfassung(m)).toEqual({ gesamt: 2, konvertiert: 0, fehlgeschlagen: 0, uebersprungen: 0, offen: 2 });
  });
});
```

- [ ] **A3.2 Run → FAIL.** **A3.3 Implementieren**

```ts
export type DateiStatus = 'offen' | 'konvertiert' | 'fehlgeschlagen' | 'uebersprungen';

export interface ManifestDatei { name: string; status: DateiStatus; }
export interface EingangManifest {
  zipname: string;
  erstellt_am?: string;
  dateien: ManifestDatei[];
  schemaVersion: 1;
}

export function leeresManifest(zipname: string, namen: string[]): EingangManifest {
  return { zipname, dateien: namen.map(name => ({ name, status: 'offen' })), schemaVersion: 1 };
}

export function setDateiStatus(m: EingangManifest, name: string, status: DateiStatus): EingangManifest {
  return { ...m, dateien: m.dateien.map(d => (d.name === name ? { ...d, status } : d)) };
}

/** Löschbar, sobald KEINE Datei mehr `offen` ist (alle verarbeitet — auch fehlgeschlagene/übersprungene). */
export function istLoeschbar(m: EingangManifest): boolean {
  return m.dateien.length > 0 && m.dateien.every(d => d.status !== 'offen');
}

export function zusammenfassung(m: EingangManifest): {
  gesamt: number; konvertiert: number; fehlgeschlagen: number; uebersprungen: number; offen: number;
} {
  const z = { gesamt: m.dateien.length, konvertiert: 0, fehlgeschlagen: 0, uebersprungen: 0, offen: 0 };
  for (const d of m.dateien) {
    if (d.status === 'konvertiert') z.konvertiert++;
    else if (d.status === 'fehlgeschlagen') z.fehlgeschlagen++;
    else if (d.status === 'uebersprungen') z.uebersprungen++;
    else z.offen++;
  }
  return z;
}
```

> Spec A2: Löschen erst bei „alle X Dateien konvertiert". Hier interpretiert als „nichts mehr offen" — fehlgeschlagene/übersprungene blockieren nicht ewig (sonst nie löschbar). UI-Label unterscheidet „alle konvertiert ✓" vs „mit Fehlern verarbeitet".

- [ ] **A3.4 Run → PASS.** **A3.5 Commit:** `feat(aufnahme): Eingang-Manifest + Löschbar-Logik`

---

## Task A4: `zip-durchlauf.ts` — jszip flach durchlaufen + Skip/Reject

**Files:** Create `…/zip-durchlauf.ts`; Test `…/__tests__/zip-durchlauf.test.ts`

Referenz-API (vorhanden, `fill-template.ts`): `const { default: JSZip } = await import('jszip'); const zip = await JSZip.loadAsync(blob); zip.file('pfad')?.async('blob')`. Einträge: `zip.forEach((path, entry) => …)`, `entry.dir`, `entry.async('blob')`.

- [ ] **A4.1 Test** (baut ein ZIP zur Laufzeit mit jszip)

```ts
import { describe, it, expect } from 'vitest';
import { zipDurchlauf } from '../zip-durchlauf';

async function makeZip(files: Record<string, string>): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const [p, c] of Object.entries(files)) zip.file(p, c);
  return zip.generateAsync({ type: 'blob' });
}

describe('zipDurchlauf', () => {
  it('liefert pdf/docx aus Unterordnern, skippt Müll', async () => {
    const blob = await makeZip({
      'VB.pdf': 'x', 'sub/Anlage.docx': 'y',
      '__MACOSX/._VB.pdf': 'z', '.DS_Store': '', 'Thumbs.db': '', 'sub/': '',
    });
    const r = await zipDurchlauf(blob);
    expect(r.dateien.map(d => d.name).sort()).toEqual(['Anlage.docx', 'VB.pdf']);
    expect(r.uebersprungen.length).toBeGreaterThan(0);
  });

  it('lehnt .doc ab (Meldung), nimmt aber pdf', async () => {
    const blob = await makeZip({ 'alt.doc': 'x', 'neu.pdf': 'y' });
    const r = await zipDurchlauf(blob);
    expect(r.dateien.map(d => d.name)).toEqual(['neu.pdf']);
    expect(r.abgelehnt.some(a => a.name === 'alt.doc' && /\.doc/.test(a.grund))).toBe(true);
  });

  it('skippt ZIP-in-ZIP und meldet es', async () => {
    const inner = await makeZip({ 'i.pdf': 'a' });
    const { default: JSZip } = await import('jszip');
    const outer = new JSZip();
    outer.file('inner.zip', inner); outer.file('ok.pdf', 'b');
    const r = await zipDurchlauf(await outer.generateAsync({ type: 'blob' }));
    expect(r.dateien.map(d => d.name)).toEqual(['ok.pdf']);
    expect(r.uebersprungen.some(u => /inner\.zip/.test(u))).toBe(true);
  });
});
```

- [ ] **A4.2 Run → FAIL.** **A4.3 Implementieren**

```ts
/** Eine flach extrahierte, akzeptierte Datei aus dem ZIP. */
export interface ZipDatei { name: string; file: File; }
export interface ZipDurchlaufErgebnis {
  dateien: ZipDatei[];
  uebersprungen: string[];                       // Müll / ZIP-in-ZIP (still)
  abgelehnt: { name: string; grund: string }[];  // .doc o.ä.
}

const MUELL = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/i;
const basename = (p: string): string => p.split('/').pop() ?? p;

/** Liest EINE Datei oder EIN ZIP. Bei Einzeldatei → 1 ZipDatei. */
export async function zipDurchlauf(input: Blob): Promise<ZipDurchlaufErgebnis> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(input);
  const res: ZipDurchlaufErgebnis = { dateien: [], uebersprungen: [], abgelehnt: [] };
  const entries: { path: string; entry: import('jszip').JSZipObject }[] = [];
  zip.forEach((path, entry) => { if (!entry.dir) entries.push({ path, entry }); });

  for (const { path, entry } of entries) {
    if (MUELL.test(path)) { res.uebersprungen.push(path); continue; }
    const name = basename(path);
    const lower = name.toLowerCase();
    if (lower.endsWith('.zip')) { res.uebersprungen.push(`${path} (ZIP-in-ZIP übersprungen)`); continue; }
    if (lower.endsWith('.doc')) { res.abgelehnt.push({ name, grund: 'Altes .doc-Format — bitte als .docx oder .pdf' }); continue; }
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      res.abgelehnt.push({ name, grund: 'Nur .pdf und .docx werden aufgenommen' }); continue;
    }
    const blob = await entry.async('blob');
    res.dateien.push({ name, file: new File([blob], name) });
  }
  return res;
}

/** Eine lose abgelegte Datei (kein ZIP) in dieselbe Struktur bringen. */
export function loseDatei(file: File): ZipDurchlaufErgebnis {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.doc'))
    return { dateien: [], uebersprungen: [], abgelehnt: [{ name: file.name, grund: 'Altes .doc-Format — bitte als .docx oder .pdf' }] };
  if (!lower.endsWith('.pdf') && !lower.endsWith('.docx'))
    return { dateien: [], uebersprungen: [], abgelehnt: [{ name: file.name, grund: 'Nur .pdf und .docx' }] };
  return { dateien: [{ name: file.name, file }], uebersprungen: [], abgelehnt: [] };
}
```

> `loseDatei` deckt den „Dateien oder EIN ZIP"-Drop ab: pro Drop entweder `zipDurchlauf` (wenn `.zip`) oder `loseDatei` je Datei.

- [ ] **A4.4 Run → PASS.** **A4.5 Commit:** `feat(aufnahme): jszip-Durchlauf mit Skip/Reject-Regeln`

---

## Task A5: `antraege-eingang.ts` — FS-Schreiber (persönlicher Ordner)

**Files:** Create `src/core/services/personal-storage/antraege-eingang.ts`; Test `…/__tests__/antraege-eingang.test.ts` (mit In-Memory-FS-Handle-Fake)

Nutzt: `atomicWrite`, `readText`, `removeFile`, `fileExists`, `listFilesWithBackupInfo` (bestätigen: aus `infrastructure/atomic-write.ts`), `personal-layout`, `frontmatter`, `manifest`.

- [ ] **A5.1 Test-Setup**: kleiner `FakeDirHandle` (Map-basiert) für `atomicWrite`/`readText`. Falls bereits ein FS-Fake existiert (`infrastructure/__tests__`), den wiederverwenden — sonst minimal: implementiert `getDirectoryHandle({create})`, `getFileHandle`, `createWritable`, `remove`. **Step: vor Implementierung nach vorhandenem FS-Test-Helper grep'en (`createWritable` in `__tests__`).**

- [ ] **A5.2 Test (Kernpfade)**

```ts
// schreibt Dokument-MD, liest VB aus Ordner zurück, Manifest round-trip
it('schreibt Dokument-MD und findet VB per Frontmatter zurück', async () => {
  const root = new FakeDirHandle();
  await writeDokumentMarkdown(root, '16EP001234',
    { fkz: '16EP001234', typ: 'vorhabensbeschreibung', quelle: 'VB.pdf', konvertiert_am: '2026-06-11T10:00:00.000Z' },
    '# VB\n\nInhalt');
  const vb = await readVbAusOrdner(root, ['16EP001234']);
  expect(vb?.markdown).toContain('# VB');
});

it('readVbAusOrdner nimmt die jüngste VB über mehrere knownIds', async () => { /* zwei VBs, neuere gewinnt */ });
it('Manifest schreiben/lesen + Bundle löschen', async () => { /* writeManifest → readManifest → deleteEingangBundle */ });
```

- [ ] **A5.3 Implementieren**

```ts
import type { DokumentMeta } from '@/plugins/antraege/aufnahme-einfach/frontmatter';
import { buildMarkdownMitFrontmatter, parseFrontmatter } from '@/plugins/antraege/aufnahme-einfach/frontmatter';
import type { EingangManifest } from '@/plugins/antraege/aufnahme-einfach/manifest';
import { atomicWrite, readText, removeFile, listFilesWithBackupInfo } from '@/core/services/infrastructure/atomic-write';
import {
  dokumentMdPath, dokumenteDir, eingangZipPath, eingangManifestPath, EINGANG_DIR,
} from './personal-layout';

/** Konvertiertes Dokument als .md (Frontmatter + Inhalt) atomar ablegen. */
export async function writeDokumentMarkdown(
  root: FileSystemDirectoryHandle, fkz: string, meta: DokumentMeta, body: string,
): Promise<void> {
  await atomicWrite(root, dokumentMdPath(fkz, meta.quelle), buildMarkdownMitFrontmatter(meta, body), { skipBackup: true });
}

export interface OrdnerVb { markdown: string; quelle: string; fkz: string; konvertiert_am: string; }

/**
 * VB-Fallback (A4): scannt `ZAH/antraege/{id}/dokumente/*.md` über ALLE `knownIds`,
 * filtert auf Frontmatter `typ: vorhabensbeschreibung`, gibt die jüngste zurück.
 * Liest nur Frontmatter-tragende Dateien; tolerant gegenüber fehlendem Ordner.
 */
export async function readVbAusOrdner(
  root: FileSystemDirectoryHandle, knownIds: string[],
): Promise<OrdnerVb | null> {
  const kandidaten: OrdnerVb[] = [];
  for (const id of knownIds) {
    let namen: string[];
    try { namen = (await listFilesWithBackupInfo(root, dokumenteDir(id))).map(f => f.name); }
    catch { continue; } // Ordner fehlt
    for (const name of namen) {
      if (!name.endsWith('.md')) continue;
      const raw = await readText(root, `${dokumenteDir(id)}/${name}`).catch(() => null);
      if (!raw) continue;
      const parsed = parseFrontmatter(raw);
      if (parsed?.meta.typ === 'vorhabensbeschreibung') {
        kandidaten.push({ markdown: parsed.body, quelle: parsed.meta.quelle, fkz: id, konvertiert_am: parsed.meta.konvertiert_am });
      }
    }
  }
  kandidaten.sort((a, b) => b.konvertiert_am.localeCompare(a.konvertiert_am));
  return kandidaten[0] ?? null;
}

export async function copyZipToEingang(root: FileSystemDirectoryHandle, zipname: string, zip: Blob): Promise<void> {
  await atomicWrite(root, eingangZipPath(zipname), zip, { skipBackup: true });
}
export async function writeManifest(root: FileSystemDirectoryHandle, m: EingangManifest): Promise<void> {
  await atomicWrite(root, eingangManifestPath(m.zipname), JSON.stringify(m, null, 2), { skipBackup: true });
}
export async function readManifest(root: FileSystemDirectoryHandle, zipname: string): Promise<EingangManifest | null> {
  const raw = await readText(root, eingangManifestPath(zipname)).catch(() => null);
  return raw ? JSON.parse(raw) as EingangManifest : null;
}
export async function listEingangBundles(root: FileSystemDirectoryHandle): Promise<EingangManifest[]> {
  let files: { name: string }[];
  try { files = await listFilesWithBackupInfo(root, EINGANG_DIR); } catch { return []; }
  const out: EingangManifest[] = [];
  for (const f of files) {
    if (!f.name.endsWith('.manifest.json')) continue;
    const raw = await readText(root, `${EINGANG_DIR}/${f.name}`).catch(() => null);
    if (raw) out.push(JSON.parse(raw) as EingangManifest);
  }
  return out;
}
export async function deleteEingangBundle(root: FileSystemDirectoryHandle, zipname: string): Promise<void> {
  await removeFile(root, eingangZipPath(zipname)).catch(() => {});
  await removeFile(root, eingangManifestPath(zipname)).catch(() => {});
}
```

> **Verifizieren vor Code:** Existenz/Signaturen von `removeFile`, `listFilesWithBackupInfo` in `atomic-write.ts` (vom Explore-Report bestätigt). Falls `listFilesWithBackupInfo` nicht passt, eigenen `listDir`-Helfer via `dirHandle.values()` ergänzen.

- [ ] **A5.4 Run → PASS.** **A5.5 Commit:** `feat(aufnahme): FS-Schreiber für Dokumente + Eingang (persönlicher Ordner)`

---

## Task A6: `useAufnahme.ts` — Orchestrator-Hook

**Files:** Create `…/useAufnahme.ts`, `…/types.ts`, `…/useAufnahmeUiStore.ts`. (Hook-Tests sind teuer; Kernlogik steckt in A1–A5 (pure, getestet). Hier nur dünne IO-Orchestrierung.)

- [ ] **A6.1 `types.ts`**

```ts
import type { AufnahmeTyp } from './dateiTyp';
export type ZeilenStatus = 'bereit' | 'konvertiere' | 'konvertiert' | 'fehlgeschlagen' | 'uebersprungen';
export interface IntakeFile {
  localId: string;        // crypto.randomUUID()
  file: File;
  name: string;
  fkz: string | null;     // null = „kein FKZ"
  fkzManuell: boolean;    // per Inline-Eingabe gesetzt
  typ: AufnahmeTyp;       // Vorschlag, vom User überschreibbar
  status: ZeilenStatus;
  error?: string;
}
export interface AbschlussInfo {
  konvertiert: number; fehlgeschlagen: number; uebersprungen: number;
  fkzMitVb: string[];   // Merkliste FKZ mit neuer VB → Einstieg Teil B
}
```

- [ ] **A6.2 `useAufnahmeUiStore.ts`** (trivialer UI-Zustand, kein IDB)

```ts
import { create } from 'zustand';
interface S { open: boolean; toggle: () => void; close: () => void; }
export const useAufnahmeUiStore = create<S>(set => ({
  open: false, toggle: () => set(s => ({ open: !s.open })), close: () => set({ open: false }),
}));
```

- [ ] **A6.3 `useAufnahme.ts`** — Verhalten:
  - `addDrop(items: (File)[])`: pro Item `.zip` → `zipDurchlauf`, sonst `loseDatei`; je akzeptierter Datei eine `IntakeFile` (FKZ via `extractFkzTolerant(name)?.fkz ?? null`, `typ = typVorschlag(name)`); `uebersprungen`/`abgelehnt` als sichtbare Meldungen sammeln. **Sequenziell**, Blobs nach Gebrauch freigeben (keine Referenzen halten).
  - `setFkz(localId, fkz)` (+ `isValidFkz`-Validierung inline), `setTyp(localId, typ)`.
  - `konvertierenUndAblegen()`: via **`useAsyncAction`** (Pflicht, Pitfall #15). `getPersoenlichHandle(idb)` holen; wenn null → Error-Banner „Kein persönlicher Ordner verbunden". Original-ZIP(s) **vor** Verarbeitung via `copyZipToEingang` ablegen + `leeresManifest`/`writeManifest`. Dann **sequenziell** je `IntakeFile` mit gültigem FKZ: `status='konvertiere'` → `new DocConverter().convert(file)` → `writeDokumentMarkdown(root, fkz, {fkz, typ, quelle:name, konvertiert_am:now}, converted.markdown)` → `setDateiStatus(manifest,name,'konvertiert')` + `writeManifest` → `status='konvertiert'`. Fehler je Datei isolieren (`status='fehlgeschlagen'`, weiter). Dateien ohne gültigen FKZ / `typ==='unklar'` ohne Userwahl → nicht ablegen (in Liste markiert). Fortschritt: Zähler + aktueller Name; Abbrechen via `AbortController`-Flag (Schleife bricht nach aktueller Datei).
  - Nach Abschluss `AbschlussInfo` berechnen: `fkzMitVb` = distinct FKZ, bei denen mind. eine Datei mit `typ==='vorhabensbeschreibung'` erfolgreich abgelegt wurde.
  - **`DocConverter` einmal instanziieren** (nicht pro Datei), am Ende ggf. `destroy()`.

- [ ] **A6.4 Smoke** (optional, leichter Hook-Test mit gefaktem Converter + FakeDirHandle): zwei Dateien, eine VB → `fkzMitVb` enthält den FKZ; eine fehlerhafte → `fehlgeschlagen` zählt, Lauf läuft weiter.

- [ ] **A6.5 Commit:** `feat(aufnahme): useAufnahme-Orchestrator (Parse → Konvertieren & Ablegen)`

---

## Task A7: UI — `AufnahmePanel` + Zeile + Bestandsblock + Abschluss + Overlay

**Files:** Create `AufnahmeOverlay.tsx`, `AufnahmePanel.tsx`, `AufnahmeZeile.tsx`, `BestandsBlock.tsx`, `AbschlussPanel.tsx`, `index.ts`. DESIGN_GUIDE strikt (monochrom, 0.5px-Border, Pills statt Dropdown, `useAsyncAction`, sichtbares Error-Banner, Toggleable-Pill layout-stable).

- [ ] **A7.1 `AufnahmeOverlay.tsx`** — Dialog-Overlay (`.dialog-overlay` rgba(0,0,0,0.4), Panel `bg-[var(--tf-bg)] rounded-2xl` breit ~`max-w-3xl`, scrollbar). Hält Tabs/Phasen: `aufnahme` (Panel) → `abschluss` (AbschlussPanel) → (Teil B in B-Phase). Schließen via X + Overlay-Klick. Gemountet aus `AntraegePage` wenn `useAufnahmeUiStore(open)` && `isGutachtenWorkflowEnabled()`.

- [ ] **A7.2 `AufnahmePanel.tsx`**:
  - Drop-Fläche: `FileDropZone` aus `@/ui` wiederverwenden (Props vor Nutzung lesen) — akzeptiert `.pdf,.docx,.zip`, multiple; Fallback „Datei wählen". (DESIGN_GUIDE §5 „Drag&Drop-Upload-Zone".)
  - Eine Übersichtsliste (reduziertes Triage): `AufnahmeZeile` je `IntakeFile`. **KEINE** Bulk-Aktionen, **KEINE** Filter-Pills, **KEINE** Konfidenz-Anzeigen.
  - Meldungs-Bereich für `uebersprungen`/`abgelehnt` (dezent, tertiary).
  - Aktionsleiste: „Konvertieren & ablegen" (Primary, `useAsyncAction`, disabled wenn keine ablegbaren Dateien / busy), Fortschrittszeile (Zähler + Name) + „Abbrechen" während Lauf, Error-Banner.
  - `BestandsBlock` unten.

- [ ] **A7.3 `AufnahmeZeile.tsx`** (eine Zeile, `list-item`-Pattern):
  - Dateiname (Card-Title 14px), Original-Endung dezent.
  - **FKZ-Chip:** gültig → Monospace-ID-Badge; „kein FKZ"/„unbekanntes FKZ" → Warning-Badge + Inline-Input (`isValidFkz`-Validierung unter dem Feld).
  - **Typ-Pills:** `AUFNAHME_TYPEN` ohne `unklar` als Toggleable-Pills (DESIGN_GUIDE §5; aktiver Vorschlag voll, sonst outline-only, Häkchen-Slot `invisible`, `aria-pressed`). `unklar` = keine aktive Pill (User muss wählen → sonst nicht ablegbar, sichtbar markiert).
  - **Status:** bereit / „konvertiere…" (Spinner) / „konvertiert ✓" / „fehlgeschlagen" (Danger-Badge + Grund) / „übersprungen".

- [ ] **A7.4 `BestandsBlock.tsx`**: lädt `listEingangBundles(root)`; je Bundle eine Zeile mit `zusammenfassung()`-Label: `istLoeschbar` → „alle X Dateien konvertiert ✓ — löschbar" (bzw. „X verarbeitet, M Fehler") + Löschen-Button (Bestätigung) → `deleteEingangBundle`; sonst „Y von X konvertiert" + Löschen disabled. **Keine IDB-Spiegelung.**

- [ ] **A7.5 `AbschlussPanel.tsx`**: „N konvertiert · M fehlgeschlagen · K übersprungen" + Merkliste `fkzMitVb`. Primary-Button „Gutachten-Entwürfe erzeugen…" → öffnet Teil-B-`StartDialog` mit der FKZ-Menge (in B-Phase verdrahtet; in Teil A nur als disabled/Platzhalter mit TODO-Kommentar, **wird in Task B7 aktiviert**).

- [ ] **A7.6 `index.ts` Barrel.**
- [ ] **A7.7 Commit:** `feat(aufnahme): UI-Panel (Drop, Triage-Liste, Bestand, Abschluss)`

---

## Task A8: Integration — Header-Button + Page-Overlay

**Files:** Modify `AntraegeHeader.tsx`, `AntraegePage.tsx`.

- [ ] **A8.1 `AntraegeHeader.tsx`**: in der Action-Leiste (Zeile ~151, `flex … ml-auto`) **vor** dem Export-Button einen Button „Dokumente aufnehmen" (lucide `FileUp`, `variant="outline" size="sm"`), `onClick={() => useAufnahmeUiStore.getState().toggle()}`, nur wenn `isGutachtenWorkflowEnabled()`. Import-Gate oben.

```tsx
{isGutachtenWorkflowEnabled() && (
  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5"
    onClick={() => useAufnahmeUiStore.getState().toggle()}
    title="Antragsdokumente (ZIP) aufnehmen">
    <FileUp size={13} /> <span className="text-[12px]">Aufnehmen</span>
  </Button>
)}
```

- [ ] **A8.2 `AntraegePage.tsx`**: nach dem Haupt-`<div>` (vor `</div>` Ende) `{isGutachtenWorkflowEnabled() && <AufnahmeOverlay />}` rendern (Overlay liest `useAufnahmeUiStore` selbst). Import.

- [ ] **A8.3 Manuelle Verifikation (dev):** `npm run dev`, Förderanträge öffnen, „Aufnehmen" → Overlay; ZIP droppen → Liste; konvertieren → `.md` im persönlichen Ordner (über dev-Fixture-Handle / FS-Picker). Console fehlerfrei.

- [ ] **A8.4 Commit:** `feat(aufnahme): Einhängung auf der Förderanträge-Seite (flag-gated)`

---

## Task A9: A4 — VB-Auflösung um Ordner-Fallback erweitern

**Files:** Create `kurzfassung/context-builder.ts`; Modify `kurzfassung/vbDokument.ts`, `gutachten/useGutachtenWorkflow.ts`, `VerbundDetail.tsx`. Test `kurzfassung/__tests__/context-builder.test.ts`, ergänzen `vbDokument`-Tests.

- [ ] **A9.1 `context-builder.ts` (Extraktion, verhaltensgleich zu VerbundDetail:269–282)**

```ts
import type { Antrag, Verbund } from '@/core/services/csv/types';
import type { KurzfassungContext } from './types';

function strOrNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : null;
}

/**
 * Baut den `KurzfassungContext` aus Verbund + lead-first sortierten TVs.
 * EXAKT die Logik aus VerbundDetail (eine Quelle → kein zweiter Prompt-Pfad).
 * `headerId` = Verbund-ID bzw. echtes Aktenzeichen bei Solo/pseudo.
 */
export function buildKurzfassungContext(
  verbund: Pick<Verbund, 'akronym' | 'titel'> | null,
  antraege: Antrag[],
  headerId: string,
): KurzfassungContext {
  const lead = antraege[0];
  const akronym = strOrNull(verbund?.akronym) ?? strOrNull(lead?.akronym) ?? headerId;
  const titel = strOrNull(verbund?.titel) ?? strOrNull(lead?.titel);
  const antragsteller = strOrNull(lead?.antragsteller);
  return {
    key: headerId, akronym, titel, antragsteller, foerderkennzeichen: headerId,
    knownIds: [headerId, ...antraege.map(a => a.aktenzeichen)],
    teilvorhaben: antraege.map((tv, idx) => ({
      nr: idx + 1, aktenzeichen: tv.aktenzeichen, titel: strOrNull(tv.titel), antragsteller: strOrNull(tv.antragsteller),
    })),
  };
}
```

- [ ] **A9.2 Charakterisierungs-Test:** Sample-Verbund + 2 TVs → erwarteter Context (key, akronym-Fallback-Kette, knownIds, teilvorhaben-Reihenfolge).
- [ ] **A9.3 `VerbundDetail.tsx` refaktorieren:** den Inline-Block (269–282) durch `buildKurzfassungContext(verbund, antraege, headerId)` ersetzen. **`antraege` muss lead-first sortiert sein** — die bestehende Sortierung beibehalten (vorhandener `useMemo`/Sort lokalisieren; identische Reihenfolge sicherstellen). Verifizieren: Einzellauf-Context byte-identisch (manuell + bestehende Tests grün).

- [ ] **A9.4 `vbDokument.ts` — `resolveVb` ergänzen (additiver Fallback)**

```ts
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { readVbAusOrdner } from '@/core/services/personal-storage/antraege-eingang';
import type { KurzfassungContext } from './types';
// bestehend: findVorhabensbeschreibung(idb, fkz): Promise<DocumentFull | null>

export interface VbAufloesung { markdown: string; herkunft: 'idb' | 'ordner'; dokument: DocumentFull | null; quelleName?: string; }

/**
 * VB-Auflösung mit VORRANG IDB (bestehendes Verhalten), Fallback persönlicher
 * Ordner (Teil A). Für Nutzer mit indexierter VB byte-identisch zu bisher
 * (Fallback feuert nur bei IDB=null). Scannt alle ctx.knownIds-Ordner.
 */
export async function resolveVb(idb: IDBStore, ctx: KurzfassungContext): Promise<VbAufloesung | null> {
  const idbDoc = await findVorhabensbeschreibung(idb, ctx.key);
  if (idbDoc) return { markdown: idbDoc.markdown, herkunft: 'idb', dokument: idbDoc };
  const persHandle = await getPersoenlichHandle(idb).catch(() => null);
  if (!persHandle) return null;
  const ordner = await readVbAusOrdner(persHandle, ctx.knownIds);
  return ordner ? { markdown: ordner.markdown, herkunft: 'ordner', dokument: null, quelleName: ordner.quelle } : null;
}
```

- [ ] **A9.5 `useGutachtenWorkflow.ts` umstellen** (additiv, Einzellauf-erhaltend):
  - Import `resolveVb` statt nur `findVorhabensbeschreibung`.
  - Im Lade-`useEffect` (Zeile 125–127): `findVorhabensbeschreibung(storage.idb, key)` → `resolveVb(storage.idb, ctx)`. State: `vbAufloesung` halten; `vbDokument` = `vb?.dokument ?? null`; **`vbVorhanden` = `vb !== null`** (nicht mehr `vbDokument !== null`).
  - `runGeneration` (Zeile 178): `vbMarkdown: vbDokument.markdown` → `vbMarkdown: vbAufloesung.markdown`; Guard `if (!vbAufloesung || …)`.
  - `refreshVb` (226): analog `resolveVb`.
  - **Prüfen:** verwendet `GutachtenSection`/`KurzfassungSection` `vbDokument` für Anzeige? Falls ja, muss es Ordner-VB (dokument=null, vbVorhanden=true) tolerieren — UI-Texte auf `vbVorhanden` + `vbAufloesung.herkunft` umstellen, nicht auf `vbDokument`. (Stellen lokalisieren + minimal anpassen.)

- [ ] **A9.6 Tests:** `resolveVb` IDB-VORRANG (IDB-Treffer → Ordner ungelesen); Ordner-Fallback (IDB null → jüngste Ordner-VB); beides leer → null. **A9.7 Bestehende Suite grün** (besonders gutachten/kurzfassung).
- [ ] **A9.8 Commit:** `feat(aufnahme): VB-Auflösung mit Ordner-Fallback (A4, IDB hat Vorrang)`

---

## ⏸️ ZWISCHENABNAHME — STOP nach Teil A

- [ ] Alle Teil-A-Tests grün, bestehende + Convention-Tests grün (`npm run test`).
- [ ] `npm run build:devprod` ok (dev + prod), HTML per `file://` lädt fehlerfrei.
- [ ] Kurzbericht (Dateien, Tests, grobe Konvertier-Laufzeit). **Freigabe abwarten, dann Teil B.**

---

# TEIL B — Batch-Generierung (~10 Anträge sequenziell)

## Task B1: `types.ts` — Job-Modell

**Files:** Create `src/core/services/gutachten-batch/types.ts`.

- [ ] **B1.1 Implementieren**

```ts
import type { StepId } from '@/plugins/antraege/gutachten/types';

export type BatchAbschnitte = 'nur_a' | 'a_bis_g';
export type EintragStatus = 'wartet' | 'in_arbeit' | 'fertig' | 'fehler' | 'uebersprungen';
export type JobStatus = 'laeuft' | 'pausiert' | 'fertig' | 'abgebrochen';

export interface BatchEintrag {
  /** Verbund-Key = WorkflowRun-Key + VB-Tag (bei Solo das Aktenzeichen). */
  aktenzeichen: string;
  /** FKZ-Ordnername für den Disk-Spiegel (der von Teil A genutzte FKZ; = key bei Verbund-FKZ). */
  fkz: string;
  /** Anzeige (Akronym/Kurztitel). */
  titel: string;
  status: EintragStatus;
  fehlerText?: string;
  /** Grund bei 'uebersprungen' ('keine VB' | 'bereits Gutachten-Stand'). */
  grund?: string;
  /** Kurzform letzter Abschnitt, z.B. „A erzeugt ✓ (2 Hinweise)". */
  checkKurz?: string;
}

export interface BatchJob {
  id: string;
  erstellt_am: string;
  abschnitte: BatchAbschnitte;
  eintraege: BatchEintrag[];
  aktiverIndex: number;
  jobStatus: JobStatus;
  schemaVersion: 1;
}

/** Welche StepIds ein Job generiert. */
export function gewuenschteSchritte(a: BatchAbschnitte): StepId[] {
  return a === 'nur_a' ? ['A'] : ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
}
```

- [ ] **B1.2 Commit:** `feat(batch): Job-Datenmodell (BatchJob/BatchEintrag)`

---

## Task B2: `context-provider.ts` — `quelle`-Parameter (Einzige bewusste Einzellauf-Abweichung)

**Files:** Modify `src/plugins/antraege/gutachten/context-provider.ts`; ergänzen `__tests__/context-provider.test.ts`.

- [ ] **B2.1 Tests ergänzen** (bestehende 4-arg-Tests bleiben)

```ts
it('quelle=freigegeben (default) lässt Entwürfe aus → byte-identisch', () => {
  const run = mit({ A: 'freigegeben', B: 'entwurf' }); // Helfer aus der Testdatei
  expect(buildVorherigeAbschnitte(run, 'C', ZIM_EP_WORKFLOW)).toContain('### Abschnitt A');
  expect(buildVorherigeAbschnitte(run, 'C', ZIM_EP_WORKFLOW)).not.toContain('### Abschnitt B');
});
it('quelle=entwurf nimmt Entwürfe MIT „(Entwurf)"-Marker, Freigegebene ohne Marker', () => {
  const run = mit({ A: 'freigegeben', B: 'entwurf' });
  const block = buildVorherigeAbschnitte(run, 'C', ZIM_EP_WORKFLOW, 2000, 'entwurf');
  expect(block).toMatch(/### Abschnitt A — [^\n]+\n/);          // kein Marker
  expect(block).toContain('### Abschnitt B —');
  expect(block).toMatch(/### Abschnitt B — [^\n]*\(Entwurf\)/);  // Marker
});
it('leere Schritte bleiben außen vor (beide Quellen)', () => { /* status leer/undefined → ausgelassen */ });
```

- [ ] **B2.2 Run → FAIL.** **B2.3 Implementieren** (5. Positions-Param)

```ts
export function buildVorherigeAbschnitte(
  run: WorkflowRun,
  currentStep: StepId,
  defs: readonly WorkflowStepDef[],
  capPerSection = 2000,
  quelle: 'freigegeben' | 'entwurf' = 'freigegeben',
): string {
  const idx = STEP_ORDER.indexOf(currentStep);
  const bloecke: string[] = [];
  for (const id of STEP_ORDER.slice(0, idx)) {
    const step = run.schritte[id];
    if (!step) continue;
    const akzeptiert = quelle === 'freigegeben'
      ? step.status === 'freigegeben'
      : (step.status === 'freigegeben' || step.status === 'entwurf');
    if (!akzeptiert) continue;
    const label = defs.find(d => d.id === id)?.label ?? id;
    const marker = step.status === 'entwurf' ? ' (Entwurf)' : '';
    bloecke.push(`### Abschnitt ${id} — ${label}${marker}\n${cutAtParagraph(step.finalerText, capPerSection)}`);
  }
  return bloecke.join('\n\n');
}
```

> Default `'freigegeben'` + nur freigegebene ⇒ kein Marker ⇒ Einzellauf byte-identisch. Marker erscheint nur bei `status==='entwurf'`, was im Einzellauf nie in `vorherigeAbschnitte` landet.

- [ ] **B2.4 Run → PASS** (auch der bestehende 4-arg-Test). **B2.5 Commit:** `feat(batch): vorherigeAbschnitte-Quelle (freigegeben|entwurf) als Parameter`

---

## Task B3: `job-state.ts` — reine Zustandsübergänge

**Files:** Create `…/job-state.ts`; Test `…/__tests__/job-state.test.ts`.

- [ ] **B3.1 Test** (Übergänge: markIn­Arbeit/Fertig/Fehler/Übersprungen, pausieren, fortsetzen, abbrechen, advance, istFertig)

```ts
it('start → in_arbeit, fertig → nächster Index, alle fertig → jobStatus fertig', () => { … });
it('pausieren setzt jobStatus pausiert ohne Index zu ändern; fortsetzen → laeuft', () => { … });
it('fehler markiert Eintrag, advance trotzdem zum nächsten', () => { … });
it('abbrechen → jobStatus abgebrochen', () => { … });
```

- [ ] **B3.2 Implementieren** (alle pure `(job, …) → job`)

```ts
import type { BatchJob, BatchEintrag, EintragStatus } from './types';

const patch = (job: BatchJob, i: number, p: Partial<BatchEintrag>): BatchJob =>
  ({ ...job, eintraege: job.eintraege.map((e, idx) => idx === i ? { ...e, ...p } : e) });

export const setEintragStatus = (job: BatchJob, i: number, status: EintragStatus, extra: Partial<BatchEintrag> = {}): BatchJob =>
  patch(job, i, { status, ...extra });

export const pausieren = (job: BatchJob): BatchJob => ({ ...job, jobStatus: 'pausiert' });
export const fortsetzen = (job: BatchJob): BatchJob => ({ ...job, jobStatus: 'laeuft' });
export const abbrechen = (job: BatchJob): BatchJob => ({ ...job, jobStatus: 'abgebrochen' });

/** Index auf den nächsten noch nicht terminalen Eintrag ab `from` setzen; sonst fertig. */
export function advance(job: BatchJob): BatchJob {
  const next = job.eintraege.findIndex((e, i) => i >= job.aktiverIndex + 1 && e.status === 'wartet');
  // einfacher: linear ab aktiverIndex+1
  const idx = job.eintraege.findIndex((e, i) => i > job.aktiverIndex && (e.status === 'wartet'));
  if (idx < 0) return { ...job, jobStatus: 'fertig' };
  return { ...job, aktiverIndex: idx };
}

export const istFertig = (job: BatchJob): boolean =>
  job.eintraege.every(e => e.status !== 'wartet' && e.status !== 'in_arbeit');
```

> `advance`-Logik im Test final festzurren (linearer Vorlauf, terminale Stati überspringen). Resume nutzt denselben Vorlauf, daher robust gegen schon-verarbeitete Einträge.

- [ ] **B3.3 Run → PASS.** **B3.4 Commit:** `feat(batch): reine Job-Zustandsübergänge`

---

## Task B4: `mengen.ts` — Mengen-/Ausschluss-Berechnung (pure)

**Files:** Create `…/mengen.ts`; Test `…/__tests__/mengen.test.ts`.

Zweck (Start-Dialog vorab): pro Kandidat-FKZ klassifizieren in `bereit | ohne_vb | bereits_stand`. Pure — die IO (VB-/Run-Lookup) wird als Ergebnis-Map hereingereicht.

- [ ] **B4.1 Test**

```ts
import { berechneMengen } from '../mengen';

it('teilt in bereit / ohne_vb / bereits_stand', () => {
  const r = berechneMengen(
    [{ aktenzeichen: 'V1', fkz: 'V1', titel: 'A', hatVb: true },
     { aktenzeichen: 'V2', fkz: 'V2', titel: 'B', hatVb: false },
     { aktenzeichen: 'V3', fkz: 'V3', titel: 'C', hatVb: true }],
    'nur_a',
    { V3: { A: 'freigegeben' } },  // V3 hat A schon
  );
  expect(r.bereit.map(e => e.aktenzeichen)).toEqual(['V1']);
  expect(r.ohneVb.map(e => e.aktenzeichen)).toEqual(['V2']);
  expect(r.bereitsStand.map(e => e.aktenzeichen)).toEqual(['V3']);
});

it('a_bis_g: bereits_stand nur wenn ALLE gewünschten Schritte vorhanden', () => {
  const r = berechneMengen(
    [{ aktenzeichen: 'V1', fkz: 'V1', titel: 'A', hatVb: true }],
    'a_bis_g', { V1: { A: 'entwurf' } }); // nur A da, B–G fehlen
  expect(r.bereit.map(e => e.aktenzeichen)).toEqual(['V1']);
});
```

- [ ] **B4.2 Implementieren**

```ts
import type { StepId } from '@/plugins/antraege/gutachten/types';
import { gewuenschteSchritte, type BatchAbschnitte } from './types';

export interface MengenKandidat { aktenzeichen: string; fkz: string; titel: string; hatVb: boolean; }
export interface MengenEintrag { aktenzeichen: string; fkz: string; titel: string; }
export interface Mengen { bereit: MengenEintrag[]; ohneVb: MengenEintrag[]; bereitsStand: MengenEintrag[]; }

/** `vorhandeneStaende[az]` = Map StepId→Status der bereits persistierten Schritte. */
export function berechneMengen(
  kandidaten: MengenKandidat[],
  abschnitte: BatchAbschnitte,
  vorhandeneStaende: Record<string, Partial<Record<StepId, string>>>,
): Mengen {
  const gewuenscht = gewuenschteSchritte(abschnitte);
  const m: Mengen = { bereit: [], ohneVb: [], bereitsStand: [] };
  for (const k of kandidaten) {
    const eintrag: MengenEintrag = { aktenzeichen: k.aktenzeichen, fkz: k.fkz, titel: k.titel };
    if (!k.hatVb) { m.ohneVb.push(eintrag); continue; }
    const staende = vorhandeneStaende[k.aktenzeichen] ?? {};
    const alleVorhanden = gewuenscht.every(s => staende[s] === 'entwurf' || staende[s] === 'freigegeben');
    if (alleVorhanden) m.bereitsStand.push(eintrag);
    else m.bereit.push(eintrag);
  }
  return m;
}
```

- [ ] **B4.3 Run → PASS.** **B4.4 Commit:** `feat(batch): Mengen-/Ausschluss-Berechnung`

---

## Task B5: `batch-store.ts` + `gutachten-mirror.ts`

**Files:** Create `…/batch-store.ts`, `…/gutachten-mirror.ts`.

- [ ] **B5.1 `batch-store.ts`** (ein aktiver Job, kv-Key — additiver Store, kein Version-Bump, Pitfall #29-Profil)

```ts
import type { IDBStore } from '@/core/services/storage';
import type { BatchJob } from './types';

const KEY = 'gutachten-batch:aktiv';
export async function getBatchJob(idb: IDBStore): Promise<BatchJob | null> { return idb.get<BatchJob>(KEY); }
export async function putBatchJob(idb: IDBStore, job: BatchJob): Promise<void> { await idb.set(KEY, job); }
export async function deleteBatchJob(idb: IDBStore): Promise<void> { await idb.delete(KEY); }
```

- [ ] **B5.2 `gutachten-mirror.ts`** (batch-lokaler Disk-Spiegel, D2). Slug aus `ZIM_EP_WORKFLOW`-Label.

```ts
import { atomicWrite } from '@/core/services/infrastructure/atomic-write';
import { gutachtenMdPath } from '@/core/services/personal-storage/personal-layout';
import { buildMarkdownMitFrontmatter } from '@/plugins/antraege/aufnahme-einfach/frontmatter';
import { ZIM_EP_WORKFLOW } from '@/plugins/antraege/gutachten/workflow-definition';
import type { StepId } from '@/plugins/antraege/gutachten/types';

function slugFor(stepId: StepId): string {
  const label = ZIM_EP_WORKFLOW.find(d => d.id === stepId)?.label ?? stepId;
  return label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || stepId.toLowerCase();
}

/** Schreibt EINEN erzeugten Abschnitt als .md in den persönlichen Ordner (best-effort). */
export async function spiegeleAbschnitt(
  root: FileSystemDirectoryHandle, fkz: string, stepId: StepId, finalerText: string, now: string,
): Promise<void> {
  const body = `# Abschnitt ${stepId}\n\n${finalerText}`;
  const md = buildMarkdownMitFrontmatter(
    { fkz, typ: 'unklar', quelle: `gutachten-${stepId}`, konvertiert_am: now } as never, body);
  await atomicWrite(root, gutachtenMdPath(fkz, stepId, slugFor(stepId)), md, { skipBackup: true });
}
```

> Frontmatter-`typ` ist hier nur Spur (kein VB) — alternativ ein schlankeres Gutachten-Frontmatter. Mirror ist **best-effort**: Fehler werden im Runner gefangen, blockieren die Generierung nie.

- [ ] **B5.3 Test** (Mirror): FakeDirHandle, `spiegeleAbschnitt(root,'16EP…','A','Text','…')` → Datei unter `ZAH/antraege/16EP…/gutachten/A-kurzfassung.md` existiert, enthält „Text".
- [ ] **B5.4 Commit:** `feat(batch): IDB-Job-Store + batch-lokaler .md-Spiegel`

---

## Task B6: `runner.ts` — sequenzielle Schleife mit injizierbaren Deps

**Files:** Create `…/runner.ts`; Test `…/__tests__/runner.test.ts` (OHNE LLM via Fakes).

Design: Der Runner kennt **nur** den `BatchJob` + reine `job-state`-Übergänge + injizierte Abhängigkeiten. „Abschnitt erzeugen" (LLM+Checks+persist+spiegeln) ist injiziert.

- [ ] **B6.1 Deps-Interface + Schleife**

```ts
import type { BatchJob } from './types';
import { gewuenschteSchritte } from './types';
import { setEintragStatus, advance, pausieren, abbrechen } from './job-state';
import type { StepId, WorkflowRun } from '@/plugins/antraege/gutachten/types';

/** Resultat einer Abschnitts-Erzeugung für EINEN Antrag/Schritt. */
export interface AbschnittErgebnis { erzeugt: boolean; hinweise: number; fehler: boolean; uebersprungen: boolean; }

export interface BatchDeps {
  /** Transport erreichbar? (Default: bridge.getActiveTransport().ping()). */
  transportVerfuegbar: () => Promise<boolean>;
  /** Lädt den WorkflowRun (für Idempotenz-Skip). */
  ladeRun: (aktenzeichen: string) => Promise<WorkflowRun>;
  /**
   * Erzeugt EINEN Abschnitt (resolve skill/regeln, runSkill, Checks,
   * applyGeneration, putWorkflowRun, Disk-Spiegel). Wirft bei LLM-/Transport-
   * Fehler. Skippt intern, wenn der Schritt schon einen Stand hat.
   */
  erzeugeAbschnitt: (args: { aktenzeichen: string; fkz: string; stepId: StepId; signal: AbortSignal }) => Promise<AbschnittErgebnis>;
  persistJob: (job: BatchJob) => Promise<void>;
  onUpdate: (job: BatchJob) => void;
  jetzt: () => string;
  signal: AbortSignal;
}

/**
 * Fährt den Job ab `aktiverIndex`. Sequenziell, ein Antrag nach dem anderen,
 * je Antrag Schritte in Definitionsreihenfolge. Vorhandene Stände werden
 * übersprungen (Idempotenz). Transport weg ⇒ pausiert (nicht abgebrochen).
 * Fehler bei einem Antrag ⇒ markiert + weiter. Gibt den End-Job zurück.
 */
export async function runBatch(start: BatchJob, deps: BatchDeps): Promise<BatchJob> {
  let job = { ...start, jobStatus: 'laeuft' as const };
  const schritte = gewuenschteSchritte(job.abschnitte);
  const commit = async (j: BatchJob): Promise<void> => { job = j; deps.onUpdate(j); await deps.persistJob(j); };

  for (let i = job.aktiverIndex; i < job.eintraege.length; i++) {
    job = { ...job, aktiverIndex: i };
    const e = job.eintraege[i]!;
    if (e.status === 'fertig' || e.status === 'uebersprungen' || e.status === 'fehler') continue;
    if (deps.signal.aborted) { await commit(abbrechen(job)); return job; }

    if (!(await deps.transportVerfuegbar())) { await commit(pausieren(job)); return job; }

    await commit(setEintragStatus(job, i, 'in_arbeit'));
    try {
      const run = await deps.ladeRun(e.aktenzeichen);
      let erzeugt = 0, hinweiseLetzter = 0, alleVorhanden = true;
      for (const stepId of schritte) {
        const vorhanden = run.schritte[stepId]?.status === 'entwurf' || run.schritte[stepId]?.status === 'freigegeben';
        if (vorhanden) continue;
        alleVorhanden = false;
        if (deps.signal.aborted) { await commit(abbrechen(job)); return job; }
        const r = await deps.erzeugeAbschnitt({ aktenzeichen: e.aktenzeichen, fkz: e.fkz, stepId, signal: deps.signal });
        if (r.fehler) throw new Error(`Abschnitt ${stepId} fehlgeschlagen`);
        erzeugt++; hinweiseLetzter = r.hinweise;
      }
      if (erzeugt === 0 && alleVorhanden) {
        await commit(setEintragStatus(job, i, 'uebersprungen', { grund: 'bereits Gutachten-Stand' }));
      } else {
        const last = schritte[schritte.length - 1]!;
        await commit(setEintragStatus(job, i, 'fertig',
          { checkKurz: `${erzeugt}× erzeugt ✓${hinweiseLetzter ? ` (${hinweiseLetzter} Hinweise ${last})` : ''}` }));
      }
    } catch (err) {
      if (deps.signal.aborted) { await commit(abbrechen(job)); return job; }
      // Transport-Verlust mitten im Antrag → pausieren statt Fehler.
      if (!(await deps.transportVerfuegbar())) { await commit(pausieren(job)); return job; }
      await commit(setEintragStatus(job, i, 'fehler', { fehlerText: err instanceof Error ? err.message : String(err) }));
    }
  }
  await commit({ ...job, jobStatus: 'fertig' });
  return job;
}
```

- [ ] **B6.2 Tests (ohne LLM):**
  - **Statusübergänge:** 2 Einträge, Fake `erzeugeAbschnitt` immer erfolgreich → beide `fertig`, `jobStatus fertig`, Reihenfolge sequenziell.
  - **Überspringen vorhandener Stände:** `ladeRun` liefert Run mit allen gewünschten Schritten → Eintrag `uebersprungen` (Grund), `erzeugeAbschnitt` nie gerufen.
  - **Fehlerisolation:** Fake wirft bei Eintrag 1 (Transport bleibt verfügbar) → Eintrag 1 `fehler`, Eintrag 2 `fertig`.
  - **Pausieren bei Transport-Verlust + Fortsetzen:** `transportVerfuegbar` false ab Eintrag 2 → `pausiert`, `aktiverIndex` bleibt; erneuter `runBatch` mit wieder-true → Eintrag 2 `fertig`.
  - **Wiederaufnahme idempotent:** Run-Lookup liefert für bereits erzeugte Schritte Stände → kein Doppelgenerieren.
  - **Abbruch:** vorab `signal.abort()` → `jobStatus abgebrochen`.
  - **`vorherigeAbschnitte`-Quelle:** (in B8-Hook-Test bzw. hier via Spy auf `erzeugeAbschnitt`-Args, dass A→B den Entwurf-A mit „(Entwurf)" sieht — Detail im Hook).

- [ ] **B6.3 Commit:** `feat(batch): sequenzieller Runner mit injizierbaren Deps (testbar ohne LLM)`

---

## Task B7: `useBatchJob.ts` — reale Deps + Antrieb + Resume

**Files:** Create `src/plugins/antraege/gutachten-batch/useBatchJob.ts`.

Verdrahtet die **reale** `erzeugeAbschnitt`-Dep — sie spiegelt `useGutachtenWorkflow.runGeneration`, nutzt aber `quelle:'entwurf'` und den Disk-Spiegel. **Kein zweiter Prompt-Pfad:** identische Primitive (`runSkill`, `runRegelChecks`, `applyGeneration`, `putWorkflowRun`).

- [ ] **B7.1 reale `erzeugeAbschnitt`** (im Hook, mit Closure über bridge/registry/storage):

```ts
// Vorbereitung einmalig: skillMap = buildSkillMap(registryFile) (aus useGutachtenWorkflow extrahieren
//   oder importieren — buildSkillMap ist dort lokal; in ein gemeinsames Modul heben ODER duplizieren mit Verweis).
async function erzeugeAbschnitt({ aktenzeichen, fkz, stepId, signal }) {
  const ctx = await ladeContext(aktenzeichen);               // Verbund + TVs → buildKurzfassungContext
  if (!ctx) return { erzeugt: false, hinweise: 0, fehler: true, uebersprungen: false };
  const sc = skillMap.get(stepId);
  const vb = await resolveVb(storage.idb, ctx);
  if (!sc || !vb) return { erzeugt: false, hinweise: 0, fehler: true, uebersprungen: false };
  const run = await getOrEmptyRun(storage.idb, ctx.key);
  if (run.schritte[stepId]?.status === 'entwurf' || run.schritte[stepId]?.status === 'freigegeben')
    return { erzeugt: false, hinweise: 0, fehler: false, uebersprungen: true };

  const transport = bridge.getActiveTransport();
  const tweak = await loadSkillTweak(storage.idb, persHandle, sc.skill.id).catch(() => null);
  const tweakWirksam = !!(tweak?.aktiv && (tweak.stilHinweise.trim() || tweak.beispielFormulierungen.trim()));
  const result = await runSkill(transport, sc.skill, sc.regeln, {
    stammdaten: buildStammdaten(ctx),
    vbMarkdown: vb.markdown,
    vorherigeAbschnitte: buildVorherigeAbschnitte(run, stepId, ZIM_EP_WORKFLOW, 2000, 'entwurf'), // ← Batch-Quelle
    ...(tweakWirksam ? { tweak } : {}),
    signal,
  });
  const checks = runRegelChecks(result.parsed.finalerText, sc.regeln);
  const gen: GenerationInput = {
    quellenanalyse: result.parsed.quellenanalyse, entwurf: result.parsed.entwurf,
    finalerText: result.parsed.finalerText, checks, modell: transport.name,
    skillId: sc.skill.id, skillVersion: sc.skill.version, vbGekuerzt: result.vbGekuerzt,
    ...(result.parsed.warnung ? { warnung: result.parsed.warnung } : {}),
    ...(tweakWirksam ? { mitTweak: true, tweakGeaendertAm: tweak!.geaendert_am } : {}),
  };
  const now = new Date().toISOString();
  await putWorkflowRun(storage.idb, applyGeneration(run, stepId, gen, now));
  if (persHandle) await spiegeleAbschnitt(persHandle, fkz, stepId, result.parsed.finalerText, now).catch(() => {});
  const hinweise = checks.filter(c => c.level === 'hinweis').length;
  return { erzeugt: true, hinweise, fehler: false, uebersprungen: false };
}
```

- [ ] **B7.2 `buildStammdaten` + `buildSkillMap` teilen:** beide liegen lokal in `useGutachtenWorkflow.ts`. In ein gemeinsames Modul `gutachten/skill-context.ts` extrahieren (verhaltensgleich), aus beiden Hooks importieren — **kein** Duplikat (Anti-Pattern „zweiter Pfad"). `useGutachtenWorkflow` entsprechend umstellen (rein mechanisch).

- [ ] **B7.3 `ladeContext(aktenzeichen)`**: `getVerbund(idb, az)` → falls Verbund: `listAntraegeByVerbund(idb, az)`, lead-first sortieren (gleicher Sort wie VerbundDetail — `kurzfassung/context-builder`-Doku verweist darauf), `buildKurzfassungContext(verbund, tvs, az)`. Falls kein Verbund (Solo): `getAntrag(idb, az)` → `buildKurzfassungContext(null, [antrag], az)`. (APIs aus `csv/idb-csv.ts`.)

- [ ] **B7.4 Hook-API**: `start(kandidaten, abschnitte)`, `pause()`, `resume()`, `abbrechen()`, `job`, `busy`, `error`. Alle Async-Aktionen via `useAsyncAction`. Antrieb: `runBatch(job, deps)` in einem `AbortController`; `onUpdate` → `setJob`. Persist über `putBatchJob`. **Resume**: beim Mount `getBatchJob`; `laeuft|pausiert` → als fortsetzbar anbieten; `resume()` ruft `runBatch` ab `aktiverIndex`. Unmount/`close` → `abort()` (Job bleibt in IDB, beim Wieder-Öffnen fortsetzbar).

- [ ] **B7.5 Smoke-Test** (Hook mit gefaktem bridge/registry — optional, da Runner+Primitive bereits getestet): A→B speist Entwurf-A als „(Entwurf)" (Spy auf `runSkill`-Input).

- [ ] **B7.6 Commit:** `feat(batch): useBatchJob — reale Erzeuger-Dep + Resume`

---

## Task B8: UI — `StartDialog` + `BatchMonitor` + Einhängung

**Files:** Create `StartDialog.tsx`, `BatchMonitor.tsx`, `index.ts`; verdrahten in `AbschlussPanel.tsx` (aus Teil A) + `AufnahmeOverlay.tsx`.

- [ ] **B8.1 `StartDialog.tsx`** (DESIGN_GUIDE Dialog):
  - Mengen-Zusammenfassung aus `berechneMengen` (IO: pro Kandidat `resolveVb` für `hatVb`, `getWorkflowRun` für Stände — im Hook/Dialog-Loader vorab sammeln). Ausschlüsse: „2 übersprungen: keine VB" / „1: bereits Gutachten-Stand".
  - Abschnitts-Pills: „Nur A" (Default) / „A–G" (Filter-Pill-Pattern).
  - **Transport-Status:** `bridge.getActiveProviderName()` + `getActiveTransport().ping()` → „interner Transport · <Modell/Provider>". Nicht erreichbar ⇒ Starten **disabled** + Hinweis.
  - Hinweise (tertiary): „Nur Entwürfe — Freigaben erfolgen einzeln." · „Tab geöffnet lassen — kein Hintergrundlauf."
  - Buttons: „Starten" (Primary, disabled wenn `bereit.length===0` oder Transport weg), „Abbrechen". Start ruft `useBatchJob.start(bereit, abschnitte)`.

- [ ] **B8.2 `BatchMonitor.tsx`**:
  - Zeile je Eintrag: FKZ (Monospace-Badge) · Kurztitel · Live-Status: „in Arbeit…" (Spinner) / „wartet" / „A erzeugt ✓ (2 Hinweise)" (aus `checkKurz`) / „übersprungen: …" (grund) / „fehlgeschlagen" (Danger + `fehlerText`).
  - Gesamtfortschritt „X von N".
  - Steuerung: Pausieren/Fortsetzen/Abbrechen (via Hook, `useAsyncAction`).
  - Link pro Zeile „→ Gutachten-Sektion": `navigate('/antraege/<aktenzeichen>')` (öffnet VerbundDetail; Overlay schließen). 
  - **KEINE** Review-Queue/Facette/Tabellen-Status-Chips.

- [ ] **B8.3 Verdrahtung:** `AbschlussPanel` (A7.5) Button „Gutachten-Entwürfe erzeugen…" → setzt Overlay-Phase auf `start`, übergibt `fkzMitVb` als Kandidaten → `StartDialog`. Nach Start → Phase `monitor` → `BatchMonitor`. **Zusätzlich** (Spec B4 „wieder-öffenbar"): wenn beim Overlay-Mount ein `laeuft|pausiert`-Job existiert, direkt Monitor mit „Fortsetzen" anbieten (auch ohne frischen Teil-A-Lauf).

- [ ] **B8.4 Manuelle Verifikation (dev):** kleiner Satz (2–3 Anträge mit Ordner-VB), „Nur A" starten → Monitor läuft, Entwürfe erscheinen in der Gutachten-Sektion je Antrag; `.md`-Spiegel im persönlichen Ordner; Pausieren/Fortsetzen; Reload → Fortsetzen-Angebot.

- [ ] **B8.5 Commit:** `feat(batch): Start-Dialog + Monitor + Einhängung`

---

## ⏹️ STOP nach Teil B — keine zusätzlichen „Verbesserungen".

---

## Tests & Abschluss

**Vitest Teil A:** Dateinamen-Typ-Map (A1), Frontmatter (A2), Manifest-Löschbar (A3), ZIP-Durchlauf Skip/Reject (A4), FS-Schreiber + VB-Ordner-Fallback inkl. „mehrere VB" (A5/A9), FKZ-Problempfade (über `extractFkzTolerant`/`isValidFkz` in A6/Zeile).

**Vitest Teil B (Runner ohne LLM):** Statusübergänge (B3/B6), Überspringen vorhandener Stände (B6), Pausieren bei Transport-Verlust + Fortsetzen (B6), Wiederaufnahme idempotent (B6), Fehlerisolation (B6), `vorherigeAbschnitte`-Quelle=`entwurf` mit „(Entwurf)"-Marker (B2 + B7-Spy), Mengen-/Ausschluss-Berechnung (B4).

**Convention-Tests grün:** kein `onClick={() => void async()}` ohne `useAsyncAction` (Teil-A-Convert, Teil-B-Steuerung); keine direkten Antrag-/Feedback-Status-Literal-Vergleiche (eigene `EintragStatus`/`StepStatus` sind nicht betroffen); keine rohen Worker.

**Build (Memory):** `npm run build:devprod` (immer). Kein `build:pl`/`build:kurator` nötig (kein `auslastung`-/kurator-Touch; Feature dev-only). HTML per `file://` lädt fehlerfrei, Console sauber.

**Abschlussbericht:** Dateien je Teil, Tests, grobe Laufzeit (s/Antrag „Nur A" und „A–G" auf der Bridge), offene Punkte: **Orama-Indexierung der persönlichen Dokumente** (bewusst nicht), **Disk-Spiegel am geteilten Runner-Punkt** (D2 batch-lokal gelöst), **Review-Queue-Facette / Overnight-Betrieb** (verschoben), **TV-spezifisches Dokument-Scoping** (Verbund-Ebene bleibt).

---

## Self-Review (gegen die Spec)

- **A1 Aufnahme-Flow:** Button (A8) · Drop Dateien/ZIP (A7) · ZIP flach + Skip/Reject (A4) · FKZ via `extractFkzTolerant` + Typ-Vorschlag (A1/A6) · reduzierte Liste ohne Bulk/Filter/Konfidenz (A7) · sequenziell konvertieren+ablegen, Fortschritt+Abbrechen, Fehlerisolation, Abschluss-Zusammenfassung (A6/A7). ✓
- **A2 ZIP-Ablage:** Kopie nach `eingang/` vor Verarbeitung, Manifest, Bestandsblock mit Löschbarkeit, keine IDB-Spiegelung (A5/A7). ✓
- **A3 Frontmatter:** `fkz/typ/quelle/konvertiert_am` (A2). ✓
- **A4 VB-Auflösung:** Ordner-Fallback, IDB-VORRANG (A9). ✓
- **B1 Job-Modell:** Felder + Soft-Hinweis >25 (B1; Hinweis im StartDialog B8). ✓
- **B2 Runner:** Pro Abschnitt runSkill→Checks→`entwurf` identisch zum Einzellauf; `vorherigeAbschnitte` Entwurf-Quelle als Parameter; Idempotenz/kein Überschreiben; Fehlerisolation; Pause bei Transport-Verlust; Wiederaufnahme; reine Zustände getrennt + injizierbare Dep (B2/B6/B7). ✓
- **B3 Tweak:** via `composeSkillPrompt`/`runSkill`, `mitTweak` persistiert, keine Sonderpfade (B7). ✓
- **B4 UI:** Einstieg Abschluss-Panel; Start-Dialog (Mengen/Ausschlüsse/Pills/Transport/Hinweise); Monitor (Live, Fortschritt, Steuerung, Link); keine Review-Queue (B8). ✓
- **Constraints:** keine neuen Deps; Teil A nur persönlicher Ordner + trivialer UI-Zustand; Teil B ein aktiver Job, sequenziell, Transport über `getActiveTransport` (D1), `WorkflowRun`-Format unverändert, additive Stores; Rückwärtskompatibilität (Default-Quelle, additiver VB-Fallback). ✓
- **Anti-Patterns vermieden:** keine Triage/Checkpoints/Orama in A; keine parallele Konvertierung/Generierung; kein zweiter Generierungs-/Prompt-Pfad (geteilte Primitive + `skill-context.ts`-Extraktion); keine Auto-Freigabe/Modifier/Retry; kein Überschreiben vorhandener Stände. ✓
```
