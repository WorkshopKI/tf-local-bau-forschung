/**
 * Generiert die PILOT-Registry für das teilStruktur-Mess-Gate (Phase 5).
 *
 * Bewusst NICHT in `seed.ts`/`registry.live.json` — so trägt KEIN Produktiv-/
 * fresh-install-Skill `teilStruktur`, bevor das Gate grün ist. Diese Datei wird
 * NUR der CLI-Eval über `--registry` gefüttert (resolveRegistry → normalizeSkill
 * trägt teilStruktur durch, seit Phase 2).
 *
 * Lauf (Node-Kontext, wie die CLI — vite-node liefert die __TEAMFLOW_*__-defines):
 *   npx vite-node --config vitest.config.mts eval/build-teilstruktur-pilot-registry.ts
 *
 * Erzeugt: eval/registry-teilstruktur-pilot.json (committet, idempotent).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEED_REGISTRY, type SkillRegistryFile, type TeilDeklaration, type TeilJoin } from '@/core/services/skills';

interface PilotPatch {
  teilStruktur: TeilDeklaration[];
  teilJoin: TeilJoin;
}

// B = primärer Pilot (saubere Baseline, echte Textwand) → \n\n (Absätze gewünscht).
// A = sekundärer Pilot (Stresstest „viele winzige Felder") → \n (weich, Fließtext bleibt flüssig).
const PATCHES: Record<string, PilotPatch> = {
  'gutachten-ausgangslage': {
    teilStruktur: [
      { key: 'hintergrund', label: 'Hintergrund' },
      { key: 'stand_der_technik', label: 'Stand der Technik' },
      { key: 'loesungsweg', label: 'Lösungsweg' },
    ],
    teilJoin: '\n\n',
  },
  'gutachten-kurzfassung': {
    teilStruktur: [
      { key: 'ausgangsproblem', label: 'Ausgangsproblem' },
      { key: 'projektziel', label: 'Projektziel' },
      { key: 'technischer_ansatz', label: 'Technischer Ansatz' },
      { key: 'erwartetes_ergebnis', label: 'Erwartetes Ergebnis' },
      { key: 'anwendungsbereich', label: 'Anwendungsbereich' },
    ],
    teilJoin: '\n',
  },
};

const registry: SkillRegistryFile = {
  ...SEED_REGISTRY,
  skills: SEED_REGISTRY.skills.map(s => {
    const patch = PATCHES[s.id];
    return patch ? { ...s, teilStruktur: patch.teilStruktur, teilJoin: patch.teilJoin } : s;
  }),
};

const patched = registry.skills.filter(s => PATCHES[s.id]).map(s => s.id);
if (patched.length !== Object.keys(PATCHES).length) {
  throw new Error(`Pilot-Patch unvollständig — gefunden: ${patched.join(', ')}`);
}

const outPath = fileURLToPath(new URL('./registry-teilstruktur-pilot.json', import.meta.url));
writeFileSync(outPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
console.log(`✓ Pilot-Registry geschrieben: ${outPath}`);
console.log(`  teilStruktur gesetzt auf: ${patched.join(', ')}`);
