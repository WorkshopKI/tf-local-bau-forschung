/**
 * Die beiden Versions-Marker des Bookmarklets sind ein VERTRAG zwischen der
 * `.js`-Quelle und `snippet.ts`: dort werden sie per Regex herausgelesen, statt
 * sie ein zweites Mal hinzuschreiben. Benennt jemand sie um oder ändert die
 * Schreibweise, bricht nicht der Build — die App zeigt dann still „v1" und
 * warnt nie mehr vor einem veralteten Lesezeichen.
 *
 * **Was dieser Test NICHT kann:** erzwingen, dass beide Nummern gemeinsam
 * hochgezählt werden. Ob jemand beide Zeilen angefasst hat, steht nirgends im
 * Code. Geprüft wird die Lesbarkeit und die Länge des Lesezeichen-Namens.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const SRC = readFileSync(
  fileURLToPath(new URL('../bridge-snippet.source.js', import.meta.url)),
  'utf-8',
);

/** Wortgleich die Ausdrücke aus snippet.ts — hier steht der Vertrag auf der Probe. */
const REV_RE = /var BRIDGE_REV = '([^']+)'/;
const VERSION_RE = /var BRIDGE_VERSION = (\d+)/;

describe('Bookmarklet-Versionsmarker (Vertrag .js ↔ snippet.ts)', () => {
  it('BRIDGE_REV ist lesbar und nicht leer', () => {
    const m = REV_RE.exec(SRC);
    expect(m, 'BRIDGE_REV nicht gefunden — snippet.ts liest dann einen leeren String und warnt NIE vor einem veralteten Lesezeichen').not.toBeNull();
    expect(m?.[1]?.length ?? 0).toBeGreaterThan(0);
  });

  it('BRIDGE_VERSION ist lesbar und eine positive Ganzzahl', () => {
    const m = VERSION_RE.exec(SRC);
    expect(m, 'BRIDGE_VERSION nicht gefunden — der Lesezeichen-Name fiele still auf „v1" zurück').not.toBeNull();
    const n = Number(m?.[1]);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
  });

  it('das Snippet meldet beide Marker am window (Konsolen-Diagnose im KI-Tab)', () => {
    expect(SRC).toContain('window.__teamflowBridgeRev = BRIDGE_REV;');
    expect(SRC).toContain('window.__teamflowBridgeVersion = BRIDGE_VERSION;');
  });

  it('der Lesezeichen-Name bleibt kurz genug für die Leiste', () => {
    const n = Number(VERSION_RE.exec(SRC)?.[1] ?? '1');
    const name = `interne-KI v${n}`;
    // Chrome schnurrt längere Namen in der Leiste auf ein Icon zusammen — dann
    // ist die Versionsnummer genau dort unsichtbar, wo sie gebraucht wird.
    expect(name.length).toBeLessThanOrEqual(20);
  });

  it('die Revision meldet sich im tf-pong (sonst kann die App nichts vergleichen)', () => {
    expect(SRC).toContain("type: 'tf-pong', rev: BRIDGE_REV");
  });
});
