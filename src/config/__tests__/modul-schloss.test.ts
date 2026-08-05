/**
 * Wahrheitstabelle der Modul-Sichtbarkeit (v3.0).
 *
 * Die eine Regel, die hier festgenagelt wird: **ohne Schloss ist offen.** Daran
 * haengt die Abnahme-Garantie — `configs/local.config.json` und `dev` fuehren kein
 * `moduleAuth`, also duerfen sie sich durch die Einfuehrung der Schloesser NICHT
 * veraendern. Waere „gesperrt" der Default, waere das Auslastungs-Modul
 * ausgerechnet in der Umgebung unsichtbar, in der `npm run dev:local` prueft.
 */

import { describe, expect, it } from 'vitest';
import { modulSichtbar } from '../modul-schloss';

describe('modulSichtbar', () => {
  it('ohne Schloss ist offen — das haelt dev/local unveraendert', () => {
    expect(modulSichtbar({ imBuild: true, hatSchloss: false, frei: false })).toBe(true);
    expect(modulSichtbar({ imBuild: true, hatSchloss: false, frei: true })).toBe(true);
  });

  it('mit Schloss entscheidet die Freischaltung', () => {
    expect(modulSichtbar({ imBuild: true, hatSchloss: true, frei: false })).toBe(false);
    expect(modulSichtbar({ imBuild: true, hatSchloss: true, frei: true })).toBe(true);
  });

  it('was nicht mitgebaut wurde, kann keine Freischaltung zeigen', () => {
    for (const hatSchloss of [false, true]) {
      for (const frei of [false, true]) {
        expect(modulSichtbar({ imBuild: false, hatSchloss, frei }), `hatSchloss=${hatSchloss} frei=${frei}`).toBe(false);
      }
    }
  });

  it('vollstaendige Tabelle — genau drei der acht Kombinationen sind sichtbar', () => {
    const alle = [false, true].flatMap(imBuild =>
      [false, true].flatMap(hatSchloss =>
        [false, true].map(frei => ({ imBuild, hatSchloss, frei })),
      ),
    );
    const sichtbar = alle.filter(modulSichtbar);
    // imBuild && !hatSchloss (beide frei-Werte) + imBuild && hatSchloss && frei
    expect(sichtbar).toHaveLength(3);
    expect(sichtbar.every(u => u.imBuild)).toBe(true);
  });
});
