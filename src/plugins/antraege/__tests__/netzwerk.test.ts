import { describe, it, expect } from 'vitest';
import {
  extractNetzwerkId,
  extractNetzwerkSuffix,
  isNetzwerkLead,
  compareNetzwerkOrder,
  collectPhases,
  formatNetzwerkLabel,
} from '../netzwerk';
import type { AntragListItem } from '@/core/services/csv/types';

function mk(aktenzeichen: string, vb_phase?: number): AntragListItem {
  return {
    aktenzeichen,
    programm_id: 'P',
    _updated_at: '2026-01-01T00:00:00Z',
    ...(vb_phase !== undefined ? { vb_phase } : {}),
  };
}

describe('extractNetzwerkId', () => {
  it('liefert 4 Ziffern für ein kanonisches 16KN-FKZ', () => {
    expect(extractNetzwerkId('16KN106227')).toBe('1062');
    expect(extractNetzwerkId('16KN106201')).toBe('1062');
    expect(extractNetzwerkId('16KN999999')).toBe('9999');
  });

  it('null für nicht-16KN-Präfixe', () => {
    expect(extractNetzwerkId('16EP123456')).toBeNull();
    expect(extractNetzwerkId('16DS123456')).toBeNull();
    expect(extractNetzwerkId('16DL123456')).toBeNull();
  });

  it('null für unvollständige oder kaputte Strings', () => {
    expect(extractNetzwerkId('16KN12345')).toBeNull();
    expect(extractNetzwerkId('16KN1234567')).toBeNull();
    expect(extractNetzwerkId('16KN10620X')).toBeNull();
    expect(extractNetzwerkId('')).toBeNull();
    expect(extractNetzwerkId('16KN')).toBeNull();
  });

  it('toleriert führende/folgende Whitespace', () => {
    expect(extractNetzwerkId('  16KN106227  ')).toBe('1062');
  });
});

describe('extractNetzwerkSuffix', () => {
  it('liefert die letzten 2 Ziffern', () => {
    expect(extractNetzwerkSuffix('16KN106201')).toBe('01');
    expect(extractNetzwerkSuffix('16KN106227')).toBe('27');
  });

  it('null für nicht-16KN', () => {
    expect(extractNetzwerkSuffix('16EP123456')).toBeNull();
  });
});

describe('isNetzwerkLead', () => {
  it('true für Suffix 01 + vb_phase=1', () => {
    expect(isNetzwerkLead(mk('16KN106201', 1))).toBe(true);
  });

  it('true für Suffix 02 + vb_phase=2', () => {
    expect(isNetzwerkLead(mk('16KN106202', 2))).toBe(true);
  });

  it('false für Suffix 03+ auch bei vb_phase 1/2', () => {
    expect(isNetzwerkLead(mk('16KN106203', 1))).toBe(false);
    expect(isNetzwerkLead(mk('16KN106227', 2))).toBe(false);
  });

  it('false für Suffix 01 ohne passende vb_phase', () => {
    expect(isNetzwerkLead(mk('16KN106201'))).toBe(false);
    expect(isNetzwerkLead(mk('16KN106201', 3))).toBe(false);
    expect(isNetzwerkLead(mk('16KN106201', 9))).toBe(false);
  });

  it('false für nicht-16KN', () => {
    expect(isNetzwerkLead(mk('16EP123401', 1))).toBe(false);
  });
});

describe('compareNetzwerkOrder', () => {
  it('Leads vor Nicht-Leads', () => {
    const lead = mk('16KN106201', 1);
    const tv = mk('16KN106227', 2);
    expect(compareNetzwerkOrder(lead, tv)).toBeLessThan(0);
    expect(compareNetzwerkOrder(tv, lead)).toBeGreaterThan(0);
  });

  it('Innerhalb Leads/Nicht-Leads alphabetisch nach Aktenzeichen', () => {
    const leadP1 = mk('16KN106201', 1);
    const leadP2 = mk('16KN106202', 2);
    expect(compareNetzwerkOrder(leadP1, leadP2)).toBeLessThan(0);

    const tv1 = mk('16KN106203', 2);
    const tv2 = mk('16KN106227', 2);
    expect(compareNetzwerkOrder(tv1, tv2)).toBeLessThan(0);
  });
});

describe('collectPhases', () => {
  it('sammelt nur 1 und 2', () => {
    const items = [
      mk('16KN106201', 1),
      mk('16KN106202', 2),
      mk('16KN106203', 2),
      mk('16KN106227'),
    ];
    expect(collectPhases(items)).toEqual(new Set([1, 2]));
  });

  it('ignoriert andere Phasen', () => {
    const items = [mk('16KN1', 3), mk('16KN2', 4), mk('16KN3', 9)];
    expect(collectPhases(items)).toEqual(new Set());
  });
});

describe('formatNetzwerkLabel', () => {
  it('nur Netzwerk-ID wenn keine Phase bekannt', () => {
    expect(formatNetzwerkLabel('1062', new Set())).toBe('Netzwerk 1062');
  });

  it('einzelne Phase angehängt', () => {
    expect(formatNetzwerkLabel('1062', new Set([1]))).toBe('Netzwerk 1062 · Phase 1');
    expect(formatNetzwerkLabel('1062', new Set([2]))).toBe('Netzwerk 1062 · Phase 2');
  });

  it('beide Phasen verknüpft mit + ', () => {
    expect(formatNetzwerkLabel('1062', new Set([1, 2]))).toBe('Netzwerk 1062 · Phase 1 + 2');
    expect(formatNetzwerkLabel('1062', new Set([2, 1]))).toBe('Netzwerk 1062 · Phase 1 + 2');
  });
});
