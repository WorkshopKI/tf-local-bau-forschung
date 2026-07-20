/**
 * Schema-Generation 2026 der Einreichungsplattform.
 *
 * Marker sind Pfade, die es nachweislich NUR in dieser Generation gibt:
 * der Wrapper `data.finanzierungsubersicht` (beachte die Schreibweise — der
 * Wrapper heisst `ubersicht`, das Kindfeld darin weiter `finanzierungsuebersicht_…`;
 * zwei Transliterationen im selben Objekt), der neue Telemetrie-Block und zwei
 * neue Formularfelder.
 *
 * Ein einzelner Marker genügt für die Erkennung nicht — `metadata.browserName`
 * etwa fehlt, sobald ein Export serverseitig erzeugt wird. Deshalb zählt die
 * Erkennung Treffer und verlangt Eindeutigkeit gegenüber der anderen Definition.
 */
import type { MapSchemaDefinition } from './schema-typen';
import {
  GEMEINSAME_ANLAGEN, GEMEINSAME_AP_REF_PFADE, GEMEINSAME_CHECKBOX_LABELS,
  GEMEINSAME_FELDER, GEMEINSAME_LISTEN,
} from './schema-felder';

export const SCHEMA_2026: MapSchemaDefinition = {
  id: 'zim-2026',
  label: 'Schema 2026 · Adapter v2',
  marker: [
    'data.finanzierungsubersicht',
    'data.antragsteller.handwerk_confirm',
    'data.auftraegeDritter.istEinAuftragAnDritteGeplant',
  ],
  felder: GEMEINSAME_FELDER,
  listenPfade: GEMEINSAME_LISTEN,
  anlagenPfade: GEMEINSAME_ANLAGEN,
  apRefPfade: GEMEINSAME_AP_REF_PFADE,
  checkboxLabels: GEMEINSAME_CHECKBOX_LABELS,
};
