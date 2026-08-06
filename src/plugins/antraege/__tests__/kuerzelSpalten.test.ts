import { describe, it, expect } from 'vitest';
import { gruppiereSpalten } from '@/components/data-table';
import {
  ANTRAG_TABLE_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  G_ORDNER,
  G_ORDNER_TV,
  G_ORDNER_VB,
  kategorieStatusColumns,
  resolveAntragTableColumns,
  spaltenHinweis,
} from '../tableColumns';
import { reicheNeueStandardspaltenNach } from '../useAntraegeColumnsStore';
import type { AntragTableRow } from '../tableGrouping';

function row(over: Partial<AntragTableRow> = {}): AntragTableRow {
  return {
    aktenzeichen: '16KN123401',
    programm_id: 'p',
    _updated_at: '2026-01-01T00:00:00.000Z',
    ...over,
  } as AntragTableRow;
}

const KUERZEL_KEYS = ['tib_kuerz', 'bib_kuerz', 'ztp_kuerz', 'pfm_kuerz'] as const;

describe('Zustaendigkeits-Spalten (TIB/BIB/ZTP/PFM)', () => {
  it('bietet alle vier Kuerzel-Spalten an', () => {
    const keys = ANTRAG_TABLE_COLUMNS.map(c => c.key);
    for (const k of KUERZEL_KEYS) expect(keys).toContain(k);
  });

  it('blendet NUR das AB-Kuerzel (BIB) zusaetzlich standardmaessig ein', () => {
    expect(DEFAULT_VISIBLE_COLUMN_KEYS).toContain('bib_kuerz');
    // Die Begleit-Spalten sind fuer die meisten Sichten leer — anbieten ja,
    // erzwingen nein.
    expect(DEFAULT_VISIBLE_COLUMN_KEYS).not.toContain('ztp_kuerz');
    expect(DEFAULT_VISIBLE_COLUMN_KEYS).not.toContain('pfm_kuerz');
    // tib_kuerz bleibt wie bisher aus (wird im Uebersichtsmodus erzwungen).
    expect(DEFAULT_VISIBLE_COLUMN_KEYS).not.toContain('tib_kuerz');
  });

  it('steht in der Registry direkt hinter dem FKZ, in Verfahrens-Reihenfolge', () => {
    const keys = ANTRAG_TABLE_COLUMNS.map(c => c.key);
    expect(keys.slice(0, 5)).toEqual(['aktenzeichen', ...KUERZEL_KEYS]);
  });

  it('sortiert und filtert ueber den Roh-Kuerzelwert', () => {
    const spalte = ANTRAG_TABLE_COLUMNS.find(c => c.key === 'bib_kuerz')!;
    expect(spalte.accessor(row({ bib_kuerz: 'StE' }))).toBe('StE');
    expect(spalte.accessor(row())).toBe('');
    expect(spalte.filterable).toBe(true);
    // Leere Zellen bleiben im Spaltenfilter waehlbar (nicht-leerer Sentinel).
    expect(spalte.filterAccessor!(row())).toBe('(leer)');
    expect(spalte.filterAccessor!(row({ bib_kuerz: 'StE' }))).toBe('StE');
  });

  it('traegt Doppel-Eintraege („StE / CoS") unverfaelscht', () => {
    const spalte = ANTRAG_TABLE_COLUMNS.find(c => c.key === 'ztp_kuerz')!;
    expect(spalte.accessor(row({ ztp_kuerz: 'FW / KNa' }))).toBe('FW / KNa');
    // Breite muss den laengsten Bestandswert tragen (9 Zeichen).
    expect(spalte.width).toBeGreaterThanOrEqual(96);
  });

  it('nennt im Picker die Rolle hinter dem Kuerzel', () => {
    expect(spaltenHinweis('tib_kuerz')).toBe('FB');
    expect(spaltenHinweis('bib_kuerz')).toBe('AB');
    expect(spaltenHinweis('ztp_kuerz')).toBe('FB · Begleitung');
    expect(spaltenHinweis('pfm_kuerz')).toBe('AB · Begleitung');
    expect(spaltenHinweis('akronym')).toBeNull();
  });

  it('loest die neuen Spalten in Registry-Reihenfolge auf', () => {
    const aufgeloest = resolveAntragTableColumns(['aktenzeichen', 'pfm_kuerz', 'bib_kuerz'], false);
    expect(aufgeloest.map(c => c.key)).toEqual(['aktenzeichen', 'bib_kuerz', 'pfm_kuerz']);
  });
});

