/**
 * Das Anzeige-Modell von „Änderungen der letzten Nacht": eine Zeile je ANTRAG.
 *
 * Der Kern: die Zeile sagt, WAS sich an WELCHEM Vorgang geändert hat — nie, wer
 * es war (Pitfall #48). Die Gruppierung nach Antrag ersetzt seit v4.134 die nach
 * Feld; die alte beantwortete eine Frage über den Bestand, nicht über die eigene
 * Arbeit.
 *
 * Seit v4.135 ist die Zeile eine SEGMENT-Liste: jedes Kürzel behält seine
 * Einträge, weil es in der Anzeige seinen eigenen Tooltip trägt. Geprüft wird
 * deshalb beides — die Struktur (welche Kürzel, welche Einträge) und der daraus
 * gebildete Satz (`zeileText`), der als `aria-label` weiterlebt.
 */
import { describe, it, expect } from 'vitest';
import type { JournalEintrag } from '@/core/status';
import {
  gruppiereNachAntrag, nachtlaufBilanz, zeileText,
} from '../nachtlaufGruppen';

const e = (o: Partial<JournalEintrag> & Pick<JournalEintrag, 'antragId' | 'art'>): JournalEintrag => ({
  stempel: 's1', datum: '2026-08-18', ...o,
});

const OHNE_LABEL = (): undefined => undefined;

