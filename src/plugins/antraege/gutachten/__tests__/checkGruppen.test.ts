import { describe, it, expect } from 'vitest';
import { groupChecksByKategorie } from '../checkGruppen';
import type { CheckResult } from '@/core/services/skills';

function chk(kategorie: string | undefined, level: CheckResult['level'], id: string): CheckResult {
  return { id, regelId: id, level, label: id, ...(kategorie ? { kategorie } : {}) };
}

describe('groupChecksByKategorie', () => {
  it('gibt Gruppen in KATEGORIE_ORDER aus (umfang vor sprache vor struktur)', () => {
    const gruppen = groupChecksByKategorie([
      chk('struktur', 'ok', 's1'),
      chk('sprache', 'ok', 'l1'),
      chk('umfang', 'ok', 'u1'),
    ]);
    expect(gruppen.map(g => g.kategorie)).toEqual(['umfang', 'sprache', 'struktur']);
  });

  it('lässt leere Buckets weg (nur vorhandene Kategorien)', () => {
    const gruppen = groupChecksByKategorie([chk('umfang', 'ok', 'u1')]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0]!.label).toBe('Umfang');
  });

  it('worst = Roll-up der Level; offen = Anzahl nicht-ok', () => {
    const [g] = groupChecksByKategorie([
      chk('umfang', 'ok', 'u1'),
      chk('umfang', 'hinweis', 'u2'),
      chk('umfang', 'fehler', 'u3'),
    ]);
    expect(g!.worst).toBe('fehler');
    expect(g!.offen).toBe(2);
    expect(g!.checks).toHaveLength(3);
  });

  it('summary: alles ok / N Hinweise / N Fehler (Fehler dominiert)', () => {
    expect(groupChecksByKategorie([chk('umfang', 'ok', 'a')])[0]!.summary).toBe('alles ok');
    expect(groupChecksByKategorie([chk('umfang', 'hinweis', 'a')])[0]!.summary).toBe('1 Hinweis');
    expect(groupChecksByKategorie([chk('umfang', 'hinweis', 'a'), chk('umfang', 'hinweis', 'b')])[0]!.summary).toBe('2 Hinweise');
    expect(groupChecksByKategorie([chk('umfang', 'hinweis', 'a'), chk('umfang', 'fehler', 'b')])[0]!.summary).toBe('1 Fehler');
  });

  it('Fallback: fehlende kategorie → Gruppe „sonstige"', () => {
    const gruppen = groupChecksByKategorie([chk(undefined, 'ok', 'x')]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0]!.kategorie).toBe('sonstige');
    expect(gruppen[0]!.label).toBe('Sonstige');
  });

  it('unbekannte Kategorie wird stabil ans Ende sortiert', () => {
    const gruppen = groupChecksByKategorie([
      chk('zukunft', 'ok', 'z1'),
      chk('umfang', 'ok', 'u1'),
    ]);
    expect(gruppen.map(g => g.kategorie)).toEqual(['umfang', 'zukunft']);
  });

  it('leere Eingabe → keine Gruppen', () => {
    expect(groupChecksByKategorie([])).toEqual([]);
  });
});
