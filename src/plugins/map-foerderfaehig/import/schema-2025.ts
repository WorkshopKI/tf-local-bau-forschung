/**
 * Schema-Generation 2025 der Einreichungsplattform.
 *
 * Marker sind Pfade, die es nachweislich NUR in dieser Generation gibt:
 * die Finanzjahres-Blöcke liegen direkt unter `data` (ab 2026 gewandert nach
 * `data.finanzierungsubersicht`), und `werteUbertragen` ist ein Formular-
 * Hilfsflag, das die Nachfolgegeneration nicht mehr exportiert.
 */
import type { MapSchemaDefinition } from './schema-typen';
import {
  GEMEINSAME_ANLAGEN, GEMEINSAME_AP_REF_PFADE, GEMEINSAME_CHECKBOX_LABELS,
  GEMEINSAME_FELDER, GEMEINSAME_LISTEN,
} from './schema-felder';

export const SCHEMA_2025: MapSchemaDefinition = {
  id: 'zim-2025',
  label: 'Schema 2025 · Adapter v1',
  marker: [
    'data.istVorjahr',
    'data.werteUbertragen',
  ],
  felder: GEMEINSAME_FELDER,
  listenPfade: GEMEINSAME_LISTEN,
  anlagenPfade: GEMEINSAME_ANLAGEN,
  apRefPfade: GEMEINSAME_AP_REF_PFADE,
  checkboxLabels: GEMEINSAME_CHECKBOX_LABELS,
};
