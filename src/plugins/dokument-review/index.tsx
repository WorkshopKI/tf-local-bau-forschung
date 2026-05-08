/**
 * Plugin "dokument-review" — Kurator-UI fuer Phase-2-Triage-Ergebnisse.
 *
 * Liest Manifest-, Skip-List- und Pending-Bucket-Stores ueber die Phase-2-API
 * und erlaubt manuelle Overrides (Typ aendern, Antrag zuordnen, irrelevant
 * markieren, re-triagieren). Multi-Source-Bulk-Triage lebt seit v1.15 im
 * `dokumentenquellen-kuration`-Plugin (zuvor `kurator/Phase2RescanCard`).
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { DokumentReviewPage } from './DokumentReviewPage';

export const dokumentReviewPlugin: TeamFlowPlugin = {
  id: 'dokument-review',
  name: 'Dokument-Review',
  icon: 'ClipboardCheck',
  category: 'kuration',
  order: 35,
  component: DokumentReviewPage,
  kuratorOnly: true,
};
