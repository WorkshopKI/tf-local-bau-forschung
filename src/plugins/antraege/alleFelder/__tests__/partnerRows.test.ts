import { describe, it, expect } from 'vitest';
import { buildPartnerRows, sumPartnerKosten } from '../partnerRows';
import type { Antrag } from '@/core/services/csv/types';

function antrag(fields: Record<string, unknown>): Antrag {
  return { aktenzeichen: 'A', programm_id: 'p', _field_sources: {}, _updated_at: '', ...fields } as unknown as Antrag;
}

describe('buildPartnerRows', () => {
  it('eine Zeile pro TV; Name AST-bevorzugt, Koordinator = Netzwerk-Lead', () => {
    const rows = buildPartnerRows([
      antrag({ aktenzeichen: '16KN106201', vb_phase: 1, antragsteller_ast: 'Koord GmbH', antragsteller: 'AFS-Stelle', ort_ast: 'Aachen', plz_ast: '52066', buland_ast: 'NW', beantragte_kosten: '280000' }),
      antrag({ aktenzeichen: '16KN106227', vb_phase: 3, antragsteller_ast: 'Partner AG', ort_afs: 'Trier', plz_afs: '54293', buland_afs: 'RP', beantragte_kosten: '420.000 €' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: 'Koord GmbH', istKoordinator: true, ort: 'Aachen', plz: '52066', bl: 'NW', kosten: 280000 });
    // AFS-Fallback, wenn AST fehlt:
    expect(rows[1]).toMatchObject({ name: 'Partner AG', istKoordinator: false, ort: 'Trier', plz: '54293', bl: 'RP', kosten: 420000 });
  });

  it('ohne Netzwerk-Lead ist der erste TV Koordinator', () => {
    const rows = buildPartnerRows([
      antrag({ aktenzeichen: '16EP000010', vb_phase: 3 }),
      antrag({ aktenzeichen: '16EP000011', vb_phase: 3 }),
    ]);
    expect(rows[0]!.istKoordinator).toBe(true);
    expect(rows[1]!.istKoordinator).toBe(false);
  });

  it('Name fällt auf canonical antragsteller zurück', () => {
    const rows = buildPartnerRows([antrag({ aktenzeichen: 'X', antragsteller: 'Nur AFS' })]);
    expect(rows[0]!.name).toBe('Nur AFS');
  });
});

describe('sumPartnerKosten', () => {
  it('summiert vorhandene Kosten, null wenn keine', () => {
    expect(sumPartnerKosten(buildPartnerRows([
      antrag({ aktenzeichen: 'A', beantragte_kosten: '100' }),
      antrag({ aktenzeichen: 'B', beantragte_kosten: '250' }),
    ]))).toBe(350);
    expect(sumPartnerKosten(buildPartnerRows([antrag({ aktenzeichen: 'A' })]))).toBeNull();
  });
});
