/**
 * Die **Meilenstein-Gliederung** als Baum-Bestand.
 *
 * Zwei Fallen, die der eigene Adapter vermeidet: ein Blatt darf kein Chevron
 * bekommen (der Adapter des Konfigurations-Tabs macht jeden Knoten zum Ordner,
 * weil dort jeder ein Drop-Ziel ist), und nicht relevante Stufen bleiben stehen
 * — weggelassen wären sie von „noch offen" nicht zu unterscheiden.
 */
import { describe, it, expect } from 'vitest';
import { baueStufen } from '@/plugins/antraege/ausklapp/meilensteinLage';
import {
  GLIEDERUNG_ROOT, baueGliederung,
} from '@/plugins/antraege/ausklapp/gliederung/gliederungBaum';
import { ergebnis, knoten, lageDa } from './fixtures/meilensteinLage';

const HEUTE = '2026-08-05';

const lage = () => lageDa(
  [
    knoten({ id: 'k1', nummer: '1', label: 'Antrag vollständig' }),
    knoten({ id: 'k1-1', nummer: '1.1', label: 'Antrag eingegeben', elternId: 'k1', sortierung: 10 }),
    knoten({ id: 'k1-2', nummer: '1.2', label: 'Schriftstück zur QS', elternId: 'k1', sortierung: 20 }),
    knoten({ id: 'k2', nummer: '2', label: 'QS der Erstentscheidung', sortierung: 20 }),
  ],
  [
    ergebnis('k1', 'gerissen', { sollDatum: '2026-02-02' }),
    ergebnis('k1-1', 'erreicht', { istDatum: '2026-01-10' }),
    ergebnis('k1-2', 'gerissen', { sollDatum: '2026-01-12' }),
    ergebnis('k2', 'nichtRelevant'),
  ],
);

const bauen = () => baueGliederung(lage(), baueStufen(lage()), HEUTE);

describe('baueGliederung — Baumbau', () => {
  it('hängt nur die oberste Ebene an die Wurzel', () => {
    const g = bauen();
    expect(g.rootId).toBe(GLIEDERUNG_ROOT);
    expect(g.obersteEbene).toEqual(['k1', 'k2']);
    expect(g.items[GLIEDERUNG_ROOT]?.children).toEqual(['k1', 'k2']);
  });

  it('macht nur Knoten MIT Kindern zu Ordnern', () => {
    const g = bauen();
    expect(g.items['k1']?.isFolder).toBe(true);
    expect(g.items['k1']?.children).toEqual(['k1-1', 'k1-2']);
    expect(g.items['k1-1']?.isFolder).toBe(false);
    expect(g.items['k1-1']?.children).toBeUndefined();
    expect(g.items['k2']?.isFolder).toBe(false);
  });

  it('behält nicht relevante Stufen — die Nummern bekämen sonst Lücken', () => {
    expect(bauen().items['k2']?.data.statusText).toBe('nicht relevant');
  });
});

describe('baueGliederung — Zeilentexte', () => {
  it('nennt bei einer gerissenen Stufe das Zustandswort, die Tage stehen im Titel (v6.66)', () => {
    // 12.01.2026 → 05.08.2026 = 205 Tage. In der Zeile trug „205 T über" dasselbe
    // Rot wie die Frist und las sich als ihre Überschreitung.
    const zeile = bauen().items['k1-2']?.data;
    expect(zeile?.statusText).toBe('gerissen');
    expect(zeile?.titel).toContain('seit 205 Tagen gerissen');
  });

  it('zeigt bei erreicht das Ist-Datum vierstellig, beim Soll-Termin zweistellig', () => {
    const g = bauen();
    expect(g.items['k1-1']?.data.datumText).toBe('10.01.2026');
    expect(g.items['k1-2']?.data.datumText).toBe('Soll 12.01.26');
  });

  it('setzt für eine nicht relevante Stufe einen Strich, kein Datum', () => {
    expect(bauen().items['k2']?.data.datumText).toBe('—');
  });

  it('gibt dem Punkt je Zustand seine Form', () => {
    const g = bauen();
    expect(g.items['k1-1']?.data.punktForm).toBe('gefuellt');
    expect(g.items['k1-2']?.data.punktForm).toBe('gefuellt');
    expect(g.items['k2']?.data.punktForm).toBe('gestrichelt');
  });

  it('sagt im Tooltip einer gerissenen Sammel-Stufe, wo die Ursache liegt', () => {
    const g = bauen();
    expect(g.items['k1']?.data.titel).toContain('Ursache in der Unterebene');
    expect(g.items['k1-2']?.data.titel).not.toContain('Ursache in der Unterebene');
  });

  it('erklärt eine nicht relevante Stufe, statt sie nur grau zu setzen', () => {
    expect(bauen().items['k2']?.data.titel).toContain('nicht vorgesehen');
  });

  it('sagt es, wenn ohne Antragseingang kein Soll-Termin existiert', () => {
    const ohne = lageDa(
      [knoten({ id: 'a', nummer: '1' })],
      [ergebnis('a', 'offen', { sollDatum: null })],
      { antragsdatum: null },
    );
    const g = baueGliederung(ohne, baueStufen(ohne), HEUTE);
    expect(g.items['a']?.data.titel).toContain('kein Soll-Termin');
    expect(g.items['a']?.data.datumText).toBe('—');
  });
});

describe('baueStufen — die Blattregel', () => {
  it('macht einen Knoten, dessen Kinder alle nicht relevant sind, zum Blatt', () => {
    const l = lageDa(
      [
        knoten({ id: 'k', nummer: '1' }),
        knoten({ id: 'k-1', nummer: '1.1', elternId: 'k' }),
      ],
      [
        ergebnis('k', 'gerissen', { sollDatum: '2026-01-12' }),
        ergebnis('k-1', 'nichtRelevant'),
      ],
    );
    const s = baueStufen(l);
    expect(s.find(x => x.knoten.id === 'k')?.blatt).toBe(true);
  });

  it('lässt Knoten ohne Bewertung weg, statt einen Zustand zu raten', () => {
    const l = lageDa(
      [knoten({ id: 'a', nummer: '1' }), knoten({ id: 'b', nummer: '2' })],
      [ergebnis('a', 'offen')],
    );
    expect(baueStufen(l).map(s => s.knoten.id)).toEqual(['a']);
  });
});
