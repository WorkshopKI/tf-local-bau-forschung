import { describe, it, expect } from 'vitest';
import { meilensteinAnlaesse, zieltagAnlass } from '@/plugins/home/widgets/fristAnlaesse';
import type { WaechterErgebnis } from '@/core/status';
import type { MeilensteinKnoten, VerbundMeilensteine } from '@/core/meilensteine';

const HEUTE = new Date('2026-03-01T00:00:00.000Z').getTime();

const KNOTEN: MeilensteinKnoten = {
  id: 'k1', elternId: null, nummer: '3', label: 'Antrag zugewiesen', sollWoche: 2,
  relevantFuerFrist: true, nurTypen: [], aktiv: true, sortierung: 10,
  bedingung: { feldId: 'tib_kuerz', op: 'gefuellt' },
};

describe('Fristen-Anlässe tragen, woraus ihr Grund gelesen wurde', () => {
  it('ein Meilenstein-Anlass trägt seinen Plan-Knoten', () => {
    const b: VerbundMeilensteine = {
      verbundId: 'vb-1', antragsdatum: '2026-01-05', anker: '2026-01-05', typ: 'FuE',
      wocheAktuell: 8, fristDatum: '2026-04-05', restTage: 35, prognose: 'gefaehrdet',
      ergebnisse: [{
        knotenId: 'k1', zustand: 'gerissen', sollDatum: '2026-01-19', istDatum: null, abweichungTage: null,
      }],
    };
    const [a] = meilensteinAnlaesse([b], [KNOTEN], () => 'ALPHA', HEUTE);
    expect(a?.knoten).toBe(KNOTEN);
    expect(a?.quellFelder).toBeUndefined();
  });

  it('ein Zieltag-Anlass nennt den Verbund-Status als Quelle — beim Kürzel-Paar nichts Geratenes', () => {
    const ohnePaar = { urteil: 'haengt', tage: 40, zieltage: 30, paar: null } as unknown as WaechterErgebnis;
    expect(zieltagAnlass('vb-1', 'ALPHA', 'NF gestellt', ohnePaar).quellFelder).toEqual(['STATUS_VB']);
    const mitPaar = {
      urteil: 'haengt', tage: 40, zieltage: 30, paar: { gesetzt: 'ABB', fehlt: 'ABL' },
    } as unknown as WaechterErgebnis;
    expect(zieltagAnlass('vb-1', 'ALPHA', 'x', mitPaar).quellFelder).toBeUndefined();
  });
});
