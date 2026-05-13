# CSV-Preview-Spaltendichte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSV-Vorschau in Schritt 1 des Source-Wizards rendert alle Spalten mit content-aware Auto-Fit-Breiten plus Native-Tooltip auf trunkierten Werten; Spaltennamen erscheinen zusätzlich als ausklappbare Chip-Liste oberhalb der Tabelle.

**Architecture:** Eine reine Helper-Funktion `computeColumnWidth(header, values)` liefert pro Spalte eine Pixelbreite. `useMemo` über `state.preview` puffert ein `Record<headerName, px>`-Mapping je Parse-Durchlauf. Der Tabellen-Render-Block bekommt die Breiten als Inline-Styles plus native `title=`-Tooltips. Ein neues `<Collapsible>` zwischen Format-Block und Tabelle zeigt alle Spaltennamen als Chips, gegated auf >8 Spalten.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, bereits in der Datei verwendete shadcn/ui Collapsible, lucide-react `ChevronDown`/`ChevronRight`.

**Spec-Referenz:** [docs/superpowers/specs/2026-04-29-csv-preview-density-design.md](../specs/2026-04-29-csv-preview-density-design.md)

**Test-Strategie:** Das Repo hat keine React-Test-Suite. Verifikation läuft über (a) ein Smoke-Test-Skript für die pure Helper-Funktion (`node`-ausführbar, einmalig in Task 1) und (b) visuelle Kontrolle im `build:dev`-Output am Ende.

---

## Task 1: Helper `computeColumnWidth` einführen

**Files:**
- Modify: `src/plugins/csv-sources-admin/wizard/Step1Metadata.tsx` (Helper als modulinterne Top-Level-Funktion einfügen, vor `Step1Metadata`)
- Create: `scripts/test-csv-preview-width.mjs` (Smoke-Test, Node-ausführbar, **wird nach Verifikation wieder gelöscht** — siehe Task 4)

- [ ] **Step 1: Smoke-Test-Datei anlegen**

Lege `scripts/test-csv-preview-width.mjs` mit dem folgenden Inhalt an. Spiegelt die Helper-Logik 1:1 in Plain-JS:

```js
// Smoke-Test fuer computeColumnWidth.
// Wird in Task 4 wieder geloescht — die Logik selbst lebt in Step1Metadata.tsx.

function computeColumnWidth(header, values) {
  const headerLen = Math.min(header.length, 24);
  const maxValLen = values.reduce(
    (m, v) => Math.max(m, Math.min(String(v ?? '').length, 24)),
    0,
  );
  const ch = Math.max(4, headerLen, maxValLen);
  const px = ch * 7.2 + 12;
  return Math.min(Math.max(px, 56), 200);
}

const cases = [
  { name: 'short header + short values',  in: ['FKZ', ['37', '34']],                          want: [56, 60] },
  { name: 'medium header + IDs',          in: ['FREMDKENNZ', ['16KN021932', '16KN033501']],   want: [84, 96] },
  { name: 'long value capped at 24 chars',in: ['x', ['Lorem ipsum dolor sit amet consectetur']], want: [184, 200] },
  { name: 'empty values fall back to min',in: ['x', []],                                       want: [56, 56] },
  { name: 'header longer than values',    in: ['Aktenplanzuordnung', ['kl', 'kl']],            want: [140, 145] },
];

let failed = 0;
for (const c of cases) {
  const got = computeColumnWidth(c.in[0], c.in[1]);
  const ok = got >= c.want[0] && got <= c.want[1];
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${c.name} -> ${got} (want ${c.want[0]}-${c.want[1]})`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Smoke-Test ausführen**

Run: `node scripts/test-csv-preview-width.mjs`
Expected output:
```
PASS: short header + short values -> 56 (want 56-60)
PASS: medium header + IDs -> 84 (want 84-96)
PASS: long value capped at 24 chars -> 184.8 (want 184-200)
PASS: empty values fall back to min -> 56 (want 56-56)
PASS: header longer than values -> 141.6 (want 140-145)
```
Exit code 0.

Falls FAIL: Logik anpassen, bis alle Cases passen. Erst dann weiter.

- [ ] **Step 3: Helper in Step1Metadata.tsx einfügen**

Nach den existierenden Top-Level-Konstanten (`SEPARATOR_LABEL`, `ENCODING_LABEL`, vor `interface Step1Props`) diesen Block einfügen:

