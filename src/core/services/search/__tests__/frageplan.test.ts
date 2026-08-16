import { describe, it, expect } from 'vitest';
import {
  MAX_LEITBEGRIFFE,
  MAX_NADELN,
  MIN_NADEL_LEN,
  aktiveLeitbegriffe,
  baueFrageplanPrompt,
  hatPflichtteile,
  parseFrageplan,
  planMarkierWoerter,
  type Frageplan,
} from '../frageplan';

/** Kürzeste Antwort, die durchkommt — Bausteine drumherum je Test. */
function antwort(obj: unknown): string {
  return JSON.stringify(obj);
}

const NORMUNG = {
  begriffe: [
    { begriff: 'Normung', nadeln: ['normung', 'normen', 'normier'], pflicht: false },
    { begriff: 'Standards', nadeln: ['standard', 'standardisierung'], pflicht: false },
  ],
};

describe('baueFrageplanPrompt', () => {
  it('nennt die erlaubten Felder aus FELD_PRAEFIX, nicht abgeschrieben', () => {
    const p = baueFrageplanPrompt('irgendwas', 2026).systemPrompt;
    // Stichproben aus der Einzelquelle; „inhalt" ist das Präfix von
    // `kurzbeschreibung` — stünde hier der Feldname, liefe die Liste weg.
    expect(p).toContain('titel');
    expect(p).toContain('inhalt');
    expect(p).toContain('deskriptor');
    expect(p).not.toContain('kurzbeschreibung ·');
  });

  it('nennt die Arbeitslisten-Werte mit ihrer Bezeichnung', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    expect(p).toContain('nachforderung (Wartet auf Antragsteller)');
    expect(p).toContain('in_pruefung (In Arbeit)');
  });

  it('bietet „dokumente" NICHT als Bereich an — es legte die Wortlaut-Stufe still', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    expect(p).toContain('inhalt (nur Titel & Kurzbeschreibung)');
    expect(p).not.toContain('dokumente (nur Dokumente)');
  });

  it('reicht das laufende Jahr herein, statt eine Uhr zu lesen', () => {
    expect(baueFrageplanPrompt('x', 2031).systemPrompt).toContain('2031');
  });

  it('enthält kein Beispiel-JSON, das als Antwort durchgehen könnte', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    expect(p).not.toContain('{');
    expect(p).not.toContain('[');
  });

  it('kürzt eine übergroße Frage', () => {
    const lang = 'a'.repeat(5000);
    expect(baueFrageplanPrompt(lang, 2026).userPrompt).not.toContain('a'.repeat(1000));
  });

  it('hält die Frage aus dem System-Teil heraus', () => {
    const { systemPrompt, userPrompt } = baueFrageplanPrompt('Was läuft in Bayern?', 2026);
    expect(systemPrompt).not.toContain('Bayern');
    expect(userPrompt).toContain('Was läuft in Bayern?');
  });
});

describe('parseFrageplan — Grundfall', () => {
  it('liest Leitbegriffe mit ihren Nadeln', () => {
    const plan = parseFrageplan(antwort(NORMUNG), 'Normung und Standards?');
    expect(plan).not.toBeNull();
    expect(plan!.leitbegriffe.map(b => b.begriff)).toEqual(['Normung', 'Standards']);
    expect(plan!.frage).toBe('Normung und Standards?');
  });

  it('nimmt den Begriff selbst immer als Nadel auf', () => {
    const plan = parseFrageplan(antwort({
      begriffe: [{ begriff: 'Leichtbau', nadeln: ['faserverbund'] }],
    }), 'f');
    expect(plan!.leitbegriffe[0]?.nadeln).toContain('leichtbau');
  });

  it('schreibt Nadeln klein und entdoppelt sie', () => {
    const plan = parseFrageplan(antwort({
      begriffe: [{ begriff: 'Normung', nadeln: ['NORMUNG', 'Normung', 'normen'] }],
    }), 'f');
    expect(plan!.leitbegriffe[0]?.nadeln).toEqual(['normung', 'normen']);
  });

  it('überlebt Markdown-Fences und Prosa drumherum', () => {
    const roh = `Gern! Hier der Plan:\n\`\`\`json\n${antwort(NORMUNG)}\n\`\`\`\nViel Erfolg.`;
    expect(parseFrageplan(roh, 'f')?.leitbegriffe).toHaveLength(2);
  });

  it('nimmt das LETZTE Objekt — die Schablone davor gewinnt nicht', () => {
    const roh = `${antwort({ begriffe: [{ begriff: 'Schablone', nadeln: ['schablone'] }] })}\n\n${antwort(NORMUNG)}`;
    const plan = parseFrageplan(roh, 'f');
    expect(plan!.leitbegriffe.map(b => b.begriff)).toEqual(['Normung', 'Standards']);
  });
});

