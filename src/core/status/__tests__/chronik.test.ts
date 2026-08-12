import { describe, it, expect } from 'vitest';
import {
  baueChronik, gruppiereNachMonat, monateDazwischen, teileChronik,
} from '@/core/status/chronik';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { Prominenz, StatusFeldEintrag } from '@/core/status/typen';

function feld(
  feldId: string, typ: StatusFeldEintrag['typ'] = 'datum',
  prominenz: Prominenz = 'normal', label = feldId,
): StatusFeldEintrag {
  return {
    feldId, label, typ, ebene: 'tv',
    prominenzDefault: prominenz, aktiv: true, unkuratiert: false,
  };
}

function vk(f: StatusFeldEintrag, wert: string, tvId?: string, text?: string): FeldVorkommen {
  return { feld: f, wert, ...(tvId ? { tvId } : {}), ...(text ? { text } : {}) };
}

const EINGANG = feld('D_AAE', 'datum', 'meilenstein', 'Antragseingang');
const PRECHECK = feld('D_PC+', 'datum', 'normal', 'pre-check positiv');
const BEMERKUNG = feld('T_HINT', 'text', 'normal', 'Bemerkung');
const NEBENSACHE = feld('D_XYB', 'datum', 'nebensaechlich', 'Rückruf');
const STUMM = feld('D_STUMM', 'datum', 'ignoriert', 'Verwaltungsvermerk');

describe('chronik — was auf den Zeitstrahl kommt', () => {
  it('nimmt nur datierte Felder und sortiert sie chronologisch', () => {
    const chronik = baueChronik([
      vk(PRECHECK, '24.03.2026'),
      vk(EINGANG, '24.02.2026'),
      vk(BEMERKUNG, 'Kapazität unklar'),
    ]);
    expect(chronik.map(e => e.tag)).toEqual(['2026-02-24', '2026-03-24']);
    expect(chronik.map(e => e.feld.feldId)).toEqual(['D_AAE', 'D_PC+']);
  });

  it('lässt unlesbare Datumswerte weg, statt sie ans Ende zu sortieren', () => {
    expect(baueChronik([vk(EINGANG, 'unbekannt'), vk(PRECHECK, '')])).toEqual([]);
  });

  it('fasst denselben Termin mehrerer Teilvorhaben zu EINEM Eintrag zusammen', () => {
    const chronik = baueChronik([
      vk(EINGANG, '24.02.2026', 'TV1'),
      vk(EINGANG, '24.02.2026', 'TV2'),
      vk(EINGANG, '24.02.2026', 'TV3'),
    ]);
    expect(chronik).toHaveLength(1);
    expect(chronik[0]?.tvIds).toEqual(['TV1', 'TV2', 'TV3']);
  });

  it('trennt denselben Code an verschiedenen Tagen', () => {
    const chronik = baueChronik([
      vk(EINGANG, '24.02.2026', 'TV1'),
      vk(EINGANG, '02.03.2026', 'TV2'),
    ]);
    expect(chronik.map(e => e.tag)).toEqual(['2026-02-24', '2026-03-02']);
  });

  it('übernimmt den Begleittext des ersten Trägers, der einen führt', () => {
    const chronik = baueChronik([
      vk(EINGANG, '24.02.2026', 'TV1'),
      vk(EINGANG, '24.02.2026', 'TV2', 'per Fax nachgereicht'),
    ]);
    expect(chronik[0]?.text).toBe('per Fax nachgereicht');
  });

  it('filtert wie die Lane-Ansicht: ignoriert immer, nebensächlich auf Wunsch', () => {
    const roh = [vk(EINGANG, '24.02.2026'), vk(NEBENSACHE, '25.02.2026'), vk(STUMM, '26.02.2026')];
    expect(baueChronik(roh).map(e => e.feld.feldId)).toEqual(['D_AAE']);
    expect(baueChronik(roh, { zeigeNebensaechlich: true }).map(e => e.feld.feldId))
      .toEqual(['D_AAE', 'D_XYB']);
  });

  it('stellt am selben Tag den Meilenstein nach vorn', () => {
    const chronik = baueChronik([vk(PRECHECK, '24.02.2026'), vk(EINGANG, '24.02.2026')]);
    expect(chronik.map(e => e.feld.feldId)).toEqual(['D_AAE', 'D_PC+']);
  });
});

describe('chronik — Monatsblöcke', () => {
  it('gruppiert in Tagesfolge und wiederholt einen Monat nicht', () => {
    const chronik = baueChronik([
      vk(EINGANG, '24.02.2026'),
      vk(PRECHECK, '02.03.2026'),
      vk(feld('D_ABB'), '10.03.2026'),
    ]);
    const monate = gruppiereNachMonat(chronik);
    expect(monate.map(m => m.monat)).toEqual(['2026-02', '2026-03']);
    expect(monate[1]?.eintraege).toHaveLength(2);
  });

  it('liefert für eine leere Chronik keine Blöcke', () => {
    expect(gruppiereNachMonat([])).toEqual([]);
  });
});

describe('chronik — Nebensächliches abtrennen statt zweimal bauen', () => {
  const roh = [
    vk(EINGANG, '24.02.2026'),
    vk(NEBENSACHE, '25.02.2026'),
    vk(STUMM, '26.02.2026'),
    vk(PRECHECK, '27.02.2026'),
  ];

  it('teilt genau dort, wo baueChronik filtert (Gleichwertigkeits-Gatter)', () => {
    const { haupt } = teileChronik(baueChronik(roh, { zeigeNebensaechlich: true }));
    expect(haupt).toEqual(baueChronik(roh, { zeigeNebensaechlich: false }));
  });

  it('legt die nebensächlichen Einträge in den zweiten Topf', () => {
    const { neben } = teileChronik(baueChronik(roh, { zeigeNebensaechlich: true }));
    expect(neben.map(e => e.feld.feldId)).toEqual(['D_XYB']);
  });

  it('lässt Ignoriertes in keinem der beiden Töpfe auftauchen', () => {
    const { haupt, neben } = teileChronik(baueChronik(roh, { zeigeNebensaechlich: true }));
    expect([...haupt, ...neben].map(e => e.feld.feldId)).not.toContain('D_STUMM');
  });

  it('gibt für eine leere Chronik zwei leere Töpfe zurück', () => {
    expect(teileChronik([])).toEqual({ haupt: [], neben: [] });
  });
});

describe('chronik — Lücken zwischen Monatsblöcken', () => {
  it('zählt die übersprungenen Monate, nicht den Abstand', () => {
    expect(monateDazwischen('2025-08', '2026-01')).toBe(4);
  });

  it('meldet bei aufeinanderfolgenden Blöcken und über den Jahreswechsel keine Lücke', () => {
    expect(monateDazwischen('2025-12', '2026-01')).toBe(0);
    expect(monateDazwischen('2026-01', '2026-02')).toBe(0);
  });

  it('wird bei gleichem oder rückläufigem Monat nicht negativ', () => {
    expect(monateDazwischen('2026-03', '2026-03')).toBe(0);
    expect(monateDazwischen('2026-05', '2026-02')).toBe(0);
  });

  it('bleibt bei unlesbaren Monaten stumm, statt eine Zahl zu erfinden', () => {
    expect(monateDazwischen('kaputt', '2026-01')).toBe(0);
  });
});
