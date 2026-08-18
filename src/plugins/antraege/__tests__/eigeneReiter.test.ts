import { describe, it, expect, beforeEach } from 'vitest';
import {
  reiterSignatur,
  reiterPasst,
  passenderReiter,
  ergaenzeQuickfilter,
  beschreibeZustand,
  useEigeneReiter,
  MAX_EIGENE_REITER,
  type ReiterZustand,
} from '../eigeneReiter';

function zustand(ueber: Partial<ReiterZustand> = {}): ReiterZustand {
  return {
    basis: 'meine_offenen',
    filter: [],
    ansichtsform: 'compact',
    sortierung: 'frist_asc',
    gruppierung: 'none',
    tabellenGruppierung: 'none',
    tabellenAnsicht: 'antrag',
    spalten: ['antrag', 'frist'],
    dichte: 'kompakt',
    beendetAusgeblendet: true,
    kopfAuswahl: {},
    projektart: 'alle',
    precheck: 'Alle',
    stillstandTage: null,
    breiten: {},
    gesamtBreite: null,
    inhaltsBreite: false,
    kopfSortierung: null,
    ...ueber,
  };
}

describe('Eigene Reiter — ältere Stände', () => {
  it('füllt fehlende Quickfilter-Felder mit „keine Einschränkung" nach (v4.108)', () => {
    // Ein vor v4.108 gemerkter Reiter: die drei Felder gab es noch nicht.
    const alt = zustand();
    const roh = alt as unknown as Record<string, unknown>;
    delete roh.projektart;
    delete roh.precheck;
    delete roh.stillstandTage;

    const ergaenzt = ergaenzeQuickfilter({ id: 'r1', name: 'Alt', zustand: alt });

    expect(ergaenzt.zustand.projektart).toBe('alle');
    expect(ergaenzt.zustand.precheck).toBe('Alle');
    expect(ergaenzt.zustand.stillstandTage).toBeNull();
  });

  it('lässt einen vollständigen Reiter unangetastet (gleiche Referenz)', () => {
    const r = { id: 'r2', name: 'Neu', zustand: zustand() };
    expect(ergaenzeQuickfilter(r)).toBe(r);
  });
});

describe('Eigene Reiter — was zur Identität zählt', () => {
  it('nimmt die Geometrie MIT, zählt sie aber nicht mit', () => {
    const schmal = zustand();
    const breit = zustand({
      breiten: { frist: 220 },
      gesamtBreite: 1800,
      inhaltsBreite: true,
      kopfSortierung: { key: 'frist', dir: 'asc' },
    });
    // Eine gezogene Spaltenkante ist keine Wahl aus einem Menü — sie darf dem
    // Reiter nicht die Markierung nehmen.
    expect(reiterPasst(schmal, breit)).toBe(true);
  });

  it('unterscheidet zwei verschiedene eigene Spaltensätze', () => {
    // Beide heißen im Darstellungs-Menü „Eigene" — über den Profilnamen wären
    // sie derselbe Reiter.
    const a = zustand({ spalten: ['antrag', 'frist', 'titel'] });
    const b = zustand({ spalten: ['antrag', 'frist', 'zustaendig'] });
    expect(reiterPasst(a, b)).toBe(false);
  });

  it('liest den Spaltensatz als MENGE, nicht als Reihenfolge', () => {
    const a = zustand({ spalten: ['antrag', 'frist', 'titel'] });
    const b = zustand({ spalten: ['titel', 'antrag', 'frist'] });
    expect(reiterPasst(a, b)).toBe(true);
  });

  it('trennt nach Basis-Sicht', () => {
    expect(reiterPasst(zustand({ basis: 'alle' }), zustand({ basis: 'fristen' }))).toBe(false);
  });

  it('trennt nach Filterstand', () => {
    const mit = zustand({ filter: [{ filterId: 'system-status', value: ['a'] }] });
    expect(reiterPasst(mit, zustand())).toBe(false);
  });
});

