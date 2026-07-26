/**
 * Ableitung von QS-Abnahme-Kriterien aus der Prompt-Vorlage: reiner Prompt-Bau +
 * toleranter Parse. Die harte Invariante — die Ableitung SPEICHERT nichts, sie
 * schlägt nur vor — ist hier als Rückgabe-Kontrakt festgenagelt: die Funktion
 * liefert eine Liste und fasst keinen Draft/keine Registry an.
 */
import { describe, it, expect } from 'vitest';
import {
  buildAbleitungsPrompt, parseKriterienVorschlaege, leiteQsKriterienAb, MAX_VORSCHLAEGE,
} from '../qsKriterienAbleitung';
import type { AITransport } from '@/core/services/ai/transports/streamlit';

describe('buildAbleitungsPrompt', () => {
  it('traegt Skill-Name und Vorlage und verbietet Umfangs-Zahlen', () => {
    const p = buildAbleitungsPrompt('Kurzfassung', 'Schreibe den Abschnitt.');
    expect(p).toContain('Kurzfassung');
    expect(p).toContain('Schreibe den Abschnitt.');
    expect(p).toContain('Keine Zeichen-, Wort- oder Satzzahlen');
  });
});

describe('parseKriterienVorschlaege', () => {
  it('liest Aufzaehlungen und wirft die Marker weg', () => {
    expect(parseKriterienVorschlaege('- Aussagen belegt\n* Risiken konkret\n• Ton sachlich')).toEqual([
      'Aussagen belegt', 'Risiken konkret', 'Ton sachlich',
    ]);
  });

  it('wirft Nummerierungen weg und ueberspringt Ueberschriften ganz', () => {
    expect(parseKriterienVorschlaege('## Kriterien\n1. Aussagen belegt\n2) Risiken konkret')).toEqual([
      'Aussagen belegt', 'Risiken konkret',
    ]);
  });

  it('verwirft zu kurze und zu lange Zeilen', () => {
    const lang = 'x'.repeat(200);
    expect(parseKriterienVorschlaege(`- ok\n- ${lang}\n- Aussagen belegt`)).toEqual(['Aussagen belegt']);
  });

  it('dedupliziert unabhaengig von Gross-/Kleinschreibung', () => {
    expect(parseKriterienVorschlaege('- Aussagen belegt\n- aussagen belegt')).toEqual(['Aussagen belegt']);
  });

  it('kappt bei MAX_VORSCHLAEGE', () => {
    const viele = Array.from({ length: 20 }, (_, i) => `- Kriterium Nummer ${i}`).join('\n');
    expect(parseKriterienVorschlaege(viele)).toHaveLength(MAX_VORSCHLAEGE);
  });

  it('leere / unbrauchbare Antwort → leere Liste (nie Throw)', () => {
    expect(parseKriterienVorschlaege('')).toEqual([]);
    expect(parseKriterienVorschlaege('   \n\n  ')).toEqual([]);
  });
});

/** Minimaler Transport-Doppelgaenger; nur was `leiteQsKriterienAb` anfasst. */
function transport(over: Partial<AITransport> & { name: string }): AITransport {
  return {
    ping: async () => true,
    submitMessage: async () => '- Aussagen belegt',
    ...over,
  } as AITransport;
}

describe('leiteQsKriterienAb — Invarianten', () => {
  it('laeuft NUR auf der internen KI (Prompt-Vorlagen sind dokumentnah)', async () => {
    const extern = transport({ name: 'OpenRouter' });
    expect(await leiteQsKriterienAb(extern, 'S', 'Vorlage')).toBeNull();
  });

  it('leere Vorlage → null (nichts abzuleiten)', async () => {
    expect(await leiteQsKriterienAb(transport({ name: 'Streamlit' }), 'S', '   ')).toBeNull();
  });

  it('KI nicht erreichbar → null statt Fehler', async () => {
    const weg = transport({ name: 'Streamlit', ping: async () => false });
    expect(await leiteQsKriterienAb(weg, 'S', 'Vorlage')).toBeNull();
  });

  it('wirft nie — ein Transport-Fehler wird zu null', async () => {
    const kaputt = transport({
      name: 'Streamlit',
      submitMessage: async () => { throw new Error('Bridge weg'); },
    });
    expect(await leiteQsKriterienAb(kaputt, 'S', 'Vorlage')).toBeNull();
  });

  it('unbrauchbare Antwort → null (kein leeres Vorschlags-Panel)', async () => {
    const wirr = transport({ name: 'Streamlit', submitMessage: async () => 'Hm.' });
    expect(await leiteQsKriterienAb(wirr, 'S', 'Vorlage')).toBeNull();
  });

  it('Erfolg liefert NUR die Vorschlagsliste zurueck — gespeichert wird nichts', async () => {
    const ok = transport({
      name: 'Streamlit',
      submitMessage: async () => '- Aussagen durch den Antrag belegt\n- Risiken auf den Loesungsweg bezogen',
    });
    expect(await leiteQsKriterienAb(ok, 'S', 'Vorlage')).toEqual([
      'Aussagen durch den Antrag belegt', 'Risiken auf den Loesungsweg bezogen',
    ]);
  });
});
