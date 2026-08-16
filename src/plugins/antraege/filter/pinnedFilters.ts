/**
 * Schnellzugriff: was aus der Filterleiste nach oben gepinnt ist.
 *
 * Drei Arten, aus dem Redesign-Handoff `_design/handoff/Förderanträge/`:
 *
 * | Art | Nadel sitzt an | Oben wird daraus |
 * |---|---|---|
 * | `wert` | einem einzelnen Facetten-Wert | Umschalt-Chip (`Fristdatum überfällig 4`) |
 * | `facette` | dem Merkmalskopf (nur wo die Werte in eine Zeile passen) | Umschalter (`Projektart · Alle · Einzel 11 · Koop 2`) |
 * | `kombination` | einem „Häufig benutzt"-Eintrag, einer Status-PHASE, und dem Kopf jedes Merkmals, das kein Umschalter sein kann | Schalter, der seinen Satz DAZULEGT |
 *
 * Die Kombination ist damit auch die Antwort für alles, was sich nicht in
 * abzählbare Werte zerlegen lässt: eine Datumsspanne, eine Zahlenspanne, ein
 * Freitext, eine Auswahlliste mit 16 Werten. Angepinnt wird dort die AKTUELLE
 * Einstellung — es gibt keinen zweiten Zustand, zwischen dem ein Umschalter
 * wechseln könnte.
 *
 * **Die Wahl liegt pro Rechner** (`localStorage`), wie der Filterstand selbst
 * (`activeFilterPersistence.ts`) und die Häufig-Liste (`frequentFilters.ts`).
 * Sie ins Profil zu heben wäre eine eigene Entscheidung — der Handoff stellt sie
 * als offenen Punkt 9, und ein Schnellzugriff ist eine Gewohnheit des
 * Arbeitsplatzes, keine Aussage über den Vorgang.
 *
 * **Der Unterschied zwischen Eintrag und Chip** ist der Grund, warum die
 * Kombination hier überhaupt Zustand mitführt: der Eintrag in der Leiste ist ein
 * SPRUNG (`clearAll` + setzen, siehe `FilterSidebar`), der Chip oben ist ein
 * SCHALTER. Er merkt sich beim Einschalten, was er beigesteuert hat
 * ({@link KombiDelta}), und nimmt beim Ausschalten genau das zurück — was schon
 * vorher stand, bleibt stehen. Ohne dieses Gedächtnis wäre „aus" ein zweiter
 * Sprung und risse Filter mit weg, die der Chip nie gesetzt hat.
 *
 * Alle Ableitungen stehen als reine Funktionen daneben und werden vom Store nur
 * gerufen — sie sind die testbare Hälfte.
 */
import { create } from 'zustand';
import type { ActiveFilter, ActiveFilterValue, FilterDefinition } from '@/core/services/csv';

const STORAGE_KEY = 'teamflow_antraege_pinned_filters_v1';

/**
 * Obergrenze der Schnellzugriffe. Der Handoff fragt danach (offener Punkt 9):
 * die Zeile über der Tabelle bricht sonst um, und eine umbrechende Zeile aus
 * Umschaltern ist genau die Pillenzeile, die das Redesign abschaffen wollte.
 * Sechs, weil ein Umschalter mit drei Werten rund 300 px braucht und zwei davon
 * plus vier Chips eine Zeile bei 1340 px füllen.
 */
export const MAX_PINS = 6;

/**
 * Höchste Wertezahl, bei der eine ganze Facette als Umschalter taugt.
 *
 * Der Handoff sagt „bis zu fünf Werte". Am echten Bestand nachgemessen (7
 * Facetten) qualifizierte sich damit **keine einzige**: VB-Phase hat 6 Werte,
 * Richtlinie 16, der Rest sind Datumsspannen. Sechs, weil die
 * `CollapsibleSeg`-Pille in dieser App ohnehin schon Sätze dieser Größe trägt
 * (die Status-Pille der Quickfilter-Zeile) — und weil eine Grenze, hinter der
 * nichts liegt, keine Grenze ist, sondern eine Abschaltung.
 */
