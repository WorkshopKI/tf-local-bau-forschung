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
import { verlasseEigenenReiter, zustandJetzt } from '../reiterZustand';
import { passenderReiter, useEigeneReiter } from '../eigeneReiter';
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

  it('stellt die Beendet-Sicht auf ihren Standard zurück — sie entscheidet über die Menge', () => {
    useBeendetSichtbarkeit.getState().setAusgeblendet(false);
    verlasseEigenenReiter('alle');
    expect(useBeendetSichtbarkeit.getState().ausgeblendet).toBe(true);
  });
});
