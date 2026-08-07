/**
 * Die **Kaskade** des Haltedatums — drei Quellen und eine vierte Antwort.
 *
 * Zwei Zusagen, die man ohne Test garantiert falsch macht:
 *
 * 1. **Die Reihenfolge ist die Aussage.** Belegt (Journal) schlägt genähert
 *    (Datumsfeld) schlägt rekonstruiert (Verlauf). Wer sie umdreht, ersetzt
 *    eine Beobachtung durch eine Herleitung, ohne dass es jemand sieht.
 * 2. **Nichts wird geraten.** Sind alle drei leer, kommt `null` — kein
 *    ersatzweises „heute", kein Eingangsdatum als Notnagel.
 */
import { describe, expect, it } from 'vitest';
import { ermittleHaltedatum, type VerlaufHalt } from '../haltedatum';
import type { JournalEintrag } from '../journal/typen';
import type { FeldVorkommen } from '../feld-aufloesung';
import type { MappingVersion, StatusFeldEintrag } from '../typen';

const PHASE = 'abgeschlossen';

const FELD: StatusFeldEintrag = {
  feldId: 'd_abb', label: 'Abbruch', typ: 'datum', ebene: 'tv',
  code: 'ABB', zahPhaseId: PHASE, prominenzDefault: 'normal',
  aktiv: true, unkuratiert: false,
};

const VERSION: MappingVersion = {
  version: 1, autor: null, zeitstempel: '2026-08-07T00:00:00.000Z',
  felder: [FELD], werte: [],
};

const VORKOMMEN: FeldVorkommen[] = [{ feld: FELD, wert: '11.02.2019' }];

const JOURNAL: JournalEintrag[] = [{
  stempel: '2020-03-04', antragId: 'AZ1', datum: '2020-03-04',
  art: 'geaendert', feld: 'STATUS_TV', von: 'beantragt', nach: 'abgelehnt',
}];

const VERLAUF: VerlaufHalt = {
  tag: '2021-07-15', konfidenz: 'trigger_bestaetigt', kuerzel: 'ABB', code: 73,
};

describe('Die Reihenfolge der Quellen', () => {
  it('nimmt das Journal, auch wenn Datumsfeld und Verlauf etwas anderes sagen', () => {
    const h = ermittleHaltedatum({
      version: VERSION, zahPhase: PHASE,
      vorkommen: VORKOMMEN, statusJournal: JOURNAL, verlauf: VERLAUF,
    });
    expect(h).toEqual({ tag: '2020-03-04', herkunft: 'journal' });
  });

  it('nimmt das Datumsfeld, wenn kein Journal da ist — vor dem Verlauf', () => {
    const h = ermittleHaltedatum({
      version: VERSION, zahPhase: PHASE, vorkommen: VORKOMMEN, verlauf: VERLAUF,
    });
    expect(h).toEqual({ tag: '2019-02-11', herkunft: 'datumsfeld' });
  });

  it('nimmt den Verlauf, wenn beide davor schweigen', () => {
    const h = ermittleHaltedatum({ version: VERSION, zahPhase: PHASE, verlauf: VERLAUF });
    expect(h).toEqual({ tag: '2021-07-15', herkunft: 'verlauf_bestaetigt' });
  });
});

describe('Die Konfidenz wandert in die Herkunft', () => {
  it('unterscheidet bestätigte von bedingten Kanten', () => {
    const bedingt = ermittleHaltedatum({
      version: VERSION, zahPhase: PHASE,
      verlauf: { ...VERLAUF, konfidenz: 'trigger_bedingt' },
    });
    expect(bedingt?.herkunft).toBe('verlauf_bedingt');
  });
});

describe('Geraten wird nichts', () => {
  it('liefert null, wenn alle drei Quellen schweigen', () => {
    expect(ermittleHaltedatum({ version: VERSION, zahPhase: PHASE })).toBeNull();
  });

  it('liefert null ohne ZAH-Phase — auch mit Verlauf', () => {
    // Ein Marker steht neben dem Verfahren; ihn zu datieren hieße, ihn in eine
    // Phase zu stecken, die er bewusst nicht hat.
    expect(ermittleHaltedatum({
      version: VERSION, zahPhase: null, verlauf: VERLAUF, statusJournal: JOURNAL,
    })).toBeNull();
  });

  it('nimmt ein ausdrückliches null wie ein fehlendes', () => {
    expect(ermittleHaltedatum({ version: VERSION, zahPhase: PHASE, verlauf: null })).toBeNull();
  });
});
