/**
 * Tests des Bridge-Mutex (BridgeMutex) + Vordergrund-Lease-Wrappers.
 *
 * Deckt: Vordergrund-I/O zählt (submitMessage/resetChat), ping NICHT; Konsolidierungs-
 * Lease nur bei freier Bridge; laufender Vordergrund bricht einen gehaltenen
 * Lease ab (Vorrang); Zähler-Dekrement auch im Fehlerpfad (finally); optionale
 * Transport-Methoden bleiben erhalten/abwesend (Feature-Detection intakt).
 */
import { describe, expect, it } from 'vitest';
import { BridgeMutex } from '../bridge-vordergrund';
import type { AITransport } from '../transports/streamlit';

function fakeTransport(over: Partial<AITransport> = {}): AITransport {
  return {
    name: 'Fake',
    ping: async () => true,
    submitMessage: async () => 'antwort',
    resetChat: async () => 'ok',
    ...over,
  };
}

describe('BridgeMutex — Konsolidierungs-Lease', () => {
  it('liefert einen Lease bei freier Bridge; ein zweiter ist blockiert bis freigeben()', () => {
    const mutex = new BridgeMutex();
    const l1 = mutex.versucheKonsolidierungsLease(() => fakeTransport());
    expect(l1).not.toBeNull();
    expect(l1!.signal.aborted).toBe(false);
    expect(mutex.versucheKonsolidierungsLease(() => fakeTransport())).toBeNull();
    l1!.freigeben();
    expect(mutex.versucheKonsolidierungsLease(() => fakeTransport())).not.toBeNull();
  });

  it('ruft holeTransport nur bei erfolgreichem Lease auf', () => {
    const mutex = new BridgeMutex();
    let calls = 0;
    mutex.versucheKonsolidierungsLease(() => { calls++; return fakeTransport(); }); // Lease OK
    mutex.versucheKonsolidierungsLease(() => { calls++; return fakeTransport(); }); // blockiert
    expect(calls).toBe(1);
  });
});

describe('BridgeMutex — Vordergrund-Vorrang', () => {
  it('laufender Vordergrund blockiert Lease und bricht einen gehaltenen Lease ab', async () => {
    const mutex = new BridgeMutex();
    let aufloesen: (v: string) => void = () => {};
    const transport = fakeTransport({
      submitMessage: () => new Promise<string>((res) => { aufloesen = res; }),
    });

    const lease = mutex.versucheKonsolidierungsLease(() => transport)!;
    expect(lease.signal.aborted).toBe(false);

    // Vordergrund-Consumer startet → Zähler steigt, Lease wird abgebrochen.
    const wrapped = mutex.wrapVordergrund(transport);
    const inflight = wrapped.submitMessage('x');
    expect(mutex.vordergrundLaeuft).toBe(true);
    expect(lease.signal.aborted).toBe(true);
    // Neuer Lease ist blockiert, solange Vordergrund läuft.
    expect(mutex.versucheKonsolidierungsLease(() => transport)).toBeNull();

    aufloesen('fertig');
    await inflight;
    expect(mutex.vordergrundLaeuft).toBe(false);
    // Nach Freiwerden wieder ein Lease möglich.
    expect(mutex.versucheKonsolidierungsLease(() => transport)).not.toBeNull();
  });

  it('ping zählt NICHT als Vordergrund', async () => {
    const mutex = new BridgeMutex();
    const wrapped = mutex.wrapVordergrund(fakeTransport());
    await wrapped.ping();
    expect(mutex.vordergrundLaeuft).toBe(false);
  });

  it('dekrementiert auch im Fehlerpfad (finally)', async () => {
    const mutex = new BridgeMutex();
    const wrapped = mutex.wrapVordergrund(fakeTransport({
      submitMessage: async () => { throw new Error('boom'); },
    }));
    await expect(wrapped.submitMessage('x')).rejects.toThrow('boom');
    expect(mutex.vordergrundLaeuft).toBe(false);
  });

  it('erhält optionale Methoden (vorhanden/abwesend) für Feature-Detection', () => {
    const mutex = new BridgeMutex();
    const mitReset = mutex.wrapVordergrund(fakeTransport());
    expect(typeof mitReset.resetChat).toBe('function');

    const minimal = mutex.wrapVordergrund({
      name: 'M', ping: async () => true, submitMessage: async () => 'x',
    });
    expect(minimal.resetChat).toBeUndefined();
    expect(minimal.submitConversation).toBeUndefined();
    expect(minimal.streamConversation).toBeUndefined();
  });
});
