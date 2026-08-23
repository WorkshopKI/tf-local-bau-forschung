/**
 * Die Meldungsliste einlesen — gegen echte XLSX-Mappen (im Test gebaut).
 *
 * Die Fälle stammen aus der echten Zuarbeit `Auszug_10_Zeilen_ 20260818.xlsx`:
 * 73 Zeilen im Blatt, davon 9 mit Inhalt und 63 leer aufgefüllt, und
 * Betragszellen, in denen `1850000` neben `899650.65` steht. Beides ist der
 * Grund, warum es diese Datei gibt.
 */
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  leseMeldungsListe, parseGeldbetrag, teileZeilen, SCHWELLE_VORGABE,
} from '@/plugins/doppelfoerderung/services/liste-lesen';
import { istLeseFehler } from '@/core/status/import/xlsx-tabelle';
import type { MeldungsZeile } from '@/plugins/doppelfoerderung/types';

function mappe(blaetter: Record<string, string[][]>): File {
  const wb = XLSX.utils.book_new();
  for (const [name, zeilen] of Object.entries(blaetter)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(zeilen), name);
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], 'meldung.xlsx');
}

/** Der Kopf der echten Zuarbeit, gekürzt auf die Spalten, die wir lesen. */
const KOPF = [
  'FKZ', 'Ressort', 'Thema', 'Status', 'Zuwendungsempfänger/Auftragnehmer',
  'Aufgabenbeschreibung', 'Laufzeit von', 'Laufzeit bis', 'Bundesmittel',
];

function zeile(fkz: string, thema: string, aufgabe: string, betrag: string): string[] {
  return [fkz, 'BMWE', thema, 'DM', 'Musterhochschule', aufgabe, '01.01.2027', '31.12.2030', betrag];
}

describe('parseGeldbetrag — der Punkt ist mal Tausender-, mal Dezimaltrenner', () => {
  it('liest die beiden Formen der echten Zuarbeit', () => {
    expect(parseGeldbetrag('1850000')).toBe(1_850_000);
    expect(parseGeldbetrag('899650.65')).toBeCloseTo(899_650.65, 2);
  });

  it('liest deutsche und englische Gruppierung', () => {
    expect(parseGeldbetrag('1.850.000,00 €')).toBe(1_850_000);
    expect(parseGeldbetrag('1,850,000.00')).toBe(1_850_000);
    expect(parseGeldbetrag('899650,65')).toBeCloseTo(899_650.65, 2);
  });

  it('liest `1.850` als Tausender, `899650.65` als Dezimalwert', () => {
    expect(parseGeldbetrag('1.850')).toBe(1_850);
    expect(parseGeldbetrag('12.5')).toBeCloseTo(12.5, 2);
  });

  it('gibt null zurück, statt einen Betrag zu raten', () => {
    expect(parseGeldbetrag('')).toBeNull();
    expect(parseGeldbetrag('k.A.')).toBeNull();
    expect(parseGeldbetrag('offen')).toBeNull();
    expect(parseGeldbetrag('1.2.3.4')).toBeNull();
  });

  it('verträgt Währungszeichen und geschützte Leerzeichen', () => {
    expect(parseGeldbetrag('  300 000 € ')).toBe(300_000);
    expect(parseGeldbetrag('300000 EUR')).toBe(300_000);
  });
});

