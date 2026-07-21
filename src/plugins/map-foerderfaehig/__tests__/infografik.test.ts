/**
 * Infografik-Extraktion: Parser, Richtwerte, Portfolio-Geometrie.
 *
 * Schwerpunkt ist die Leitplanke „Lücken zeigen, nicht füllen": eine Aussage
 * ohne Fundstelle darf nie als belegt durchgehen, und ein fehlender Zahlenwert
 * ist etwas anderes als ein verfehlter Richtwert.
 */
import { parseVbGliederung } from '@/plugins/antraege/aufbereitung/gliederung';
import { describe, expect, it } from 'vitest';
import { importiereEinreichung } from '../import/adapter';
import {
  PORTFOLIO_DEMO, PORTFOLIO_DEMO_GESAMT, baueRingSegmente, ringPfad,
} from '../infografik/portfolio-demo';
import { leseGeldbetrag, lesePersonenzahl, pruefeRichtwerte } from '../infografik/richtwerte';
import {
  buildInfografikPrompt, istInhaltsleer, parseInfografik, type Wirkungskette,
} from '../infografik/schema';
import { CHECKLISTE_SEED } from '../checkliste/seed';
import { DUMMY_PFAD, TEST_KONTEXT, leseFixture } from './fixtures';

/** Bewertungsgrundlage der Zweitmeinung — hier nur Beiwerk, die Tests prüfen den Rest. */
const SKALA = CHECKLISTE_SEED.items.filter(i => i.art === 'skala' && i.aktiv);

const antwort = importiereEinreichung(leseFixture(DUMMY_PFAD), TEST_KONTEXT);
if (!antwort.ok) throw new Error(antwort.fehler);
const DUMMY = antwort.einreichung;

const VB = [
  '# 1 Ausgangssituation',
  'Heutige Anlagen erreichen 40 Prozent Wirkungsgrad.',
  '',
  '# 2 Zielstellung',
  'Ziel sind 65 Prozent Wirkungsgrad.',
].join('\n');

const GLIEDERUNG = parseVbGliederung(VB);

/** Platzhalter-Faktenblock — der echte Aufbau wird in `substanz.test.ts` geprueft. */
const FAKTEN = '## Verbindliche Fakten aus der Einreichung\n\n- Laufzeit: 23 Monate';

const VOLLE_ANTWORT = JSON.stringify({
  canvas: {
    problemSdt: { text: 'Heutige Anlagen sind ineffizient.', sektionIds: ['k-1'], belegtheit: 'belegt' },
    innovation: { text: 'Neuer Regelkreis.', sektionIds: ['k-2'], belegtheit: 'belegt' },
    technischesRisiko: { text: 'Regelstabilität unklar.', sektionIds: ['k-2'], belegtheit: 'vage' },
    marktVerwertung: { text: '', sektionIds: [], belegtheit: 'fehlt' },
  },
  sdtDelta: [
    { parameter: 'Wirkungsgrad', sdtWert: '40 %', zielWert: '65 %', quantifizierung: 'quantifiziert', sektionIds: ['k-2'] },
    { parameter: 'Bedienbarkeit', sdtWert: 'aufwendig', zielWert: 'einfacher', quantifizierung: 'qualitativ', sektionIds: ['k-1'] },
  ],
  wirkungskette: {
    problem: { text: 'Ineffizienz', sektionIds: ['k-1'], belegtheit: 'belegt' },
    ergebnis: { text: 'Regelkreis', sektionIds: ['k-2'], belegtheit: 'belegt' },
    verwertung: { text: 'Vertrieb ab 2028', sektionIds: ['k-2'], belegtheit: 'belegt' },
    wirkung: { text: 'Mehrumsatz erwartet', zahlenziel: '1,2 Mio. € Umsatz, 3 neue Arbeitsplätze', sektionIds: ['k-2'], belegtheit: 'belegt' },
  },
});

describe('Prompt', () => {
  it('nennt die Abschnitts-IDs, damit das Modell belegen kann', () => {
    const p = buildInfografikPrompt(GLIEDERUNG, VB, FAKTEN, SKALA);
    expect(p).toContain('k-1');
    expect(p).toContain('Ausgangssituation');
    expect(p).toContain(VB);
  });

  it('verlangt die Kennzeichnung von Vagem', () => {
    expect(buildInfografikPrompt(GLIEDERUNG, VB, FAKTEN, SKALA)).toMatch(/belegt\|vage\|fehlt/);
  });
});

