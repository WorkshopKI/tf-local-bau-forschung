/**
 * Die Nachschlagewerke je Katalog-Fassung.
 *
 * Die eigentliche Zusage ist nicht „der Index ist schnell", sondern **„er
 * antwortet exakt wie die Schleifen, die er ersetzt"**. Deshalb steht in jedem
 * Block die alte Formulierung als Orakel daneben — ein Test, der nur den neuen
 * Code gegen sich selbst prüft, wäre eine Tautologie.
 *
 * Die schärfste Falle hat ihren eigenen Block: `ersterWertNachCode` und
 * `zieltageNachCode` sehen aus wie dieselbe Map, wählen aber nach verschiedenen
 * Regeln. Sie zusammenzulegen wäre still falsch gewesen.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  baueVersionIndex, versionIndex, leereVersionIndexCache,
} from '@/core/status/version-index';
import { normKey } from '@/core/status/normalisierung';
import type {
  MappingVersion, StatusFeldEintrag, StatusWertEintrag,
} from '@/core/status/typen';

const feld = (feldId: string, over: Partial<StatusFeldEintrag> = {}): StatusFeldEintrag => ({
  feldId,
  label: `Bezeichnung ${feldId}`,
  typ: 'datum',
  ebene: 'tv',
  prominenzDefault: 'normal',
  aktiv: true,
  unkuratiert: false,
  ...over,
});

const wert = (
  id: string, code: number, over: Partial<StatusWertEintrag> = {},
): StatusWertEintrag => ({
  id,
  feldId: 'status',
  wert: id,
  kategorie: 'sonstige',
  prominenz: 'normal',
  aktiv: true,
  unkuratiert: false,
  code,
  ...over,
});

function fassung(over: Partial<MappingVersion> = {}): MappingVersion {
  return {
    version: 1,
    autor: null,
    zeitstempel: '2026-08-01T00:00:00.000Z',
    kategorien: [],
    felder: [],
    werte: [],
    ...over,
  };
}

// --- Orakel: die Formulierungen, die der Index ersetzt hat -------------------

/** `findeOffenePaare` (waechter.ts) vor der Umstellung. */
function orakelFelderNachCode(v: MappingVersion): Map<string, StatusFeldEintrag> {
  const m = new Map<string, StatusFeldEintrag>();
  for (const f of v.felder) {
    if (f.code) m.set(normKey(f.code), f);
  }
  return m;
}

/** `letzteAktivitaetVon` (waechter.ts) vor der Umstellung. */
function orakelRelevante(v: MappingVersion): Set<string> {
  return new Set(v.felder.filter(f => f.relevant === true).map(f => f.feldId));
}

/** `zieltageFuer` (waechter.ts) vor der Umstellung. */
function orakelZieltage(v: MappingVersion, code: number | null): number | null {
  if (code === null) return null;
  return v.werte.find(w => w.code === code && typeof w.zieltage === 'number')?.zieltage ?? null;
}

/** Der `werte.find` des Boards vor der Umstellung. */
function orakelErsterWert(v: MappingVersion, code: number): StatusWertEintrag | undefined {
  return v.werte.find(w => w.code === code);
}

/** `vorkommenAus` (cockpit-berechnung.ts) vor der Umstellung. */
function orakelNachId(v: MappingVersion): Map<string, StatusFeldEintrag> {
  return new Map(v.felder.map(f => [f.feldId, f]));
}

