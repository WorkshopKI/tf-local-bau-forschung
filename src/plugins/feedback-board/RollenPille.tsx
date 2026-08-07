/**
 * Der Rollen-Umschalter als Kopf-Pille (v3.24).
 *
 * Vorher war das ein `ScopeTabs variant="segmented"` mit gefülltem Primary-
 * Segment — die Optik eines Haupt-Bedienelements für eine Vorschau-Funktion, die
 * nur Verwalter überhaupt sehen. Jetzt trägt sie die kanonische Kopf-Pillen-
 * Klassenkette der App: dieselbe wie `BearbeiterFilterPill` („Profil: THÜ") und
 * `BereichChip` auf den Förderanträgen.
 *
 * **Klick-Toggle, kein Popover**: es gibt genau zwei Zustände, ein Menü wäre ein
 * Klick zu viel. Und wie ihre Vorbilder zeigt die Pille den IST-Zustand, nicht
 * das Ziel des Klicks — „Sicht: Entwickler" heißt „du siehst gerade die
 * Entwickler-Sicht", nicht „hier klicken für Entwickler".
 *
 * Icon `Eye` und nicht `User`: es geht um den Blickwinkel auf denselben Bestand.
 * `User` ist app-weit mit „Person/Bearbeiter" belegt (BearbeiterFilterPill).
 */
import { Eye } from 'lucide-react';

interface Props {
  /** `true` = der Verwalter schaut gerade in die Nutzer-Sicht. */
  nutzerVorschau: boolean;
  onChange: (nutzerVorschau: boolean) => void;
}

export function RollenPille({ nutzerVorschau, onChange }: Props): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onChange(!nutzerVorschau)}
      aria-pressed={nutzerVorschau}
      aria-label={`Sicht: ${nutzerVorschau ? 'Nutzer' : 'Entwickler'} — umschalten`}
      title={nutzerVorschau
        ? 'Sicht: Nutzer — Klick zurück zur Entwickler-Sicht'
        : 'Sicht: Entwickler — Klick zeigt, was beim Melder ankommt'}
      className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] transition-colors shrink-0"
    >
      <Eye size={11} />
      <span>Sicht: {nutzerVorschau ? 'Nutzer' : 'Entwickler'}</span>
    </button>
  );
}
