/**
 * **Eigene Reiter**: ein benannter Arbeitsplatz in der Reiterleiste.
 *
 * Die vier festen Reiter (`views.ts`) sind Code — ihr Prädikat entscheidet, WELCHE
 * Anträge überhaupt in Frage kommen. Ein eigener Reiter erfindet kein zweites
 * Prädikat daneben: er **sitzt auf einem der vier** (`basis`) und legt darüber
 * alles, was man sich sonst jedes Mal neu einstellt — Filter, Ansichtsform,
 * Gruppierung, Sortierung, Spaltensatz, Spaltenbreiten, Zeilendichte und die
 * Auswahl in den Spaltenköpfen.
 *
 * ## Zwei Sorten Zustand, und warum das der ganze Trick ist
 *
 * | | Beispiele | im Reiter | in der Identität |
 * |---|---|---|---|
 * | **Ausschnitt & Anordnung** | Basis, Filterleiste, Kopf-Auswahl, Ansichtsform, Gruppierung, Sortierung, Spaltensatz, Dichte | ja | **ja** |
 * | **Geometrie** | Spaltenbreiten, Gesamtbreite, Kopf-Sortierung | ja | nein |
 *
 * Ein Reiter gilt als *aktiv*, solange der aktuelle Stand seine Identität trifft
 * (`reiterSignatur`) — dieselbe Regel, nach der ein Preset seine Markierung
 * verliert, sobald jemand einen Filter anfasst. Die Geometrie bleibt bewusst
 * draußen: eine Spaltenkante zu ziehen ist eine fortlaufende Mausbewegung, keine
 * Wahl aus einem Menü, und der Reiter dürfte darüber nicht die Markierung
 * verlieren. Die Kopf-Sortierung steht aus demselben Grund dort: ein Klick auf
 * einen Spaltenkopf ist ein Handgriff im Vorbeigehen, kein anderer Arbeitsplatz.
 *
 * **Welche Achsen überhaupt gelten, entscheidet nicht diese Datei**, sondern
 * `baueDarstellungsAchsen` — dieselbe Funktion, die das Darstellungs-Menü
 * aufbaut. Eine zweite Tabelle „welche Achse gilt wann" liefe genau dann
 * auseinander, wenn eine Achse dazukommt.
 *
 * **Keine Trefferzahl am Reiter.** Die vier festen tragen eine, dieser nicht:
 * sie müsste den ganzen Ausschnitt versprechen (Filterleiste, Suche,
 * Bearbeiter-Sicht, Kopf-Auswahl) und käme dabei aus einer anderen Rechnung als
 * die Liste, die danach erscheint. Eine Zahl ist eine Zusage; ungedeckt lieber
 * keine.
 */
import { create } from 'zustand';
import type { ActiveFilter } from '@/core/services/csv';
import type { ViewKey } from './views';
import type { ViewMode } from './viewModes';
import type { SortKey } from './sort';
import type { GroupingMode } from './antragGroups';
import type { TableGroupingMode, TabellenAnsicht } from './tableGrouping';
import type { Dichte } from './useDichteStore';
import type { KopfAuswahl } from './kopfFilter';
import type { SortStand } from '@/components/data-table';
import { signatureOf } from './filter/frequentFilters';
import { baueDarstellungsAchsen } from './darstellungsAchsen';

const STORAGE_KEY = 'teamflow_antraege_eigene_reiter_v1';

/**
 * Obergrenze. Die Reiterleiste scrollt zwar waagerecht, aber ein Reiter, den man
 * erst herbeischieben muss, ist kein Schnellzugriff mehr — vier eigene neben den
 * vier festen sind die Breite, die bei 1340 px ohne Schieben lesbar bleibt.
 * Dieselbe Überlegung wie bei `MAX_PINS` in `filter/pinnedFilters.ts`.
 */
export const MAX_EIGENE_REITER = 4;

