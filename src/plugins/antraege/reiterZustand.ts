/**
 * Den Zustand der Antragsseite **lesen** und **wieder herstellen** — die
 * unreine Hälfte der eigenen Reiter (`eigeneReiter.ts` hält das Modell).
 *
 * Der Zustand liegt an sieben Stellen, und das ist Absicht: jede davon gehört
 * zu ihrer Sache (Filterleiste, Spaltenwahl, Dichte, …). Diese Datei ist die
 * einzige, die sie alle zugleich anfasst — hier steht die Klammer, sonst
 * nirgends.
 *
 * ## Zwei Sorten Speicher
 *
 * - **Stores** (Zustand) lassen sich jederzeit lesen und setzen. Alles, was die
 *   Identität eines Reiters ausmacht, liegt dort.
 * - **Hook-Zustand mit `localStorage`-Spiegel** (Spaltenbreiten, Gesamtbreite,
 *   Kopf-Sortierung) lebt IN der Tabelle und wird nur beim Mount gelesen. Diese
 *   Datei schreibt deshalb in den Speicher und lässt die Tabelle danach neu
 *   aufbauen (`meldeAngewendet` → `generation` → `key` an `AntraegeTable`).
 *   Rohe `localStorage`-Zugriffe stehen hier trotzdem keine: gelesen und
 *   geschrieben wird über die Funktionen des jeweiligen Hooks.
 */
import {
  ladeBreiten,
  speichereBreiten,
  ladeGesamtBreite,
  speichereGesamtBreite,
  ladeInhaltsBreite,
  speichereInhaltsBreite,
  ladeSortStand,
  speichereSortStand,
} from '@/components/data-table';
import {
  useAntraegeStore,
  getEffectiveSortKey,
  getEffectiveGroupingMode,
  getEffectiveViewMode,
  getEffectiveTableGroupingMode,
  getEffectiveTableAnsicht,
} from './store';
import { useFilterState } from './filter/useFilterState';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import { useDichteStore } from './useDichteStore';
import { useBeendetSichtbarkeit } from './useBeendetSichtbarkeit';
import { useKopfFilter, alsAuswahl } from './kopfFilter';
import { useEigeneReiter, type ReiterKern, type ReiterZustand } from './eigeneReiter';
import {
  SPEICHER_SPALTENBREITEN,
  SPEICHER_GESAMTBREITE,
  SPEICHER_KOPF_SORTIERUNG,
} from './tabellenSpeicher';

/**
 * Der Kern des aktuellen Stands — **reaktiv**, für die Markierung in der
 * Reiterleiste. Jede Zeile ist eine eigene Store-Auswahl, damit die Leiste sich
 * genau dann neu zeichnet, wenn sich etwas Identitätsstiftendes ändert.
 */
export function useAktuellerKern(): ReiterKern {
  const basis = useAntraegeStore(s => s.activeView);
  const ansichtsform = useAntraegeStore(s => getEffectiveViewMode(s.activeView, s.viewModeByTab));
  const sortierung = useAntraegeStore(s => getEffectiveSortKey(s.activeView, s.sortByView));
  const gruppierung = useAntraegeStore(s => getEffectiveGroupingMode(s.activeView, s.groupingByView));
  const tabellenGruppierung = useAntraegeStore(
    s => getEffectiveTableGroupingMode(s.activeView, s.tableGroupingByView),
  );
  const tabellenAnsicht = useAntraegeStore(
    s => getEffectiveTableAnsicht(s.activeView, s.tableAnsichtByView),
  );
  const filter = useFilterState(s => s.active);
  const spalten = useAntraegeColumnsStore(s => s.visibleColumns);
  const dichte = useDichteStore(s => s.dichte);
  const beendetAusgeblendet = useBeendetSichtbarkeit(s => s.ausgeblendet);
  const kopfStand = useKopfFilter(s => s.stand);
  return {
    basis,
    filter,
    ansichtsform,
    sortierung,
    gruppierung,
    tabellenGruppierung,
    tabellenAnsicht,
    spalten,
    dichte,
    beendetAusgeblendet,
    kopfAuswahl: alsAuswahl(kopfStand),
  };
}

