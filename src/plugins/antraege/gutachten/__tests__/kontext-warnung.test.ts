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
    const b = pruefeKontextPasst({ korpusZeichen: 300_000, cap: 238_617, ziel: 'standard', capAndere: 1_198_617 });
    expect(b?.andereKiReicht).toBe(true);
    expect(b?.andereKiLabel).toBe('Qwen3.6-35B');
  });

  it('empfiehlt den Wechsel NICHT, wenn auch das andere Fenster zu klein ist', () => {
    const b = pruefeKontextPasst({ korpusZeichen: 1_400_000, cap: 238_617, ziel: 'standard', capAndere: 1_198_617 });
    expect(b?.andereKiReicht).toBe(false);
  });

  it('ohne zweites Fenster (kein Bridge-Ziel) bleibt die Wechsel-Empfehlung aus', () => {
    const b = pruefeKontextPasst({ korpusZeichen: 300_000, cap: 238_617, ziel: 'standard' });
    expect(b?.andereKiReicht).toBe(false);
  });

  it('benennt aus agentischer Sicht gpt-oss-120b als Alternative', () => {
    const b = pruefeKontextPasst({ korpusZeichen: 1_400_000, cap: 1_198_617, ziel: 'stark' });
    expect(b?.andereKiLabel).toBe('gpt-oss-120b');
  });
});

/**
 * Am lokalen llama.cpp beobachtet: die Warnung sprach vom „Fenster gpt-oss-120b",
 * obwohl gar keine Bridge lief. Ohne zweites Fenster gibt es keine Tabs — dann darf
 * der Text keinen benennen.
 */
describe('fensterLabel', () => {
  it('nennt ohne Bridge-Ziel schlicht das Modell', () => {
    const b = pruefeKontextPasst({ korpusZeichen: 339_485, cap: 334_233, ziel: 'standard' });
    expect(b?.fensterLabel).toBe('des Modells');
  });

  it('nennt mit Bridge-Ziel den Tab — im Dativ', () => {
    expect(pruefeKontextPasst({ korpusZeichen: 300_000, cap: 238_617, ziel: 'standard', capAndere: 1_198_617 })?.fensterLabel)
      .toBe('von gpt-oss-120b');
    expect(pruefeKontextPasst({ korpusZeichen: 1_400_000, cap: 1_198_617, ziel: 'stark', capAndere: 238_617 })?.fensterLabel)
      .toBe('von Qwen3.6-35B');
  });
});