/**
 * Der **identitätsstiftende** Teil: Ausschnitt und Anordnung. Eigener Typ, weil
 * genau er verglichen wird — und weil die Reiterleiste ihn aus Stores lesen
 * kann, während die Geometrie in `localStorage` liegt und beim Vergleich nichts
 * zu suchen hat (siehe Modulkopf).
 */
export interface ReiterKern {
  /** Der feste Reiter, auf dem dieser sitzt — sein Prädikat gilt weiter. */
  basis: ViewKey;
  /** Stand der Filterleiste (`useFilterState.active`). */
  filter: ActiveFilter[];
  ansichtsform: ViewMode;
  /** Sortierung in Liste und Karten (in der Tabelle sortiert der Spaltenkopf). */
  sortierung: SortKey;
  gruppierung: GroupingMode;
  tabellenGruppierung: TableGroupingMode;
  tabellenAnsicht: TabellenAnsicht;
  /** Sichtbare Spalten — die Liste selbst, nicht ihr Profilname: zwei
   *  verschiedene eigene Sätze heißen beide „Eigene" und wären sonst gleich. */
  spalten: string[];
  dichte: Dichte;
  /** `true` = beendete Anträge stehen nicht in der Liste (nur im „Alle"-Reiter). */
  beendetAusgeblendet: boolean;
  /** Auswahl in den Spaltenköpfen (nur Tabelle). */
  kopfAuswahl: KopfAuswahl;
}

/** Kern + Geometrie: das, was ein gemerkter Reiter wirklich speichert. */
export interface ReiterZustand extends ReiterKern {
  /** Geometrie — mitgenommen, aber nicht identitätsstiftend (siehe Modulkopf). */
  breiten: Record<string, number>;
  gesamtBreite: number | null;
  inhaltsBreite: boolean;
  kopfSortierung: SortStand | null;
}

export interface EigenerReiter {
  id: string;
  name: string;
  zustand: ReiterZustand;
}

/**
 * Die Identität eines Stands: alles, was den Ausschnitt oder die Anordnung
 * bestimmt — und nur die Achsen, die im jeweiligen Zustand überhaupt gelten.
 *
 * Der Spaltensatz geht als KEY-LISTE ein, nicht als Profilname: `erkenneProfil`
 * liefert für jede nicht-benannte Auswahl denselben Wert („eigene"), und zwei
 * verschiedene eigene Sätze wären damit derselbe Reiter.
 */
export function reiterSignatur(z: ReiterKern): string {
  const achsen = baueDarstellungsAchsen({
    viewMode: z.ansichtsform,
    activeView: z.basis,
    tableAnsicht: z.tabellenAnsicht,
    tableGruppierung: z.tabellenGruppierung,
    listGruppierung: z.gruppierung,
    sortierung: z.sortierung,
    sichtbareSpalten: z.spalten,
    dichte: z.dichte,
    beendetAusgeblendet: z.beendetAusgeblendet,
  });
  const teile: string[] = [`basis:${z.basis}`, `filter:${signatureOf(z.filter)}`];
  for (const a of achsen) {
    teile.push(a.id === 'spalten'
      ? `spalten:${[...z.spalten].sort().join(',')}`
      : `${a.id}:${String(a.value)}`);
  }
  // Spaltenkopf-Filter gibt es nur in der Tabelle — in Liste und Karten ist die
  // gespeicherte Auswahl wirkungslos und darf deshalb nicht mitzählen.
  if (z.ansichtsform === 'compact') {
    const sortiert = Object.keys(z.kopfAuswahl).sort()
      .map(k => `${k}=${[...(z.kopfAuswahl[k] ?? [])].sort().join('+')}`);
    teile.push(`kopf:${sortiert.join(';')}`);
  }
  return teile.join('|');
}

/** Beschreibt derselbe Arbeitsplatz beide Stände? */
export function reiterPasst(a: ReiterKern, b: ReiterKern): boolean {
  return reiterSignatur(a) === reiterSignatur(b);
}

