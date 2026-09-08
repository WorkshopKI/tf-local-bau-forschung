#!/usr/bin/env node
/**
 * PreToolUse-Hook für Bash/PowerShell in Claude Code — deterministische
 * Leitplanke für drei Regeln, die als Prosa in CLAUDE.md stehen und dort
 * regelmäßig gebrochen wurden:
 *
 *   1. Shell-Konvention 1: keine Heredocs / Here-Strings (Windows-Shell).
 *   2. Parallele Sessions: `git add` nur mit Pathspec, nie `-A`/`.`/`-u`.
 *   3. Verwerfende Git-Operationen führt der Nutzer selbst im Terminal aus.
 *
 * Aufruf durch Claude Code (`.claude/settings.json`): das Tool-Input kommt als
 * JSON auf stdin; Exit 2 + Grund auf stderr blockt den Aufruf, Exit 0 lässt ihn
 * durch. Parse-Fehler → Exit 0 (fail-open): ein kaputter Hook darf die Session
 * nicht lahmlegen. Kein Bypass-Marker — Determinismus ist der Zweck.
 *
 * Die Regeln leben in `pruefeBefehl()` (pur, getestet in
 * src/__tests__/agent-konfiguration.test.ts); `main()` ist nur die stdin-Hülle.
 * Ohne `.sh` im Dateinamen, damit die Windows-Autoerkennung von Claude Code
 * nichts voranstellt. Kontext: docs/architecture/entwicklungsprozess.md.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Ein Shell-Segment endet an `|`, `;`, `&` oder Zeilenende — so trifft
// `git status && git add -A` das zweite Segment, nicht das erste.
const SEG = String.raw`[^|;&\r\n]*?`;

const REGELN = [
  {
    name: 'heredoc',
    muster: /<<-?\s*['"]?[A-Za-z_]|<<<\s*\S/,
    grund:
      'Shell-Konvention 1 (CLAUDE.md): keine Heredocs/Here-Strings — den mehrzeiligen Inhalt mit dem Write-Tool in eine Datei schreiben und die Datei verwenden (Commit-Message: .git/COMMIT_MSG.tmp + git commit -F).',
  },
  {
    name: 'here-string-powershell',
    muster: /@["']\s*(\r?\n|$)/,
    grund:
      'Shell-Konvention 1 (CLAUDE.md): keine PowerShell-Here-Strings (@"…"@) — den Inhalt mit dem Write-Tool in eine Datei schreiben und die Datei verwenden.',
  },
  {
    name: 'git-add-ohne-pathspec',
    muster: new RegExp(String.raw`\bgit\b${SEG}\badd\b${SEG}(\s(-A|--all|-u|--update)(\s|$)|\s\.(\s|$))`),
    grund:
      'Parallele Sessions (CLAUDE.md): nur eigene Dateien per Pathspec stagen — `git status --short` ansehen, dann `git add <datei> …`; nie -A, --all, -u oder ".".',
  },
  {
    name: 'git-verwerfend',
    muster: new RegExp(
      String.raw`\bgit\b${SEG}\b(` +
        String.raw`push\b${SEG}\s(--force|-f)(\s|$)` +
        String.raw`|reset\s+--hard` +
        String.raw`|checkout\s+--\s+\.(\s|$)` +
        String.raw`|restore\s+(--staged\s+)?\.(\s|$)` +
        String.raw`|clean\s+-[a-zA-Z]*f` +
        String.raw`|stash\s+(drop|clear)` +
        String.raw`)`,
    ),
    grund:
      'Verwerfende Git-Operation (force-push, reset --hard, checkout/restore ".", clean -f, stash drop): der Nutzer führt sie selbst im Terminal aus. Erlaubt bleibt --force-with-lease.',
  },
];

/**
 * Prüft ein Shell-Kommando gegen die Regeln.
 * @param {string | undefined} befehl
 * @returns {string | null} Grund der Blockade oder null (durchlassen).
 */
export function pruefeBefehl(befehl) {
  if (typeof befehl !== 'string' || befehl.trim() === '') return null;
  for (const regel of REGELN) {
    if (regel.muster.test(befehl)) return `[bash-guard:${regel.name}] ${regel.grund}`;
  }
  return null;
}

function main() {
  let eingabe;
  try {
    eingabe = JSON.parse(readFileSync(0, 'utf8'));
  } catch (e) {
    process.stderr.write(`[bash-guard] stdin nicht lesbar/parsebar, lasse durch: ${e?.message ?? e}\n`);
    process.exit(0);
  }
  const befehl = eingabe?.tool_input?.command;
  const grund = pruefeBefehl(befehl);
  if (grund === null) process.exit(0);
  process.stderr.write(`${grund}\n`);
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
