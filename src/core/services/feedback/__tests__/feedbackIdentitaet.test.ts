import { describe, expect, it } from 'vitest';
import {
  KEINE_IDENTITAET,
  baueIdentitaet,
  istMeineId,
  istMeinTicket,
} from '../feedbackIdentitaet';

describe('baueIdentitaet', () => {
  it('nimmt den ERSTEN Kandidaten als kanonische Schreib-Id', () => {
    const ich = baueIdentitaet('THÜ', 'TH PL');
    expect(ich.schreibId).toBe('THÜ');
    expect(ich.leseIds).toEqual(['THÜ', 'TH PL']);
  });

  it('überspringt leere Kandidaten, ohne die Reihenfolge zu verschieben', () => {
    expect(baueIdentitaet(undefined, 'TH PL').schreibId).toBe('TH PL');
    expect(baueIdentitaet('', '  ', 'AM').leseIds).toEqual(['AM']);
  });

  it('zählt „anonymous" NICHT als Identität', () => {
    // Sonst gehörte jedem anonymen Nutzer jedes anonyme Ticket.
    expect(baueIdentitaet('anonymous').leseIds).toEqual([]);
    expect(baueIdentitaet('anonymous', 'TH').schreibId).toBe('TH');
  });

  it('entdoppelt Kandidaten, die sich nur in Schreibweise unterscheiden', () => {
    expect(baueIdentitaet('THÜ', 'thü ').leseIds).toEqual(['THÜ']);
  });

  it('ohne Kandidaten bleibt die Identität leer', () => {
    expect(baueIdentitaet()).toEqual(KEINE_IDENTITAET);
  });
});

describe('istMeineId', () => {
  const ich = baueIdentitaet('THÜ', 'TH PL');

  it('erkennt BEIDE Schreibweisen — der eigentliche Defekt', () => {
    // Erfasst wurde unter profile.name, verglichen wurde gegen das Kürzel.
    expect(istMeineId('TH PL', ich)).toBe(true);
    expect(istMeineId('THÜ', ich)).toBe(true);
  });

  it('gleicht NFD-zerlegte Umlaute an (Pitfall #22)', () => {
    expect(istMeineId('THÜ'.normalize('NFD'), ich)).toBe(true);
  });

  it('ignoriert Groß-/Kleinschreibung und Randleerzeichen', () => {
    expect(istMeineId('  th pl ', ich)).toBe(true);
  });

  it('fremde Ids bleiben fremd', () => {
    expect(istMeineId('AM', ich)).toBe(false);
    expect(istMeineId('TH', ich)).toBe(false); // Präfix ist kein Treffer
  });

  it('ohne Identität gehört mir nichts', () => {
    expect(istMeineId('TH PL', KEINE_IDENTITAET)).toBe(false);
  });

  it('leere Id gehört niemandem', () => {
    expect(istMeineId(undefined, ich)).toBe(false);
    expect(istMeineId('   ', ich)).toBe(false);
  });
});

describe('istMeinTicket', () => {
  const ich = baueIdentitaet('THÜ', 'TH PL');

  it('liest die user_id des Tickets', () => {
    expect(istMeinTicket({ user_id: 'TH PL' }, ich)).toBe(true);
    expect(istMeinTicket({ user_id: 'AM' }, ich)).toBe(false);
  });

  it('verträgt ein fehlendes Ticket', () => {
    expect(istMeinTicket(undefined, ich)).toBe(false);
  });
});
