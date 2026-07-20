/**
 * VB-Zuordnung und Fundstellen-Ableitung. Beides rein — der LLM-Anteil
 * (das Aspekt-Mapping) wird als Eingabe eingesetzt, nicht erzeugt.
 */
import type { AspektMapping } from '@/plugins/antraege/aufbereitung/aspekte';
import { parseVbGliederung } from '@/plugins/antraege/aufbereitung/gliederung';
import type { DocumentMeta } from '@/plugins/dokumente/store';
import { describe, expect, it } from 'vitest';
import { CHECKLISTE_SEED } from '../checkliste/seed';
import { importiereEinreichung } from '../import/adapter';
import { fundstellenFuerAspekte, fundstellenFuerItem } from '../vb/fundstellen';
import { findeVbKandidaten } from '../vb/zuordnung';
import { DUMMY_PFAD, TEST_KONTEXT, leseFixture } from './fixtures';

const antwort = importiereEinreichung(leseFixture(DUMMY_PFAD), TEST_KONTEXT);
if (!antwort.ok) throw new Error(antwort.fehler);
const DUMMY = antwort.einreichung;

const VB_MARKDOWN = [
  '# 1 Ausgangssituation',
  'Der Markt verlangt schnellere Verfahren als heute verfügbar.',
  '',
  '# 2 Stand der Technik',
  'Bestehende Lösungen erreichen 40 Prozent Wirkungsgrad.',
  '',
  '# 3 Arbeitsplanung',
  'Die Arbeit gliedert sich in zwei Arbeitspakete über 16 Personenmonate.',
].join('\n');

const GLIEDERUNG = parseVbGliederung(VB_MARKDOWN);

function doc(id: string, filename: string): DocumentMeta {
  return { id, filename, format: 'md', tags: [], created: '2026-07-01T00:00:00.000Z' };
}

describe('VB-Zuordnung — Vorschlag, keine Entscheidung', () => {
  it('bewertet den Akronym-Treffer am hoechsten', () => {
    const treffer = findeVbKandidaten([
      doc('a', 'Irgendwas.pdf'),
      doc('b', 'Akronym_Vorhabensbeschreibung.pdf'),
      doc('c', 'Vorhabensbeschreibung_fremd.pdf'),
    ], DUMMY);

    expect(treffer[0]?.doc.id).toBe('b');
    expect(treffer[0]?.grund.join(' ')).toMatch(/Akronym/);
  });

  it('erkennt eine Vorhabensbeschreibung auch ohne Akronym am Dateinamen', () => {
    const treffer = findeVbKandidaten([doc('c', 'Projektbeschreibung.pdf')], DUMMY);
    expect(treffer).toHaveLength(1);
    expect(treffer[0]?.grund.join(' ')).toMatch(/Vorhabensbeschreibung/);
  });

  it('schlaegt nichts vor, wenn nichts passt — statt irgendetwas', () => {
    expect(findeVbKandidaten([doc('x', 'Rechnung_2026.pdf')], DUMMY)).toEqual([]);
  });

  it('ignoriert sehr kurze Akronyme, um Zufallstreffer zu vermeiden', () => {
    const kurz = { ...DUMMY, stamm: { ...DUMMY.stamm, akronym: 'AB' } };
    const treffer = findeVbKandidaten([doc('x', 'kabel.pdf')], kurz);
    expect(treffer).toEqual([]);
  });
});

describe('Fundstellen aus dem Aspekt-Mapping', () => {
  const mapping: AspektMapping = {
    zuordnung: {
      A: ['k-1'],
      E: ['k-2'],
      H: ['k-3'],
    },
    fehlend: {},
  };

  it('liefert die Sektionen zu einem Aspekt', () => {
    const f = fundstellenFuerAspekte(['E'], mapping, GLIEDERUNG, VB_MARKDOWN);
    expect(f).toHaveLength(1);
    expect(f[0]?.titel).toContain('Stand der Technik');
    expect(f[0]?.auszug).toContain('40 Prozent');
  });

  it('haelt die Reihenfolge der Gliederung, nicht die der Aspekt-Liste', () => {
    const f = fundstellenFuerAspekte(['H', 'A'], mapping, GLIEDERUNG, VB_MARKDOWN);
    expect(f.map(x => x.nummer)).toEqual(['1', '3']);
  });

  it('nennt alle Aspekte, ueber die eine Sektion gefunden wurde', () => {
    const doppelt: AspektMapping = { zuordnung: { A: ['k-1'], B: ['k-1'] }, fehlend: {} };
    const f = fundstellenFuerAspekte(['A', 'B'], doppelt, GLIEDERUNG, VB_MARKDOWN);
    expect(f).toHaveLength(1);
    expect(f[0]?.ueberAspekte.sort()).toEqual(['A', 'B']);
  });

  it('liefert nichts ohne Mapping — der LLM-Anteil ist optional', () => {
    expect(fundstellenFuerAspekte(['E'], null, GLIEDERUNG, VB_MARKDOWN)).toEqual([]);
  });

  it('liefert nichts fuer Aspekte ohne zugeordnete Sektion', () => {
    expect(fundstellenFuerAspekte(['J'], mapping, GLIEDERUNG, VB_MARKDOWN)).toEqual([]);
  });

  it('schneidet die Ueberschriftenzeile aus dem Auszug', () => {
    const f = fundstellenFuerAspekte(['A'], mapping, GLIEDERUNG, VB_MARKDOWN);
    expect(f[0]?.auszug).not.toContain('Ausgangssituation');
    expect(f[0]?.auszug).toContain('Der Markt verlangt');
  });
});

describe('Fundstellen je Pruefkriterium', () => {
  const mapping: AspektMapping = { zuordnung: { H: ['k-3'], E: ['k-2'] }, fehlend: {} };

  it('findet ueber die Aspekt-Achse des Kriteriums', () => {
    const ap = CHECKLISTE_SEED.items.find(i => i.id === 'arbeitsplan.ap-untersetzt')!;
    expect(ap.aspekte).toContain('H');
    const f = fundstellenFuerItem(ap, mapping, GLIEDERUNG, VB_MARKDOWN);
    expect(f.map(x => x.titel)).toEqual(['Arbeitsplanung']);
  });

  it('zeigt fuer Kriterien ohne Aspekt-Achse bewusst nichts', () => {
    const extern = CHECKLISTE_SEED.items.find(i => i.id === 'zuwendung.website')!;
    expect(extern.aspekte).toBeUndefined();
    expect(fundstellenFuerItem(extern, mapping, GLIEDERUNG, VB_MARKDOWN)).toEqual([]);
  });

  it('ordnet dem Innovationsgrad-Kriterium den Stand der Technik zu', () => {
    const ziel = CHECKLISTE_SEED.items.find(i => i.id === 'inno.zielstellung')!;
    const f = fundstellenFuerItem(ziel, mapping, GLIEDERUNG, VB_MARKDOWN);
    expect(f.map(x => x.titel)).toEqual(['Stand der Technik']);
  });
});
