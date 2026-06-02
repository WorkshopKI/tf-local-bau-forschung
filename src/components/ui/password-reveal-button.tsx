import { Eye, EyeOff } from 'lucide-react';

interface PasswordRevealButtonProps {
  revealed: boolean;
  onToggle: () => void;
}

/**
 * Kleiner „Passwort anzeigen/verbergen"-Button (Auge), absolut rechts im Feld.
 * Wird von beiden Input-Primitives (src/components/ui/input.tsx + src/ui/Input.tsx)
 * genutzt, sobald `type="password"` ist — damit User Tippfehler erkennen koennen.
 *
 * - `type="button"`: submittet kein umgebendes Formular.
 * - `tabIndex={-1}`: Tab ueberspringt das Auge → Fokus-/Submit-Fluss bleibt erhalten.
 * - `onMouseDown preventDefault`: Klick stiehlt dem Eingabefeld nicht den Fokus.
 *
 * Muster + Sizing wie AIProviderTab (Eye/EyeOff size 14, tertiary → text on hover).
 */
export function PasswordRevealButton({ revealed, onToggle }: PasswordRevealButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={e => e.preventDefault()}
      onClick={onToggle}
      aria-label={revealed ? 'Passwort verbergen' : 'Passwort anzeigen'}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] transition-colors cursor-pointer"
    >
      {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}
