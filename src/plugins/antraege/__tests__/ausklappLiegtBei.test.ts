/**
 * **Liegt bei** — und was dasteht, wenn die App es nicht weiß.
 *
 * Der Entwurf macht die Zuständigkeit zu einem Kernfaktum der Kopfkarte. Im
 * Bestand ist sie oft nicht ableitbar. Genau dann muss der Grund dastehen: eine
 * leere Kachel läse sich als „liegt bei niemandem" (Pitfall #44).
 */
import { describe, it, expect } from 'vitest';
import type { OffenesPaar, WaechterErgebnis } from '@/core/status/waechter';
import { liegtBei } from '@/plugins/antraege/ausklapp/kopfkarte/liegtBei';

const AN = { vorgangssystemAn: true };

function waechter(p: Partial<WaechterErgebnis> = {}): WaechterErgebnis {
  return {
    urteil: 'haengt',
    letzteAktivitaet: '2025-09-17',
    belegt: true,
    anstehend: null,
    tage: 322,
    zieltage: 14,
    grund: 'seit 322 Tagen kein Eintrag',
    rolle: null,
    paar: null,
    ...p,
  };
}

const paar = (tage: number): OffenesPaar => ({
  gesetzt: 'AK4', fehlt: 'AT4', fehltLabel: 'Gutachten fachlich',
  seit: '2025-09-17', tage, rolle: 'qs',
});

describe('liegtBei', () => {
  it('nennt Rolle und Liegezeit aus dem halb offenen Paar', () => {
    const l = liegtBei(waechter({ rolle: 'qs', paar: paar(326) }), AN);
    expect(l.kurz).toBe('QS');
    expect(l.lang).toContain('Qualitätssicherung');
    expect(l.seit).toBe('seit 326 T');
    expect(l.ton).toBe('belegt');
  });

  it('führt den Antragsteller als eigene Adresse, nicht als Rolle', () => {
    const l = liegtBei(waechter({ rolle: 'ast', paar: null }), AN);
    expect(l.kurz).toBe('AST');
    expect(l.lang).toBe('Antragsteller');
  });

  it('sagt bei fehlender Rolle, WARUM nichts dasteht — und schweigt nicht', () => {
    const l = liegtBei(waechter({ rolle: null }), AN);
    expect(l.kurz).toBe('—');
    expect(l.lang).toContain('Kürzel-Paar');
    expect(l.ton).toBe('unklar');
    // Ohne Adresse keine Liegezeit — sonst stünde die Bewegungszahl zweimal da.
    expect(l.seit).toBeNull();
  });

  it('nennt ohne Vorgangssystem die fehlende Quelle statt des fehlenden Paares', () => {
    const l = liegtBei(waechter({ rolle: null }), { vorgangssystemAn: false });
    expect(l.lang).toContain('Vorgangssystem');
  });

  it('sagt ohne Wächter, dass der Katalog fehlt', () => {
    const l = liegtBei(null, AN);
    expect(l.kurz).toBe('—');
    expect(l.lang).toContain('Statuskatalog');
    expect(l.seit).toBeNull();
  });

  it('nimmt die Liegezeit NUR aus dem Paar — sonst wiederholte sie die Bewegung', () => {
    // `tage` (Zeit seit der letzten Aktivität) steht bereits als „Bewegung"
    // daneben; als Liegezeit ausgegeben wäre dieselbe Zahl zweimal gemessen.
    expect(liegtBei(waechter({ rolle: 'ab', paar: null, tage: 12 }), AN).seit).toBeNull();
    expect(liegtBei(waechter({ rolle: 'qs', paar: paar(12) }), AN).seit).toBe('seit 12 T');
  });
});
