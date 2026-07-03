# Konsolidierungs-Pass Juli 2026 — Baseline (Arbeitsdokument)

> **Temporäres Arbeitsdokument.** Wird in Phase 6 wieder gelöscht.
> Hält die Ausgangszahlen fest, damit der Abschluss ein Vorher/Nachher zeigen kann.

## Repo-Stand bei Start

- HEAD: `05132ea` — `feat(feedback): Kurator-Detail-Panel resizable + Abhaken-Haken sichtbarer (v2.163.0)`
- Working-Tree: clean.
- **Hinweis:** Der Ausgangs-Prompt basierte auf v2.161.1 (`caefed7`). Zwischenzeitlich hat eine
  Parallel-Session v2.161.2–v2.163.0 committet. Basis ist damit **v2.163.0** — Prompt-Bedingung
  „`6f7e053` oder neuer" erfüllt. Konsequenz: Der Versions-Bump in Phase 6 zielt auf die nächste
  MINOR **über** 2.163.0 → **2.164.0** (nicht mehr das im Ursprungs-Prompt genannte 2.162.0, das
  wäre ein Downgrade).

## Baseline-Zahlen (Ist bei Start)

| Kennzahl | Wert |
|---|---|
| Tests (vitest) | **2691** in 259 Dateien, alle grün |
| `npm run check` | grün (typecheck + test + build:dev, Build 5.93 s) |
| Dateien mit `TODO(refactor v2.4+)` | **10** |
| Größte Nicht-Test-Datei | `src/core/services/infrastructure/smb-handle.ts` — **846** LOC |
| Größte Datei überhaupt | `src/__tests__/codebase-conventions.test.ts` — 1180 LOC (`MAX_FILE_LOC=1190`) |
| CHANGELOG.md | **2619** Zeilen |
| Phase-5-Ziel `SuchSeite.tsx` | 643 LOC |
| Phase-5-Ziel `CsvSourcesPage.tsx` | 568 LOC |

## Die 10 `TODO(refactor v2.4+)`-Dateien

1. `src/plugins/auslastung/views/ZuweisungsCockpit.tsx`
2. `src/plugins/auslastung/components/KalibrierungsReport.tsx`
3. `src/plugins/filter-kuration/dialogs/FilterEditDialog.tsx`
4. `src/plugins/dokumente/DokumenteListe.tsx`
5. `src/plugins/auslastung/views/admin/SetupWizard.tsx`
6. `src/plugins/csv-sources-kuration/wizard/Step1Metadata.tsx`
7. `src/plugins/suche/SuchSeite.tsx` — **Phase 5a**
8. `src/plugins/csv-sources-kuration/CsvSourcesPage.tsx` — **Phase 5b**
9. `src/plugins/dokumente/DokumentSidePanel.tsx`
10. `src/plugins/einstellungen/MeineTechnologienTab.tsx`

Dieser Pass zerlegt nur #7 + #8; die übrigen 8 bleiben unangetastet (opportunistisch beim nächsten Feature-Touch).

## CHANGELOG-Archiv-Grenze (für Phase 1a)

- CHANGELOG.md reicht aktuell von v2.163.0 (oben) bis **v2.76.0** (unten, ~Zeile 2611).
- `docs/CHANGELOG-ARCHIV.md` (423 Zeilen) beginnt oben mit **v2.75.0** — nahtlos anschließend.
- Zu archivieren: **v2.130.1 → v2.76.0** (CHANGELOG.md ab Zeile 1286 bis EOF), oberhalb von v2.75.0
  ins Archiv voranstellen. Behalten: v2.163.0 → v2.131.0 (Zeilen 1–1285).
