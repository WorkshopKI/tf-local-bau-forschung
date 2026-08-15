/**
 * Der Rechenkern der selbst angelegten Spalten.
 *
 * Zwei Zusagen stehen hier auf dem Prüfstand, weil das ganze Design auf ihnen
 * beruht: **Anzeige und Sortierung sind getrennt** (eine Regel-Spalte sortiert
 * nach der Rangfolge ihres Autors, nicht alphabetisch), und der **Stichtag wird
 * injiziert** (sonst wäre eine Datumsregel zur Projektionszeit eingefroren).
 */
import { describe, it, expect } from 'vitest';
import { berechneZelle } from '../anzeige';
import { feldRefs, alleFeldRefs, hilfeAus } from '../ableitung';
import { loeseFreieFelder, freieFelderSignatur } from '../aufloesung';
import { baueFreiRoh } from '../projektion';
import { spaltenId, herkunftVon, slugVon } from '../typen';
import type { EigeneSpalte, RegelSpalte, SammelSpalte } from '../typen';
import type { CsvSchema } from '@/core/services/csv/types';

const feldSpalte: EigeneSpalte = {
  id: spaltenId('ich', 'qs'), art: 'feld', label: 'QS', feldId: 'D_QS', typ: 'datum',
};

const sammel: SammelSpalte = {
  id: spaltenId('ich', 'letzte-pruefung'), art: 'sammel', label: 'Letzte Prüfung',
  felder: ['D_QS', 'D_AT4'], wahl: 'juengstes',
};

const regel: RegelSpalte = {
  id: spaltenId('ich', 'lage'), art: 'regel', label: 'Lage',
  regeln: [
    { wenn: { feldId: 'D_ABLT', op: 'gefuellt' }, text: 'abgelehnt', farbe: 'danger' },
    { wenn: { feldId: 'D_QS', op: 'gefuellt' }, text: 'in QS', farbe: 'info' },
  ],
  sonst: { text: 'offen' },
};

describe('Feld-Spalte — zeigt den Rohwert, sortiert nach ISO', () => {
  it('deutsches Datum bleibt sichtbar, sortiert aber nach ISO', () => {
    const z = berechneZelle(feldSpalte, { D_QS: '02.03.2026' });
    expect(z.text).toBe('02.03.2026');
    expect(z.sortier).toBe('2026-03-02');
  });

  it('leeres Feld liefert eine leere Zelle', () => {
    expect(berechneZelle(feldSpalte, {}).text).toBe('');
  });

  it('Textfeld sortiert nach sich selbst', () => {
    const s: EigeneSpalte = { ...feldSpalte, typ: 'wert', feldId: 'ORT_AST' };
    expect(berechneZelle(s, { ORT_AST: 'Hannover' })).toMatchObject({
      text: 'Hannover', sortier: 'Hannover',
    });
  });
});

describe('Sammel-Spalte — jüngstes bzw. ältestes gesetztes Datum', () => {
  it('das jüngste gewinnt, das Datum steht im Titel', () => {
    const z = berechneZelle(sammel, { D_QS: '02.03.2026', D_AT4: '10.05.2026' });
    expect(z.text).toBe('D_AT4');
    expect(z.titel).toBe('2026-05-10');
  });

  it('umgekehrte Wahl kehrt das Ergebnis um', () => {
    const z = berechneZelle({ ...sammel, wahl: 'aeltestes' }, { D_QS: '02.03.2026', D_AT4: '10.05.2026' });
    expect(z.text).toBe('D_QS');
  });

  it('bei Gleichstand gewinnt das zuerst gelistete Feld', () => {
    const z = berechneZelle(sammel, { D_QS: '02.03.2026', D_AT4: '02.03.2026' });
    expect(z.text).toBe('D_QS');
  });

  it('ohne lesbares Datum bleibt die Zelle leer', () => {
    expect(berechneZelle(sammel, { D_QS: 'demnächst' }).text).toBe('');
  });
});

describe('Regel-Spalte — erste zutreffende Regel gewinnt', () => {
  it('die frühere Regel schlägt die spätere, auch wenn beide zutreffen', () => {
    const z = berechneZelle(regel, { D_ABLT: '01.01.2026', D_QS: '02.02.2026' });
    expect(z.text).toBe('abgelehnt');
    expect(z.farbe).toBe('danger');
  });

  it('greift keine Regel, gilt „sonst"', () => {
    expect(berechneZelle(regel, {}).text).toBe('offen');
  });

  it('ohne „sonst" bleibt die Zelle leer', () => {
    const ohne: RegelSpalte = { ...regel, sonst: undefined };
    expect(berechneZelle(ohne, {}).text).toBe('');
  });

  it('sortiert nach dem RANG der Regel, nicht nach dem Text', () => {
    // „abgelehnt" (Rang 0) muss vor „in QS" (Rang 1) stehen — alphabetisch
    // wäre es umgekehrt, und genau das wäre die falsche Reihenfolge.
    const a = berechneZelle(regel, { D_ABLT: '01.01.2026' });
    const b = berechneZelle(regel, { D_QS: '01.01.2026' });
    expect(a.sortier).toBe(0);
    expect(b.sortier).toBe(1);
    expect(berechneZelle(regel, {}).sortier).toBe(2);
  });

  it('wertet über ALLE Teilvorhaben einer Verbund-Zeile', () => {
    // Kein TV trägt D_ABLT im eigenen Beutel; das zweite schon.
    const z = berechneZelle(regel, {}, [{ D_QS: '01.01.2026' }, { D_ABLT: '02.02.2026' }]);
    expect(z.text).toBe('abgelehnt');
  });

  it('der Stichtag wird injiziert — ohne ihn trifft eine Zeitregel nicht zu', () => {
    const zeit: RegelSpalte = {
      ...regel,
      regeln: [{ wenn: { feldId: 'D_QS', op: 'tageSeit', tage: 30 }, text: 'liegt lange' }],
      sonst: { text: 'frisch' },
    };
    const roh = { D_QS: '01.01.2026' };
    expect(berechneZelle(zeit, roh, undefined, '2026-06-01').text).toBe('liegt lange');
    expect(berechneZelle(zeit, roh, undefined, '2026-01-05').text).toBe('frisch');
    expect(berechneZelle(zeit, roh).text).toBe('frisch');
  });
});

