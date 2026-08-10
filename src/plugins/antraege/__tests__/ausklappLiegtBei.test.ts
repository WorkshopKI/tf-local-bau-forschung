/**
 * **Liegt bei** — und was dasteht, wenn die App es nicht weiß.
 *
 * Der Entwurf macht die Zuständigkeit zu einem Kernfaktum der Kopfkarte. Bis
 * v3.40 war sie im Bestand fast nie ableitbar: die einzige Quelle war das halb
 * offene Kürzel-Paar. Seit v3.41 kommt die To-do-Engine dazu — mit dem
 * Unterschied, dass sie keine Liegezeit kennt.
 *
 * Was hier zählt: die Kachel erklärt sich in JEDER Lage, und sie erklärt sich
 * mit dem Grund, der wirklich zutrifft (Pitfall #44).
 */
import { describe, it, expect } from 'vitest';
import type { OffenesPaar, WaechterErgebnis } from '@/core/status/waechter';
import {
  liegtBei, type AufgabenQuelle,
} from '@/plugins/antraege/ausklapp/kopfkarte/liegtBei';

const STUMM: AufgabenQuelle = { ohneRegeln: false, uneinig: false, herkunft: null };

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

/** Kurzform für die vielen Aufrufe darunter. */
const bei = (w: WaechterErgebnis | null, aufgabe: AufgabenQuelle = STUMM, an = true) =>
  liegtBei({ waechter: w, vorgangssystemAn: an, aufgabe });

describe('liegtBei — mit Quelle', () => {
  it('nennt Rolle und Liegezeit aus dem halb offenen Paar', () => {
    const l = bei(waechter({ rolle: 'qs', paar: paar(326) }));
    expect(l.kurz).toBe('QS');
    expect(l.lang).toContain('Qualitätssicherung');
    expect(l.seit).toBe('seit 326 T');
    expect(l.ton).toBe('belegt');
  });

  it('benennt das Paar als Herkunft — nicht die Regel, die auch dastünde', () => {
    // Das Paar gewinnt in `pruefeStillstand`; der Tooltip muss dasselbe sagen,
    // sonst schreibt man die Adresse der falschen Quelle zu.
    const l = bei(
      waechter({ rolle: 'qs', paar: paar(12) }),
      { ...STUMM, herkunft: 'R6 · Rücknahmeempfehlung' },
    );
    expect(l.lang).toContain('AK4/AT4');
    expect(l.lang).not.toContain('R6');
  });

  it('nennt die Regel, wo die Adresse aus der To-do-Kaskade kommt', () => {
    const l = bei(
      waechter({ rolle: 'fb', paar: null }),
      { ...STUMM, herkunft: 'R6 · Rücknahmeempfehlung' },
    );
    expect(l.kurz).toBe('FB');
    expect(l.lang).toContain('R6 · Rücknahmeempfehlung');
    // Die Engine kennt keine Liegezeit — nur das Paar trägt eine.
    expect(l.seit).toBeNull();
  });

  it('führt den Antragsteller als eigene Adresse, nicht als Rolle', () => {
    const l = bei(waechter({ rolle: 'ast', paar: null }));
    expect(l.kurz).toBe('AST');
    expect(l.lang).toContain('Antragsteller');
  });
});

describe('liegtBei — ohne Quelle steht der Grund da', () => {
  it('unterscheidet fehlende Regeln von fehlender Ableitung', () => {
    expect(bei(waechter({ rolle: null }), STUMM).lang).toContain('keine To-do-Regel benennt');
    expect(bei(waechter({ rolle: null }), { ...STUMM, ohneRegeln: true }).lang)
      .toContain('führt keine To-do-Regeln');
  });

  it('sagt bei uneinigen Teilvorhaben, dass es keine EINE Adresse gibt', () => {
    const l = bei(waechter({ rolle: null }), { ...STUMM, uneinig: true });
    expect(l.kurz).toBe('—');
    expect(l.lang).toContain('verschiedene Rollen');
    expect(l.ton).toBe('unklar');
  });

  it('nennt ohne Vorgangssystem die fehlende Quelle statt der fehlenden Regel', () => {
    expect(bei(waechter({ rolle: null }), STUMM, false).lang).toContain('Vorgangssystem');
  });

  it('sagt ohne Wächter, dass der Katalog fehlt', () => {
    const l = bei(null);
    expect(l.kurz).toBe('—');
    expect(l.lang).toContain('Statuskatalog');
    expect(l.seit).toBeNull();
  });

  it('nimmt die Liegezeit NUR aus dem Paar — sonst wiederholte sie die Bewegung', () => {
    // `tage` (Zeit seit der letzten Aktivität) steht bereits als „Bewegung"
    // daneben; als Liegezeit ausgegeben wäre dieselbe Zahl zweimal gemessen.
    expect(bei(waechter({ rolle: 'ab', paar: null, tage: 12 })).seit).toBeNull();
    expect(bei(waechter({ rolle: 'qs', paar: paar(12) })).seit).toBe('seit 12 T');
  });
});
