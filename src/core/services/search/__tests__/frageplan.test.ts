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
import { TREFFERFELD_LABEL } from '../trefferstelle';

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
    expect(p).toContain('nachforderung (Nachforderung läuft)');
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

  it('sagt an, dass Frage- und Gewichtungswörter nicht nach „ignoriert" gehören', () => {
    const p = baueFrageplanPrompt('irgendwas', 2026).systemPrompt;
    expect(p).toContain('„vorhaben"');
    expect(p).toContain('„hauptsächlich"');
    // Der Grund muss mitstehen — sonst liest sich die Regel als Willkür.
    expect(p).toContain('Rangfolge');
  });

  it('verlangt Normen-Kürzel MIT Kontext, statt sie wegzulassen', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    // Gemeldet war „müsste das Modell nicht auch DIN zurückgeben?". Antwort:
    // ja — aber nie blank, sonst trifft die Nadel „bedingt" und „Isolierung".
    expect(p).toContain('DIN');
    expect(p).toContain('ISO');
    expect(p).toContain('„din en"');
  });

  it('nennt als Normen-Beispiel keine Schreibweise, die im Bestand nichts findet', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    // Der Vorgänger dieses Tests prüfte die LÄNGE der Beispiele gegen
    // MIN_NADEL_LEN und war grün, während vier der sechs Beispiele über 14 225
    // Anträge NULL Treffer hatten (`din-norm`, `en-norm`, `vde-norm`,
    // `iso 9001`) — der Prompt behauptete dabei „sie stehen so in den
    // Antragstexten". Ein Guard, der die Länge misst, sagt nichts über den
    // Ertrag. Die Nachmessung kann ein Unit-Test nicht leisten (kein Bestand);
    // festhalten lässt sich aber, dass die vier gemessenen Nullnummern nicht
    // zurückkommen. Wer ein Beispiel ergänzt, misst es nach — die Zahlen stehen
    // bei `NORMEN_BEISPIELE` in frageplan.ts.
    for (const tot of ['din-norm', 'en-norm', 'vde-norm', 'iso 9001', 'iso-norm']) {
      expect(p).not.toContain(`„${tot}"`);
    }
    const zeile = p.split('\n').find(z => z.includes('„din en"'));
    expect(zeile).toBeDefined();
    const beispiele = [...(zeile as string).matchAll(/„([^"]+)"/g)].map(m => m[1] as string);
    expect(beispiele.length).toBeGreaterThanOrEqual(2);
    for (const b of beispiele) expect(b.length).toBeGreaterThanOrEqual(MIN_NADEL_LEN);
  });

  it('nennt zu jedem Feld seine Bezeichnung — „ort" und „bl" sind sonst nicht zu trennen', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    // Der teuerste gemessene Defekt: „Sachsen" landete im Ortsfeld (7 Anträge)
    // statt im Bundeslandfeld (2 742), und die Beispielfrage lieferte 0 Treffer.
    // Die Präfixe allein sagen nicht, was in welchem Feld steht.
    expect(p).toContain('ort (Ort)');
    expect(p).toContain('bl (Bundesland)');
    expect(p).toContain('ast (Einrichtung)');
    // Aus TREFFERFELD_LABEL gerendert, nicht abgeschrieben: die Oberfläche nennt
    // die Fundstelle genauso.
    expect(p).toContain(`bl (${TREFFERFELD_LABEL.bundesland})`);
  });

  it('sagt an, dass ein Thema NIE ein Feld bekommt', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    // Gemessen: ein Thema an `kurzbeschreibung` gebunden fiel von 225 auf 179,
    // eines an `titel` von 116 auf 55 — und beide legen zusätzlich Ähnlichkeits-
    // und Dokumentstufe stumm (`planSchraenktEin`).
    expect(p).toContain('Ein THEMA bekommt NIE ein Feld');
    expect(p).toContain('im Zweifel WEGLASSEN');
  });

  it('verlangt den kürzesten Wortstamm und belegt ihn mit gezählten Zahlen', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    expect(p).toContain('KÜRZESTE Form');
    expect(p).toContain('WORTTEIL');
    // Die Vorbilder tragen ihre Messung im Text — ohne die Zahlen ist die Regel
    // eine Behauptung, und das Modell lieferte in jedem Lauf die lange Form.
    expect(p).toMatch(/„wasserstoff" 224 Treffer — „wasserstofftechnologie" nur 2/);
    expect(p).toMatch(/„norm" 145 Treffer — „normung" nur 5/);
  });

  it('verbietet die Gegenrichtung — ein Grundwort ist kein Stamm', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    // Die Stamm-Regel allein trieb das Modell ins andere Extrem: aus
    // „Wasserstofftechnologie" wurde `technologie`, und die Frage sprang von 3
    // auf 2 704 Treffer. Auch diese Grenze steht mit ihrer Messung da.
    expect(p).toContain('NICHT das Wort wechseln');
    expect(p).toContain('niemals „technologie"');
    expect(p).toMatch(/„technologie" 8075/);
  });

  it('verbietet erfundene Komposita und Umschreibungen', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    // 19 gemessene Nadeln mit 0 Treffern kamen aus genau diesen drei Mustern.
    expect(p).toContain('Erfinde KEINE Zusammensetzungen');
    expect(p).toContain('wasserstoff technologie');
    expect(p).toContain('batterieaufbereitung');
    // Englisch ist NICHT verboten — „machine learning" findet 28.
    expect(p).toContain('machine learning');
  });

  it('laesst Stamm und ausgeschriebene Form NEBENEINANDER zu, statt zu waehlen', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    // Gemessen am 22.08.2026: dieselbe Frage lieferte mit den Nadeln
    // „robotik" + „robot" 500 Roh-Treffer, mit „robotik" allein 92. Der
    // Unterschied war keine Entscheidung, sondern derselbe Prompt in zwei
    // Runden — die Stamm-Regel griff mal und mal nicht. Nadeln eines Eintrags
    // sind Alternativen; beide zu nennen nimmt den Zufall heraus.
    // Die Bedingung „bist du unsicher" ist ABSICHT, nicht Nachlaessigkeit:
    // unbedingt formuliert („gib IMMER beides") stabilisierte die Regel zwar
    // F1 und V2, zerlegte dafuer in zwei von drei Laeufen „Batterierecycling"
    // an der Fuge zu `batterie` — 788 bzw. 227 statt 3 Treffer. Auch eine
    // Gegengrenze mit genau diesem Wort und seiner Zahl im Prompt hielt nicht.
    // Wer das hier auf „IMMER" zieht, holt sich diesen Fall zurueck.
    expect(p).toContain('gib BEIDES als Nadeln desselben');
    expect(p).toContain('„robotik" + „robot" fand 500 Anträge, „robotik" allein 92');
  });

  it('lässt den Bereich nur setzen, wenn die Frage ihn nennt', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    expect(p).toContain('nur, wenn die Frage es ausdrücklich sagt');
  });

  it('trennt den Bearbeitungsstand von der Laufzeit', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    // Gemessen: „laufen seit 2023" setzte zusätzlich `status: offen` und fiel
    // von 102 auf 3 Treffer — „Zu bearbeiten" heißt „noch nicht entschieden",
    // nicht „das Vorhaben läuft", und schneidet gerade die Bewilligten weg.
    expect(p).toContain('Stand der BEARBEITUNG');
    expect(p).toContain('nicht die Laufzeit eines Vorhabens');
  });

  it('heisst den Bearbeitungsstand im Zweifel WEGLASSEN — wie Feld und Bereich', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    // Gemessen am 22.08.2026 ueber je drei Runden: „Was laeuft in Bayern zum
    // Thema Leichtbau?" nennt keinen Stand, bekam aber in zwei von vier Laeufen
    // einen erfundenen (»bewilligt«, »offen«) und fiel von 82 auf 11 bzw. 0 —
    // bei identischer Suche (roh 82 in ALLEN Runden). Die Nachbarregeln `feld`
    // und `bereich` trugen ihr „im Zweifel weglassen" laengst, `status` nicht;
    // genau sie wurde erfunden.
    expect(p).toContain('LEERE Liste');
    expect(p).toContain('Im Zweifel weglassen');
    expect(p).toContain('von 82 auf 11 und auf 0');
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

  it('streicht Frageworte aus „ignoriert" — „Vorhaben" ist kein Verlust', () => {
    const plan = parseFrageplan(antwort({ ...NORMUNG, ignoriert: ['Vorhaben', 'Projekte'] }), 'f');
    expect(plan!.ignoriert).toEqual([]);
  });

  it('streicht Gewichtungswörter — die Rangfolge beantwortet sie', () => {
    const plan = parseFrageplan(antwort({ ...NORMUNG, ignoriert: ['hauptsächlich', 'vor allem'] }), 'f');
    expect(plan!.ignoriert).toEqual([]);
  });

  it('streicht den SATZ über ein Fragewort, nicht nur das nackte Wort', () => {
    // In fünf von acht gemessenen Läufen kam die Meldung als Satz statt als
    // Wort — und der Satz rettete sie über den Filter, der auf Wortlisten
    // ausgelegt war. Wortlaut aus echten Läufen.
    const plan = parseFrageplan(antwort({
      ...NORMUNG,
      ignoriert: [
        "Der Ausdruck 'Zeig mir' wird nicht als Suchkriterium verwendet.",
        "Die Formulierung 'Was läuft' ist keine Suchinformation.",
        "Der Ausdruck 'zum Thema' enthält keine zusätzlichen Suchkriterien.",
        'keine weiteren spezifischen Angaben',
      ],
    }), 'f');
    expect(plan!.ignoriert).toEqual([]);
  });

  it('streicht eine Meldung über etwas, das der Plan sehr wohl gesetzt hat', () => {
    // Der schwerere Fall: die Zeile widersprach dem Chip daneben. Gemessen
    // stand „nicht berücksichtigt: seit 2023", WÄHREND der Jahr-Chip 2023–2026
    // gesetzt war.
    const plan = parseFrageplan(antwort({
      ...NORMUNG,
      jahr: [2023, 2024, 2025, 2026],
      ignoriert: ['laufen seit', 'seit 2023', 'noch'],
    }), 'f');
    expect(plan!.facetten.jahr).toEqual(['2023', '2024', '2025', '2026']);
    expect(plan!.ignoriert).toEqual([]);
  });

  it('behält eine Jahresangabe, die der Plan NICHT gesetzt hat', () => {
    // Die Gegenprobe zum Test darüber: der Filter darf nicht jede Zahl
    // schlucken, sondern nur die, die wirklich im Plan steht.
    const plan = parseFrageplan(antwort({ ...NORMUNG, jahr: [2023], ignoriert: ['seit 1999'] }), 'f');
    expect(plan!.ignoriert).toEqual(['seit 1999']);
  });

  it('verlangt im Prompt die blanke Wendung statt eines Satzes', () => {
    const p = baueFrageplanPrompt('x', 2026).systemPrompt;
    expect(p).toContain('KEINEN Satz darüber');
    expect(p).toContain('Was du sehr wohl übersetzt hast, gehört NICHT hierher');
  });

  it('streicht auch die Mischung aus beidem samt Bindewörtern', () => {
    const plan = parseFrageplan(antwort({ ...NORMUNG, ignoriert: ['hauptsächlich und Vorhaben'] }), 'f');
    expect(plan!.ignoriert).toEqual([]);
  });

  it('behält eine Meldung, die einen echten Verlust benennt', () => {
    const plan = parseFrageplan(antwort({
      ...NORMUNG, ignoriert: ['Der Zeitraum „zuletzt" ist unklar', 'hauptsächlich'],
    }), 'f');
    expect(plan!.ignoriert).toEqual(['Der Zeitraum „zuletzt" ist unklar']);
  });

  it('lässt die technisch verworfenen Werte unangetastet', () => {
    // „din" ist eine zu kurze Nadel, kein Fragewort — der Filter gilt nur für
    // die Liste des Modells.
    const plan = parseFrageplan(antwort({
      begriffe: [{ begriff: 'Normung', nadeln: ['normung', 'din'], pflicht: false }],
      ignoriert: ['Vorhaben'],
    }), 'f');
    expect(plan!.ignoriert).toEqual(['din']);
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
