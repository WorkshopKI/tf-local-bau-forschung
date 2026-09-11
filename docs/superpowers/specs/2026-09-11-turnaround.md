# Kürzerer Durchlauf je Feature und Bugfix

Stand: 2026-09-11 · Ausgangspunkt: der Durchlauf wurde nach den Clean-Code-Guards (v6.40) wieder als langsam empfunden.

## 0. Anlass

Nutzer, 11.09.2026: „nachdem wir weitere checks (clean code etc.) eingebaut haben, wird die erledigung von neuen features und bugfixing etc. wieder langsam, können wir da was beschleunigen um die turnaround zeiten zu verkürzen? Ich habe auch Opus im Modus Effort Extra laufen, bringt es etwas wenn ich das auf high runtersetze? (das hatte ich früher schon mal versucht, da kamen aber dan fehler rein)"

## 1. Warum

Die Bitte vermutet die Checks als Ursache. Gemessen sitzt die Zeit woanders: in der Modellzeit je Commit, im Prozesstext um den Code herum und im Warten auf Freigaben. Wer an den Guards spart, verliert Sicherheit und gewinnt kaum Zeit.

## 2. Befunde aus dem Bestand

Gemessen am 11.09.2026 mit `npm run turnaround` (Sitzungsprotokolle `~/.claude/projects/*fzd*`, nur Hauptlauf, Lücken > 15 min als Leerlauf): 06.–11.09. (19 Sitzungen, 40 Commits) gegen 30.07.–12.08. und 13.–26.08. (136 Sitzungen, 660 Commits). Gate-Laufzeiten aus einem eigenen Messlauf.

| Befund | 06.–11.09. | August | Quelle |
|---|---|---|---|
| Gate-Laufzeiten | Typecheck 1,5 s · Lint 3,1 s · cycles 2,3 s · `check:docs` 8,0 s · Suite 40 s (820 Dateien) | Suite 26 s (632 Dateien) | Messlauf 11.09. |
| Gate-Zeit je Commit | 2,3 min | 3,0–3,2 min | turnaround |
| rote Gate-Läufe je Commit | 1,3 (Clean-Code-Guards 4× rot) | 1,6–1,9 | turnaround |
| Claude-aktiv je Commit | 19,5 min, davon Modell 14,1 | 16,3 / 28,5 min, Modell 8,2 / 19,8 | turnaround |
| Output-Tokens je Commit | 81k | 54–64k | turnaround |
| Geschriebenes je Commit | 38k Zeichen | 43–48k Zeichen | turnaround |
| Latenz nach Kontextgröße | kurze Antworten 4,0 s (150k) gegen 4,6 s (> 450k) | — | Protokolle, ~62 000 Aufrufe |
| Prozesstext am Geschriebenen | Plan 10 % · Doku 9 % · Spec 7 % · Memory 6 % · Changelog 4 % | — | turnaround |
| Nutzer-Warten je Commit | 4,7 min; `defaultMode: "plan"` für jede Sitzung | 4,3–5,5 min | turnaround, `~/.claude/settings.json` |
| Browser-Abnahme je Commit | 1,6 min; 9× `__tf` undefined, 7× 45-s-Timeout, 8× Navigation im Script | 2,1–2,8 min | turnaround + Fehlertexte |
| volle Suite je Commit | `check:quick` (30×) + `check` (45×) ≈ 1,8 Läufe | — | Protokolle |

Mehr Output bei weniger Geschriebenem heißt: mehr Denken. Wie viele Minuten das kostet, lässt sich nicht sauber trennen — die Modellzeit je Token schwankt zwischen den Perioden (Ende August 19,8 min bei 54k Tokens).

## 3. Entwurf

Entscheidungen der Grill-Runde:

- **Effort bleibt `xhigh`, kein `/fast`.** `high` brachte früher Nachfixe, ein Nachfix kostet einen ganzen Commit (~20 min).
- **Plan-Modus ab Schwelle, von Claude selbst aufgerufen** — kleiner Bugfix ohne Plan-Freigabe.
- **Spec und Plan in einer Datei**, Schwelle ohne „mehr als fünf Dateien"; Memory nur bei neuer Lehre.
- **Doku-Nachzug als Hintergrund-Agent** (Experiment), parallel zu Build und Abnahme.

Dazu ohne Entscheidungsbedarf: ein Gate-Lauf statt zwei (`check:quick` = Alias), `bereit()` unter der 45-s-Werkzeuggrenze, und die Messung als Script, damit das Experiment nachgemessen wird.

## 4. Schritte

1. `~/.claude/settings.json`: `defaultMode` → `"default"`; CLAUDE.md „Planung" (Plan-Modus ab Schwelle, Rückfragen vorn gebündelt, eine Spec, Memory sparsam); [entwicklungsprozess.md](../../architecture/entwicklungsprozess.md).
2. [docs/superpowers/README.md](../README.md): ein Artefakt, neue Schablone mit `## 4. Schritte`.
3. `package.json`: `check:quick` → `npm run check`; CLAUDE.md „Entwicklungs-Gate": gezielte Tests im inneren Loop, volle Suite einmal.
4. [window-hook.ts](../../../src/dev-fixtures/window-hook.ts): `bereit()`-Standard 40 s; [local-variante.md](../../architecture/local-variante.md): Warte-Einzeiler + Fallstrick 11.
5. [.claude/agents/doku-nachzug.md](../../../.claude/agents/doku-nachzug.md) + Guard in [agent-konfiguration.test.ts](../../../src/__tests__/agent-konfiguration.test.ts) (Agent-Frontmatter).
6. [scripts/turnaround-metrik.mjs](../../../scripts/turnaround-metrik.mjs) + `npm run turnaround`.
7. Version, Changelog, Memory.

## 5. Verifikation

- Agent-Guard einmal rot (Agent ohne `name`), dann grün; `npm run check` grün; `build:devpl` Exit-Code 0.
- `dev:local`: Reload im eigenen Aufruf, dann Warte-Einzeiler + `bereit()` ohne Fehler; `window.__tf.fehler()` = 0.
- `npm run turnaround -- --seit 2026-09-06 --bis 2026-09-12` reproduziert die Zahlen aus §2.
- Nach etwa zehn Commits erneut messen: Nutzer-Warten je Commit unter 3 min, Claude-aktiv je Commit sinkt, rote Läufe nicht über 1,3 — sonst den Doku-Agenten zurückbauen.
