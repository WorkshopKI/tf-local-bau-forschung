/**
 * Test-Helpers fuer das Auslastungs-Plugin.
 *
 * `buildAnonymMapForTests` ersetzt den Legacy-`buildAnonymMap`-Aufruf in Tests
 * mit der Prod-Code-Pipeline `bootstrapKuerzelMap → buildAnonymMapFromKuerzelMap`.
 * Damit testen die Unit-Tests denselben Code-Pfad, den die App nutzt, statt
 * eine deprecated/parallele Funktion.
 */
import type { Antrag, AntragListItem } from '@/core/services/csv/types';
import { bootstrapKuerzelMap, buildAnonymMapFromKuerzelMap } from '../services/identitaet';
import type { AnonymMap } from '../services/identitaet';

export function buildAnonymMapForTests(
  antraege: Array<Antrag | AntragListItem>,
): AnonymMap {
  return buildAnonymMapFromKuerzelMap(bootstrapKuerzelMap(antraege));
}