describe('Parser — Lücken zeigen, nicht füllen', () => {
  it('liest eine vollstaendige Antwort', () => {
    const d = parseInfografik(VOLLE_ANTWORT, GLIEDERUNG, SKALA)!;
    expect(d.canvas.problemSdt).toMatchObject({ belegtheit: 'belegt', sektionIds: ['k-1'] });
    expect(d.sdtDelta).toHaveLength(2);
    expect(d.wirkungskette.wirkung.zahlenziel).toContain('1,2 Mio');
  });

  it('liest auch aus einem Markdown-Codeblock mit Nachgeplapper', () => {
    const roh = `Gerne! Hier das Ergebnis:\n\`\`\`json\n${VOLLE_ANTWORT}\n\`\`\`\nIch hoffe, das passt.`;
    expect(parseInfografik(roh, GLIEDERUNG, SKALA)?.sdtDelta).toHaveLength(2);
  });

  it('stuft eine Aussage ohne Fundstelle auf „vage" herab — auch wenn sie „belegt" behauptet', () => {
    const roh = JSON.stringify({
      canvas: { innovation: { text: 'Behauptung', sektionIds: [], belegtheit: 'belegt' } },
    });
    expect(parseInfografik(roh, GLIEDERUNG, SKALA)?.canvas.innovation.belegtheit).toBe('vage');
  });

  it('verwirft erfundene Sektions-IDs', () => {
    const roh = JSON.stringify({
      canvas: { innovation: { text: 'X', sektionIds: ['k-99', 'k-1'], belegtheit: 'belegt' } },
    });
    expect(parseInfografik(roh, GLIEDERUNG, SKALA)?.canvas.innovation.sektionIds).toEqual(['k-1']);
  });

  it('fuehrt einen leeren Text als „fehlt", egal was behauptet wird', () => {
    const roh = JSON.stringify({
      canvas: { innovation: { text: '', sektionIds: ['k-1'], belegtheit: 'belegt' } },
    });
    expect(parseInfografik(roh, GLIEDERUNG, SKALA)?.canvas.innovation.belegtheit).toBe('fehlt');
  });

  it('faellt bei fehlenden Teilen auf „fehlt" zurueck statt abzubrechen', () => {
    const d = parseInfografik('{"canvas":{}}', GLIEDERUNG, SKALA)!;
    expect(d.canvas.problemSdt.belegtheit).toBe('fehlt');
    expect(d.sdtDelta).toEqual([]);
    expect(d.wirkungskette.problem.belegtheit).toBe('fehlt');
  });

  it('verwirft Delta-Zeilen ohne Parameter', () => {
    const roh = JSON.stringify({ sdtDelta: [{ sdtWert: 'x', zielWert: 'y' }, { parameter: 'Gut' }] });
    expect(parseInfografik(roh, GLIEDERUNG, SKALA)?.sdtDelta.map(z => z.parameter)).toEqual(['Gut']);
  });

  it('gibt null nur zurueck, wenn gar kein JSON erkennbar ist', () => {
    expect(parseInfografik('Ich kann das leider nicht.', GLIEDERUNG, SKALA)).toBeNull();
  });

  it('erkennt eine formal gueltige, inhaltlich leere Antwort', () => {
    expect(istInhaltsleer(parseInfografik('{}', GLIEDERUNG, SKALA)!)).toBe(true);
    expect(istInhaltsleer(parseInfografik(VOLLE_ANTWORT, GLIEDERUNG, SKALA)!)).toBe(false);
  });
});

