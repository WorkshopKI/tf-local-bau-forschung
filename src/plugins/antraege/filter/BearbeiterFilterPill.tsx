import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  tokens: string[];
}

/** Pill für den globalen Bearbeiter-Filter aus dem Profil. Hintergrund und
 *  Textfarbe matchen das default-Status-Badge der AntragCards (dezent,
 *  visuell wenig Gewicht). „inkl. Begleitung"-Detail bewusst weggelassen —
 *  sieht der User im Profil. Klick öffnet die Einstellungen. */
export function BearbeiterFilterPill({ tokens }: Props): React.ReactElement {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/einstellungen')}
      title="Bearbeiter-Filter aus Profil — Klick öffnet Einstellungen"
      className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] transition-colors shrink-0"
    >
      <User size={11} />
      <span>Profil: {tokens.join(', ')}</span>
    </button>
  );
}
