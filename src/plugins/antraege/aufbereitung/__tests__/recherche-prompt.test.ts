import { describe, it, expect } from 'vitest';
import { normalisiereAuftragstext, parseRecherchePrompt, pruefeBearbeitetenPrompt } from '../recherche-prompt';
import { baueMarktzugangText } from '../recherche';

describe('normalisiereAuftragstext', () => {
  it('macht literale \\n zu echten Zeilenumbrüchen', () => {
    const roh = 'Deep-Research-Auftrag:\\n\\n1. Stand der Technik\\n- Überblick';
    expect(normalisiereAuftragstext(roh)).toBe('Deep-Research-Auftrag:\n\n1. Stand der Technik\n- Überblick');
  });

  it('behandelt \\r\\n und \\t mit', () => {
    expect(normalisiereAuftragstext('a\\r\\nb\\tc')).toBe('a\nb\tc');
  });

  it('lässt echte Umbrüche und Text ohne Escapes unverändert', () => {
    const text = 'Zeile eins\nZeile zwei\n- Punkt';
    expect(normalisiereAuftragstext(text)).toBe(text);
  });

  it('ist idempotent (zweimal angewandt = einmal)', () => {
    const roh = 'a\\nb\\n\\nc';
    const einmal = normalisiereAuftragstext(roh);
    expect(normalisiereAuftragstext(einmal)).toBe(einmal);
  });
});

describe('parseRecherchePrompt', () => {
  it('normalisiert einen doppelt escapten Auftragstext', () => {
    // Praxis-Fall: das Modell schreibt `\\n` in den JSON-String, nach JSON.parse
    // bleiben die zwei Zeichen `\` + `n` stehen.
    const raw = '```json\n{ "schemaVersion": 1, "prompt": "Auftrag:\\\\n\\\\n1. Stand der Technik\\\\n- Verfahren" }\n```';
    const d = parseRecherchePrompt(raw);
    expect(d?.prompt).toBe('Auftrag:\n\n1. Stand der Technik\n- Verfahren');
  });

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

describe('pruefeBearbeitetenPrompt', () => {
  const werte = { antragsteller: 'Musterfirma GmbH', foerderkennzeichen: 'ZF4711901AB3' };

  it('gibt keine Treffer für einen sauberen Auftragstext', () => {
    const t = 'Recherchiere den Stand der Technik zu simulationsbasierter Change-Begleitung.';
    expect(pruefeBearbeitetenPrompt(t, werte).leaks).toEqual([]);
  });

  it('findet einen von Hand eingefügten Firmennamen', () => {
    const t = 'Recherchiere die Wettbewerber der Musterfirma GmbH im Mittelstand.';
    expect(pruefeBearbeitetenPrompt(t, werte).leaks).toContain('Musterfirma GmbH');
  });

  it('meldet jeden Trefferwert nur einmal', () => {
    const t = 'Musterfirma und nochmal Musterfirma.';
    expect(pruefeBearbeitetenPrompt(t, werte).leaks.filter(l => l === 'Musterfirma')).toHaveLength(1);
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
