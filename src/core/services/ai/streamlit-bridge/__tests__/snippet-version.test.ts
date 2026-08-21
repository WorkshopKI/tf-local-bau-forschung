/**
 * Die beiden Versions-Marker des Bookmarklets sind ein VERTRAG zwischen der
 * `.js`-Quelle und `snippet.ts`: dort werden sie per Regex herausgelesen, statt
 * sie ein zweites Mal hinzuschreiben. Benennt jemand sie um oder ändert die
 * Schreibweise, bricht nicht der Build — die App zeigt dann still „v1" und
 * warnt nie mehr vor einem veralteten Lesezeichen.
 *
 * Die beiden Nummern zählen NICHT dasselbe: `BRIDGE_REV` bewegt sich mit jeder
 * Änderung am Snippet, `BRIDGE_VERSION` mit jeder Ausrollung an das Team. Wer
 * sie gleichzieht, erfindet Lesezeichen-Namen, die nie jemand in der Hand
 * hatte — zwischen v6.0 und v6.4 stand sie auf 4, während das Team noch v1
 * benutzte, weil keine dieser Fassungen freigegeben war. Die Nummer beantwortet
 * „habe ich die aktuelle?" nur, wenn sie so zählt wie der Nutzer.
 *
 * **Was dieser Test NICHT kann:** erzwingen, dass `BRIDGE_REV` bei einer
 * Snippet-Änderung mitwandert. Ob jemand die Zeile angefasst hat, steht nirgends
 * im Code.
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

  it('trägt genau die Nummer, die dem Team zuletzt angekündigt wurde', () => {
    // Der Lesezeichen-Name ist eine AUSSAGE AN DEN NUTZER: „das ist die n-te
    // Fassung". Belegbar ist sie nur an dem, was der Nutzer gelesen hat — und
    // das steht in changelog-user.md. Ohne diese Bindung wandert die Nummer mit
    // internen Bumps davon: sie stand auf 4, während das Team v1 benutzte.
    //
    // Vorwärts gedacht heißt der Guard: ERST die Ankündigung schreiben, DANN
    // die Nummer setzen. Genau die Reihenfolge, die vorher fehlte.
    const changelog = readFileSync(
      fileURLToPath(new URL('../../../../components/changelog/changelog-user.md', import.meta.url)),
      'utf-8',
    );
    const angekuendigt = [...changelog.matchAll(/interne-KI v(\d+)/g)].map(m => Number(m[1]));
    expect(
      angekuendigt.length,
      'changelog-user.md kündigt gar kein Lesezeichen an — dann kann die Nummer nichts belegen',
    ).toBeGreaterThan(0);
    const hoechste = Math.max(...angekuendigt);
    const gesetzt = Number(VERSION_RE.exec(SRC)?.[1] ?? '1');
    expect(
      gesetzt,
      `BRIDGE_VERSION ist ${gesetzt}, angekündigt wurde zuletzt v${hoechste}. Entweder fehlt die Ankündigung in changelog-user.md, oder die Nummer wurde mit einem internen Bump hochgezogen.`,
    ).toBe(hoechste);
  });
});
