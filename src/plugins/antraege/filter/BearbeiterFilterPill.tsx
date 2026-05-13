import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  tokens: string[];
  /** Spiegelt das Profil-Flag `bearbeiter_inkl_begleitung`. Wenn `true`,
   *  zeigt die Pill ein zusätzliches `+ZTP/PFM`-Suffix in Primary-Color
   *  als Status-Indikator. */
  includeBegleitung?: boolean;
}

/** Pill für den globalen Bearbeiter-Filter aus dem Profil. Hintergrund und
 *  Textfarbe matchen das default-Status-Badge der AntragCards (dezent,
 *  visuell wenig Gewicht). Klick öffnet die Einstellungen.
 *
 *  Der `includeBegleitung`-Status wird als kleines Primary-Color-Suffix
 *  sichtbar gemacht, damit der User auf einen Blick erkennt, ob auch
 *  Begleitungs-Spalten (ZTP/PFM) gemacht werden — ohne in die
 *  Einstellungen wechseln zu müssen. */
export function BearbeiterFilterPill({ tokens, includeBegleitung }: Props): React.ReactElement {
  const navigate = useNavigate();
  const tooltip = includeBegleitung
    ? 'Bearbeiter-Filter aus Profil — inkl. Begleitung (ZTP/PFM) — Klick öffnet Einstellungen'
    : 'Bearbeiter-Filter aus Profil — Klick öffnet Einstellungen';
  return (
    <button
      type="button"
      onClick={() => navigate('/einstellungen')}
      title={tooltip}
      className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] transition-colors shrink-0"
    >
      <User size={11} />
      <span>Profil: {tokens.join(', ')}</span>
      {includeBegleitung ? (
        <span style={{ color: 'var(--tf-primary)' }}>· +ZTP/PFM</span>
      ) : null}
    </button>
  );
}
