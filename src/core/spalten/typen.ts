/**
 * Selbst angelegte Spalten der Fördertabelle — das Datenmodell.
 *
 * Drei Arten, eine Mechanik: alle referenzieren Felder, alle rechnen ihre
 * Anzeige beim **Rendern** aus den projizierten Rohwerten. Was projiziert
 * werden muss, sagt `feldRefs` (siehe `refs.ts`); was in der Zelle steht,
 * entscheidet der Renderer.
 *
 * **Warum die Anzeige nicht mitprojiziert wird:** eine Regel mit `tageSeit`
 * oder `datumVor heute` wäre zur Projektionszeit eingefroren und bliebe still
 * falsch, bis jemand neu importiert. Und das Ändern eines Regeltextes würde
 * einen Neuaufbau der ganzen Projektion auslösen, obwohl sich kein Feld
 * geändert hat. Rohwerte projizieren, Anzeige rendern — dann kostet nur ein
 * NEUES Feld einen Rebuild.
 */
import type { Bedingung } from '@/core/status/typen';
import type { SpaltenTyp } from '@/core/services/csv/spalten-inventar';

/** Farbe eines Regel-Treffers. Bewusst die Badge-Varianten der App, damit eine
 *  eigene Spalte aussieht wie die eingebauten und nicht wie ein Fremdkörper. */
export type SpaltenFarbe = 'default' | 'info' | 'success' | 'warning' | 'danger';

export type EigeneSpalteArt = 'feld' | 'sammel' | 'regel';

/** Wem gehört die Spalte. Steckt zusätzlich in der Id — siehe `spaltenId`. */
export type SpaltenHerkunft = 'ich' | 'team';

interface Basis {
  /** `frei:ich:<slug>` bzw. `frei:team:<slug>` — siehe `spaltenId`. */
  id: string;
  /** Spaltenkopf. */
  label: string;
  /** Erste Zeile des Herkunfts-Tooltips. Frei vom Autor; fehlt sie, entsteht
   *  ein Satz aus der Definition. */
  beschreibung?: string;
  /** Startbreite in Pixeln. Ohne Angabe misst die Tabelle wie sonst auch. */
  breite?: number;
}

/** Ein rohes Feld unverändert anzeigen. */
export interface FeldSpalte extends Basis {
  art: 'feld';
  /** `feldId` aus dem Spalten-Inventar (kanonischer Key oder roher CSV-Code). */
  feldId: string;
  typ: SpaltenTyp;
}

/** Das jüngste (oder älteste) gesetzte Datum aus mehreren Feldern — dieselbe
 *  Mechanik wie „FB Status" und die Ordner-Spalten, nur mit eigener Feldmenge. */
export interface SammelSpalte extends Basis {
  art: 'sammel';
  felder: string[];
  wahl: 'juengstes' | 'aeltestes';
}

export interface SpaltenRegel {
  wenn: Bedingung;
  /** Was in der Zelle steht, wenn die Regel greift. */
  text: string;
  farbe?: SpaltenFarbe;
}

/** Geordnete Kaskade — **die erste zutreffende Regel gewinnt**, wie in der
 *  To-do-Engine. Greift keine, gilt `sonst` (oder die Zelle bleibt leer). */
export interface RegelSpalte extends Basis {
  art: 'regel';
  regeln: SpaltenRegel[];
  sonst?: { text: string; farbe?: SpaltenFarbe };
}

export type EigeneSpalte = FeldSpalte | SammelSpalte | RegelSpalte;

/** Präfix aller selbst angelegten Spalten — der Sichtbarkeits-Store erkennt sie
 *  daran, genau wie die Ordner-Spalten an `katstatus:`. */
export const FREIE_SPALTE_PREFIX = 'frei:';

/**
 * Baut die Id. **Die Herkunft steckt IN der Id**, und zwar mit Absicht: so kann
 * eine persönliche Spalte niemals mit einer Team-Spalte kollidieren, auch wenn
 * beide „Restlaufzeit" heißen. Damit entfällt jede Vorrang-Regel — es gibt
 * schlicht keinen Konflikt aufzulösen.
 */
export function spaltenId(herkunft: SpaltenHerkunft, slug: string): string {
  return `${FREIE_SPALTE_PREFIX}${herkunft}:${slug}`;
}

/** Herkunft aus der Id zurücklesen. `null` = keine selbst angelegte Spalte. */
export function herkunftVon(id: string): SpaltenHerkunft | null {
  if (id.startsWith(`${FREIE_SPALTE_PREFIX}ich:`)) return 'ich';
  if (id.startsWith(`${FREIE_SPALTE_PREFIX}team:`)) return 'team';
  return null;
}

export function istFreieSpalte(id: string): boolean {
  return herkunftVon(id) !== null;
}

/**
 * Slug aus einer Beschriftung — Kleinbuchstaben, Umlaute ausgeschrieben, Rest
 * zu `-`. Er geht in die Id ein und wird deshalb **nie** nachgeführt, wenn der
 * Autor die Beschriftung später ändert: die Id ist der Anker der gespeicherten
 * Sichtbarkeit und Breite.
 */
export function slugVon(label: string): string {
  const ersetzt = label
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const kern = ersetzt.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return kern === '' ? 'spalte' : kern;
}