```ts
/**
 * Liefert eine Pixel-Breite fuer eine CSV-Vorschau-Spalte.
 * Untergrenze 56 px, Obergrenze 200 px, kalibriert auf 11px-Schrift.
 *
 * @example computeColumnWidth('FKZ', ['37'])             // ≈ 56
 * @example computeColumnWidth('FREMDKENNZ', ['16KN021']) // ≈ 84
 * @example computeColumnWidth('x', ['Lorem ipsum dolor sit amet consectetur']) // 200
 */
function computeColumnWidth(header: string, values: readonly string[]): number {
  const headerLen = Math.min(header.length, 24);
  const maxValLen = values.reduce(
    (m, v) => Math.max(m, Math.min((v ?? '').length, 24)),
    0,
  );
  const ch = Math.max(4, headerLen, maxValLen);
  const px = ch * 7.2 + 12;
  return Math.min(Math.max(px, 56), 200);
}
```

- [ ] **Step 4: TypeScript-Check**

Run: `npx tsc -b`
Expected: kein Fehler. Helper ist private (kein `export`), wird in Task 2 referenziert.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-csv-preview-width.mjs src/plugins/csv-sources-admin/wizard/Step1Metadata.tsx
git commit -m "$(cat <<'EOF'
feat(csv-wizard): computeColumnWidth-Helper fuer Vorschau-Auto-Fit

Pure Helper-Funktion, die pro Header+Sample-Werte eine Pixelbreite zwischen
56 und 200 liefert. Smoke-Test als scripts/test-csv-preview-width.mjs (Logik
gespiegelt; Skript wird nach UI-Integration entfernt).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Vorschau-Tabelle umschreiben — alle Spalten + Auto-Width + Tooltips + 5 Zeilen

**Files:**
- Modify: `src/plugins/csv-sources-admin/wizard/Step1Metadata.tsx` (Imports erweitern, useMemo für `columnWidths`, Render-Block der Tabelle ersetzen)

- [ ] **Step 1: `useMemo` zu den React-Imports hinzufügen**

Aktuell (Zeile 1):
```ts
import { useRef, useState } from 'react';
```
Ändern zu:
```ts
import { useRef, useState, useMemo } from 'react';
```

- [ ] **Step 2: `columnWidths`-Memo in der Komponente einführen**

Direkt unter dem letzten `useState`-Hook (nach `const [showTestCorpus, setShowTestCorpus] = useState(false);`, vor `async function handleEncodingChange`) einfügen:

```ts
const columnWidths = useMemo<Record<string, number>>(() => {
  if (!state.preview) return {};
  const m: Record<string, number> = {};
  for (const h of state.preview.headers) {
    const samples = state.preview.rows.map(r => String(r[h] ?? ''));
    m[h] = computeColumnWidth(h, samples);
  }
  return m;
}, [state.preview]);
```

- [ ] **Step 3: Render-Block der Tabelle ersetzen**

Suche in der Datei den Block, der mit `{state.preview.headers.length > 0 ? (` beginnt (aktuell Zeile 176) und mit `) : null}` endet (aktuell Zeile 203). Ersetze ihn vollständig durch:

```tsx
{state.preview.headers.length > 0 ? (
  <div className="overflow-x-auto">
    <table className="text-[11px]" style={{ tableLayout: 'fixed' }}>
      <thead>
        <tr className="text-left text-[var(--tf-text-tertiary)]">
          {state.preview.headers.map(h => {
            const w = columnWidths[h];
            return (
              <th
                key={h}
                title={h}
                style={{ width: w, minWidth: w, maxWidth: w }}
                className="px-1.5 py-0.5 font-medium border-b border-[var(--tf-border)] whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {h}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {state.preview.rows.slice(0, 5).map((row, i) => (
          <tr key={i} className="text-[var(--tf-text)]">
            {state.preview!.headers.map(h => {
              const w = columnWidths[h];
              const v = row[h] ?? '';
              return (
                <td
                  key={h}
                  title={v}
                  style={{ width: w, minWidth: w, maxWidth: w }}
                  className="px-1.5 py-0.5 border-b border-[var(--tf-border)] whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  {v}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
) : null}
```

