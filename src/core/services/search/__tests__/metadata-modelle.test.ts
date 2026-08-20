/**
 * Welche Modelle das Aufklappmenü „Metadaten-Extraktion" anbietet — und was aus
 * einer gespeicherten Auswahl wird, die es in dieser Variante nicht mehr gibt.
 *
 * Die Flags kommen als Parameter herein (Default-Parameter der Funktionen), damit
 * der Test ohne Modul-Mock auskommt und keine Isolation braucht.
 */
import { describe, it, expect } from 'vitest';
import {
  METADATA_LLM_MODELS,
  verfuegbareMetadataModelle,
  normalisiereMetadataLLMId,
} from '../metadata-extractor';

const ids = (direktApi: boolean, openRouter: boolean): string[] =>
  verfuegbareMetadataModelle(direktApi, openRouter).map(m => m.id);

describe('metadaten-modelle-je-variante', () => {
  it('pl/prod: die beiden Einträge mit Adresse aus dem ai-provider fehlen', () => {
    expect(ids(false, false)).toEqual([
      'llamacpp-local', 'llamacpp-lan', 'browser-nemotron', 'none',
    ]);
  });

  it('dev: beide Einträge sind da', () => {
    expect(ids(true, true)).toEqual(METADATA_LLM_MODELS.map(m => m.id));
  });

  it('OpenRouter bleibt weg, wo der Transport abgeschaltet ist (z.B. local)', () => {
    const gesehen = ids(true, false);
    expect(gesehen).toContain('intern-gpt-oss');
    expect(gesehen).not.toContain('openrouter-gpt-oss');
  });

  it('die lokalen Wege und "kein LLM" hängen an keinem Flag', () => {
    for (const id of ['llamacpp-local', 'llamacpp-lan', 'browser-nemotron', 'none']) {
      expect(ids(false, false)).toContain(id);
    }
  });
});

describe('metadaten-auswahl-normalisieren', () => {
  const plModelle = verfuegbareMetadataModelle(false, false);

  it('eine in dieser Variante fehlende Auswahl zählt als "none"', () => {
    expect(normalisiereMetadataLLMId('intern-gpt-oss', plModelle)).toBe('none');
    expect(normalisiereMetadataLLMId('openrouter-gpt-oss', plModelle)).toBe('none');
  });

  it('eine angebotene Auswahl bleibt unangetastet', () => {
    expect(normalisiereMetadataLLMId('llamacpp-local', plModelle)).toBe('llamacpp-local');
    expect(normalisiereMetadataLLMId('none', plModelle)).toBe('none');
  });

  it('fehlender oder unbekannter Wert zählt als "none"', () => {
    expect(normalisiereMetadataLLMId(undefined, plModelle)).toBe('none');
    expect(normalisiereMetadataLLMId(null, plModelle)).toBe('none');
    expect(normalisiereMetadataLLMId('', plModelle)).toBe('none');
    expect(normalisiereMetadataLLMId('gibt-es-nicht', plModelle)).toBe('none');
  });

  it('in dev bleibt die Auswahl der beiden API-Wege erhalten', () => {
    const devModelle = verfuegbareMetadataModelle(true, true);
    expect(normalisiereMetadataLLMId('intern-gpt-oss', devModelle)).toBe('intern-gpt-oss');
    expect(normalisiereMetadataLLMId('openrouter-gpt-oss', devModelle)).toBe('openrouter-gpt-oss');
  });
});
