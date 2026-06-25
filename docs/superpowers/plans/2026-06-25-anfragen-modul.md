# Modul „Anfragen" (E-Mail-Kurzanfragen → anonymisierte ZIM-Antwort) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, batch with checkpoints). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein dev-only Modul, das eine Outlook-`.msg`-Kurzanfrage aufnimmt (body-only), per interner KI anonymisiert (+ lokales Mapping), guard-gated in die Zwischenablage exportiert, die anonyme Antwort zurücknimmt und sie deterministisch zu einer mail-fertigen finalen Antwort wiedereinsetzt.

**Architecture:** Neues Plugin `src/plugins/anfragen/`, hinter Feature-Flag `features.anfragen` (nur dev). Entität `Anfrage` im generischen `kv`-Store (Key-Prefix `anfrage:<id>`, analog WorkflowRun) — **kein** neuer IDB-Object-Store, **keine** Migration. `.msg`-Parsing über das bereits gebündelte `cfb` (transitiv via `xlsx`) + native `TextDecoder` — **nicht** `msgreader` (Buffer/iconv-lite-Risiko unter `file://`). Anonymisierung als versionierter Skill (`anfrage-anonymisieren`, `aktiv: false`) über die interne Bridge; deterministischer Export-Guard + deterministische Wiedereinsetzung.

**Tech Stack:** React 19 + TS + Vite single-file, react-router-dom `createHashRouter`, Zustand+IDB, `cfb`, `TextDecoder`, Skill-Registry/Bridge, vitest.

---

## Grounded Decisions (Abweichungen vom Literal-Spec, mit Begründung)

| # | Spec sagt | Entscheidung | Grund |
|---|-----------|--------------|-------|
| D1 | Parser = `msgreader` | **Manuelles `cfb` + `TextDecoder`** (RTF-only degradiert) | `msgreader`→`iconv-lite` braucht `Buffer`-Global; kein Polyfill in `vite.config.ts`; Runtime-Crash-Risiko unter `file://` nicht ohne Browser-Build verifizierbar. `cfb` ist schon im Bundle (via `xlsx`), browser-safe, liefert `parse`/`find`. **Das ist der markierte Phase-0-STOPP.** |
| D2 | „neuer IndexedDB-Store" | **`kv`-Store, Prefix `anfrage:<id>`** | Codebase-Muster (WorkflowRun, `doc:*`, `skill-registry:cache`). Vermeidet `idb-store.ts`-Version-Bump + `onupgradeneeded` (= Migration/MAJOR). Erfüllt „backward-compatible, kein Bruch". |
| D3 | „Batchgenerierungs-Komponente (DokumentAufnahme) wiederverwenden" | **`FileDropZone` wiederverwenden**, nicht `DokumentAufnahme` | `DokumentAufnahme` ist VB-gekoppelt (FKZ-Klassifizierung, `doc:*`-Persistenz, Typ-Pills) — falsch für Anfragen. `FileDropZone` (`onFiles`/`accept`/`multiple`) ist das echte wiederverwendbare Upload-Primitive. Erfüllt „nicht duplizieren". |
| D4 | Skill `aktiv: false` | **`aktiv?: boolean` additiv zu `SkillRecord`** | Feld existiert heute nicht. Default: fehlend = aktiv (Bestands-Skills bleiben live); neuer Skill `aktiv: false`; UI gated auf `aktiv === true`. Whitelist in `normalizeSkill`. |
| D5 | „interner Polish" | Opt-in Toggle, **intern**, VOR Wiedereinsetzung | Wie Spec; Default aus. |

---

## File Structure