export const MAX_UMSCHALTER_WERTE = 6;

export interface WertPin {
  art: 'wert';
  filterId: string;
  wert: string;
}

export interface FacettePin {
  art: 'facette';
  filterId: string;
}

/** Was der Kombinations-Chip beim Einschalten beigesteuert hat — je Slot einer. */
export interface KombiDelta {
  filterId: string;
  /** Mehrfachauswahl: die Werte, die DIESER Chip ergänzt hat (und nur die). */
  hinzugefuegt?: string[];
  /** Sonst: was vor dem Einschalten im Slot stand (`null` = nichts). */
  vorher?: ActiveFilterValue | null;
}

export interface KombiPin {
  art: 'kombination';
  /**
   * Die Identität — eine undurchsichtige Zeichenkette, kein Inhalt.
   *
   * Aus dem Verlauf und von Merkmalsköpfen kommt `signatureOf(appliedFilters)`
   * (`frequentFilters.ts`). Status-Phasen bilden sie dagegen aus der Phase
   * selbst (`phase:<filterId>:<phaseId>`): welche Stati eine Phase gerade führt,
   * hängt von den übrigen Filtern ab, und eine wertbasierte Signatur läse
   * denselben Pin nach dem nächsten Filter als „nicht angepinnt".
   */
  signatur: string;
  /** Der Satz, den der Chip setzt. Mitgespeichert, weil der Häufig-Eintrag
   *  altern und aus der Top-Liste fallen darf, ohne den Chip zu entwerten. */
  gesetzt: ActiveFilter[];
  /** Nur solange der Chip AN ist. */
  delta?: KombiDelta[];
}

export type PinnedFilter = WertPin | FacettePin | KombiPin;

/** Stabile Identität eines Pins — Schlüssel für Vergleich, Entfernen, React. */
export function pinKey(p: PinnedFilter): string {
  if (p.art === 'wert') return `w:${p.filterId}:${p.wert}`;
  if (p.art === 'facette') return `f:${p.filterId}`;
  return `k:${p.signatur}`;
}

/** Deckt der IST-Wert eines Slots den SOLL-Wert ab? Bei Mehrfachauswahl heißt
 *  das „enthält alle", sonst „ist gleich". */
function wertDeckt(ist: ActiveFilterValue | undefined, soll: ActiveFilterValue): boolean {
  if (ist === undefined) return false;
  if (Array.isArray(soll)) {
    const istArr = Array.isArray(ist) ? (ist as string[]) : [];
    return (soll as string[]).every(v => istArr.includes(v));
  }
  return JSON.stringify(ist) === JSON.stringify(soll);
}

/** Ist dieser Einzelwert gerade gesetzt? */
export function wertAktiv(
  active: readonly ActiveFilter[], filterId: string, wert: string,
): boolean {
  const af = active.find(a => a.filterId === filterId);
  if (!af) return false;
  if (Array.isArray(af.value)) return (af.value as string[]).includes(wert);
  return af.value === wert;
}

/**
 * Der neue Slot-Wert, wenn man diesen Einzelwert umschaltet. `null` = Filter
 * leeren. Bei Mehrfachauswahl wird ergänzt bzw. herausgenommen, bei
 * Einfachauswahl gesetzt bzw. gelöscht — der Chip ist ein Schalter, kein Sprung.
 */
export function wertUmschalten(
  active: readonly ActiveFilter[], def: FilterDefinition, wert: string,
): ActiveFilterValue | null {
  const af = active.find(a => a.filterId === def.id);
  if (def.typ === 'multi_select') {
    const ist = Array.isArray(af?.value) ? [...(af.value as string[])] : [];
    const i = ist.indexOf(wert);
    if (i >= 0) ist.splice(i, 1);
    else ist.push(wert);
    return ist.length > 0 ? ist : null;
  }
  return af?.value === wert ? null : wert;
}

