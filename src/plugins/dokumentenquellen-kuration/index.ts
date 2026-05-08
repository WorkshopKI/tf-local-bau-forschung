/**
 * Plugin "dokumentenquellen-kuration" (v1.15) — DMS-Quellen verwalten +
 * indexieren.
 *
 * Zwei Sections in einer Seite:
 *   - "Verwalten" (Dev): Quellen anlegen / verbinden (read-only) / bearbeiten
 *     / loeschen. Sichtbar im Dev-Build (devInfraPanel || import.meta.env.DEV).
 *   - "Aktivieren & indexieren" (Kurator): Switches pro Quelle, Run-Trigger
 *     mit Live-Progress. Immer sichtbar fuer Kuratoren.
 *
 * Multi-Source-Indexierung: pro aktiver Quelle wird ein Bulk-Triage-Run
 * gestartet, Manifest-Eintraege bekommen `source_id` zur Quell-Zuordnung.
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { DokumentenquellenPage } from './DokumentenquellenPage';

export const dokumentenquellenKurationPlugin: TeamFlowPlugin = {
  id: 'dokumentenquellen-kuration',
  name: 'Dokumentenquellen',
  icon: 'FolderTree',
  category: 'kuration',
  order: 30,
  component: DokumentenquellenPage,
  kuratorOnly: true,
};
