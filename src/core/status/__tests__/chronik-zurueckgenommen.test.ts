import { describe, it, expect } from 'vitest';
import { baueChronik } from '@/core/status/chronik';
import {
  baueZurueckgenommene, mischeVerlaufZeilen,
} from '@/core/status/chronik-zurueckgenommen';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { AntragsChronikMitId, JournalEintrag } from '@/core/status/journal';
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

function vk(f: StatusFeldEintrag, wert: string, tvId?: string): FeldVorkommen {
  return { feld: f, wert, ...(tvId ? { tvId } : {}) };
}

const ART = feld('D_ART', 'datum', 'normal', 'Rücknahmeempfehlung techn. erstellt');
const AL = feld('D_AL', 'datum', 'normal', 'Nachlieferung Eingang');
const XPC = feld('D_XPC-', 'datum', 'normal', 'PreCheck negativ');
const STATUS = feld('STATUS_TV', 'wert', 'normal', 'Status Teilvorhaben');
const NEBENSACHE = feld('D_XYB', 'datum', 'nebensaechlich', 'Rückruf');
const STUMM = feld('D_STUMM', 'datum', 'ignoriert', 'Verwaltungsvermerk');
const FELDER = [ART, AL, XPC, STATUS, NEBENSACHE, STUMM];

function eintrag(e: Partial<JournalEintrag> & Pick<JournalEintrag, 'art'>): JournalEintrag {
  return {
    stempel: 'abc123', antragId: 'TV1', datum: '2026-08-14', ...e,
  } as JournalEintrag;
}

/** Eine Journal-Chronik, wie `chronikFuerAntraege` sie liefert. */
function chronik(antragId: string, felder: Record<string, JournalEintrag[]>): AntragsChronikMitId {
  return {
    antragId,
    journalAb: '2026-08-05',
    gefuehrt: true,
    letzteAenderung: '2026-08-14',
    felder: Object.entries(felder).map(([f, eintraege]) => ({ feld: f, eintraege })),
  };
}

