/**
 * MAP „Neuer Prüf-Workflow" — Förderfähigkeitsprüfung von Plattform-Einreichungen.
 *
 * Eigenständiges Plugin, kein Unterordner der Förderanträge: die Einreichung ist
 * eine eigene kv-Entität ohne `Antrag`-Record, mit eigener Liste und eigenem
 * Einstieg. Damit bleibt die produktive CSV-/Antrags-Pipeline unberührt.
 *
 * Doku: docs/architecture/map-foerderfaehig.md
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { MapPage } from './MapPage';

export const mapFoerderfaehigPlugin: TeamFlowPlugin = {
  id: 'map-foerderfaehig',
  route: '/map-foerderfaehig',
  featureFlag: 'mapFoerderfaehig',
  name: 'Förderfähigkeit',
  icon: 'ClipboardCheck',
  category: 'erprobung',
  order: 44,
  component: MapPage,
};

export { MapPage } from './MapPage';
export type {
  MapEinreichung, MapImportReport, MapSchemaId, RechenBefund,
} from './types';
export { importiereEinreichung } from './import/adapter';
export { AP_PM_GRENZE } from './import/rechenchecks';
