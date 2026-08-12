/**
 * Lane-Kopf-Glyphen je Status-Kategorie (analog STATUS_COLUMN_ICONS im
 * Feedback-Board).
 *
 * Eigene Datei, weil sie von zwei Ansichten gelesen wird (Widget + Vollbild) und
 * `kanbanLanes.ts` daneben ausdrücklich rein bleiben soll — Lucide-Glyphen sind
 * React-Komponenten.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  CheckCircle2,
  FileQuestion,
  Handshake,
  HelpCircle,
  Inbox,
  Scale,
  Search,
  XCircle,
} from 'lucide-react';
import type { StatusCategory } from '@/core/utils/status-canonical';

export const KATEGORIE_ICON: Record<StatusCategory, LucideIcon> = {
  offen: Inbox,
  in_pruefung: Search,
  nachforderung: FileQuestion,
  entscheidung: Scale,
  bewilligt: CheckCircle2,
  begleitung: Handshake,
  abgelehnt: XCircle,
  abgeschlossen: Archive,
  sonstige: HelpCircle,
};