**Neu:**
- `src/plugins/anfragen/index.ts` — Plugin-Barrel (`TeamFlowPlugin`).
- `src/plugins/anfragen/AnfragenPage.tsx` — Route-Root, MasterDetailLayout.
- `src/plugins/anfragen/types.ts` — `Anfrage`, `Mapping`, `PiiTyp`, `AnfrageStatus`.
- `src/plugins/anfragen/store.ts` — Zustand-Store + `kv`-Persistenz (`anfrage:<id>`).
- `src/plugins/anfragen/AnfrageListe.tsx` — Master-Liste.
- `src/plugins/anfragen/AnfrageDetail.tsx` — Detail mit Status-Stufen.
- `src/plugins/anfragen/AnfrageAufnahme.tsx` — rechte Aufnahme (FileDropZone).
- `src/plugins/anfragen/ReviewEditor.tsx` — editierbare anonyme Version + Live-Guard + Export.
- `src/plugins/anfragen/RueckimportFinalisierung.tsx` — Rückimport + Wiedereinsetzung + Output.
- `src/core/services/msg/parse-msg.ts` — `parseMsg(buf): MsgParsed` (cfb + TextDecoder).
- `src/core/services/msg/__tests__/parse-msg.test.ts` — gegen echte Fixtures.
- `src/plugins/anfragen/services/anonymisierung.ts` — Skill-Run + `parseAnonymisierung`.
- `src/plugins/anfragen/services/export-guard.ts` — `pruefeExportSicher`.
- `src/plugins/anfragen/services/finalisierung.ts` — deterministische Wiedereinsetzung + mailto/Längen-Logik.
- `src/plugins/anfragen/services/__tests__/*.test.ts` — Unit-Tests.
- `src/core/services/skills/registry/anfrage-anonymisieren.seed.ts` — Skill-Seed (`aktiv: false`).
- `src/core/services/eval-fixtures/anfragen/*` — PII-Ground-Truth-Fixtures (fiktiv).
- `eval/anfrage-recall.ts` (oder analog skill-eval) — Recall-Report.

**Modifiziert (additiv/backward-compatible):**
- `src/plugins.config.ts` — `anfragenPlugin` in `allPlugins[]`.
- `src/core/types/plugin.ts` — `PluginFeatureKey` += `'anfragen'`.
- `src/config/runtime-config.ts` — `TeamflowFeatures.anfragen?: boolean`.
- `src/config/feature-flags.ts` — `isAnfragenEnabled()`.
- `scripts/config-schema.mjs` — `DEFAULT_CONFIG.features.anfragen: true` (optional, **nicht** requiredFlags).
- `configs/{dev,prod,pl,kurator,as}.config.json` + `_template.config.jsonc` — `anfragen` setzen (dev true, Rest false).
- `src/core/services/skills/registry/types.ts` — `SkillRecord.aktiv?: boolean`.
- `src/core/services/skills/registry/storage.ts` — `normalizeSkill` whitelistet `aktiv`.
- `src/core/services/skills/registry/seed.ts` — Skill ins `SEED_REGISTRY.skills` (`aktiv: false`).
- `src/__tests__/codebase-conventions.test.ts` — 2 neue Guards.
- `src/theme.css` — falls neue `--tf-*`-Tokens nötig (Status-Ampel) → Light+Dark.
- `CHANGELOG.md`, `package.json#version` (MINOR-Bump → 2.127.0).

---

## Phase 1 — Datenmodell `Anfrage` + kv-Persistenz

**Files:** Create `src/plugins/anfragen/types.ts`, `src/plugins/anfragen/store.ts`, `src/plugins/anfragen/services/__tests__/store.test.ts`.

```ts
// types.ts
export type PiiTyp = 'person'|'firma'|'ort'|'fkz'|'email'|'telefon'|'iban'|'x500'|'hostname'|'sonstiges';
export interface Mapping { platzhalter: string; original: string; typ: PiiTyp }
export type AnfrageStatus = 'aufgenommen'|'anonymisiert'|'export_freigegeben'|'antwort_importiert'|'finalisiert';
export interface Anfrage {
  id: string; status: AnfrageStatus;
  absenderEmail: string; betreff: string; hatAnhaenge: number;
  originalMd: string;            // echte Inhalte — NUR lokal/intern
  anonymisiertMd: string;
  mapping: Mapping[];            // SENSIBELSTE STRUKTUR — nie an Transporte
  externeAntwortAnon: string;
  finaleAntwort: string;
  erstelltAm: string; geaendertAm: string;
}
```

