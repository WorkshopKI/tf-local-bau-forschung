/**
 * Die **Ebenen des Zeitverlaufs**.
 *
 * Die eine Regel, die hier zählt: eine Ebene ohne Pille bleibt sichtbar. Auf
 * einer verdichteten Verbundzeile IST die Verbundbahn der Vorgang — würde die
 * Voreinstellung „Verbund aus" auch dort greifen, verschwände die Bahn samt dem
 * Urteil des Stillstands-Wächters, ohne dass jemand sie zurückholen könnte.
 */
import { describe, it, expect } from 'vitest';
import type { VerlaufsSpur } from '@/core/status/verlauf';
import {
  EBENEN_DEFAULT, filtereSpuren, initialeEbenen, schalte, verfuegbareEbenen,
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
  hatVerbundSpur: true, istVerbundZeile: false, hatTvSpur: true, hatMeilensteine: true, ...p,
});

describe('verfuegbareEbenen', () => {
  it('bietet alle vier, wo es alle vier gibt — in Entwurfs-Reihenfolge', () => {
    expect(verfuegbareEbenen(lage())).toEqual(['phasen', 'meilensteine', 'kuerzel', 'verbund']);
  });

  it('bietet auf einer Verbundzeile KEINE Verbund-Pille', () => {
    expect(verfuegbareEbenen(lage({ istVerbundZeile: true }))).not.toContain('verbund');
  });

  it('lässt Meilensteine weg, wo es keine gibt', () => {
    expect(verfuegbareEbenen(lage({ hatMeilensteine: false }))).not.toContain('meilensteine');
  });
});

describe('initialeEbenen', () => {
  it('folgt der Voreinstellung des Entwurfs: Phasen + Meilensteine', () => {
    expect([...initialeEbenen(['phasen', 'meilensteine', 'kuerzel', 'verbund'])].sort())
      .toEqual([...EBENEN_DEFAULT].sort());
  });

  it('schaltet nichts ein, was es hier nicht gibt', () => {
    expect([...initialeEbenen(['phasen', 'kuerzel'])]).toEqual(['phasen']);
  });
});

describe('schalte', () => {
  it('kippt genau eine Ebene und lässt die alte Menge unberührt', () => {
    const an = new Set<Ebene>(['phasen', 'meilensteine']);
    const neu = schalte(an, 'kuerzel');
    expect(neu.has('kuerzel')).toBe(true);
    expect(an.has('kuerzel')).toBe(false);
    expect(schalte(neu, 'kuerzel').has('kuerzel')).toBe(false);
  });
});

describe('filtereSpuren', () => {
  const verfuegbar: Ebene[] = ['phasen', 'meilensteine', 'kuerzel', 'verbund'];

  it('nimmt die Verbundbahn heraus, solange ihre Pille aus ist', () => {
    const r = filtereSpuren(SPUREN, new Set<Ebene>(['phasen']), verfuegbar);
    expect(r.map(s => s.id)).toEqual(['tv-1', 'tv-2']);
  });

  it('nimmt die Teilvorhaben-Bahnen heraus, solange „Phasen" aus ist', () => {
    const r = filtereSpuren(SPUREN, new Set<Ebene>(['verbund']), verfuegbar);
    expect(r.map(s => s.id)).toEqual(['vb']);
  });

  it('lässt eine Ebene ohne Pille stehen, statt sie still auszublenden', () => {
    // Verbundzeile: keine Verbund-Pille, also auch kein Ausblenden.
    const r = filtereSpuren(SPUREN, new Set<Ebene>(['phasen']), ['phasen', 'kuerzel']);
    expect(r.map(s => s.id)).toEqual(['vb', 'tv-1', 'tv-2']);
  });

  it('liefert leer, wenn beide Bahn-Ebenen aus sind — der Reiter sagt es dann', () => {
    expect(filtereSpuren(SPUREN, new Set<Ebene>(), verfuegbar)).toEqual([]);
  });
});