describe('Richtwerte — fehlend ist nicht verfehlt', () => {
  const kette = parseInfografik(VOLLE_ANTWORT, GLIEDERUNG, SKALA)!.wirkungskette;

  it('liest Geldbetraege in den ueblichen Schreibweisen', () => {
    expect(leseGeldbetrag('1,2 Mio. €')).toBe(1_200_000);
    expect(leseGeldbetrag('450 T€')).toBe(450_000);
    expect(leseGeldbetrag('500000')).toBe(500_000);
    expect(leseGeldbetrag('kein Wert')).toBeNull();
  });

  it('liest Personenzahlen', () => {
    expect(lesePersonenzahl('3 neue Arbeitsplätze')).toBe(3);
    expect(lesePersonenzahl('2 Vollzeitstellen')).toBe(2);
    expect(lesePersonenzahl('mehr Personal')).toBeNull();
  });

  it('erkennt den erfuellten Umsatz-Richtwert', () => {
    // 1,2 Mio. EUR gegen 111.730 EUR Projektkosten.
    const b = pruefeRichtwerte(kette, DUMMY).find(x => x.id === 'umsatz-deckt-kosten')!;
    expect(b.lage).toBe('erfuellt');
  });

  it('erkennt den verfehlten Umsatz-Richtwert', () => {
    const knapp: Wirkungskette = {
      ...kette,
      wirkung: { ...kette.wirkung, zahlenziel: '50000 € Umsatz' },
    };
    expect(pruefeRichtwerte(knapp, DUMMY).find(x => x.id === 'umsatz-deckt-kosten')?.lage)
      .toBe('verfehlt');
  });

  it('unterscheidet „nicht beziffert" von „verfehlt"', () => {
    const ohne: Wirkungskette = {
      ...kette,
      wirkung: { text: 'Wir erwarten Wachstum.', sektionIds: ['k-1'], belegtheit: 'vage' },
      verwertung: { text: 'Vertrieb geplant.', sektionIds: ['k-1'], belegtheit: 'vage' },
    };
    const befunde = pruefeRichtwerte(ohne, DUMMY);
    expect(befunde.find(x => x.id === 'umsatz-deckt-kosten')?.lage).toBe('nicht-quantifiziert');
    expect(befunde.find(x => x.id === 'personalzuwachs')?.lage).toBe('nicht-quantifiziert');
  });

  it('meldet „nicht beziffert", wenn die Projektkosten fehlen', () => {
    const ohneKosten = { ...DUMMY, kosten: { ...DUMMY.kosten, gesamt: null } };
    expect(pruefeRichtwerte(kette, ohneKosten).find(x => x.id === 'umsatz-deckt-kosten')?.lage)
      .toBe('nicht-quantifiziert');
  });

  it('erkennt den Personalzuwachs', () => {
    expect(pruefeRichtwerte(kette, DUMMY).find(x => x.id === 'personalzuwachs')?.lage)
      .toBe('erfuellt');
  });
});

describe('Portfolio-Demo — erfunden und als solches erkennbar', () => {
  it('summiert auf 42 fiktive Antraege in 6 Themenfeldern', () => {
    expect(PORTFOLIO_DEMO).toHaveLength(6);
    expect(PORTFOLIO_DEMO_GESAMT).toBe(42);
  });

  it('haelt Ober- und Unterebene konsistent', () => {
    for (const thema of PORTFOLIO_DEMO) {
      const summe = thema.unter.reduce((a, u) => a + u.anzahl, 0);
      expect(summe, thema.name).toBe(thema.anzahl);
    }
  });

  it('belegt mit den Ober-Segmenten den vollen Kreis', () => {
    const ebene1 = baueRingSegmente().filter(s => s.ebene === 1);
    const bogen = ebene1.reduce((a, s) => a + (s.bis - s.von), 0);
    expect(bogen).toBeCloseTo(Math.PI * 2, 10);
  });

  it('haelt die Unter-Segmente im Bogen ihres Themenfelds', () => {
    const segmente = baueRingSegmente();
    for (const thema of segmente.filter(s => s.ebene === 1)) {
      const kinder = segmente.filter(s => s.ebene === 2 && s.von >= thema.von - 1e-9 && s.bis <= thema.bis + 1e-9);
      expect(kinder.length, thema.name).toBeGreaterThan(0);
    }
  });

  it('erzeugt einen geschlossenen SVG-Pfad', () => {
    const s = baueRingSegmente()[0]!;
    const d = ringPfad(s, 200, 60, 120);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).not.toMatch(/NaN/);
  });

  it('liefert nichts bei leerer Eingabe, statt durch Null zu teilen', () => {
    expect(baueRingSegmente([])).toEqual([]);
  });
});
