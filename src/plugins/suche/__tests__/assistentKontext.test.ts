import { describe, it, expect } from 'vitest';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import {
  buildTrefferKontext,
  baueKontextBlock,
  baueAehnlichkeitsBlock,
  teileNachFundstelle,
  waehleKontextTreffer,
  kontextChipLabel,
  threadHinweis,
  KONTEXT_MAX_TREFFER,
} from '../assistentKontext';

function treffer(p: Partial<UnifiedSearchResult> & Pick<UnifiedSearchResult, 'id' | 'title'>): UnifiedSearchResult {
  return { type: 'antrag', score: 0.9, method: 'fulltext', snippet: '', ...p };
}

/** Wie viele nummerierte Trefferzeilen der Block trägt. */
function zeilenImBlock(block: string): number {
  return block.split('\n').filter(l => /^\d+\. /.test(l)).length;
}

describe('buildTrefferKontext', () => {
  it('liefert Leerstring bei keinen Treffern', () => {
    expect(buildTrefferKontext([])).toBe('');
  });

  it('nummeriert Treffer und übernimmt Titel + FKZ + Snippet', () => {
    const out = buildTrefferKontext([
      treffer({ id: 'a', title: 'AM Qualität', fkz: '16KN086', snippet: 'Additive Fertigung' }),
    ]);
    expect(out).toContain('1. AM Qualität (16KN086)');
    expect(out).toContain('Additive Fertigung');
    expect(out).toContain('--- Aktuelle Suchtreffer (Kontext) ---');
    expect(out).toContain('--- Ende Suchtreffer ---');
  });

  it('lässt den FKZ-Zusatz weg, wenn kein FKZ vorhanden ist', () => {
    const out = buildTrefferKontext([treffer({ id: 'a', title: 'Ohne FKZ' })]);
    expect(out).toContain('1. Ohne FKZ');
    expect(out).not.toContain('()');
  });

  it('respektiert das Limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => treffer({ id: `t${i}`, title: `Treffer ${i}` }));
    const out = buildTrefferKontext(many, 3);
    expect(out).toContain('1. Treffer 0');
    expect(out).toContain('3. Treffer 2');
    expect(out).not.toContain('4. Treffer 3');
  });

  it('kollabiert Whitespace im Snippet und kürzt (300 + Auslassungszeichen)', () => {
    const long = 'wort '.repeat(200); // 1000 Zeichen, viele Spaces
    const out = buildTrefferKontext([treffer({ id: 'a', title: 'T', snippet: `foo\n\n  bar   baz` })]);
    expect(out).toContain('foo bar baz');
    const outLong = buildTrefferKontext([treffer({ id: 'b', title: 'T', snippet: long })]);
    const snippetLine = outLong.split('\n').find(l => l.startsWith('wort')) ?? '';
    expect(snippetLine.length).toBeLessThanOrEqual(301);
    expect(snippetLine.endsWith('…')).toBe(true);
  });

  it('trägt Relevanz, Fundstellen und Kurzbeschreibung — damit das Modell nicht rät', () => {
    const out = buildTrefferKontext([treffer({
      id: 'a', title: 'SERS-FINDER', fkz: '16KN042124',
      snippet: 'Institut für Nanophotonik',
      relevanzStufe: 3,
      trefferfelder: ['titel', 'kurzbeschreibung'],
      kurzbeschreibung: 'Normierungsalgorithmen zum Spektrentransfer.',
    })]);
    expect(out).toContain('Relevanz hoch');
    // Beschriftungen aus TREFFERFELD_LABEL — dieselbe Quelle wie die Chips in
    // der Trefferliste, Abkürzung inbegriffen. Eine zweite, ausgeschriebene
    // Fassung nur für den Prompt wären zwei Wahrheiten über dasselbe Feld.
    expect(out).toContain('gefunden in: Titel, Kurzbeschr.');
    expect(out).toContain('Normierungsalgorithmen zum Spektrentransfer.');
  });

  it('nimmt die Belegstelle eines Dokuments, wenn keine Kurzbeschreibung vorliegt', () => {
    const out = buildTrefferKontext([treffer({
      id: 'a', title: 'Gutachten', textstelle: { quelle: 'g.docx', text: 'Belegsatz aus dem Dokument.' },
    })]);
    expect(out).toContain('Belegsatz aus dem Dokument.');
  });
});

