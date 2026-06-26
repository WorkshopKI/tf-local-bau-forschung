/** Phase 7 — deterministische Wiedereinsetzung + Platzhalter-Validierung. */
import { describe, expect, it } from 'vitest';
import { pruefePlatzhalter, wiedereinsetzen, wiedereinsetzenSegmente, finalisiere } from '../finalisierung';
import type { Mapping } from '../../types';

const MAPPING: Mapping[] = [
  { platzhalter: '[PERSON_1]', original: 'Dr. Schmidt', typ: 'person' },
  { platzhalter: '[FIRMA_1]', original: 'ACME GmbH', typ: 'firma' },
  { platzhalter: '[FKZ_1]', original: '16EP1234', typ: 'fkz' },
];

describe('wiedereinsetzen', () => {
  it('ersetzt jeden Platzhalter durch sein Original (alle Vorkommen)', () => {
    const anon = 'Hallo [PERSON_1], Ihr Antrag bei [FIRMA_1] ([FKZ_1]). Grüße an [PERSON_1].';
    expect(wiedereinsetzen(anon, MAPPING)).toBe(
      'Hallo Dr. Schmidt, Ihr Antrag bei ACME GmbH (16EP1234). Grüße an Dr. Schmidt.',
    );
  });

  it('verwechselt [PERSON_1] nicht mit [PERSON_10]', () => {
    const m: Mapping[] = [
      { platzhalter: '[PERSON_1]', original: 'Anna', typ: 'person' },
      { platzhalter: '[PERSON_10]', original: 'Bert', typ: 'person' },
    ];
    expect(wiedereinsetzen('[PERSON_1] und [PERSON_10]', m)).toBe('Anna und Bert');
  });

  it('lässt unbekannte Platzhalter stehen', () => {
    expect(wiedereinsetzen('[PERSON_1] und [UNBEKANNT_9]', MAPPING)).toBe('Dr. Schmidt und [UNBEKANNT_9]');
  });
});

describe('wiedereinsetzenSegmente', () => {
  const anon = 'Hallo [PERSON_1], Antrag [FKZ_1]. Rest [UNBEKANNT_9].';

  it('Klartext (join) ist identisch zu wiedereinsetzen', () => {
    const segs = wiedereinsetzenSegmente(anon, MAPPING);
    expect(segs.map(s => s.text).join('')).toBe(wiedereinsetzen(anon, MAPPING));
  });

  it('markiert eingesetzte Originale als placeholder, lässt Unbekannte unmarkiert', () => {
    const segs = wiedereinsetzenSegmente(anon, MAPPING);
    expect(segs.filter(s => s.kind === 'placeholder').map(s => s.text)).toEqual(['Dr. Schmidt', '16EP1234']);
    // Der unbekannte Platzhalter bleibt als unmarkierter Text stehen.
    expect(segs.some(s => s.kind === null && s.text.includes('[UNBEKANNT_9]'))).toBe(true);
  });
});

describe('pruefePlatzhalter', () => {
  it('meldet fehlende Mapping-Platzhalter', () => {
    const r = pruefePlatzhalter('Nur [PERSON_1] ist drin.', MAPPING);
    expect(r.fehlend).toContain('[FIRMA_1]');
    expect(r.fehlend).toContain('[FKZ_1]');
    expect(r.unbekannt).toEqual([]);
  });

  it('meldet unbekannte Platzhalter in der Antwort', () => {
    const r = pruefePlatzhalter('[PERSON_1] [FIRMA_1] [FKZ_1] [GEHEIM_3]', MAPPING);
    expect(r.fehlend).toEqual([]);
    expect(r.unbekannt).toEqual(['[GEHEIM_3]']);
  });
});

describe('finalisiere', () => {
  it('ohne Polish = reine deterministische Wiedereinsetzung', async () => {
    const out = await finalisiere('Hallo [PERSON_1]', MAPPING);
    expect(out).toBe('Hallo Dr. Schmidt');
  });

  it('Polish läuft VOR der Wiedereinsetzung (kann echte Werte nicht ändern)', async () => {
    // Der Polish bekommt nur die ANONYME Antwort; die Wiedereinsetzung danach.
    const polish = async (anon: string): Promise<string> => {
      expect(anon).toBe('hi [PERSON_1]');           // anonymer Input
      return 'Hallo [PERSON_1]!';                    // geglättet, Platzhalter intakt
    };
    const out = await finalisiere('hi [PERSON_1]', MAPPING, polish);
    expect(out).toBe('Hallo Dr. Schmidt!');
  });
});
