import { describe, it, expect } from 'vitest';
import {
  classifyProvider,
  erlaubteTransportKlassen,
  skillEnthaeltDokumentInhalte,
  templateReferenziertInhaltsSlot,
} from '../transport-policy';

describe('classifyProvider', () => {
  it('type "openrouter" → extern', () => {
    expect(classifyProvider({ type: 'openrouter' })).toBe('extern');
  });

  it('Endpoint enthält "openrouter" (alter Storage-Eintrag, type !== openrouter) → extern', () => {
    expect(classifyProvider({ type: 'cloud', endpoint: 'https://openrouter.ai/api/v1' })).toBe('extern');
  });

  it('streamlit → intern', () => {
    expect(classifyProvider({ type: 'streamlit', endpoint: 'http://localhost:8501' })).toBe('intern');
  });

  it('lokales llama.cpp → intern', () => {
    expect(classifyProvider({ type: 'cloud', endpoint: 'http://localhost:8080/v1' })).toBe('intern');
  });

  it('ohne Endpoint, harmloser Typ → intern', () => {
    expect(classifyProvider({ type: 'internal' })).toBe('intern');
  });
});

describe('erlaubteTransportKlassen', () => {
  it('dokument-tragend → nur intern', () => {
    expect(erlaubteTransportKlassen({ enthaeltDokumentInhalte: true })).toEqual(['intern']);
  });

  it('inhaltsfrei → intern oder extern', () => {
    expect(erlaubteTransportKlassen({ enthaeltDokumentInhalte: false })).toEqual(['intern', 'extern']);
  });
});

describe('skillEnthaeltDokumentInhalte', () => {
  it('fail-safe Default: kein Inhalts-Slot, kein Flag → true', () => {
    expect(skillEnthaeltDokumentInhalte({ promptTemplate: 'Schreibe einen Witz.' })).toBe(true);
  });

  it('Ableitung schlägt Flag: {{vbMarkdown}} bleibt true trotz Flag=false', () => {
    expect(skillEnthaeltDokumentInhalte({
      promptTemplate: 'Fasse zusammen:\n{{vbMarkdown}}',
      enthaeltDokumentInhalte: false,
    })).toBe(true);
  });

  it('Ableitung schlägt Flag: {{zielText}} (LLM-QS) bleibt true trotz Flag=false', () => {
    expect(skillEnthaeltDokumentInhalte({
      promptTemplate: 'Bewerte:\n{{zielText}}',
      enthaeltDokumentInhalte: false,
    })).toBe(true);
  });

  it('{{stammdaten}} → true', () => {
    expect(skillEnthaeltDokumentInhalte({ promptTemplate: '{{stammdaten}}' })).toBe(true);
  });

  it('{{vorherigeAbschnitte}} → true', () => {
    expect(skillEnthaeltDokumentInhalte({ promptTemplate: 'Kontext:\n{{vorherigeAbschnitte}}' })).toBe(true);
  });

  it('Ableitung schlägt Flag: {{vbRelevant}} (Relevanz-Map) bleibt true trotz Flag=false', () => {
    expect(skillEnthaeltDokumentInhalte({
      promptTemplate: 'Nutze nur:\n{{vbRelevant}}',
      enthaeltDokumentInhalte: false,
    })).toBe(true);
  });

  it('inhaltsfreies Template mit explizitem Flag=false → false (extern erlaubt)', () => {
    expect(skillEnthaeltDokumentInhalte({
      promptTemplate: 'Generiere eine zufällige Begrüßung.',
      enthaeltDokumentInhalte: false,
    })).toBe(false);
  });

  it('inhaltsfreies Template mit explizitem Flag=true → true', () => {
    expect(skillEnthaeltDokumentInhalte({
      promptTemplate: 'Tu etwas Allgemeines.',
      enthaeltDokumentInhalte: true,
    })).toBe(true);
  });

  it('Ableitung schlägt Flag: content-freies promptTemplate, aber {{entwurf}} im lektorPromptTemplate → true trotz Flag=false', () => {
    expect(skillEnthaeltDokumentInhalte({
      promptTemplate: 'Generiere eine zufällige Begrüßung.',
      lektorPromptTemplate: 'Überarbeite:\n{{entwurf}}',
      enthaeltDokumentInhalte: false,
    })).toBe(true);
  });
});

describe('templateReferenziertInhaltsSlot', () => {
  it('Inhalts-Slot vorhanden → true', () => {
    expect(templateReferenziertInhaltsSlot('x {{vbMarkdown}} y')).toBe(true);
    expect(templateReferenziertInhaltsSlot('{{zielText}}')).toBe(true);
    expect(templateReferenziertInhaltsSlot('{{vbRelevant}}')).toBe(true);
  });

  it('kein Inhalts-Slot → false', () => {
    expect(templateReferenziertInhaltsSlot('Schreibe einen Witz.')).toBe(false);
    expect(templateReferenziertInhaltsSlot('{{abschnittszweck}}')).toBe(false);
  });
});
