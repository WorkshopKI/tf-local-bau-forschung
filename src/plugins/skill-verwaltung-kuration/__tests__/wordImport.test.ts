/**
 * Word-Import-Heuristik: HTML-Blockzerlegung + Kandidaten-Ableitung.
 *
 * Getestet gegen mammoth-typisches HTML (Überschriften + Absätze + Listen), nicht
 * gegen eine echte .docx — mammoth selbst ist eine geprüfte Fremd-Lib; was hier
 * kaputtgehen kann, ist unsere Zerlegung.
 */
import { describe, it, expect } from 'vitest';
import { extractPlatzhalter } from '@/core/services/skills';
import { bausteinKandidatAus, bausteinKandidaten, htmlZuBloecke } from '../wordImport';
import { uebernehmeKandidat } from '../textbausteinKatalogOps';
import { leererKatalog } from '@/core/services/skills';

const HTML = [
  '<h1>G1.1 Zur geplanten Entwicklung</h1>',
  '<p>Bitte erl&#228;utern Sie {das / die} Verfahren &amp; nennen Sie x &#8364;.</p>',
  '<p>Zweiter Absatz.</p>',
  '<h2>T2.3.7 Kostenplan</h2>',
  '<ul><li>Erster Punkt.</li><li>Zweiter Punkt.</li></ul>',
].join('');

describe('htmlZuBloecke', () => {
  it('gruppiert Absätze/Listen unter ihre Überschrift', () => {
    const bloecke = htmlZuBloecke(HTML);
    expect(bloecke).toHaveLength(2);
    expect(bloecke[0]!.ueberschrift).toBe('G1.1 Zur geplanten Entwicklung');
    expect(bloecke[0]!.absaetze).toHaveLength(2);
    expect(bloecke[1]!.ueberschrift).toBe('T2.3.7 Kostenplan');
    expect(bloecke[1]!.absaetze).toEqual(['Erster Punkt.', 'Zweiter Punkt.']);
  });

  it('dekodiert Entities und verwirft Inline-Formatierung, erhält aber den Wortlaut', () => {
    const html = '<p>Text mit <strong>fett</strong> und &quot;Zitat&quot; &#8364;.</p>';
    expect(htmlZuBloecke(html)[0]!.absaetze[0]).toBe('Text mit fett und "Zitat" €.');
  });

  it('sammelt Absätze vor der ersten Überschrift als führerlosen Block', () => {
    const bloecke = htmlZuBloecke('<p>Vorspann.</p><h1>Titel</h1><p>Danach.</p>');
    expect(bloecke[0]!.ueberschrift).toBeNull();
    expect(bloecke[0]!.absaetze).toEqual(['Vorspann.']);
  });
});

describe('bausteinKandidatAus', () => {
  it('spaltet ein führendes ID-Token ab und leitet den Scope aus der NF-ID ab', () => {
    const k = bausteinKandidatAus(htmlZuBloecke(HTML)[0]!, 'nf');
    expect(k.id).toBe('G1.1');
    expect(k.thema).toBe('Zur geplanten Entwicklung');
    expect(k.scope).toBe('verbund');
    expect(k.artefaktTyp).toBe('nf');
  });

  it('leitet die Platzhalter exakt wie extractPlatzhalter ab', () => {
    const k = bausteinKandidatAus(htmlZuBloecke(HTML)[0]!, 'nf');
    expect(extractPlatzhalter(k.text).length).toBeGreaterThan(0);
    expect(k.text).toContain('{das / die}'); // verbatim, nicht geglättet
  });

  it('erkennt T-IDs als tv-Scope', () => {
    expect(bausteinKandidatAus(htmlZuBloecke(HTML)[1]!, 'nf').scope).toBe('tv');
  });

  it('lässt ID leer und warnt, wenn keine Überschrift da ist', () => {
    const k = bausteinKandidatAus({ ueberschrift: null, absaetze: ['Nur Text.'] }, 'rne');
    expect(k.id).toBe('');
    expect(k.thema).toBe('');
    expect(k.warnungen.some(w => w.includes('Überschrift'))).toBe(true);
  });

  it('meldet verdächtige Sonderzeichen, ohne den Text zu ändern', () => {
    const roh = { ueberschrift: 'Titel', absaetze: ['Kaputt�es Zeichen.'] };
    const k = bausteinKandidatAus(roh, 'abl');
    expect(k.warnungen.some(w => w.includes('Sonderzeichen'))).toBe(true);
    expect(k.text).toBe('Kaputt�es Zeichen.'); // unverändert
  });

  it('leitet für RNE/ABL keinen Scope aus der ID ab (nur NF hat G/T-Semantik)', () => {
    const html = '<h1>RNE-A2 Rücknahme</h1><p>Text.</p>';
    expect(bausteinKandidatAus(htmlZuBloecke(html)[0]!, 'rne').scope).toBeUndefined();
  });
});

describe('Import-Übernahme', () => {
  it('erzeugt aus Kandidaten immer Entwürfe', () => {
    let katalog = leererKatalog();
    for (const k of bausteinKandidaten(HTML, 'nf')) {
      katalog = uebernehmeKandidat(katalog, { ...k, kategorie: '' }, { zeitpunkt: '2026-08-01T00:00:00.000Z' });
    }
    expect(katalog.bausteine).toHaveLength(2);
    expect(katalog.bausteine.every(b => b.status === 'entwurf')).toBe(true);
    expect(katalog.bausteine.every(b => b.version === 1)).toBe(true);
  });

  it('übernimmt eine ID-Kollision als neue Version, nicht als zweiten Datensatz', () => {
    const K = { zeitpunkt: '2026-08-01T00:00:00.000Z' };
    let katalog = leererKatalog();
    const k = bausteinKandidaten(HTML, 'nf')[0]!;
    katalog = uebernehmeKandidat(katalog, { ...k, kategorie: 'X' }, K);
    katalog = uebernehmeKandidat(katalog, { ...k, kategorie: 'X', text: 'Korrigierter Text.' }, K);
    const g11 = katalog.bausteine.filter(b => b.id === 'G1.1');
    expect(g11).toHaveLength(1);
    expect(g11[0]!.version).toBe(2);
    expect(g11[0]!.text).toBe('Korrigierter Text.');
  });

  it('lässt einen freigegebenen Baustein bei erneutem Import freigegeben', () => {
    const K = { zeitpunkt: '2026-08-01T00:00:00.000Z' };
    const bestehend = {
      version: 1 as const, updated_at: 'x',
      bausteine: [{
        id: 'G1.1', artefaktTyp: 'nf' as const, scope: 'verbund' as const, thema: 'Alt', kategorie: 'X',
        aspekte: [], stichworte: [], text: 'Alt.', platzhalter: extractPlatzhalter('Alt.'),
        status: 'freigegeben' as const, version: 1, historie: [], geaendertAm: 'x',
      }],
    };
    const k = bausteinKandidaten(HTML, 'nf')[0]!;
    const nach = uebernehmeKandidat(bestehend, { ...k, kategorie: 'X', text: 'Neu.' }, K);
    expect(nach.bausteine[0]!.status).toBe('freigegeben');
    expect(nach.bausteine[0]!.text).toBe('Neu.');
  });
});
