/**
 * Der Bau der Vorgangsakte. Die wichtigste Zusage steht im ersten Block: kein
 * Bearbeiter-Kürzel verlässt die Akte, auch nicht über den gerenderten Text —
 * mit dem datierten Verlauf daneben wäre das ein Aktivitätsprotokoll.
 */
import { describe, expect, it } from 'vitest';
import { baueVorgangsakte, type AkteEingabe } from '../vorgangsakte';
import { akteZeilen } from '@/core/services/assistent/kontext';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { MappingVersion, StatusFeldEintrag } from '@/core/status/typen';
import type { MeilensteinPlan, VerbundMeilensteine } from '@/core/meilensteine/typen';
import type { AntragListItem } from '@/core/services/csv/types';

const STICHTAG = '2026-08-01T00:00:00.000Z';

function vorTagen(tage: number): string {
  const d = new Date(new Date(STICHTAG).getTime() - tage * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

const feld = (code: string, over: Partial<StatusFeldEintrag> = {}): StatusFeldEintrag => ({
  feldId: `D_${code}`,
  label: `Bezeichnung ${code}`,
  typ: 'datum',
  ebene: 'tv',
  code,
  prominenzDefault: 'normal',
  aktiv: true,
  unkuratiert: false,
  ...over,
});

const FELDER = {
  AAE: feld('AAE'),
  AK4: feld('AK4'),
  AT4: feld('AT4', { rollen: ['fb'] }),
  XTE: feld('XTE', { ebene: 'verbund' }),
  NEBEN: feld('NEB', { prominenzDefault: 'nebensaechlich' }),
};

const fassung: MappingVersion = {
  version: 1, autor: null, zeitstempel: STICHTAG, kategorien: [],
  felder: Object.values(FELDER), werte: [],
};

const vk = (f: StatusFeldEintrag, tage: number, tvId?: string): FeldVorkommen => ({
  feld: f, wert: vorTagen(tage), ...(tvId ? { tvId } : {}),
});

function tv(az: string, over: Record<string, unknown> = {}): AntragListItem {
  return {
    aktenzeichen: az, verbund_id: 'VB-1', titel: `Titel ${az}`, status: 'beantragt',
    antragsdatum: '2026-07-01', tib_kuerz: 'THÜ', bib_kuerz: 'MUE', ...over,
  } as unknown as AntragListItem;
}

function eingabe(over: Partial<AkteEingabe> = {}): AkteEingabe {
  const jeTv = [
    { aktenzeichen: 'AZ-1', vorkommen: [vk(FELDER.AAE, 31, 'AZ-1'), vk(FELDER.AK4, 10, 'AZ-1')] },
    { aktenzeichen: 'AZ-2', vorkommen: [vk(FELDER.AAE, 29, 'AZ-2'), vk(FELDER.NEBEN, 5, 'AZ-2')] },
  ];
  return {
    entitaet: { art: 'verbund', id: 'VB-1' },
    antraege: [tv('AZ-1'), tv('AZ-2', { bib_kuerz: '' })],
    verlauf: {
      version: fassung,
      vorkommen: [...jeTv.flatMap(t => t.vorkommen), vk(FELDER.XTE, 27)],
      jeTeilvorhaben: jeTv,
    },
    meilensteine: null,
    vorgangssystem: true,
    stichtag: STICHTAG,
    ...over,
  };
}

describe('baueVorgangsakte — Personen', () => {
  it('nennt kein Bearbeiter-Kürzel, zählt aber die Besetzung', () => {
    const akte = baueVorgangsakte(eingabe());
    const text = akteZeilen(akte).join('\n');
    expect(text).not.toContain('THÜ');
    expect(text).not.toContain('MUE');
    expect(JSON.stringify(akte)).not.toMatch(/THÜ|MUE/);
    expect(akte.zuweisung).toEqual({ ab: 1, fb: 2, von: 2 });
  });
});

describe('baueVorgangsakte — Zuschnitt', () => {
  it('ein Antrag sieht nur sein Teilvorhaben', () => {
    const akte = baueVorgangsakte(eingabe({ entitaet: { art: 'antrag', id: 'AZ-2' } }));
    expect(akte.fuer).toBe('AZ-2');
    expect(akte.teilvorhaben.map(t => t.aktenzeichen)).toEqual(['AZ-2']);
    expect(akte.offenePaare).toEqual([]); // das offene AK4 gehört AZ-1
    expect(akte.zuweisung?.von).toBe(1);
  });
});

describe('baueVorgangsakte — Signale', () => {
  it('findet das halb offene Paar je Teilvorhaben', () => {
    const akte = baueVorgangsakte(eingabe());
    expect(akte.offenePaare).toHaveLength(1);
    expect(akte.offenePaare[0]).toMatchObject({ tv: 'AZ-1', gesetzt: 'AK4', fehlt: 'AT4', tage: 10, rolle: 'FB' });
  });

  it('ohne Vorgangssystem gibt es weder Paare noch Wächter', () => {
    const akte = baueVorgangsakte(eingabe({ vorgangssystem: false }));
    expect(akte.offenePaare).toEqual([]);
    expect(akte.stillstand).toBeUndefined();
    expect(akte.aufgaben).toEqual([]);
  });

  it('liest Eingänge und Vollständigkeit aus den Katalogfeldern', () => {
    const akte = baueVorgangsakte(eingabe());
    expect(akte.teilvorhaben.map(t => t.eingang)).toEqual([vorTagen(31), vorTagen(29)]);
    expect(akte.vollstaendigAm).toBe(vorTagen(27));
  });

  it('der Verlauf lässt Nebensächliches weg', () => {
    const akte = baueVorgangsakte(eingabe());
    const kuerzel = akte.verlauf?.termine.map(t => t.kuerzel);
    expect(kuerzel).toContain('AK4');
    expect(kuerzel).not.toContain('NEB');
  });

  it('die Frist läuft ab dem Antragseingang und nennt ihre Basis', () => {
    const akte = baueVorgangsakte(eingabe());
    expect(akte.frist?.zustand).toBe('laeuft');
    expect(akte.frist?.text).toMatch(/^läuft, noch \d+ Tage/);
    expect(akte.frist?.basis).toContain('D_AAE');
  });

  it('übersetzt die Meilenstein-Bewertung in Worte', () => {
    const plan = {
      knoten: [{ id: 'k1', nummer: '1.4', label: 'Gutachten beauftragt' }],
    } as unknown as MeilensteinPlan;
    const bewertung = {
      prognose: 'gefaehrdet', restTage: 12, fristDatum: '2026-08-13',
      ergebnisse: [{ knotenId: 'k1', zustand: 'gerissen', sollDatum: '2026-07-22', istDatum: null, abweichungTage: null }],
    } as unknown as VerbundMeilensteine;
    const akte = baueVorgangsakte(eingabe({ meilensteine: { plan, bewertung } }));
    expect(akte.meilensteine).toEqual({
      prognose: 'gefährdet', restTage: 12, fristDatum: '13.08.2026',
      gerissen: ['1.4 Gutachten beauftragt — Soll 22.07.2026, 10 Tage über'], faellig: [],
    });

    // Abgeschlossen misst nichts mehr: keine Resttage, keine gerissenen Knoten —
    // sonst meldete das Modell einen erledigten Vorgang als überfällig.
    const zu = baueVorgangsakte(eingabe({
      meilensteine: { plan, bewertung: { ...bewertung, prognose: 'abgeschlossen', restTage: -303 } },
    }));
    expect(zu.meilensteine).toEqual({ prognose: 'abgeschlossen', restTage: null, gerissen: [], faellig: [] });
  });
});
