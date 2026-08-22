import { describe, it, expect } from 'vitest';
import {
  normalizeAntragstellerForMatch,
  findAntraegeVonAntragsteller,
} from '../antragstellerProfil';
import { asAntragStatusRaw, type AntragListItem } from '@/core/services/csv/types';

function mk(
  partial: Partial<Omit<AntragListItem, 'status'>> & { aktenzeichen: string; status?: string },
): AntragListItem {
  const { status, ...rest } = partial;
  return {
    programm_id: 'P',
    _updated_at: '2026-01-01T00:00:00Z',
    ...rest,
    ...(status !== undefined ? { status: asAntragStatusRaw(status) } : {}),
  };
}

const AST = 'StarWood Trading GmbH & Co. KG';

describe('normalizeAntragstellerForMatch', () => {
  it('trimmt, lowercased und kollabiert Whitespace', () => {
    expect(normalizeAntragstellerForMatch('  Acme   GmbH ')).toBe('acme gmbh');
    expect(normalizeAntragstellerForMatch('ACME GMBH')).toBe('acme gmbh');
  });

  it('vereinheitlicht NFD-Umlaute auf NFC (Pitfall #22)', () => {
    const nfd = 'Müller GmbH'; // u + kombinierendes Trema
    const nfc = 'Müller GmbH';
    expect(normalizeAntragstellerForMatch(nfd)).toBe(normalizeAntragstellerForMatch(nfc));
  });

  it('wirft KEINE Rechtsform ab — verschiedene Rechtspersonen bleiben getrennt', () => {
    expect(normalizeAntragstellerForMatch('Müller GmbH'))
      .not.toBe(normalizeAntragstellerForMatch('Müller AG'));
  });

  it('leer/kein String → null', () => {
    expect(normalizeAntragstellerForMatch('   ')).toBeNull();
    expect(normalizeAntragstellerForMatch(undefined)).toBeNull();
    expect(normalizeAntragstellerForMatch(null)).toBeNull();
  });
});

describe('findAntraegeVonAntragsteller', () => {
  const basis: AntragListItem[] = [
    mk({ aktenzeichen: '16KN116733', antragsteller: AST, akronym: 'AIWOOD', status: 'Gutachten fertig', antragsdatum: '2026-04-28', verbund_id: 'VB1' }),
    mk({ aktenzeichen: '16KN116732', antragsteller: AST, akronym: '(AIWOOD)', status: 'abgelehnt/zurückgezogen', antragsdatum: '2026-03-05', verbund_id: 'VB0' }),
    mk({ aktenzeichen: '16KN116422', antragsteller: AST, akronym: 'GENIAL', status: 'Irrläufer', antragsdatum: '2025-07-31', verbund_id: 'VB2' }),
    mk({ aktenzeichen: '16KN999999', antragsteller: 'Andere AG', akronym: 'FREMD', status: 'bewilligt', antragsdatum: '2026-01-01', verbund_id: 'VB9' }),
  ];

  function run(over: Partial<Parameters<typeof findAntraegeVonAntragsteller>[0]> = {}) {
    return findAntraegeVonAntragsteller({
      name: AST,
      currentAktenzeichen: '16KN116733',
      currentVerbundId: 'VB1',
      antraege: basis,
      ...over,
    });
  }

  it('ohne Namen gibt es kein Subjekt → null', () => {
    expect(run({ name: null })).toBeNull();
    expect(run({ name: '   ' })).toBeNull();
  });

  it('findet die weiteren Anträge und lässt den betrachteten selbst weg', () => {
    const p = run();
    expect(p?.gesamt).toBe(2);
    expect(p?.antraege.map(a => a.aktenzeichen)).toEqual(['16KN116732', '16KN116422']);
  });

  it('ignoriert fremde Antragsteller', () => {
    expect(run()?.antraege.some(a => a.aktenzeichen === '16KN999999')).toBe(false);
  });

  it('gleicht klein-/großschreibungs- und whitespace-tolerant ab', () => {
    const p = run({ name: `  ${AST.toUpperCase()}  ` });
    expect(p?.gesamt).toBe(2);
    // Der Anzeige-Name bleibt der übergebene, nicht der normalisierte.
    expect(p?.name).toBe(AST.toUpperCase());
  });

  it('sortiert absteigend nach Antragsdatum, Undatierte ans Ende', () => {
    const p = run({
      antraege: [
        ...basis,
        mk({ aktenzeichen: '16KN000001', antragsteller: AST, akronym: 'OHNEDATUM' }),
      ],
    });
    expect(p?.antraege.map(a => a.aktenzeichen))
      .toEqual(['16KN116732', '16KN116422', '16KN000001']);
  });

  it('markiert Geschwister-Teilvorhaben desselben Verbundes, ohne sie auszuschließen', () => {
    const p = run({
      antraege: [
        ...basis,
        mk({ aktenzeichen: '16KN116734', antragsteller: AST, akronym: 'AIWOOD', status: 'Gutachten fertig', antragsdatum: '2026-04-28', verbund_id: 'VB1' }),
      ],
    });
    const geschwister = p?.antraege.find(a => a.aktenzeichen === '16KN116734');
    expect(geschwister?.imSelbenVerbund).toBe(true);
    expect(p?.antraege.find(a => a.aktenzeichen === '16KN116732')?.imSelbenVerbund).toBe(false);
  });

  it('ohne geöffneten Verbund ist nichts „im selben Verbund"', () => {
    const p = run({ currentVerbundId: null });
    expect(p?.antraege.every(a => !a.imSelbenVerbund)).toBe(true);
  });

  it('zählt „abgelehnt/zurückgezogen" als abgelehnt — NICHT als abgeschlossen', () => {
    // Die Kategorie des Förder-Katalogs führt den Wert unter `abgeschlossen`;
    // wer `isTerminalStatus` zuerst prüft, verliert genau diesen Befund.
    const p = run();
    expect(p?.abgelehnt).toBe(1);
    expect(p?.abgeschlossen).toBe(0);
  });

  it('die fünf Töpfe sind disjunkt und summieren sich auf `gesamt`', () => {
    const p = run({
      antraege: [
        ...basis,
        mk({ aktenzeichen: '16KN115325', antragsteller: AST, status: 'bewilligt', antragsdatum: '2024-12-18' }),
        mk({ aktenzeichen: '16KN115326', antragsteller: AST, status: 'Schlussvermerk', antragsdatum: '2023-01-10' }),
        mk({ aktenzeichen: '16KN115327', antragsteller: AST, status: 'beantragt', antragsdatum: '2026-05-01' }),
      ],
    });
    expect(p).toBeTruthy();
    if (!p) return;
    expect(p.abgelehnt).toBe(1);
    expect(p.bewilligt).toBe(1);
    expect(p.abgeschlossen).toBe(1);
    expect(p.sonstige).toBe(1); // Irrläufer
    expect(p.inArbeit).toBe(1); // beantragt
    expect(p.abgelehnt + p.bewilligt + p.abgeschlossen + p.sonstige + p.inArbeit).toBe(p.gesamt);
  });

  it('ein Antragsteller ohne weitere Anträge liefert ein Profil mit 0, nicht null', () => {
    const p = run({ name: 'Andere AG', currentAktenzeichen: '16KN999999', currentVerbundId: 'VB9' });
    expect(p).not.toBeNull();
    expect(p?.gesamt).toBe(0);
    expect(p?.antraege).toEqual([]);
  });
});
