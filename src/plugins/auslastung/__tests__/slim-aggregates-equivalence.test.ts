/**
 * Äquivalenz-Tests Slim-Cache (v2.63): die Lookup-Varianten (arbeiten auf der
 * Slim-Projektion + vorberechneter `deskriptorenByAz`-/`ztKlartexte`-Map aus
 * dem Stream-Pass) müssen BIT-IDENTISCHE Ergebnisse liefern wie die
 * Antrag-basierten Original-Funktionen auf vollen Records.
 *
 * Abgedeckt: DL-Semantik-Differenz (ByAnon exkludiert DL, MaProfile inkl. DL),
 * ZT-Slug-Felder (Stage 0), fehlendes tib_kuerz, leere Deskriptoren,
 * Az-Set-Gate vs. feld-basiertes Gate.
 */
import { describe, it, expect } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import { toAntragListItem } from '@/core/services/csv/list-view';
import {
  aggregateMaProfilesByAnon,
  aggregateMaProfilesByAnonFromLookup,
  aggregateMaProfile,
  aggregateMaProfileFromLookup,
  collectAllDeskriptorenMitCount,
  collectAllDeskriptorenMitCountFromLookup,
  readAntragDeskriptoren,
  readAntragDeskriptorenMitZt,
  readTruthyZtKlartexte,
} from '../services/identitaet';
import {
  klassifiziereAntrag,
  klassifiziereAntragFromLookup,
  matchZukunftstechnologien,
  matchZukunftstechnologienFromKlartexte,
} from '../services/klassifizierung';
import {
  istVollstaendigFuerTyp,
  istVollstaendigFuerTypAz,
  type VollstaendigkeitsGate,
  type VollstaendigkeitsGateAz,
} from '../services/verbund';
import type { UeberKategorie } from '../types';
import { normalizeKuerzel } from '../services/identitaet';
import { buildAnonymMapForTests } from './test-helpers';

function antrag(az: string, fields: Record<string, unknown>): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: '2026-06-10T00:00:00.000Z',
    ...fields,
  } as Antrag;
}

// Fixture-Korpus: deckt techn_*, ZT-Slug-Felder (fixture-Konvention
// zt_<slugUe>_tv aus default-labels.ts), DL/FuE/DS-Phasen, fehlendes
// tib_kuerz und leere Deskriptoren ab.
const ANTRAEGE: Antrag[] = [
  antrag('A1', { tib_kuerz: 'mue', vb_phase: 3, techn_1: 'Bildverarbeitung', techn_2: 'KI', d_xtec: '2026-01-15' }),
  antrag('A2', { tib_kuerz: 'mue', vb_phase: 4, techn_1: 'Cloud-Migration' }),               // DL!
  antrag('A3', { tib_kuerz: 'sch', vb_phase: 5, zt_cloud_computing_tv: 'X', d_xtec: '00.00.0000' }), // ZT-Feld, ungueltiges Datum
  antrag('A4', { tib_kuerz: 'sch', vb_phase: 1, zt_industrie_4_0_tv: '1', d_adv: '15.02.2026' }),    // NW + dt. Datum
  antrag('A5', { vb_phase: 3, techn_1: 'Robotik' }),                                          // kein tib_kuerz
  antrag('A6', { tib_kuerz: 'thü', vb_phase: 2 }),                                            // leere Deskriptoren
];

const SLIM = ANTRAEGE.map(toAntragListItem);
const DESKR_BY_AZ = new Map(ANTRAEGE.map(a => [a.aktenzeichen, readAntragDeskriptoren(a)] as const));
const ZT_BY_AZ = new Map(ANTRAEGE.map(a => [a.aktenzeichen, readTruthyZtKlartexte(a as Record<string, unknown>)] as const));

const KATEGORIEN: UeberKategorie[] = [
  { id: 'DT', name: 'Digitale Technologien', farbe: 'blau' as UeberKategorie['farbe'], deskriptorenMapping: ['ki', 'bildverarbeitung'] },
  { id: 'IT', name: 'Industrielle Technologien', farbe: 'gruen' as UeberKategorie['farbe'], deskriptorenMapping: ['robotik'] },
];

