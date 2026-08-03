# docs/_archiv — Momentaufnahmen

Protokolle, Audits, erledigte Pläne, Historie. **Nicht lesen beim Arbeiten am Code** — die Inhalte beschreiben vergangene Stände und führen zu falschen Annahmen.

Wer wissen will, wie etwas *heute* funktioniert, liest die lebende Referenz unter `docs/architecture/`, `docs/status-system/` oder `docs/agents/`. Wer wissen will, *wann* sich etwas geändert hat, liest den Changelog. Dieses Verzeichnis beantwortet nur die dritte Frage: wie ein bestimmter Zustand einmal aussah.

Dateien behalten beim Verschieben ihren Namen (weniger Link-Churn). Links **innerhalb** des Archivs dürfen ins Leere zeigen; Links aus lebenden Docs **auf** das Archiv müssen stimmen.

## Inhalt

| Datei | Was es festhält |
|---|---|
| `CHANGELOG-ARCHIV.md` | Ältere Changelog-Blöcke; `npm run version:bump` rotiert automatisch hierher. Seit v2.393 **nicht mehr** ins Bundle eingebettet. |
| `protokoll-abschnitts-journey.md` | Umsetzungsprotokoll der Abschnitts-Journey (v2.334–v2.337). |
| `protokoll-artefakt-werkbank.md` | Umsetzungsprotokoll der Artefakt-Werkbank (v2.308–v2.315). |
| `prompt-audit-2026-07.md` | Prüfung aller Repo-Prompts gegen zehn Defektmuster (Juli 2026). |
| `testplan-assistent-phase0-2.md` | Manueller Testplan der Assistent-Phasen 0–2. |
| `assistent-backlog-dock-ideen.md` | Ideensammlung zum Assistent-Dock. |
| `superpowers/` | Plan-/Spec-Dokumente vergangener Feature-Runden (`plans/`, `specs/`). |
| `BESTANDSAUFNAHME.md` | Verifizierter Ausgangszustand vor dem Status-System-Umbau. |
| `HISTORIE.md` | Historie des Status-Systems. |
| `vorgangssystem-p6-inventar.md` | P6-Rückbau-Inventar (99 `SpinePhase`-Stellen), abgearbeitet mit v2.385. |
| `eval-paket4/` | Baseline-Registries + Report der Paket-4-Belege-Eval. |

## Was bewusst NICHT hier liegt

`docs/audit-akzeptiert.md` (Register akzeptierter npm-audit-Findings), `docs/layout-audit.md` (Adoptions-Status der Layout-Schicht), `docs/map-testleitfaden.md` und `docs/architecture/fachabstimmung-2026-08.md` (Quelle der AB-Regeln A1–A5/V1–V10) heißen zwar „Audit"/„Protokoll", werden aber fortgeschrieben und beantworten je eine Zeile im CLAUDE.md-Decision-Tree. Sie bleiben lebende Referenz.
