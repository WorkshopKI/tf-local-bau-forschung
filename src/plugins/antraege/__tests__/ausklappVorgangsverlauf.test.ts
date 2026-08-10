/**
 * Der **Vorgangsverlauf** — die Fristrechnung als Aufstellung.
 *
 * Der Entwurf schreibt „Bearbeitungsfrist 90 T — aus dem Statuskatalog". Das
 * stimmt nicht: die 90 sind die Regelfrist (`ANTRAG_SLA_DAYS`), aus dem
 * Statuskatalog kommen die *Zieltage des Schritts*. Beide Zeilen stehen deshalb
 * mit ihrer eigenen Herkunft da — und die Zahl wird als Differenz abgeleitet,
 * nie verdrahtet.
 */
import { describe, it, expect } from 'vitest';
import type { FristErgebnis } from '@/core/services/csv/frist-ergebnis';
import type { FristBezug } from '@/core/status/frist-bezug';
import type { WaechterErgebnis } from '@/core/status/waechter';
import {
  baueVorgangsverlauf, type RasterZeile,
} from '@/plugins/antraege/ausklapp/vorgangsverlauf/vorgangsverlaufModell';

function ergebnis(p: Partial<FristErgebnis> = {}): FristErgebnis {
  return {
    zustand: 'laeuft',
    basisFeld: 'D_AAE',
    basisDatum: '2025-08-13',
    zielDatum: '2025-11-11',
    bezugsZeitpunkt: '2026-08-05',
    tageRest: -271,
    haltedatumQuelle: 'unbekannt',
    ...p,
  };
}

function bezug(p: Partial<FristBezug> = {}): FristBezug {
  return {
    ergebnis: ergebnis(),
    antragsdatum: '2025-08-13',
    alleAntraegeDa: '2025-08-13',
    vnEingangDatum: null,
    halt: null,
    bezugsZeitpunkt: '2026-08-05',
    ...p,
  };
}

const waechter = (p: Partial<WaechterErgebnis> = {}): WaechterErgebnis => ({
  urteil: 'haengt', letzteAktivitaet: '2026-08-01', belegt: true, anstehend: null,
  tage: 4, zieltage: 14, grund: 'seit 4 Tagen kein Eintrag', rolle: null, paar: null, ...p,
});

const von = (zeilen: RasterZeile[], label: string): RasterZeile | undefined =>
  zeilen.find(z => z.label === label);

describe('baueVorgangsverlauf — die Zeilen', () => {
  it('führt die sechs Zeilen des Entwurfs in seiner Reihenfolge', () => {
    const m = baueVorgangsverlauf({ bezug: bezug(), zieltage: 14, waechter: waechter() });
    expect(m.zeilen.map(z => z.label)).toEqual([
      'Antragseingang', 'Alle Anträge da', 'Maßgeblich',
      'Bearbeitungsfrist', 'Zieltermin', 'Zieltage des Schritts',
    ]);
  });

  it('stellt die Feldkürzel des Fachsystems neben die Eingangsdaten', () => {
    const m = baueVorgangsverlauf({ bezug: bezug(), zieltage: 14, waechter: waechter() });
    expect(von(m.zeilen, 'Antragseingang')?.feld).toBe('D_AAE');
    expect(von(m.zeilen, 'Alle Anträge da')?.feld).toBe('D_XTE');
  });

  it('setzt das nicht maßgebliche Eingangsdatum leiser', () => {
    const m = baueVorgangsverlauf({ bezug: bezug(), zieltage: 14, waechter: waechter() });
    expect(von(m.zeilen, 'Antragseingang')?.weich).toBeUndefined();
    expect(von(m.zeilen, 'Alle Anträge da')?.weich).toBe(true);
  });

  it('leitet die Bearbeitungsfrist als Differenz Basis → Ziel ab', () => {
    // 13.08.2025 → 11.11.2025 = 90 Tage.
    const z = von(baueVorgangsverlauf({
      bezug: bezug(), zieltage: 14, waechter: waechter(),
    }).zeilen, 'Bearbeitungsfrist');
    expect(z?.wert).toBe('90 T');
    expect(z?.zusatz).toContain('Regelfrist');
    expect(z?.zusatz).not.toContain('Statuskatalog');
  });

  it('nennt für die Zieltage den Statuskatalog und die letzte Aktivität', () => {
    const z = von(baueVorgangsverlauf({
      bezug: bezug(), zieltage: 14, waechter: waechter(),
    }).zeilen, 'Zieltage des Schritts');
    expect(z?.wert).toBe('14 T');
    expect(z?.zusatz).toContain('Statuskatalog');
    expect(z?.zusatz).toContain('letzte Aktivität 01.08.2026');
  });

  it('markiert eine genäherte letzte Aktivität als solche', () => {
    const z = von(baueVorgangsverlauf({
      bezug: bezug(), zieltage: 14, waechter: waechter({ belegt: false }),
    }).zeilen, 'Zieltage des Schritts');
    expect(z?.zusatz).toContain('genähert');
  });

  it('sagt bei fehlender D_XTE-Spalte, warum nichts dasteht', () => {
    const m = baueVorgangsverlauf({
      bezug: bezug({ alleAntraegeDa: null }), zieltage: null, waechter: null,
    });
    expect(von(m.zeilen, 'Alle Anträge da')?.zusatz).toContain('nicht gemappt');
    expect(von(m.zeilen, 'Zieltage des Schritts')?.zusatz).toContain('keine gepflegt');
  });
});

describe('baueVorgangsverlauf — Sonderlagen', () => {
  it('ergänzt bei angehaltener Uhr das Haltedatum samt Herkunft', () => {
    const m = baueVorgangsverlauf({
      bezug: bezug({
        ergebnis: ergebnis({ zustand: 'angehalten', haltedatumQuelle: 'journal' }),
        halt: { tag: '2026-03-01', herkunft: 'journal' },
      }),
      zieltage: 14, waechter: waechter(),
    });
    const z = von(m.zeilen, 'Haltedatum');
    expect(z?.wert).toBe('2026-03-01');
    expect(z?.zusatz).toContain('Journal');
    expect(z?.weich).toBeUndefined();
  });

  it('lässt Maßgeblich und Zieltermin weg, wo es keine Basis gibt', () => {
    const m = baueVorgangsverlauf({
      bezug: bezug({
        ergebnis: {
          zustand: 'nicht_berechenbar', grund: 'kein Eingangsdatum', haltedatumQuelle: 'unbekannt',
        },
        antragsdatum: null, alleAntraegeDa: null,
      }),
      zieltage: null, waechter: null,
    });
    expect(m.zeilen.map(z => z.label)).not.toContain('Maßgeblich');
    expect(m.zeilen.map(z => z.label)).not.toContain('Zieltermin');
    expect(von(m.zeilen, 'Bearbeitungsfrist')?.wert).toBe('—');
  });
});

describe('baueVorgangsverlauf — Legende', () => {
  it('nennt die vier Schwellen des Ampelpunktes', () => {
    const m = baueVorgangsverlauf({ bezug: bezug(), zieltage: 14, waechter: waechter() });
    expect(m.legende.map(l => l.text)).toEqual([
      'überfällig', 'noch ≤ 14 T', 'noch ≤ 30 T', 'mehr als 30 T',
    ]);
    expect(m.legende.every(l => l.farbe.startsWith('var(--tf-'))).toBe(true);
  });
});
