/**
 * Substanzcheck: Fakten-Block, Parser und die Leitplanken drumherum.
 *
 * LLM-frei — geprüft wird die deterministische Seite: was in den Prompt geht und
 * was aus einer Antwort herausgelesen wird. Das Modellverhalten selbst misst das
 * dev-Smoke-Panel gegen die Kontrast-Fixtures.
 */
import { describe, expect, it } from 'vitest';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import { importiereEinreichung } from '../import/adapter';
import { baueFaktenBlock } from '../infografik/fakten';
import {
  buildInfografikPrompt, INFOGRAFIK_SCHEMA_VERSION, istInhaltsleer, parseInfografik,
} from '../infografik/schema';
import { parseSubstanz, UNSCHAERFE_MAX } from '../infografik/substanz';
import { KONTRAST_FIXTURES } from '../substanz/kontrast.seed';
import { DUMMY_PFAD, leseFixture, TEST_KONTEXT } from './fixtures';

const einreichung = (() => {
  const antwort = importiereEinreichung(leseFixture(DUMMY_PFAD), TEST_KONTEXT);
  if (!antwort.ok) throw new Error(`Dummy-Fixture nicht importierbar: ${antwort.fehler}`);
  return antwort.einreichung;
})();

const GLIEDERUNG: VbSektion[] = [
  { id: 'k-1', titel: 'Ausgangslage', nummer: '1', start: 0, end: 10, ebene: 2 },
  { id: 'k-2', titel: 'Arbeitsplan', nummer: '3', start: 10, end: 20, ebene: 2 },
] as unknown as VbSektion[];

const BEKANNT = new Set(GLIEDERUNG.map(s => s.id));

describe('baueFaktenBlock', () => {
  const block = baueFaktenBlock(einreichung);

  it('nennt Laufzeit, Personenmonate und die Arbeitspakete mit Namen', () => {
    expect(block).toContain('23 Monate');
    expect(block).toContain('16 PM');
    expect(block).toContain('„AP1"');
    expect(block).toContain('12 PM');
    expect(block).toContain('„AP2"');
    expect(block).toContain('4 PM');
  });

  it('nennt Kostenarten, Gesamt, Foerdersatz und Zuwendung', () => {
    expect(block).toContain('111.730 €');
    expect(block).toContain('50.279 €');
    expect(block).toContain('45 %');
    expect(block).toContain('Personal 69.718 €');
  });

  it('traegt die Ueberschrift, auf die das Prompt sich beruft', () => {
    // Der Wortlaut ist Vertrag zwischen `fakten.ts` und `buildInfografikPrompt`.
    expect(block).toContain('## Verbindliche Fakten aus der Einreichung');
  });

  it('ist unveraendert, wenn sich die personenbezogenen Daten aendern', () => {
    // Kernleitplanke: der Block ist eine Aggregat-Liste. Statt auf die Abwesenheit
    // konkreter Personalnummern zu pruefen (die im Dummy „1"/„2" heissen und mit
    // jeder Zahl im Text kollidieren), wird die Invarianz geprueft: taucht eine
    // markante Personalnummer nirgends auf, liest die Funktion die Einsatzplanung
    // gar nicht — die staerkere und stabilere Aussage.
    expect(einreichung.einsatzplanung.length).toBeGreaterThan(0); // sonst prueft der Test nichts

    const mitKlarnamen = baueFaktenBlock({
      ...einreichung,
      einsatzplanung: einreichung.einsatzplanung.map(z => ({
        ...z,
        mitarbeiter: [{ personalNr: 'PN-4711-MARKANT', istNn: true, pm: 3 }],
      })),
    });

    expect(mitKlarnamen).toBe(block);
    expect(block).not.toContain('PN-4711-MARKANT');
    expect(block).not.toMatch(/N\.\s?N\./);
  });

  it('schreibt fehlende Werte als „nicht angegeben" statt sie wegzulassen', () => {
    const leer = baueFaktenBlock({
      ...einreichung,
      laufzeit: { start: null, ende: null, monate: null },
      arbeitspakete: [],
      kosten: { ...einreichung.kosten, gesamt: null },
    });
    expect(leer).toContain('Laufzeit: nicht angegeben');
    expect(leer).toContain('Arbeitspakete: nicht angegeben');
    expect(leer).toContain('Gesamtkosten: nicht angegeben');
  });
});

