import { describe, it, expect } from 'vitest';
import {
  getStatusCategory,
  isOpenStatus,
  isInPruefungStatus,
  isNachforderungStatus,
  isBewilligtStatus,
  isAbgelehntStatus,
  isClosedStatus,
} from '@/core/utils/status-canonical';

describe('getStatusCategory — Foerderantraege (CSV-Rohwerte)', () => {
  it.each([
    ['beantragt', 'offen'],
    ['bearbeitungsreif', 'offen'],
    ['NL eingegangen', 'offen'],
    ['VN geprüft', 'in_pruefung'],
    ['VN techn. geprüft', 'in_pruefung'],
    ['techn geprüft', 'in_pruefung'],
    ['kaufm geprüft', 'in_pruefung'],
    ['Gutachten fertig', 'in_pruefung'],
    ['bewilligungsreif', 'entscheidung'],
    ['ablehnungsreif', 'entscheidung'],
    ['Bewilligungsentwurf VDI/VDE-IT', 'entscheidung'],
    // Ablehnung + Widerruf zaehlen als entscheidung (noch im Verfahren), NICHT
    // als final-abgelehnt — Foerderantraege haben keinen final-`abgelehnt`-
    // Endzustand; negativ-final landet in `abgelehnt/zurueckgezogen` (abgeschlossen).
    ['Ablehnung', 'entscheidung'],
    ['Widerruf', 'entscheidung'],
    ['Anhörung zum Widerruf', 'entscheidung'],
    ['Rücknahmeempfehlung', 'entscheidung'],
    ['NF gestellt', 'nachforderung'],
    ['keine weiteren NF', 'nachforderung'],
    ['bewilligt', 'bewilligt'],
    ['Schlussvermerk', 'abgeschlossen'],
    ['beendet', 'abgeschlossen'],
    ['abgelehnt/zurückgezogen', 'abgeschlossen'],
    ['abgebrochen', 'abgeschlossen'],
    ['Irrläufer', 'sonstige'],
    ['unvollständig', 'sonstige'],
  ] as const)('"%s" → %s', (raw, expected) => {
    expect(getStatusCategory(raw)).toBe(expected);
  });
});

describe('getStatusCategory — Bauantraege (Snake-Case)', () => {
  it.each([
    ['neu', 'offen'],
    ['eingereicht', 'offen'],
    ['in_pruefung', 'in_pruefung'],
    ['in_begutachtung', 'in_pruefung'],
    ['in_bearbeitung', 'in_pruefung'],
    ['nachforderung', 'nachforderung'],
    ['nachbesserung', 'nachforderung'],
    ['genehmigt', 'bewilligt'],
    ['bewilligt', 'bewilligt'],
    ['abgelehnt', 'abgelehnt'],
    ['archiviert', 'abgeschlossen'],
    ['abgeschlossen', 'abgeschlossen'],
  ] as const)('"%s" → %s', (raw, expected) => {
    expect(getStatusCategory(raw)).toBe(expected);
  });
});

describe('getStatusCategory — Edge-Cases', () => {
  it('undefined → sonstige', () => {
    expect(getStatusCategory(undefined)).toBe('sonstige');
  });
  it('null → sonstige', () => {
    expect(getStatusCategory(null)).toBe('sonstige');
  });
  it('leerer String → sonstige', () => {
    expect(getStatusCategory('')).toBe('sonstige');
  });
  it('nur Whitespace → sonstige', () => {
    expect(getStatusCategory('   ')).toBe('sonstige');
  });
  it('unbekannter Wert → sonstige', () => {
    expect(getStatusCategory('fantasieStatus42')).toBe('sonstige');
  });
  it('Number statt String → sonstige', () => {
    expect(getStatusCategory(42 as unknown)).toBe('sonstige');
  });
  it('Case-Insensitivity: BEWILLIGT', () => {
    expect(getStatusCategory('BEWILLIGT')).toBe('bewilligt');
  });
  it('Case-Insensitivity: NF Gestellt', () => {
    expect(getStatusCategory('NF Gestellt')).toBe('nachforderung');
  });
  it('Whitespace-Toleranz: "  bewilligt  "', () => {
    expect(getStatusCategory('  bewilligt  ')).toBe('bewilligt');
  });
});