describe('gruppiereNachAntrag', () => {
  it('fasst je Antrag zusammen und zählt die Einträge', () => {
    const zeilen = gruppiereNachAntrag([
      e({ antragId: 'A1', art: 'gesetzt', feld: 'D_AB' }),
      e({ antragId: 'A1', art: 'gesetzt', feld: 'D_ABB' }),
      e({ antragId: 'A2', art: 'geaendert', feld: 'STATUS_TV' }),
    ], OHNE_LABEL);
    expect(zeilen.map(z => `${z.antragId}:${z.anzahl}`)).toEqual(['A1:2', 'A2:1']);
    expect(zeileText(zeilen[0]!)).toBe('D_AB, D_ABB gesetzt');
    expect(zeileText(zeilen[1]!)).toBe('STATUS_TV geändert');
  });

  it('jedes Kürzel behält seine Einträge — daran hängt sein Tooltip', () => {
    const alt = e({ antragId: 'A1', art: 'geaendert', feld: 'D_AB', datum: '2026-08-10', nach: 20260810 });
    const neu = e({ antragId: 'A1', art: 'geaendert', feld: 'D_AB', datum: '2026-08-18', nach: 20260818 });
    // Absichtlich in falscher Reihenfolge herein: die Einträge sollen nach
    // Datum aufsteigend herauskommen, sonst liest sich der Tooltip rückwärts.
    const zeilen = gruppiereNachAntrag([neu, alt], OHNE_LABEL);
    const kuerzel = zeilen[0]!.segmente[0]!.kuerzel[0]!;
    expect(kuerzel.feld).toBe('D_AB');
    expect(kuerzel.eintraege.map(x => x.datum)).toEqual(['2026-08-10', '2026-08-18']);
  });

  it('trennt die Arten in einer Zeile — Setzung und Änderung sind nicht dasselbe', () => {
    const zeilen = gruppiereNachAntrag([
      e({ antragId: 'A1', art: 'gesetzt', feld: 'D_AK4' }),
      e({ antragId: 'A1', art: 'geaendert', feld: 'STATUS_TV' }),
      e({ antragId: 'A1', art: 'geleert', feld: 'D_ART' }),
    ], OHNE_LABEL);
    expect(zeileText(zeilen[0]!)).toBe('D_AK4 gesetzt · STATUS_TV geändert · D_ART zurückgenommen');
    expect(zeilen[0]!.segmente.map(s => s.art)).toEqual(['gesetzt', 'geaendert', 'geleert']);
  });

  it('Arten ohne Feld tragen nur ihren Wortlaut', () => {
    const zeilen = gruppiereNachAntrag([e({ antragId: 'A9', art: 'antrag-neu' })], OHNE_LABEL);
    expect(zeileText(zeilen[0]!)).toBe('erstmals im Export');
    expect(zeilen[0]!.segmente[0]!.kuerzel).toEqual([]);
  });

  it('kappt lange Feldlisten mit „+N" statt die Zeile zu sprengen', () => {
    const zeilen = gruppiereNachAntrag(
      ['D_A', 'D_B', 'D_C', 'D_D', 'D_E'].map(feld => e({ antragId: 'A1', art: 'gesetzt', feld })),
      OHNE_LABEL,
    );
    expect(zeileText(zeilen[0]!)).toBe('D_A, D_B, D_C +2 gesetzt');
    // Die ZAHL bleibt vollständig — gekappt ist die Aufzählung, nicht der Zähler.
    expect(zeilen[0]!.anzahl).toBe(5);
  });

  it('das Gekappte wird nicht verworfen — es trägt seinen eigenen Tooltip', () => {
    const zeilen = gruppiereNachAntrag(
      ['D_A', 'D_B', 'D_C', 'D_D', 'D_E'].map(feld => e({ antragId: 'A1', art: 'gesetzt', feld })),
      OHNE_LABEL,
    );
    expect(zeilen[0]!.segmente[0]!.versteckt.map(k => k.feld)).toEqual(['D_D', 'D_E']);
  });

  it('maxKuerzel steuert die Kappung', () => {
    const eintraege = ['D_A', 'D_B', 'D_C', 'D_D', 'D_E']
      .map(feld => e({ antragId: 'A1', art: 'gesetzt', feld }));
    expect(zeileText(gruppiereNachAntrag(eintraege, OHNE_LABEL, { maxKuerzel: 5 })[0]!))
      .toBe('D_A, D_B, D_C, D_D, D_E gesetzt');
    expect(zeileText(gruppiereNachAntrag(eintraege, OHNE_LABEL, { maxKuerzel: 1 })[0]!))
      .toBe('D_A +4 gesetzt');
    // 0 wäre eine Zeile ohne jede Aussage — geklemmt auf mindestens eines.
    expect(zeileText(gruppiereNachAntrag(eintraege, OHNE_LABEL, { maxKuerzel: 0 })[0]!))
      .toBe('D_A +4 gesetzt');
  });

  it('löst das Akronym auf, behält aber das Aktenzeichen als Rückfall', () => {
    const zeilen = gruppiereNachAntrag([
      e({ antragId: '16KN1', art: 'gesetzt', feld: 'D_AB' }),
      e({ antragId: '16KN2', art: 'gesetzt', feld: 'D_AB' }),
    ], id => (id === '16KN1' ? 'CALYPSO' : undefined));
    expect(zeilen.map(z => z.label).sort()).toEqual(['16KN2', 'CALYPSO']);
  });

  it('ein leerer Akronym-Wert fällt auf das Aktenzeichen zurück', () => {
    const zeilen = gruppiereNachAntrag([e({ antragId: '16KN1', art: 'gesetzt', feld: 'D_AB' })], () => '   ');
    expect(zeilen[0]!.label).toBe('16KN1');
  });

  it('sortiert die änderungsreichsten zuerst, bei Gleichstand nach Bezeichnung', () => {
    const zeilen = gruppiereNachAntrag([
      e({ antragId: 'B', art: 'gesetzt', feld: 'D_1' }),
      e({ antragId: 'A', art: 'gesetzt', feld: 'D_1' }),
      e({ antragId: 'C', art: 'gesetzt', feld: 'D_1' }),
      e({ antragId: 'C', art: 'gesetzt', feld: 'D_2' }),
    ], OHNE_LABEL);
    expect(zeilen.map(z => z.antragId)).toEqual(['C', 'A', 'B']);
  });

  it('sortierung „label" ordnet alphabetisch, unabhängig von der Änderungszahl', () => {
    const zeilen = gruppiereNachAntrag([
      e({ antragId: 'B', art: 'gesetzt', feld: 'D_1' }),
      e({ antragId: 'A', art: 'gesetzt', feld: 'D_1' }),
      e({ antragId: 'C', art: 'gesetzt', feld: 'D_1' }),
      e({ antragId: 'C', art: 'gesetzt', feld: 'D_2' }),
    ], OHNE_LABEL, { sortierung: 'label' });
    expect(zeilen.map(z => z.antragId)).toEqual(['A', 'B', 'C']);
  });

  it('merkt sich, wenn eine Änderung nur als Zeitraum belegt ist', () => {
    const zeilen = gruppiereNachAntrag([
      e({ antragId: 'A1', art: 'gesetzt', feld: 'D_AB' }),
      e({ antragId: 'A1', art: 'gesetzt', feld: 'D_ABB', unscharf: true }),
      e({ antragId: 'A2', art: 'gesetzt', feld: 'D_AB' }),
    ], OHNE_LABEL);
    expect(zeilen.find(z => z.antragId === 'A1')?.unscharf).toBe(true);
    expect(zeilen.find(z => z.antragId === 'A2')?.unscharf).toBe(false);
  });

  it('zwei Teilvorhaben mit demselben Akronym bekommen ihr Aktenzeichen dazu', () => {
    // Gemessen: „LADScessible" stand zweimal untereinander — in Wahrheit zwei
    // Anträge desselben Verbunds. Zusammenfassen wäre falsch, verwechseln auch.
    const zeilen = gruppiereNachAntrag([
      e({ antragId: '16KN110645', art: 'geleert', feld: 'D_AAA' }),
      e({ antragId: '16KN110646', art: 'geleert', feld: 'D_AAA' }),
      e({ antragId: '16EP260092', art: 'gesetzt', feld: 'D_AB' }),
    ], id => (id.startsWith('16KN') ? 'LADScessible' : 'TYPO3 AI'));
    expect(zeilen.map(z => z.label).sort()).toEqual([
      'LADScessible · 16KN110645', 'LADScessible · 16KN110646', 'TYPO3 AI',
    ]);
  });

  it('ein eindeutiges Akronym bleibt unangetastet', () => {
    const zeilen = gruppiereNachAntrag([
      e({ antragId: 'A1', art: 'gesetzt', feld: 'D_AB' }),
      e({ antragId: 'A2', art: 'gesetzt', feld: 'D_AB' }),
    ], id => (id === 'A1' ? 'CALYPSO' : 'KITED'));
    expect(zeilen.map(z => z.label).sort()).toEqual(['CALYPSO', 'KITED']);
  });

  it('leere Eingabe → leere Liste (keine Zeile ohne Anlass)', () => {
    expect(gruppiereNachAntrag([], OHNE_LABEL)).toEqual([]);
  });
});

describe('nachtlaufBilanz', () => {
  it('nennt Änderungen UND betroffene Vorgänge — eine Zahl allein wäre mehrdeutig', () => {
    const zeilen = gruppiereNachAntrag([
      e({ antragId: 'A1', art: 'gesetzt', feld: 'D_1' }),
      e({ antragId: 'A1', art: 'gesetzt', feld: 'D_2' }),
      e({ antragId: 'A2', art: 'gesetzt', feld: 'D_1' }),
    ], OHNE_LABEL);
    expect(nachtlaufBilanz(zeilen)).toBe('3 Änderungen an 2 Vorgängen');
  });

  it('Singular an beiden Stellen', () => {
    const zeilen = gruppiereNachAntrag([e({ antragId: 'A1', art: 'gesetzt', feld: 'D_1' })], OHNE_LABEL);
    expect(nachtlaufBilanz(zeilen)).toBe('1 Änderung an 1 Vorgang');
  });

  it('nichts gefunden → „0", nicht ein erfundener Satz', () => {
    expect(nachtlaufBilanz([])).toBe('0');
  });
});