describe('buildInfografikPrompt', () => {
  it('bettet den Fakten-Block vor der Vorhabensbeschreibung ein', () => {
    const prompt = buildInfografikPrompt(
      GLIEDERUNG, '# VB\n\nText.', baueFaktenBlock(einreichung),
    );
    expect(prompt.indexOf('## Verbindliche Fakten aus der Einreichung'))
      .toBeLessThan(prompt.indexOf('## Vorhabensbeschreibung'));
  });

  it('fordert die beiden Substanz-Listen an und erlaubt leere Ergebnisse', () => {
    const prompt = buildInfografikPrompt(GLIEDERUNG, 'Text.', 'FAKTEN');
    expect(prompt).toContain('"widersprueche"');
    expect(prompt).toContain('"unschaerfeBegriffe"');
    expect(prompt).toContain('das ist ein GUTES Ergebnis');
    expect(prompt).toContain(`Höchstens ${UNSCHAERFE_MAX} Einträge`);
  });
});

describe('parseSubstanz', () => {
  it('liest gueltige Eintraege beider Listen', () => {
    const ergebnis = parseSubstanz({
      widersprueche: [
        { fakt: '16 PM', aussageImText: '18 PM', art: 'zahl', sektionIds: ['k-2'] },
      ],
      unschaerfeBegriffe: [
        {
          begriff: 'deutliche Effizienzsteigerung', kontext: 'Der Stand der Technik …',
          grund: 'nicht quantifiziert', sektionIds: ['k-1'],
        },
      ],
    }, BEKANNT);

    expect(ergebnis.widersprueche).toHaveLength(1);
    expect(ergebnis.widersprueche[0]!.art).toBe('zahl');
    expect(ergebnis.unschaerfeBegriffe).toHaveLength(1);
    expect(ergebnis.unschaerfeBegriffe[0]!.grund).toBe('nicht quantifiziert');
  });

  it('verwirft Widersprueche mit unbekannter Art statt zu raten', () => {
    const ergebnis = parseSubstanz({
      widersprueche: [
        { fakt: 'a', aussageImText: 'b', art: 'stimmung', sektionIds: [] },
        { fakt: 'a', aussageImText: 'b', sektionIds: [] },
      ],
    }, BEKANNT);
    expect(ergebnis.widersprueche).toEqual([]);
  });

  it('verwirft einseitige Widersprueche', () => {
    // Ohne beide Seiten ist nichts pruefbar — das ist der Halluzinations-Filter.
    const ergebnis = parseSubstanz({
      widersprueche: [
        { fakt: '16 PM', aussageImText: '', art: 'zahl', sektionIds: [] },
        { fakt: '', aussageImText: '18 PM', art: 'zahl', sektionIds: [] },
      ],
    }, BEKANNT);
    expect(ergebnis.widersprueche).toEqual([]);
  });

  it('verwirft Unschaerfe-Eintraege mit unbekanntem Grund', () => {
    const ergebnis = parseSubstanz({
      unschaerfeBegriffe: [
        { begriff: 'x', kontext: 'y', grund: 'schwammig', sektionIds: [] },
      ],
    }, BEKANNT);
    expect(ergebnis.unschaerfeBegriffe).toEqual([]);
  });

  it('filtert erfundene Sektions-IDs heraus', () => {
    const ergebnis = parseSubstanz({
      widersprueche: [
        { fakt: 'a', aussageImText: 'b', art: 'zahl', sektionIds: ['k-1', 'k-99'] },
      ],
    }, BEKANNT);
    expect(ergebnis.widersprueche[0]!.sektionIds).toEqual(['k-1']);
  });

  it(`kappt die Unschaerfe-Liste bei ${UNSCHAERFE_MAX}`, () => {
    const viele = Array.from({ length: UNSCHAERFE_MAX + 7 }, (_, i) => ({
      begriff: `b${i}`, kontext: 'k', grund: 'nicht definiert', sektionIds: [],
    }));
    const ergebnis = parseSubstanz({ unschaerfeBegriffe: viele }, BEKANNT);
    expect(ergebnis.unschaerfeBegriffe).toHaveLength(UNSCHAERFE_MAX);
  });

  it('liefert leere Listen, wenn die Felder ganz fehlen', () => {
    expect(parseSubstanz({}, BEKANNT)).toEqual({ widersprueche: [], unschaerfeBegriffe: [] });
  });
});

