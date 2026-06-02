/**
 * Tests für groupEintraegeByVerbund — die Homepage-Sektion „Neue Anträge für
 * dich" zeigt eine Zeile pro Verbund (Bearbeiter übernehmen den ganzen
 * Verbund, nie einzelne TVs).
 */
import { describe, it, expect } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import type { Klassifizierung } from '@/plugins/auslastung/types';
import { groupEintraegeByVerbund, isClaimed, type OffenerAntrag } from '../neueAntraegeVerbund';

function makeAntrag(
  aktenzeichen: string,
  verbund_id: string | undefined,
  akronym: string,
  titel: string,
): Antrag {
  return {
    aktenzeichen,
    programm_id: 'p1',
    akronym,
    titel,
    ...(verbund_id ? { verbund_id } : {}),
    _field_sources: {},
    _updated_at: '2026-05-01T00:00:00Z',
  } as Antrag;
}

function makeKl(antragId: string): Klassifizierung {
  return {
    antragId,
    vorgeschlagenePrimaer: null,
    vorgeschlageneAspekte: [],
    freigegebenePrimaer: 'IT',
    freigegebeneAspekte: [],
    status: 'freigegeben',
    freigegebenAm: '2026-05-01',
  };
}

function makeOffen(a: Antrag, overrides?: Partial<OffenerAntrag>): OffenerAntrag {
  return {
    antrag: a,
    klassifizierung: makeKl(a.aktenzeichen),
    daysLeft: 4,
    xswMine: false,
    claimed: false,
    ...overrides,
  };
}

const EMPTY_VERBUENDE = new Map();