describe('parseFrageplan — was nicht durchkommt', () => {
  it('gibt null bei Prosa ohne JSON', () => {
    expect(parseFrageplan('Ich habe leider keine Idee.', 'f')).toBeNull();
  });

  it('gibt null bei leerer Antwort', () => {
    expect(parseFrageplan('', 'f')).toBeNull();
  });

  it('gibt null, wenn kein einziger Begriff übrig bleibt', () => {
    expect(parseFrageplan(antwort({ begriffe: [] }), 'f')).toBeNull();
  });

  it('gibt null, wenn NUR Einschränkungen da sind — eine ODER-Menge über nichts', () => {
    const roh = antwort({
      begriffe: [{ begriff: 'Bayern', nadeln: ['bayern'], pflicht: true, feld: 'ort' }],
    });
    expect(parseFrageplan(roh, 'f')).toBeNull();
  });

  it(`verwirft Nadeln unter ${MIN_NADEL_LEN} Zeichen und meldet sie`, () => {
    const plan = parseFrageplan(antwort({
      begriffe: [{ begriff: 'Normung', nadeln: ['din', 'iso', 'normen'] }],
    }), 'f');
    expect(plan!.leitbegriffe[0]?.nadeln).toEqual(['normung', 'normen']);
    expect(plan!.ignoriert).toContain('din');
    expect(plan!.ignoriert).toContain('iso');
  });

  it('verwirft einen Begriff, dessen Nadeln alle zu kurz sind', () => {
    const plan = parseFrageplan(antwort({
      begriffe: [
        { begriff: 'KI', nadeln: ['ki'] },
        { begriff: 'Medizintechnik', nadeln: ['medizintechnik'] },
      ],
    }), 'f');
    expect(plan!.leitbegriffe.map(b => b.begriff)).toEqual(['Medizintechnik']);
  });

  it(`deckelt auf ${MAX_LEITBEGRIFFE} Begriffe — sonst teilt die Abdeckung durch zu viel`, () => {
    const viele = Array.from({ length: 20 }, (_, i) => ({
      begriff: `Thema${i}`, nadeln: [`thema${i}`],
    }));
    const plan = parseFrageplan(antwort({ begriffe: viele }), 'f');
    expect(plan!.leitbegriffe).toHaveLength(MAX_LEITBEGRIFFE);
    expect(plan!.ignoriert.some(i => i.includes(String(MAX_LEITBEGRIFFE)))).toBe(true);
  });

  it(`deckelt die Nadeln je Begriff auf ${MAX_NADELN}`, () => {
    const nadeln = Array.from({ length: 40 }, (_, i) => `nadelnummer${i}`);
    const plan = parseFrageplan(antwort({ begriffe: [{ begriff: 'X-Thema', nadeln }] }), 'f');
    expect(plan!.leitbegriffe[0]?.nadeln).toHaveLength(MAX_NADELN);
  });
});

