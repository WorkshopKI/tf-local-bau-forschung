import { describe, it, expect } from 'vitest';
import { buildGlossarPrompt, parseGlossar } from '../glossar';
import type { VbSektion } from '../gliederung';

const SEKTION_IDS = ['k-3.3', 'k-2', 'k-9'];

function gliederung(): VbSektion[] {
  return SEKTION_IDS.map((id, i) => ({ id, nummer: id.slice(2), titel: `T${i}`, ebene: 1 as const, start: i * 10, end: i * 10 + 10, quelle: 'heading' as const }));
}

describe('buildGlossarPrompt', () => {
  it('nennt Sektionen (ohne s-toc), VB-Text und fordert kompaktes JSON', () => {
    const p = buildGlossarPrompt(gliederung(), 'DER VB TEXT');
    expect(p).toContain('[k-3.3]');
    expect(p).toContain('DER VB TEXT');
    expect(p).toContain('```json');
    expect(p).toContain('"begriffe"');
    expect(p).toContain('erfinde nichts');
    expect(p).toContain('kompakt'); // Lehre aus Zahlen: Pretty-Print halbiert die Ausbeute
  });
});

describe('parseGlossar', () => {
  it('parst Begriffe, validiert Sektions-IDs, sortiert alphabetisch', () => {
    const raw = ['```json', JSON.stringify({
      schemaVersion: 1,
      begriffe: [
        { begriff: 'TRL', definition: 'Technology Readiness Level', sektionIds: ['k-2', 'xx'] },
        { begriff: 'RFID', definition: 'Radio-Frequency Identification', sektionIds: ['k-3.3'] },
      ],
    }), '```'].join('\n');
    const d = parseGlossar(raw, SEKTION_IDS)!;
    expect(d.begriffe.map(b => b.begriff)).toEqual(['RFID', 'TRL']); // alphabetisch
    expect(d.begriffe[0]!.sektionIds).toEqual(['k-3.3']);
    expect(d.begriffe[1]!.sektionIds).toEqual(['k-2']); // unbekanntes „xx" verworfen
  });

  it('verwirft Einträge ohne Begriff ODER ohne Definition (leere sektionIds ok)', () => {
    const raw = JSON.stringify({
      begriffe: [
        { definition: 'ohne begriff', sektionIds: ['k-2'] },
        { begriff: 'NurBegriff', sektionIds: ['k-2'] },
        { begriff: 'OK', definition: 'gut', sektionIds: [] },
      ],
    });
    const d = parseGlossar(raw, SEKTION_IDS)!;
    expect(d.begriffe.map(b => b.begriff)).toEqual(['OK']);
    expect(d.begriffe[0]!.sektionIds).toEqual([]);
  });

  it('führt Dubletten (case-insensitiv) zusammen — erste Definition gewinnt', () => {
    const raw = JSON.stringify({
      begriffe: [
        { begriff: 'RFID', definition: 'erste', sektionIds: ['k-2'] },
        { begriff: 'rfid', definition: 'zweite', sektionIds: ['k-3.3'] },
      ],
    });
    const d = parseGlossar(raw, SEKTION_IDS)!;
    expect(d.begriffe).toHaveLength(1);
    expect(d.begriffe[0]!.definition).toBe('erste');
  });

  it('kaputtes JSON / Prosa → null (Degradation)', () => {
    expect(parseGlossar('nur Prosa ohne JSON', SEKTION_IDS)).toBeNull();
  });

  it('leeres Objekt / fehlendes begriffe-Feld → 0 Begriffe (nicht null)', () => {
    expect(parseGlossar('{}', SEKTION_IDS)).toEqual({ schemaVersion: 1, begriffe: [] });
  });

  it('rettet vollständige Begriffe aus abgeschnittener Antwort (Truncation-Salvage)', () => {
    const raw = [
      '```json',
      '{ "schemaVersion": 1, "begriffe": [',
      '{ "begriff": "RFID", "definition": "Radio-Frequency Identification", "sektionIds": ["k-3.3"] },',
      '{ "begriff": "TRL", "definition": "Technology Readiness Level", "sektionIds": ["k-2"] },',
      '{ "begriff": "GaN", "definition": "Gallium', // abgeschnitten
    ].join('\n');
    const d = parseGlossar(raw, SEKTION_IDS)!;
    expect(d.begriffe.map(b => b.begriff)).toEqual(['RFID', 'TRL']); // GaN unvollständig raus
  });

  it('ignoriert das Bridge-Trailing-Artefakt nach dem JSON-Fence', () => {
    const raw = '```json\n{"schemaVersion":1,"begriffe":[{"begriff":"TRL","definition":"Reifegrad","sektionIds":["k-2"]}]}\n```\n``` :help[]';
    expect(parseGlossar(raw, SEKTION_IDS)!.begriffe).toHaveLength(1);
  });
});
