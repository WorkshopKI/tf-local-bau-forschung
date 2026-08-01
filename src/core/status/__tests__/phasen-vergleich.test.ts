/**
 * Der Phasen-Vergleichs-Report ist das Abnahme-Kriterium für den späteren
 * Rückbau der Ableitung. Diese Tests halten fest, was er zählt — vor allem die
 * Trennung zwischen einer echten **Abweichung** und einem erklärten
 * **Nicht-Vergleich** (Marker, Statuswert ohne Code, gar kein Status). Wer beides
 * in einen Topf wirft, bekommt eine Zahl, die nie null wird, und damit ein
 * Kriterium, das nie erfüllt ist.
 */
import { describe, it, expect } from 'vitest';
import {
  vergleichePhasen, vergleichZusammenfassung, abweichungsMuster,
} from '@/core/status/phasen-vergleich';
import { ZAH_ZU_SPINE } from '@/core/status/zah-phasen';
import { baueSeedVersion } from '@/core/status/seed';
import type { VerbundFelder } from '@/core/status/cockpit-berechnung';
import type { MappingVersion } from '@/core/status/typen';
import { ZAH_PHASEN_REIHENFOLGE } from '@/core/status/zah-phasen';

const HEUTE = '2026-08-01T00:00:00.000Z';
const seed = baueSeedVersion();

const vb = (verbundId: string, status: string): VerbundFelder => ({
  verbundId,
  felder: { verbund_status: status },
  tvFelder: {},
});

describe('ZAH_ZU_SPINE', () => {
  it('bildet jede ZAH-Phase auf die alte Wirbelsäule ab', () => {
    for (const id of ZAH_PHASEN_REIHENFOLGE) {
      expect(ZAH_ZU_SPINE[id]).toBeDefined();
    }
  });

  it('legt Entscheidung und Prüfung auf dieselbe alte Station (die kannte sie nicht getrennt)', () => {
    expect(ZAH_ZU_SPINE.entscheidung).toBe(ZAH_ZU_SPINE.pruefung);
    expect(ZAH_ZU_SPINE.begleitung).toBe('bewilligung');
  });
});

describe('vergleichePhasen', () => {
  it('zählt übereinstimmende Verbünde als gleich', () => {
    const v = vergleichePhasen(seed, [vb('VB-1', 'beantragt')], HEUTE);
    expect(v.abweichend).toBe(0);
    expect(v.gleich).toBe(1);
    expect(v.zeilen[0]?.code).toBe(31);
    expect(v.zeilen[0]?.zahPhase).toBe('eingang');
    expect(v.zeilen[0]?.grund).toBeNull();
  });

  it('führt Marker-Status als erklärten Nicht-Vergleich, nicht als Abweichung', () => {
    const v = vergleichePhasen(seed, [vb('VB-1', 'Irrläufer')], HEUTE);
    expect(v.abweichend).toBe(0);
    expect(v.unvergleichbar).toBe(1);
    expect(v.zeilen[0]?.grund).toBe('marker');
  });

  it('führt einen Statuswert ohne Code als erklärten Nicht-Vergleich', () => {
    const v = vergleichePhasen(seed, [vb('VB-1', 'Wunschstatus')], HEUTE);
    expect(v.unvergleichbar).toBe(1);
    expect(v.zeilen[0]?.grund).toBe('ohne-code');
    expect(v.zeilen[0]?.code).toBeNull();
  });

  it('führt einen Verbund ohne gesetzten Status gesondert', () => {
    const v = vergleichePhasen(seed, [{ verbundId: 'VB-1', felder: {}, tvFelder: {} }], HEUTE);
    expect(v.unvergleichbar).toBe(1);
    expect(v.zeilen[0]?.grund).toBe('kein-status');
  });

  it('meldet eine echte Abweichung, wenn die Kuration die Phase umhängt', () => {
    // „beantragt" liegt im Seed in `eingang`; von Hand nach `abgeschlossen`
    // umgehängt sagen beide Lesarten etwas anderes.
    const umgehaengt: MappingVersion = {
      ...seed,
      werte: seed.werte.map(w => (w.wert === 'beantragt' ? { ...w, zahPhaseId: 'abgeschlossen' } : w)),
    };
    const v = vergleichePhasen(umgehaengt, [vb('VB-1', 'beantragt')], HEUTE);
    expect(v.abweichend).toBe(1);
    expect(v.zeilen[0]?.grund).toBe('abweichung');
    expect(v.zeilen[0]?.spinePhase).toBe('eingang');
    expect(v.zeilen[0]?.erwarteteSpine).toBe('schluss');
  });

  it('liest den Status auch von der TV-Ebene, wenn der Verbund keinen trägt', () => {
    const v = vergleichePhasen(
      seed,
      [{ verbundId: 'VB-1', felder: {}, tvFelder: { 'AZ-1': { status: 'bewilligt' } } }],
      HEUTE,
    );
    expect(v.zeilen[0]?.code).toBe(59);
    expect(v.zeilen[0]?.zahPhase).toBe('begleitung');
  });

  it('ist deterministisch bei gleichem Stichtag', () => {
    const eingang = [vb('VB-1', 'beantragt'), vb('VB-2', 'bewilligt')];
    expect(JSON.stringify(vergleichePhasen(seed, eingang, HEUTE)))
      .toBe(JSON.stringify(vergleichePhasen(seed, eingang, HEUTE)));
  });
});