Änderungen ggü. dem alten Block (zur Selbst-Kontrolle):
- `.slice(0, 8)` auf Headern und Cells **entfernt**
- `slice(0, 3)` auf Rows → `slice(0, 5)`
- `…+N` Pseudo-Spalte komplett **entfernt**
- `<table className="... w-full">` → `<table className="..." style={{ tableLayout: 'fixed' }}>` (kein `w-full` mehr — die Tabelle wird so breit wie die Summe der fixen Spaltenbreiten)
- Jede `<th>` und `<td>` bekommt `title={…}` + `style={{ width, minWidth, maxWidth }}`
- `<th>` bekommt zusätzlich `overflow-hidden text-ellipsis` (war vorher nur auf `<td>`)
- `<td>`'s `max-w-[180px]` ist durch das Inline-`maxWidth` ersetzt (deshalb auch im className entfernt)

- [ ] **Step 4: TypeScript-Check**

Run: `npx tsc -b`
Expected: kein Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/csv-sources-admin/wizard/Step1Metadata.tsx
git commit -m "$(cat <<'EOF'
feat(csv-wizard): Vorschau zeigt alle Spalten mit Auto-Fit-Breiten

Hard-Cap auf 8 Spalten und die Pseudo-Spalte "+154" entfernt; Tabelle rendert
jetzt alle Header in horizontaler Scroll-Lane. Pro Spalte wird via
computeColumnWidth eine Breite zwischen 56 und 200 px berechnet, abgeleitet
aus Header und ersten 5 Sample-Zeilen. Native title-Tooltip auf <th> und <td>
zeigt vollen Wert bei Trunkierung. Datenzeilen-Cap von 3 auf 5 (Parser laedt
sie ohnehin).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Chip-Liste „Alle Spaltennamen" als Collapsible

**Files:**
- Modify: `src/plugins/csv-sources-admin/wizard/Step1Metadata.tsx` (neuer `useState`, neuer Collapsible-Block zwischen Format-Block und Tabelle)

- [ ] **Step 1: State für Collapsible-Open-Zustand**

Direkt nach `const [showTestCorpus, setShowTestCorpus] = useState(false);` (Zeile 38 im aktuellen Stand) eine zusätzliche Zeile einfügen:

```ts
const [showAllHeaders, setShowAllHeaders] = useState(false);
```

- [ ] **Step 2: Chip-Liste-Block einfügen**

Suche im JSX die Stelle, an der der Format-Erkennungs-Block (`<div className="flex flex-wrap gap-2 mb-2">…Encoding…Separator…</div>`) endet. Direkt **nach** dem schließenden `</div>` dieses Blocks (im aktuellen Stand Zeile 175) und **vor** dem Beginn der Tabelle (`{state.preview.headers.length > 0 ? (`) diesen neuen Block einfügen:

```tsx
{state.preview.headers.length > 8 ? (
  <Collapsible open={showAllHeaders} onOpenChange={setShowAllHeaders} className="mb-2">
    <CollapsibleTrigger asChild>
      <button
        type="button"
        className="flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] transition"
      >
        {showAllHeaders ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span>Alle {state.preview.headers.length} Spaltennamen anzeigen</span>
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent className="mt-1.5 max-h-[160px] overflow-y-auto">
      <div className="flex flex-wrap gap-1">
        {state.preview.headers.map(h => (
          <span
            key={h}
            className="px-1.5 py-0.5 rounded bg-[var(--tf-hover)] text-[10.5px] text-[var(--tf-text-secondary)]"
          >
            {h}
          </span>
        ))}
      </div>
    </CollapsibleContent>
  </Collapsible>
) : null}
```

Anmerkungen:
- Gating auf `> 8` Spalten: bei kleinen CSVs sind alle Header in der Tabelle direkt sichtbar, der Trigger wäre Quark.
- `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` sind in Zeile 5 bereits importiert; `ChevronDown`/`ChevronRight` ebenfalls (Zeile 2).
- `max-h-[160px] overflow-y-auto` am `CollapsibleContent` deckelt die Höhe, falls 200+ Header geladen werden.

- [ ] **Step 3: TypeScript-Check**

Run: `npx tsc -b`
Expected: kein Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/csv-sources-admin/wizard/Step1Metadata.tsx
git commit -m "$(cat <<'EOF'
feat(csv-wizard): Collapsible-Liste aller Spaltennamen ueber der Vorschau

Bei CSVs mit mehr als 8 Spalten erscheint zwischen Format-Block und Tabelle
ein ausklappbarer Trigger 'Alle N Spaltennamen anzeigen'. Inhalt: kompakte
Chips, scrollbar gedeckelt auf 160 px. Default eingeklappt — Tabelle bleibt
primaerer Sanity-Check.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Build, visuelle Verifikation, Smoke-Test aufräumen

