/**
 * Guard über die Agent-Konfiguration — die Dateien, die Claude Code steuern,
 * nicht die App: Skills unter `.claude/skills/`, Hooks und Deny-Regeln in
 * `.claude/settings.json`, der Bash-Wächter, und die Spec-Artefakte unter
 * `docs/superpowers/specs/`.
 *
 * Das ist der statische Ersatz für „Continuous Evals" der Agent-Konfiguration
 * (docs/architecture/entwicklungsprozess.md): was sich ohne Modell prüfen
 * lässt, wird hier geprüft, in `npm run check:docs` (~6 s). Eigene Datei statt
 * Teil der `conventions-*.test.ts`: geprüft wird die Steuerung, nicht der Code.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractHrefs, stripAnchor, isRelativeDocLink } from './conventions-lib';
import { pruefeBefehl } from '../../scripts/hooks/bash-guard.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SKILLS_DIR = resolve(ROOT, '.claude/skills');
const AGENTS_DIR = resolve(ROOT, '.claude/agents');
const SPECS_DIR = resolve(ROOT, 'docs/superpowers/specs');

/** `.claude/skills/<name>/SKILL.md`, sortiert — leer, wenn der Ordner fehlt. */
function skillDateien(): Array<{ ordner: string; pfad: string }> {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR)
    .filter(e => statSync(join(SKILLS_DIR, e)).isDirectory())
    .map(ordner => ({ ordner, pfad: join(SKILLS_DIR, ordner, 'SKILL.md') }))
    .sort((a, b) => a.ordner.localeCompare(b.ordner));
}

/** Minimaler Frontmatter-Leser: `---`-Block am Dateianfang, `key: value` je Zeile. */
function frontmatter(md: string): Record<string, string> | null {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (m === null) return null;
  const out: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv === null) continue;
    out[kv[1]!] = kv[2]!.replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