/** Der Reiter, dessen Zustand gerade gilt — oder `null`. */
export function passenderReiter(
  reiter: readonly EigenerReiter[], ist: ReiterKern,
): EigenerReiter | null {
  const sig = reiterSignatur(ist);
  return reiter.find(r => reiterSignatur(r.zustand) === sig) ?? null;
}

/**
 * Einzeiler für den Tooltip: was dieser Reiter mitbringt.
 *
 * Bewusst zählend statt aufzählend — die Namen der Filter stehen in der
 * Filterleiste, hier zählt, DASS welche dabei sind.
 */
export function beschreibeZustand(z: ReiterZustand, basisLabel: string): string {
  const teile: string[] = [basisLabel];
  if (z.filter.length > 0) teile.push(`${z.filter.length} Filter`);
  const kopfSpalten = Object.keys(z.kopfAuswahl).length;
  if (z.ansichtsform === 'compact') {
    teile.push(`Tabelle, ${z.spalten.length} Spalten`);
    if (kopfSpalten > 0) teile.push(`Auswahl in ${kopfSpalten} Spaltenkopf${kopfSpalten === 1 ? '' : '-Feldern'}`);
    if (Object.keys(z.breiten).length > 0) teile.push('eigene Spaltenbreiten');
  } else {
    teile.push(z.ansichtsform === 'cards' ? 'Karten' : 'Liste');
  }
  return teile.join(' · ');
}

/** Tolerantes Lesen: ein Eintrag ohne brauchbaren Zustand fällt still weg,
 *  statt die ganze Leiste mitzunehmen. */
function istReiter(v: unknown): v is EigenerReiter {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return false;
  const z = r.zustand as Record<string, unknown> | undefined;
  return !!z && typeof z.basis === 'string' && Array.isArray(z.filter) && Array.isArray(z.spalten);
}

export function ladeReiter(): EigenerReiter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(istReiter).slice(0, MAX_EIGENE_REITER);
  } catch {
    return [];
  }
}

function speichereReiter(reiter: readonly EigenerReiter[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reiter));
  } catch {
    /* ignore */
  }
}

interface ReiterStore {
  reiter: EigenerReiter[];
  /**
   * Zählt hoch, wenn ein Reiter angewendet wurde. Die Tabelle hängt daran ihren
   * `key` — Spaltenbreiten, Gesamtbreite und Kopf-Sortierung liegen in Hooks,
   * die ihren Wert nur beim MOUNT lesen. Ohne Neuaufbau käme die Geometrie des
   * Reiters erst beim nächsten Seitenwechsel an.
   */
  generation: number;
  merke: (name: string, zustand: ReiterZustand) => void;
  aktualisiere: (id: string, zustand: ReiterZustand) => void;
  benenneUm: (id: string, name: string) => void;
  entferne: (id: string) => void;
  /** Nach dem Anwenden aufrufen — schreibt keinen Zustand, stößt nur den
   *  Neuaufbau der Tabelle an. */
  meldeAngewendet: () => void;
}

export const useEigeneReiter = create<ReiterStore>((set, get) => ({
  reiter: ladeReiter(),
  generation: 0,

  merke: (name, zustand) => {
    if (get().reiter.length >= MAX_EIGENE_REITER) return;
    const neu: EigenerReiter = {
      id: `reiter-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: name.trim() || 'Eigener Reiter',
      zustand,
    };
    const next = [...get().reiter, neu];
    speichereReiter(next);
    set({ reiter: next });
  },

  aktualisiere: (id, zustand) => {
    const next = get().reiter.map(r => (r.id === id ? { ...r, zustand } : r));
    speichereReiter(next);
    set({ reiter: next });
  },

  benenneUm: (id, name) => {
    const sauber = name.trim();
    if (!sauber) return;
    const next = get().reiter.map(r => (r.id === id ? { ...r, name: sauber } : r));
    speichereReiter(next);
    set({ reiter: next });
  },

  entferne: (id) => {
    const next = get().reiter.filter(r => r.id !== id);
    speichereReiter(next);
    set({ reiter: next });
  },

  meldeAngewendet: () => set({ generation: get().generation + 1 }),
}));
