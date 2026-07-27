import { describe, it, expect } from 'vitest';
import { codeAusSpalte, ermittleNeueFelder, pruneKuratierteFelder } from '@/core/status/entdecke';
import { baueSeedVersion } from '@/core/status/seed';
import type { SpaltenEintrag } from '@/core/services/csv/spalten-inventar';
import type { MappingVersion } from '@/core/status/typen';

const JETZT = '2026-07-27T10:00:00.000Z';
const VERSION = baueSeedVersion();

function spalte(
  feldId: string, label = feldId, quelle: 'csv' | 'kanonisch' = 'csv',
): SpaltenEintrag {
  return { feldId, label, typ: 'datum', quelle, schemaAnzahl: 1 };
}

describe('codeAusSpalte', () => {
  it('streift das Spalten-Präfix ab', () => {
    expect(codeAusSpalte('D_XTEC')).toBe('XTEC');
    expect(codeAusSpalte('T_HINT')).toBe('HINT');
    expect(codeAusSpalte('D_PC+')).toBe('PC+');
  });
});

describe('ermittleNeueFelder', () => {
  it('meldet eine unbekannte Statusspalte mit Label, Code und Ebene', () => {
    const neu = ermittleNeueFelder(VERSION, [spalte('D_ZZNEU', 'Ganz neuer Schritt')], JETZT);
    expect(neu).toHaveLength(1);
    expect(neu[0]).toMatchObject({
      feldId: 'D_ZZNEU',
      label: 'Ganz neuer Schritt',
      typ: 'datum',
      ebene: 'tv',
      code: 'ZZNEU',
      aktiv: false,
      unkuratiert: true,
      erstmalsGesehen: JETZT,
    });
    expect(neu[0]?.kategorieId).toBeUndefined();
  });

  it('erkennt die Verbund-Ebene am X-Präfix des Codes', () => {
    const neu = ermittleNeueFelder(VERSION, [spalte('D_XZZNEU')], JETZT);
    expect(neu[0]?.ebene).toBe('verbund');
  });

  it('setzt bei T_-Spalten den Typ „text"', () => {
    const neu = ermittleNeueFelder(VERSION, [spalte('T_ZZNEU')], JETZT);
    expect(neu[0]?.typ).toBe('text');
  });

  it('ignoriert Spalten, die keine Statusspalten sind', () => {
    const inventar = [spalte('ORG_AST'), spalte('PLZ_AFS'), spalte('ZUW_MU_FST')];
    expect(ermittleNeueFelder(VERSION, inventar, JETZT)).toEqual([]);
  });

  it('ignoriert kanonisch gemappte Spalten — die sind über ihr Feld schon im Katalog', () => {
    expect(ermittleNeueFelder(VERSION, [spalte('antragsdatum', 'Antragseingang', 'kanonisch')], JETZT))
      .toEqual([]);
  });

  it('meldet nichts, was der Katalog schon führt', () => {
    // `D_XTEC` steht im Auslieferungs-Seed.
    expect(ermittleNeueFelder(VERSION, [spalte('D_XTEC')], JETZT)).toEqual([]);
  });

  it('meldet keine Begleit-Textspalte eines bekannten Eintrags', () => {
    // `T_AAI` gehört zu `D_AAI` und hat keinen eigenen Katalog-Eintrag.
    expect(ermittleNeueFelder(VERSION, [spalte('T_AAI')], JETZT)).toEqual([]);
  });

  it('vergleicht normalisiert — Groß-/Kleinschreibung und Trenner zählen nicht', () => {
    expect(ermittleNeueFelder(VERSION, [spalte('d_xtec')], JETZT)).toEqual([]);
  });

  it('meldet dieselbe Spalte innerhalb eines Laufs nur einmal', () => {
    const neu = ermittleNeueFelder(VERSION, [spalte('D_ZZNEU'), spalte('d_zzneu')], JETZT);
    expect(neu).toHaveLength(1);
  });

  it('fällt auf den Spaltennamen zurück, wenn kein Label da ist', () => {
    const neu = ermittleNeueFelder(VERSION, [spalte('D_ZZNEU', '   ')], JETZT);
    expect(neu[0]?.label).toBe('D_ZZNEU');
  });
});

describe('pruneKuratierteFelder', () => {
  it('räumt Funde heraus, die inzwischen im Katalog stehen', () => {
    const fund = ermittleNeueFelder(VERSION, [spalte('D_ZZNEU')], JETZT);
    const kuratiert: MappingVersion = {
      ...VERSION,
      felder: [...VERSION.felder, { ...fund[0]!, aktiv: true, unkuratiert: false }],
    };
    expect(pruneKuratierteFelder(kuratiert, fund)).toEqual([]);
    expect(pruneKuratierteFelder(VERSION, fund)).toHaveLength(1);
  });
});
