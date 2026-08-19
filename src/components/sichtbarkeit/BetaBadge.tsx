/**
 * Das „Beta"-Abzeichen — der einzige sichtbare Hinweis der beiden Achsen.
 *
 * **Nur Beta bekommt eins.** „Beta" sagt: das kann sich noch ändern, verlass
 * dich nicht darauf — eine Information, die der Nutzer im Moment des Sehens
 * braucht. „Experte" sagt nur, dass es selten gebraucht wird; wer es
 * eingeschaltet hat, weiß das bereits. Ein zweites Abzeichen wäre Dekoration.
 *
 * Trägt ein Element beide Marken, steht trotzdem nur „Beta" dran.
 */
import { Badge } from '@/components/ui/badge';
import { useSichtbar } from '@/core/hooks/useSichtbar';
import {
  SICHTBARKEITS_KATALOG, baueIndex, effektiveMarken, useSichtbarkeitStore,
} from '@/core/sichtbarkeit';

const INDEX = baueIndex(SICHTBARKEITS_KATALOG);

/** Trägt das Element gerade die Beta-Marke? Für Aufrufer, die selbst rendern. */
export function useIstBeta(id: string): boolean {
  const overlay = useSichtbarkeitStore(s => s.overlay);
  return effektiveMarken(id, INDEX, overlay).beta === true;
}

interface Props {
  /** Katalog-Id des Elements, an dem das Abzeichen hängt. */
  id: string;
  className?: string;
}

/**
 * Rendert nichts, wenn das Element nicht als Beta gilt oder gerade gar nicht
 * sichtbar ist — ein Abzeichen an etwas Verborgenem hätte kein Gegenüber.
 */
export function BetaBadge({ id, className }: Props): React.ReactElement | null {
  const istBeta = useIstBeta(id);
  const sichtbar = useSichtbar();
  if (!istBeta || !sichtbar(id)) return null;
  return (
    <Badge variant="info" title="In Erprobung — kann sich noch ändern" className={className}>
      Beta
    </Badge>
  );
}
