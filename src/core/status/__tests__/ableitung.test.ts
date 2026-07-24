import { describe, it, expect } from 'vitest';
import { leiteStatusAb } from '@/core/status/ableitung';
import { baueSeedVersion } from '@/core/status/seed';
import type { MappingVersion } from '@/core/status/typen';

const version = baueSeedVersion();

describe('leiteStatusAb', () => {
  it('Max-Rang: veralteter früher Status neben späterem → spätere Phase gewinnt', () => {
    const r = leiteStatusAb(version, {}, {
      AZ1: { status: 'bearbeitungsreif' },   // Vollständigkeit (rang 20)
      AZ2: { status: 'gutachten fertig' },    // Fachprüfung (rang 30)
    });
    expect(r.spinePhase).toBe('fachpruefung');
    expect(r.kategorie).toBe('in_pruefung');
    expect(r.fuehrenderWert?.wert).toBe('gutachten fertig');
    expect(r.fuehrenderWert?.tvId).toBe('AZ2');
    expect(r.terminal).toBe(false);
  });

  it('kein Konflikt bei nur 1 Spine-Stufe Abstand', () => {
    const r = leiteStatusAb(version, {}, {
      AZ1: { status: 'bearbeitungsreif' }, AZ2: { status: 'gutachten fertig' },
    });
    expect(r.konflikt).toBe(false);
    expect(r.konfliktDetails).toEqual([]);
  });

  it('Konflikt: ≥2 Spine-Stufen auseinander → konflikt true mit Ausreißer in den Details', () => {
    const r = leiteStatusAb(version, {}, {
      AZ1: { status: 'beantragt' },          // Eingang (ord 1)
      AZ2: { status: 'gutachten fertig' },    // Fachprüfung (ord 3)
    });
    expect(r.spinePhase).toBe('fachpruefung');
    expect(r.konflikt).toBe(true);
    expect(r.konfliktDetails.some(d => d.wert === 'beantragt' && d.spinePhase === 'eingang')).toBe(true);
  });

  it('Terminal schlägt Rang: abgelehnt/zurückgezogen gewinnt trotz bewilligt', () => {
    const r = leiteStatusAb(version, { verbund_status: 'bewilligt' }, {
      AZ1: { status: 'abgelehnt/zurückgezogen' },
    });
    expect(r.terminal).toBe(true);
    expect(r.kategorie).toBe('abgeschlossen');
    expect(r.spinePhase).toBe('schluss');
    expect(r.fuehrenderWert?.wert).toBe('abgelehnt/zurückgezogen');
  });

  it('unkuratierter Wert beeinflusst das Ergebnis nicht, steht aber in beitraege', () => {
    const r = leiteStatusAb(version, {}, {
      AZ1: { status: 'gutachten fertig' },
      AZ2: { status: 'völlig unbekannt xyz' },
    });
    expect(r.spinePhase).toBe('fachpruefung');
    const unk = r.beitraege.find(b => b.wert === 'völlig unbekannt xyz');
    expect(unk?.beruecksichtigt).toBe(false);
    expect(unk?.grund).toBe('unkuratiert');
  });

  it('leerer Feldsatz → definierter Zustand ohne Throw', () => {
    const r = leiteStatusAb(version, {});
    expect(r.spinePhase).toBe('keine');
    expect(r.kategorie).toBe('sonstige');
    expect(r.fuehrenderWert).toBeNull();
    expect(r.konflikt).toBe(false);
    expect(r.naechsteSchritte).toEqual([]);
  });

  it('Regeln: passende Bedingung liefert nächste Schritte mit Regel-Herkunft', () => {
    const r = leiteStatusAb(version, {}, { AZ1: { status: 'nf gestellt' } });
    const nf = r.naechsteSchritte.find(s => s.werkzeug === 'nachforderung');
    expect(nf).toBeDefined();
    expect(nf?.regelId).toBe('nf-offen');
  });

  it('Datumsregel mit eingefrorener Uhr (tageRelativHeute)', () => {
    const v: MappingVersion = {
      ...version,
      regeln: [{
        id: 'alt', prioritaet: 10, aktiv: true, beschreibung: 'Altfall',
        bedingung: { feldId: 'antragsdatum', op: 'datumVor', tageRelativHeute: 0 },
        schritte: [{ label: 'Altfall prüfen' }],
      }],
    };
    const rAlt = leiteStatusAb(v, {}, { AZ1: { antragsdatum: '01.01.2020' } }, '2026-07-24T00:00:00.000Z');
    expect(rAlt.naechsteSchritte.some(s => s.label === 'Altfall prüfen')).toBe(true);

    const rNeu = leiteStatusAb(v, {}, { AZ1: { antragsdatum: '01.01.2099' } }, '2026-07-24T00:00:00.000Z');
    expect(rNeu.naechsteSchritte.some(s => s.label === 'Altfall prüfen')).toBe(false);
  });
});