describe('Feld-Refs — was projiziert werden muss', () => {
  it('sammelt die Felder je Art', () => {
    expect(feldRefs(feldSpalte)).toEqual(['D_QS']);
    expect(feldRefs(sammel)).toEqual(['D_QS', 'D_AT4']);
    expect(feldRefs(regel).sort()).toEqual(['D_ABLT', 'D_QS']);
  });

  it('über mehrere Spalten dedupliziert und stabil sortiert', () => {
    expect(alleFeldRefs([feldSpalte, sammel, regel])).toEqual(['D_ABLT', 'D_AT4', 'D_QS']);
  });
});

describe('Auflösung + Signatur — nur Felder lösen einen Rebuild aus', () => {
  const schema = {
    id: 's1', is_master: true,
    column_mapping: { D_QS: { custom: 'd_qs' }, D_AT4: { canonical: '' } },
  } as unknown as CsvSchema;

  it('gemappte Spalte liefert ihren Record-Key, ungemappte sich selbst', () => {
    const felder = loeseFreieFelder(['D_QS', 'FREMD'], [schema]);
    expect(felder.find(f => f.feldId === 'D_QS')?.recordKey).toBe('d_qs');
    expect(felder.find(f => f.feldId === 'FREMD')?.recordKey).toBe('FREMD');
  });

  it('die Signatur ändert sich mit einem NEUEN Feld …', () => {
    const a = freieFelderSignatur(loeseFreieFelder(['D_QS'], [schema]));
    const b = freieFelderSignatur(loeseFreieFelder(['D_QS', 'D_AT4'], [schema]));
    expect(a).not.toBe(b);
  });

  it('… aber NICHT mit geändertem Text, Farbe oder Reihenfolge der Regeln', () => {
    // Das ist die Zusage „Regeln bearbeiten kostet keinen Neuaufbau".
    const vorher = freieFelderSignatur(loeseFreieFelder(alleFeldRefs([regel]), [schema]));
    const umbenannt: RegelSpalte = {
      ...regel,
      label: 'Ganz anders',
      regeln: [
        { wenn: regel.regeln[1]!.wenn, text: 'völlig neuer Text', farbe: 'success' },
        { wenn: regel.regeln[0]!.wenn, text: 'auch neu' },
      ],
      sonst: { text: 'anders' },
    };
    expect(freieFelderSignatur(loeseFreieFelder(alleFeldRefs([umbenannt]), [schema]))).toBe(vorher);
  });
});

describe('Projektions-Beutel', () => {
  const felder = loeseFreieFelder(['D_QS'], [
    { id: 's', is_master: true, column_mapping: { D_QS: { custom: 'd_qs' } } } as unknown as CsvSchema,
  ]);

  it('liest über den Record-Key, schreibt unter der feldId', () => {
    expect(baueFreiRoh({ d_qs: '02.03.2026' }, felder)).toEqual({ D_QS: '02.03.2026' });
  });

  it('leerer Beutel wird weggelassen — kein leeres Objekt je Antrag', () => {
    expect(baueFreiRoh({}, felder)).toBeUndefined();
    expect(baueFreiRoh({ d_qs: '   ' }, felder)).toBeUndefined();
    expect(baueFreiRoh({ d_qs: 'x' }, [])).toBeUndefined();
  });
});

describe('Ids tragen ihre Herkunft', () => {
  it('persönlich und Team können nicht kollidieren', () => {
    const a = spaltenId('ich', slugVon('Restlaufzeit'));
    const b = spaltenId('team', slugVon('Restlaufzeit'));
    expect(a).not.toBe(b);
    expect(herkunftVon(a)).toBe('ich');
    expect(herkunftVon(b)).toBe('team');
    expect(herkunftVon('aktenzeichen')).toBeNull();
  });

  it('Slug schreibt Umlaute aus und fällt nie auf leer', () => {
    expect(slugVon('Prüfung äußerst')).toBe('pruefung-aeusserst');
    expect(slugVon('!!!')).toBe('spalte');
  });
});

describe('Herkunftsangabe entsteht aus der Definition', () => {
  it('nennt die Regel und die gelesenen Felder', () => {
    const h = hilfeAus(regel, f => (f === 'D_QS' ? 'Qualitätssicherung' : f));
    expect(h.regel).toContain('erste zutreffende');
    expect(h.regel).toContain('„offen"');
    expect(h.felder).toEqual([
      { code: 'D_ABLT', label: 'D_ABLT' },
      { code: 'D_QS', label: 'Qualitätssicherung' },
    ]);
  });

  it('eine eigene Beschreibung schlägt den Standardsatz', () => {
    expect(hilfeAus({ ...sammel, beschreibung: 'Mein Text' }).satz).toBe('Mein Text');
    expect(hilfeAus(sammel).satz).toContain('Selbst angelegte Spalte');
  });
});
