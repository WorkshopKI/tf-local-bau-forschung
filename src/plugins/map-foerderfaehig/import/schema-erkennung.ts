/**
 * Erkennung der Schema-Generation über diskriminierende Marker.
 *
 * Warum nicht über die Trefferquote der Pflichtfelder: die importrelevanten
 * Felder liegen in beiden bekannten Generationen auf identischen Pfaden. Eine
 * Erkennung „wenigste fehlende Pflichtfelder gewinnt" liefert damit immer
 * Gleichstand — das Ergebnis wäre reine Tie-Break-Willkür und würde eine
 * Genauigkeit vortäuschen, die es nicht gibt.
 *
 * Marker sind stattdessen Pfade, die es nachweislich nur in genau einer
 * Generation gibt. Erkennt keine Definition eindeutig, bricht der Import NICHT
 * ab: er läuft über die gemeinsame Feldzuordnung weiter und meldet die
 * Unsicherheit im Report.
 */
import type { MapMeldung, MapSchemaErkennung, MapSchemaKandidat } from '../types';
import { pfadVorhanden } from './pfad';
import { SCHEMA_2025 } from './schema-2025';
import { SCHEMA_2026 } from './schema-2026';
import type { MapSchemaDefinition } from './schema-typen';

/** Alle bekannten Definitionen, älteste zuerst. */
export const SCHEMA_DEFINITIONEN: readonly MapSchemaDefinition[] = [SCHEMA_2025, SCHEMA_2026];

/** Rückfall-Definition, wenn nichts erkannt wurde: die neueste. */
export const RUECKFALL_SCHEMA: MapSchemaDefinition = SCHEMA_2026;

export interface ErkennungsErgebnis {
  erkennung: MapSchemaErkennung;
  /** Definition, mit der der Adapter arbeitet — nie `null`. */
  definition: MapSchemaDefinition;
  meldungen: MapMeldung[];
}

/** Bewertet eine einzelne Definition gegen die Quelle. Rein. */
function bewerteKandidat(quelle: unknown, def: MapSchemaDefinition): MapSchemaKandidat {
  const marker = def.marker.map(pfad => ({ pfad, vorhanden: pfadVorhanden(quelle, pfad) }));
  const treffer = marker.filter(m => m.vorhanden).length;
  return { id: def.id, label: def.label, marker, treffer, voll: treffer === marker.length };
}

/**
 * Erkennt die Schema-Generation.
 *
 * Entscheidungsreihenfolge:
 * 1. Genau eine Definition hat ALLE Marker → eindeutig erkannt.
 * 2. Mehrere vollständig → mehrdeutig, keine Auswahl (die Datei trägt Merkmale
 *    beider Generationen; hier zu raten wäre schlimmer als zuzugeben).
 * 3. Keine vollständig, aber genau eine mit den meisten Treffern (> 0) →
 *    wahrscheinlichste Generation, als unsicher markiert.
 * 4. Sonst → keine Erkennung.
 *
 * In den Fällen 2–4 läuft der Import über `RUECKFALL_SCHEMA` weiter. Rein.
 */
export function erkenneSchema(quelle: unknown): ErkennungsErgebnis {
  const kandidaten = SCHEMA_DEFINITIONEN.map(def => bewerteKandidat(quelle, def));
  const meldungen: MapMeldung[] = [];

  const vollstaendige = kandidaten.filter(k => k.voll);

  if (vollstaendige.length === 1) {
    const gewinner = vollstaendige[0]!;
    const def = SCHEMA_DEFINITIONEN.find(d => d.id === gewinner.id)!;
    return {
      erkennung: { schemaId: gewinner.id, eindeutig: true, kandidaten },
      definition: def,
      meldungen,
    };
  }

  if (vollstaendige.length > 1) {
    meldungen.push({
      schwere: 'warnung',
      text: 'Die Datei trägt Merkmale mehrerer Schema-Generationen — die Generation wurde nicht bestimmt.',
      kontext: vollstaendige.map(k => k.label).join(' · '),
    });
    return {
      erkennung: { schemaId: null, eindeutig: false, kandidaten },
      definition: RUECKFALL_SCHEMA,
      meldungen,
    };
  }

  const maxTreffer = Math.max(0, ...kandidaten.map(k => k.treffer));
  const beste = kandidaten.filter(k => k.treffer === maxTreffer);

  if (maxTreffer > 0 && beste.length === 1) {
    const gewinner = beste[0]!;
    const def = SCHEMA_DEFINITIONEN.find(d => d.id === gewinner.id)!;
    const fehlende = gewinner.marker.filter(m => !m.vorhanden).map(m => m.pfad);
    meldungen.push({
      schwere: 'warnung',
      text: `Generation nicht sicher erkannt — „${gewinner.label}" passt am ehesten, es fehlen aber Erkennungsmerkmale.`,
      kontext: `fehlend: ${fehlende.join(', ')}`,
    });
    return {
      erkennung: { schemaId: gewinner.id, eindeutig: false, kandidaten },
      definition: def,
      meldungen,
    };
  }

  meldungen.push({
    schwere: 'warnung',
    text: 'Keine bekannte Schema-Generation erkannt — der Import läuft über die gemeinsame Feldzuordnung.',
    kontext: `geprüft: ${kandidaten.map(k => k.label).join(' · ')}`,
  });
  return {
    erkennung: { schemaId: null, eindeutig: false, kandidaten },
    definition: RUECKFALL_SCHEMA,
    meldungen,
  };
}
