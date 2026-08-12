/**
 * Facetten der Suchseite: Status, Antragstyp, Jahr, Trefferstelle.
 *
 * Bisher hatte die Seite nur Filter, die an TABELLENSPALTEN hingen — sichtbar
 * erst, wenn man die passende Spalte eingeblendet hatte, und in der neuen
 * Listenansicht gar nicht erreichbar. Die Facetten stehen jetzt über dem
 * Ergebnis und gelten für beide Ansichten.
 *
 * Zwei Regeln, die nicht verhandelbar sind:
 *
 *  1. **Der Status wird über die Kategorie gruppiert** (`statusKategorie`,
 *     abgeleitet mit `getStatusCategory`), nie über den rohen CSV-Wert —
 *     Pitfall #12. Roh gäbe es dutzende Werte, von denen mehrere dasselbe
 *     bedeuten.
 *  2. **Eine Facettenzahl ist eine Zusage.** Gezählt wird gegen die Menge, die
 *     die ÜBRIGEN Facetten übriglassen — steht „Bewilligt 12" da, kommen nach
 *     dem Klick 12 Zeilen. Gegen den Vollbestand gezählt wäre die Zahl eine
 *     andere als das Ergebnis.
 *
 * Der Betrachtungsbereich bleibt unberührt: die Suche steht am Vollbestand
 * (Pitfall #46), Treffer außerhalb tragen ihre Marke und werden nicht
 * weggefiltert.
 *
 * Rein — kein React, kein Store.
 */
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { StatusCategory } from '@/core/utils/status-canonical';
import { getStatusCategoryLabel } from '@/core/utils/status-category-labels';
import { TREFFERFELD_LABEL, type Trefferfeld } from '@/core/services/search/trefferstelle';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import { extractYear } from './columns';

export type FacettenId = 'status' | 'antragstyp' | 'jahr' | 'trefferstelle';

export const FACETTEN_REIHENFOLGE: readonly FacettenId[] = [
  'status', 'antragstyp', 'jahr', 'trefferstelle',
];

export const FACETTEN_LABEL: Record<FacettenId, string> = {
  status: 'Status',
  antragstyp: 'Antragstyp',
  jahr: 'Jahr',
  trefferstelle: 'Trefferstelle',
};

/** Gewählte Werte je Facette. Leeres Array = keine Einschränkung. */
export type FacettenWahl = Readonly<Record<FacettenId, readonly string[]>>;

export const LEERE_WAHL: FacettenWahl = {
  status: [], antragstyp: [], jahr: [], trefferstelle: [],
};

export interface FacettenOption {
  /** Der Rohwert, auf den gefiltert wird. */
  wert: string;
  /** Was im Menü steht. */
  label: string;
  anzahl: number;
}

/**
 * Die Werte, die ein Treffer zu einer Facette beisteuert.
 *
 * Mehrwertig bei der Trefferstelle: ein Antrag kann im Titel UND im Dokument
 * getroffen worden sein und gehört dann zu beiden Facettenwerten.
 */
function werteVon(r: UnifiedSearchResult, id: FacettenId): string[] {
  switch (id) {
    case 'status':
      return r.statusKategorie ? [r.statusKategorie] : [];
    case 'antragstyp': {
      const bucket = r.type === 'antrag' ? getKategorieLabel(r.vbPhase) : null;
      return bucket ? [bucket] : [];
    }
    case 'jahr': {
      const jahr = extractYear(r.bewilligungsdatum) || extractYear(r.antragsdatum);
      return jahr ? [jahr] : [];
    }
    case 'trefferstelle':
      return (r.trefferfelder ?? []) as string[];
    default:
      return [];
  }
}

function label(id: FacettenId, wert: string): string {
  if (id === 'status') return getStatusCategoryLabel(wert as StatusCategory);
  if (id === 'trefferstelle') return TREFFERFELD_LABEL[wert as Trefferfeld] ?? wert;
  return wert;
}

/** Trifft ein Treffer die Auswahl EINER Facette? Leere Auswahl trifft immer. */
function trifftFacette(r: UnifiedSearchResult, id: FacettenId, gewaehlt: readonly string[]): boolean {
  if (gewaehlt.length === 0) return true;
  const werte = werteVon(r, id);
  return werte.some(w => gewaehlt.includes(w));
}

/** Wendet alle Facetten an — die Reihenfolge ist beliebig, es ist ein UND. */
export function wendeFacettenAn(
  results: readonly UnifiedSearchResult[],
  wahl: FacettenWahl,
): UnifiedSearchResult[] {
  return results.filter(r => FACETTEN_REIHENFOLGE.every(id => trifftFacette(r, id, wahl[id])));
}

/**
 * Die Optionen einer Facette samt Zahl.
 *
 * Gezählt wird gegen die Menge nach ALLEN ANDEREN Facetten — genau die Menge,
 * in der ein Klick auf diesen Wert landet. Bereits gewählte Werte bleiben
 * sichtbar, auch wenn sie dadurch auf 0 fallen: sonst verschwände der Wert, den
 * man gerade abwählen möchte.
 */
export function facettenOptionen(
  results: readonly UnifiedSearchResult[],
  id: FacettenId,
  wahl: FacettenWahl,
): FacettenOption[] {
  const basis = results.filter(r => FACETTEN_REIHENFOLGE
    .filter(andere => andere !== id)
    .every(andere => trifftFacette(r, andere, wahl[andere])));

  const zaehler = new Map<string, number>();
  for (const r of basis) {
    for (const w of werteVon(r, id)) zaehler.set(w, (zaehler.get(w) ?? 0) + 1);
  }
  for (const w of wahl[id]) if (!zaehler.has(w)) zaehler.set(w, 0);

  return Array.from(zaehler.entries())
    .map(([wert, anzahl]) => ({ wert, label: label(id, wert), anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl || a.label.localeCompare(b.label, 'de'));
}

export interface AktiverFilterChip {
  id: FacettenId;
  wert: string;
  /** Name der Facette, z. B. „Status". */
  facette: string;
  /** Beschriftung des Werts, z. B. „Bewilligt". */
  wertLabel: string;
}

/** Die gesetzten Filter als entfernbare Chips — ein Zustand ohne sichtbare
 *  Ursache ist ein Zustand, den niemand zurücknimmt. */
export function aktiveFilterChips(wahl: FacettenWahl): AktiverFilterChip[] {
  const out: AktiverFilterChip[] = [];
  for (const id of FACETTEN_REIHENFOLGE) {
    for (const wert of wahl[id]) {
      out.push({ id, wert, facette: FACETTEN_LABEL[id], wertLabel: label(id, wert) });
    }
  }
  return out;
}

/** Die gesetzten Filter als Klartext-Zeilen — für die Kein-Treffer-Auswege
 *  („Filter „Jahr: 2013" entfernen"). EINE Quelle für beide Darstellungen. */
export function aktiveFilterTexte(wahl: FacettenWahl): string[] {
  return aktiveFilterChips(wahl).map(c => `${c.facette}: ${c.wertLabel}`);
}

/** Wert an-/abwählen. Rein — gibt eine neue Wahl zurück. */
export function schalteFacette(wahl: FacettenWahl, id: FacettenId, wert: string): FacettenWahl {
  const aktuell = wahl[id];
  return {
    ...wahl,
    [id]: aktuell.includes(wert) ? aktuell.filter(w => w !== wert) : [...aktuell, wert],
  };
}

export function istWahlLeer(wahl: FacettenWahl): boolean {
  return FACETTEN_REIHENFOLGE.every(id => wahl[id].length === 0);
}