**Files:**
- Delete: `scripts/test-csv-preview-width.mjs`

- [ ] **Step 1: Dev-Build erzeugen**

Run: `npm run build:dev`
Expected (letzte Zeilen):
```
✓ Build fertig: …\dist-single\dev\teamflow-dev.html
✓ Dokumentenindex-Helper liegt unter: …\dist-single\Dokumentenindex-aktualisieren.bat
```

- [ ] **Step 2: HTML im Browser öffnen und Wizard durchklicken**

Doppelklick auf `dist-single/dev/teamflow-dev.html`.

Schritte im Browser:
1. Onboarding/Welcome ggf. einmalig durchgehen.
2. Sidebar → Kurator-Bereich (`Programme` oder `CSV-Sources`) öffnen.
3. „Neue Source" / „CSV-Source anlegen" auf Schritt 1.
4. Eine Antrags-CSV mit ≥ 100 Spalten hochladen. Falls keine zur Hand, eine der Test-Korpus-CSVs aus `public/test-korpus/bauforschung-v2/` laden — die haben weniger Spalten, decken aber Auto-Width und Tooltip ab. Für die Spec-Werte (sichtbar mehr als 8 Spalten gleichzeitig) bestenfalls eine reale ≥150-Spalten-CSV nehmen.

Akzeptanz-Checks (Spec-Verweis [Akzeptanz-Kriterien](../specs/2026-04-29-csv-preview-density-design.md#akzeptanz-kriterien)):
- [ ] Mehr als 8 Spalten gleichzeitig sichtbar (bei großer CSV); horizontaler Scroll vorhanden.
- [ ] Pseudo-Spalte „…+N" existiert nicht mehr.
- [ ] Hover über trunkierten Header oder trunkierter Zelle zeigt vollen Wert (nativer Browser-Tooltip).
- [ ] Bei > 8 Spalten: Trigger „Alle N Spaltennamen anzeigen" sichtbar und default eingeklappt.
- [ ] Trigger geöffnet: alle Header als Chips, vertikal auf 160 px gescrollt falls länger.
- [ ] Encoding-Wechsel UTF-8 ↔ Windows-1252: Spaltenbreiten passen sich an, kein offensichtlicher Layout-Bruch.
- [ ] Datenzeilen-Anzahl in der Vorschau: 5 (nicht 3).

Falls ein Kriterium fehlschlägt: Code reparieren (gehe zurück zur betroffenen Task), erneut bauen, erneut prüfen.

- [ ] **Step 3: Smoke-Test-Skript wieder entfernen**

Die Logik wurde in Step1Metadata.tsx integriert und visuell verifiziert. Das `scripts/test-csv-preview-width.mjs` würde nur duplizierte Logik tragen, die mit der TypeScript-Quelle aus dem Sync laufen kann.

```bash
rm scripts/test-csv-preview-width.mjs
```

- [ ] **Step 4: Commit (Cleanup)**

```bash
git add scripts/test-csv-preview-width.mjs
git commit -m "$(cat <<'EOF'
chore(csv-wizard): temporaeren Smoke-Test fuer computeColumnWidth entfernen

Logik lebt in Step1Metadata.tsx; Auto-Fit-Verhalten ist visuell verifiziert.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(`git add` mit gelöschter Datei trägt den Delete in den Index; falls bevorzugt: `git rm scripts/test-csv-preview-width.mjs` als ein-Schritt-Variante.)

---

## Spec-Coverage-Check

| Spec-Anforderung | Task |
|---|---|
| 1. Alle Spalten via horizontalem Scroll erreichbar | Task 2 (Slice entfernt) |
| 2. Spaltenbreiten content-aware | Task 1 + 2 (`computeColumnWidth` + Inline-Style) |
| 3. Tooltip bei Trunkierung | Task 2 (`title=`-Attribut) |
| 4. Ausklappbare Chip-Liste der Spaltennamen | Task 3 |
| 5. Re-Compute bei Encoding-/Separator-Wechsel | Task 2 (`useMemo` mit `state.preview`-Dependency, das beim Re-Parse neu gesetzt wird) |
| 6. 5 Datenzeilen statt 3 | Task 2 (`slice(0, 5)`) |
| 7. Touchpoint = Step1Metadata.tsx | alle Tasks (außer temp-Skript in Task 1, gelöscht in Task 4) |