describe('waehleKontextTreffer — der Auszug entsteht an EINER Stelle', () => {
  it('deckelt auf KONTEXT_MAX_TREFFER', () => {
    const many = Array.from({ length: 200 }, (_, i) => treffer({ id: `t${i}`, title: `Treffer ${i}` }));
    expect(waehleKontextTreffer(many)).toHaveLength(KONTEXT_MAX_TREFFER);
  });

  it('schneidet über das Zeichen-Budget, bevor das Limit greift', () => {
    const many = Array.from({ length: 40 }, (_, i) => treffer({
      id: `t${i}`, title: `Treffer ${i}`, kurzbeschreibung: 'x'.repeat(200),
    }));
    const wenige = waehleKontextTreffer(many, KONTEXT_MAX_TREFFER, 600);
    expect(wenige.length).toBeGreaterThan(0);
    expect(wenige.length).toBeLessThan(40);
  });

  it('nimmt den ersten Treffer auch dann, wenn er allein das Budget sprengt', () => {
    const dick = treffer({ id: 'a', title: 'T', kurzbeschreibung: 'x'.repeat(300) });
    expect(waehleKontextTreffer([dick], KONTEXT_MAX_TREFFER, 10)).toHaveLength(1);
  });

  it('gibt die Auswahl in Trefferreihenfolge zurück', () => {
    const many = Array.from({ length: 5 }, (_, i) => treffer({ id: `t${i}`, title: `Treffer ${i}` }));
    expect(waehleKontextTreffer(many, 3).map(r => r.id)).toEqual(['t0', 't1', 't2']);
  });
});

describe('der Block gibt sich als Auszug zu erkennen', () => {
  const viele = Array.from({ length: 558 }, (_, i) => treffer({ id: `t${i}`, title: `Treffer ${i}` }));

  it('nennt im Kopf beide Zahlen und die fehlenden', () => {
    const gewaehlt = waehleKontextTreffer(viele);
    const block = baueKontextBlock(gewaehlt, viele.length);
    expect(block).toContain('Die 40 relevantesten von 558 Suchtreffern');
    expect(block).toContain('Die übrigen 518 liegen NICHT vor.');
  });

  it('verlangt bei einem Auszug die ausdrückliche Einschränkung in der Antwort', () => {
    const block = baueKontextBlock(waehleKontextTreffer(viele), viele.length);
    expect(block).toContain('nur diese 40 vorliegen');
    expect(block).toContain('urteile nicht über die übrigen');
  });

  it('behauptet keinen Auszug, wenn alle Treffer mitfahren', () => {
    const drei = viele.slice(0, 3);
    const block = baueKontextBlock(waehleKontextTreffer(drei), drei.length);
    expect(block).toContain('Alle 3 Suchtreffer');
    expect(block).not.toContain('NICHT vor');
    expect(block).not.toContain('urteile nicht');
  });
});

describe('kontextChipLabel', () => {
  it('nennt eine vollständige Liste ohne Bruchzahl', () => {
    expect(kontextChipLabel(1, 1)).toBe('Kontext: 1 Suchtreffer');
    expect(kontextChipLabel(16, 16)).toBe('Kontext: 16 Suchtreffer');
    expect(kontextChipLabel(0, 0)).toBe('Kontext: 0 Suchtreffer');
  });

  it('nennt bei einem Auszug beide Zahlen', () => {
    expect(kontextChipLabel(40, 558)).toBe('Kontext: 40 von 558 Treffern');
  });

  it('nimmt ohne zweite Zahl Vollständigkeit an', () => {
    expect(kontextChipLabel(8)).toBe('Kontext: 8 Suchtreffer');
  });
});

describe('threadHinweis — die Unterhaltung sagt, zu welcher Suche sie gehört', () => {
  it('schweigt, solange nichts gesendet wurde', () => {
    expect(threadHinweis(null, 'standard', false)).toBeNull();
    expect(threadHinweis(null, 'standard', true)).toBeNull();
  });

  it('schweigt, wenn die Treffer noch die besprochenen sind', () => {
    expect(threadHinweis('standard', 'standard', true)).toBeNull();
  });

  it('schweigt ohne Nachrichten — ein leerer Thread braucht keine Einordnung', () => {
    expect(threadHinweis('standard', 'normung', false)).toBeNull();
  });

  it('nennt die Suche, unter der die Unterhaltung begann', () => {
    expect(threadHinweis('standard', 'normung', true))
      .toBe('Diese Unterhaltung gehört zur Suche „standard".');
  });

  it('sagt es auch, wenn beim Start gar keine Suche lief', () => {
    expect(threadHinweis('', 'normung', true))
      .toBe('Diese Unterhaltung entstand ohne Suchtreffer.');
  });

  it('meldet sich auch, wenn die Suche geleert wurde — die Antwort steht ja noch da', () => {
    expect(threadHinweis('standard', '', true))
      .toBe('Diese Unterhaltung gehört zur Suche „standard".');
  });
});

