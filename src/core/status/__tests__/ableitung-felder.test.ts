import { describe, it, expect } from 'vitest';
import { leiteStatusAb } from '@/core/status/ableitung';
import { baueSeedVersion } from '@/core/status/seed';
import {
  KATEGORIE_ZU_SPINE, SPINE_ZU_KATEGORIE, kategorieFuerFeld,
} from '@/core/status/spine-kategorie';
import type { MappingVersion, StatusFeldEintrag } from '@/core/status/typen';

const SEED = baueSeedVersion();

/** Fassung mit einem zusätzlichen, frei konfigurierten Code-Feld. */
function mitFeld(p: Partial<StatusFeldEintrag> & { feldId: string }): MappingVersion {
  const feld: StatusFeldEintrag = {
    label: p.feldId, typ: 'datum', ebene: 'tv',
    prominenzDefault: 'normal', aktiv: true, unkuratiert: false, ...p,
  };
  return { ...SEED, felder: [...SEED.felder, feld] };
}

describe('Ableitung: Datums- und Textfelder', () => {
  it('hebt die Phase, wenn das Feld einen Rang trägt', () => {
    const v = mitFeld({ feldId: 'D_ZZQS', spinePhase: 'fachpruefung', rang: 32 });
    const r = leiteStatusAb(v, {}, { TV1: { status: 'beantragt', D_ZZQS: '05.03.2026' } });
    expect(r.spinePhase).toBe('fachpruefung');
    expect(r.kategorie).toBe('in_pruefung');
    expect(r.fuehrenderWert?.feldId).toBe('D_ZZQS');
  });

  it('trägt ohne Rang nicht bei — so ist der ganze Code-Katalog ausgeliefert', () => {
    const v = mitFeld({ feldId: 'D_ZZQS', spinePhase: 'fachpruefung' });
    const r = leiteStatusAb(v, {}, { TV1: { status: 'beantragt', D_ZZQS: '05.03.2026' } });
    expect(r.spinePhase).toBe('eingang');
    const b = r.beitraege.find(x => x.feldId === 'D_ZZQS');
    expect(b?.beruecksichtigt).toBe(false);
    expect(b?.grund).toBe('rang-0');
  });

  it('trägt nicht bei, wenn das Feld stillgelegt ist', () => {
    const v = mitFeld({ feldId: 'D_ZZQS', spinePhase: 'fachpruefung', rang: 32, aktiv: false });
    const r = leiteStatusAb(v, {}, { TV1: { D_ZZQS: '05.03.2026' } });
    expect(r.beitraege.find(x => x.feldId === 'D_ZZQS')?.grund).toBe('inaktiv');
    expect(r.spinePhase).toBe('keine');
  });

  it('ignoriert ein unlesbares Datum, statt die Phase daran zu heben', () => {
    const v = mitFeld({ feldId: 'D_ZZQS', spinePhase: 'fachpruefung', rang: 32 });
    const r = leiteStatusAb(v, {}, { TV1: { status: 'beantragt', D_ZZQS: 'k.A.' } });
    expect(r.spinePhase).toBe('eingang');
    expect(r.beitraege.some(x => x.feldId === 'D_ZZQS')).toBe(false);
  });

  it('wertet ein Textfeld nach demselben Muster, ohne Datumsprüfung', () => {
    const v = mitFeld({ feldId: 'T_ZZ', typ: 'text', spinePhase: 'bewilligung', rang: 40 });
    const r = leiteStatusAb(v, {}, { TV1: { T_ZZ: 'irgendein Vermerk' } });
    expect(r.spinePhase).toBe('bewilligung');
  });

  it('lässt ein terminales Feld den höheren Rang schlagen', () => {
    const v = mitFeld({ feldId: 'D_ZZABL', spinePhase: 'fachpruefung', rang: 38, terminal: true });
    const r = leiteStatusAb(v, { verbund_status: 'bewilligt' }, { TV1: { D_ZZABL: '01.04.2026' } });
    expect(r.terminal).toBe(true);
    expect(r.kategorie).toBe('abgelehnt');
    expect(r.fuehrenderWert?.feldId).toBe('D_ZZABL');
  });

  it('lässt eine explizite Kategorie am Feld gewinnen', () => {
    const v = mitFeld({
      feldId: 'D_ZZNF', spinePhase: 'fachpruefung', rang: 31, kategorie: 'nachforderung',
    });
    const r = leiteStatusAb(v, {}, { TV1: { D_ZZNF: '01.04.2026' } });
    expect(r.kategorie).toBe('nachforderung');
  });

  it('lässt bei Gleichstand das Wert-Feld gewinnen (deterministischer Tie-Break)', () => {
    const v = mitFeld({ feldId: 'D_ZZQS', spinePhase: 'fachpruefung', rang: 30 });
    const r = leiteStatusAb(v, {}, { TV1: { status: 'gutachten fertig', D_ZZQS: '05.03.2026' } });
    // 'D_ZZQS' < 'status' alphabetisch — der Tie-Break ist stabil, nicht zufällig.
    expect(r.spinePhase).toBe('fachpruefung');
    expect(leiteStatusAb(v, {}, { TV1: { status: 'gutachten fertig', D_ZZQS: '05.03.2026' } }))
      .toEqual(r);
  });
});

