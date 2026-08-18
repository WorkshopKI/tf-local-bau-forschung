/**
 * Der Antragsplan: Prompt-Vokabular und Parser.
 *
 * Die drei Beispielfragen, die das Feature ausgelöst haben, stehen hier als
 * Fixtures — sie sind die Abnahmebedingung, nicht eine Auswahl.
 *
 * Das Vokabular wird **gegen die Konstanten** geprüft, nicht gegen abgeschriebene
 * Literale: sonst fiele eine neue Statuskategorie hier nicht auf, und das Modell
 * könnte sie folgerichtig nie nennen.
 */
import { describe, it, expect } from 'vitest';
import { getStatusValuesByCategory } from '@/core/utils/status-canonical';
import { KATEGORIE_REIHENFOLGE } from '@/core/utils/status-category-labels';
import { VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';
import { PRECHECK_BUCKET_ORDER } from '../filter/precheckQuickfilter';
import { PROJEKTART_ORDER, PROJEKTART_TITEL } from '../filter/projektartQuickfilter';
import {
  baueAntragsplanPrompt,
  parseAntragsplan,
  MAX_STILLSTAND_TAGE,
} from '../frage/antragsplan';

const HEUTE_JAHR = 2026;

const prompt = (frage = 'x'): string => baueAntragsplanPrompt(frage, HEUTE_JAHR).systemPrompt;

/** Kürzt die Fixtures: der Parser liest nur den JSON-Block. */
const parse = (obj: unknown, frage = 'Testfrage'): ReturnType<typeof parseAntragsplan> =>
  parseAntragsplan(JSON.stringify(obj), frage);

describe('baueAntragsplanPrompt — das Vokabular kommt aus dem Code', () => {
  it('nennt jede Arbeitslisten-Kategorie, die im Katalog einen Rohwert hat', () => {
    const p = prompt();
    const belegt = KATEGORIE_REIHENFOLGE.filter(k => getStatusValuesByCategory(k).length > 0);
    expect(belegt.length).toBeGreaterThan(0);
    for (const k of belegt) expect(p).toContain(k);
  });

  it('bietet eine Kategorie OHNE Rohwerte nicht an', () => {
    // Sonst wählte das Modell sie zu Recht („…die abgelehnt wurden") und der
    // gesetzte Filter verglich nichts — die Frage käme ohne diese Einschränkung
    // zurück. Am eingebauten Katalog trifft das `abgelehnt`; welche Kategorien
    // belegt sind, entscheidet der Katalog des Teams.
    const p = prompt();
    const leer = KATEGORIE_REIHENFOLGE.filter(k => getStatusValuesByCategory(k).length === 0);
    for (const k of leer) expect(p).not.toContain(`${k} (`);
  });

  it('nennt JEDE Fördervariante mit Nummer und Beschriftung', () => {
    const p = prompt();
    for (const [n, label] of Object.entries(VB_PHASE_LABELS)) {
      expect(p).toContain(`${n} (${label})`);
    }
  });

  it('nennt jede Projektart MIT ihrer Definition aus PROJEKTART_TITEL', () => {
    const p = prompt();
    for (const a of PROJEKTART_ORDER) {
      if (a === 'alle') continue;
      expect(p).toContain(a);
      expect(p).toContain(PROJEKTART_TITEL[a]);
    }
  });

  it('bietet „alle" NICHT als Projektart an — das Fehlen sagt das schon', () => {
    // Sonst räumte ein Plan eine von Hand gesetzte Projektart ab, ohne dass die
    // Frage sie erwähnt hätte.
    expect(prompt()).not.toContain(PROJEKTART_TITEL.alle);
  });

  it('nennt die PreCheck-Werte ohne „Alle"', () => {
    const p = prompt();
    for (const b of PRECHECK_BUCKET_ORDER) {
      if (b === 'Alle') continue;
      expect(p).toContain(b);
    }
  });

  it('löst relative Zeitangaben gegen das übergebene Jahr auf, nicht gegen die Uhr', () => {
    expect(baueAntragsplanPrompt('x', 2031).systemPrompt).toContain('2031');
    expect(prompt()).toContain(String(HEUTE_JAHR));
  });

  it('sagt an, dass eine Frage ganz ohne Thema der Normalfall ist', () => {
    expect(prompt()).toContain('kein Thema');
  });

  it('hält die Frage aus dem System-Prompt heraus und deckelt sie im User-Prompt', () => {
    const lang = `Leichtbau ${'a'.repeat(1000)}`;
    const { systemPrompt, userPrompt } = baueAntragsplanPrompt(lang, HEUTE_JAHR);
    expect(systemPrompt).not.toContain('Leichtbau');
    expect(userPrompt).toContain('Leichtbau');
    expect(userPrompt).not.toContain('a'.repeat(1000));
  });
});

describe('parseAntragsplan — die drei Beispielfragen', () => {
  it('1 · Einzelvorhaben FuE/DS, 2025+2026, kein PreCheck', () => {
    const plan = parse({
      phasen: [3, 5],
      jahre: [2025, 2026],
      projektart: 'einzel',
      precheck: 'offen',
      ignoriert: [],
    }, 'alle Einzelvorhaben aus 2025 und 2026 ohne PreCheck auf Verbundebene');

    expect(plan).not.toBeNull();
    expect(plan!.vbPhasen).toEqual([3, 5]);
    expect(plan!.jahre).toEqual(['2025', '2026']);
    expect(plan!.projektart).toBe('einzel');
    expect(plan!.precheck).toBe('offen');
    expect(plan!.stillstandTage).toBeUndefined();
    expect(plan!.leitbegriffe).toEqual([]);
    expect(plan!.ignoriert).toEqual([]);
  });

  it('2 · in Bearbeitung, über 2 Monate Stillstand, Bearbeiter THü', () => {
    const plan = parse({
      status: ['in_pruefung'],
      stillstandTage: 60,
      bearbeiter: ['THü'],
    }, 'Anträge in Bearbeitung ohne neues Kürzel seit 2 Monaten für THü');

    expect(plan!.status).toEqual(['in_pruefung']);
    expect(plan!.stillstandTage).toBe(60);
    // Roh übernommen — die Normalisierung (NFC + Großschreibung) macht die App,
    // damit es dafür genau eine Stelle gibt.
    expect(plan!.bearbeiter).toEqual(['THü']);
  });

  it('3 · Netzwerke, für Phase 2 abgelehnt', () => {
    const plan = parse({
      phasen: [2],
      status: ['abgelehnt'],
    }, 'alle Netzwerke die für Phase 2 abgelehnt wurden');

    expect(plan!.vbPhasen).toEqual([2]);
    expect(plan!.status).toEqual(['abgelehnt']);
  });

  it('eine gemischte Frage trägt Filter UND Thema', () => {
    const plan = parse({
      phasen: [3],
      jahre: [2025],
      begriffe: [{ begriff: 'Wasserstoff', nadeln: ['wasserstoff', 'h2-technologie'] }],
    }, 'FuE-Anträge 2025 zum Thema Wasserstoff');

    expect(plan!.vbPhasen).toEqual([3]);
    expect(plan!.leitbegriffe).toHaveLength(1);
    expect(plan!.leitbegriffe[0]!.nadeln).toContain('wasserstoff');
  });
});

describe('parseAntragsplan — was nicht durchgeht', () => {
  it('Prosa statt JSON ergibt keinen Plan', () => {
    expect(parseAntragsplan('Das kann ich leider nicht beantworten.', 'f')).toBeNull();
  });

  it('ein Plan ohne eine einzige gesetzte Achse ist keiner', () => {
    // Er ließe die Liste unverändert und behauptete dabei, verstanden zu haben.
    expect(parse({ status: [], phasen: [], jahre: [], ignoriert: ['alles'] })).toBeNull();
  });

  it('erfundene Werte fallen heraus UND werden gemeldet', () => {
    const plan = parse({
      status: ['schwebend'],
      phasen: [42],
      projektart: 'grossprojekt',
      precheck: 'vielleicht',
      jahre: ['letztes Jahr'],
      // Damit der Plan nicht am Nichts-gesetzt-Riegel scheitert:
      bearbeiter: ['ABC'],
    });

    expect(plan!.status).toEqual([]);
    expect(plan!.vbPhasen).toEqual([]);
    expect(plan!.projektart).toBeUndefined();
    expect(plan!.precheck).toBeUndefined();
    expect(plan!.jahre).toEqual([]);
    const gemeldet = plan!.ignoriert.join(' | ');
    expect(gemeldet).toContain('schwebend');
    expect(gemeldet).toContain('42');
    expect(gemeldet).toContain('grossprojekt');
    expect(gemeldet).toContain('vielleicht');
    expect(gemeldet).toContain('letztes Jahr');
  });

  it('„alle" als Projektart ist kein Verlust und wird NICHT gemeldet', () => {
    const plan = parse({ projektart: 'alle', precheck: 'Alle', status: ['offen'] });
    expect(plan!.projektart).toBeUndefined();
    expect(plan!.precheck).toBeUndefined();
    expect(plan!.ignoriert).toEqual([]);
  });

  it('eine Stillstands-Schwelle muss eine brauchbare Tageszahl sein', () => {
    expect(parse({ stillstandTage: 60, status: ['offen'] })!.stillstandTage).toBe(60);
    expect(parse({ stillstandTage: 0, status: ['offen'] })!.stillstandTage).toBeUndefined();
    // Ein Datum als Tagesmenge wäre ein stillschweigend leeres Ergebnis.
    const zuGross = parse({ stillstandTage: 20_250_101, status: ['offen'] });
    expect(zuGross!.stillstandTage).toBeUndefined();
    expect(zuGross!.ignoriert.join(' ')).toContain('20250101');
    expect(parse({ stillstandTage: MAX_STILLSTAND_TAGE, status: ['offen'] })!.stillstandTage)
      .toBe(MAX_STILLSTAND_TAGE);
  });

  it('erbt die Nadel-Regeln des Frageplans statt eigener', () => {
    const plan = parse({
      begriffe: [{ begriff: 'Normung', nadeln: ['iso', 'normen'] }],
    });
    // `iso` ist zu kurz (MIN_NADEL_LEN) — die Regel lebt im Frageplan, nicht hier.
    expect(plan!.leitbegriffe[0]!.nadeln).not.toContain('iso');
    expect(plan!.leitbegriffe[0]!.nadeln).toContain('normen');
    expect(plan!.ignoriert.join(' ')).toContain('iso');
  });

  it('bei mehreren Objekten gewinnt das letzte', () => {
    const roh = 'Erst ein Beispiel: {"status":["offen"]} — und nun das Ergebnis: {"status":["abgelehnt"]}';
    expect(parseAntragsplan(roh, 'f')!.status).toEqual(['abgelehnt']);
  });

  it('trägt die Frage als seine Identität', () => {
    expect(parse({ status: ['offen'] }, '  Welche sind offen?  ')!.frage).toBe('Welche sind offen?');
  });
});