describe('abweichungsMuster', () => {
  /** Fassung, in der „beantragt" und „bearbeitungsreif" umgehängt sind. */
  const umgehaengt: MappingVersion = {
    ...seed,
    werte: seed.werte.map(w =>
      (w.wert === 'beantragt' || w.wert === 'bearbeitungsreif')
        ? { ...w, zahPhaseId: 'abgeschlossen' }
        : w),
  };

  it('fasst gleichartige Abweichungen zusammen und zählt sie', () => {
    const v = vergleichePhasen(
      umgehaengt,
      [vb('A', 'beantragt'), vb('B', 'beantragt'), vb('C', 'bearbeitungsreif')],
      HEUTE,
    );
    const m = abweichungsMuster(v);
    expect(m).toHaveLength(2);
    expect(m[0]?.statusRoh).toBe('beantragt');
    expect(m[0]?.anzahl).toBe(2);
    expect(m[0]?.beispiele).toEqual(['A', 'B']);
    expect(m[1]?.anzahl).toBe(1);
  });

  it('sortiert nach Häufigkeit absteigend', () => {
    const v = vergleichePhasen(
      umgehaengt,
      [vb('A', 'bearbeitungsreif'), vb('B', 'beantragt'), vb('C', 'beantragt'), vb('D', 'beantragt')],
      HEUTE,
    );
    expect(abweichungsMuster(v).map(m => m.anzahl)).toEqual([3, 1]);
  });

  it('deckelt die Beispiele bei fünf, zählt aber weiter', () => {
    const viele = Array.from({ length: 9 }, (_, i) => vb(`VB-${i}`, 'beantragt'));
    const m = abweichungsMuster(vergleichePhasen(umgehaengt, viele, HEUTE));
    expect(m[0]?.anzahl).toBe(9);
    expect(m[0]?.beispiele).toHaveLength(5);
  });

  it('nimmt erklärte Nicht-Vergleiche nicht auf', () => {
    const v = vergleichePhasen(seed, [vb('A', 'Irrläufer'), vb('B', 'Wunschstatus')], HEUTE);
    expect(abweichungsMuster(v)).toEqual([]);
  });
});

describe('vergleichZusammenfassung', () => {
  it('sagt ausdrücklich, wenn es keine Abweichung gibt', () => {
    const v = vergleichePhasen(seed, [vb('VB-1', 'beantragt')], HEUTE);
    expect(vergleichZusammenfassung(v)).toContain('Keine Abweichung');
  });

  it('benennt leeren Bestand als solchen', () => {
    expect(vergleichZusammenfassung(vergleichePhasen(seed, [], HEUTE)))
      .toBe('Kein Bestand geladen — nichts zu vergleichen.');
  });
});