/** Sind ALLE Filter der Kombination gerade gesetzt? */
export function kombiAktiv(
  active: readonly ActiveFilter[], gesetzt: readonly ActiveFilter[],
): boolean {
  if (gesetzt.length === 0) return false;
  return gesetzt.every(g => wertDeckt(active.find(a => a.filterId === g.filterId)?.value, g.value));
}

/** Eine Slot-Änderung: `value === null` heißt „Filter leeren". */
export interface SlotAenderung {
  filterId: string;
  value: ActiveFilterValue | null;
}

/**
 * Einschalten: den Satz DAZULEGEN und festhalten, was dabei wirklich neu war.
 * Mehrfachauswahl wird vereinigt, alles andere überschrieben — mit dem alten
 * Wert im Delta, damit das Ausschalten ihn zurückgeben kann.
 */
export function kombiEinschalten(
  active: readonly ActiveFilter[], gesetzt: readonly ActiveFilter[],
): { aenderungen: SlotAenderung[]; delta: KombiDelta[] } {
  const aenderungen: SlotAenderung[] = [];
  const delta: KombiDelta[] = [];
  for (const g of gesetzt) {
    const af = active.find(a => a.filterId === g.filterId);
    if (Array.isArray(g.value)) {
      const ist = Array.isArray(af?.value) ? (af.value as string[]) : [];
      const neu = (g.value as string[]).filter(v => !ist.includes(v));
      if (neu.length === 0) continue;
      aenderungen.push({ filterId: g.filterId, value: [...ist, ...neu] });
      delta.push({ filterId: g.filterId, hinzugefuegt: neu });
      continue;
    }
    if (af !== undefined && wertDeckt(af.value, g.value)) continue;
    aenderungen.push({ filterId: g.filterId, value: g.value });
    delta.push({ filterId: g.filterId, vorher: af?.value ?? null });
  }
  return { aenderungen, delta };
}

/**
 * Ausschalten: genau das zurücknehmen, was das Einschalten beigesteuert hat.
 *
 * Ohne Delta (der Chip war schon vor dem Neuladen an, das Gedächtnis liegt aber
 * im selben `localStorage` — der Fall tritt nur bei fremd gesetztem Filterstand
 * auf) wird ersatzweise der ganze Satz abgezogen. Das ist die schlechtere, aber
 * nie die falsche Antwort: es bleibt beim „Filter aus", nur eventuell großzügiger.
 */
export function kombiAusschalten(
  active: readonly ActiveFilter[],
  gesetzt: readonly ActiveFilter[],
  delta?: readonly KombiDelta[],
): SlotAenderung[] {
  const wirksam: readonly KombiDelta[] = delta && delta.length > 0
    ? delta
    : gesetzt.map(g => (Array.isArray(g.value)
      ? { filterId: g.filterId, hinzugefuegt: g.value as string[] }
      : { filterId: g.filterId, vorher: null }));
  const aenderungen: SlotAenderung[] = [];
  for (const d of wirksam) {
    const af = active.find(a => a.filterId === d.filterId);
    if (d.hinzugefuegt) {
      const ist = Array.isArray(af?.value) ? (af.value as string[]) : [];
      const rest = ist.filter(v => !d.hinzugefuegt!.includes(v));
      aenderungen.push({ filterId: d.filterId, value: rest.length > 0 ? rest : null });
      continue;
    }
    aenderungen.push({ filterId: d.filterId, value: d.vorher ?? null });
  }
  return aenderungen;
}

/**
 * Steht dieser aktive Filter schon oben als Schnellzugriff?
 *
 * Nur dann darf sein Chip mit × entfallen — sonst stünde dieselbe Einschränkung
 * zweimal in der Zeile. Eine Facette deckt ihren Slot ganz ab; Einzelwerte nur,
 * solange NICHTS Ungepinntes danebensteht (`X = [a, b]` mit Nadel nur an `a`
 * bleibt als Chip sichtbar, sonst verschwände `b` spurlos).
 *
 * Kombinationen decken bewusst nichts ab: sie sind ein Schalter über mehrere
 * Slots, und was tatsächlich filtert, soll weiter einzeln les- und abwählbar sein.
 */