describe('parseInfografik mit Substanz-Feldern', () => {
  const antwort = JSON.stringify({
    canvas: {
      problemSdt: { text: 'Problem.', sektionIds: ['k-1'], belegtheit: 'belegt' },
    },
    sdtDelta: [
      {
        parameter: 'Fehlalarmquote', sdtWert: '12 %', zielWert: '4 %',
        quantifizierung: 'quantifiziert', sektionIds: ['k-2'],
      },
    ],
    wirkungskette: {},
    widersprueche: [
      { fakt: '16 PM', aussageImText: '18 PM', art: 'zahl', sektionIds: ['k-2'] },
    ],
    unschaerfeBegriffe: [
      {
        begriff: 'innovativer Ansatz', kontext: 'Ziel ist ein …',
        grund: 'nicht definiert', sektionIds: ['k-1'],
      },
    ],
  });

  it('reicht beide Listen durch', () => {
    const daten = parseInfografik(antwort, GLIEDERUNG);
    expect(daten?.widersprueche).toHaveLength(1);
    expect(daten?.unschaerfeBegriffe).toHaveLength(1);
  });

  it('bleibt gueltig, wenn eine Alt-Antwort die Felder gar nicht kennt', () => {
    const alt = JSON.stringify({ canvas: {}, sdtDelta: [], wirkungskette: {} });
    const daten = parseInfografik(alt, GLIEDERUNG);
    expect(daten).not.toBeNull();
    expect(daten?.widersprueche).toEqual([]);
    expect(daten?.unschaerfeBegriffe).toEqual([]);
  });

  it('wertet eine leere Widerspruchsliste NICHT als inhaltsleer', () => {
    // Das ist die zentrale Leitplanke: der saubere Antrag darf keinen Retry und
    // kein „degradiert" ausloesen, nur weil er nichts zu beanstanden hat.
    const daten = parseInfografik(antwort, GLIEDERUNG)!;
    const ohneBefunde = { ...daten, widersprueche: [], unschaerfeBegriffe: [] };
    expect(istInhaltsleer(ohneBefunde)).toBe(false);
  });
});

describe('Kontrast-Fixtures', () => {
  it('enthalten genau eine saubere Fassung als Falsch-Positiv-Kontrolle', () => {
    const sauber = KONTRAST_FIXTURES.filter(f => f.erwarteteWidersprueche === 0);
    expect(sauber).toHaveLength(1);
    expect(sauber[0]!.erwarteteArt).toBeNull();
  });

  it('decken alle drei Widerspruchs-Arten ab', () => {
    const arten = KONTRAST_FIXTURES.map(f => f.erwarteteArt).filter(a => a !== null);
    expect(new Set(arten)).toEqual(new Set(['zahl', 'zeitraum', 'bezeichnung']));
  });

  it('weichen nur im Arbeitsplan von der sauberen Fassung ab', () => {
    // Sonst misst der Smoke nicht die eingebaute Abweichung, sondern Rauschen.
    const sauber = KONTRAST_FIXTURES.find(f => f.id === 'sauber')!;
    for (const f of KONTRAST_FIXTURES.filter(x => x.id !== 'sauber')) {
      const [vorherA, vorherB] = [sauber.markdown, f.markdown]
        .map(m => m.split('## 3 Arbeitsplan')[0]);
      expect(vorherA).toBe(vorherB);
      const [nachA, nachB] = [sauber.markdown, f.markdown]
        .map(m => m.split('## 4 Technische Risiken')[1]);
      expect(nachA).toBe(nachB);
    }
  });

  it('nennen die Bezugszahlen der Dummy-Einreichung in der sauberen Fassung', () => {
    const sauber = KONTRAST_FIXTURES.find(f => f.id === 'sauber')!;
    expect(sauber.markdown).toContain('23 Monate');
    expect(sauber.markdown).toContain('16 Personenmonate');
  });
});

describe('INFOGRAFIK_SCHEMA_VERSION', () => {
  it('ist auf 2 gehoben, damit v1-Caches verfallen', () => {
    expect(INFOGRAFIK_SCHEMA_VERSION).toBe(2);
  });
});