/**
 * Der Guard gegen die Rückkehr des Befunds aus v4.77: der Chip nannte 558,
 * während der Prompt acht Treffer trug. Beide Zahlen müssen aus DERSELBEN
 * Auswahl stammen — deshalb wird hier die Zahl im Etikett gegen die Zeilen im
 * Block gehalten, nicht gegen die Länge der Trefferliste.
 */
describe('Chip und Prompt sagen dasselbe', () => {
  it('das Etikett nennt genau so viele Treffer, wie der Block trägt', () => {
    const viele = Array.from({ length: 558 }, (_, i) => treffer({
      id: `t${i}`, title: `Treffer ${i}`, kurzbeschreibung: `Inhalt ${i}`,
    }));
    const gewaehlt = waehleKontextTreffer(viele);
    const block = baueKontextBlock(gewaehlt, viele.length);
    const etikett = kontextChipLabel(gewaehlt.length, viele.length);

    expect(zeilenImBlock(block)).toBe(gewaehlt.length);
    expect(etikett).toContain(`${zeilenImBlock(block)} von 558`);
  });

  it('gilt auch, wenn das Zeichen-Budget die Auswahl verkürzt', () => {
    const viele = Array.from({ length: 100 }, (_, i) => treffer({
      id: `t${i}`, title: `Treffer ${i}`, kurzbeschreibung: 'x'.repeat(250),
    }));
    const gewaehlt = waehleKontextTreffer(viele, KONTEXT_MAX_TREFFER, 2_000);
    const block = baueKontextBlock(gewaehlt, viele.length);
    expect(gewaehlt.length).toBeLessThan(KONTEXT_MAX_TREFFER);
    expect(zeilenImBlock(block)).toBe(gewaehlt.length);
    expect(kontextChipLabel(gewaehlt.length, viele.length))
      .toBe(`Kontext: ${gewaehlt.length} von 100 Treffern`);
  });
});

/**
 * Die zwei Herkuenfte (v4.104): Wortlaut-Treffer tragen ein gesuchtes Wort,
 * Aehnlichkeits-Treffer sind Vorschlaege des Embeddings. Der Antwort-Lauf
 * schickt sie GETRENNT ans Modell — hier steht, dass die Trennung haelt.
 */
describe('teileNachFundstelle', () => {
  const wort = treffer({ id: 'w', title: 'Wortlaut', trefferfelder: ['titel'] });
  const gemischt = treffer({ id: 'g', title: 'Beides', trefferfelder: ['titel', 'aehnlichkeit'] });
  const nurAehnlich = treffer({ id: 'a', title: 'Nur aehnlich', trefferfelder: ['aehnlichkeit'] });
  const ohneFeld = treffer({ id: 'o', title: 'Ohne Angabe' });

  it('trennt nach der EINZIGEN Fundstelle, nicht nach ihrem Vorkommen', () => {
    const { wortlaut, aehnlich } = teileNachFundstelle([wort, gemischt, nurAehnlich, ohneFeld]);
    expect(wortlaut.map(r => r.id)).toEqual(['w', 'g', 'o']);
    expect(aehnlich.map(r => r.id)).toEqual(['a']);
  });

  it('haelt die Reihenfolge beider Mengen', () => {
    const viele = [nurAehnlich, wort, nurAehnlich, wort].map((r, i) => ({ ...r, id: `${r.id}${i}` }));
    const { wortlaut, aehnlich } = teileNachFundstelle(viele);
    expect(wortlaut.map(r => r.id)).toEqual(['w1', 'w3']);
    expect(aehnlich.map(r => r.id)).toEqual(['a0', 'a2']);
  });
});

