import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  tokens: string[];
  includeBegleitung: boolean;
}

/** Pill für den globalen Bearbeiter-Filter aus dem Profil. Wird neben den
 *  normalen Filter-Chips dargestellt, ist aber nicht direkt entfernbar —
 *  Klick führt zur Profil-Bearbeitung in den Einstellungen. */
export function BearbeiterFilterPill({ tokens, includeBegleitung }: Props): React.ReactElement {
  const navigate = useNavigate();
  const label = `${tokens.join(', ')}${includeBegleitung ? ' (inkl. Begleitung)' : ''}`;
  return (
    <button
      type="button"
      onClick={() => navigate('/einstellungen')}
      title="Bearbeiter-Filter aus Profil — Klick öffnet Einstellungen"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] bg-[var(--tf-primary-light)] text-[var(--tf-text)] hover:opacity-80 transition-opacity shrink-0"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <User size={11} className="text-[var(--tf-primary)]" />
      <span className="text-[var(--tf-text-secondary)]">Profil:</span>
      <span className="truncate max-w-[220px]">{label}</span>
    </button>
  );
}
