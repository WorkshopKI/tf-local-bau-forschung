import { describe, it, expect } from 'vitest';
import {
  ASSISTENT_DEFAULT_WIDTH,
  ASSISTENT_MIN_WIDTH,
  ASSISTENT_TABELLE_MIN,
  clampAssistentWidth,
  effectiveAssistentWidth,
  parseAssistentOpen,
  parseAssistentWidth,
  serializeAssistentOpen,
} from '../assistentPanel';

describe('parseAssistentOpen / serializeAssistentOpen', () => {
  it('nur "1" ist offen', () => {
    expect(parseAssistentOpen('1')).toBe(true);
    expect(parseAssistentOpen('0')).toBe(false);
    expect(parseAssistentOpen(null)).toBe(false);
    expect(parseAssistentOpen('true')).toBe(false);
  });
  it('serialisiert round-trip-fest', () => {
    expect(parseAssistentOpen(serializeAssistentOpen(true))).toBe(true);
    expect(parseAssistentOpen(serializeAssistentOpen(false))).toBe(false);
  });
});

describe('clampAssistentWidth', () => {
  it('klemmt an Floor und dynamischen Max (viewport − Tabellen-Min)', () => {
    expect(clampAssistentWidth(0, 1440)).toBe(ASSISTENT_MIN_WIDTH);
    expect(clampAssistentWidth(9999, 1440)).toBe(1440 - ASSISTENT_TABELLE_MIN); // 1080
    expect(clampAssistentWidth(420, 1440)).toBe(420);
  });
  it('kein fester 560-Deckel mehr — auf breitem Fenster deutlich breiter', () => {
    expect(clampAssistentWidth(1500, 1920)).toBe(1500);
    expect(clampAssistentWidth(9999, 1920)).toBe(1920 - ASSISTENT_TABELLE_MIN); // 1560
  });
});

describe('effectiveAssistentWidth', () => {
  it('deckelt eine breit gespeicherte Breite gegen das aktuelle Fenster', () => {
    expect(effectiveAssistentWidth(9999, 1440)).toBe(1440 - ASSISTENT_TABELLE_MIN); // 1080
    expect(effectiveAssistentWidth(420, 1440)).toBe(420); // passt → unverändert
    expect(effectiveAssistentWidth(1500, 1920)).toBe(1500);
  });
});

describe('parseAssistentWidth', () => {
  it('nimmt gültige Werte ab dem Minimum (kein Oberbound)', () => {
    expect(parseAssistentWidth('420')).toBe(420);
    expect(parseAssistentWidth(String(ASSISTENT_MIN_WIDTH))).toBe(ASSISTENT_MIN_WIDTH);
    expect(parseAssistentWidth('9999')).toBe(9999); // Render-Klemme deckelt später
  });
  it('fällt bei ungültig/zu klein auf den Default', () => {
    expect(parseAssistentWidth(null)).toBe(ASSISTENT_DEFAULT_WIDTH);
    expect(parseAssistentWidth('abc')).toBe(ASSISTENT_DEFAULT_WIDTH);
    expect(parseAssistentWidth('100')).toBe(ASSISTENT_DEFAULT_WIDTH); // < min
  });
});
