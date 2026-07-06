import { describe, it, expect } from 'vitest';
import {
  ASSISTENT_DEFAULT_WIDTH,
  ASSISTENT_MAX_WIDTH,
  ASSISTENT_MIN_WIDTH,
  clampAssistentWidth,
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
  it('klemmt an die Grenzen', () => {
    expect(clampAssistentWidth(0)).toBe(ASSISTENT_MIN_WIDTH);
    expect(clampAssistentWidth(9999)).toBe(ASSISTENT_MAX_WIDTH);
    expect(clampAssistentWidth(420)).toBe(420);
  });
});

describe('parseAssistentWidth', () => {
  it('nimmt gültige Werte im Bereich', () => {
    expect(parseAssistentWidth('420')).toBe(420);
    expect(parseAssistentWidth(String(ASSISTENT_MIN_WIDTH))).toBe(ASSISTENT_MIN_WIDTH);
    expect(parseAssistentWidth(String(ASSISTENT_MAX_WIDTH))).toBe(ASSISTENT_MAX_WIDTH);
  });
  it('fällt bei ungültig/außerhalb auf den Default', () => {
    expect(parseAssistentWidth(null)).toBe(ASSISTENT_DEFAULT_WIDTH);
    expect(parseAssistentWidth('abc')).toBe(ASSISTENT_DEFAULT_WIDTH);
    expect(parseAssistentWidth('100')).toBe(ASSISTENT_DEFAULT_WIDTH); // < min
    expect(parseAssistentWidth('9999')).toBe(ASSISTENT_DEFAULT_WIDTH); // > max
  });
});
