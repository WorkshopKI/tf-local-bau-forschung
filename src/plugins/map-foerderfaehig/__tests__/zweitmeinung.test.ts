/**
 * KI-Zweitmeinung: Prompt-Aufbau, Parser und die Gate-Regel „Urteil zuerst".
 *
 * LLM-frei. Der wichtigste Test dieser Datei ist der Gate-Test: er friert die
 * Zusage ein, dass die KI-Stufe vor der eigenen Bewertung nicht einmal bis in die
 * Komponente gelangt. Das Modellverhalten selbst misst das dev-Smoke-Panel.
 */
import { describe, expect, it } from 'vitest';
import { baueVergleich, baueVergleiche } from '../ansicht/zweitmeinung-vergleich';
import type { MapItemZustand } from '../checkliste/bewertung';
import { CHECKLISTE_SEED } from '../checkliste/seed';
import type { MapChecklistenItem, MapStufe } from '../checkliste/typen';
import { istInhaltsleer } from '../infografik/schema';
import type { InfografikDaten } from '../infografik/schema';
import {
  ankerHashFuer, baueZweitmeinungPromptTeil, parseZweitmeinung, stufenAbstand,
  type ZweitmeinungEintrag,
} from '../infografik/zweitmeinung';

const SKALA_ITEMS: MapChecklistenItem[] = CHECKLISTE_SEED.items
  .filter(i => i.art === 'skala' && i.aktiv);

const BEKANNTE_SEKTIONEN = new Set(['k-1', 'k-2']);

const eintrag = (over: Partial<ZweitmeinungEintrag> = {}): Record<string, unknown> => ({
  itemId: 'inno.zielstellung',
  stufe: 'B2',
  begruendung: 'Die VB nennt messbare Zielparameter. Der Vergleich zum SdT bleibt aber qualitativ.',
  sektionIds: ['k-1'],
  ...over,
});

describe('baueZweitmeinungPromptTeil', () => {
  const prompt = baueZweitmeinungPromptTeil(SKALA_ITEMS).join('\n');

  it('nennt alle drei Kategorien der Entscheidungshilfe mit ihrer ID', () => {
    expect(SKALA_ITEMS).toHaveLength(3); // sonst prueft der Test nichts
    for (const item of SKALA_ITEMS) {
      expect(prompt).toContain(item.id);
      expect(prompt).toContain(item.kriterium);
    }
  });

  it('traegt die Ankertexte woertlich aus der Definition', () => {
    // Der eigentliche Vertrag: die Bewertungsgrundlage kommt aus der Entitaet,
    // nicht aus einer Konstante im Prompt-Modul. Geprueft an jedem Merkmal jeder
    // Stufe — ein hartkodierter Zweitstand fiele hier sofort auf.
    for (const item of SKALA_ITEMS) {
      for (const anker of item.anker ?? []) {
        expect(prompt).toContain(anker.kurz);
        for (const merkmal of anker.merkmale) expect(prompt).toContain(merkmal);
      }
    }
  });

  it('erwaehnt die B0-Nullregel', () => {
    expect(prompt).toContain('B0-Einstufung setzt den Innovationsgrad insgesamt auf 0');
  });

  it('verlangt eine Begruendung von 2 bis 3 Saetzen', () => {
    expect(prompt).toContain('2 bis 3 Sätze');
  });

  it('folgt geaenderten Ankertexten statt dem Seed-Stand', () => {
    const geaendert: MapChecklistenItem[] = [{
      ...SKALA_ITEMS[0]!,
      anker: (SKALA_ITEMS[0]!.anker ?? []).map(a =>
        a.stufe === 'B3' ? { ...a, merkmale: ['Voellig neu justierter Ankertext'] } : a),
    }];
    const neu = baueZweitmeinungPromptTeil(geaendert).join('\n');
    expect(neu).toContain('Voellig neu justierter Ankertext');
    // Der ersetzte Seed-Text darf nicht danebenstehen.
    expect(neu).not.toContain('Parameter / Funktionen bestehender Erzeugnisse am Markt werden vollumfänglich übertroffen');
  });

  it('liefert ohne Skala-Items gar keinen Block', () => {
    expect(baueZweitmeinungPromptTeil([])).toEqual([]);
  });
});

