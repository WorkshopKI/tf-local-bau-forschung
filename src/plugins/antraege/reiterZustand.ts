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
import { DEFAULT_BEENDET_SICHT } from './arbeitsvorrat';
import type { ViewKey } from './views';
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
  const projektart = useAntraegeStore(s => s.projektart);
  const precheck = useAntraegeStore(s => s.precheckBucket);
  const stillstandTage = useAntraegeStore(s => s.stillstandTage);
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
    projektart,
    precheck,
    stillstandTage,
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
    projektart: a.projektart,
    precheck: a.precheckBucket,
    stillstandTage: a.stillstandTage,
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

  // Die Quickfilter-Pillen gehören seit v4.108 zum Reiter — vorher trug er ihren
  // Namen und stellte sie nicht her.
  a.setProjektart(z.projektart);
  a.setPrecheckBucket(z.precheck);
  a.setStillstandTage(z.stillstandTage);

  speichereBreiten(SPEICHER_SPALTENBREITEN, z.breiten);
  speichereGesamtBreite(SPEICHER_GESAMTBREITE, z.gesamtBreite);
  speichereInhaltsBreite(SPEICHER_GESAMTBREITE, z.inhaltsBreite);
  // Kein gemerkter Sortier-Stand heißt „unsortiert" — und muss deshalb
  // GESCHRIEBEN werden. Den Schlüssel einfach in Ruhe zu lassen, ließe die
  // Sortierung des vorigen Reiters stehen.
  speichereSortStand(SPEICHER_KOPF_SORTIERUNG, z.kopfSortierung ?? { key: null, dir: 'desc' });

  useEigeneReiter.getState().meldeAngewendet();
}

/**
 * Einen eigenen Reiter **verlassen** — der Klick auf einen festen Reiter.
 *
 * Ohne das war der Klick ein Nichts (v4.108): der eigene Reiter gilt als aktiv,
 * solange der Stand seine Signatur trifft. Sitzt er auf derselben Basis, die man
 * anklickt — der gemeldete Fall war „Antragsphase" —, ändert `setActiveView`
 * nichts, die Signatur passt weiter, und die Leiste markiert unverändert den
 * eigenen Reiter. Es sah aus, als reagiere die Leiste nicht.
 *
 * Abgeräumt wird der **Ausschnitt**, nicht die Anordnung: Filterleiste,
 * Kopf-Auswahl und die Beendet-Sicht entscheiden, WELCHE Anträge dastehen — und
 * genau darüber legt ein fester Reiter seine Zusage ab. Spaltensatz, Dichte,
 * Gruppierung und Sortierung bleiben: sie sind eine Vorliebe, die man zwischen
 * den Reitern mitnimmt, und sie zurückzusetzen hieße, dem Nutzer beim
 * Reiterwechsel seine Tabelle umzubauen. Dass die Signatur schon durch das
 * geräumte Ausschnitts-Feld nicht mehr trifft, genügt.
 *
 * Der Suchtext gehört zu keinem Reiter (er steht nicht im `ReiterKern`) und wird
 * deshalb auch hier nicht angefasst.
 */
export function verlasseEigenenReiter(ziel: ViewKey): void {
  const a = useAntraegeStore.getState();
  a.setActiveView(ziel);
  useFilterState.getState().clearAll();
  useKopfFilter.getState().setzeStand({});

  // Die Quickfilter-Pillen stehen NICHT im `ReiterKern` — ein eigener Reiter
  // nimmt sie also weder mit noch stellt er sie her. Umso mehr müssen sie hier
  // fallen: sie schneiden die Menge genauso wie ein Filter aus der Leiste, und
  // eine Pille „PreCheck: offen", die einen frisch gewählten festen Reiter
  // überlebt, ist genau die stille Einschränkung, die man später der Liste
  // ankreidet statt der Pille.
  a.setProjektart('alle');
  a.setPrecheckBucket('Alle');
  a.setStillstandTage(null);
  a.setAmpelQuickfilter(null);
  // Was eine Frage gesetzt hat, gehört ebenfalls zum Ausschnitt: der
  // Kürzel-Ausschnitt, ihre Leitbegriffe — und die Frage selbst gilt danach
  // wieder als ungestellt, damit der Satz im Feld nichts filtert.
  a.setFrageKuerzel(null);
  a.setPlanTeile(null);
  a.setFrageGestellt(null);
  // Die Standardstellung wohnt bei den Optionen, nicht hier — dieselbe Quelle,
  // aus der `useBeendetSichtbarkeit` sie beim Start liest.
  useBeendetSichtbarkeit.getState().setAusgeblendet(DEFAULT_BEENDET_SICHT === 'aus');
}
