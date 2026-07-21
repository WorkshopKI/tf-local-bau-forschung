/**
 * Integrationstests des Konsolidierungslaufs (konsolidierung.ts) mit echter
 * fake-indexeddb + Fake-Transport-Lease (kein echtes LLM).
 *
 * Deckt: Happy-Path (ADD persistiert + Wasserzeichen fortgeschrieben),
 * nichts-zu-tun (Bridge gar nicht angefasst), bridge-belegt (Lease null),
 * Atomarität bei Parse-Fehler (Bestand + Wasserzeichen unverändert), Abbruch
 * durch Vordergrund (kein Meta-Write), Transport-Guard (Lease wirft),
 * ki-nicht-erreichbar (ping false), resetChat-vor-submit, deaktiviert — sowie
 * den WASSERZEICHEN-KONTRAKT (nur bei echtem Fortschritt vorrücken, Sättigung
 * zählt als verarbeitet, Backstop gegen den Dauer-Freeze).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('@/config/feature-flags', () => ({
  isAssistentGedaechtnisEnabled: () => true,
  isAssistentProtokollEnabled: () => true,
}));

import { IDBStore } from '@/core/services/storage/idb-store';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { TransportLease } from '@/core/services/ai/bridge-vordergrund';
import { appendEreignis } from '@/core/services/assistent/protokoll/store';
import type { AssistentEreignis } from '@/core/services/assistent/protokoll';
import { __resetProtokollFuerTests, initProtokoll, setzeProtokollAktiv } from '@/core/services/assistent/protokoll/recorder';
import { fuehreKonsolidierungAus } from '../konsolidierung';
import {
  __resetGedaechtnisFuerTests,
  initGedaechtnis,
  ladeAktiveEintraege,
  ladeLaufMeta,
  persistiereEintraege,
  setzeGedaechtnisAktiv,
} from '../recorder';
import { MAX_DEFEKT_WIEDERHOLUNGEN } from '../types';
import type { GedaechtnisEintrag } from '../types';

function ereignis(id: string, zeitstempel: number, typ: AssistentEreignis['typ'] = 'antrag_geoeffnet'): AssistentEreignis {
  return { id, version: 1, zeitstempel, typ, entitaet: { art: 'verbund', id: 'V1' } };
}

function lease(transport: AITransport, signal?: AbortSignal, freigeben = () => {}): TransportLease {
  return { transport, signal: signal ?? new AbortController().signal, freigeben };
}

function fakeTransport(over: Partial<AITransport> = {}): AITransport {
  return {
    name: 'Fake',
    ping: async () => true,
    submitMessage: async () => '[]',
    resetChat: async () => 'ok',
    ...over,
  };
}

async function setup(optins = { protokoll: true, gedaechtnis: true }): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  await initProtokoll(idb);
  await initGedaechtnis(idb);
  if (optins.protokoll) await setzeProtokollAktiv(true);
  if (optins.gedaechtnis) await setzeGedaechtnisAktiv(true);
  return idb;
}

const festeDeps = { jetzt: () => 5000, neueId: (() => { let n = 0; return () => `g-${n++}`; })() };

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  __resetProtokollFuerTests();
  __resetGedaechtnisFuerTests();
});

describe('Konsolidierung — Happy Path', () => {
  it('wendet ADD an, persistiert + schreibt Wasserzeichen fort', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));
    const transport = fakeTransport({
      submitMessage: async () => JSON.stringify([
        { op: 'ADD', block: 'arbeitskontext', text: 'Arbeitet an Verbund V1.', belege: ['ev1'] },
      ]),
    });

    const res = await fuehreKonsolidierungAus({ holeLease: () => lease(transport), ...festeDeps });

    expect(res.status).toBe('ok');
    expect(res.ergebnis?.hinzugefuegt).toBe(1);
    const aktive = await ladeAktiveEintraege();
    expect(aktive.map(e => e.text)).toEqual(['Arbeitet an Verbund V1.']);
    const meta = await ladeLaufMeta();
    expect(meta?.wasserzeichen).toBe(1000);
    expect(meta?.fehler).toBe(false);
    expect(meta?.angewandt).toBe(1);
  });

  it('leeres Ops-Array [] ist gültig: kein Eintrag, aber Wasserzeichen fortgeschrieben', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));
    const res = await fuehreKonsolidierungAus({ holeLease: () => lease(fakeTransport()), ...festeDeps });
    expect(res.status).toBe('ok');
    expect((await ladeAktiveEintraege())).toHaveLength(0);
    expect((await ladeLaufMeta())?.wasserzeichen).toBe(1000);
  });
});

describe('Konsolidierung — Voraussetzungen / Bridge', () => {
  it('deaktiviert, wenn das Gedächtnis-Opt-in fehlt', async () => {
    await setup({ protokoll: true, gedaechtnis: false });
    const res = await fuehreKonsolidierungAus({ holeLease: () => lease(fakeTransport()), ...festeDeps });
    expect(res.status).toBe('deaktiviert');
  });

  it('nichts-zu-tun ohne neue Ereignisse — Bridge wird NICHT angefasst', async () => {
    await setup();
    let leaseCalls = 0;
    const res = await fuehreKonsolidierungAus({
      holeLease: () => { leaseCalls++; return lease(fakeTransport()); },
      ...festeDeps,
    });
    expect(res.status).toBe('nichts-zu-tun');
    expect(leaseCalls).toBe(0);
  });

  it('bridge-belegt, wenn kein Lease verfügbar (null) — keine Schreibvorgänge', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));
    const res = await fuehreKonsolidierungAus({ holeLease: () => null, ...festeDeps });
    expect(res.status).toBe('bridge-belegt');
    expect(await ladeAktiveEintraege()).toHaveLength(0);
    expect(await ladeLaufMeta()).toBeNull();
  });

  it('ki-nicht-erreichbar bei ping=false — kein Meta-Write', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));
    const transport = fakeTransport({ ping: async () => false });
    const res = await fuehreKonsolidierungAus({ holeLease: () => lease(transport), ...festeDeps });
    expect(res.status).toBe('ki-nicht-erreichbar');
    expect(await ladeLaufMeta()).toBeNull();
  });

  it('transport-fehler, wenn der Lease wirft (DSGVO-Guard)', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));
    const res = await fuehreKonsolidierungAus({
      holeLease: () => { throw new Error('extern'); },
      ...festeDeps,
    });
    expect(res.status).toBe('transport-fehler');
    expect((await ladeLaufMeta())?.fehler).toBe(true);
  });
});

describe('Konsolidierung — Atomarität', () => {
  it('Parse-Fehler lässt Bestand + Wasserzeichen unverändert (Fehlerstatus gesetzt)', async () => {
    const idb = await setup();
    const vorbestand: GedaechtnisEintrag = {
      id: 'pre', version: 1, block: 'arbeitskontext', text: 'Vorher.', status: 'aktiv',
      erstellt: 1, aktualisiert: 1, belege: ['x'],
    };
    await persistiereEintraege([vorbestand]);
    await appendEreignis(idb, ereignis('ev1', 1000));

    const transport = fakeTransport({ submitMessage: async () => 'kein json hier' });
    const res = await fuehreKonsolidierungAus({ holeLease: () => lease(transport), ...festeDeps });

    expect(res.status).toBe('parse-fehler');
    expect((await ladeAktiveEintraege()).map(e => e.id)).toEqual(['pre']);
    const meta = await ladeLaufMeta();
    expect(meta?.fehler).toBe(true);
    expect(meta?.wasserzeichen).toBeNull(); // NICHT fortgeschrieben
  });

  it('Abbruch durch Vordergrund (signal.aborted) → kein Meta-Write, retry möglich', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));
    const ac = new AbortController();
    const transport = fakeTransport({
      submitMessage: async () => { ac.abort(); throw new Error('aborted'); },
    });
    const res = await fuehreKonsolidierungAus({ holeLease: () => lease(transport, ac.signal), ...festeDeps });
    expect(res.status).toBe('abgebrochen');
    expect(await ladeAktiveEintraege()).toHaveLength(0);
    expect(await ladeLaufMeta()).toBeNull();
  });
});

/**
 * Der Kern des Wasserzeichen-Kontrakts: ein Lauf darf den Fortschritt nur
 * fortschreiben, wenn die Ereignisse tatsächlich verarbeitet WURDEN. Vorher galt
 * jeder geparste Lauf als Erfolg — lieferte das Modell nur Unbrauchbares, rückte
 * das Wasserzeichen trotzdem vor und die Ereignisse waren dauerhaft verloren.
 */
