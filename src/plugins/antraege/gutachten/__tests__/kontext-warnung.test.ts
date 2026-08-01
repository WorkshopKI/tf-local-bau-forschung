/**
 * `pruefeKontextPasst` — die Warnung VOR dem Lauf.
 *
 * Der teure Fehler war nicht die Kürzung selbst, sondern ihr Zeitpunkt: sichtbar
 * wurde sie erst am fertigen Abschnitt. Diese Prüfung entscheidet, ob die Zeile
 * erscheint und ob ein Wechsel der internen KI genügt.
 */
import { describe, it, expect } from 'vitest';
import { pruefeKontextPasst } from '../kontextWarnung';

describe('pruefeKontextPasst', () => {
  it('schweigt, wenn der Korpus ins Fenster passt', () => {
    expect(pruefeKontextPasst({ korpusZeichen: 1000, cap: 1000, ziel: 'standard' })).toBeNull();
  });

  it('meldet die Lücke in Zeichen', () => {
    const b = pruefeKontextPasst({ korpusZeichen: 1500, cap: 1000, ziel: 'standard' });
    expect(b?.fehlend).toBe(500);
    expect(b?.zeichen).toBe(1500);
    expect(b?.cap).toBe(1000);
  });

  it('empfiehlt den Wechsel, wenn das andere Fenster reicht', () => {
    const b = pruefeKontextPasst({ korpusZeichen: 200_000, cap: 173_712, ziel: 'standard', capAndere: 773_712 });
    expect(b?.andereKiReicht).toBe(true);
    expect(b?.andereKiLabel).toBe('agentische KI');
  });

  it('empfiehlt den Wechsel NICHT, wenn auch das andere Fenster zu klein ist', () => {
    const b = pruefeKontextPasst({ korpusZeichen: 900_000, cap: 173_712, ziel: 'standard', capAndere: 773_712 });
    expect(b?.andereKiReicht).toBe(false);
  });

  it('ohne zweites Fenster (kein Bridge-Ziel) bleibt die Wechsel-Empfehlung aus', () => {
    const b = pruefeKontextPasst({ korpusZeichen: 200_000, cap: 173_712, ziel: 'standard' });
    expect(b?.andereKiReicht).toBe(false);
  });

  it('benennt aus agentischer Sicht die Standard-KI als Alternative', () => {
    const b = pruefeKontextPasst({ korpusZeichen: 900_000, cap: 773_712, ziel: 'agentisch' });
    expect(b?.andereKiLabel).toBe('Standard-KI');
  });
});
