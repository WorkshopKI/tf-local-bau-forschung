/**
 * `hashText` (Änderungserkennung, kein Krypto) + `istOriginalStale` (Export-Gate,
 * sobald der Original-Mailtext nach dem Anonymisieren editiert wurde).
 */
import { describe, expect, it } from 'vitest';
import { hashText, istOriginalStale } from '../original-hash';
import { createAnfrage } from '../persistence';
import type { Anfrage } from '../types';

const BASIS = 'Sehr geehrte Damen und Herren, hier der Original-Mailtext.';

function frisch(originalMd = BASIS): Anfrage {
  return createAnfrage({ absenderEmail: 'a@a.de', betreff: 'B', hatAnhaenge: 0, originalMd });
}

/** Bereits anonymisiert: Status + Basis-Hash gestempelt. */
function anonymisiert(overrides: Partial<Anfrage> = {}): Anfrage {
  return { ...frisch(), status: 'anonymisiert', anonBasisHash: hashText(BASIS), ...overrides };
}

describe('hashText', () => {
  it('ist deterministisch für gleichen Text', () => {
    expect(hashText(BASIS)).toBe(hashText(BASIS));
  });

  it('unterscheidet sich bei geändertem Text', () => {
    expect(hashText('abc')).not.toBe(hashText('abd'));
  });

  it('leerer Text ist stabil und definiert', () => {
    expect(hashText('')).toBe(hashText(''));
  });

  it('erkennt Umlaut-Änderungen (NFC-relevante Zeichen)', () => {
    expect(hashText('Grün')).not.toBe(hashText('Grun'));
  });
});

describe('istOriginalStale', () => {
  it('false, solange noch nicht anonymisiert (Status aufgenommen)', () => {
    expect(istOriginalStale(frisch(), 'komplett anderer Text')).toBe(false);
  });

  it('false, wenn der Text seit der Anonymisierung unverändert ist', () => {
    expect(istOriginalStale(anonymisiert(), BASIS)).toBe(false);
  });

  it('true, wenn der Text seit der Anonymisierung geändert wurde', () => {
    expect(istOriginalStale(anonymisiert(), BASIS + ' — Nachtrag')).toBe(true);
  });

  it('Bestandsschutz: Alt-Record ohne anonBasisHash ist nie veraltet', () => {
    expect(istOriginalStale(anonymisiert({ anonBasisHash: undefined }), 'irgendetwas Anderes')).toBe(false);
  });

  it('un-stale nach Rück-Edit auf den identischen Text', () => {
    const a = anonymisiert();
    expect(istOriginalStale(a, 'zwischenzeitlich geändert')).toBe(true);
    expect(istOriginalStale(a, BASIS)).toBe(false);
  });
});
