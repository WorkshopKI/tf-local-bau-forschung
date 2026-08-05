/**
 * Guards für das Favicon (Monogramm „Z" als Inline-`data:`-URI).
 *
 * Zwei Zusagen halten hier fest:
 *
 * 1. Die Farbe wird in Markup interpoliert — `faviconDataUri` muss alles
 *    ablehnen, was nicht exakt `#rrggbb` ist, und der Schema-Validator muss
 *    eine kaputte Farbe in einer Config als Fehler melden statt sie still auf
 *    den Default fallen zu lassen.
 * 2. Jede ausgelieferte Variante hat eine EIGENE Farbe. Genau das ist der Zweck
 *    (mehrere Builds gleichzeitig offen); rutschen zwei auf denselben Wert, ist
 *    die Unterscheidung still weg und niemand merkt es.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faviconDataUri, faviconLinkTag, FAVICON_DEFAULT_COLOR } from '../../../scripts/favicon.mjs';
// @ts-expect-error — reines Node-ESM-Modul ohne Typen (Build-Layer, kein src/).
import { validateConfig, deepMerge, buildBasis } from '../../../scripts/config-schema.mjs';

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
const gemergt = (name: string): Config =>
  deepMerge(deepMerge(buildBasis(), shared), lade(name)) as Config;
const pruefe = (c: Config): ValidationResult => validateConfig(c) as ValidationResult;

const VARIANTEN = readdirSync(join(REPO, 'configs')).filter(f => f.endsWith('.config.json'));

describe('faviconDataUri', () => {
  it('liefert einen vollstaendig kodierten data:-URI', () => {
    const uri = faviconDataUri('#506786');
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    // Ein rohes `#` wuerde den URI als Fragment abschneiden — das Icon waere weg.
    expect(uri.includes('#')).toBe(false);
    expect(uri.includes('<')).toBe(false);
  });

  it('dekodiert zu einem SVG mit der uebergebenen Farbe', () => {
    const svg = decodeURIComponent(faviconDataUri('#3f7a5a').slice('data:image/svg+xml,'.length));
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('fill="#3f7a5a"');
    // Buchstabe als <path>, nicht als <text>: ein SVG-Favicon rendert ohne
    // Zugriff auf die Fonts des Dokuments.
    expect(svg).toContain('<path');
    expect(svg).not.toContain('<text');
  });

  it.each(['rot', '#12', '#5067866', '', '"><script>alert(1)</script>'])(
    'faellt bei ungueltiger Farbe (%j) auf den Default zurueck',
    (kaputt) => {
      const svg = decodeURIComponent(faviconDataUri(kaputt).slice('data:image/svg+xml,'.length));
      expect(svg).toContain(`fill="${FAVICON_DEFAULT_COLOR}"`);
      expect(svg).not.toContain('script');
    },
  );

  it('faellt auch ohne Argument auf den Default zurueck', () => {
    expect(faviconDataUri()).toBe(faviconDataUri(FAVICON_DEFAULT_COLOR));
  });
});

describe('index.html', () => {
  const html = readFileSync(join(REPO, 'index.html'), 'utf-8');

  it('traegt genau einen Icon-Link', () => {
    expect(html.match(/<link rel="icon"/g)?.length).toBe(1);
  });

  it('haelt den statischen Default byte-gleich zu favicon.mjs', () => {
    // Der Tag steht zweimal: statisch hier (greift im Dev-Server vor dem Hook
    // und in einem rohen `vite build`) und generiert im Build-Hook. Driftet die
    // Kopie, faellt es nirgends auf — ausser hier.
    expect(html).toContain(faviconLinkTag(FAVICON_DEFAULT_COLOR));
  });

  it('bleibt fuer den Build-Hook ersetzbar (eine Zeile, Regex trifft)', () => {
    // Der Hook in vite.config.ts ersetzt via /<link rel="icon"[^>]*>/ — ein
    // umgebrochener Tag wuerde still nicht mehr getroffen.
    const treffer = /<link rel="icon"[^>]*>/.exec(html);
    expect(treffer).not.toBeNull();
    expect(treffer?.[0]).toContain('data:image/svg+xml,');
  });
});

describe('faviconColor in den Variant-Configs', () => {
  it('ist ueberall gesetzt und hat die Form #rrggbb', () => {
    expect(VARIANTEN.length).toBeGreaterThan(0);
    for (const datei of VARIANTEN) {
      const build = lade(datei).build as Record<string, unknown>;
      expect(build.faviconColor, `${datei}: build.faviconColor fehlt`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('ist pro Variante verschieden (sonst ist die Unterscheidung still weg)', () => {
    const farben = VARIANTEN.map(d => (lade(d).build as Record<string, string>).faviconColor);
    expect(new Set(farben).size).toBe(farben.length);
  });

  it('wird vom Validator geprueft statt still verworfen', () => {
    const basis = gemergt('prod.config.json');
    const kaputt = { ...basis, build: { ...(basis.build as Config), faviconColor: 'blau' } };
    const res = pruefe(kaputt);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('faviconColor'))).toBe(true);
  });

  it('bleibt optional (weggelassen ist gueltig)', () => {
    const basis = gemergt('prod.config.json');
    const build = { ...(basis.build as Config) };
    delete build.faviconColor;
    expect(pruefe({ ...basis, build }).valid).toBe(true);
  });
});
