import { describe, it, expect } from 'vitest';
import { AUFBEREITUNG_ZIEL, bestimmeLaufZiel } from '../lauf-ziel';

/** Realistische Caps (62k/262k Token → Zeichen), damit die Fälle sprechend bleiben. */
const STANDARD_CAP = 238_617;
const AGENTISCH_CAP = 1_198_617;

const lage = (zeichen: number | null, agentischErzwungen = false) =>
  bestimmeLaufZiel({ zeichen, standardCap: STANDARD_CAP, agentischCap: AGENTISCH_CAP, agentischErzwungen });

describe('bestimmeLaufZiel', () => {
  it('ohne Notausfahrt immer die Standard-KI (unabhängig von der globalen Variante)', () => {
    expect(AUFBEREITUNG_ZIEL).toBe('standard');
    expect(lage(50_000).ziel).toBe('standard');
    expect(lage(900_000).ziel).toBe('standard'); // auch ein Riesen-Korpus schaltet NICHT von selbst um
  });

  it('misst gegen den Cap des tatsächlich genutzten Ziels', () => {
    expect(lage(50_000).cap).toBe(STANDARD_CAP);
    expect(lage(50_000, true).cap).toBe(AGENTISCH_CAP);
  });

  it('Notausfahrt wird erst angeboten, wenn der Korpus das Standard-Fenster sprengt', () => {
    expect(lage(STANDARD_CAP).notausfahrtAnbieten).toBe(false);
    expect(lage(STANDARD_CAP + 1).notausfahrtAnbieten).toBe(true);
  });

  it('Notausfahrt bleibt sichtbar, WÄHREND sie genutzt wird (sonst gäbe es keinen Weg zurück)', () => {
    const l = lage(STANDARD_CAP + 1, true);
    expect(l.ziel).toBe('agentisch');
    expect(l.notausfahrtAnbieten).toBe(true);
  });

  it('unaufgelöster Korpus: kein Angebot, aber unverändertes Ziel', () => {
    expect(lage(null)).toEqual({ ziel: 'standard', cap: STANDARD_CAP, notausfahrtAnbieten: false });
  });
});
