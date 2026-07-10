/**
 * Byte-Identitäts-Guard des geteilten Grundsatz-Blocks.
 *
 * `GRUNDSATZ_REGELN` wurde aus `seed.ts` extrahiert (früher zweifach inline). Die
 * Journey-Paket-4-Rollout-Migration vergleicht den Share-Stand byte-genau gegen
 * `buildKurzfassungPrompt(false)` — ändert sich der Block auch nur um ein Zeichen,
 * mis-triggert die Migration und überschreibt kuratierte Edits. Dieser Test pinnt
 * den exakten Wortlaut und stellt sicher, dass beide Seed-Builder ihn unverändert
 * einbetten.
 */
import { describe, expect, it } from 'vitest';
import { GRUNDSATZ_REGELN } from '../grundsatz';
import { abschnittTemplate, buildKurzfassungPrompt } from '../seed';

const ERWARTET = [
  'Regeln:',
  '- **Streng quellenbasiert:** Nutze ausschließlich Inhalte der VB. Erfinde nichts.',
  '- Fehlende Angaben kennzeichne wörtlich mit „[Im Antrag nicht genannt]".',
  '- **Aktiver Stil:** Formuliere „Das Vorhaben…" statt „Der Antragsteller plant…". Keine Arbeitspaket-Verweise („AP1").',
].join('\n');

describe('GRUNDSATZ_REGELN', () => {
  it('hat exakt den erwarteten Wortlaut (Byte-Identität)', () => {
    expect(GRUNDSATZ_REGELN).toBe(ERWARTET);
  });

  it('ist wortgetreu im Kurzfassungs-Template (A) eingebettet', () => {
    expect(buildKurzfassungPrompt(false)).toContain(GRUNDSATZ_REGELN);
  });

  it('ist wortgetreu im Abschnitts-Template (B–G) eingebettet', () => {
    const t = abschnittTemplate({ name: 'Test', aufgabe: 'Tu etwas.', formatRegeln: ['R1'], finalText: 'FT' });
    expect(t).toContain(GRUNDSATZ_REGELN);
  });
});