describe('version-index', () => {
  beforeEach(() => { leereVersionIndexCache(); });

  describe('deckungsgleich mit den ersetzten Schleifen', () => {
    const v = fassung({
      felder: [
        feld('D_AK4', { code: 'AK4', relevant: true }),
        feld('D_AT4', { code: 'AT4' }),
        feld('D_ARK', { code: 'ARK', relevant: true }),
        feld('ohne_code'),
      ],
      werte: [wert('a', 35, { zieltage: 21 }), wert('b', 88)],
    });

    it('felderNachCode: gleiche Schluessel und gleiche Treffer', () => {
      const ist = baueVersionIndex(v).felderNachCode;
      const soll = orakelFelderNachCode(v);
      expect([...ist.keys()].sort()).toEqual([...soll.keys()].sort());
      for (const [k, f] of soll) expect(ist.get(k)).toBe(f);
    });

    it('relevanteFeldIds: gleiche Menge', () => {
      expect([...baueVersionIndex(v).relevanteFeldIds].sort())
        .toEqual([...orakelRelevante(v)].sort());
    });

    it('felderNachId: gleiche Zuordnung', () => {
      const ist = baueVersionIndex(v).felderNachId;
      for (const [k, f] of orakelNachId(v)) expect(ist.get(k)).toBe(f);
    });
  });

  describe('die beiden Code-Maps waehlen NICHT nach derselben Regel', () => {
    // Derselbe Code zweimal: der erste Eintrag traegt KEINE Zieltage, der zweite
    // schon. `zieltageFuer` ueberspringt den ersten, das Board nimmt ihn.
    const v = fassung({
      werte: [
        wert('erst', 35, { zahPhaseId: undefined }),
        wert('dann', 35, { zieltage: 30, zahPhaseId: 'antrag' }),
      ],
    });

    it('zieltageNachCode nimmt den ersten Eintrag MIT numerischen Zieltagen', () => {
      expect(baueVersionIndex(v).zieltageNachCode.get(35)).toBe(30);
      expect(baueVersionIndex(v).zieltageNachCode.get(35)).toBe(orakelZieltage(v, 35));
    });

    it('ersterWertNachCode nimmt den ERSTEN Eintrag, auch ohne zahPhaseId', () => {
      // Genau hier lag die Falle: eine gemeinsame Map haette „dann" geliefert,
      // die zahPhaseId waere gesetzt gewesen — und der Rueckfall des Boards auf
      // SEED_CODE_ZU_ZAH_PHASE haette nie mehr gefeuert.
      const treffer = baueVersionIndex(v).ersterWertNachCode.get(35);
      expect(treffer).toBe(orakelErsterWert(v, 35));
      expect(treffer?.id).toBe('erst');
      expect(treffer?.zahPhaseId).toBeUndefined();
    });

    it('zieltage 0 zaehlt als gepflegt, nicht als fehlend', () => {
      const v0 = fassung({ werte: [wert('null-tage', 7, { zieltage: 0 })] });
      expect(baueVersionIndex(v0).zieltageNachCode.get(7)).toBe(0);
      expect(baueVersionIndex(v0).zieltageNachCode.get(7)).toBe(orakelZieltage(v0, 7));
    });
  });

  it('bei Code-Kollision unter normKey gewinnt der LETZTE — wie die alte Schleife', () => {
    const v = fassung({
      felder: [feld('D_erst', { code: 'ak4' }), feld('D_zweit', { code: 'AK4' })],
    });
    expect(baueVersionIndex(v).felderNachCode.get(normKey('AK4'))?.feldId).toBe('D_zweit');
    expect(baueVersionIndex(v).felderNachCode.get(normKey('AK4')))
      .toBe(orakelFelderNachCode(v).get(normKey('AK4')));
  });

  it('markiert die Fassung nichts als relevant, ist die Menge leer (nicht „alles")', () => {
    // Der Unterschied traegt: die Aufrufer verzweigen auf `size > 0` und
    // betrachten sonst ALLE Vorkommen.
    const v = fassung({ felder: [feld('D_AK4', { code: 'AK4' })] });
    expect(baueVersionIndex(v).relevanteFeldIds.size).toBe(0);
  });

  describe('Memoisierung', () => {
    it('gleiches Objekt rein, gleiches Ergebnis-Objekt raus', () => {
      const v = fassung({ felder: [feld('D_AK4', { code: 'AK4' })] });
      expect(versionIndex(v)).toBe(versionIndex(v));
    });

    it('eine geaenderte Fassung bekommt einen eigenen Index mit neuem Inhalt', () => {
      const v = fassung({ felder: [feld('D_AK4', { code: 'AK4' })] });
      const neu = { ...v, felder: [...v.felder, feld('D_NEU', { code: 'NEU' })] };
      expect(versionIndex(neu)).not.toBe(versionIndex(v));
      expect(versionIndex(neu).felderNachCode.has(normKey('NEU'))).toBe(true);
      expect(versionIndex(v).felderNachCode.has(normKey('NEU'))).toBe(false);
    });

    it('ein ausgetauschtes felder-Array baut neu, auch bei gleichem Inhalt', () => {
      // Der Identitaets-Waechter: wer `v.felder = [...v.felder, x]` schreibt,
      // mutiert dasselbe Fassungs-Objekt — ohne diese Pruefung bekaeme er den
      // alten Index zurueck.
      const v = fassung({ felder: [feld('D_AK4', { code: 'AK4' })] });
      const erst = versionIndex(v);
      const mutiert = v as { felder: StatusFeldEintrag[] };
      mutiert.felder = [...v.felder, feld('D_NEU', { code: 'NEU' })];
      const zweit = versionIndex(v);
      expect(zweit).not.toBe(erst);
      expect(zweit.felderNachCode.has(normKey('NEU'))).toBe(true);
    });

    it('memoisiert liefert dasselbe wie frisch gebaut', () => {
      const v = fassung({
        felder: [feld('D_AK4', { code: 'AK4', relevant: true })],
        werte: [wert('a', 35, { zieltage: 21 })],
      });
      const frisch = baueVersionIndex(v);
      const gecacht = versionIndex(v);
      expect([...gecacht.felderNachCode.keys()]).toEqual([...frisch.felderNachCode.keys()]);
      expect([...gecacht.relevanteFeldIds]).toEqual([...frisch.relevanteFeldIds]);
      expect([...gecacht.zieltageNachCode]).toEqual([...frisch.zieltageNachCode]);
      expect([...gecacht.ersterWertNachCode.keys()])
        .toEqual([...frisch.ersterWertNachCode.keys()]);
    });
  });
});
