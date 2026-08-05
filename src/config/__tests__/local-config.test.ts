/**
 * Guards für die Variante „local" (feste Entwickler-Ordner statt FSAPI-Picker).
 *
 * Der `local`-Block haengt den Ordner-Picker aus und verdrahtet absolute Pfade.
 * Er darf deshalb NIE in einer ausgelieferten Variante landen — diese Datei
 * haelt die Schema-Seite dieser Zusage fest (die zweite Schicht ist das
 * `__TEAMFLOW_LOCAL_FS__`-Define, das an `command === 'serve'` haengt).
 *
 * Zusätzlich: die konkrete `configs/local.config.json` muss valide bleiben und
 * darf sich die Prod-Defaults aus `_shared.json` (N:\-Pfad, Ordnername-Check)
 * NICHT zurückmergen — genau das war beim Entwurf die Falle.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — reines Node-ESM-Modul ohne Typen (Build-Layer, kein src/).
import { validateConfig, deepMerge, DEFAULT_CONFIG, buildBasis } from '../../../scripts/config-schema.mjs';

interface ValidationResult {
  errors: string[];
  warnings: string[];
  valid: boolean;
}
type Config = Record<string, unknown>;

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const lade = (name: string): Config =>
  JSON.parse(readFileSync(join(REPO, 'configs', name), 'utf-8')) as Config;

const shared = lade('_shared.json');
const gemergt = (name: string): Config => deepMerge(deepMerge(buildBasis(), shared), lade(name)) as Config;
const pruefe = (c: Config): ValidationResult => validateConfig(c) as ValidationResult;

const LOCAL = gemergt('local.config.json');
const local = LOCAL.local as Record<string, unknown>;

describe('local-Block: Schema-Guards', () => {
  it('DEFAULT_CONFIG.local ist null (aus, solange niemand ihn setzt)', () => {
    expect((DEFAULT_CONFIG as Config).local).toBeNull();
  });

  it('lehnt den local-Block in variant="production" KRITISCH ab', () => {
    const res = pruefe({ ...LOCAL, variant: 'production' });
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.startsWith('KRITISCH:') && e.includes('local-Block'))).toBe(true);
  });

  it('verlangt absolute Pfade', () => {
    const res = pruefe({ ...LOCAL, local: { ...local, datenShare: './daten' } });
    expect(res.errors.some(e => e.includes('local.datenShare') && e.includes('ABSOLUTER Pfad'))).toBe(true);
  });

  it('lehnt ".." in Pfaden ab', () => {
    const res = pruefe({ ...LOCAL, local: { ...local, datenShare: 'C:\\a\\..\\b' } });
    expect(res.errors.some(e => e.includes('local.datenShare') && e.includes('".."'))).toBe(true);
  });

  it('prueft auch die Slot-Maps (dmsSources / csvSourceFiles)', () => {
    const res = pruefe({ ...LOCAL, local: { ...local, dmsSources: { x: 'relativ' } } });
    expect(res.errors.some(e => e.includes('local.dmsSources["x"]'))).toBe(true);
  });

  it('warnt, wenn OpenRouter aktiv ist (echte Daten in der Kopie)', () => {
    const res = pruefe({ ...LOCAL, ki: { ...(LOCAL.ki as Config), openrouter: { enabled: true, allowedModels: [] } } });
    expect(res.warnings.some(w => w.includes('OpenRouter'))).toBe(true);
  });

  it('akzeptiert Configs ohne local-Block unveraendert', () => {
    // Geglobbt statt gepflegt: die frühere harte Liste schleppte `kurator` und
    // `as` noch mit, als es die Varianten längst nicht mehr gab.
    const varianten = readdirSync(join(REPO, 'configs'))
      .filter(f => f.endsWith('.config.json') && f !== 'local.config.json');
    expect(varianten.length).toBeGreaterThan(0);
    for (const datei of varianten) {
      const res = pruefe(gemergt(datei));
      expect(res.valid, `${datei}: ${res.errors.join(' | ')}`).toBe(true);
    }
  });
});

describe('configs/local.config.json', () => {
  it('ist valide und warnungsfrei', () => {
    const res = pruefe(LOCAL);
    expect(res.valid, res.errors.join(' | ')).toBe(true);
    expect(res.warnings, res.warnings.join(' | ')).toEqual([]);
  });

  it('mergt die Prod-Defaults aus _shared.json NICHT zurueck', () => {
    // Ohne die expliziten null-Overrides zoege _shared.json den N:\-Share-Pfad
    // und den "ZAH"-Ordnername-Check in die Variante — der Picker lehnte dann
    // jeden lokalen Ordner ab.
    const data = LOCAL.data as Config;
    expect(data.fixedDataSharePath).toBeNull();
    expect(data.expectedFolderName).toBeNull();
  });

  it('hat KEINEN auth-Block (sonst stuende eine Passwort-Wall vor dem Start)', () => {
    expect(LOCAL.auth ?? null).toBeNull();
  });

  it('laeuft als DevContext, nicht als Produktionsvariante', () => {
    expect(LOCAL.variant).toBe('custom');
  });

  it('hat einen eigenen IndexedDB-Namen (teilt sich nichts mit `npm run dev`)', () => {
    const build = LOCAL.build as Config;
    expect(build.outputFilename).toBe('zah-local');
    expect(build.outputFilename).not.toBe('teamflow');
  });

  it('deaktiviert maLogin — die Share-Kopie enthaelt auslastung-zugang.enc', () => {
    // Mit maLogin=true triggert die vorhandene Zugangsdatei das MaLoginGate
    // (App.tsx) und die Automation haengt an einer Anmeldemaske.
    expect((LOCAL.features as Config).maLogin).toBe(false);
  });

  it('seedet ein Profil (sonst landet die frische IDB im Onboarding)', () => {
    expect((local.profil as Config | undefined)?.name).toBeTruthy();
  });
});
