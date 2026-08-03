/**
 * Baut die BASELINE-Registry für das Paket-4-Eval-Gate: die aktuelle SEED_REGISTRY,
 * aber A + B mit den VOR-Paket-4-Templates (byte-verifiziert via den Buildern) +
 * version 1. Der Kandidat-Lauf nutzt den Code-Seed (neu) OHNE --registry; der
 * Baseline-Lauf nutzt --registry auf diese Datei. So misst der Vergleich exakt die
 * Kontrakt-Änderung — gleiches Modell/Judge/Fixtures, nur das Template unterscheidet sich.
 */
import { writeFileSync } from 'node:fs';
import {
  SEED_REGISTRY,
  buildKurzfassungPrompt,
  abschnittTemplate,
  B_ABSCHNITT_OPTS,
  KURZFASSUNG_SKILL_ID,
  AUSGANGSLAGE_SKILL_ID,
} from '@/core/services/skills/registry/seed';

const altA = buildKurzfassungPrompt(false);
const altB = abschnittTemplate({ ...B_ABSCHNITT_OPTS });

const baseline = {
  ...SEED_REGISTRY,
  skills: SEED_REGISTRY.skills.map(s => {
    if (s.id === KURZFASSUNG_SKILL_ID) return { ...s, promptTemplate: altA, version: 1 };
    if (s.id === AUSGANGSLAGE_SKILL_ID) return { ...s, promptTemplate: altB, version: 1 };
    return s;
  }),
};

writeFileSync('eval/paket4-baseline-registry.json', JSON.stringify(baseline, null, 2));
const a = baseline.skills.find(s => s.id === KURZFASSUNG_SKILL_ID);
const b = baseline.skills.find(s => s.id === AUSGANGSLAGE_SKILL_ID);
console.log('baseline registry written:', baseline.skills.length, 'skills');
console.log('A hat Beleg-Marke?', a?.promptTemplate.includes('→ stützt Satz'));
console.log('B hat Beleg-Marke?', b?.promptTemplate.includes('→ stützt Satz'));
