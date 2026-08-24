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
  ACHSEN, baueSchlagwortPrompt, ersteWahl, KANDIDATEN_JE_ACHSE, parseSchlagworte,
  MIN_SCHLAGWORT_LEN, SCHLAGWORT_ANZAHL, ZU_WEITE_WOERTER,
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
    // Eine Beispiel-LISTE einer Achse steht drin (die Staffel eng → weit ist
    // ohne sie nicht zu erklären); ein vollständiges Antwort-Objekt nicht — das
    // ist die Schablone, die ein Modell zurückspiegelt.
    expect(systemPrompt).not.toContain('{"verfahren"');
    expect(systemPrompt).not.toContain('{ "verfahren"');
  });

  it('verlangt die drei Achsen als eigene Schlüssel, nicht als Reihenfolge einer Liste', () => {
    const { systemPrompt } = baueSchlagwortPrompt('Thema', 'Beschreibung');
    for (const achse of ACHSEN) expect(systemPrompt).toContain(`"${achse}"`);
  });

  it('sagt, dass eine Achsen-Liste DIESELBE Sache verschieden eng benennt', () => {
    // Ohne diese Regel liefert das Modell drei Achsen in einer Liste — und die
    // Wahl am Bestand tauschte dann den SINN aus statt der Weite.
    const { systemPrompt } = baueSchlagwortPrompt('Thema', 'Beschreibung');
    expect(systemPrompt).toContain('DIESELBE Sache');
    expect(systemPrompt).toContain('GENAU EIN Wort');
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

describe('parseSchlagworte — die Achsen-Form', () => {
  it('liest sauberes JSON mit drei Achsen', () => {
    const roh = '{"verfahren":["Laserauftragschweissen","Auftragschweissen"],'
      + '"gegenstand":["Eisenaluminid","Legierung"],"anwendung":["Armaturenbau"]}';
    expect(parseSchlagworte(roh)).toEqual([
      ['Laserauftragschweissen', 'Auftragschweissen'],
      ['Eisenaluminid', 'Legierung'],
      ['Armaturenbau'],
    ]);
  });

  it('liest JSON im Markdown-Zaun', () => {
    const roh = '```json\n{"verfahren":["Biokatalyse"],"gegenstand":["Enzym"],'
      + '"anwendung":["Bioreaktor"]}\n```';
    expect(parseSchlagworte(roh)).toEqual([['Biokatalyse'], ['Enzym'], ['Bioreaktor']]);
  });

  it('nimmt das LETZTE Objekt, wenn davor eine Erläuterung mit Beispiel steht', () => {
    const roh = [
      'Ein Beispiel wäre {"verfahren":["Beispiel1"],"gegenstand":["Beispiel2"],"anwendung":["Beispiel3"]}.',
      'Für dieses Vorhaben:',
      '{"verfahren":["Kaltumformung"],"gegenstand":["Blechbauteil"],"anwendung":["Werkzeugverschleiss"]}',
    ].join('\n');
    expect(parseSchlagworte(roh)).toEqual([
      ['Kaltumformung'], ['Blechbauteil'], ['Werkzeugverschleiss'],
    ]);
  });

  it(`deckelt eine Achse auf ${KANDIDATEN_JE_ACHSE} und entdoppelt gross/klein`, () => {
    const roh = '{"verfahren":["Sensorik","sensorik","Messtechnik","Kalibrierung","Auswertung"],'
      + '"gegenstand":["Blech"],"anwendung":["Prüfstand"]}';
    expect(parseSchlagworte(roh)[0]).toEqual(['Sensorik', 'Messtechnik', 'Kalibrierung']);
  });

  it('lässt eine leere Achse weg, statt eine leere Liste durchzureichen', () => {
    const roh = '{"verfahren":["Kaltumformung"],"gegenstand":[],"anwendung":["Blechbauteil"]}';
    expect(parseSchlagworte(roh)).toEqual([['Kaltumformung'], ['Blechbauteil']]);
  });

  it(`siebt Vorschläge unter ${MIN_SCHLAGWORT_LEN} Zeichen aus, ohne die Achse zu verlieren`, () => {
    const roh = '{"verfahren":["KI","Bilderkennung"],"gegenstand":["3D"],"anwendung":["Prüfstand"]}';
    // Die Gegenstands-Achse fällt ganz weg (nur „3D"), die Verfahrens-Achse
    // behält ihren zweiten Vorschlag.
    expect(parseSchlagworte(roh)).toEqual([['Bilderkennung'], ['Prüfstand']]);
  });
});

describe('parseSchlagworte — die Rückfalllinien', () => {
  /**
   * Trifft das Modell die Achsen-Form nicht, ist die flache Liste kein Fehler,
   * sondern der Stand vor v6.31: drei Achsen mit je EINEM Vorschlag. Dann gibt
   * es nichts nachzuschlagen, und die Zeile verhält sich wie bisher.
   */
  it('liest die alte flache Liste als drei Achsen mit je einem Vorschlag', () => {
    const roh = '{"schlagworte":["Laserschweissen","Nahtprüfung","Fahrzeugbau"]}';
    expect(parseSchlagworte(roh)).toEqual([['Laserschweissen'], ['Nahtprüfung'], ['Fahrzeugbau']]);
  });

  it(`deckelt die flache Liste auf ${SCHLAGWORT_ANZAHL} und entdoppelt`, () => {
    const roh = '{"schlagworte":["Sensorik","sensorik","Messtechnik","Kalibrierung","Auswertung"]}';
    expect(parseSchlagworte(roh)).toEqual([['Sensorik'], ['Messtechnik'], ['Kalibrierung']]);
  });

  it('rettet eine Aufzählung, wenn gar kein JSON kam', () => {
    const roh = [
      'Die drei passendsten Schlagworte sind:',
      '- Mikroalgen',
      '- Photobioreaktor',
      '3. Nährstoffrückgewinnung',
    ].join('\n');
    expect(parseSchlagworte(roh)).toEqual([
      ['Mikroalgen'], ['Photobioreaktor'], ['Nährstoffrückgewinnung'],
    ]);
  });

  it('gibt eine leere Liste zurück, wenn nichts Verwertbares kam', () => {
    expect(parseSchlagworte('Dazu kann ich nichts sagen.')).toEqual([]);
    expect(parseSchlagworte('')).toEqual([]);
  });

  it('siebt die Verbotswörter NICHT nach — die Zeile soll drei Wörter zeigen', () => {
    // Der Prompt verbietet sie; hielte der Parser sie zusätzlich zurück, stünden
    // in der Zeile plötzlich zwei statt drei Wörter, ohne dass jemand sieht warum.
    const roh = '{"verfahren":["Digitalisierung"],"gegenstand":["Bioreaktor"],"anwendung":["Enzymtechnik"]}';
    expect(parseSchlagworte(roh)).toEqual([['Digitalisierung'], ['Bioreaktor'], ['Enzymtechnik']]);
  });
});

describe('ersteWahl', () => {
  it('nimmt je Achse den ersten Vorschlag — das Wort, das ohne Nachschlagen gälte', () => {
    expect(ersteWahl([['Laserauftragschweissen', 'Auftragschweissen'], ['Eisenaluminid']]))
      .toEqual(['Laserauftragschweissen', 'Eisenaluminid']);
  });

  it('überspringt eine leere Achse, statt undefined durchzureichen', () => {
    expect(ersteWahl([[], ['Blechbauteil']])).toEqual(['Blechbauteil']);
  });
});
