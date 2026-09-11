/**
 * Probe am Bestand. Der Prüfstein ist, dass die Probe dasselbe zählt wie die
 * Auswertung — gleicher Evaluator, gleicher Nenner, gleiche Eltern-ODER-Regel —
 * und dass ein inaktiver Knoten seine eigene Zahl bekommt, ohne die seiner
 * Eltern zu verschieben.
 */
import { describe, expect, it } from 'vitest';
import { loeseFelderAuf } from '@/core/meilensteine/felder';
import {
  baueProbeFaelle, probeMeilensteine, zaehleBedingung, type ProbeVerbund,
} from '@/core/meilensteine/probe';
import type { MeilensteinKnoten, MeilensteinPlan } from '@/core/meilensteine/typen';
import type { Bedingung } from '@/core/status';
import type { AntragstypBucket } from '@/core/utils/vb-phase-mappings';

const ANKER = '2026-01-05';
const HEUTE = '2026-03-01T00:00:00.000Z';

function verbund(
  id: string, typ: AntragstypBucket | null, abgeschlossen: boolean, record: Record<string, string>,
): ProbeVerbund {
  return {
    verbundId: id, typ, antragsdatum: ANKER, anker: ANKER, abgeschlossen,
    verbundRecord: {},
    antraege: [{ aktenzeichen: `${id}-TV1`, record }],
  };
}

/**
 * Vier Verbünde: zwei offen, zwei abgeschlossen. `a` ist bei dreien gefüllt,
 * `b` nur bei V1.
 */
const BESTAND: ProbeVerbund[] = [
  verbund('V1', 'FuE', false, { a: '01.02.2026', b: '02.02.2026' }),
  verbund('V2', 'DS', false, {}),
  verbund('V3', 'FuE', true, { a: '01.02.2026' }),
  verbund('V4', 'DL', true, { a: '01.02.2026' }),
];
const faelle = baueProbeFaelle(BESTAND, loeseFelderAuf([], ['a', 'b']));

const A: Bedingung = { feldId: 'a', op: 'gefuellt' };
const B: Bedingung = { feldId: 'b', op: 'gefuellt' };

function knoten(p: Partial<MeilensteinKnoten> & { id: string }): MeilensteinKnoten {
  return {
    elternId: null, nummer: p.id, label: p.id, sollWoche: 4, relevantFuerFrist: true,
    nurTypen: [], aktiv: true, bedingung: A, sortierung: 10, ...p,
  };
}

function plan(k: MeilensteinKnoten[]): MeilensteinPlan {
  return { version: 1, stand: ANKER, autor: null, status: 'freigegeben', gesamtfristTage: 90, knoten: k, historie: [] };
}

describe('zaehleBedingung', () => {
  it('zählt offen und abgeschlossen getrennt, mit Nenner', () => {
    expect(zaehleBedingung(A, faelle, [], HEUTE)).toEqual({
      offen: { treffer: 1, von: 2 },
      abgeschlossen: { treffer: 2, von: 2 },
    });
  });

  it('der Nenner folgt `nurTypen`', () => {
    expect(zaehleBedingung(A, faelle, ['FuE'], HEUTE)).toEqual({
      offen: { treffer: 1, von: 1 },
      abgeschlossen: { treffer: 1, von: 1 },
    });
  });

  it('der Gruppenname ändert keine Zahl', () => {
    const ohne = zaehleBedingung({ einige: [A, B] }, faelle, [], HEUTE);
    expect(zaehleBedingung({ einige: [A, B], name: 'PreCheck' }, faelle, [], HEUTE)).toEqual(ohne);
  });
});

describe('probeMeilensteine', () => {
  it('zählt einen aktiven Knoten wie die Bewertung', () => {
    const r = probeMeilensteine(plan([knoten({ id: 'k1' })]), faelle, HEUTE);
    expect(r.get('k1')).toEqual({
      offen: { treffer: 1, von: 2 }, abgeschlossen: { treffer: 2, von: 2 }, inaktiv: false,
    });
  });

  it('der Nenner folgt `nurTypen` des Knotens', () => {
    const r = probeMeilensteine(plan([knoten({ id: 'k1', nurTypen: ['DS'] })]), faelle, HEUTE);
    expect(r.get('k1')?.offen).toEqual({ treffer: 0, von: 1 });
    expect(r.get('k1')?.abgeschlossen).toEqual({ treffer: 0, von: 0 });
  });

  it('ein inaktiver Knoten bekommt seine eigene Zahl — die Eltern bleiben unverschoben', () => {
    // p ist Sammel-Knoten: erreicht, wenn alle RELEVANTEN Kinder erreicht sind.
    // c2 ist inaktiv, zählt also für p nicht mit — p hängt allein an c1 (= a).
    const p = plan([
      knoten({ id: 'p', bedingung: { einige: [] } }),
      knoten({ id: 'c1', elternId: 'p', bedingung: A }),
      knoten({ id: 'c2', elternId: 'p', bedingung: B, aktiv: false }),
    ]);
    const r = probeMeilensteine(p, faelle, HEUTE);
    expect(r.get('p')).toEqual({ ...r.get('c1'), inaktiv: false });
    expect(r.get('c2')).toEqual({
      offen: { treffer: 1, von: 2 }, abgeschlossen: { treffer: 0, von: 2 }, inaktiv: true,
    });
  });

  it('ein Knoten ohne auswertbare Bedingung steht mit 0 von 0 da', () => {
    const r = probeMeilensteine(plan([knoten({ id: 'k', bedingung: { alle: [] } })]), faelle, HEUTE);
    expect(r.get('k')).toEqual({
      offen: { treffer: 0, von: 0 }, abgeschlossen: { treffer: 0, von: 0 }, inaktiv: false,
    });
  });
});
