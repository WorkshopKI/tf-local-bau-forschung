/**
 * Tolerante Normalisierung + Cache-Pfad des Meilenstein-Plans. Der Share-Pfad
 * (atomicWrite/queryPermission) ist hier bewusst nicht abgedeckt — er ist 1:1 das
 * Sidecar-Profil der Textbausteine und braucht einen echten Verzeichnis-Handle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import {
  cachePlan, freigegebeneFassung, ladePlan, normalisiereBedingung, normalisiereKnoten,
  normalisierePlan, readCachedPlan,
} from '@/core/meilensteine/plan-storage';
import { baueSeedPlan } from '@/core/meilensteine/seed';
import type { MeilensteinPlan } from '@/core/meilensteine/typen';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

async function frisch(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  return idb;
}

describe('normalisiereBedingung', () => {
  it('liest Gruppen und Blätter mit bekannten Operatoren', () => {
    expect(normalisiereBedingung({ alle: [{ feldId: 'a', op: 'gefuellt' }] }))
      .toEqual({ alle: [{ feldId: 'a', op: 'gefuellt' }] });
    expect(normalisiereBedingung({ feldId: 'a', op: 'ist', wert: 'x' }))
      .toEqual({ feldId: 'a', op: 'ist', wert: 'x' });
    expect(normalisiereBedingung({ feldId: 'a', op: 'datumVor', tageRelativHeute: -10 }))
      .toEqual({ feldId: 'a', op: 'datumVor', tageRelativHeute: -10 });
  });

  it('verwirft unbekannte Operatoren und feldlose Blätter', () => {
    expect(normalisiereBedingung({ feldId: 'a', op: 'irgendwas' })).toBeNull();
    expect(normalisiereBedingung({ op: 'gefuellt' })).toBeNull();
    expect(normalisiereBedingung('kaputt')).toBeNull();
  });

  it('lässt kaputte Zweige aus der Gruppe fallen statt die Gruppe zu verlieren', () => {
    expect(normalisiereBedingung({
      einige: [{ feldId: 'a', op: 'gefuellt' }, { op: 'kaputt' }],
    })).toEqual({ einige: [{ feldId: 'a', op: 'gefuellt' }] });
  });
});

describe('normalisiereKnoten', () => {
  it('füllt Defaults und verwirft Knoten ohne ID', () => {
    expect(normalisiereKnoten({ label: 'ohne id' })).toBeNull();
    const k = normalisiereKnoten({ id: 'k1' })!;
    expect(k.elternId).toBeNull();
    expect(k.sollWoche).toBe(1);
    expect(k.aktiv).toBe(true);
    expect(k.nurTypen).toEqual([]);
    expect(k.bedingung).toEqual({ einige: [] });
  });

  it('macht aus einer unlesbaren Bedingung „nie erfüllt", nicht „immer erfüllt"', () => {
    const k = normalisiereKnoten({ id: 'k1', bedingung: { op: 'quatsch' } })!;
    expect(k.bedingung).toEqual({ einige: [] });
  });

  it('filtert unbekannte Antragstypen aus nurTypen', () => {
    const k = normalisiereKnoten({ id: 'k1', nurTypen: ['FuE', 'XX', 42] })!;
    expect(k.nurTypen).toEqual(['FuE']);
  });
});

describe('normalisierePlan', () => {
  it('liest den Auslieferungs-Plan verlustfrei', () => {
    const seed = baueSeedPlan();
    expect(normalisierePlan(JSON.parse(JSON.stringify(seed)))).toEqual(seed);
  });

  it('verweigert strukturell Kaputtes', () => {
    expect(normalisierePlan(null)).toBeNull();
    expect(normalisierePlan({ version: 1 })).toBeNull();
  });

  it('stuft einen unbekannten Status fail-safe auf Entwurf herunter', () => {
    const p = normalisierePlan({ version: 2, status: 'irgendwas', knoten: [] })!;
    expect(p.status).toBe('entwurf');
  });

  it('kappt Eltern-Verweise ins Leere und Eltern-Zyklen', () => {
    const p = normalisierePlan({
      version: 1, knoten: [
        { id: 'a', elternId: 'gibtesnicht' },
        { id: 'b', elternId: 'c' },
        { id: 'c', elternId: 'b' },
      ],
    })!;
    expect(p.knoten.map(k => k.elternId)).toEqual([null, null, null]);
  });

  it('behält gültige Eltern-Verweise', () => {
    const p = normalisierePlan({
      version: 1, knoten: [{ id: 'a' }, { id: 'b', elternId: 'a' }],
    })!;
    expect(p.knoten[1]!.elternId).toBe('a');
  });
});

describe('freigegebeneFassung', () => {
  it('gibt einen freigegebenen Plan unverändert zurück', () => {
    const p = baueSeedPlan();
    expect(freigegebeneFassung(p)).toBe(p);
  });

  it('fällt bei einem Entwurf auf die jüngste freigegebene Fassung zurück', () => {
    const seed = baueSeedPlan();
    const entwurf: MeilensteinPlan = {
      ...seed, version: 2, status: 'entwurf', knoten: [],
      historie: [{
        version: seed.version,
        stand: seed.stand,
        autor: seed.autor,
        status: seed.status,
        gesamtfristTage: seed.gesamtfristTage,
        knoten: seed.knoten,
      }],
    };
    const gueltig = freigegebeneFassung(entwurf)!;
    expect(gueltig.version).toBe(1);
    expect(gueltig.knoten).toHaveLength(seed.knoten.length);
  });

  it('liefert null, wenn nie etwas freigegeben wurde', () => {
    const p: MeilensteinPlan = { ...baueSeedPlan(), status: 'entwurf', historie: [] };
    expect(freigegebeneFassung(p)).toBeNull();
  });
});

describe('Cache-Pfad', () => {
  it('liefert ohne Share und ohne Cache den Auslieferungs-Plan', async () => {
    const idb = await frisch();
    const geladen = await ladePlan(idb);
    expect(geladen.quelle).toBe('seed');
    expect(geladen.stale).toBe(false);
    expect(geladen.plan.version).toBe(1);
  });

  it('liest einen gecachten Plan als stale zurück', async () => {
    const idb = await frisch();
    const p: MeilensteinPlan = { ...baueSeedPlan(), version: 7, kommentar: 'aus dem Cache' };
    await cachePlan(idb, p);
    expect((await readCachedPlan(idb))?.version).toBe(7);
    const geladen = await ladePlan(idb);
    expect(geladen.quelle).toBe('cache');
    expect(geladen.stale).toBe(true);
    expect(geladen.plan.kommentar).toBe('aus dem Cache');
  });

  it('normalisiert auch beim Lesen aus dem Cache', async () => {
    const idb = await frisch();
    await idb.set('meilenstein-plan:cache', {
      version: 3, knoten: [{ id: 'k1', nurTypen: ['XX'] }], status: 'kaputt',
    });
    const p = (await readCachedPlan(idb))!;
    expect(p.status).toBe('entwurf');
    expect(p.knoten[0]!.nurTypen).toEqual([]);
  });
});
