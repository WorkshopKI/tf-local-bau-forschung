/**
 * Re-Export der Textbausteine, die mit v5.2 nach `components/feedback/` gewandert
 * sind — dort erreicht sie auch das Erfassungs-Panel, ohne die verbotene Kante
 * `components/ → plugins/` zu ziehen. Diese Datei bleibt, damit die Importe der
 * Ticket-Oberfläche unangetastet sind.
 */
export {
  BAUSTEINE_DEV,
  BAUSTEINE_NUTZER,
  bausteineFuer,
  type Baustein,
} from '@/components/feedback/beitragBausteine';
