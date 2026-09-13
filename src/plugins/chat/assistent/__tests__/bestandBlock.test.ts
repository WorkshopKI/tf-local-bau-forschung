/**
 * Der Bestand-Block: Aggregate nach Rolle, Verfahrensschritt, Status und Frist.
 * Zwei Zusagen stehen vorn — die Grundlage nennt ihren Nenner, und keine Zeile
 * nennt ein Bearbeiter-Kürzel.
 */
import { describe, expect, it } from 'vitest';
import { bestandBlock, BESTAND_MAX_LISTE } from '../bestandBlock';
import type { BestandZeile } from '@/core/status/bestands-lauf';
import type { WaechterErgebnis } from '@/core/status/waechter';

function waechter(over: Partial<WaechterErgebnis> = {}): WaechterErgebnis {
  return {
    urteil: 'ok', letzteAktivitaet: null, belegt: false, anstehend: null,
    tage: 10, zieltage: 30, grund: '', rolle: null, paar: null, ...over,
  };
}

function zeile(aktenzeichen: string, over: Partial<BestandZeile> = {}): BestandZeile {
  return {
    aktenzeichen, verbundId: null, titel: `Titel ${aktenzeichen}`, statusRoh: 'beantragt',
    zahPhase: null, zahPhaseText: 'Eingang', jahr: '2025', variante: 'FuE',
    todos: {} as BestandZeile['todos'],
    waechter: waechter(),
    wirksamerEingang: null, restTage: 60, fristLaeuft: true,
    filterRecord: { aktenzeichen, tib_kuerz: 'THÜ', bib_kuerz: 'MUE' } as unknown as BestandZeile['filterRecord'],
    ...over,
  };
}

const block = (zeilen: BestandZeile[], extra: Partial<Parameters<typeof bestandBlock>[0]> = {}) =>
  bestandBlock({ zeilen, nichtGerechnet: 0, jahre: [2020, 2025], ...extra });

describe('bestandBlock', () => {
  it('nennt die Grundlage mit Nenner und die nicht gerechneten Vorgänge', () => {
    const b = block([zeile('A'), zeile('B', { statusRoh: 'abgelehnt/zurückgezogen' })], { nichtGerechnet: 3 });
    expect(b.titel).toBe('Bestand (Richtlinien 2020 und 2025)');
    expect(b.zeilen[0]).toContain('2 Teilvorhaben, davon 1 offen');
    expect(b.zeilen[0]).toContain('3 Teilvorhaben älterer Richtlinien sind nicht gerechnet');
  });

  it('zählt den Stau je Rolle wie das Board — nur hängende, unbewertete gesondert', () => {
    const b = block([
      zeile('A', { waechter: waechter({ urteil: 'haengt', rolle: 'ab' }) }),
      zeile('B', { waechter: waechter({ urteil: 'haengt', rolle: 'ab' }) }),
      zeile('C', { waechter: waechter({ urteil: 'haengt', rolle: 'fb' }) }),
      zeile('D', { waechter: waechter({ urteil: 'haengt', rolle: null }) }),
      zeile('E', { waechter: waechter({ urteil: 'unbewertet' }) }),
    ]);
    const stau = b.zeilen.find(z => z.startsWith('Stau je Rolle')) ?? '';
    expect(stau).toContain('AB 2 · FB 1 · ohne ableitbare Rolle 1');
    expect(stau).toContain('1 nicht bewertbar');
  });

  it('nennt je Verbund die knappste Frist im Fenster und zählt Überschrittene', () => {
    const b = block([
      zeile('A1', { verbundId: 'V1', restTage: 9 }),
      zeile('A2', { verbundId: 'V1', restTage: 5 }),
      zeile('B', { restTage: -3 }),
      zeile('C', { restTage: 20 }),
      zeile('D', { restTage: 2, fristLaeuft: false }),
    ]);
    const text = b.zeilen.join('\n');
    expect(text).toContain('1 Teilvorhaben überschritten; 1 Vorgänge laufen in den nächsten 14 Tagen ab');
    expect(text).toContain('- Titel A2 (V1): noch 5 Tage');
    expect(text).not.toContain('Titel A1');
    expect(text).not.toContain('Titel C');
  });

  it(`kappt die Fristenliste auf ${BESTAND_MAX_LISTE} und sagt, wie viele fehlen`, () => {
    const viele = Array.from({ length: BESTAND_MAX_LISTE + 2 }, (_, i) => zeile(`Z${i}`, { restTage: 3 }));
    expect(block(viele).zeilen.join('\n')).toContain('… und 2 weitere');
  });

  it('zählt die Zuweisung, ohne ein Kürzel zu nennen', () => {
    const b = block([zeile('A'), zeile('B', { filterRecord: { aktenzeichen: 'B', tib_kuerz: 'THÜ' } as unknown as BestandZeile['filterRecord'] })]);
    const text = b.zeilen.join('\n');
    expect(text).toContain('ohne AB 1, ohne FB 0 von 2');
    expect(text).not.toMatch(/THÜ|MUE/);
  });

  it('stellt den gesehenen Vorgang neben die Liegezeit seines Status', () => {
    const b = block([zeile('A')], { fokus: { titel: 'CALYPSO', statusRoh: 'beantragt', tage: 40 } });
    expect(b.zeilen.find(z => z.startsWith('Der gesehene Vorgang CALYPSO'))).toBeDefined();
  });

  it('zählt Plan-Risiken und sortiert nach der knappsten Bearbeitungsfrist', () => {
    const b = block([], {
      planRisiken: [
        { verbundId: 'V2', titel: 'Zwei', prognose: 'gefährdet', restTage: 12 },
        { verbundId: 'V1', titel: 'Eins', prognose: 'nicht haltbar', restTage: -4 },
      ],
    });
    const text = b.zeilen.join('\n');
    expect(text).toContain('Bearbeitungsplan (Meilensteine): 1 Verbünde nicht haltbar, 1 gefährdet');
    expect(text.indexOf('Eins (V1)')).toBeLessThan(text.indexOf('Zwei (V2)'));
    expect(text).toContain('Bearbeitungsfrist: 4 Tage über der Frist');
  });
});
