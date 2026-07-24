import { describe, it, expect } from 'vitest';
import { ermittleNeueUnkuratierte, type BeobachteterWert } from '@/core/status/entdecke';
import { baueSeedVersion } from '@/core/status/seed';
import { wertId, type UnkuratierterFund } from '@/core/status/typen';

const JETZT = '2026-07-24T10:00:00.000Z';
const version = baueSeedVersion();

function finde(beobachtet: BeobachteterWert[], bestehend: UnkuratierterFund[] = []): UnkuratierterFund[] {
  return ermittleNeueUnkuratierte(version, bestehend, beobachtet, JETZT);
}

describe('Auto-Discovery: ermittleNeueUnkuratierte', () => {
  it('meldet einen neuen Statuswert eines Wert-Feldes', () => {
    const neu = finde([{ feldId: 'status', wert: 'Sonderprüfung' }]);
    expect(neu).toHaveLength(1);
    expect(neu[0]).toEqual({
      id: wertId('status', 'Sonderprüfung'),
      feldId: 'status',
      wert: 'Sonderprüfung',
      erstmalsGesehen: JETZT,
    });
  });

  it('meldet bekannte Katalogwerte NICHT', () => {
    expect(finde([{ feldId: 'status', wert: 'bewilligt' }])).toHaveLength(0);
    expect(finde([{ feldId: 'status', wert: 'BEWILLIGT' }])).toHaveLength(0); // normalisiert
  });

  it('ignoriert Datumsfelder (kein Wert-Enum)', () => {
    expect(finde([{ feldId: 'antragsdatum', wert: '01.01.2024' }])).toHaveLength(0);
  });

  it('ignoriert nicht katalogisierte Felder', () => {
    expect(finde([{ feldId: 'irgendwas', wert: 'x' }])).toHaveLength(0);
  });

  it('ignoriert leere Werte', () => {
    expect(finde([{ feldId: 'status', wert: '   ' }])).toHaveLength(0);
  });

  it('dedupliziert mehrfach beobachtete neue Werte', () => {
    const neu = finde([
      { feldId: 'status', wert: 'Neuwert' },
      { feldId: 'status', wert: 'Neuwert' },
    ]);
    expect(neu).toHaveLength(1);
  });

  it('meldet bereits gepufferte Funde NICHT erneut', () => {
    const bestehend: UnkuratierterFund[] = [
      { id: wertId('status', 'Neuwert'), feldId: 'status', wert: 'Neuwert', erstmalsGesehen: '2026-01-01T00:00:00.000Z' },
    ];
    expect(finde([{ feldId: 'status', wert: 'Neuwert' }], bestehend)).toHaveLength(0);
  });
});