describe('isOpenStatus — deckt offen + in_pruefung + nachforderung + entscheidung ab', () => {
  it.each([
    'beantragt', 'bearbeitungsreif', 'NL eingegangen',
    'VN geprüft', 'kaufm geprüft', 'Gutachten fertig',
    'NF gestellt', 'keine weiteren NF',
    'bewilligungsreif', 'ablehnungsreif',
    // Ablehnung/Widerruf sind noch im Verfahren, nicht final-abgelehnt
    'Ablehnung', 'Widerruf', 'Anhörung zum Widerruf',
    'eingereicht', 'in_pruefung', 'in_begutachtung',
    'nachforderung', 'nachbesserung',
  ])('"%s" ist offen', s => {
    expect(isOpenStatus(s)).toBe(true);
  });
  it.each([
    'bewilligt', 'genehmigt',
    // Nur Bauantrag-`abgelehnt` ist final-abgelehnt (offen=false)
    'abgelehnt',
    'Schlussvermerk', 'archiviert', 'abgeschlossen', 'abgebrochen',
    'abgelehnt/zurückgezogen',
    'Irrläufer', 'unvollständig', '', undefined,
  ])('"%s" ist NICHT offen', s => {
    expect(isOpenStatus(s)).toBe(false);
  });
});

describe('isBewilligtStatus — deckt Bauantrag-`genehmigt` + Foerderantrag-`bewilligt` ab', () => {
  it('Foerderantrag "bewilligt" → true', () => expect(isBewilligtStatus('bewilligt')).toBe(true));
  it('Bauantrag "genehmigt" → true', () => expect(isBewilligtStatus('genehmigt')).toBe(true));
  it('Bauantrag "bewilligt" → true', () => expect(isBewilligtStatus('bewilligt')).toBe(true));
  it('bewilligungsreif → false (Entscheidungs-Vorbereitung, nicht "bewilligt")', () => {
    expect(isBewilligtStatus('bewilligungsreif')).toBe(false);
  });
  it('Schlussvermerk → false (abgeschlossen, nicht "bewilligt")', () => {
    expect(isBewilligtStatus('Schlussvermerk')).toBe(false);
  });
});

describe('isNachforderungStatus', () => {
  it('Foerderantrag "NF gestellt" → true', () => expect(isNachforderungStatus('NF gestellt')).toBe(true));
  it('Foerderantrag "keine weiteren NF" → true', () => expect(isNachforderungStatus('keine weiteren NF')).toBe(true));
  it('Bauantrag "nachforderung" → true', () => expect(isNachforderungStatus('nachforderung')).toBe(true));
  it('Bauantrag "nachbesserung" → true', () => expect(isNachforderungStatus('nachbesserung')).toBe(true));
  it('"in_pruefung" → false', () => expect(isNachforderungStatus('in_pruefung')).toBe(false));
});

describe('isInPruefungStatus', () => {
  it('Foerderantrag "VN geprüft" → true', () => expect(isInPruefungStatus('VN geprüft')).toBe(true));
  it('Foerderantrag "Gutachten fertig" → true', () => expect(isInPruefungStatus('Gutachten fertig')).toBe(true));
  it('Bauantrag "in_pruefung" → true', () => expect(isInPruefungStatus('in_pruefung')).toBe(true));
  it('Bauantrag "in_begutachtung" → true', () => expect(isInPruefungStatus('in_begutachtung')).toBe(true));
  it('"bewilligt" → false', () => expect(isInPruefungStatus('bewilligt')).toBe(false));
});

describe('isAbgelehntStatus — nur Bauantrag-Domain hat einen final-abgelehnt-Status', () => {
  it('Bauantrag "abgelehnt" → true', () => expect(isAbgelehntStatus('abgelehnt')).toBe(true));
  it('Foerderantrag "Ablehnung" → false (noch im Verfahren, nicht final)', () => {
    expect(isAbgelehntStatus('Ablehnung')).toBe(false);
  });
  it('Foerderantrag "Widerruf" → false (noch im Verfahren, nicht final)', () => {
    expect(isAbgelehntStatus('Widerruf')).toBe(false);
  });
  it('"abgelehnt/zurückgezogen" → false (Foerderantrag: Kategorie abgeschlossen)', () => {
    expect(isAbgelehntStatus('abgelehnt/zurückgezogen')).toBe(false);
  });
});

describe('isClosedStatus — final entschieden (bewilligt + abgelehnt + abgeschlossen)', () => {
  it.each([
    // bewilligt (final)
    'bewilligt', 'genehmigt',
    // Nur Bauantrag-`abgelehnt` ist final-abgelehnt
    'abgelehnt',
    // abgeschlossen (final)
    'Schlussvermerk', 'beendet', 'abgelehnt/zurückgezogen', 'abgebrochen',
    'archiviert', 'abgeschlossen',
  ])('"%s" ist closed', s => {
    expect(isClosedStatus(s)).toBe(true);
  });
  it.each([
    'beantragt', 'VN geprüft', 'NF gestellt', 'bewilligungsreif',
    'eingereicht', 'in_pruefung', 'nachforderung',
    // Ablehnung/Widerruf sind NICHT closed — sie sind noch im Entscheidungs-Verfahren
    'Ablehnung', 'Widerruf', 'Anhörung zum Widerruf', 'Rücknahmeempfehlung',
  ])('"%s" ist NICHT closed', s => {
    expect(isClosedStatus(s)).toBe(false);
  });
});