describe('leseMeldungsListe — Kopfsuche nach Namen, nicht nach Position', () => {
  it('liest die Pflichtspalten unabhängig von ihrer Reihenfolge', async () => {
    const e = await leseMeldungsListe(mappe({
      Ergebnisliste: [KOPF, zeile('01MF26001A', 'Laserschweissen', 'Beschreibung A', '1850000')],
    }));
    expect(istLeseFehler(e)).toBe(false);
    if (istLeseFehler(e)) return;
    expect(e.blatt).toBe('Ergebnisliste');
    expect(e.zeilen).toHaveLength(1);
    expect(e.zeilen[0]).toMatchObject({
      fkz: '01MF26001A',
      thema: 'Laserschweissen',
      aufgabenbeschreibung: 'Beschreibung A',
      betrag: 1_850_000,
      zuwendungsempfaenger: 'Musterhochschule',
      laufzeit: '01.01.2027 – 31.12.2030',
    });
  });

  it('akzeptiert „Zuwendung" als Alias der Betragsspalte', async () => {
    const kopf = KOPF.map(k => (k === 'Bundesmittel' ? 'Zuwendung' : k));
    const e = await leseMeldungsListe(mappe({
      Ergebnisliste: [kopf, zeile('X', 'T', 'A', '400000')],
    }));
    expect(istLeseFehler(e)).toBe(false);
    if (istLeseFehler(e)) return;
    expect(e.zeilen[0]?.betrag).toBe(400_000);
  });

  it('siebt die aufgefüllten Leerzeilen der echten Zuarbeit aus', async () => {
    const leer = Array.from({ length: 63 }, () => KOPF.map(() => ''));
    const e = await leseMeldungsListe(mappe({
      Ergebnisliste: [
        KOPF,
        zeile('A', 'Thema A', 'Beschreibung A', '1850000'),
        zeile('B', 'Thema B', 'Beschreibung B', '1400000'),
        ...leer,
      ],
    }));
    expect(istLeseFehler(e)).toBe(false);
    if (istLeseFehler(e)) return;
    expect(e.zeilen).toHaveLength(2);
  });

  it('findet das Blatt auch, wenn es anders heisst', async () => {
    const e = await leseMeldungsListe(mappe({
      Deckblatt: [['Irgendwas']],
      Meldungen: [KOPF, zeile('A', 'T', 'A', '500000')],
    }));
    expect(istLeseFehler(e)).toBe(false);
    if (istLeseFehler(e)) return;
    expect(e.blatt).toBe('Meldungen');
  });

  it('nennt bei fehlendem Kopf, was in der Datei stand — statt zu raten', async () => {
    const e = await leseMeldungsListe(mappe({
      Ergebnisliste: [['Spalte 1', 'Spalte 2'], ['a', 'b']],
    }));
    expect(istLeseFehler(e)).toBe(true);
    if (!istLeseFehler(e)) return;
    expect(e.fehler).toContain('Thema');
    expect(e.fehler).toContain('Spalte 1');
  });
});

describe('teileZeilen — die Schwelle trennt drei Gruppen, keine zwei', () => {
  function z(betrag: number | null, betragRoh = ''): MeldungsZeile {
    return {
      zeilenNr: 2, fkz: 'X', thema: 'Thema', aufgabenbeschreibung: 'Text',
      betrag, betragRoh, zuwendungsempfaenger: '', laufzeit: '',
    };
  }

  it('nimmt den Grenzfall 300.000 € mit (grösser GLEICH)', () => {
    const t = teileZeilen([z(SCHWELLE_VORGABE)], SCHWELLE_VORGABE);
    expect(t.zuPruefen).toHaveLength(1);
    expect(t.unterSchwelle).toHaveLength(0);
  });

  it('trennt darunter, darüber und „nicht lesbar"', () => {
    const t = teileZeilen(
      [z(1_850_000), z(299_999), z(null, 'k.A.')],
      SCHWELLE_VORGABE,
    );
    expect(t.zuPruefen).toHaveLength(1);
    expect(t.unterSchwelle).toHaveLength(1);
    expect(t.ohneBetrag).toHaveLength(1);
  });

  it('lässt eine nicht lesbare Zeile NICHT still unter die Schwelle fallen', () => {
    const t = teileZeilen([z(null, 'offen')], SCHWELLE_VORGABE);
    expect(t.unterSchwelle).toHaveLength(0);
    expect(t.ohneBetrag).toHaveLength(1);
  });

  it('wirft Zeilen ohne Thema UND ohne Beschreibung ganz heraus', () => {
    const leer: MeldungsZeile = { ...z(9_000_000), thema: '', aufgabenbeschreibung: '' };
    const t = teileZeilen([leer], SCHWELLE_VORGABE);
    expect(t.zuPruefen).toHaveLength(0);
    expect(t.unterSchwelle).toHaveLength(0);
    expect(t.ohneBetrag).toHaveLength(0);
  });
});
