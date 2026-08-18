/**
 * Die Zusage der Datums-Sicht: **die genannte Zahl ist die wirksame Zahl.**
 *
 * Ein Kürzel mit Verfahrensschritt, das stillgelegt oder als `ignoriert`
 * ausgeblendet ist, kommt gar nicht erst in die Chronik — es kann kein „seit
 * wann" liefern. Mitgezählt ergäbe es eine Deckung, die die Oberfläche nicht
 * einlöst, und schlimmer: einen Schritt, der als gedeckt gilt, obwohl die Zeile
 * im Bestand fehlt.
 */
import { describe, it, expect } from 'vitest';
import {
  datumsBilanzText, datumsfelderFuerPhase, phasenOhneDatum, speistSeitAngabe,
} from '../phasenDatumsfelder';
import type { GeltendeZahPhase, StatusFeldEintrag } from '@/core/status';

function feld(p: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag {
  return {
    label: p.feldId, typ: 'datum', ebene: 'tv', prominenzDefault: 'normal',
    aktiv: true, unkuratiert: false, ...p,
  } as StatusFeldEintrag;
}

function phase(id: string, label: string): GeltendeZahPhase {
  return {
    id, label, reihenfolge: 10, aktiv: true, zieltageRelevant: true, fristLaeuft: true,
  } as unknown as GeltendeZahPhase;
}

const PHASEN = [phase('eingang', 'Eingang'), phase('pruefung', 'In Prüfung')];

describe('speistSeitAngabe — nur was in der Chronik ankommt', () => {
  it('nimmt ein aktives Datumsfeld normaler Prominenz', () => {
    expect(speistSeitAngabe(feld({ feldId: 'AAE' }))).toBe(true);
  });

  it('lehnt ab, was die Chronik ohnehin auslässt', () => {
    expect(speistSeitAngabe(feld({ feldId: 'a', aktiv: false }))).toBe(false);
    expect(speistSeitAngabe(feld({ feldId: 'b', prominenzDefault: 'ignoriert' }))).toBe(false);
    // Wert- und Textfelder tragen keine Datumsmarke — die Klappe bietet die
    // Auswahl bei `wert` gar nicht erst an.
    expect(speistSeitAngabe(feld({ feldId: 'c', typ: 'wert' }))).toBe(false);
    expect(speistSeitAngabe(feld({ feldId: 'd', typ: 'text' }))).toBe(false);
  });
});

describe('datumsfelderFuerPhase', () => {
  const felder = [
    feld({ feldId: 'XTE', code: 'XTE', zahPhaseId: 'eingang' }),
    feld({ feldId: 'AAE', code: 'AAE', zahPhaseId: 'eingang' }),
    feld({ feldId: 'AZ1', code: 'AZ1', zahPhaseId: 'pruefung' }),
    feld({ feldId: 'tot', code: 'TOT', zahPhaseId: 'eingang', aktiv: false }),
  ];

  it('liefert die Felder des Schritts, nach Code sortiert', () => {
    expect(datumsfelderFuerPhase(felder, 'eingang' as never).map(f => f.code))
      .toEqual(['AAE', 'XTE']);
  });

  it('lässt ein stillgelegtes Feld weg, obwohl es die Phase trägt', () => {
    expect(datumsfelderFuerPhase(felder, 'eingang' as never).map(f => f.code))
      .not.toContain('TOT');
  });
});

describe('phasenOhneDatum — die Lücke, die weh tut', () => {
  it('nennt den Schritt, für den kein Datum einspringt', () => {
    const felder = [feld({ feldId: 'AAE', code: 'AAE', zahPhaseId: 'eingang' })];
    expect(phasenOhneDatum(felder, PHASEN).map(p => p.id)).toEqual(['pruefung']);
  });

  it('zählt ein stillgelegtes Feld NICHT als Deckung', () => {
    // Der gefährlichste Fall: der Schritt sähe gedeckt aus, im Bestand fehlte
    // die Zeile trotzdem.
    const felder = [feld({ feldId: 'x', code: 'X', zahPhaseId: 'pruefung', aktiv: false })];
    expect(phasenOhneDatum(felder, PHASEN).map(p => p.id)).toEqual(['eingang', 'pruefung']);
  });
});

describe('datumsBilanzText', () => {
  it('benennt die ungedeckten Schritte statt sie zu zählen', () => {
    const felder = [feld({ feldId: 'AAE', code: 'AAE', zahPhaseId: 'eingang' })];
    expect(datumsBilanzText(felder, PHASEN))
      .toBe('1 Kürzel liefern das „seit wann" · ohne Datum: In Prüfung');
  });

  it('sagt es ausdrücklich, wenn nichts fehlt — Schweigen läse sich als Fehler', () => {
    const felder = [
      feld({ feldId: 'AAE', code: 'AAE', zahPhaseId: 'eingang' }),
      feld({ feldId: 'AZ1', code: 'AZ1', zahPhaseId: 'pruefung' }),
    ];
    expect(datumsBilanzText(felder, PHASEN))
      .toBe('2 Kürzel liefern das „seit wann" · jeder Schritt ist gedeckt');
  });

  it('kommt ohne Phasen aus, statt „ohne Datum: " mit leerer Liste zu schreiben', () => {
    expect(datumsBilanzText([], [])).toBe('0 Kürzel liefern das „seit wann"');
  });
});