describe('Rubriken des Spalten-Pickers', () => {
  it('ordnet JEDE feste Spalte einer Rubrik zu — keine namenlose Restgruppe', () => {
    const ohne = ANTRAG_TABLE_COLUMNS.filter(c => !c.gruppe);
    expect(ohne.map(c => c.key)).toEqual([]);
  });

  it('haelt die Rubrik-Reihenfolge Antrag → Zustaendigkeit → Antragsdaten → Status → Termine', () => {
    // Seit v3.5 ist die Registry nach Rubrik geordnet (RUBRIK_ORDNUNG), damit
    // die Rubrik-Kopfzeile der Tabelle zusammenhaengende Baender zeigt. „Antrag"
    // traegt nur noch das FKZ; die Sachdaten stehen als „Antragsdaten" HINTER
    // der Zustaendigkeit, sonst ruecken TIB/BIB hinter neun Spalten.
    const rubriken = gruppiereSpalten(ANTRAG_TABLE_COLUMNS);
    expect(rubriken.map(r => r.name))
      .toEqual(['Antrag', 'Zuständigkeit', 'Antragsdaten', 'Status', 'Termine']);
  });

  it('laesst das FKZ als einzige Spalte der Rubrik „Antrag" ganz vorne', () => {
    // Die Rubrik-Kopfzeile darf nur dann mit der FKZ-Spalte mitkleben, wenn ihre
    // erste Strecke GENAU eine Spalte umfasst.
    const antrag = gruppiereSpalten(ANTRAG_TABLE_COLUMNS)[0]!;
    expect(antrag.columns.map(c => c.key)).toEqual(['aktenzeichen']);
    expect(ANTRAG_TABLE_COLUMNS[0]!.key).toBe('aktenzeichen');
  });

  it('legt die vier Kuerzel-Spalten in EINE Rubrik', () => {
    const rubriken = gruppiereSpalten(ANTRAG_TABLE_COLUMNS);
    const zust = rubriken.find(r => r.name === 'Zuständigkeit')!;
    expect(zust.columns.map(c => c.key)).toEqual([...KUERZEL_KEYS]);
  });

  it('haengt die kuratierten Ordner-Spalten hinten an, nach Ebene getrennt', () => {
    // Verbund und Teilvorhaben fuehren gleichnamige Ordner — in EINER Rubrik
    // staende „Antragsbearbeitung" zweimal und ununterscheidbar.
    const rubriken = gruppiereSpalten([
      ...ANTRAG_TABLE_COLUMNS,
      ...kategorieStatusColumns([
        { kategorieId: 'tv.antragsbearbeitung', label: 'Antragsbearbeitung' },
        { kategorieId: 'vb.antragsbearbeitung', label: 'Antragsbearbeitung' },
        { kategorieId: 'vb.betreuung', label: 'Betreuung' },
      ]),
    ]);
    expect(rubriken.slice(-2).map(r => [r.name, r.columns.length])).toEqual([
      [G_ORDNER_VB, 2],
      [G_ORDNER_TV, 1],
    ]);
  });

  it('ordnet die Ordner-Rubriken Verbund → Teilvorhaben, egal wie der Katalog liefert', () => {
    // Bis v3.5 folgte die Reihenfolge dem ersten Auftreten — sie hing also an
    // der Katalog-Sortierung. Eine gemischte Lieferung zerriss die
    // Rubrik-Kopfzeile in abwechselnde Ein-Spalten-Strecken.
    const gemischt = kategorieStatusColumns([
      { kategorieId: 'tv.a', label: 'A' },
      { kategorieId: 'vb.b', label: 'B' },
      { kategorieId: 'tv.c', label: 'C' },
      { kategorieId: 'vb.d', label: 'D' },
    ]);
    expect(gemischt.map(c => c.gruppe))
      .toEqual([G_ORDNER_VB, G_ORDNER_VB, G_ORDNER_TV, G_ORDNER_TV]);
    // Innerhalb einer Ebene bleibt die Katalog-Reihenfolge erhalten.
    expect(gemischt.map(c => c.label)).toEqual(['B', 'D', 'A', 'C']);
  });

  it('faengt eine Ordner-Id ohne bekannte Ebene in einer Sammelrubrik auf', () => {
    const [spalte] = kategorieStatusColumns([{ kategorieId: 'sonst.irgendwas', label: 'X' }]);
    expect(spalte!.gruppe).toBe(G_ORDNER);
  });
});

describe('Nachreichen neuer Standardspalten', () => {
  it('reicht das AB-Kuerzel an eine bestehende Auswahl nach', () => {
    const { keys, rev } = reicheNeueStandardspaltenNach(['aktenzeichen', 'akronym'], 0);
    expect(keys).toEqual(['aktenzeichen', 'akronym', 'bib_kuerz']);
    expect(rev).toBe(1);
  });

  it('reicht kein zweites Mal nach — abgewaehlt bleibt abgewaehlt', () => {
    const ersteRunde = reicheNeueStandardspaltenNach(['aktenzeichen'], 0);
    const abgewaehlt = ersteRunde.keys.filter(k => k !== 'bib_kuerz');
    const zweiteRunde = reicheNeueStandardspaltenNach(abgewaehlt, ersteRunde.rev);
    expect(zweiteRunde.keys).toEqual(['aktenzeichen']);
    expect(zweiteRunde.rev).toBe(ersteRunde.rev);
  });

  it('dupliziert nicht, wenn die Spalte schon gewaehlt ist', () => {
    const { keys } = reicheNeueStandardspaltenNach(['bib_kuerz', 'aktenzeichen'], 0);
    expect(keys).toEqual(['bib_kuerz', 'aktenzeichen']);
  });

  it('laesst die Reihenfolge der bestehenden Auswahl unangetastet', () => {
    const vorher = ['frist', 'akronym', 'aktenzeichen'];
    const { keys } = reicheNeueStandardspaltenNach(vorher, 0);
    expect(keys.slice(0, 3)).toEqual(vorher);
  });

  it('jeder Nachzuegler-Key ist eine echte Spalte', () => {
    const alle = new Set(ANTRAG_TABLE_COLUMNS.map(c => c.key));
    const { keys } = reicheNeueStandardspaltenNach([], 0);
    for (const k of keys) expect(alle.has(k)).toBe(true);
  });
});