describe('agent-konfiguration', () => {
  it('jeder Skill hat Frontmatter mit name = Ordnername und einer Beschreibung ≤ 1024 Zeichen', () => {
    const skills = skillDateien();
    expect(skills.length, 'mindestens ein Skill unter .claude/skills/').toBeGreaterThan(0);
    const fehler: string[] = [];
    for (const { ordner, pfad } of skills) {
      if (!existsSync(pfad)) { fehler.push(`${ordner}: SKILL.md fehlt`); continue; }
      const fm = frontmatter(readFileSync(pfad, 'utf8'));
      if (fm === null) { fehler.push(`${ordner}: kein Frontmatter-Block`); continue; }
      if (fm.name !== ordner) fehler.push(`${ordner}: name "${fm.name ?? ''}" ≠ Ordnername`);
      if (!fm.description) fehler.push(`${ordner}: description fehlt`);
      else if (fm.description.length > 1024) fehler.push(`${ordner}: description ${fm.description.length} Zeichen (> 1024)`);
    }
    expect(fehler, fehler.join('\n')).toEqual([]);
  });

  it('jeder Zeiger-Skill verlinkt existierende Dateien (Cheatsheets, Docs)', () => {
    const fehler: string[] = [];
    for (const { ordner, pfad } of skillDateien()) {
      if (!existsSync(pfad)) continue;
      const dir = dirname(pfad);
      for (const href of extractHrefs(readFileSync(pfad, 'utf8'))) {
        if (!isRelativeDocLink(href)) continue;
        const ziel = resolve(dir, stripAnchor(href));
        if (!existsSync(ziel)) fehler.push(`${ordner}: ${href}`);
      }
    }
    expect(fehler, `Kaputte Links in Skills:\n${fehler.join('\n')}`).toEqual([]);
  });

  it('jeder Agent unter .claude/agents/ hat Frontmatter mit name = Dateiname und einer Beschreibung', () => {
    expect(existsSync(AGENTS_DIR), '.claude/agents/ fehlt').toBe(true);
    const dateien = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md')).sort();
    expect(dateien.length, 'mindestens ein Agent unter .claude/agents/').toBeGreaterThan(0);
    const fehler: string[] = [];
    for (const datei of dateien) {
      const fm = frontmatter(readFileSync(join(AGENTS_DIR, datei), 'utf8'));
      if (fm === null) { fehler.push(`${datei}: kein Frontmatter-Block`); continue; }
      const erwartet = datei.replace(/\.md$/, '');
      if (fm.name !== erwartet) fehler.push(`${datei}: name "${fm.name ?? ''}" ≠ Dateiname`);
      if (!fm.description) fehler.push(`${datei}: description fehlt`);
    }
    expect(fehler, fehler.join('\n')).toEqual([]);
  });

  it('.claude/settings.json ist parsebar und jedes Hook-Skript existiert', () => {
    const pfad = resolve(ROOT, '.claude/settings.json');
    expect(existsSync(pfad), '.claude/settings.json fehlt (versionierte Team-Konfiguration)').toBe(true);
    const cfg = JSON.parse(readFileSync(pfad, 'utf8')) as {
      hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
      permissions?: { deny?: string[] };
    };
    expect(cfg.permissions?.deny?.length ?? 0, 'Deny-Regeln für eingefrorene Pfade').toBeGreaterThan(0);
    const kommandos = Object.values(cfg.hooks ?? {})
      .flat()
      .flatMap(e => e.hooks ?? [])
      .map(h => h.command ?? '');
    expect(kommandos.length, 'mindestens ein Hook').toBeGreaterThan(0);
    const fehlend: string[] = [];
    for (const cmd of kommandos) {
      const m = cmd.match(/scripts\/hooks\/([\w.-]+)/);
      if (m === null) { fehlend.push(`${cmd}: kein scripts/hooks/-Skript referenziert`); continue; }
      if (!existsSync(resolve(ROOT, 'scripts/hooks', m[1]!))) fehlend.push(`${cmd}: scripts/hooks/${m[1]} fehlt`);
    }
    expect(fehlend, fehlend.join('\n')).toEqual([]);
  });

  describe('bash-guard: pruefeBefehl()', () => {
    const BLOCKIERT: Array<[string, string]> = [
      ['cat <<EOF > x.txt', 'heredoc'],
      ["cat <<'EOF'", 'heredoc'],
      ['cat <<-EOF', 'heredoc'],
      ['python - <<< "print(1)"', 'heredoc'],
      ['$msg = @"\nZeile\n"@', 'here-string'],
      ['git add -A', 'git add'],
      ['git add .', 'git add'],
      ['git add --all', 'git add'],
      ['git add -u', 'git add'],
      ['git -C "C:/repo" add -A', 'git add'],
      ['git status && git add -A && git commit -m x', 'git add'],
      ['git push --force', 'verwerfend'],
      ['git push -f origin master', 'verwerfend'],
      ['git push origin master --force', 'verwerfend'],
      ['git reset --hard HEAD~1', 'verwerfend'],
      ['git checkout -- .', 'verwerfend'],
      ['git restore .', 'verwerfend'],
      ['git clean -fd', 'verwerfend'],
      ['git stash drop', 'verwerfend'],
    ];
    const ERLAUBT = [
      'git status --short',
      'git add src/x.ts docs/y.md',
      'git add .claude/settings.json',
      'git add ./src/x.ts',
      'git commit -F .git/COMMIT_MSG.tmp',
      'git push',
      'git push --force-with-lease',
      'git restore --staged src/x.ts',
      'git stash list',
      'npm run check',
      'echo "EXIT: $?"',
      'ls -la',
    ];
    for (const [cmd, klasse] of BLOCKIERT) {
      it(`blockt (${klasse}): ${cmd.replace(/\n/g, '⏎')}`, () => {
        const grund = pruefeBefehl(cmd);
        expect(grund, `sollte geblockt sein: ${cmd}`).not.toBeNull();
        expect(grund!.length).toBeGreaterThan(10);
      });
    }
    for (const cmd of ERLAUBT) {
      it(`lässt durch: ${cmd}`, () => {
        expect(pruefeBefehl(cmd)).toBeNull();
      });
    }
    it('leeres oder fehlendes Kommando ist kein Fehler', () => {
      expect(pruefeBefehl('')).toBeNull();
      expect(pruefeBefehl(undefined)).toBeNull();
    });
  });

  it('jede Spec unter docs/superpowers/specs/ trägt einen Abschnitt „## 0. Anlass"', () => {
    if (!existsSync(SPECS_DIR)) return;
    const ohne = readdirSync(SPECS_DIR)
      .filter(f => f.endsWith('.md'))
      .filter(f => !/^## 0\. Anlass\s*$/m.test(readFileSync(join(SPECS_DIR, f), 'utf8')));
    expect(ohne, `Specs ohne "## 0. Anlass":\n${ohne.join('\n')}`).toEqual([]);
  });
});
