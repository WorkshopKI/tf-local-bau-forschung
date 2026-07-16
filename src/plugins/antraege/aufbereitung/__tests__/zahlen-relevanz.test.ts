import { describe, it, expect } from 'vitest';
import { parseZahlen } from '../zahlen';

const IDS = ['k-1', 'k-2'];

function block(claimsJson: string): string {
  return '```json\n{ "schemaVersion": 1, "claims": [\n' + claimsJson + '\n] }\n```';
}

describe('parseZahlen — relevanz (Paket 5)', () => {
  it('übernimmt relevanz:"kern"', () => {
    const raw = block('{ "wert": "24 Monate", "kategorie": "zeit", "relevanz": "kern", "sektionIds": ["k-1"] }');
    expect(parseZahlen(raw, IDS)?.claims[0]?.relevanz).toBe('kern');
  });

  it('fällt bei fehlender relevanz auf "detail" zurück (rückwärtskompatibel)', () => {
    const raw = block('{ "wert": "5 Mio €", "kategorie": "kosten", "sektionIds": ["k-2"] }');
    expect(parseZahlen(raw, IDS)?.claims[0]?.relevanz).toBe('detail');
  });

  it('behandelt unbekannte relevanz-Werte als "detail"', () => {
    const raw = block('{ "wert": "3 PM", "kategorie": "personal", "relevanz": "wichtig", "sektionIds": ["k-1"] }');
    expect(parseZahlen(raw, IDS)?.claims[0]?.relevanz).toBe('detail');
  });
});