describe('Ableitung: Konflikt bleibt eine Frage der Wert-Felder', () => {
  it('meldet KEINEN Konflikt zwischen Antragseingang und laufender Fachprüfung', () => {
    // Der Regelfall: fast jeder Antrag hat ein Eingangsdatum. Zählte es als
    // widersprüchliches Statussignal, leuchtete das Konflikt-Abzeichen überall.
    const r = leiteStatusAb(SEED, {}, {
      TV1: { antragsdatum: '2026-01-15', status: 'gutachten fertig' },
    });
    expect(r.spinePhase).toBe('fachpruefung');
    expect(r.konflikt).toBe(false);
  });

  it('meldet weiterhin einen Konflikt zwischen zwei widersprüchlichen Wert-Feldern', () => {
    const r = leiteStatusAb(SEED, {}, {
      TV1: { status: 'beantragt' }, TV2: { status: 'gutachten fertig' },
    });
    expect(r.konflikt).toBe(true);
  });
});

describe('spine-kategorie', () => {
  it('ist in beiden Richtungen konsistent', () => {
    for (const [phase, kategorie] of Object.entries(SPINE_ZU_KATEGORIE)) {
      if (phase === 'vollstaendigkeit') continue;   // dokumentierte Ausnahme (siehe Modul-Kopf)
      expect(KATEGORIE_ZU_SPINE[kategorie]).toBe(phase);
    }
  });

  it('macht aus einem terminalen Feld in der Fachprüfung eine Ablehnung', () => {
    expect(kategorieFuerFeld('fachpruefung', true)).toBe('abgelehnt');
    expect(kategorieFuerFeld('fachpruefung', false)).toBe('in_pruefung');
  });

  it('lässt die explizite Kategorie immer gewinnen', () => {
    expect(kategorieFuerFeld('fachpruefung', true, 'begleitung')).toBe('begleitung');
  });
});

describe('Auslieferungs-Seed in der Ableitung', () => {
  it('leitet aus dem Antragseingang allein „Eingang" ab', () => {
    const r = leiteStatusAb(SEED, {}, { TV1: { antragsdatum: '2026-01-15' } });
    expect(r.spinePhase).toBe('eingang');
    expect(r.konflikt).toBe(false);
  });

  it('lässt das Bewilligungsdatum die Phase auf Bewilligung heben', () => {
    const r = leiteStatusAb(SEED, {}, {
      TV1: { antragsdatum: '2026-01-15', bewilligung_datum: '2026-05-02' },
    });
    expect(r.spinePhase).toBe('bewilligung');
  });

  it('lässt einen terminalen Status das Bewilligungsdatum schlagen', () => {
    const r = leiteStatusAb(SEED, {}, {
      TV1: { bewilligung_datum: '2026-05-02', status: 'abgelehnt/zurückgezogen' },
    });
    expect(r.terminal).toBe(true);
    expect(r.kategorie).toBe('abgeschlossen');
  });

  it('lässt die ausgelieferten Code-Felder ohne Rang die Phase unberührt', () => {
    const ohne = leiteStatusAb(SEED, {}, { TV1: { status: 'beantragt' } });
    const mit = leiteStatusAb(SEED, {}, {
      TV1: { status: 'beantragt', d_ars: '01.02.2026', 'd_abl10': '01.03.2026' },
    });
    expect(mit.spinePhase).toBe(ohne.spinePhase);
  });
});
