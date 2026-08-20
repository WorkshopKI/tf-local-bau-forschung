import { describe, it, expect } from 'vitest';
import { gruppiereSpalten } from '@/components/data-table';
import {
  ANTRAG_TABLE_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  G_ORDNER,
  G_ORDNER_TV,
  G_ORDNER_VB,
  G_STATUS,
  kategorieStatusColumns,
  spaltenHinweis,
} from '../tableColumns';
import { maSpalteErzwungen, resolveAntragTableColumns } from '../spaltenAufloesung';
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

  it('steht in der Registry hinter Antrag und Frist, in Verfahrens-Reihenfolge', () => {
    // Seit v4.62 schiebt sich die Frist zwischen Identitaet und Zustaendigkeit:
    // die Fristenkontrolle ist die haeufigste Frage an diese Tabelle und stand
    // vorher als LETZTE Spalte am rechten Rand. Die Kuerzel bleiben davor
    // beisammen und ruecken nicht hinter die Antragsdaten.
    //
    // Vor der Frist stehen seit v4.63 ZWEI Spalten der Rubrik „Antrag": die
    // zusammengelegte `antrag` (Standard) und das FKZ als abwaehlbare Einzelspalte.
    const keys = ANTRAG_TABLE_COLUMNS.map(c => c.key);
    expect(keys.slice(0, 7)).toEqual(['antrag', 'aktenzeichen', 'frist', ...KUERZEL_KEYS]);
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

  it('haelt die Rubrik-Reihenfolge Antrag → Frist → Zustaendigkeit → Antragsdaten → Status → Termine', () => {
    // Seit v3.5 ist die Registry nach Rubrik geordnet (RUBRIK_ORDNUNG), damit
    // die Rubrik-Kopfzeile der Tabelle zusammenhaengende Baender zeigt. „Antrag"
    // traegt nur noch das FKZ; die Sachdaten stehen als „Antragsdaten" HINTER
    // der Zustaendigkeit, sonst ruecken TIB/BIB hinter neun Spalten.
    //
    // „Frist" ist seit v4.62 eine EIGENE Rubrik zwischen beiden. Sie musste nach
    // vorn, blieb aber inhaltlich ein Termin — als einzelnes „Termine"-Feld an
    // Position zwei haette sie das Band in zwei Strecken zerrissen, also genau
    // das erzeugt, wogegen RUBRIK_ORDNUNG angelegt wurde.
    const rubriken = gruppiereSpalten(ANTRAG_TABLE_COLUMNS);
    expect(rubriken.map(r => r.name))
      .toEqual(['Antrag', 'Frist', 'Zuständigkeit', 'Antragsdaten', 'Status', 'Termine']);
  });

  it('haelt jede Rubrik als EINE zusammenhaengende Strecke', () => {
    // Der eigentliche Zweck von RUBRIK_ORDNUNG, hier direkt geprueft statt ueber
    // die Namensliste: kommt eine Rubrik zweimal vor, zerfaellt die Kopfzeile.
    const folge = ANTRAG_TABLE_COLUMNS.map(c => c.gruppe ?? '');
    const strecken = folge.filter((g, i) => i === 0 || folge[i - 1] !== g);
    expect(strecken).toEqual([...new Set(strecken)]);
  });

  it('stellt die zusammengelegte Antrag-Spalte an den Anfang', () => {
    // Sie ist die klebende Identitätsspalte (`stickyFirstColumn`) und traegt seit
    // v4.63 Akronym UND FKZ; die beiden Einzelspalten stehen als abwaehlbare
    // Alternativen daneben in derselben Rubrik.
    const antrag = gruppiereSpalten(ANTRAG_TABLE_COLUMNS)[0]!;
    expect(antrag.columns.map(c => c.key)).toEqual(['antrag', 'aktenzeichen']);
    expect(ANTRAG_TABLE_COLUMNS[0]!.key).toBe('antrag');
    expect(ANTRAG_TABLE_COLUMNS[0]!.locked).toBe(true);
    // Genau EINE Spalte ist gelockt — zwei erzwungene Identitaetsspalten
    // stuenden zwangsweise doppelt in der Zeile.
    expect(ANTRAG_TABLE_COLUMNS.filter(c => c.locked).map(c => c.key)).toEqual(['antrag']);
  });

  it('legt die vier Kuerzel-Spalten und die verdichtete in EINE Rubrik', () => {
    const rubriken = gruppiereSpalten(ANTRAG_TABLE_COLUMNS);
    const zust = rubriken.find(r => r.name === 'Zuständigkeit')!;
    // `zustaendig` fasst FB+AB der Antragsphase zusammen und steht hinter den
    // Einzelspalten — sie ist eine Alternative zu ihnen, kein Ersatz.
    expect(zust.columns.map(c => c.key)).toEqual([...KUERZEL_KEYS, 'zustaendig']);
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
  // Fixtures ohne `aktenzeichen`/`akronym`: die faellt seit v4.63 unter die
  // Zusammenlegung (eigener Block unten) und wuerde hier zwei Regeln auf einmal
  // pruefen.
  it('reicht das AB-Kuerzel an eine bestehende Auswahl nach', () => {
    const { keys, rev } = reicheNeueStandardspaltenNach(['antrag', 'titel'], 0);
    expect(keys).toEqual(['antrag', 'titel', 'bib_kuerz']);
    expect(rev).toBe(2);
  });

  it('reicht kein zweites Mal nach — abgewaehlt bleibt abgewaehlt', () => {
    const ersteRunde = reicheNeueStandardspaltenNach(['antrag'], 0);
    const abgewaehlt = ersteRunde.keys.filter(k => k !== 'bib_kuerz');
    const zweiteRunde = reicheNeueStandardspaltenNach(abgewaehlt, ersteRunde.rev);
    expect(zweiteRunde.keys).toEqual(['antrag']);
    expect(zweiteRunde.rev).toBe(ersteRunde.rev);
  });

  it('dupliziert nicht, wenn die Spalte schon gewaehlt ist', () => {
    const { keys } = reicheNeueStandardspaltenNach(['bib_kuerz', 'antrag'], 0);
    expect(keys).toEqual(['bib_kuerz', 'antrag']);
  });

  it('laesst die Reihenfolge der bestehenden Auswahl unangetastet', () => {
    const vorher = ['frist', 'titel', 'antrag'];
    const { keys } = reicheNeueStandardspaltenNach(vorher, 0);
    expect(keys.slice(0, 3)).toEqual(vorher);
  });

  describe('Zusammenlegung FKZ + Akronym → Antrag (v4.63)', () => {
    it('ersetzt beide Einzelspalten durch die zusammengelegte', () => {
      // Ohne diese Regel bekaeme ein Bestandsnutzer die gelockte neue Spalte
      // ZUSAETZLICH zu ihren Einzelteilen — das FKZ stuende zweimal in der Zeile.
      const { keys } = reicheNeueStandardspaltenNach(['aktenzeichen', 'akronym'], 0);
      expect(keys).toEqual(['antrag', 'bib_kuerz']);
    });

    it('setzt die neue Spalte an die Stelle der ERSTEN ersetzten', () => {
      const { keys } = reicheNeueStandardspaltenNach(['frist', 'akronym', 'titel', 'aktenzeichen'], 1);
      expect(keys).toEqual(['frist', 'antrag', 'titel']);
    });

    it('greift auch, wenn nur eine der beiden gewaehlt war', () => {
      expect(reicheNeueStandardspaltenNach(['akronym'], 1).keys).toEqual(['antrag']);
      expect(reicheNeueStandardspaltenNach(['aktenzeichen'], 1).keys).toEqual(['antrag']);
    });

    it('laeuft genau einmal — wer FKZ danach wieder einblendet, behaelt es', () => {
      const nachher = reicheNeueStandardspaltenNach(['antrag', 'aktenzeichen'], 2);
      expect(nachher.keys).toEqual(['antrag', 'aktenzeichen']);
    });

    it('ruehrt eine Auswahl ohne die beiden Keys nicht an', () => {
      const { keys } = reicheNeueStandardspaltenNach(['frist', 'status'], 1);
      expect(keys).toEqual(['frist', 'status']);
    });
  });

  it('jeder Nachzuegler-Key ist eine echte Spalte', () => {
    const alle = new Set(ANTRAG_TABLE_COLUMNS.map(c => c.key));
    const { keys } = reicheNeueStandardspaltenNach([], 0);
    for (const k of keys) expect(alle.has(k)).toBe(true);
  });
});

/**
 * Die zwei verdichteten Spalten (v4.62): sie fassen zusammen, was in der
 * Registry als Einzelspalten bleibt — und dürfen dabei nichts behaupten, was
 * die Daten nicht hergeben.
 */
describe('Verdichtete Spalten', () => {
  const zustaendig = () => ANTRAG_TABLE_COLUMNS.find(c => c.key === 'zustaendig')!;
  const fbPc = () => ANTRAG_TABLE_COLUMNS.find(c => c.key === 'fb_precheck')!;

  it('ist keine von beiden ab Werk eingeblendet — der Umbau ist additiv', () => {
    expect(DEFAULT_VISIBLE_COLUMN_KEYS).not.toContain('zustaendig');
    expect(DEFAULT_VISIBLE_COLUMN_KEYS).not.toContain('fb_precheck');
  });

  it('exportiert „Zustaendig" beide Kuerzel mit ihrer Rolle', () => {
    expect(zustaendig().exportValue!(row({ tib_kuerz: 'THü', bib_kuerz: 'StE' })))
      .toBe('FB THü · AB StE');
    // Nur eines belegt → keine leere Haelfte und kein einsames Trennzeichen.
    expect(zustaendig().exportValue!(row({ bib_kuerz: 'StE' }))).toBe('AB StE');
    expect(zustaendig().exportValue!(row())).toBe('');
  });

  it('nimmt „Zustaendig" NUR die Antragsphase, nicht die Begleitphase', () => {
    // Eine Ausweichkette FB = tib || ztp ruehrte zwei Quellen zu einer Aussage
    // zusammen — man wuesste nicht mehr, welche Phase man liest.
    expect(zustaendig().exportValue!(row({ ztp_kuerz: 'FW', pfm_kuerz: 'AAt' }))).toBe('');
  });

  it('exportiert „FB / PreCheck" den VOLLEN Wortlaut beider Felder', () => {
    const r = row({ fb_status_label: 'Ablehnungsreif', precheck_status_label: 'PreCheck negativ - Verbund' });
    expect(fbPc().exportValue!(r)).toBe('FB: Ablehnungsreif · PC: PreCheck negativ - Verbund');
    expect(fbPc().exportValue!(row())).toBe('');
  });

  it('erbt „FB / PreCheck" die Status-Rubrik — und damit die Ausklapp-Klickzone', () => {
    expect(fbPc().gruppe).toBe(G_STATUS);
  });

  it('sortiert „FB / PreCheck" nach der PreCheck-Klasse, nicht nach dem Rohlabel', () => {
    // Die Klasse ist die kuratierte Aussage (positiv/negativ/offen); das Label
    // ist Label-XLS-getrieben und sortierte alphabetisch sinnlos.
    const negativ = fbPc().accessor(row({ precheck_status_label: 'PreCheck negativ' }));
    const positiv = fbPc().accessor(row({ precheck_status_label: 'PreCheck positiv' }));
    const leer = fbPc().accessor(row());
    expect(String(negativ).startsWith('negativ')).toBe(true);
    expect(String(positiv).startsWith('positiv')).toBe(true);
    expect(String(leer).startsWith('offen')).toBe(true);
  });
});

describe('maSpalteErzwungen — kein doppeltes TIB-Kuerzel', () => {
  it('erzwingt die MA-Spalte im Uebersichtsmodus wie bisher', () => {
    expect(maSpalteErzwungen(['aktenzeichen'], true)).toBe(true);
    expect(maSpalteErzwungen(['aktenzeichen'], false)).toBe(false);
  });

  it('erzwingt sie NICHT, wenn die verdichtete Spalte das Kuerzel schon traegt', () => {
    expect(maSpalteErzwungen(['aktenzeichen', 'zustaendig'], true)).toBe(false);
  });

  it('haelt die Aufloesung an dieselbe Regel', () => {
    const mitZust = resolveAntragTableColumns(['aktenzeichen', 'zustaendig'], true)
      .map(c => c.key);
    expect(mitZust).not.toContain('tib_kuerz');
    const ohneZust = resolveAntragTableColumns(['aktenzeichen'], true).map(c => c.key);
    expect(ohneZust).toContain('tib_kuerz');
  });
});
