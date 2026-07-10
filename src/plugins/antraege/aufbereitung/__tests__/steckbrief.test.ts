import { describe, it, expect } from 'vitest';
import { buildSteckbriefPrompt, parseSteckbrief, extractLastJsonObject } from '../steckbrief';
import type { VbSektion } from '../gliederung';

const SEKTION_IDS = ['k-2', 'k-2.1', 'k-3.1', 'k-8', 'k-9', 'k-11.1', 'k-11.4'];

function gliederung(): VbSektion[] {
  return SEKTION_IDS.map((id, i) => ({ id, nummer: id.slice(2), titel: `T${i}`, ebene: 1, start: i * 10, end: i * 10 + 10, quelle: 'heading' as const }));
}

describe('buildSteckbriefPrompt', () => {
  it('nennt Sektionen, VB-Text und fordert einen JSON-Codeblock', () => {
    const p = buildSteckbriefPrompt(gliederung(), 'DER VB TEXT');
    expect(p).toContain('[k-2]');
    expect(p).toContain('DER VB TEXT');
    expect(p).toContain('```json');
    expect(p).toContain('"einSatz"');
    expect(p).toContain('NICHT ausgeben'); // Stammdaten deterministisch
    // Pretty-Print truncierte den Steckbrief im Prod-Eval (Fixture 006) → kompakt fordern.
    expect(p).toContain('kompakt');
  });
});

describe('extractLastJsonObject', () => {
  it('nimmt den LETZTEN Codeblock', () => {
    const raw = '```json\n{"a":1}\n```\ntext\n```json\n{"b":2}\n```';
    expect(extractLastJsonObject(raw)).toEqual({ b: 2 });
  });
  it('findet ein Objekt auch ohne Fence', () => {
    expect(extractLastJsonObject('Erklärung … {"x": "y"} Ende')).toEqual({ x: 'y' });
  });
  it('kaputt/Prosa → null', () => {
    expect(extractLastJsonObject('nur Prosa, kein JSON')).toBeNull();
  });
  it('ignoriert das Bridge-Trailing-Artefakt nach dem Fence (``` :help[]``)', () => {
    const raw = '```json\n{"a":1}\n```\n``` :help[]';
    expect(extractLastJsonObject(raw)).toEqual({ a: 1 });
  });
  it('ignoriert generischen unparsbaren Trailing-Text nach dem Objekt', () => {
    expect(extractLastJsonObject('{"x":"y"}\n :help[]  freier Rest')).toEqual({ x: 'y' });
  });
});

describe('parseSteckbrief', () => {
  it('parst alle Felder + validiert Sektions-IDs (unbekannte verworfen, Aussage bleibt)', () => {
    const raw = ['```json', JSON.stringify({
      einSatz: { text: 'Ein selbstlernendes System.', sektionIds: ['k-2', 'unbekannt-9'] },
      innovation: [{ text: 'Erstmalige Fusion.', sektionIds: ['k-2.1'] }],
      fueGegenstand: [{ text: 'KNN für Prognosen.', sektionIds: ['k-3.1'] }],
      laufzeit: { text: '18 Monate (M1–M18)', sektionIds: ['k-9'] },
      kernZielwert: { text: 'bis zu 25 % Einsparung', sektionIds: ['k-11.4'] },
      zielmaerkte: [{ markt: 'Gewerbliche Immobilien', zielwert: '10 %', sektionIds: ['k-11.1'] }],
      personal: [{ name: 'Julia Bergmann', rolle: 'Datenwissenschaftlerin', sektionIds: ['k-8'] }],
      auftraegeDritte: [{ text: 'DataScience GmbH', sektionIds: ['k-9'] }],
    }), '```'].join('\n');
    const d = parseSteckbrief(raw, SEKTION_IDS)!;
    expect(d.einSatz).toEqual({ text: 'Ein selbstlernendes System.', sektionIds: ['k-2'] }); // unbekannt-9 verworfen
    expect(d.innovation[0]!.text).toBe('Erstmalige Fusion.');
    expect(d.laufzeit!.text).toBe('18 Monate (M1–M18)');
    expect(d.kernZielwert!.sektionIds).toEqual(['k-11.4']);
    expect(d.zielmaerkte[0]).toEqual({ markt: 'Gewerbliche Immobilien', zielwert: '10 %', sektionIds: ['k-11.1'] });
    expect(d.personal[0]).toEqual({ name: 'Julia Bergmann', rolle: 'Datenwissenschaftlerin', sektionIds: ['k-8'] });
  });

  it('fehlende Felder → leer/null (die Lücke ist Information)', () => {
    const d = parseSteckbrief('{"einSatz": {"text": "Nur ein Satz.", "sektionIds": []}}', SEKTION_IDS)!;
    expect(d.einSatz!.text).toBe('Nur ein Satz.');
    expect(d.innovation).toEqual([]);
    expect(d.laufzeit).toBeNull();
    expect(d.zielmaerkte).toEqual([]);
    expect(d.personal).toEqual([]);
  });

  it('kaputtes JSON / Prosa → null (Degradation)', () => {
    expect(parseSteckbrief('Das Vorhaben entwickelt ein System. (kein JSON)', SEKTION_IDS)).toBeNull();
  });

  it('verwirft Einträge ohne Pflichttext (text/markt/name)', () => {
    const raw = JSON.stringify({
      innovation: [{ sektionIds: ['k-2'] }, { text: 'ok', sektionIds: [] }],
      zielmaerkte: [{ zielwert: '5 %', sektionIds: [] }],
      personal: [{ rolle: 'X', sektionIds: [] }],
    });
    const d = parseSteckbrief(raw, SEKTION_IDS)!;
    expect(d.innovation).toHaveLength(1);
    expect(d.innovation[0]!.text).toBe('ok');
    expect(d.zielmaerkte).toEqual([]);
    expect(d.personal).toEqual([]);
  });
});
