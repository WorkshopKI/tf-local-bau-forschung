/**
 * Tests für `bausteineFuer` (v5.2). Der Punkt der Änderung: „Ergänzung" hängt am
 * EIGENEN Ticket, nicht an der Rolle — wer verwalten darf, bleibt am eigenen
 * Ticket trotzdem der Autor.
 */
import { describe, expect, it } from 'vitest';
import { BAUSTEINE_DEV, BAUSTEINE_NUTZER, bausteineFuer } from '../beitragBausteine';

const labels = (bs: readonly (readonly [string, string])[]): string[] => bs.map(([l]) => l);

describe('bausteineFuer', () => {
  it('liefert ohne zweites Argument genau den Bestand (Bestandsaufrufe unverändert)', () => {
    expect(bausteineFuer(true)).toBe(BAUSTEINE_DEV);
    expect(bausteineFuer(false)).toBe(BAUSTEINE_NUTZER);
  });

  it('stellt „Ergänzung" am eigenen Ticket auch mit Schreibrecht voran', () => {
    expect(labels(bausteineFuer(true, true))[0]).toBe('Ergänzung');
    // Der Rest bleibt vollständig erhalten — die Rolle verliert nichts.
    expect(labels(bausteineFuer(true, true))).toEqual(['Ergänzung', ...labels(BAUSTEINE_DEV)]);
  });

  it('doppelt „Ergänzung" nicht, wo der Baustein ohnehin steht', () => {
    const eigene = labels(bausteineFuer(false, true));
    expect(eigene.filter(l => l === 'Ergänzung')).toHaveLength(1);
    expect(bausteineFuer(false, true)).toBe(BAUSTEINE_NUTZER);
  });

  it('lässt fremde Tickets unangetastet', () => {
    expect(labels(bausteineFuer(true, false))).not.toContain('Ergänzung');
  });
});