/**
 * Der volle Stand JETZT — für „merken" und „aktualisieren".
 *
 * Bewusst imperativ (`getState()` + Speicher-Lesen) statt aus dem Hook oben:
 * die Geometrie schreibt die Tabelle beim Loslassen der Maus durch, ohne dass
 * die Reiterleiste davon neu zeichnet. Ein im Render mitgelesener Wert wäre
 * genau dann alt, wenn jemand gerade eine Spalte breiter gezogen hat.
 */
export function zustandJetzt(): ReiterZustand {
  const a = useAntraegeStore.getState();
  return {
    basis: a.activeView,
    filter: useFilterState.getState().active.map(af => ({ ...af })),
    ansichtsform: getEffectiveViewMode(a.activeView, a.viewModeByTab),
    sortierung: getEffectiveSortKey(a.activeView, a.sortByView),
    gruppierung: getEffectiveGroupingMode(a.activeView, a.groupingByView),
    tabellenGruppierung: getEffectiveTableGroupingMode(a.activeView, a.tableGroupingByView),
    tabellenAnsicht: getEffectiveTableAnsicht(a.activeView, a.tableAnsichtByView),
    spalten: [...useAntraegeColumnsStore.getState().visibleColumns],
    dichte: useDichteStore.getState().dichte,
    beendetAusgeblendet: useBeendetSichtbarkeit.getState().ausgeblendet,
    kopfAuswahl: alsAuswahl(useKopfFilter.getState().stand),
    breiten: ladeBreiten(SPEICHER_SPALTENBREITEN, {}),
    gesamtBreite: ladeGesamtBreite(SPEICHER_GESAMTBREITE),
    inhaltsBreite: ladeInhaltsBreite(SPEICHER_GESAMTBREITE),
    kopfSortierung: ladeSortStand(SPEICHER_KOPF_SORTIERUNG),
  };
}

/**
 * Einen gemerkten Reiter herstellen.
 *
 * Reihenfolge mit Bedacht: erst die Sicht (sie setzt den Ampel-Quickfilter
 * zurück und entscheidet, auf welchen Reiter die Per-Reiter-Slots geschrieben
 * werden), dann alles Übrige, zuletzt der Neuaufbau der Tabelle. Die
 * Per-Reiter-Setter verwerfen einen Wert, der dem Standard entspricht — das ist
 * gewollt: der Reiter stellt den WIRKSAMEN Stand her, nicht einen Eintrag in
 * einer Karte.
 */
export function wendeReiterAn(z: ReiterZustand): void {
  const a = useAntraegeStore.getState();
  a.setActiveView(z.basis);
  a.setViewModeForTab(z.basis, z.ansichtsform);
  a.setSortForView(z.basis, z.sortierung);
  a.setGroupingForView(z.basis, z.gruppierung);
  a.setTableGroupingForView(z.basis, z.tabellenGruppierung);
  a.setTableAnsichtForView(z.basis, z.tabellenAnsicht);

  // Filterleiste: der gemerkte Stand ERSETZT den aktuellen — ein Reiter ist ein
  // Arbeitsplatz, kein Zusatzfilter. Dieselbe Bedeutung wie beim Wiederherstellen
  // eines Verlaufs-Eintrags (`VerlaufMenue`).
  const f = useFilterState.getState();
  f.clearAll();
  for (const af of z.filter) f.setActiveValue(af.filterId, af.value);

  useAntraegeColumnsStore.getState().setVisibleColumns([...z.spalten]);
  useDichteStore.getState().setzeDichte(z.dichte);
  useBeendetSichtbarkeit.getState().setAusgeblendet(z.beendetAusgeblendet);
  useKopfFilter.getState().setzeStand(z.kopfAuswahl);

  speichereBreiten(SPEICHER_SPALTENBREITEN, z.breiten);
  speichereGesamtBreite(SPEICHER_GESAMTBREITE, z.gesamtBreite);
  speichereInhaltsBreite(SPEICHER_GESAMTBREITE, z.inhaltsBreite);
  // Kein gemerkter Sortier-Stand heißt „unsortiert" — und muss deshalb
  // GESCHRIEBEN werden. Den Schlüssel einfach in Ruhe zu lassen, ließe die
  // Sortierung des vorigen Reiters stehen.
  speichereSortStand(SPEICHER_KOPF_SORTIERUNG, z.kopfSortierung ?? { key: null, dir: 'desc' });

  useEigeneReiter.getState().meldeAngewendet();
}