- [ ] Test: `putAnfrage`/`getAnfrage`/`listAnfragen`/`deleteAnfrage` round-trip via `fake-indexeddb` (key `anfrage:<id>`), neue optionale Felder brechen kein bestehendes Schema.
- [ ] Store: Zustand + `storage.idb.set('anfrage:'+id, a)` / `keys('anfrage:')`. Multi-Step-Mutationen in EINEM setState+persist (Pitfall #16/#20-Stil).
- [ ] `npm run check`.

## Phase 2 — Modul, Route, UI-Grundgerüst

**Files:** Create `index.ts`, `AnfragenPage.tsx`, `AnfrageListe.tsx`, `AnfrageDetail.tsx`, `AnfrageAufnahme.tsx`. Modify `plugins.config.ts`, `plugin.ts`, `runtime-config.ts`, `feature-flags.ts`, `config-schema.mjs`, alle `configs/*`.

- [ ] Feature-Flag `anfragen` threaden (5 Touch-Points laut `add-feature-flag.md`, `gutachtenKurzfassung`-Muster: optional, `=== true`).
- [ ] Plugin: `id:'anfragen'`, `route:'/anfragen'`, `featureFlag:'anfragen'`, `category:'workflow'`, `icon:'Mails'`, `order` (~6). Flat-Route (kein Custom-Route-Handler nötig).
- [ ] `AnfragenPage`: `MasterDetailLayout` (`list`=`AnfrageListe`, `detail`=`AnfrageDetail`, `listWidthKey:'anfragen-list-width'`); rechts/oben `AnfrageAufnahme`.
- [ ] Design: monochrome-first, schwarze Primärbuttons, 0.5px Borders, nur `--tf-*`-Tokens.
- [ ] Visueller Checkpoint (manuell durch Thomas — Preview-Server überspringen, App braucht SMB-Onboarding).
- [ ] `npm run check`.

## Phase 3 — `.msg`-Aufnahme (body-only) → Markdown  *(cfb-Pfad, D1)*

**Files:** Create `src/core/services/msg/parse-msg.ts` + `__tests__/parse-msg.test.ts`. Copy 2 echte Fixtures nach `src/core/services/msg/__tests__/fixtures/` (oder Test liest absoluten Pfad).

```ts
export interface MsgParsed {
  betreff: string; absenderEmail: string; absenderDN?: string;
  bodyMarkdown: string; bodyQuelle: 'plain'|'html'|'rtf'|'none'; hatAnhaenge: number;
}
export function parseMsg(buf: ArrayBuffer): MsgParsed;
```

- [ ] cfb: `CFB.parse(new Uint8Array(buf))`, Streams über `CFB.find(cfb, '/__substg1.0_<TAG>')`.
  - Body plain: `1000001F` (UTF-16LE) bevorzugt, sonst `1000001E` (CP-1252 → `TextDecoder('windows-1252')`).
  - Body HTML (Fallback): `10130102` (PT_BINARY) → `TextDecoder` → `turndown` → MD.
  - Body RTF (last resort): `10090102` komprimiert — **degradiert** mit Hinweis „RTF-only Body — bitte manuell prüfen" (LZFu nicht reimplementieren).
  - Betreff: `0037001F`/`0037001E`. Absender SMTP: `5D01001F` (PR_SENDER_SMTP) bzw. `39FE001F`; X.500-DN-Fallback: `0C1F001F`/`0065001F`.
  - Anhänge zählen: `cfb.FullPaths` nach `__attach_` zählen — **nicht** öffnen/extrahieren.
- [ ] Tests gegen beide echte Fixtures: Betreff/Absender/Body nicht leer, Umlaute korrekt (NFC), `hatAnhaenge` plausibel. (Beide sind Antwort-Mails „AW_…": Test erwartet, dass der Body Anfrage **und** Antwort enthält — Modul verarbeitet den Volltext.)
- [ ] `AnfrageAufnahme`: `FileDropZone accept=".msg" onFiles={…}` → `parseMsg` → `putAnfrage(status:'aufgenommen')`. Detail zeigt Absender/Betreff/Body-Preview + Badge „N Anhänge — werden nicht verarbeitet".
- [ ] `npm run check`.

## Phase 4 — Anonymisierungs-Skill (`aktiv: false`)  *(D4)*

**Files:** Modify `types.ts` (SkillRecord.aktiv), `storage.ts` (normalizeSkill whitelist), `seed.ts`. Create `anfrage-anonymisieren.seed.ts`, `services/anonymisierung.ts` + Test.

- [ ] `SkillRecord.aktiv?: boolean` (additiv) + `normalizeSkill` whitelistet es; Test `anfrage-skill-inaktiv`: Seed-Skill `aktiv === false`.
- [ ] Skill-Seed: `id:'anfrage-anonymisieren'`, `aktiv:false`, `promptTemplate` mit Anonymisierungs-Instruktion + `{{zielText}}` (= INHALTS_SLOT ⇒ Transport intern erzwungen). JSON-Output `{anonymisiert, mapping:[{platzhalter,original,typ}]}`, Platzhalter `[TYP_N]`, konsistent. Aggressiv: PII + Header-DN/Hostname + identifizierender Freitext.
- [ ] `anonymisierung.ts`: `runSkill(bridge.getTransportForSkillRun(skill), skill, regeln, {zielText: anfrage.originalMd, stammdaten:'', vbMarkdown:''})` → `result.raw` → `parseAnonymisierung(raw)` (reuse `json-tolerant.ts`: `stripMarkdownWrapper` + toleranter Objekt-Parser). Fallback bei kaputtem JSON: klare Fehlermeldung, `mapping` leer.
- [ ] UI-Button „Anonymisieren" (nur bei `aktiv===true` **und** `status>=aufgenommen`, sonst disabled mit Hinweis); zeigt anonyme Version + Mapping (lokal, gelabelt „verlässt das System nicht"). `useAsyncAction` (Pitfall #15).
- [ ] `npm run check`.

## Phase 5 — Export-Guard (deterministisch)

**Files:** Create `services/export-guard.ts` + Test.

```ts
export interface Treffer { typ: PiiTyp|'original'; wert: string; index: number }
export function pruefeExportSicher(text: string, mapping: Mapping[]): { sicher: boolean; treffer: Treffer[] };
```

- [ ] Mapping-Gegenscan (case-insensitiv, Whitespace-normalisiert) + Pattern-Scan (E-Mail, FKZ `\b\d{2}[A-Z]{2}\d{4,}\b`, Telefon DE, IBAN `\bDE\d{20}\b`, X.500-DN `/O=…/OU=…/CN=…`, Hostnames). Treffer mit Position/Typ.
- [ ] Tests: Leak-Fälle (Original drin, FKZ, X.500, IBAN, Hostname) → `sicher:false`; sauber → `sicher:true`.
- [ ] `npm run check`.

## Phase 6 — Review/Edit-UI + Clipboard-Export

**Files:** Create `ReviewEditor.tsx`. Artifact-URL als Config-Wert (nicht hardcoded) — neuer optionaler Config-Key `anfragen.dashboardUrl` (Default `https://claude.ai/public/artifacts/5faeb8ed-c446-4050-aad8-3464094a2b9f`).

- [ ] Editierbares MD-Feld; **Live-Guard bei JEDEM Tastenanschlag/Kopieren** (`pruefeExportSicher` auf aktuellem Text) — Treffer inline markiert. „Kopieren" disabled solange nicht `sicher`, mit Klartext-Begründung.
- [ ] Kombi-Button „Kopieren & ZIM-Dashboard öffnen": Guard → `navigator.clipboard.writeText` → `<a href={dashboardUrl} target="_blank" rel="noopener noreferrer">` (disabled bis grün). Tooltip: claude.ai-Login nötig.
- [ ] `status='export_freigegeben'`.
- [ ] `npm run check`.

## Phase 7 — Rückimport + Finalisierung (deterministisch)

**Files:** Create `services/finalisierung.ts` + Test, `RueckimportFinalisierung.tsx`.

- [ ] Rückimport-Feld → `externeAntwortAnon`, `status='antwort_importiert'`. Validierung: fehlende/unbekannte Platzhalter warnen.
- [ ] `finalisieren(antwortAnon, mapping): string` = reines Find-Replace `platzhalter→original` (kein LLM). Mail-fertiger Output (Anrede/Text/Gruß) via Template.
- [ ] Optionaler interner Polish (Toggle, Default aus): Bridge-Lauf auf `externeAntwortAnon` **vor** Wiedereinsetzung.
- [ ] `status='finalisiert'`, `finaleAntwort` speichern.
- [ ] `npm run check`.

## Phase 8 — Ausgabe: Clipboard + `mailto`

**Files:** Modify `RueckimportFinalisierung.tsx`.

- [ ] „Finale Antwort kopieren" (primär). „Antwort-Mail öffnen" (mailto: `to=absenderEmail`, `subject=Re: <betreff>`, `body=finaleAntwort`).
- [ ] Längen-Fallback: encodeter Body > ~1800 Zeichen → mailto disabled + Hinweis „bitte kopieren". Code-Kommentar: kein Threading (`In-Reply-To`).
- [ ] `npm run check`.

## Phase 9 — Eval-Gate Recall (Messung, KEINE Aktivierung) — **STOPP**

**Files:** Create fiktive PII-Fixtures + Recall-Report (an bestehende skill-eval-/Fixture-Bundle-Disziplin andocken, DSGVO-Provenance-Guard).

- [ ] Fixtures mit Ground-Truth-PII-Spans über alle `PiiTyp` inkl. Header-DN/Hostname + identifizierenden Freitext.
- [ ] Recall je Typ (Leak-Rate = 1−Recall) + FP-Rate. Report ausgeben.
- [ ] **STOPP:** Recall/Leaks/Empfehlung ausgeben. Skill bleibt `aktiv:false` — Aktivierung nur durch Thomas.
- [ ] `npm run check`.

## Convention-Guards (Phase 1 + 5, in `codebase-conventions.test.ts`)

- [ ] `anfrage-no-mapping-in-transport`: kein Code-Pfad serialisiert `mapping`/`originalMd` in Transport-Payloads (Scan im `anfragen`-Modul: kein `JSON.stringify(...mapping...)`, keine `transport.submit*`/`getActiveTransport` außer dem gegateten Anonymize-Run). Inline-Ausnahme `// allow-anfrage-transport:`.
- [ ] `anfrage-export-only-via-guard`: jede `navigator.clipboard.writeText` / `mailto:`-Konstruktion im `anfragen`-Modul liegt in einer Datei, die `pruefeExportSicher` referenziert (`findFilesViolating`-Stil).

## Globale Anti-Pattern (jede Phase)
Kein externer Netzcall; `mapping`/`originalMd` nie an Transporte; Skill nie `aktiv:true`; Guard nie nur einmalig; De-Anon nie per LLM; Polish nie nach Wiedereinsetzung; Attachments nie ingestieren; IDB only; `--tf-*` nur in `theme.css`; `MAX_FILE_LOC`=980; Guards in `codebase-conventions.test.ts`; backward-compatible.

## Definition of Done
Alle Phasen grün (`npm run check`). `.msg` aufnehmbar (body-only, Anhänge sichtbar/unverarbeitet), anonymisierbar (lokales Mapping), editierbar, guard-gated kopierbar; anonyme Antwort rück-importierbar, deterministisch wiedereinsetzbar → mail-fertig (Clipboard/mailto). Recall gemessen + reportet; Aktivierung Thomas vorbehalten.