describe('chronik-zurueckgenommen — was der Export nicht mehr zeigt', () => {
  it('macht aus einer Leerung einen Termin am ALTEN Datum', () => {
    const weg = baueZurueckgenommene(
      [chronik('16KN125431', {
        D_ART: [eintrag({ art: 'geleert', feld: 'D_ART', von: 20260811 })],
      })],
      FELDER, [],
    );
    expect(weg).toHaveLength(1);
    expect(weg[0]).toMatchObject({
      tag: '2026-08-11', art: 'zurueckgenommen', tvIds: ['16KN125431'],
    });
    expect(weg[0]?.feld.feldId).toBe('D_ART');
    expect(weg[0]?.nachTag).toBeUndefined();
  });

  it('macht aus einer Änderung ein „verschoben" mit Ziel', () => {
    const weg = baueZurueckgenommene(
      [chronik('16KN125433', {
        D_AL: [eintrag({ art: 'geaendert', feld: 'D_AL', von: 20260803, nach: 20260811 })],
      })],
      FELDER, [],
    );
    expect(weg[0]).toMatchObject({
      tag: '2026-08-03', art: 'verschoben', nachTag: '2026-08-11',
    });
  });

  it('faltet einen Verbund-Code über seine Träger zu EINER Zeile', () => {
    // `X`-Codes stehen identisch auf jeder TV-Zeile der CSV — ungefaltet stünde
    // die Rücknahme bei einem Vierer-Verbund viermal untereinander.
    const weg = baueZurueckgenommene(
      ['A', 'B', 'C', 'D'].map(id => chronik(id, {
        'D_XPC-': [eintrag({ art: 'geleert', feld: 'D_XPC-', von: 20260810 })],
      })),
      FELDER, [],
    );
    expect(weg).toHaveLength(1);
    expect(weg[0]?.tvIds).toEqual(['A', 'B', 'C', 'D']);
  });

  it('lässt STATUS_TV weg — der Status ist kein Termin', () => {
    const weg = baueZurueckgenommene(
      [chronik('TV1', {
        STATUS_TV: [eintrag({ art: 'geaendert', feld: 'STATUS_TV', von: 'beantragt', nach: 'ablehnungsreif' })],
      })],
      FELDER, [],
    );
    expect(weg).toEqual([]);
  });

  it('lässt Kürzel ohne Katalog-Eintrag weg', () => {
    const weg = baueZurueckgenommene(
      [chronik('TV1', {
        D_UNBEKANNT: [eintrag({ art: 'geleert', feld: 'D_UNBEKANNT', von: 20260811 })],
      })],
      FELDER, [],
    );
    expect(weg).toEqual([]);
  });

  it('lässt `gesetzt` weg — das steht bereits als normaler Termin da', () => {
    const weg = baueZurueckgenommene(
      [chronik('TV1', {
        D_ART: [eintrag({ art: 'gesetzt', feld: 'D_ART', nach: 20260811 })],
      })],
      FELDER, [],
    );
    expect(weg).toEqual([]);
  });

  it('verwirft, was in der aktuellen Chronik wieder dasteht', () => {
    // Korrektur, die auf ihren Ausgangswert zurückgeht: eine durchgestrichene
    // Zeile neben der lebenden Zwillingszeile wäre schlicht falsch.
    const aktuell = baueChronik([vk(ART, '11.08.2026', 'TV1')]);
    const weg = baueZurueckgenommene(
      [chronik('TV1', {
        D_ART: [eintrag({ art: 'geaendert', feld: 'D_ART', von: 20260811, nach: 20260812 })],
      })],
      FELDER, aktuell,
    );
    expect(weg).toEqual([]);
  });

  it('folgt dem Nebensächlich-Schalter und lässt Ignoriertes immer weg', () => {
    const chroniken = [chronik('TV1', {
      D_XYB: [eintrag({ art: 'geleert', feld: 'D_XYB', von: 20260811 })],
      D_STUMM: [eintrag({ art: 'geleert', feld: 'D_STUMM', von: 20260811 })],
    })];
    expect(baueZurueckgenommene(chroniken, FELDER, [])).toEqual([]);
    const mitNeben = baueZurueckgenommene(chroniken, FELDER, [], { zeigeNebensaechlich: true });
    expect(mitNeben.map(z => z.feld.feldId)).toEqual(['D_XYB']);
  });

  it('lässt unlesbare Datumswerte weg, statt sie ans Ende zu sortieren', () => {
    const weg = baueZurueckgenommene(
      [chronik('TV1', {
        D_ART: [
          eintrag({ art: 'geleert', feld: 'D_ART', von: 20260231 }),
          eintrag({ art: 'geleert', feld: 'D_AL', von: 'unbekannt' }),
        ],
      })],
      FELDER, [],
    );
    expect(weg).toEqual([]);
  });

  it('degradiert eine Änderung ohne lesbares Ziel zur Rücknahme', () => {
    const weg = baueZurueckgenommene(
      [chronik('TV1', {
        D_AL: [eintrag({ art: 'geaendert', feld: 'D_AL', von: 20260803, nach: '' })],
      })],
      FELDER, [],
    );
    expect(weg[0]?.art).toBe('zurueckgenommen');
    expect(weg[0]?.nachTag).toBeUndefined();
  });

  it('reicht den Journal-Eintrag durch, damit die Anzeige die Spanne nennen kann', () => {
    const belegt = eintrag({
      art: 'geleert', feld: 'D_ART', von: 20260811,
      unscharf: true, vonDatum: '2026-08-12', bisDatum: '2026-08-14',
    });
    const weg = baueZurueckgenommene([chronik('TV1', { D_ART: [belegt] })], FELDER, []);
    expect(weg[0]?.belegt).toBe(belegt);
  });
});

describe('mischeVerlaufZeilen — eine Achse für beides', () => {
  const aktuell = baueChronik([
    vk(AL, '17.07.2026', 'TV1'),
    vk(XPC, '10.08.2026', 'TV1'),
  ]);
  const weg = baueZurueckgenommene(
    [chronik('TV1', {
      D_ART: [eintrag({ art: 'geleert', feld: 'D_ART', von: 20260811 })],
      D_AL: [eintrag({ art: 'geaendert', feld: 'D_AL', von: 20260803, nach: 20260811 })],
    })],
    FELDER, aktuell,
  );

  it('sortiert Termine und Stornos gemeinsam nach Tag', () => {
    const zeilen = mischeVerlaufZeilen(aktuell, weg);
    expect(zeilen.map(z => z.tag)).toEqual([
      '2026-07-17', '2026-08-03', '2026-08-10', '2026-08-11',
    ]);
    expect(zeilen.map(z => z.art)).toEqual(['termin', 'storno', 'termin', 'storno']);
  });

  it('stellt bei gleichem Tag den Termin vor den Storno', () => {
    const gleich = baueZurueckgenommene(
      [chronik('TV1', {
        D_ART: [eintrag({ art: 'geleert', feld: 'D_ART', von: 20260810 })],
      })],
      FELDER, aktuell,
    );
    const zeilen = mischeVerlaufZeilen(aktuell, gleich);
    const amTag = zeilen.filter(z => z.tag === '2026-08-10');
    expect(amTag.map(z => z.art)).toEqual(['termin', 'storno']);
  });

  it('lässt die Terminfolge unangetastet, wenn es nichts Zurückgenommenes gibt', () => {
    const zeilen = mischeVerlaufZeilen(aktuell, []);
    expect(zeilen.map(z => z.tag)).toEqual(aktuell.map(e => e.tag));
  });
});
