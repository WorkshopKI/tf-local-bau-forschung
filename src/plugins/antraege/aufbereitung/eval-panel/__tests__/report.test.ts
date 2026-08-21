import { describe, it, expect } from 'vitest';
import { formatEvalReport, type ReportMeta } from '../report';
import type { AufbereitungEvalErgebnis } from '../runner';

/** Minimales ok-Ergebnis (ein Fixture, Aspekte gemessen). */
const ERGEBNIS: AufbereitungEvalErgebnis = {
  fixtures: [
    {
      vbFile: 'FIX1',
      gefunden: true,
      dauerMs: 1200,
      aspekte: {
        status: 'ok',
        metrik: { precision: 1, recall: 1, f1: 1, treffer: 2, goldPaare: 2, predAufGold: 2 },
        fehlzuordnungen: [],
        chatResetStatus: 'ok',
      },
    },
  ],
  zusammenfassung: {
    fixtures: 1, makroPrecision: 1, makroRecall: 1, mikroPrecision: 1, mikroRecall: 1, mikroF1: 1,
  },
  wiederholungen: 1,
  abgebrochen: false,
};

const META_INTERN: ReportMeta = {
  zeitpunkt: '11.07.2026, 12:00:00',
  transportName: 'Streamlit',
  steckbriefEingeschlossen: false,
};

describe('formatEvalReport — Transport-Zeile (OpenRouter-Modus)', () => {
  it('ohne modell: das interne Format nennt das Modell', () => {
    const report = formatEvalReport(ERGEBNIS, META_INTERN);
    expect(report).toContain('- Transport: Streamlit · gpt-oss-120b');
    expect(report).not.toContain('extern');
  });

  it('mit ziel qwen35: Qwen-Etikett', () => {
    const report = formatEvalReport(ERGEBNIS, { ...META_INTERN, ziel: 'stark' });
    expect(report).toContain('- Transport: Streamlit · Qwen3.6-35B');
  });

  it('mit modell: OpenRouter-Zeile mit Modell-Slug + extern-Kennzeichnung', () => {
    const report = formatEvalReport(ERGEBNIS, {
      ...META_INTERN,
      transportName: 'OpenRouter',
      modell: 'anthropic/claude-sonnet-4.6',
    });
    expect(report).toContain('- Transport: OpenRouter · anthropic/claude-sonnet-4.6 (extern, fiktive Fixtures)');
    // Das Ziel-Tab-Etikett (Bridge-Begriff) taucht bei externen Läufen nicht auf.
    expect(report).not.toContain('Standard-Chat (gpt-oss)');
  });

  it('modell gewinnt über ziel (ziel wird bei externen Läufen ignoriert)', () => {
    const report = formatEvalReport(ERGEBNIS, {
      ...META_INTERN,
      transportName: 'OpenRouter',
      modell: 'anthropic/claude-sonnet-4.6',
      ziel: 'stark',
    });
    expect(report).toContain('(extern, fiktive Fixtures)');
    expect(report).not.toContain('agentisch (Qwen, 259k)');
  });
});