describe('Eigene Reiter — nur geltende Achsen zählen', () => {
  it('wertet die Spaltenkopf-Auswahl nur in der Tabelle', () => {
    const kopf = { frist: ['2026-01'] };
    expect(reiterPasst(
      zustand({ ansichtsform: 'compact', kopfAuswahl: kopf }),
      zustand({ ansichtsform: 'compact' }),
    )).toBe(false);
    // In Liste und Karten gibt es keine Spaltenköpfe — eine gemerkte Auswahl
    // wirkt dort nicht und darf deshalb auch nicht trennen.
    expect(reiterPasst(
      zustand({ ansichtsform: 'list', kopfAuswahl: kopf }),
      zustand({ ansichtsform: 'list' }),
    )).toBe(true);
  });

  it('wertet die Sortier-Achse nur außerhalb der Tabelle', () => {
    expect(reiterPasst(
      zustand({ ansichtsform: 'list', sortierung: 'frist_asc' }),
      zustand({ ansichtsform: 'list', sortierung: 'akronym_asc' }),
    )).toBe(false);
    // Die Tabelle sortiert über ihre Spaltenköpfe; die Menü-Achse gilt dort nicht.
    expect(reiterPasst(
      zustand({ ansichtsform: 'compact', sortierung: 'frist_asc' }),
      zustand({ ansichtsform: 'compact', sortierung: 'akronym_asc' }),
    )).toBe(true);
  });

  it('wertet die Zeilendichte nur in der Tabelle', () => {
    expect(reiterPasst(
      zustand({ ansichtsform: 'compact', dichte: 'kompakt' }),
      zustand({ ansichtsform: 'compact', dichte: 'normal' }),
    )).toBe(false);
    expect(reiterPasst(
      zustand({ ansichtsform: 'list', dichte: 'kompakt' }),
      zustand({ ansichtsform: 'list', dichte: 'normal' }),
    )).toBe(true);
  });

  it('wertet den Beendet-Schalter nur im „Alle"-Reiter', () => {
    expect(reiterPasst(
      zustand({ basis: 'alle', beendetAusgeblendet: true }),
      zustand({ basis: 'alle', beendetAusgeblendet: false }),
    )).toBe(false);
    expect(reiterPasst(
      zustand({ basis: 'meine_offenen', beendetAusgeblendet: true }),
      zustand({ basis: 'meine_offenen', beendetAusgeblendet: false }),
    )).toBe(true);
  });

  it('trennt zuerst nach Ansichtsform — sie entscheidet, welche Achsen gelten', () => {
    expect(reiterSignatur(zustand({ ansichtsform: 'list' })))
      .not.toBe(reiterSignatur(zustand({ ansichtsform: 'compact' })));
  });
});

describe('Eigene Reiter — welcher gilt gerade', () => {
  it('findet den passenden und sonst keinen', () => {
    const reiter = [
      { id: 'r1', name: 'Meine Fristen', zustand: zustand({ basis: 'fristen' }) },
      { id: 'r2', name: 'Alles', zustand: zustand({ basis: 'alle' }) },
    ];
    expect(passenderReiter(reiter, zustand({ basis: 'alle' }))?.id).toBe('r2');
    expect(passenderReiter(reiter, zustand({ basis: 'begleitung' }))).toBeNull();
  });
});

describe('Eigene Reiter — Beschreibung', () => {
  it('zählt, statt aufzuzählen', () => {
    const text = beschreibeZustand(
      zustand({
        filter: [{ filterId: 'a', value: 'x' }, { filterId: 'b', value: 'y' }],
        kopfAuswahl: { frist: ['2026-01'] },
        breiten: { frist: 220 },
      }),
      'Antragsphase',
    );
    expect(text).toContain('Antragsphase');
    expect(text).toContain('2 Filter');
    expect(text).toContain('2 Spalten');
    expect(text).toContain('eigene Spaltenbreiten');
  });

  it('nennt in Liste und Karten keine Spaltensachen', () => {
    const text = beschreibeZustand(zustand({ ansichtsform: 'list' }), 'Alle');
    expect(text).toBe('Alle · Liste');
  });
});

describe('Eigene Reiter — Speicher', () => {
  beforeEach(() => {
    useEigeneReiter.setState({ reiter: [], generation: 0 });
  });

  it('merkt, benennt um und entfernt', () => {
    const s = useEigeneReiter.getState();
    s.merke('Meine Sicht', zustand());
    const angelegt = useEigeneReiter.getState().reiter[0]!;
    expect(angelegt.name).toBe('Meine Sicht');

    useEigeneReiter.getState().benenneUm(angelegt.id, '  Neue Sicht  ');
    expect(useEigeneReiter.getState().reiter[0]!.name).toBe('Neue Sicht');

    // Ein leerer Name ist kein Name — der alte bleibt stehen.
    useEigeneReiter.getState().benenneUm(angelegt.id, '   ');
    expect(useEigeneReiter.getState().reiter[0]!.name).toBe('Neue Sicht');

    useEigeneReiter.getState().entferne(angelegt.id);
    expect(useEigeneReiter.getState().reiter).toHaveLength(0);
  });

  it('zieht einen gemerkten Reiter auf einen neuen Stand nach', () => {
    useEigeneReiter.getState().merke('X', zustand({ basis: 'fristen' }));
    const id = useEigeneReiter.getState().reiter[0]!.id;
    useEigeneReiter.getState().aktualisiere(id, zustand({ basis: 'alle' }));
    expect(useEigeneReiter.getState().reiter[0]!.zustand.basis).toBe('alle');
  });

  it('nimmt nicht mehr als MAX_EIGENE_REITER auf', () => {
    for (let i = 0; i < MAX_EIGENE_REITER + 3; i++) {
      useEigeneReiter.getState().merke(`R${i}`, zustand());
    }
    expect(useEigeneReiter.getState().reiter).toHaveLength(MAX_EIGENE_REITER);
  });

  it('zählt die Generation nur beim Anwenden hoch', () => {
    useEigeneReiter.getState().merke('X', zustand());
    expect(useEigeneReiter.getState().generation).toBe(0);
    useEigeneReiter.getState().meldeAngewendet();
    expect(useEigeneReiter.getState().generation).toBe(1);
  });
});