describe('baueAehnlichkeitsBlock', () => {
  const kandidat = (i: number): UnifiedSearchResult => treffer({
    id: `k${i}`, title: `Verwandt ${i}`, fkz: `16KN0${i}`, trefferfelder: ['aehnlichkeit'],
  });

  it('bleibt leer, wenn die Stufe nichts beisteuerte', () => {
    expect(baueAehnlichkeitsBlock([], 0)).toBe('');
  });

  it('nennt Auszug UND Gesamtzahl — sonst liest das Modell die Auswahl als alles', () => {
    const alle = Array.from({ length: 50 }, (_, i) => kandidat(i));
    const block = baueAehnlichkeitsBlock(alle.slice(0, 12), alle.length);
    expect(block).toContain('Die 12 nächstliegenden von 50');
    expect(zeilenImBlock(block)).toBe(12);
  });

  it('sagt „alle", wenn es alle sind', () => {
    expect(baueAehnlichkeitsBlock([kandidat(1)], 1)).toContain('Alle 1 thematisch verwandten');
  });

  it('nennt das Kennzeichen mit — ohne ist ein Vorschlag nicht nachprüfbar', () => {
    expect(baueAehnlichkeitsBlock([kandidat(7)], 1)).toContain('(16KN07)');
  });
});

/**
 * Der gemeldete Lauf (v4.105.1): 499 Treffer, davon 4 mit BEIDEN gefragten
 * Sachen. Der Befund nannte die Vier, keine Belegzeile wies sie aus — und die
 * Antwort schrieb, sie seien „in den dargestellten 40 Belegen nicht enthalten".
 * Sie waren enthalten. Wer eine Gruppe zählt, muss sie kenntlich machen.
 */
describe('Abdeckungs-Marke — die gezählte Gruppe ist in den Belegen wiederzufinden', () => {
  const mitBeiden = (i: number): UnifiedSearchResult => treffer({
    id: `voll${i}`, title: `Normung und Standards ${i}`, fkz: `16KN0${i}`, abdeckung: 1,
  });
  const mitEinem = (i: number): UnifiedSearchResult => treffer({
    id: `halb${i}`, title: `Nur Normung ${i}`, fkz: `16DS0${i}`, abdeckung: 0.5,
  });

  it('beschriftet nur die Treffer, die JEDE gefragte Sache tragen', () => {
    const block = baueKontextBlock([mitBeiden(1), mitEinem(2)], 2, 2);
    const zeilen = block.split('\n').filter(l => /^\d+\. /.test(l) || l.includes('trägt ALLE'));
    expect(block).toContain('trägt ALLE gefragten Themen');
    expect(zeilen.filter(l => l.includes('trägt ALLE gefragten Themen'))).toHaveLength(1);
  });

  it('schweigt bei nur einer gefragten Sache — dort trägt jeder Treffer „alle"', () => {
    expect(baueKontextBlock([mitBeiden(1)], 1, 1)).not.toContain('trägt ALLE');
    expect(baueKontextBlock([mitBeiden(1)], 1)).not.toContain('trägt ALLE');
  });

  it('zieht die Gruppe in den Auszug, auch wenn sie nach Relevanz hinten steht', () => {
    // 60 Treffer mit einer Sache, danach 4 mit beiden: ohne Vorzug fiele die
    // Gruppe komplett aus den 40 Belegen — genau der gemeldete Fall.
    const viele = [
      ...Array.from({ length: 60 }, (_, i) => mitEinem(i)),
      ...Array.from({ length: 4 }, (_, i) => mitBeiden(i)),
    ];
    const ohne = waehleKontextTreffer(viele, 40);
    expect(ohne.filter(r => r.abdeckung === 1)).toHaveLength(0);

    const gewaehlt = waehleKontextTreffer(viele, 40, undefined, 2);
    expect(gewaehlt).toHaveLength(40);
    expect(gewaehlt.slice(0, 4).map(r => r.id)).toEqual(['voll0', 'voll1', 'voll2', 'voll3']);
    // Die Reihenfolge innerhalb der Gruppen bleibt, wie die Suche sie sortiert hat.
    expect(gewaehlt[4]?.id).toBe('halb0');
  });

  it('sagt im Kopf, dass die Gruppe vorn steht — und schweigt, wenn keine da ist', () => {
    expect(baueKontextBlock([mitBeiden(1), mitEinem(2)], 99, 2))
      .toContain('stehen vorn und sind so gekennzeichnet');
    expect(baueKontextBlock([mitEinem(2)], 99, 2)).not.toContain('stehen vorn');
  });

  it('misst die Auswahl an der Zeile MIT Marke — Etikett und Block bleiben gleich', () => {
    const viele = Array.from({ length: 50 }, (_, i) => mitBeiden(i));
    const gewaehlt = waehleKontextTreffer(viele, KONTEXT_MAX_TREFFER, 1_200, 2);
    const block = baueKontextBlock(gewaehlt, viele.length, 2);
    expect(zeilenImBlock(block)).toBe(gewaehlt.length);
    expect(gewaehlt.length).toBeLessThan(KONTEXT_MAX_TREFFER);
  });
});
