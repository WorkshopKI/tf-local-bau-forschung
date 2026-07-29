import { Settings } from 'lucide-react';

interface FooterSettingsButtonProps {
  /** Steht die Einstellungs-Seite gerade offen? → „Du bist hier"-Zustand. */
  active: boolean;
  /** Rail-Modus (52 px): nur das Zahnrad, ohne Beschriftung. */
  compact?: boolean;
  /** Navigation bleibt beim ShellLayout (`goToPlugin`). */
  onOpen: () => void;
}

/**
 * Einstellungen als Zahnrad in der Sidebar-Fußzeile, links neben der
 * Versionsnummer. Seit v2.360 der Platz der Einstellungen: als Nav-Eintrag
 * bildeten sie zusammen mit der Skill-Verwaltung eine eigene System-Gruppe, die
 * eine Trennlinie und den Leerraum darüber kostete.
 *
 * Bewusst MIT Beschriftung (anders als die Ampeln daneben): der Menüpunkt ist
 * aus der Liste verschwunden, ein wortloses Zahnrad wäre der einzige verbleibende
 * Sichtweg. Im Rail fällt die Beschriftung weg wie überall sonst auch.
 */
export function FooterSettingsButton({
  active,
  compact = false,
  onOpen,
}: FooterSettingsButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Einstellungen öffnen (Strg+Umschalt+E)"
      aria-current={active ? 'page' : undefined}
      aria-label={compact ? 'Einstellungen öffnen' : undefined}
      className={`flex items-center gap-1.5 rounded-[var(--tf-radius)] border-[0.5px] border-transparent text-[11px] transition-colors cursor-pointer shrink-0 ${
        compact ? 'justify-center px-1.5 py-1.5' : 'px-2 py-1.5'
      } ${
        active
          ? 'text-[var(--tf-text)]'
          : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]'
      }`}
      style={active ? { background: 'var(--tf-nav-active-bg)', borderColor: 'var(--tf-nav-active-border)' } : undefined}
    >
      <Settings size={14} className={active ? 'opacity-80' : 'opacity-60'} />
      {!compact && <span>Einstellungen</span>}
    </button>
  );
}
