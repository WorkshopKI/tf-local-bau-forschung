/**
 * Tests fuer die variantenspezifische IDB-Namens-Ableitung (deriveVariantDbName).
 *
 * Hintergrund: Unter `file://` teilen alle Build-Varianten denselben Origin.
 * Ein konstanter DB-Name `'teamflow'` liess sie in DIESELBE IndexedDB schreiben
 * (Bug-Klasse 1/3, Datenverlust beim Varianten-Wechsel). Pro Variante wird der
 * Name jetzt aus `build.outputFilename` suffigiert.
 *
 * v3.0: Die Varianten-Liste wird aus `configs/` GELESEN statt gepflegt. Die
 * frühere harte Liste schleppte `zah-demo` mit, das es seit Monaten nicht mehr
 * gab, und haette den Wegfall von `zah-kurator`/`zah-as` nicht bemerkt.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveVariantDbName } from '../runtime-config';

const BASE = 'teamflow';
const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

/** `build.outputFilename` jeder real vorhandenen Config. */
const OUTPUT_NAMEN = readdirSync(join(REPO, 'configs'))
  .filter(f => f.endsWith('.config.json'))
  .map(f => JSON.parse(readFileSync(join(REPO, 'configs', f), 'utf-8')) as { build?: { outputFilename?: string } })
  .map(c => c.build?.outputFilename)
  .filter((n): n is string => typeof n === 'string' && n.length > 0);

describe('deriveVariantDbName', () => {
  it('suffigiert jeden Ausgabenamen', () => {
    expect(deriveVariantDbName('zah-dev')).toBe('teamflow-zah-dev');
    expect(deriveVariantDbName('zah-pl')).toBe('teamflow-zah-pl');
    // v3.0: prod heisst jetzt zim-dashboard — der DB-Name zieht mit, bestehende
    // prod-Installationen laufen deshalb EINMALIG durch Onboarding + Ordner-
    // Freigabe + Profil (Share = Quelle der Wahrheit, IDB = Cache).
    expect(deriveVariantDbName('zim-dashboard')).toBe('teamflow-zim-dashboard');
  });

  it('mappt den Dev-Server-Sentinel `teamflow` auf den stabilen `teamflow-dev`', () => {
    // DEFAULT_CONFIG.build.outputFilename === 'teamflow' (npm run dev).
    expect(deriveVariantDbName('teamflow')).toBe('teamflow-dev');
  });

  it('faellt bei undefined/leer deterministisch auf `teamflow-dev` zurueck', () => {
    expect(deriveVariantDbName(undefined)).toBe('teamflow-dev');
    expect(deriveVariantDbName('')).toBe('teamflow-dev');
  });

  it('liefert NIE den nackten `teamflow` (sonst lebt die geteilte DB weiter)', () => {
    for (const input of [...OUTPUT_NAMEN, 'teamflow', '', undefined]) {
      const name = deriveVariantDbName(input);
      expect(name).not.toBe(BASE);
      expect(name.startsWith(`${BASE}-`)).toBe(true);
    }
  });

  it('jede real gebaute Variante bekommt eine EIGENE DB', () => {
    expect(OUTPUT_NAMEN.length).toBeGreaterThan(1);
    const namen = OUTPUT_NAMEN.map(deriveVariantDbName);
    expect(new Set(namen).size).toBe(OUTPUT_NAMEN.length);
  });
});
