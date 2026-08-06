/**
 * Der Weg von einer Regel dorthin, wo sie gepflegt wird.
 *
 * Erscheint nur, wenn die Seite in dieser Ausgabe überhaupt existiert — ein
 * Verweis, der ins Leere führte, wäre schlimmer als keiner. Der Deep-Link auf
 * den Reiter gibt es (`?tab=regeln`), auf die einzelne Regel nicht; das Glossar
 * behauptet deshalb auch nicht, dorthin zu springen.
 */
import { useNavigate } from 'react-router-dom';
import { isStatusCockpitEnabled } from '@/config/feature-flags';

export function RegelnVerweis(): React.ReactElement | null {
  const navigate = useNavigate();
  if (!isStatusCockpitEnabled()) return null;

  return (
    <p className="border-t border-[var(--tf-border)] pt-3 text-[11.5px] text-[var(--tf-text-tertiary)]">
      Gepflegt wird die Kaskade unter{' '}
      <button
        type="button"
        onClick={() => navigate('/status-cockpit?tab=regeln')}
        className="cursor-pointer text-[var(--tf-primary)] underline underline-offset-2"
      >
        Vorgangs-Regeln → To-do-Regeln
      </button>
      .
    </p>
  );
}
