import { describe, it, expect } from 'vitest';
import { meilensteinAnlaesse, zieltagAnlass } from '@/plugins/home/widgets/fristAnlaesse';
import { kuerzelIndex, type WaechterErgebnis } from '@/core/status';
import type { StatusFeldEintrag } from '@/core/status/typen';
import type { MeilensteinKnoten, VerbundMeilensteine } from '@/core/meilensteine';

const HEUTE = new Date('2026-03-01T00:00:00.000Z').getTime();

const KNOTEN: MeilensteinKnoten = {
  id: 'k1', elternId: null, nummer: '3', label: 'Antrag zugewiesen', sollWoche: 2,
  relevantFuerFrist: true, nurTypen: [], aktiv: true, sortierung: 10,
  bedingung: { feldId: 'tib_kuerz', op: 'gefuellt' },
};

/**
 * feldIds bewusst NICHT `D_<Kürzel>`: sonst bestünde auch eine geratene Spalte
 * den Test. Die Umlaut-Kürzel stehen in NFD, so kommen sie aus der Zuarbeit;
 * normalize hält das unabhängig davon, wie der Editor das Literal speichert.
 */
const KATALOG = kuerzelIndex([
  { feldId: 'D_AK4_KAT', label: 'Gutachten kfm.', typ: 'datum', ebene: 'tv', code: 'AK4' } as StatusFeldEintrag,
  { feldId: 'D_AT4_KAT', label: 'Gutachten techn.', typ: 'datum', ebene: 'tv', code: 'AT4' } as StatusFeldEintrag,
  { feldId: 'D_AEK_KAT', label: 'Änderung kfm.', typ: 'datum', ebene: 'tv', code: 'ÄK'.normalize('NFD') } as StatusFeldEintrag,
  { feldId: 'D_AET_KAT', label: 'Änderung techn.', typ: 'datum', ebene: 'tv', code: 'ÄT'.normalize('NFD') } as StatusFeldEintrag,
]);

function mitPaar(gesetzt: string, fehlt: string): WaechterErgebnis {
  return {
    urteil: 'haengt', tage: 40, zieltage: 30, paar: { gesetzt, fehlt },
  } as unknown as WaechterErgebnis;
}

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

  it('ein Zieltag-Anlass ohne Kürzel-Paar nennt den Verbund-Status als Quelle', () => {
    const ohnePaar = { urteil: 'haengt', tage: 40, zieltage: 30, paar: null } as unknown as WaechterErgebnis;
    expect(zieltagAnlass('vb-1', 'ALPHA', 'NF gestellt', ohnePaar, KATALOG).quellFelder).toEqual(['STATUS_VB']);
  });

  it('ein Kürzel-Paar nennt die Katalog-Felder beider Kürzel — gesetzt zuerst', () => {
    const a = zieltagAnlass('vb-1', 'ALPHA', 'x', mitPaar('AT4', 'AK4'), KATALOG);
    expect(a.grund).toBe('AT4 gesetzt, AK4 fehlt');
    expect(a.quellFelder).toEqual(['D_AT4_KAT', 'D_AK4_KAT']);
  });

  it('das Kürzel wird in normKey-Form nachgeschlagen (NFD im Katalog, NFC im Paar)', () => {
    const a = zieltagAnlass('vb-1', 'ALPHA', 'x', mitPaar('ÄK'.normalize('NFC'), 'ÄT'.normalize('NFC')), KATALOG);
    expect(a.quellFelder).toEqual(['D_AEK_KAT', 'D_AET_KAT']);
  });

  it('kennt der Katalog ein Kürzel nicht, wird keine Spalte daraus zusammengesetzt', () => {
    const halb = zieltagAnlass('vb-1', 'ALPHA', 'x', mitPaar('AK4', 'ZZZ'), KATALOG);
    expect(halb.quellFelder).toEqual(['D_AK4_KAT']);
    const keins = zieltagAnlass('vb-1', 'ALPHA', 'x', mitPaar('YYY', 'ZZZ'), KATALOG);
    expect(keins.quellFelder).toBeUndefined();
    // Ohne Katalog-Felder bleibt das Paar unbelegt — nie `D_` + Kürzel.
    expect(zieltagAnlass('vb-1', 'ALPHA', 'x', mitPaar('AK4', 'AT4'), kuerzelIndex([])).quellFelder)
      .toBeUndefined();
  });
});
