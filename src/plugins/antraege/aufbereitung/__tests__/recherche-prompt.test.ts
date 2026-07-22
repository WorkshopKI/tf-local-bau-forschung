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
  const block = (inhalt: string): string => `Hier:\n\`\`\`json\n${inhalt}\n\`\`\``;

  it('liest die Stichworte und baut den Auftrag daraus', () => {
    const d = parseRecherchePrompt(block(
      '{"schemaVersion": 1, "themenfeld": "Agentenbasierte Simulation", "technologien": ["Multi-Agenten-Systeme", "Sprachmodelle"]}',
    ));
    expect(d).not.toBeNull();
    expect(d?.stichworte.themenfeld).toBe('Agentenbasierte Simulation');
    expect(d?.stichworte.technologien).toEqual(['Multi-Agenten-Systeme', 'Sprachmodelle']);
    // Der Auftragstext kommt aus der Vorlage, nicht aus der Modell-Antwort.
    expect(d?.prompt).toContain('Teil 1 — Stand der Technik');
    expect(d?.prompt).toContain('Agentenbasierte Simulation');
  });

  it('verwirft Zahlwerte aus den Stichworten und zählt sie', () => {
    const d = parseRecherchePrompt(block(
      '{"themenfeld": "Agentensimulation", "leistungsdimensionen": ["Latenz", "hoechstens 10 s Antwortzeit"], "marktsegmente": ["Mittelstand"]}',
    ));
    expect(d?.stichworte.leistungsdimensionen).toEqual(['Latenz']);
    expect(d?.entfernt).toBe(1);
    expect(d?.prompt).not.toContain('10 s');
  });

  it('verwirft identifizierende Stichworte', () => {
    const d = parseRecherchePrompt(
      block('{"themenfeld": "Agentensimulation", "marktsegmente": ["Musterfirma GmbH", "Maschinenbau"]}'),
      { antragsteller: 'Musterfirma GmbH' },
    );
    expect(d?.stichworte.marktsegmente).toEqual(['Maschinenbau']);
    expect(d?.prompt).not.toContain('Musterfirma');
  });

  it('verkraftet das Bridge-Trailing-Artefakt nach dem Codeblock', () => {
    const raw = '```json\n{"themenfeld": "Sensorik"}\n```\n :help[]';
    expect(parseRecherchePrompt(raw)?.stichworte.themenfeld).toBe('Sensorik');
  });

  it('gibt null zurück, wenn kein Feld etwas hergibt', () => {
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