describe('Konsolidierung — Wasserzeichen nur bei echtem Fortschritt', () => {
  const nurDefekteOps = () => fakeTransport({
    submitMessage: async () => JSON.stringify([
      { op: 'ADD', block: 'arbeitskontext', text: 'Fakt.', belege: ['gibtsnicht'] },
    ]),
  });

  it('hält das Wasserzeichen, wenn ALLE Operationen als defekt verworfen wurden', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));

    const res = await fuehreKonsolidierungAus({ holeLease: () => lease(nurDefekteOps()), ...festeDeps });

    expect(res.status).toBe('alles-verworfen');
    expect(res.fortschrittGehalten).toBe(true);
    const meta = await ladeLaufMeta();
    expect(meta?.wasserzeichen).toBeNull(); // NICHT fortgeschrieben — Ereignis bleibt fällig
    expect(meta?.fehler).toBe(true);
    expect(meta?.defektLaeufe).toBe(1);
  });

  it('schreibt fort, sobald wenigstens EINE Operation greift (kein Dauer-Retry bei Teilerfolg)', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));
    const transport = fakeTransport({
      submitMessage: async () => JSON.stringify([
        { op: 'ADD', block: 'arbeitskontext', text: 'Guter Fakt.', belege: ['ev1'] },
        { op: 'ADD', block: 'arbeitskontext', text: 'Schlechter Fakt.', belege: ['gibtsnicht'] },
      ]),
    });

    const res = await fuehreKonsolidierungAus({ holeLease: () => lease(transport), ...festeDeps });

    expect(res.status).toBe('ok');
    expect((await ladeLaufMeta())?.wasserzeichen).toBe(1000);
  });

  it('schreibt fort, wenn nur wegen Sättigung verworfen wurde (Duplikat ⇒ inhaltlich erledigt)', async () => {
    const idb = await setup();
    await persistiereEintraege([{
      id: 'pre', version: 1, block: 'arbeitskontext', text: 'Arbeitet an Verbund V1.',
      status: 'aktiv', erstellt: 1, aktualisiert: 1, belege: ['x'],
    }]);
    await appendEreignis(idb, ereignis('ev1', 1000));
    const transport = fakeTransport({
      submitMessage: async () => JSON.stringify([
        { op: 'ADD', block: 'arbeitskontext', text: 'Arbeitet an Verbund V1.', belege: ['ev1'] },
      ]),
    });

    const res = await fuehreKonsolidierungAus({ holeLease: () => lease(transport), ...festeDeps });

    expect(res.status).toBe('ok');
    expect((await ladeLaufMeta())?.wasserzeichen).toBe(1000);
  });

  it('gibt nach MAX_DEFEKT_WIEDERHOLUNGEN auf und überspringt den Stau (kein Dauer-Freeze)', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));

    for (let i = 1; i < MAX_DEFEKT_WIEDERHOLUNGEN; i++) {
      const zwischen = await fuehreKonsolidierungAus({ holeLease: () => lease(nurDefekteOps()), ...festeDeps });
      expect(zwischen.fortschrittGehalten).toBe(true);
      expect((await ladeLaufMeta())?.wasserzeichen).toBeNull();
    }

    const letzter = await fuehreKonsolidierungAus({ holeLease: () => lease(nurDefekteOps()), ...festeDeps });

    expect(letzter.status).toBe('alles-verworfen');
    expect(letzter.fortschrittGehalten).toBe(false); // aufgegeben statt ewig zu blockieren
    const meta = await ladeLaufMeta();
    expect(meta?.wasserzeichen).toBe(1000);
    expect(meta?.defektLaeufe).toBe(0); // Zähler zurückgesetzt
  });

  it('setzt den Defekt-Zähler zurück, sobald ein Lauf wieder greift', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));
    await fuehreKonsolidierungAus({ holeLease: () => lease(nurDefekteOps()), ...festeDeps });
    expect((await ladeLaufMeta())?.defektLaeufe).toBe(1);

    const transport = fakeTransport({
      submitMessage: async () => JSON.stringify([
        { op: 'ADD', block: 'arbeitskontext', text: 'Guter Fakt.', belege: ['ev1'] },
      ]),
    });
    await fuehreKonsolidierungAus({ holeLease: () => lease(transport), ...festeDeps });

    const meta = await ladeLaufMeta();
    expect(meta?.defektLaeufe).toBe(0);
    expect(meta?.wasserzeichen).toBe(1000);
  });
});

describe('Konsolidierung — Ablauf', () => {
  it('resetChat läuft VOR submitMessage, ping zuerst', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));
    const order: string[] = [];
    const transport = fakeTransport({
      ping: async () => { order.push('ping'); return true; },
      resetChat: async () => { order.push('reset'); return 'ok'; },
      submitMessage: async () => { order.push('submit'); return '[]'; },
    });
    const res = await fuehreKonsolidierungAus({ holeLease: () => lease(transport), ...festeDeps });
    expect(res.status).toBe('ok');
    expect(order).toEqual(['ping', 'reset', 'submit']);
  });

  it('gibt den Lease immer frei (finally)', async () => {
    const idb = await setup();
    await appendEreignis(idb, ereignis('ev1', 1000));
    const freigeben = vi.fn();
    await fuehreKonsolidierungAus({ holeLease: () => lease(fakeTransport(), undefined, freigeben), ...festeDeps });
    expect(freigeben).toHaveBeenCalledOnce();
  });
});
