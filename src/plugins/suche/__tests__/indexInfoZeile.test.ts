import { describe, it, expect } from 'vitest';
import { buildIndexInfoText } from '../IndexInfoZeile';

describe('buildIndexInfoText', () => {
  it('zeigt bei leerem Index NIE „0 Textabschnitte" (Segment fällt weg)', () => {
    const text = buildIndexInfoText(0, 14069);
    expect(text).not.toContain('Textabschnitte');
    expect(text).not.toContain('0 Text');
    expect(text).toContain('Anträge geladen');
  });

  it('zeigt bei vorhandenem Index beide Segmente', () => {
    const text = buildIndexInfoText(3200, 14069);
    expect(text).toContain('Textabschnitte im Index');
    expect(text).toContain('Anträge geladen');
    expect(text).toContain('·');
  });

  it('nennt die Antragszahl immer', () => {
    expect(buildIndexInfoText(0, 0)).toContain('Anträge geladen');
    expect(buildIndexInfoText(5, 0)).toContain('Anträge geladen');
  });
});
