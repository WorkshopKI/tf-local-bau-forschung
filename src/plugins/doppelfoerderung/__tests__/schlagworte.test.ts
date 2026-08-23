/**
 * Prompt und Parser der Schlagwort-Stufe.
 *
 * Der Parser muss ertragen, was ein Modell wirklich liefert: sauberes JSON, JSON
 * im Markdown-Zaun, JSON mit Erläuterung davor — und im Zweifel eine Aufzählung
 * in Prosa. Ein Retry gibt es bewusst nicht (Pflicht 6 des einschüssigen Laufs),
 * also muss der erste Lauf so viel wie möglich retten.
 */
import { describe, it, expect } from 'vitest';
import {
  baueSchlagwortPrompt, parseSchlagworte, MIN_SCHLAGWORT_LEN,
  SCHLAGWORT_ANZAHL, ZU_WEITE_WOERTER,
} from '@/plugins/doppelfoerderung/services/schlagworte';

describe('baueSchlagwortPrompt', () => {
  it('benennt die verbotenen Allerweltswörter, statt „sei spezifisch" zu sagen', () => {
    const { systemPrompt } = baueSchlagwortPrompt('Thema', 'Beschreibung');
    for (const wort of ZU_WEITE_WOERTER) expect(systemPrompt).toContain(wort);
  });

  it('nennt die gemessene Begründung, nicht nur die Regel', () => {
    const { systemPrompt } = baueSchlagwortPrompt('Thema', 'Beschreibung');
    expect(systemPrompt).toContain('75 %');
  });

  /**
   * Die zweite Staffel stammt aus dem Durchlauf über die 72er-Liste: Wörter,
   * die über einem Prozent des Betrachtungsbereichs liegen und die Branche
   * benennen statt des Vorhabens. Sie stehen hier namentlich, weil sie ohne
   * diesen Test wieder herausfallen könnten — sie klingen fachlich.
   */
  it('verbietet auch die nachgemessenen Sammelbegriffe', () => {
    for (const wort of ['Automatisierung', 'Maschinenbau', 'Medizintechnik',
      'Additive Fertigung', 'Logistik', 'Maschinelles Lernen', 'Demonstrator']) {
      expect(ZU_WEITE_WOERTER).toContain(wort);
    }
  });

  it('verbietet keinen fachlich engen Begriff, nur weil er häufig ist', () => {
    // „Kreislaufwirtschaft" trug 1,8 % des Bereichs — häufig, aber es benennt
    // eine Sache. Die Marke am Chip weist darauf hin, das Verbot nicht.
    expect(ZU_WEITE_WOERTER).not.toContain('Kreislaufwirtschaft');
    expect(ZU_WEITE_WOERTER).not.toContain('Robotik');
  });

  it('führt kein Beispiel-JSON, das ein Modell zurückspiegeln könnte', () => {
    const { systemPrompt } = baueSchlagwortPrompt('Thema', 'Beschreibung');
    expect(systemPrompt).not.toContain('{"schlagworte"');
    expect(systemPrompt).toContain('"schlagworte"');
  });

  it('deckelt eine überlange Aufgabenbeschreibung', () => {
    const lang = 'a'.repeat(20_000);
    const { userPrompt } = baueSchlagwortPrompt('Thema', lang);
    expect(userPrompt.length).toBeLessThan(6_000);
  });

  it('gibt Thema und Beschreibung getrennt in den Prompt', () => {
    const { userPrompt } = baueSchlagwortPrompt('Laserschweissen', 'Nahtprüfung im Fahrzeugbau');
    expect(userPrompt).toContain('Laserschweissen');
    expect(userPrompt).toContain('Nahtprüfung im Fahrzeugbau');
  });
});

describe('parseSchlagworte', () => {
  it('liest sauberes JSON', () => {
    const roh = '{"schlagworte":["Laserschweissen","Nahtprüfung","Fahrzeugbau"]}';
    expect(parseSchlagworte(roh)).toEqual(['Laserschweissen', 'Nahtprüfung', 'Fahrzeugbau']);
  });

  it('liest JSON im Markdown-Zaun', () => {
    const roh = '```json\n{"schlagworte":["Biokatalyse","Enzymtechnik","Bioreaktor"]}\n```';
    expect(parseSchlagworte(roh)).toEqual(['Biokatalyse', 'Enzymtechnik', 'Bioreaktor']);
  });

  it('nimmt das LETZTE Objekt, wenn davor eine Erläuterung mit Beispiel steht', () => {
    const roh = [
      'Ein Beispiel wäre {"schlagworte":["Beispiel1","Beispiel2","Beispiel3"]}.',
      'Für dieses Vorhaben:',
      '{"schlagworte":["Kaltumformung","Blechbauteil","Werkzeugverschleiss"]}',
    ].join('\n');
    expect(parseSchlagworte(roh)).toEqual(['Kaltumformung', 'Blechbauteil', 'Werkzeugverschleiss']);
  });

  it('rettet eine Aufzählung, wenn gar kein JSON kam', () => {
    const roh = [
      'Die drei passendsten Schlagworte sind:',
      '- Mikroalgen',
      '- Photobioreaktor',
      '3. Nährstoffrückgewinnung',
    ].join('\n');
    expect(parseSchlagworte(roh)).toEqual(['Mikroalgen', 'Photobioreaktor', 'Nährstoffrückgewinnung']);
  });

  it('lässt zwei Schlagworte durch, statt auf drei zu bestehen', () => {
    expect(parseSchlagworte('{"schlagworte":["Kaltumformung","Blechbauteil"]}'))
      .toEqual(['Kaltumformung', 'Blechbauteil']);
  });

  it(`deckelt auf ${SCHLAGWORT_ANZAHL} und entdoppelt gross/klein`, () => {
    const roh = '{"schlagworte":["Sensorik","sensorik","Messtechnik","Kalibrierung","Auswertung"]}';
    expect(parseSchlagworte(roh)).toEqual(['Sensorik', 'Messtechnik', 'Kalibrierung']);
  });

  it(`siebt Schlagworte unter ${MIN_SCHLAGWORT_LEN} Zeichen aus`, () => {
    expect(parseSchlagworte('{"schlagworte":["KI","3D","Bioreaktor"]}')).toEqual(['Bioreaktor']);
  });

  it('gibt eine leere Liste zurück, wenn nichts Verwertbares kam', () => {
    expect(parseSchlagworte('Dazu kann ich nichts sagen.')).toEqual([]);
    expect(parseSchlagworte('')).toEqual([]);
  });

  it('siebt die Verbotswörter NICHT nach — die Zeile soll drei Wörter zeigen', () => {
    // Der Prompt verbietet sie; hielte der Parser sie zusätzlich zurück, stünden
    // in der Zeile plötzlich zwei statt drei Wörter, ohne dass jemand sieht warum.
    expect(parseSchlagworte('{"schlagworte":["Digitalisierung","Bioreaktor","Enzymtechnik"]}'))
      .toEqual(['Digitalisierung', 'Bioreaktor', 'Enzymtechnik']);
  });
});
