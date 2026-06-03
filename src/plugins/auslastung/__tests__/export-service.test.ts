import { describe, it, expect } from 'vitest';
import { buildExportRows, buildWorkbook } from '../services/export-service';
import { buildAnonymMapForTests } from './test-helpers';
import type { Antrag, Verbund } from '@/core/services/csv/types';
import type { AnonymerMitarbeiter, AuslastungData, MatchResult } from '../types';
import { emptyAuslastungData } from '../types';

function makeAntrag(az: string, fields: Partial<Antrag> = {}): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: '2026-05-01T00:00:00Z',
    ...fields,
  } as Antrag;
}

function makeMa(anonId: string): AnonymerMitarbeiter {
  return {
    anonId, jahresKapazitaet: 1600, abgemeldet: [], manuelleTechnologien: [],
    ausgeblendeteAutoTags: [],
    hauptKategorie: 'IKT', nebenKategorien: [], abschlagProzent: 0,
    virtuelleProjekte: [], onboardingAbgeschlossen: true, aktiv: true,
  };
}

function makeData(): AuslastungData {
  const base = emptyAuslastungData();
  base.config.aktuellesQuartal = '2026-Q2';
  base.mitarbeiter = { MA01: makeMa('MA01'), MA02: makeMa('MA02') };
  base.zuweisungen = [
    { antragId: 'A1', anonId: 'MA01', quartal: '2026-Q2', stunden: 10, status: 'freigegeben' },
    { antragId: 'A2', anonId: 'MA02', quartal: '2026-Q2', stunden: 20, status: 'selbst', selbstEingetragen: true },
    { antragId: 'A3', anonId: 'MA01', quartal: '2026-Q2', stunden: 5, status: 'abgelehnt' },
    { antragId: 'A4', anonId: 'MA02', quartal: '2026-Q1', stunden: 5, status: 'freigegeben' }, // anderes Quartal
  ];
  return base;
}

