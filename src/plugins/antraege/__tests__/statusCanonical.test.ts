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

describe('getStatusCategory — Welt B (CSV-Rohwerte)', () => {
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
    ['NF gestellt', 'nachforderung'],
    ['keine weiteren NF', 'nachforderung'],
    ['bewilligt', 'bewilligt'],
    ['Ablehnung', 'abgelehnt'],
    ['Widerruf', 'abgelehnt'],
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

describe('getStatusCategory — Welt A (Snake-Case)', () => {
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
    'eingereicht', 'in_pruefung', 'in_begutachtung',
    'nachforderung', 'nachbesserung',
  ])('"%s" ist offen', s => {
    expect(isOpenStatus(s)).toBe(true);
  });
  it.each([
    'bewilligt', 'genehmigt',
    'Ablehnung', 'abgelehnt',
    'Schlussvermerk', 'archiviert', 'abgeschlossen', 'abgebrochen',
    'Irrläufer', 'unvollständig', '', undefined,
  ])('"%s" ist NICHT offen', s => {
    expect(isOpenStatus(s)).toBe(false);
  });
});

describe('isBewilligtStatus — deckt Welt-A `genehmigt` + Welt-B `bewilligt` ab', () => {
  it('Welt B "bewilligt" → true', () => expect(isBewilligtStatus('bewilligt')).toBe(true));
  it('Welt A "genehmigt" → true', () => expect(isBewilligtStatus('genehmigt')).toBe(true));
  it('Welt A "bewilligt" → true', () => expect(isBewilligtStatus('bewilligt')).toBe(true));
  it('bewilligungsreif → false (Entscheidungs-Vorbereitung, nicht "bewilligt")', () => {
    expect(isBewilligtStatus('bewilligungsreif')).toBe(false);
  });
  it('Schlussvermerk → false (abgeschlossen, nicht "bewilligt")', () => {
    expect(isBewilligtStatus('Schlussvermerk')).toBe(false);
  });
});

describe('isNachforderungStatus', () => {
  it('Welt B "NF gestellt" → true', () => expect(isNachforderungStatus('NF gestellt')).toBe(true));
  it('Welt B "keine weiteren NF" → true', () => expect(isNachforderungStatus('keine weiteren NF')).toBe(true));
  it('Welt A "nachforderung" → true', () => expect(isNachforderungStatus('nachforderung')).toBe(true));
  it('Welt A "nachbesserung" → true', () => expect(isNachforderungStatus('nachbesserung')).toBe(true));
  it('"in_pruefung" → false', () => expect(isNachforderungStatus('in_pruefung')).toBe(false));
});

describe('isInPruefungStatus', () => {
  it('Welt B "VN geprüft" → true', () => expect(isInPruefungStatus('VN geprüft')).toBe(true));
  it('Welt B "Gutachten fertig" → true', () => expect(isInPruefungStatus('Gutachten fertig')).toBe(true));
  it('Welt A "in_pruefung" → true', () => expect(isInPruefungStatus('in_pruefung')).toBe(true));
  it('Welt A "in_begutachtung" → true', () => expect(isInPruefungStatus('in_begutachtung')).toBe(true));
  it('"bewilligt" → false', () => expect(isInPruefungStatus('bewilligt')).toBe(false));
});

describe('isAbgelehntStatus', () => {
  it('Welt B "Ablehnung" → true', () => expect(isAbgelehntStatus('Ablehnung')).toBe(true));
  it('Welt B "Widerruf" → true', () => expect(isAbgelehntStatus('Widerruf')).toBe(true));
  it('Welt A "abgelehnt" → true', () => expect(isAbgelehntStatus('abgelehnt')).toBe(true));
  it('"abgelehnt/zurückgezogen" → false (Welt B: abgeschlossen, nicht direkt "abgelehnt")', () => {
    expect(isAbgelehntStatus('abgelehnt/zurückgezogen')).toBe(false);
  });
});

describe('isClosedStatus — final entschieden', () => {
  it.each([
    'bewilligt', 'genehmigt',
    'Ablehnung', 'abgelehnt', 'Widerruf',
    'Schlussvermerk', 'beendet', 'abgelehnt/zurückgezogen', 'abgebrochen',
    'archiviert', 'abgeschlossen',
  ])('"%s" ist closed', s => {
    expect(isClosedStatus(s)).toBe(true);
  });
  it.each([
    'beantragt', 'VN geprüft', 'NF gestellt', 'bewilligungsreif',
    'eingereicht', 'in_pruefung', 'nachforderung',
  ])('"%s" ist NICHT closed', s => {
    expect(isClosedStatus(s)).toBe(false);
  });
});