export function aktivIstAngepinnt(
  af: ActiveFilter, pins: readonly PinnedFilter[],
): boolean {
  if (pins.some(p => p.art === 'facette' && p.filterId === af.filterId)) return true;
  const werte = pins
    .filter((p): p is WertPin => p.art === 'wert' && p.filterId === af.filterId)
    .map(p => p.wert);
  if (werte.length === 0) return false;
  if (Array.isArray(af.value)) {
    const arr = af.value as string[];
    return arr.length > 0 && arr.every(v => werte.includes(v));
  }
  return typeof af.value === 'string' && werte.includes(af.value);
}

/**
 * Taugt diese Facette als Umschalter in einer Zeile?
 *
 * Ja/Nein-Facetten sind ausdrücklich dabei — sie sind der Fall, für den ein
 * Umschalter gemacht ist („Verbund-Zugehörigkeit · Alle · Ja · Nein"), und
 * standen zunächst versehentlich draußen, weil die Regel nur Auswahllisten
 * kannte. Spannen (Datum, Zahl) und Freitext bleiben draußen: sie haben keine
 * abzählbaren Werte, die man in eine Zeile schreiben könnte.
 */
export function facetteAlsUmschalterMoeglich(
  def: FilterDefinition, werteAnzahl: number,
): boolean {
  const zaehlbar = def.typ === 'single_select'
    || def.typ === 'multi_select'
    || def.typ === 'boolean_ja_nein';
  if (!zaehlbar) return false;
  return werteAnzahl > 0 && werteAnzahl <= MAX_UMSCHALTER_WERTE;
}

function istPin(v: unknown): v is PinnedFilter {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  if (p.art === 'wert') return typeof p.filterId === 'string' && typeof p.wert === 'string';
  if (p.art === 'facette') return typeof p.filterId === 'string';
  if (p.art === 'kombination') return typeof p.signatur === 'string' && Array.isArray(p.gesetzt);
  return false;
}

export function ladePins(): PinnedFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(istPin).slice(0, MAX_PINS);
  } catch {
    return [];
  }
}

function speicherePins(pins: readonly PinnedFilter[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch {
    /* ignore */
  }
}

interface PinnedStore {
  pins: PinnedFilter[];
  /** Nadel umlegen: vorhanden → ab, sonst dran (solange Platz ist). */
  umschalten: (p: PinnedFilter) => void;
  abnehmen: (key: string) => void;
  /** Gedächtnis des Kombinations-Chips fortschreiben (`null` = ausgeschaltet). */
  setzeDelta: (signatur: string, delta: KombiDelta[] | null) => void;
}

export const usePinnedFilters = create<PinnedStore>((set, get) => ({
  pins: ladePins(),

  umschalten: (p) => {
    const key = pinKey(p);
    const vorhanden = get().pins.some(x => pinKey(x) === key);
    const next = vorhanden
      ? get().pins.filter(x => pinKey(x) !== key)
      : get().pins.length >= MAX_PINS ? get().pins : [...get().pins, p];
    speicherePins(next);
    set({ pins: next });
  },

  abnehmen: (key) => {
    const next = get().pins.filter(x => pinKey(x) !== key);
    speicherePins(next);
    set({ pins: next });
  },

  setzeDelta: (signatur, delta) => {
    const next = get().pins.map(p => {
      if (p.art !== 'kombination' || p.signatur !== signatur) return p;
      if (delta === null) {
        const { delta: _weg, ...rest } = p;
        return rest;
      }
      return { ...p, delta };
    });
    speicherePins(next);
    set({ pins: next });
  },
}));

/** Ist die Nadel vergeben? Als Hook-freie Abfrage für Render-Pfade. */
export function istGepinnt(pins: readonly PinnedFilter[], p: PinnedFilter): boolean {
  const key = pinKey(p);
  return pins.some(x => pinKey(x) === key);
}
