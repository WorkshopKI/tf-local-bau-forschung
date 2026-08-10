/**
 * Die **Ebenen des Zeitverlaufs**.
 *
 * Zwei Regeln, die hier zählen:
 *
 * 1. Eine Ebene ohne Pille bleibt sichtbar. Auf einer verdichteten Verbundzeile
 *    IST die Verbundbahn der Vorgang — würde die Voreinstellung auch dort
 *    greifen, verschwände die Bahn samt dem Urteil des Stillstands-Wächters,
 *    ohne dass jemand sie zurückholen könnte.
 * 2. Die Bahnen der Teilvorhaben haben gar keine Pille mehr (v3.41): sie sind
 *    der Zeitverlauf, kein Zusatz. Kein Schaltzustand darf sie entfernen.
 */
import { describe, it, expect } from 'vitest';
import type { VerlaufsSpur } from '@/core/status/verlauf';
import {
  EBENEN, EBENEN_DEFAULT, filtereSpuren, initialeEbenen, schalte, verfuegbareEbenen,
  type Ebene,
} from '@/plugins/antraege/ausklapp/zeitverlauf/ebenen';

function spur(id: string, art: 'tv' | 'verbund'): VerlaufsSpur {
  return {
    art, id, zustand: 'verlauf', herkunft: 'abgeleitet',
    segmente: [], uebergaenge: [], journalAb: null, projektform: { art: 'bekannt', form: 'NW' },
  };
}

const SPUREN = [spur('vb', 'verbund'), spur('tv-1', 'tv'), spur('tv-2', 'tv')];

const lage = (p: Partial<Parameters<typeof verfuegbareEbenen>[0]> = {}) => ({
  hatVerbundSpur: true, istVerbundZeile: false, hatMeilensteine: true, ...p,
});

describe('verfuegbareEbenen', () => {
  it('bietet drei Pillen in der Reihenfolge Verbund · Kürzel · Meilensteine', () => {
    expect(verfuegbareEbenen(lage())).toEqual(['verbund', 'kuerzel', 'meilensteine']);
  });

  it('kennt „Phasen" gar nicht mehr — die Bahnen sind der Zeitverlauf', () => {
    expect(EBENEN).not.toContain('phasen' as unknown as Ebene);
    expect(verfuegbareEbenen(lage())).not.toContain('phasen' as unknown as Ebene);
  });

  it('bietet auf einer Verbundzeile KEINE Verbund-Pille', () => {
    expect(verfuegbareEbenen(lage({ istVerbundZeile: true }))).not.toContain('verbund');
  });

  it('lässt Meilensteine weg, wo es keine gibt', () => {
    expect(verfuegbareEbenen(lage({ hatMeilensteine: false }))).not.toContain('meilensteine');
  });

  it('bietet die Kürzel-Etage immer an — sie hängt an keiner Bedingung', () => {
    expect(verfuegbareEbenen(lage({ hatVerbundSpur: false, hatMeilensteine: false })))
      .toEqual(['kuerzel']);
  });
});

describe('initialeEbenen', () => {
  it('startet mit Verbund und Kürzel an, Meilensteine aus', () => {
    const an = initialeEbenen(['verbund', 'kuerzel', 'meilensteine']);
    expect([...an].sort()).toEqual([...EBENEN_DEFAULT].sort());
    expect(an.has('meilensteine')).toBe(false);
  });

  it('schaltet nichts ein, was es hier nicht gibt', () => {
    expect([...initialeEbenen(['kuerzel', 'meilensteine'])]).toEqual(['kuerzel']);
  });
});

describe('schalte', () => {
  it('kippt genau eine Ebene und lässt die alte Menge unberührt', () => {
    const an = new Set<Ebene>(['verbund', 'kuerzel']);
    const neu = schalte(an, 'meilensteine');
    expect(neu.has('meilensteine')).toBe(true);
    expect(an.has('meilensteine')).toBe(false);
    expect(schalte(neu, 'meilensteine').has('meilensteine')).toBe(false);
  });
});

describe('filtereSpuren', () => {
  const verfuegbar: Ebene[] = ['verbund', 'kuerzel', 'meilensteine'];

  it('nimmt die Verbundbahn heraus, solange ihre Pille aus ist', () => {
    const r = filtereSpuren(SPUREN, new Set<Ebene>(['kuerzel']), verfuegbar);
    expect(r.map(s => s.id)).toEqual(['tv-1', 'tv-2']);
  });

  it('lässt die Teilvorhaben-Bahnen in JEDEM Schaltzustand stehen', () => {
    // Kein Schaltzustand darf den Inhalt der Ansicht entfernen.
    expect(filtereSpuren(SPUREN, new Set<Ebene>(), verfuegbar).map(s => s.id))
      .toEqual(['tv-1', 'tv-2']);
    expect(filtereSpuren(SPUREN, new Set<Ebene>(EBENEN), verfuegbar).map(s => s.id))
      .toEqual(['vb', 'tv-1', 'tv-2']);
  });

  it('lässt eine Ebene ohne Pille stehen, statt sie still auszublenden', () => {
    // Verbundzeile: keine Verbund-Pille, also auch kein Ausblenden.
    const r = filtereSpuren(SPUREN, new Set<Ebene>(), ['kuerzel']);
    expect(r.map(s => s.id)).toEqual(['vb', 'tv-1', 'tv-2']);
  });
});
