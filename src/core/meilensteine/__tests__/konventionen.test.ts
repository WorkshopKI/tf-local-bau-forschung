/**
 * Modul-lokale Guards des Meilenstein-Moduls (Vorbild
 * `map-foerderfaehig/__tests__/konventionen.test.ts`). Sie sichern die drei
 * Zusagen, die man einer Datei nicht ansieht:
 *
 * 1. Der Plan ist eine EIGENE Sidecar — er darf nie in den CSV-Snapshot oder in
 *    die Skill-Registry rutschen.
 * 2. Risiko-Meldungen gehen ausschließlich in den persönlichen Ordner, nie auf
 *    den Daten-Share (Pitfall #24/#26).
 * 3. Die vb_phase→Antragstyp-Zuordnung hat genau eine Heimat.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

const MODUL = join(process.cwd(), 'src', 'core', 'meilensteine');
const SRC = join(process.cwd(), 'src');

function dateienIn(dir: string, out: string[] = []): string[] {
  for (const eintrag of readdirSync(dir, { withFileTypes: true })) {
    const pfad = join(dir, eintrag.name);
    if (eintrag.isDirectory()) dateienIn(pfad, out);
    else if (/\.tsx?$/.test(eintrag.name)) out.push(pfad);
  }
  return out;
}

const MODUL_DATEIEN = dateienIn(MODUL).filter(f => !f.includes(`${sep}__tests__${sep}`));

describe('meilenstein-plan-share-only', () => {
  it('der Plan-Pfad taucht nur im eigenen Storage-Modul auf', () => {
    const treffer = dateienIn(SRC)
      .filter(f => !f.includes(`${sep}__tests__${sep}`))
      .filter(f => readFileSync(f, 'utf-8').includes('_intern/meilensteine.json'))
      .map(f => f.slice(SRC.length + 1));
    expect(treffer).toEqual([join('core', 'meilensteine', 'plan-storage.ts')]);
  });

  it('die Meilenstein-Dateien stehen in keiner Snapshot-Liste', () => {
    const snapshot = readFileSync(join(SRC, 'core', 'services', 'csv', 'snapshot.ts'), 'utf-8');
    expect(snapshot).not.toContain('meilenstein');
  });

  it('das Modul schreibt nichts in registry.json oder den Personal-Mirror', () => {
    for (const datei of MODUL_DATEIEN) {
      const inhalt = readFileSync(datei, 'utf-8');
      expect(inhalt, datei).not.toContain('registry.json');
      expect(inhalt, datei).not.toContain('savePersonalSettings');
      expect(inhalt, datei).not.toContain('writeSnapshot');
    }
  });
});

describe('meilenstein-risiken-personal-only', () => {
  const risiko = readFileSync(join(MODUL, 'risiko-storage.ts'), 'utf-8');

  it('nutzt den persönlichen Handle, nie den Daten-Share', () => {
    expect(risiko).toContain('getPersoenlichHandle');
    expect(risiko).not.toContain('getDatenShareHandle');
  });

  it('kennt kein Löschen — eine verschwundene Warnung wäre schlimmer als eine veraltete', () => {
    expect(risiko).not.toMatch(/\bremoveEntry\b/);
    expect(risiko).toContain('erledigeRisiko');
  });

  it('nur `plan-storage.ts` fasst den Daten-Share an', () => {
    const mitShare = MODUL_DATEIEN
      .filter(f => readFileSync(f, 'utf-8').includes('getDatenShareHandle'))
      .map(f => f.slice(MODUL.length + 1));
    expect(mitShare).toEqual(['plan-storage.ts']);
  });
});

describe('no-hardcoded-antragstyp', () => {
  // Die vb_phase-Zahlen (3=FuE, 5=DS, 4=DL, 1|2=NW) leben genau einmal in
  // vb-phase-mappings.ts. Ein zweites Mapping wuerde beim naechsten neuen
  // Foerderformat still auseinanderlaufen.
  const ERLAUBT = [
    join('core', 'utils', 'vb-phase-mappings.ts'),
  ];

  it('vergleicht nirgends direkt gegen einen Antragstyp-Literal', () => {
    const pattern = /(vb_phase|vbPhase)\s*[!=]==?\s*['"]?[1-5]['"]?/;
    const treffer = dateienIn(SRC)
      .filter(f => !f.includes(`${sep}__tests__${sep}`) && !f.endsWith('.test.ts'))
      .filter(f => !ERLAUBT.some(e => f.endsWith(e)))
      .filter(f => {
        const zeilen = readFileSync(f, 'utf-8').split('\n');
        return zeilen.some(z => {
          const t = z.trim();
          if (t.startsWith('//') || t.startsWith('*')) return false;
          if (z.includes('allow-antragstyp')) return false;
          return pattern.test(z);
        });
      })
      .map(f => f.slice(SRC.length + 1));
    expect(treffer).toEqual([]);
  });
});