describe('parseFrageplan — Felder, Status, Jahr, Bereich', () => {
  it('löst ein Feld über dieselben Aliasse auf wie ein getipptes Präfix', () => {
    const plan = parseFrageplan(antwort({
      begriffe: [
        { begriff: 'Laser', nadeln: ['laser'] },
        { begriff: 'Bayern', nadeln: ['bayern'], pflicht: true, feld: 'org_ast' },
      ],
    }), 'f');
    expect(plan!.leitbegriffe[1]?.feld).toBe('organisation');
  });

  it('verwirft ein unbekanntes Feld, behält aber den Begriff', () => {
    const plan = parseFrageplan(antwort({
      begriffe: [{ begriff: 'Laser', nadeln: ['laser'], feld: 'foobar' }],
    }), 'f');
    expect(plan!.leitbegriffe).toHaveLength(1);
    expect(plan!.leitbegriffe[0]?.feld).toBeUndefined();
    expect(plan!.ignoriert.some(i => i.includes('foobar'))).toBe(true);
  });

  it('nimmt nur echte Arbeitslisten-Werte', () => {
    const plan = parseFrageplan(antwort({
      ...NORMUNG, status: ['offen', 'bewilligt', 'Bewilligt', 'erfunden'],
    }), 'f');
    expect(plan!.facetten.status).toEqual(['offen', 'bewilligt']);
    expect(plan!.ignoriert.some(i => i.includes('erfunden'))).toBe(true);
  });

  it('nimmt vierstellige Jahre, auch als Zahl', () => {
    const plan = parseFrageplan(antwort({
      ...NORMUNG, jahr: [2023, '2024', '24', 'letztes Jahr'],
    }), 'f');
    expect(plan!.facetten.jahr).toEqual(['2023', '2024']);
  });

  it('verwirft „dokumente" als Bereich', () => {
    const plan = parseFrageplan(antwort({ ...NORMUNG, bereich: 'dokumente' }), 'f');
    expect(plan!.bereich).toBeUndefined();
    expect(plan!.ignoriert.some(i => i.includes('dokumente'))).toBe(true);
  });

  it('nimmt einen planbaren Bereich', () => {
    expect(parseFrageplan(antwort({ ...NORMUNG, bereich: 'inhalt' }), 'f')!.bereich).toBe('inhalt');
  });

  it('führt die Meldungen des Modells vor den technisch verworfenen Werten', () => {
    const plan = parseFrageplan(antwort({
      ...NORMUNG, ignoriert: ['Zeitraum „zuletzt" ist unklar'], status: ['quatsch'],
    }), 'f');
    expect(plan!.ignoriert[0]).toBe('Zeitraum „zuletzt" ist unklar');
  });
});

describe('aktiveLeitbegriffe / planMarkierWoerter', () => {
  const plan: Frageplan = {
    frage: 'f',
    leitbegriffe: [
      { begriff: 'Normung', nadeln: ['normung', 'normen'], pflicht: false },
      { begriff: 'Standards', nadeln: ['standard'], pflicht: false },
      { begriff: 'Bayern', nadeln: ['bayern'], pflicht: true, feld: 'standort' },
    ],
    facetten: { status: [], jahr: [] },
    ignoriert: [],
  };

  it('nimmt einen abgewählten Begriff heraus', () => {
    expect(aktiveLeitbegriffe(plan, ['normung']).map(b => b.begriff))
      .toEqual(['Standards', 'Bayern']);
  });

  it('vergleicht ohne Rücksicht auf Groß-/Kleinschreibung', () => {
    expect(aktiveLeitbegriffe(plan, ['NORMUNG'])).toHaveLength(2);
  });

  it('gibt den vollen Plan zurück, wenn alle Themen abgewählt sind', () => {
    // Sonst bliebe nur die Einschränkung übrig — ein Zustand ohne Rückweg.
    expect(aktiveLeitbegriffe(plan, ['normung', 'standards'])).toHaveLength(3);
  });

  it('markiert die Nadeln, nicht die Frageworte', () => {
    expect(planMarkierWoerter(plan, [])).toEqual(['normung', 'normen', 'standard', 'bayern']);
  });

  it('erkennt Einschränkungen', () => {
    expect(hatPflichtteile(plan)).toBe(true);
    expect(hatPflichtteile({ ...plan, leitbegriffe: plan.leitbegriffe.slice(0, 1) })).toBe(false);
  });
});
