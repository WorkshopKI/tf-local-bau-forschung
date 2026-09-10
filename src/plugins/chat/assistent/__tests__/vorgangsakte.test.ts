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
import type { AntragsChronikMitId } from '@/core/status/journal/lesen';
import type { VerlaufsSpur } from '@/core/status/verlauf/typen';
import type { WorkflowRun } from '@/plugins/antraege/gutachten/types';

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

describe('baueVorgangsakte — Journal, eigene Arbeit, Umfeld', () => {
  it('zählt das Journal nur, wenn es geladen ist — und nur die eigenen Anträge', () => {
    expect(baueVorgangsakte(eingabe()).journal).toBeUndefined();
    const chroniken = [
      {
        antragId: 'AZ-1', journalAb: '2026-07-01', gefuehrt: true, letzteAenderung: '2026-07-22',
        felder: [{ feld: 'D_AK4', eintraege: [{ stempel: 's', antragId: 'AZ-1', art: 'geaendert', feld: 'D_AK4', von: 20260701, nach: 20260722, datum: '2026-07-22' }] }],
      },
      {
        antragId: 'AZ-X', journalAb: '2026-07-01', gefuehrt: true, letzteAenderung: '2026-07-02',
        felder: [{ feld: 'D_AAE', eintraege: [{ stempel: 's', antragId: 'AZ-X', art: 'gesetzt', feld: 'D_AAE', nach: 20260701, datum: '2026-07-02' }] }],
      },
    ] as unknown as AntragsChronikMitId[];
    const akte = baueVorgangsakte(eingabe({ journal: chroniken }));
    expect(akte.journal?.aenderungen).toBe(1);
    // AK4 stand am 01.07. im Export, heute am 22.07. — der alte Tag ist verschoben.
    expect(akte.journal?.zurueckgenommen).toBe(1);
    expect(akte.journal?.hinweis).toContain('ab 01.07.2026 belegt');
  });

  it('nennt den Stand der eigenen Arbeit in den Worten der Leiste', () => {
    const akte = baueVorgangsakte(eingabe({
      artefakte: {
        gutachten: { kind: 'fortschritt', freigegeben: 2, gesamt: 7, aktiverSchritt: 'C', aktiverLabel: 'Innovation', aktiverStatus: 'entwurf' },
        nachforderung: { versendet: 1, tvGesamt: 2, naechstesTv: { index: 2, aktenzeichen: 'AZ-2' }, fristKurz: '12.09.' },
        gaRun: {
          schritte: {
            B: {
              qsHinweise: [
                { dimension: 'Kohärenz', bewertung: 'hinweis', text: 'Zahl weicht ab.' },
                { dimension: 'Erdung', bewertung: 'ok', text: 'passt' },
              ],
            },
          },
        } as unknown as WorkflowRun,
      },
    }));
    expect(akte.artefakte).toEqual({
      gutachten: 'Gutachten: 2 von 7 Abschnitten freigegeben; offen ist Abschnitt C (Innovation), im Entwurf.',
      nachforderung: 'Nachforderungen: 1 von 2 Teilvorhaben versandreif; als Nächstes TV 2 (AZ-2); Frist 12.09.',
      pruefHinweise: ['Abschnitt B · Kohärenz: Zahl weicht ab.'],
    });
  });

  it('ohne Artefakte gibt es keine Zeile', () => {
    const akte = baueVorgangsakte(eingabe({ artefakte: { gutachten: null, nachforderung: null, gaRun: null } }));
    expect(akte.artefakte).toBeUndefined();
  });

  it('findet abgelehnte Vorgänger desselben Projekts', () => {
    const alt = tv('ALT-1', { verbund_id: 'VB-0', akronym: '(MUSTER)', status: 'abgelehnt/zurückgezogen' });
    const akte = baueVorgangsakte(eingabe({ akronym: 'MUSTER', alleAntraege: [...eingabe().antraege, alt] }));
    expect(akte.vorgaenger).toEqual(['(MUSTER) (VB-0) — 1 Teilvorhaben, davon 1 abgelehnt oder zurückgezogen']);
  });

  it('zählt die Statusabschnitte nur aus den Spuren der Entität', () => {
    const spuren = [
      { art: 'tv', id: 'AZ-1', zustand: 'verlauf', segmente: [{ statusRef: { roh: 'x', code: 1, lang: 'X' } }, { statusRef: null }] },
      { art: 'tv', id: 'AZ-9', zustand: 'verlauf', segmente: [{ statusRef: { roh: 'y', code: 2, lang: 'Y' } }] },
    ] as unknown as VerlaufsSpur[];
    expect(baueVorgangsakte(eingabe({ spuren })).verlauf?.statusAbschnitte).toBe(1);
  });
});
