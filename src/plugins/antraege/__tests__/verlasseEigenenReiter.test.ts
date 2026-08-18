/**
 * Einen eigenen Reiter verlassen (v4.108).
 *
 * Der gemeldete Fehler: „wenn ich eigene Suche als Tab gespeichert habe, geht
 * die Umschaltung zu anderen Tabs (insb. zum ersten Tab „Antragsphase") nicht
 * mehr." Ursache ist die abgeleitete Markierung — ein eigener Reiter gilt als
 * aktiv, solange der Stand seine Signatur trifft. Sitzt er auf derselben Basis,
 * die man anklickt, ändert `setActiveView` daran nichts, und der Klick ist ein
 * Nichts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { verlasseEigenenReiter, wendeReiterAn, zustandJetzt } from '../reiterZustand';
import { passenderReiter, reiterSignatur, useEigeneReiter } from '../eigeneReiter';
import { useAntraegeStore } from '../store';
import { useFilterState } from '../filter/useFilterState';
import { useKopfFilter } from '../kopfFilter';
import { useBeendetSichtbarkeit } from '../useBeendetSichtbarkeit';

/** Der Stand, den der gemeldete Fall beschreibt: ein eigener Reiter auf
 *  „Antragsphase" mit Filter und Kopf-Auswahl. */
function stelleEigenenReiterHer(): void {
  useAntraegeStore.getState().setActiveView('meine_offenen');
  useFilterState.getState().setActiveValue('system-status', 'beantragt');
  useKopfFilter.getState().setzeSpalte('antragsdatum', new Set(['2026-05']));
}

describe('verlasseEigenenReiter', () => {
  beforeEach(() => {
    useFilterState.getState().clearAll();
    useKopfFilter.getState().setzeStand({});
    useEigeneReiter.setState({ reiter: [] });
  });

  it('räumt den Ausschnitt ab, sodass die Signatur des eigenen Reiters nicht mehr trifft', () => {
    stelleEigenenReiterHer();
    const gemerkt = zustandJetzt();
    useEigeneReiter.setState({
      reiter: [{ id: 'r1', name: 'Anträge 2025-2026 nicht begonnen', zustand: gemerkt }],
    });
    // Vorbedingung: genau die Lage, in der der Klick bisher nichts tat.
    expect(passenderReiter(useEigeneReiter.getState().reiter, zustandJetzt())).not.toBeNull();

    verlasseEigenenReiter('meine_offenen');

    expect(passenderReiter(useEigeneReiter.getState().reiter, zustandJetzt())).toBeNull();
    expect(useFilterState.getState().active).toHaveLength(0);
    expect(Object.keys(useKopfFilter.getState().stand)).toHaveLength(0);
  });

  it('setzt die gewählte Sicht — auch die, auf der der eigene Reiter saß', () => {
    stelleEigenenReiterHer();
    verlasseEigenenReiter('alle');
    expect(useAntraegeStore.getState().activeView).toBe('alle');

    verlasseEigenenReiter('meine_offenen');
    expect(useAntraegeStore.getState().activeView).toBe('meine_offenen');
  });

  it('lässt die Anordnung in Ruhe — der Spaltensatz ist eine Vorliebe, kein Ausschnitt', () => {
    stelleEigenenReiterHer();
    const spaltenVorher = [...zustandJetzt().spalten];
    const dichteVorher = zustandJetzt().dichte;

    verlasseEigenenReiter('meine_offenen');

    expect(zustandJetzt().spalten).toEqual(spaltenVorher);
    expect(zustandJetzt().dichte).toBe(dichteVorher);
  });

  it('räumt auch die Quickfilter ab — sie schneiden die Menge wie ein Filter', () => {
    const a = useAntraegeStore.getState();
    a.setProjektart('einzel');
    a.setPrecheckBucket('offen');
    a.setStillstandTage(60);
    a.setFrageKuerzel(['THÜ']);
    a.setPlanTeile([{ begriff: 'wasserstoff', nadeln: ['wasserstoff'], pflicht: false }]);
    a.setFrageGestellt('alle Anträge von THÜ');

    verlasseEigenenReiter('meine_offenen');

    const nach = useAntraegeStore.getState();
    expect(nach.projektart).toBe('alle');
    expect(nach.precheckBucket).toBe('Alle');
    expect(nach.stillstandTage).toBeNull();
    expect(nach.frageKuerzel).toBeNull();
    expect(nach.planTeile).toBeNull();
    expect(nach.frageGestellt).toBeNull();
  });

  it('unterscheidet zwei Reiter, die sich NUR in einer Quickfilter-Pille unterscheiden', () => {
    const a = useAntraegeStore.getState();
    a.setActiveView('meine_offenen');
    a.setPrecheckBucket('Alle');
    const ohne = zustandJetzt();
    a.setPrecheckBucket('offen');
    const mit = zustandJetzt();
    expect(reiterSignatur(mit)).not.toBe(reiterSignatur(ohne));
  });

  it('stellt die Pillen wieder her, wenn der Reiter zurückkommt', () => {
    const a = useAntraegeStore.getState();
    a.setPrecheckBucket('offen');
    a.setProjektart('einzel');
    const gemerkt = zustandJetzt();

    verlasseEigenenReiter('meine_offenen');
    expect(useAntraegeStore.getState().precheckBucket).toBe('Alle');

    wendeReiterAn(gemerkt);
    expect(useAntraegeStore.getState().precheckBucket).toBe('offen');
    expect(useAntraegeStore.getState().projektart).toBe('einzel');
  });

  it('lässt den Suchtext stehen — er gehört zu keinem Reiter', () => {
    useAntraegeStore.getState().setSearch('laser');
    verlasseEigenenReiter('alle');
    expect(useAntraegeStore.getState().search).toBe('laser');
  });

  it('stellt die Beendet-Sicht auf ihren Standard zurück — sie entscheidet über die Menge', () => {
    useBeendetSichtbarkeit.getState().setAusgeblendet(false);
    verlasseEigenenReiter('alle');
    expect(useBeendetSichtbarkeit.getState().ausgeblendet).toBe(true);
  });
});