describe('buildExportRows', () => {
  const antraege = [
    makeAntrag('A1', { verbund_titel: 'KI-Projekt', titel: 'TV1' }),
    makeAntrag('A2', { verbund_titel: 'Lasertech', titel: 'TV2' }),
    makeAntrag('A3', { verbund_titel: 'Wird abgelehnt', titel: 'TV3' }),
    makeAntrag('A4', { verbund_titel: 'Altes Quartal', titel: 'TV4' }),
  ];

  it('nimmt freigegebene + selbst-Eintraege, ignoriert abgelehnt + andere Quartale', () => {
    const rows = buildExportRows({ data: makeData(), antraege });
    expect(rows.length).toBe(2);
    expect(rows.map(r => r.aktenzeichen).sort()).toEqual(['A1', 'A2']);
  });

  it('Score = 1.0 fuer alle Zuweisungs-Zeilen', () => {
    const rows = buildExportRows({ data: makeData(), antraege });
    expect(rows.every(r => r.score === 1.0)).toBe(true);
  });

  it('haengt pendingMatches als Vorschlaege an (Status vorgeschlagen)', () => {
    const data = makeData();
    // Zuweisungen leeren — A1 ist jetzt offen
    data.zuweisungen = [];
    const matches = new Map<string, MatchResult[]>([
      ['A1', [
        { anonId: 'MA01', bm25Score: 0.8, embeddingScore: 0, kompetenzScore: 0.8, restKapazitaet: 100, quartalsKapazitaet: 400, balanceScore: 0.5, finalScore: 0.7, matchendeTechnologien: [], aehnlicheProjekte: [], matchStufe: 1, confidence: 'high', benoetigteStunden: 10, astMatchCount: 0, astBoost: 0 },
        { anonId: 'MA02', bm25Score: 0.3, embeddingScore: 0, kompetenzScore: 0.3, restKapazitaet: 200, quartalsKapazitaet: 400, balanceScore: 0.5, finalScore: 0.4, matchendeTechnologien: [], aehnlicheProjekte: [], matchStufe: 1, confidence: 'medium', benoetigteStunden: 10, astMatchCount: 0, astBoost: 0 },
      ]],
    ]);
    const rows = buildExportRows({ data, antraege, pendingMatches: matches });
    expect(rows.length).toBe(2);
    expect(rows.every(r => r.status === 'vorgeschlagen')).toBe(true);
    expect(rows.every(r => r.aktenzeichen === 'A1')).toBe(true);
  });

  it('Spalte ma trägt anonyme IDs', () => {
    const rows = buildExportRows({ data: makeData(), antraege });
    for (const r of rows) {
      expect(r.ma).toMatch(/^MA\d{2}$/);
    }
  });

  it('löst VB-Titel/Akronym aus dem verbuende-Store auf (Titel nicht am Antrag) + anzahlTV', () => {
    const data = makeData();
    data.zuweisungen = [
      { antragId: 'A1', anonId: 'MA01', quartal: '2026-Q2', stunden: 36, status: 'freigegeben', anzahlTV: 4 },
    ];
    const antraegeOhneTitel = [makeAntrag('A1', { verbund_id: 'V1', titel: 'TV1-Titel' })]; // KEIN verbund_titel
    const verbuendeById = new Map<string, Verbund>([
      ['V1', { verbund_id: 'V1', programm_id: 'p1', teilantrags_ids: [], titel: 'Verbund-Titel', akronym: 'AKR' } as Verbund],
    ]);
    const rows = buildExportRows({ data, antraege: antraegeOhneTitel, verbuendeById });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.vbTitel).toBe('Verbund-Titel');
    expect(rows[0]?.akronym).toBe('AKR');
    expect(rows[0]?.anzahlTV).toBe(4);
  });

  // ── Eine Zeile pro Verbund (eine Einheit, ein Bearbeiter) ────────────────

  it('buendelt mehrere Zuweisungen desselben Antrags zu EINER Zeile (Freigabe gewinnt vor selbst)', () => {
    const data = makeData();
    // Screenshot-Fall: ein Antrag, zwei Zuweisungen (PG freigegeben + THÜ selbst).
    data.zuweisungen = [
      { antragId: 'A1', anonId: 'MA02', quartal: '2026-Q2', stunden: 9, status: 'selbst', selbstEingetragen: true },
      { antragId: 'A1', anonId: 'MA01', quartal: '2026-Q2', stunden: 9, status: 'freigegeben' },
    ];
    const rows = buildExportRows({ data, antraege });
    const a1 = rows.filter(r => r.aktenzeichen === 'A1');
    expect(a1).toHaveLength(1);
    expect(a1[0]?.ma).toBe('MA01');
    expect(a1[0]?.status).toBe('freigegeben');
  });

  it('buendelt TVs desselben Verbundes (verbund_id) zu EINER Zeile (Freigabe gewinnt)', () => {
    const data = makeData();
    data.zuweisungen = [
      { antragId: 'A1', anonId: 'MA01', quartal: '2026-Q2', stunden: 18, status: 'freigegeben', anzahlTV: 2 },
      { antragId: 'A2', anonId: 'MA02', quartal: '2026-Q2', stunden: 9, status: 'selbst', selbstEingetragen: true },
    ];
    const antr = [
      makeAntrag('A1', { verbund_id: 'V1', titel: 'TV1' }),
      makeAntrag('A2', { verbund_id: 'V1', titel: 'TV2' }),
    ];
    const rows = buildExportRows({ data, antraege: antr });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ma).toBe('MA01');
    expect(rows[0]?.status).toBe('freigegeben');
  });

  it('selbst-only Verbund erscheint als EINE selbst-Zeile', () => {
    const data = makeData();
    data.zuweisungen = [
      { antragId: 'A2', anonId: 'MA02', quartal: '2026-Q2', stunden: 9, status: 'selbst', selbstEingetragen: true },
    ];
    const rows = buildExportRows({ data, antraege });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ma).toBe('MA02');
    expect(rows[0]?.status).toBe('selbst');
  });
});

describe('buildWorkbook', () => {
  it('erzeugt Sheet mit Aktz-Quartal-Name', () => {
    const rows = buildExportRows({ data: makeData(), antraege: [makeAntrag('A1', { verbund_titel: 'X', titel: 'Y' })] });
    const wb = buildWorkbook(rows, '2026-Q2');
    expect(wb.SheetNames[0]).toBe('Auslastung 2026-Q2');
  });

  it('hat 11 Spalten in Header-Zeile (inkl. Akronym + TVs)', () => {
    const rows = buildExportRows({ data: makeData(), antraege: [makeAntrag('A1', { verbund_titel: 'X', titel: 'Y' })] });
    const wb = buildWorkbook(rows, '2026-Q2');
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    // Header in A1..K1
    expect(sheet['A1']?.v).toBe('Aktenzeichen');
    expect(sheet['B1']?.v).toBe('Akronym');
    expect(sheet['E1']?.v).toBe('TVs');
    expect(sheet['K1']?.v).toBe('Status');
  });
});

describe('AnonymMap-Roundtrip', () => {
  it('toReal kann anonyme ID wieder in Kuerzel umwandeln (in-memory only)', () => {
    const map = buildAnonymMapForTests([
      makeAntrag('A1', { tib_kuerz: 'MUE' }),
      makeAntrag('A2', { tib_kuerz: 'SCH' }),
    ]);
    expect(map.toReal.get(map.toAnon.get('MUE')!)).toBe('MUE');
    expect(map.toReal.get(map.toAnon.get('SCH')!)).toBe('SCH');
  });
});