describe('groupEintraegeByVerbund', () => {
  it('bündelt TVs mit gleicher verbund_id zu EINER Zeile', () => {
    const tv1 = makeAntrag('16KN126325', 'V1', 'DroneSPELL', 'Digitale Zwillinge');
    const tv2 = makeAntrag('16KN126326', 'V1', 'DroneSPELL', 'Compliance-Engine');
    const eintraege = [makeOffen(tv1), makeOffen(tv2)];

    const out = groupEintraegeByVerbund(eintraege, [tv1, tv2], EMPTY_VERBUENDE, new Set());

    expect(out).toHaveLength(1);
    expect(out[0]!.verbundId).toBe('V1');
    expect(out[0]!.tvCount).toBe(2);
    expect(out[0]!.akronym).toBe('DroneSPELL');
    expect(out[0]!.fkzRange).toBe('16KN126325–16KN126326');
  });

  it('Lead = FKZ-kleinster TV (unabhängig von Eingabe-Reihenfolge)', () => {
    const tv1 = makeAntrag('16KN126326', 'V1', 'DroneSPELL', 'B');
    const tv2 = makeAntrag('16KN126325', 'V1', 'DroneSPELL', 'A');
    // bewusst umgekehrt einsortiert
    const out = groupEintraegeByVerbund([makeOffen(tv1), makeOffen(tv2)], [tv1, tv2], EMPTY_VERBUENDE, new Set());
    expect(out[0]!.leadAktenzeichen).toBe('16KN126325');
  });

  it('listet alle TV-Titel (FKZ-sortiert) für den Badge-Tooltip', () => {
    const tv1 = makeAntrag('16KN126325', 'V1', 'DroneSPELL', 'Digitale Zwillinge');
    const tv2 = makeAntrag('16KN126326', 'V1', 'DroneSPELL', 'Compliance-Engine');
    const out = groupEintraegeByVerbund([makeOffen(tv2), makeOffen(tv1)], [tv2, tv1], EMPTY_VERBUENDE, new Set());
    expect(out[0]!.alleTvs).toEqual([
      { aktenzeichen: '16KN126325', titel: 'Digitale Zwillinge' },
      { aktenzeichen: '16KN126326', titel: 'Compliance-Engine' },
    ]);
  });

  it('Solo-Antrag (ohne verbund_id) bleibt eigene 1er-Zeile', () => {
    const solo = makeAntrag('16EP260112', undefined, 'SoloProj', 'Einzelvorhaben');
    const out = groupEintraegeByVerbund([makeOffen(solo)], [solo], EMPTY_VERBUENDE, new Set());
    expect(out).toHaveLength(1);
    expect(out[0]!.verbundId).toBe('16EP260112');
    expect(out[0]!.tvCount).toBe(1);
    expect(out[0]!.fkzRange).toBe('16EP260112');
  });

  it('tvCount zählt den ganzen Verbund aus dem Cache, auch wenn nur 1 TV offen ist', () => {
    const tv1 = makeAntrag('16KN126325', 'V1', 'DroneSPELL', 'A');
    const tv2 = makeAntrag('16KN126326', 'V1', 'DroneSPELL', 'B');
    // Nur tv1 ist "offen" (z.B. tv2 schon fest gebucht) — Cache kennt aber beide.
    const out = groupEintraegeByVerbund([makeOffen(tv1)], [tv1, tv2], EMPTY_VERBUENDE, new Set());
    expect(out).toHaveLength(1);
    expect(out[0]!.tvCount).toBe(2);
    expect(out[0]!.alleTvs).toHaveLength(2);
  });

  it('claimed = true wenn ein TV claimed ist; claimedAktenzeichen nur lokal vorgemerkte', () => {
    const tv1 = makeAntrag('16KN126325', 'V1', 'DroneSPELL', 'A');
    const tv2 = makeAntrag('16KN126326', 'V1', 'DroneSPELL', 'B');
    const eintraege = [
      makeOffen(tv1, { claimed: true }),
      makeOffen(tv2, { claimed: false }),
    ];
    const out = groupEintraegeByVerbund(eintraege, [tv1, tv2], EMPTY_VERBUENDE, new Set(['16KN126325']));
    expect(out[0]!.claimed).toBe(true);
    expect(out[0]!.claimedAktenzeichen).toEqual(['16KN126325']);
  });

  it('daysLeft = Minimum über die TVs der Gruppe', () => {
    const tv1 = makeAntrag('16KN126325', 'V1', 'DroneSPELL', 'A');
    const tv2 = makeAntrag('16KN126326', 'V1', 'DroneSPELL', 'B');
    const out = groupEintraegeByVerbund(
      [makeOffen(tv1, { daysLeft: 5 }), makeOffen(tv2, { daysLeft: 2 })],
      [tv1, tv2],
      EMPTY_VERBUENDE,
      new Set(),
    );
    expect(out[0]!.daysLeft).toBe(2);
  });

  it('sortiert vorgemerkte Verbünde ans Ende', () => {
    const a = makeAntrag('16KN100101', 'VA', 'Alpha', 'A');
    const b = makeAntrag('16KN100201', 'VB', 'Beta', 'B');
    const out = groupEintraegeByVerbund(
      [makeOffen(a, { claimed: true }), makeOffen(b, { claimed: false })],
      [a, b],
      EMPTY_VERBUENDE,
      new Set(),
    );
    expect(out.map(v => v.verbundId)).toEqual(['VB', 'VA']);
  });

  // v2.9-Fix: „Rückgängig" wirkt auch fuer bereits eingesammelte (Pending)
  // Vormerkungen. claimedAktenzeichen muss die Pending-TVs enthalten, sonst
  // haette der Undo-Button kein Ziel (Regression: leeres forEach → no-op).
  it('claimedAktenzeichen enthält auch reine Pending-TVs (PL eingesammelt, kein lokaler Wunsch)', () => {
    const tv1 = makeAntrag('16KN126325', 'V1', 'DroneSPELL', 'A');
    const tv2 = makeAntrag('16KN126326', 'V1', 'DroneSPELL', 'B');
    const pending = new Set(['16KN126325', '16KN126326']);
    const out = groupEintraegeByVerbund(
      [makeOffen(tv1, { claimed: true }), makeOffen(tv2, { claimed: true })],
      [tv1, tv2],
      EMPTY_VERBUENDE,
      new Set(),       // claimedSet leer — nur Pending
      pending,
      new Set(),       // retractedSet leer
    );
    expect(out[0]!.claimed).toBe(true);
    expect(out[0]!.claimedAktenzeichen).toEqual(['16KN126325', '16KN126326']);
  });

  it('retractedSet entfernt das TV aus claimedAktenzeichen (Optimistic-Overlay)', () => {
    const tv1 = makeAntrag('16KN126325', 'V1', 'DroneSPELL', 'A');
    const tv2 = makeAntrag('16KN126326', 'V1', 'DroneSPELL', 'B');
    const pending = new Set(['16KN126325', '16KN126326']);
    const out = groupEintraegeByVerbund(
      // tv1 lokal zurueckgenommen → in der Komponente claimed:false
      [makeOffen(tv1, { claimed: false }), makeOffen(tv2, { claimed: true })],
      [tv1, tv2],
      EMPTY_VERBUENDE,
      new Set(),
      pending,
      new Set(['16KN126325']),  // tv1 zurueckgenommen
    );
    expect(out[0]!.claimed).toBe(true); // tv2 haelt den Verbund vorgemerkt
    expect(out[0]!.claimedAktenzeichen).toEqual(['16KN126326']);
  });

  it('claimedAktenzeichen = Vereinigung aus lokalem Wunsch und Pending', () => {
    const tv1 = makeAntrag('16KN126325', 'V1', 'DroneSPELL', 'A'); // lokaler Wunsch
    const tv2 = makeAntrag('16KN126326', 'V1', 'DroneSPELL', 'B'); // Pending
    const out = groupEintraegeByVerbund(
      [makeOffen(tv1, { claimed: true }), makeOffen(tv2, { claimed: true })],
      [tv1, tv2],
      EMPTY_VERBUENDE,
      new Set(['16KN126325']),
      new Set(['16KN126326']),
      new Set(),
    );
    expect(out[0]!.claimedAktenzeichen).toEqual(['16KN126325', '16KN126326']);
  });
});

describe('isClaimed', () => {
  const C = new Set(['lokal']);
  const P = new Set(['pending']);
  const R = new Set(['weg']);

  it('true bei lokalem Wunsch', () => {
    expect(isClaimed('lokal', C, new Set(), new Set())).toBe(true);
  });
  it('true bei Pending (PL eingesammelt)', () => {
    expect(isClaimed('pending', new Set(), P, new Set())).toBe(true);
  });
  it('false wenn weder lokal noch pending', () => {
    expect(isClaimed('fremd', C, P, new Set())).toBe(false);
  });
  it('false wenn zurueckgenommen — auch bei lokalem Wunsch', () => {
    expect(isClaimed('weg', new Set(['weg']), new Set(), R)).toBe(false);
  });
  it('false wenn zurueckgenommen — auch bei Pending', () => {
    expect(isClaimed('weg', new Set(), new Set(['weg']), R)).toBe(false);
  });
});