describe('Slim-Aggregate-Äquivalenz (Lookup vs. volle Records)', () => {
  it('aggregateMaProfilesByAnonFromLookup ≡ aggregateMaProfilesByAnon (DL-exklusiv)', () => {
    const map = buildAnonymMapForTests(ANTRAEGE);
    const full = aggregateMaProfilesByAnon(ANTRAEGE, map);
    const slim = aggregateMaProfilesByAnonFromLookup(SLIM, map, DESKR_BY_AZ);
    expect([...slim.entries()].sort()).toEqual([...full.entries()].sort());
    // DL-Ausschluss greift: A2 (DL, cloud-migration) darf NICHT in mues Profil sein.
    const mueAnon = map.toAnon.get(normalizeKuerzel('mue')!)!;
    expect(mueAnon).toBeTruthy();
    expect(slim.get(mueAnon)).not.toContain('cloud-migration');
  });

  it('aggregateMaProfileFromLookup ≡ aggregateMaProfile (bewusst inkl. DL)', () => {
    const full = aggregateMaProfile(ANTRAEGE, 'mue');
    const slim = aggregateMaProfileFromLookup(SLIM, DESKR_BY_AZ, 'mue');
    expect(slim).toEqual(full);
    // DL-Inklusion greift: hier MUSS cloud-migration drin sein (Differenz zur ByAnon-Variante).
    expect(slim).toContain('cloud-migration');
  });

  it('collectAllDeskriptorenMitCountFromLookup ≡ collectAllDeskriptorenMitCount', () => {
    expect(collectAllDeskriptorenMitCountFromLookup(DESKR_BY_AZ))
      .toEqual(collectAllDeskriptorenMitCount(ANTRAEGE));
  });

  it('readAntragDeskriptorenMitZt ≡ readAntragDeskriptoren (Einmal-ZT-Scan, v2.63.1)', () => {
    for (const a of ANTRAEGE) {
      const rec = a as Record<string, unknown>;
      expect(readAntragDeskriptorenMitZt(rec, readTruthyZtKlartexte(rec)))
        .toEqual(readAntragDeskriptoren(a));
    }
  });

  it('matchZukunftstechnologienFromKlartexte ≡ matchZukunftstechnologien', () => {
    for (const a of ANTRAEGE) {
      expect(matchZukunftstechnologienFromKlartexte(ZT_BY_AZ.get(a.aktenzeichen)!, KATEGORIEN))
        .toEqual(matchZukunftstechnologien(a, KATEGORIEN));
    }
  });

  it('klassifiziereAntragFromLookup ≡ klassifiziereAntrag (Stage 0/1/2 + kein-Match)', () => {
    const queryEmbedding = [0.6, 0.8];
    const kategorienMitEmbedding: UeberKategorie[] = KATEGORIEN.map(k => ({
      ...k,
      referenzEmbedding: k.id === 'DT' ? [0.6, 0.8] : [0.8, 0.6],
    }));
    for (const a of ANTRAEGE) {
      const full = klassifiziereAntrag({ antrag: a, kategorien: kategorienMitEmbedding, queryEmbedding, stage2Aktiv: true });
      const slim = klassifiziereAntragFromLookup({
        aktenzeichen: a.aktenzeichen,
        deskriptoren: DESKR_BY_AZ.get(a.aktenzeichen)!,
        ztKlartexte: ZT_BY_AZ.get(a.aktenzeichen)!,
        kategorien: kategorienMitEmbedding,
        queryEmbedding,
        stage2Aktiv: true,
      });
      expect(slim).toEqual(full);
    }
  });

  it('istVollstaendigFuerTypAz ≡ istVollstaendigFuerTyp (inkl. ungueltiges Platzhalter-Datum)', () => {
    const gate: VollstaendigkeitsGate = { dxtec: true, dadv: true, xtecFeld: 'd_xtec', advFeld: 'd_adv' };
    // Az-Sets wie der Stream-Pass sie baut: nur Az mit GUELTIGEM Datum im
    // aufgeloesten Feld (A3 hat Platzhalter '00.00.0000' → NICHT im Set).
    const gateAz: VollstaendigkeitsGateAz = {
      dxtec: true,
      dadv: true,
      xtecAzSet: new Set(['A1']),
      advAzSet: new Set(['A4']),
    };
    for (const [i, a] of ANTRAEGE.entries()) {
      expect(istVollstaendigFuerTypAz(SLIM[i]!, gateAz)).toBe(istVollstaendigFuerTyp(a, gate));
    }
  });
});
