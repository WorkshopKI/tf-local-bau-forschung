/**
 * Label und geplanter Zeitraum eines Unterprogramms: „nicht mitgeschickt" und
 * „ausdrücklich geleert" sind zwei verschiedene Absichten.
 *
 * Bis v4.119 fielen beide auf `input.name ?? existing?.name` — ein falsch
 * gesetztes Label war über die Oberfläche nur überschreibbar, nie entfernbar,
 * und das Audit meldete trotzdem eine Änderung, die nie geschrieben wurde.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { saveUnterprogramm } from '../unterprogrammRegistry';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

const basis = { id: '138', programm_id: 'p1', code: '138', aktiv: true };

describe('saveUnterprogramm — Textfelder', () => {
  it('setzt Label und Zeitraum beim ersten Schreiben', async () => {
    const idb = await freshIdb();
    const up = await saveUnterprogramm(idb, { ...basis, name: 'Kooperation', geplanter_zeitraum: '2020-2025' });
    expect(up.name).toBe('Kooperation');
    expect(up.geplanter_zeitraum).toBe('2020-2025');
  });

  it('leerer String LEERT das Feld', async () => {
    const idb = await freshIdb();
    await saveUnterprogramm(idb, { ...basis, name: 'Kooperation', geplanter_zeitraum: '2020-2025' });

    const up = await saveUnterprogramm(idb, { ...basis, name: '', geplanter_zeitraum: '' });
    expect(up.name).toBeUndefined();
    expect(up.geplanter_zeitraum).toBeUndefined();
  });

  it('nur Leerzeichen zählen als leer', async () => {
    const idb = await freshIdb();
    await saveUnterprogramm(idb, { ...basis, name: 'Kooperation' });

    const up = await saveUnterprogramm(idb, { ...basis, name: '   ' });
    expect(up.name).toBeUndefined();
  });

  it('fehlendes Feld BEHÄLT den Bestand — sonst räumte jeder Wizard-Lauf die Kuration ab', async () => {
    const idb = await freshIdb();
    await saveUnterprogramm(idb, { ...basis, name: 'Kooperation', geplanter_zeitraum: '2020-2025' });

    const up = await saveUnterprogramm(idb, { ...basis, aktiv: false });
    expect(up.name).toBe('Kooperation');
    expect(up.geplanter_zeitraum).toBe('2020-2025');
    expect(up.aktiv).toBe(false);
  });

  it('`undefined` ist ebenfalls „nicht mitgeschickt", nicht „leeren"', async () => {
    const idb = await freshIdb();
    await saveUnterprogramm(idb, { ...basis, name: 'Kooperation' });

    const up = await saveUnterprogramm(idb, { ...basis, name: undefined });
    expect(up.name).toBe('Kooperation');
  });
});
