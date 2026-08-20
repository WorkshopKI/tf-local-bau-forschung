/**
 * **Die Liste sagt, was sie zeigt** — Regressionsgatter der Bug-Jagd v4.121.
 *
 * Sieben Befunde derselben Familie: irgendwo behauptete die Oberfläche eine
 * Menge, eine Reihenfolge oder eine Einheit, die die Liste darunter nicht
 * einlöste. Jede Zeile hier hält genau einen davon fest.
 *
 * Rein, ohne DOM: die Fixes sitzen in reinen Funktionen bzw. im Store, und
 * genau dort werden sie geprüft.
 */
import { describe, it, expect } from 'vitest';
import type { AntragListItem, CsvSchema } from '@/core/services/csv/types';
import { asAntragStatusRaw } from '@/core/services/csv/types';
import { MS_PER_DAY } from '@/core/services/csv/frist';
import { rohSpaltenJeFeld } from '@/core/services/csv/spalten-inventar';
import { getSortOption } from '../sort';
import { tvsVonZeilen, archivAufschluesselung } from '../arbeitsvorrat';
import { beschraenkeAufSichtbare } from '../tabellenSicht';
import { baueSpaltenHilfe } from '../spaltenHilfe';
import { getEffectiveTableGroupingMode } from '../store';

const ANTRAGSDATUM = '2026-01-01T00:00:00.000Z';

function antrag(
  aktenzeichen: string, status: string, extra?: Partial<AntragListItem>,
): AntragListItem {
  return {
    aktenzeichen,
    programm_id: 'P',
    status: asAntragStatusRaw(status),
    antragsdatum: ANTRAGSDATUM,
    ...extra,
  } as AntragListItem;
}

// ---------------------------------------------------------------------------
// B2 · Die Sortierung „Frist (kürzeste)" liest dieselbe Uhr wie die Spalte
// ---------------------------------------------------------------------------

describe('Sortierung „Frist (kürzeste)" — angehaltene Uhren sinken ans Ende', () => {
  const compare = getSortOption('frist_asc').compare;

  it('ein abgelehnter Altfall mit gesetztem frist_datum steht NICHT vor einem laufenden', () => {
    // Genau der gemessene Fall: „Ablehnung" trägt im Export weiterhin ein
    // `frist_datum`, aber in dieser Phase läuft keine Uhr. Über das Rohfeld
    // sortiert stand er mit „seit 853 T" an der Spitze, während die Spalte
    // daneben „angehalten" zeigte.
    const angehalten = antrag(
      'ALT', 'Ablehnung',
      { antragsdatum: '2015-01-01T00:00:00.000Z', frist_datum: '2015-04-01T00:00:00.000Z' },
    );
    const laeuft = antrag('NEU', 'in Prüfung');
    expect(compare(angehalten, laeuft)).toBeGreaterThan(0);
    expect([angehalten, laeuft].sort(compare).map(a => a.aktenzeichen)).toEqual(['NEU', 'ALT']);
  });

  it('zwei laufende Uhren bleiben nach Restlaufzeit geordnet', () => {
    const frueher = antrag('A', 'in Prüfung', { antragsdatum: new Date(Date.now() - 80 * MS_PER_DAY).toISOString() });
    const spaeter = antrag('B', 'in Prüfung', { antragsdatum: new Date(Date.now() - 10 * MS_PER_DAY).toISOString() });
    expect([spaeter, frueher].sort(compare).map(a => a.aktenzeichen)).toEqual(['A', 'B']);
  });

  it('ohne jede Uhr entscheidet das Aktenzeichen — stabil, nicht zufällig', () => {
    const a = antrag('ZZZ', 'Ablehnung', { antragsdatum: undefined });
    const b = antrag('AAA', 'Ablehnung', { antragsdatum: undefined });
    expect([a, b].sort(compare).map(x => x.aktenzeichen)).toEqual(['AAA', 'ZZZ']);
  });
});

// ---------------------------------------------------------------------------
// B3 · „Gruppierung: Keine" ist auch im Reiter „Fristen" wählbar
// ---------------------------------------------------------------------------

