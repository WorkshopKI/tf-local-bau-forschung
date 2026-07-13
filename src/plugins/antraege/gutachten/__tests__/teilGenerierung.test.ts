import { describe, it, expect } from 'vitest';
import { getTeilPlan, teilAufgabe, teilRegeln, mergeTeile, type TeilErgebnis } from '../teilGenerierung';
import type { QualitaetsRegel } from '@/core/services/skills';

function regel(id: string, typ: string): QualitaetsRegel {
  return { id, name: id, typ, params: {}, schweregrad: 'fehler', aktiv: true, erstellt_am: 't', geaendert_am: 't' };
}

describe('getTeilPlan', () => {
  it('splittet nur den B-Skill (gutachten-ausgangslage) in zwei Teile', () => {
    const plan = getTeilPlan('gutachten-ausgangslage');
    expect(plan).not.toBeNull();
    expect(plan).toHaveLength(2);
    expect(plan![0]!.label).toContain('Hintergrund');
    expect(plan![1]!.label).toContain('Lösungsweg');
  });

  it('liefert null für andere Skills (A, C–G, NF, …)', () => {
    expect(getTeilPlan('gutachten-kurzfassung')).toBeNull();
    expect(getTeilPlan('gutachten-risiken')).toBeNull();
    expect(getTeilPlan('irgendwas')).toBeNull();
  });
});

describe('teilAufgabe', () => {
  const plan = getTeilPlan('gutachten-ausgangslage')!;

  it('erster Teil (ohne Vorlauf): Scope-Anweisung, KEIN Anschluss-Text', () => {
    const s = teilAufgabe(plan[0]!, '');
    expect(s).toContain('In DIESEM Lauf');
    expect(s).toContain('Stand der Technik');
    expect(s).toContain('LÖSUNGSWEG NICHT');
    expect(s).not.toContain('bereits geschrieben');
  });

  it('zweiter Teil (mit Vorlauf): hängt den bisherigen Text als Anschluss-Kontext an', () => {
    const vor = 'Absatz Hintergrund. Absatz Stand der Technik.';
    const s = teilAufgabe(plan[1]!, vor);
    expect(s).toContain('Lösungsweg');
    expect(s).toContain('WIEDERHOLE');
    expect(s).toContain(vor);
  });

  it('leerer/whitespace Vorlauf → kein Anschluss-Block', () => {
    expect(teilAufgabe(plan[1]!, '   ')).not.toContain('bereits geschrieben');
  });
});

describe('teilRegeln', () => {
  it('entfernt Gesamt-Größen-Regeln (wortanzahl, absatz_min), behält den Rest', () => {
    const voll = [
      regel('b-wort', 'wortanzahl'),
      regel('b-abs', 'absatz_min'),
      regel('b-liste', 'keine_aufzaehlungen'),
      regel('b-passiv', 'verbotenes_muster'),
    ];
    const teil = teilRegeln(voll);
    expect(teil.map(r => r.typ)).toEqual(['keine_aufzaehlungen', 'verbotenes_muster']);
  });

  it('ist rein (verändert das Eingabe-Array nicht)', () => {
    const voll = [regel('a', 'wortanzahl'), regel('b', 'keine_aufzaehlungen')];
    teilRegeln(voll);
    expect(voll).toHaveLength(2);
  });
});

describe('mergeTeile', () => {
  const t = (over: Partial<TeilErgebnis>): TeilErgebnis => ({ quellenanalyse: '', finalerText: '', ...over });

  it('fügt finalerText per Absatz, quellenanalyse per Zeile zusammen; entwurf leer', () => {
    const m = mergeTeile([
      t({ quellenanalyse: '„Zitat 1"', finalerText: 'Teil eins.' }),
      t({ quellenanalyse: '„Zitat 2"', finalerText: 'Teil zwei.' }),
    ]);
    expect(m.finalerText).toBe('Teil eins.\n\nTeil zwei.');
    expect(m.quellenanalyse).toBe('„Zitat 1"\n„Zitat 2"');
    expect(m.entwurf).toBe('');
  });

  it('überspringt leere Teile (kein doppelter Umbruch)', () => {
    const m = mergeTeile([
      t({ finalerText: 'Nur dieser.' }),
      t({ finalerText: '   ' }),
    ]);
    expect(m.finalerText).toBe('Nur dieser.');
  });

  it('vbGekuerzt = true, wenn irgendein Teil gekürzt wurde; Warnungen verbunden', () => {
    const m = mergeTeile([
      t({ finalerText: 'a', vbGekuerzt: false, warnung: 'W1' }),
      t({ finalerText: 'b', vbGekuerzt: true }),
    ]);
    expect(m.vbGekuerzt).toBe(true);
    expect(m.warnung).toBe('W1');
  });

  it('stapelt Denkprozesse getrennt; ohne Thinking bleibt das Feld weg', () => {
    const mitThink = mergeTeile([t({ finalerText: 'a', thinking: 'T1' }), t({ finalerText: 'b', thinking: 'T2' })]);
    expect(mitThink.thinking).toBe('T1\n\n---\n\nT2');
    const ohne = mergeTeile([t({ finalerText: 'a' })]);
    expect(ohne.thinking).toBeUndefined();
  });
});
