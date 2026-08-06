/**
 * Die Datums-Status-Spalten (FB Status / PreCheck Status / alle Ordner-Spalten
 * des Statuskatalogs) und die Datums-Zellen der Termin-Spalten.
 *
 * Beide Spaltenarten trennen ANZEIGE und SORTIERUNG: sortiert wird nach dem
 * Datum, gezeigt wird das Label bzw. das deutsche Datum. Genau diese Trennung
 * ging im Export verloren — `exportValue ?? accessor` schrieb unter „FB Status"
 * ein ISO-Datum. Die Tests halten beide Achsen getrennt fest.
 */
import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { ANTRAG_TABLE_COLUMNS, kategorieStatusColumns } from '../tableColumns';
import type { AntragTableRow } from '../tableGrouping';

function row(patch: Record<string, unknown>): AntragTableRow {
  return { aktenzeichen: '16DL260001', programm_id: 'p1', ...patch } as unknown as AntragTableRow;
}

const fbStatus = ANTRAG_TABLE_COLUMNS.find(c => c.key === 'fb_status')!;
const preCheck = ANTRAG_TABLE_COLUMNS.find(c => c.key === 'precheck_status')!;

describe('Datums-Status-Spalten — Export zeigt das Label, Sortierung das Datum', () => {
  const r = row({ fb_status_label: 'Prüfung läuft', fb_status_datum: '2026-03-14' });

  it('exportValue liefert das Label, nicht das Datum', () => {
    expect(fbStatus.exportValue!(r)).toBe('Prüfung läuft');
  });

  it('accessor bleibt das ISO-Datum — sonst kippt die chronologische Sortierung', () => {
    expect(fbStatus.accessor(r)).toBe('2026-03-14');
  });

  it('ohne Label bleibt der Export leer statt das Datum zu zeigen', () => {
    const ohne = row({ fb_status_datum: '2026-03-14' });
    expect(fbStatus.exportValue!(ohne)).toBe('');
    expect(fbStatus.accessor(ohne)).toBe('2026-03-14');
  });

  it('gilt genauso für die PreCheck-Spalte (dieselbe Factory)', () => {
    const p = row({ precheck_status_label: 'PreCheck positiv', precheck_status_datum: '2026-01-02' });
    expect(preCheck.exportValue!(p)).toBe('PreCheck positiv');
    expect(preCheck.accessor(p)).toBe('2026-01-02');
  });

  it('gilt für JEDE kuratierte Ordner-Spalte — die Liste kommt aus dem Katalog, nicht aus dem Code', () => {
    const spalten = kategorieStatusColumns([
      { kategorieId: 'vb.pruefung', label: 'Prüfung' },
      { kategorieId: 'tv.bewilligung', label: 'Bewilligung' },
    ]);
    expect(spalten).toHaveLength(2);
    const r2 = row({ kat_status: { 'vb.pruefung': { l: 'in Arbeit', d: '2026-05-06' } } });
    for (const s of spalten) {
      expect(s.exportValue).toBeDefined();
    }
    expect(spalten[0]!.exportValue!(r2)).toBe('in Arbeit');
    expect(spalten[0]!.accessor(r2)).toBe('2026-05-06');
    // Ordner ohne Eintrag in dieser Zeile → beide Achsen leer, kein Sentinel.
    expect(spalten[1]!.exportValue!(r2)).toBe('');
    expect(spalten[1]!.accessor(r2)).toBe('');
  });
});

/** Textinhalt einer Datums-Zelle (das `render` liefert ein `<span>` oder `null`). */
function zellText(el: unknown): string | null {
  if (el === null || el === undefined) return null;
  return String((el as ReactElement<{ children?: unknown }>).props.children);
}

describe('Termin-Spalten — deutsche Schreibweise in der Zelle, ISO im Sortier-Wert', () => {
  const datumsSpalten = ['bewilligung_datum', 'erstentscheidung', 'antragsdatum', 'laufzeitbeginn', 'laufzeitende'];

  it('zeigt TT.MM.JJJJ statt des ISO-Rohwerts', () => {
    for (const key of datumsSpalten) {
      const c = ANTRAG_TABLE_COLUMNS.find(x => x.key === key)!;
      expect(zellText(c.render(row({ [key]: '2018-07-30' })))).toBe('30.07.2018');
    }
  });

  it('lässt den Sortier-Wert unangetastet — die Spalten sortieren weiter chronologisch', () => {
    const c = ANTRAG_TABLE_COLUMNS.find(x => x.key === 'antragsdatum')!;
    expect(c.accessor(row({ antragsdatum: '2018-07-30' }))).toBe('2018-07-30');
    // ISO sortiert lexikografisch = chronologisch; das deutsche Format täte das nicht.
    expect(c.accessor(row({ antragsdatum: '2019-01-15' })) > c.accessor(row({ antragsdatum: '2018-12-05' }))).toBe(true);
  });

  it('lässt Werte, die kein Datum sind, unverändert stehen', () => {
    const c = ANTRAG_TABLE_COLUMNS.find(x => x.key === 'laufzeitende')!;
    expect(zellText(c.render(row({ laufzeitende: 'offen' })))).toBe('offen');
  });

  it('leere Zelle bleibt leer (kein „" und kein Platzhalter)', () => {
    const c = ANTRAG_TABLE_COLUMNS.find(x => x.key === 'bewilligung_datum')!;
    expect(c.render(row({}))).toBeNull();
    expect(c.render(row({ bewilligung_datum: '   ' }))).toBeNull();
  });
});
