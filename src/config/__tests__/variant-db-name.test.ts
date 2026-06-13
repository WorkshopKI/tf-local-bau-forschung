/**
 * Tests fuer die variantenspezifische IDB-Namens-Ableitung (deriveVariantDbName).
 *
 * Hintergrund: Unter `file://` teilen alle Build-Varianten denselben Origin.
 * Ein konstanter DB-Name `'teamflow'` liess sie in DIESELBE IndexedDB schreiben
 * (Bug-Klasse 1/3, Datenverlust beim Varianten-Wechsel). Pro Variante wird der
 * Name jetzt aus `build.outputFilename` suffigiert. Diese Tests sind der
 * Regressions-Guard fuer die Invariante „nie der nackte 'teamflow'" + die
 * Eindeutigkeit der vier `file://`-Builds (automatisierbarer Teil von Phase C).
 */

import { describe, expect, it } from 'vitest';
import { deriveVariantDbName } from '../runtime-config';

const BASE = 'teamflow';

describe('deriveVariantDbName', () => {
  it('leitet pro Build-Variante einen eindeutigen Namen ab', () => {
    expect(deriveVariantDbName('zah-dev')).toBe('teamflow-zah-dev');
    expect(deriveVariantDbName('zah-demo')).toBe('teamflow-zah-demo');
    expect(deriveVariantDbName('zah-prod')).toBe('teamflow-zah-prod');
    expect(deriveVariantDbName('zah-kurator')).toBe('teamflow-zah-kurator');
    expect(deriveVariantDbName('zah-pl')).toBe('teamflow-zah-pl');
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
    const inputs = ['teamflow', '', undefined, 'zah-prod', 'zah-pl', 'zah-kurator', 'zah-dev', 'zah-demo'];
    for (const input of inputs) {
      const name = deriveVariantDbName(input);
      expect(name).not.toBe(BASE);
      expect(name.startsWith(`${BASE}-`)).toBe(true);
    }
  });

  it('die vier produktiven `file://`-Builds bekommen vier verschiedene DBs', () => {
    const fileProtocolBuilds = ['zah-prod', 'zah-kurator', 'zah-pl', 'zah-demo'];
    const names = fileProtocolBuilds.map(deriveVariantDbName);
    expect(new Set(names).size).toBe(fileProtocolBuilds.length);
  });
});
