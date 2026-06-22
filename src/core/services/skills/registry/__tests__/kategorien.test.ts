import { describe, it, expect } from 'vitest';
import {
  effektiveKategorie,
  KATEGORIE_LABEL,
  KATEGORIE_ORDER,
  worstLevel,
  type AmpelLevel,
} from '../kategorien';
import { runRegelChecks } from '../check-engine';
import type { QualitaetsRegel, Schweregrad } from '../types';

function regel(
  typ: string,
  params: Record<string, unknown>,
  opts: { schweregrad?: Schweregrad; aktiv?: boolean; id?: string } = {},
): QualitaetsRegel {
  return {
    id: opts.id ?? `r-${typ}`,
    name: typ,
    typ,
    params,
    schweregrad: opts.schweregrad ?? 'fehler',
    aktiv: opts.aktiv ?? true,
    erstellt_am: 't',
    geaendert_am: 't',
  };
}

describe('effektiveKategorie — typ-Ableitung (alle 9 bekannten Typen)', () => {
  it('Umfang: satzanzahl/wortanzahl/zeichen_max/absatz_min', () => {
    expect(effektiveKategorie({ typ: 'satzanzahl' })).toBe('umfang');
    expect(effektiveKategorie({ typ: 'wortanzahl' })).toBe('umfang');
    expect(effektiveKategorie({ typ: 'zeichen_max' })).toBe('umfang');
    expect(effektiveKategorie({ typ: 'absatz_min' })).toBe('umfang');
  });
  it('Sprache: satzlaenge_max/verbotenes_muster', () => {
    expect(effektiveKategorie({ typ: 'satzlaenge_max' })).toBe('sprache');
    expect(effektiveKategorie({ typ: 'verbotenes_muster' })).toBe('sprache');
  });
  it('Struktur: keine_aufzaehlungen/pflicht_anfang', () => {
    expect(effektiveKategorie({ typ: 'keine_aufzaehlungen' })).toBe('struktur');
    expect(effektiveKategorie({ typ: 'pflicht_anfang' })).toBe('struktur');
  });
  it('Form: nf_keine_platzhalter_reste (deterministisch, unabhängig von pruefart)', () => {
    expect(effektiveKategorie({ typ: 'nf_keine_platzhalter_reste' })).toBe('form');
    expect(effektiveKategorie({ typ: 'nf_keine_platzhalter_reste', pruefart: 'fachlich' })).toBe('form');
  });
});

describe('effektiveKategorie — pruefart-Fallback (Typ unbekannt)', () => {
  it('fachlich → inhalt', () => {
    expect(effektiveKategorie({ typ: 'qs_quellenabgleich', pruefart: 'fachlich' })).toBe('inhalt');
  });
  it('administrativ → form', () => {
    expect(effektiveKategorie({ typ: 'qs_vollstaendigkeit', pruefart: 'administrativ' })).toBe('form');
  });
  it('textlich (kein deterministischer Typ) → sonstige', () => {
    expect(effektiveKategorie({ typ: 'zukunfts_typ', pruefart: 'textlich' })).toBe('sonstige');
  });
  it('unbekannt ohne pruefart → sonstige', () => {
    expect(effektiveKategorie({ typ: 'zukunfts_typ' })).toBe('sonstige');
  });
});

describe('effektiveKategorie — explizite kategorie schlägt typ und pruefart', () => {
  it('override gegen typ-Ableitung', () => {
    expect(effektiveKategorie({ typ: 'satzanzahl', kategorie: 'inhalt' })).toBe('inhalt');
  });
  it('override gegen pruefart-Fallback', () => {
    expect(effektiveKategorie({ typ: 'qs_x', pruefart: 'fachlich', kategorie: 'sonstige' })).toBe('sonstige');
  });
  it('leerer/whitespace-String zählt nicht als gesetzt', () => {
    expect(effektiveKategorie({ typ: 'satzanzahl', kategorie: '   ' })).toBe('umfang');
  });
});

describe('worstLevel — Roll-up rot ⟩ gelb ⟩ grün', () => {
  it('fehler dominiert', () => {
    expect(worstLevel(['ok', 'hinweis', 'fehler'])).toBe('fehler');
  });
  it('hinweis über ok', () => {
    expect(worstLevel(['ok', 'hinweis', 'ok'])).toBe('hinweis');
  });
  it('alles ok → ok', () => {
    expect(worstLevel(['ok', 'ok'])).toBe('ok');
  });
  it('leere Liste → ok', () => {
    expect(worstLevel([] as AmpelLevel[])).toBe('ok');
  });
});

describe('Label/Order-Konsistenz', () => {
  it('jede Order-Kategorie hat ein Label', () => {
    for (const k of KATEGORIE_ORDER) expect(KATEGORIE_LABEL[k]).toBeTruthy();
  });
});

describe('runRegelChecks stempelt kategorie ans CheckResult', () => {
  it('Größen-Regel → umfang', () => {
    const c = runRegelChecks('kurz', [regel('zeichen_max', { max: 100 })])[0]!;
    expect(c.kategorie).toBe('umfang');
  });
  it('explizite kategorie wird durchgereicht', () => {
    const r = { ...regel('zeichen_max', { max: 100 }), kategorie: 'sonstige' };
    expect(runRegelChecks('kurz', [r])[0]!.kategorie).toBe('sonstige');
  });
});