describe('parseZweitmeinung', () => {
  const parse = (roh: unknown): ZweitmeinungEintrag[] =>
    parseZweitmeinung({ innoZweitmeinung: roh }, BEKANNTE_SEKTIONEN, SKALA_ITEMS)
      .innoZweitmeinung;

  it('liest einen gueltigen Eintrag', () => {
    const [e] = parse([eintrag()]);
    expect(e?.itemId).toBe('inno.zielstellung');
    expect(e?.stufe).toBe('B2');
    expect(e?.sektionIds).toEqual(['k-1']);
  });

  it('verwirft eine erfundene Item-ID', () => {
    expect(parse([eintrag({ itemId: 'inno.ausgedacht' })])).toEqual([]);
  });

  it('verwirft ein Item, das nicht in der uebergebenen Menge steht', () => {
    // Der Aufrufer reicht nur aktive Skala-Items herein — ein stillgelegtes
    // Kriterium darf das Modell nicht wiederbeleben.
    const ohneZielstellung = SKALA_ITEMS.filter(i => i.id !== 'inno.zielstellung');
    const daten = parseZweitmeinung(
      { innoZweitmeinung: [eintrag()] }, BEKANNTE_SEKTIONEN, ohneZielstellung,
    );
    expect(daten.innoZweitmeinung).toEqual([]);
  });

  it('verwirft eine unbekannte Stufe', () => {
    expect(parse([eintrag({ stufe: 'B4' as MapStufe })])).toEqual([]);
  });

  it('verwirft eine Einstufung ohne Begruendung', () => {
    expect(parse([eintrag({ begruendung: '   ' })])).toEqual([]);
  });

  it('filtert erfundene Sektions-IDs und behaelt die gueltigen', () => {
    const [e] = parse([eintrag({ sektionIds: ['k-1', 'k-99'] })]);
    expect(e?.sektionIds).toEqual(['k-1']);
  });

  it('behaelt einen Eintrag ohne Fundstelle', () => {
    // Bewusst: verwuerfe man ihn, misse die Smoke-Pruefung „mindestens eine
    // Fundstelle je Item" den Parser statt das Modell.
    const [e] = parse([eintrag({ sektionIds: [] })]);
    expect(e?.sektionIds).toEqual([]);
    expect(e?.stufe).toBe('B2');
  });

  it('nimmt bei doppelter Kategorie den ersten Eintrag', () => {
    const treffer = parse([eintrag({ stufe: 'B2' }), eintrag({ stufe: 'B0' })]);
    expect(treffer).toHaveLength(1);
    expect(treffer[0]?.stufe).toBe('B2');
  });

  it('liefert eine leere Liste, wenn das Feld ganz fehlt', () => {
    const daten = parseZweitmeinung({}, BEKANNTE_SEKTIONEN, SKALA_ITEMS);
    expect(daten.innoZweitmeinung).toEqual([]);
    expect(daten.zweitmeinungAnkerHash).toBe(ankerHashFuer(SKALA_ITEMS));
  });
});

describe('ankerHashFuer', () => {
  it('ist stabil bei gleicher Grundlage', () => {
    expect(ankerHashFuer(SKALA_ITEMS)).toBe(ankerHashFuer([...SKALA_ITEMS]));
  });

  it('aendert sich, wenn ein Ankertext geaendert wird', () => {
    const geaendert = SKALA_ITEMS.map((item, i) => (i > 0 ? item : {
      ...item,
      anker: (item.anker ?? []).map(a =>
        a.stufe === 'B1' ? { ...a, merkmale: [...a.merkmale, 'zusaetzliches Merkmal'] } : a),
    }));
    expect(ankerHashFuer(geaendert)).not.toBe(ankerHashFuer(SKALA_ITEMS));
  });

  it('bleibt gleich, wenn sich ein binaeres Item aendert', () => {
    // Der Stempel deckt nur die Bewertungsgrundlage der Zweitmeinung ab. Eine
    // Aenderung an einem Ja/Nein-Kriterium darf ihn nicht bewegen.
    expect(ankerHashFuer(SKALA_ITEMS.map(i => ({ ...i, hinweis: 'neuer Hinweistext' }))))
      .toBe(ankerHashFuer(SKALA_ITEMS));
  });
});

describe('stufenAbstand', () => {
  it('misst in Stufenschritten', () => {
    expect(stufenAbstand('B2', 'B2')).toBe(0);
    expect(stufenAbstand('B2', 'B1')).toBe(1);
    expect(stufenAbstand('B3', 'B0')).toBe(3);
    expect(stufenAbstand('B0', 'B3')).toBe(3);
  });
});

