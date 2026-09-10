/**
 * Was diese Datei festnagelt:
 *
 * 1. Zwei gleichzeitige Durchgänge lösen **einen** Lesevorgang je Programm aus.
 * 2. Der Halter ist **kein Cache**: nach dem letzten Mitfahrer liest der nächste
 *    Durchgang neu. (Die Roh-Records sind 284 MB — sie dürfen den Lauf nicht
 *    überleben.)
 * 3. Ein Generationswechsel trennt die Runden — ein Import darf nicht in einen
 *    laufenden Halter durchschlagen.
 * 4. Ein Lesefehler erreicht **jeden** Mitfahrer und verwirft die Runde.
 * 5. Ein Aufrufer, der abbricht (`break`, `throw`), lässt keine Runde stehen —
 *    der Fall, den es beim Callback nicht gab und beim Generator schon.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { jedesProgrammRoh, halterZustand, type RohLeser, type ProgrammRoh } from '../roh-halter';
import { markiereBestandGeaendert } from '@/core/services/bestand-generation';
import type { IDBStore } from '@/core/services/storage/idb-store';

const idb = {} as IDBStore;

/** Ein Leser, der mitzählt — und am Tor hängt, damit sich zwei Durchgänge überlappen. */
function zaehlenderLeser(programmIds: string[] = ['p1', 'p2']): {
  leser: RohLeser; leseVorgaenge: string[]; freigeben: () => void;
} {
  const leseVorgaenge: string[] = [];
  let loesen: (() => void) | null = null;
  const tor = new Promise<void>(res => { loesen = res; });
  return {
    leseVorgaenge,
    freigeben: () => loesen?.(),
    leser: {
      programme: async () => programmIds.map(id => ({ id }) as never),
      roh: async (_idb, programmId) => {
        leseVorgaenge.push(programmId);
        await tor;
        return {
          verbuende: [{ verbund_id: `vb-${programmId}` }] as never,
          antraege: [{ aktenzeichen: `az-${programmId}` }] as never,
          schemas: [] as never,
        };
      },
    },
  };
}

/** Einen ganzen Durchgang fahren und die besuchten Programme einsammeln. */
async function fahre(
  leser: RohLeser, sammle?: (roh: ProgrammRoh, gelesen: boolean) => void,
): Promise<string[]> {
  const gesehen: string[] = [];
  for await (const { roh, takt } of jedesProgrammRoh(idb, leser)) {
    gesehen.push(roh.programmId);
    sammle?.(roh, takt.gelesen);
  }
  return gesehen;
}

beforeEach(() => {
  // Eine frische Generation je Test: sonst erbt der nächste Test eine Runde,
  // die der vorige stehen liess.
  markiereBestandGeaendert();
});

describe('jedesProgrammRoh — die Mitfahrgelegenheit', () => {
  it('zwei gleichzeitige Durchgänge lösen EINEN Lesevorgang je Programm aus', async () => {
    const { leser, leseVorgaenge, freigeben } = zaehlenderLeser();
    const gelesenB: boolean[] = [];

    const a = fahre(leser);
    // B startet, während A noch am Tor hängt — der Kollisionsfall: die
    // Startseite rechnet, der Nutzer öffnet die Vorgangs-Regeln.
    const b = fahre(leser, (_roh, gelesen) => { gelesenB.push(gelesen); });

    freigeben();
    const [gesehenA, gesehenB] = await Promise.all([a, b]);

    // Zwei Programme, zwei Lesevorgänge — nicht vier.
    expect(leseVorgaenge).toEqual(['p1', 'p2']);
    // Beide Durchgänge haben trotzdem jedes Programm gesehen.
    expect(gesehenA).toEqual(['p1', 'p2']);
    expect(gesehenB).toEqual(['p1', 'p2']);
    // Und B weiss, dass es mitgefahren ist.
    expect(gelesenB).toEqual([false, false]);
  });

  it('beide Mitfahrer bekommen dieselben Arrays, nicht zwei Kopien', async () => {
    const { leser, freigeben } = zaehlenderLeser(['p1']);
    let vonA: unknown = null;
    let vonB: unknown = null;
    const a = fahre(leser, roh => { vonA = roh.antraege; });
    const b = fahre(leser, roh => { vonB = roh.antraege; });
    freigeben();
    await Promise.all([a, b]);
    // Identität, nicht Gleichheit: der Sinn der Übung ist, dass nur EIN
    // Bestand im Speicher liegt.
    expect(vonA).toBe(vonB);
  });

  it('ist KEIN Cache: nach dem letzten Mitfahrer wird neu gelesen', async () => {
    const { leser, leseVorgaenge, freigeben } = zaehlenderLeser(['p1']);
    freigeben();
    await fahre(leser);
    expect(halterZustand().runde).toBe(false);

    await fahre(leser);
    // Zweimal gelaufen, zweimal gelesen — 284 MB dürfen den Lauf nicht überleben.
    expect(leseVorgaenge).toEqual(['p1', 'p1']);
  });

  it('meldet dem ersten Aufrufer, dass er selbst gelesen hat', async () => {
    const { leser, freigeben } = zaehlenderLeser(['p1']);
    freigeben();
    const gelesen: boolean[] = [];
    await fahre(leser, (_roh, g) => { gelesen.push(g); });
    expect(gelesen).toEqual([true]);
  });

  it('ein Generationswechsel trennt die Runden', async () => {
    const { leser, leseVorgaenge, freigeben } = zaehlenderLeser(['p1']);
    const a = fahre(leser);
    // Ein Import mitten im laufenden Durchgang.
    markiereBestandGeaendert();
    const b = fahre(leser);
    freigeben();
    await Promise.all([a, b]);
    // B durfte NICHT mitfahren: A's Arrays beschreiben einen Bestand,
    // den es so nicht mehr gibt.
    expect(leseVorgaenge).toEqual(['p1', 'p1']);
  });

  it('ein Lesefehler erreicht jeden Mitfahrer und verwirft die Runde', async () => {
    const leser: RohLeser = {
      programme: async () => [{ id: 'p1' } as never],
      roh: async () => { throw new Error('IDB weg'); },
    };
    const a = fahre(leser);
    const b = fahre(leser);
    await expect(a).rejects.toThrow('IDB weg');
    await expect(b).rejects.toThrow('IDB weg');
    // Kein halb gefüllter Halter bleibt stehen.
    expect(halterZustand().runde).toBe(false);
  });

  it('räumt auf, wenn der Aufrufer mitten im Durchgang abbricht', async () => {
    const { leser, freigeben } = zaehlenderLeser(['p1', 'p2']);
    freigeben();
    for await (const { roh } of jedesProgrammRoh(idb, leser)) {
      expect(roh.programmId).toBe('p1');
      break;   // `for await` schliesst den Generator, das `finally` greift
    }
    expect(halterZustand()).toEqual({ runde: false, nutzer: 0, programme: 0 });
  });

  it('räumt auch dann auf, wenn der Rumpf des Aufrufers wirft', async () => {
    const { leser, freigeben } = zaehlenderLeser(['p1']);
    freigeben();
    await expect((async () => {
      for await (const _ of jedesProgrammRoh(idb, leser)) {
        throw new Error('Aufrufer kaputt');
      }
    })()).rejects.toThrow('Aufrufer kaputt');
    expect(halterZustand()).toEqual({ runde: false, nutzer: 0, programme: 0 });
  });
});