describe('Tabellen-Gruppierung — „Keine" überlebt im Reiter mit abweichendem Standard', () => {
  it('„Fristen" öffnet gruppiert (Standard „frist")', () => {
    expect(getEffectiveTableGroupingMode('fristen', {})).toBe('frist');
  });

  it('ein Override auf „none" gilt — er darf nicht auf den Standard zurückfallen', () => {
    // Bis v4.121 löschte der Setter den Override bei `'none'`; der Selektor
    // fiel danach auf `standardTableGrouping('fristen') === 'frist'` zurück.
    // Das Segment sprang zurück und die Bänder blieben stehen.
    expect(getEffectiveTableGroupingMode('fristen', { fristen: 'none' })).toBe('none');
  });

  it('in einem Reiter mit Standard „none" ist „none" kein Override', () => {
    expect(getEffectiveTableGroupingMode('alle', {})).toBe('none');
    expect(getEffectiveTableGroupingMode('alle', { alle: 'none' })).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// B5 · Was die Ansicht zeigt, ist die Grundlage der Massen-Aktionen
// ---------------------------------------------------------------------------

describe('beschraenkeAufSichtbare — der zweite Schnitt', () => {
  const liste = [antrag('A', 'x'), antrag('B', 'x'), antrag('C', 'x')];

  it('ohne Meldung bleibt die Liste unverändert (Karten-Ansicht, erster Render)', () => {
    expect(beschraenkeAufSichtbare(liste, null).map(a => a.aktenzeichen)).toEqual(['A', 'B', 'C']);
  });

  it('mit Meldung bleibt nur, was auch dasteht', () => {
    const sichtbar = new Set(['B']);
    expect(beschraenkeAufSichtbare(liste, sichtbar).map(a => a.aktenzeichen)).toEqual(['B']);
  });

  it('die Reihenfolge ist die der Liste, nicht die der Meldung', () => {
    const sichtbar = new Set(['C', 'A']);
    expect(beschraenkeAufSichtbare(liste, sichtbar).map(a => a.aktenzeichen)).toEqual(['A', 'C']);
  });
});

// ---------------------------------------------------------------------------
// B14 · Dasselbe Band trägt dieselbe Einheit
// ---------------------------------------------------------------------------

describe('tvsVonZeilen — Bänder zählen Teilvorhaben, nicht Zeilen', () => {
  const tv = (az: string) => antrag(az, 'in Prüfung');

  it('eine Verbund-Zeile liefert ihre Teilvorhaben', () => {
    const zeilen = [
      { ...tv('LEAD'), _verbund: { tvs: [tv('A'), tv('B'), tv('C')] } },
      tv('SOLO'),
    ];
    expect(tvsVonZeilen(zeilen).map(a => a.aktenzeichen)).toEqual(['A', 'B', 'C', 'SOLO']);
  });

  it('ohne Verdichtung ist Zeile = Teilvorhaben', () => {
    expect(tvsVonZeilen([tv('A'), tv('B')])).toHaveLength(2);
  });

  it('leer bleibt leer — kein Band ohne Inhalt', () => {
    expect(tvsVonZeilen([])).toEqual([]);
  });

  it('EINE Menge für Zähler UND Aufschlüsselung — die Summe kann nicht driften', () => {
    // Der Fehler, den das Angleichen der Einheit erst erzeugt hat: Zähler über
    // die TVs, Aufschlüsselung darunter über die Zeilen — „571" stand über
    // „Schlussvermerk 32 · abgel./zurückgez. 364".
    const zeilen = [
      {
        ...antrag('L', 'Schlussvermerk'),
        _verbund: { tvs: [antrag('A', 'Schlussvermerk'), antrag('B', 'abgelehnt/zurückgezogen')] },
      },
    ];
    const tvs = tvsVonZeilen(zeilen);
    const a = archivAufschluesselung(tvs);
    expect(tvs).toHaveLength(2);
    expect(a.schlussvermerk + a.abgelehntZurueckgezogen).toBe(tvs.length);
  });
});

// ---------------------------------------------------------------------------
// B6 / B16 · Der Herkunfts-Hinweis steht nur da, wo er stimmt
// ---------------------------------------------------------------------------

function schema(mapping: CsvSchema['column_mapping']): CsvSchema {
  // Nur `column_mapping` zählt für die Auflösung — der Rest ist Beiwerk.
  return { id: 'S', programm_id: 'P', column_mapping: mapping } as unknown as CsvSchema;
}

describe('rohSpaltenJeFeld — custom-Mappings sind Mappings', () => {
  it('findet eine Spalte, die per `custom` auf ein Feld zeigt', () => {
    const karte = rohSpaltenJeFeld([schema({ ORT_AST: { custom: 'ort_ast', label: 'Ort AST' } })]);
    expect(karte.get('ort_ast')).toEqual([{ code: 'ORT_AST', label: 'Ort AST' }]);
  });

  it('kanonisch bleibt kanonisch', () => {
    const karte = rohSpaltenJeFeld([schema({ D_AAE: { canonical: 'antragsdatum', label: 'Eingang' } })]);
    expect(karte.get('antragsdatum')).toEqual([{ code: 'D_AAE', label: 'Eingang' }]);
  });

  it('`ignore` zählt nicht — eine weggeworfene Spalte speist kein Feld', () => {
    const karte = rohSpaltenJeFeld([schema({ X: { custom: 'ort_ast', ignore: true } })]);
    expect(karte.has('ort_ast')).toBe(false);
  });
});

describe('baueSpaltenHilfe — „keine Spalte gemappt" nur wo die Zelle wirklich leer bleibt', () => {
  const OHNE = 'In diesem Programm ist dafür keine Spalte gemappt';

  it('KEIN Hinweis über einer Spalte, deren Feld per `custom` gespeist wird', () => {
    // Der gemessene Fall: „Ort AST" ist in beiden Schemas `custom: 'ort_ast'`
    // und in 12 295 von 12 295 Zeilen gefüllt — der Warnsatz stand trotzdem da.
    const karte = baueSpaltenHilfe({
      schemas: [schema({ ORT_AST: { custom: 'ort_ast', label: 'Ort AST' } })],
    });
    expect(karte.get('ort_ast')?.hinweis).toBeUndefined();
    expect(karte.get('ort_ast')?.felder).toEqual([{ code: 'ORT_AST', label: 'Ort AST' }]);
  });

  it('Hinweis über einer garantiert leeren Feld-Spalte OHNE kanonischen Eintrag', () => {
    // „Branche" ist projiziert, aber nicht kanonisch — bis v4.121 fiel sie
    // durch die Hinweis-Regel und blieb die einzige leere Spalte ohne Grund.
    const karte = baueSpaltenHilfe({
      schemas: [schema({ D_AAE: { canonical: 'antragsdatum' } })],
    });
    expect(karte.get('branche')?.hinweis).toContain(OHNE);
    expect(karte.get('foerdergeber')?.hinweis).toContain(OHNE);
  });

  it('KEIN Hinweis an abgeleiteten Spalten — sie rechnen oder laden nach', () => {
    const karte = baueSpaltenHilfe({ schemas: [schema({ D_AAE: { canonical: 'antragsdatum' } })] });
    for (const key of ['frist', 'antrag', 'zustaendig', 'vb_phase', 'verbund_titel']) {
      expect(karte.get(key)?.hinweis, `${key} trägt einen Hinweis, den es nicht tragen darf`)
        .toBeUndefined();
    }
  });

  it('ohne geladenes Schema gar kein Hinweis — die Aussage wäre bloß verfrüht', () => {
    const karte = baueSpaltenHilfe({ schemas: [] });
    expect(karte.get('branche')?.hinweis).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// B7 · Die Frist-Hilfe nennt nur Felder, die der Rechenweg auch liest
// ---------------------------------------------------------------------------

describe('Frist-Hilfe — Feldliste = Rechenweg', () => {
  it('nennt D_AAE und D_VBE, aber NICHT D_XTE', () => {
    // `D_XTE` steht in der schlanken Projektion nicht zur Verfügung; die Zelle
    // ruft `berechneFrist` ohne `alleAntraegeDa`. Eine Feldliste, die es nennt,
    // schickt die Suche nach dem Grund in die Irre.
    const codes = baueSpaltenHilfe({ schemas: [] }).get('frist')?.felder?.map(f => f.code);
    expect(codes).toEqual(['D_AAE', 'D_VBE']);
  });

  it('die Regel spricht nicht mehr vom „späteren der beiden Eingangsdaten"', () => {
    const regel = baueSpaltenHilfe({ schemas: [] }).get('frist')?.regel ?? '';
    expect(regel).not.toContain('späteren der beiden');
    expect(regel).toContain('Antragseingang');
  });
});