describe('baueVergleich — Gate „Urteil zuerst"', () => {
  const ki: ZweitmeinungEintrag = {
    itemId: 'inno.zielstellung',
    stufe: 'B1',
    begruendung: 'Nur qualitative Verbesserungen benannt.',
    sektionIds: ['k-1'],
  };

  it('redigiert die Zweitmeinung, solange der Mensch nicht bewertet hat', () => {
    // Kern der ganzen Aenderung: nicht nur „lage: verborgen", sondern die Daten
    // selbst sind weg. Eine Komponente, die versehentlich `kiStufe` rendert, kann
    // die Regel damit nicht brechen.
    const v = baueVergleich('inno.zielstellung', null, ki);
    expect(v.lage).toBe('verborgen');
    expect(v.kiStufe).toBeNull();
    expect(v.begruendung).toBe('');
    expect(v.sektionIds).toEqual([]);
    expect(v.abstand).toBeNull();
  });

  it('bleibt verborgen, wenn die KI zu diesem Item nichts geliefert hat', () => {
    const v = baueVergleich('inno.risiken', 'B2', undefined);
    expect(v.lage).toBe('verborgen');
    expect(v.kiStufe).toBeNull();
  });

  it('zeigt die Zweitmeinung nach der eigenen Bewertung', () => {
    const v = baueVergleich('inno.zielstellung', 'B1', ki);
    expect(v.lage).toBe('treffer');
    expect(v.kiStufe).toBe('B1');
    expect(v.menschStufe).toBe('B1');
    expect(v.begruendung).toBe('Nur qualitative Verbesserungen benannt.');
  });

  it('unterscheidet Treffer, Nachbarstufe und deutliche Abweichung', () => {
    expect(baueVergleich('x', 'B2', { ...ki, stufe: 'B2' }).lage).toBe('treffer');
    const nachbar = baueVergleich('x', 'B2', { ...ki, stufe: 'B1' });
    expect(nachbar.lage).toBe('nachbar');
    expect(nachbar.abstand).toBe(1);
    const weit = baueVergleich('x', 'B3', { ...ki, stufe: 'B0' });
    expect(weit.lage).toBe('abweichung');
    expect(weit.abstand).toBe(3);
  });
});

describe('baueVergleiche', () => {
  const zustand = (id: string, stufe: MapStufe | null): MapItemZustand => ({
    item: SKALA_ITEMS.find(i => i.id === id) ?? SKALA_ITEMS[0]!,
    anwendbar: true,
    bewertung: stufe === null ? null : {
      itemId: id, status: 'erfuellt', stufe, autor: null, geaendertAm: '2026-07-21T00:00:00.000Z',
    },
    status: stufe === null ? 'offen' : 'erfuellt',
    befunde: [],
    bemerkungFehlt: false,
  });

  it('gated jedes Item einzeln', () => {
    const eintraege: ZweitmeinungEintrag[] = SKALA_ITEMS.map(i => ({
      itemId: i.id, stufe: 'B2', begruendung: 'Begruendung.', sektionIds: ['k-1'],
    }));
    const vergleiche = baueVergleiche(
      [zustand('inno.zielstellung', 'B2'), zustand('inno.loesungsansatz', null)],
      eintraege,
    );
    expect(vergleiche.get('inno.zielstellung')?.lage).toBe('treffer');
    expect(vergleiche.get('inno.loesungsansatz')?.lage).toBe('verborgen');
    expect(vergleiche.get('inno.loesungsansatz')?.kiStufe).toBeNull();
  });

  it('ignoriert binaere Items', () => {
    const binaer = CHECKLISTE_SEED.items.find(i => i.art === 'binaer');
    expect(binaer).toBeDefined();
    const vergleiche = baueVergleiche(
      [{ ...zustand('inno.zielstellung', 'B2'), item: binaer! }], [],
    );
    expect(vergleiche.size).toBe(0);
  });
});

describe('istInhaltsleer bleibt von der Zweitmeinung unberuehrt', () => {
  it('wertet eine volle Antwort ohne Zweitmeinung NICHT als leer', () => {
    // Friert die Entscheidung ein: ein fehlendes Experiment darf nie den Cache
    // der gesamten Analyse kosten.
    const feld = { text: 'Text.', sektionIds: ['k-1'], belegtheit: 'belegt' as const };
    const daten: InfografikDaten = {
      canvas: {
        problemSdt: feld, innovation: feld, technischesRisiko: feld, marktVerwertung: feld,
      },
      sdtDelta: [{
        parameter: 'Durchsatz', sdtWert: '10/s', zielWert: '20/s',
        quantifizierung: 'quantifiziert', sektionIds: ['k-2'],
      }],
      wirkungskette: {
        problem: feld, ergebnis: feld, verwertung: feld, wirkung: feld,
      },
      widersprueche: [],
      unschaerfeBegriffe: [],
      innoZweitmeinung: [],
      zweitmeinungAnkerHash: 'egal',
    };
    expect(istInhaltsleer(daten)).toBe(false);
  });
});
