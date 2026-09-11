import { describe, expect, it } from 'vitest';
import type { JournalEintrag } from '@/core/status';
import { nachtlaufNamen, type AntragKopf } from '../nachtlaufNamen';

const eintrag = (
  antragId: string,
  feld: string,
  art: JournalEintrag['art'],
  nach?: JournalEintrag['nach'],
  datum = '2026-09-11',
): JournalEintrag => ({
  stempel: 's1', antragId, art, feld, datum, ...(nach !== undefined ? { nach } : {}),
});

const KOEPFE: Record<string, AntragKopf> = {
  TV1: { verbund_id: 'VB-BAU', akronym: 'BauKo-Pilot' },
  TV2: { verbund_id: 'VB-BAU', akronym: 'BauKo-Pilot' },
  TV3: { verbund_id: 'VB-BAU', akronym: 'BauKo-Pilot' },
  SOLO: { verbund_id: null, akronym: 'LewisAI' },
};
const kopf = (id: string): AntragKopf | undefined => KOEPFE[id];

/**
 * Gemessen 11.09.2026 (Kürzel THü): der Brief sagte „4 Vorgänge haben sich über
 * Nacht geändert" — drei davon waren Teilvorhaben von BauKo-Pilot.
 */
describe('nachtlaufNamen — je Vorgang ein Name', () => {
  it('drei Teilvorhaben eines Verbunds sind EIN Name', () => {
    const namen = nachtlaufNamen([
      eintrag('TV1', 'D_QS', 'gesetzt', 20260911),
      eintrag('TV2', 'D_QS', 'gesetzt', 20260911),
      eintrag('TV3', 'D_QS', 'gesetzt', 20260911),
      eintrag('SOLO', 'D_VV', 'gesetzt', 20260910),
    ], kopf);
    expect(namen.map(n => n.name)).toEqual(['BauKo-Pilot', 'LewisAI']);
    expect(namen[0]).toMatchObject({ scopeId: 'VB-BAU', anzahl: 3, statusNeu: null });
    expect(namen[1]).toMatchObject({ scopeId: 'SOLO', anzahl: 1 });
  });

  it('ein Antrag ohne Kopf bleibt mit seinem Aktenzeichen stehen', () => {
    const namen = nachtlaufNamen([eintrag('16KN999', 'D_VV', 'gesetzt', 20260911)], kopf);
    expect(namen).toEqual([{ scopeId: '16KN999', name: '16KN999', anzahl: 1, statusNeu: null }]);
  });

  it('ein erstmals exportierter Antrag ist Zugang, keine Änderung', () => {
    expect(nachtlaufNamen([{ stempel: 's1', antragId: 'SOLO', art: 'antrag-neu', datum: '2026-09-11' }], kopf))
      .toEqual([]);
  });
});

describe('nachtlaufNamen — der neue Status', () => {
  it('der Verbund-Status spricht für den Vorgang', () => {
    const [n] = nachtlaufNamen([
      eintrag('TV1', 'STATUS_TV', 'geaendert', 'techn geprüft'),
      eintrag('TV1', 'STATUS_VB', 'geaendert', 'bewilligungsreif'),
    ], kopf);
    expect(n!.statusNeu).toBe('bewilligungsreif');
  });

  it('ohne Verbund-Status: ein TV-Status, den alle geänderten Teilvorhaben teilen', () => {
    const [n] = nachtlaufNamen([
      eintrag('TV1', 'STATUS_TV', 'geaendert', 'in Prüfung'),
      eintrag('TV2', 'STATUS_TV', 'gesetzt', 'in Prüfung'),
    ], kopf);
    expect(n!.statusNeu).toBe('in Prüfung');
  });

  it('verschiedene TV-Status ergeben keinen — keine Aussage, die kein Wert trägt', () => {
    const [n] = nachtlaufNamen([
      eintrag('TV1', 'STATUS_TV', 'geaendert', 'in Prüfung'),
      eintrag('TV2', 'STATUS_TV', 'geaendert', 'bewilligungsreif'),
    ], kopf);
    expect(n!.statusNeu).toBeNull();
  });

  it('ein zurückgenommener Status ist kein neuer', () => {
    const [n] = nachtlaufNamen([eintrag('SOLO', 'STATUS_TV', 'geleert')], kopf);
    expect(n!.statusNeu).toBeNull();
  });

  it('bei mehreren Verbund-Status gilt der jüngste', () => {
    const [n] = nachtlaufNamen([
      eintrag('TV1', 'STATUS_VB', 'geaendert', 'neu', '2026-09-11'),
      eintrag('TV2', 'STATUS_VB', 'geaendert', 'alt', '2026-09-09'),
    ], kopf);
    expect(n!.statusNeu).toBe('neu');
  });
});

describe('nachtlaufNamen — Reihenfolge', () => {
  it('Statuswechsel zuerst, dann nach Zahl der Einträge, dann nach Name', () => {
    const namen = nachtlaufNamen([
      eintrag('TV1', 'D_QS', 'gesetzt', 20260911),
      eintrag('TV2', 'D_QS', 'gesetzt', 20260911),
      eintrag('SOLO', 'STATUS_TV', 'geaendert', 'ablehnungsreif'),
      eintrag('ZZZ', 'D_VV', 'gesetzt', 20260911),
      eintrag('AAA', 'D_VV', 'gesetzt', 20260911),
    ], kopf);
    expect(namen.map(n => n.name)).toEqual(['LewisAI', 'BauKo-Pilot', 'AAA', 'ZZZ']);
  });
});
