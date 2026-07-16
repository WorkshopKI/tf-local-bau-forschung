import { describe, it, expect } from 'vitest';
import { parseRecherchePrompt } from '../recherche-prompt';
import { baueMarktzugangText } from '../recherche';

describe('parseRecherchePrompt', () => {
  it('liest schemaVersion + prompt aus einem sauberen JSON-Codeblock', () => {
    const raw = 'Hier:\n```json\n{ "schemaVersion": 1, "prompt": "Recherchiere den Stand der Technik zu Sensorik." }\n```';
    const d = parseRecherchePrompt(raw);
    expect(d).not.toBeNull();
    expect(d?.schemaVersion).toBe(1);
    expect(d?.prompt).toContain('Stand der Technik');
  });

  it('verkraftet das Bridge-Trailing-Artefakt nach dem Codeblock', () => {
    const raw = '```json\n{ "schemaVersion": 1, "prompt": "Auftragstext." }\n```\n :help[]';
    expect(parseRecherchePrompt(raw)?.prompt).toBe('Auftragstext.');
  });

  it('gibt null zurück, wenn kein prompt-Feld da ist', () => {
    expect(parseRecherchePrompt('```json\n{ "schemaVersion": 1 }\n```')).toBeNull();
  });

  it('gibt null bei reinem Fließtext / kaputtem JSON zurück', () => {
    expect(parseRecherchePrompt('Kein JSON hier, nur Prosa.')).toBeNull();
  });
});

describe('baueMarktzugangText', () => {
  it('baut ein deterministisches, identifizierendes Template mit Firmenname', () => {
    const t = baueMarktzugangText({ firmenname: 'Musterfirma GmbH' });
    expect(t).toMatchInlineSnapshot(`
      "Recherchiere den Marktzugang des Unternehmens „Musterfirma GmbH".

      Bitte analysiere:
      - In welchen Märkten und Branchen ist das Unternehmen aktiv?
      - Über welche Vertriebskanäle und Partnerschaften erreicht es seine Kunden?
      - Wer sind typische Abnehmer oder Referenzkunden?
      - Wie positioniert es sich gegenüber Wettbewerbern?"
    `);
  });

  it('nimmt eine Website als zusätzlichen Ausgangspunkt auf', () => {
    const t = baueMarktzugangText({ firmenname: 'Musterfirma GmbH', website: 'https://muster.example' });
    expect(t).toContain('Website als Ausgangspunkt: https://muster.example');
  });

  it('gibt null zurück, wenn kein Firmenname vorliegt', () => {
    expect(baueMarktzugangText({ firmenname: null })).toBeNull();
    expect(baueMarktzugangText({ firmenname: '   ' })).toBeNull();
  });
});
