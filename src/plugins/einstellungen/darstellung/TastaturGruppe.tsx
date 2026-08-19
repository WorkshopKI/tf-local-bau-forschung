/**
 * Gruppe „Tastatur" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 05).
 *
 * Die Kürzel-Liste ist der Musterfall für die Klappen-Regel: gebraucht wird sie
 * selten, sie ist aber lang. Also eingeklappt, mit der Anzahl in der Zeile.
 */
import { keyboardService } from '@/core/services/keyboard';
import { SettingsGruppe, SettingsKbd, SettingsKlappe, SettingsLeer } from '@/components/settings';

export function TastaturGruppe(): React.ReactElement {
  const shortcuts = keyboardService.getAll();

  const istMac = navigator.platform.includes('Mac');

  /**
   * Ein Kürzel in Klartext. Token für Token, nicht per `replace` über die
   * ganze Zeichenkette: `String.replace` mit einem Text-Muster ersetzt nur das
   * ERSTE Vorkommen, und die eigentliche Taste blieb roh stehen. Dieselbe
   * Kombination stand dadurch auf einer Seite in zwei Schreibweisen
   * („Strg + Umschalt + D" gegen „… + d"), und `escape` erschien als „escape".
   */
  const taste = (roh: string): string => {
    const t = roh.trim().toLowerCase();
    const sonder: Record<string, string> = {
      mod: istMac ? '⌘' : 'Strg',
      shift: istMac ? '⇧' : 'Umschalt',
      alt: istMac ? '⌥' : 'Alt',
      ctrl: istMac ? '⌃' : 'Strg',
      meta: istMac ? '⌘' : 'Win',
      escape: 'Esc',
      esc: 'Esc',
      enter: istMac ? '⏎' : 'Enter',
      space: 'Leertaste',
      tab: 'Tab',
      backspace: istMac ? '⌫' : 'Rücktaste',
      delete: 'Entf',
      arrowup: '↑',
      arrowdown: '↓',
      arrowleft: '←',
      arrowright: '→',
    };
    return sonder[t] ?? (t.length === 1 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1));
  };

  const formatiere = (combo: string): string =>
    combo.split('+').map(taste).join(istMac ? '' : ' + ');

  return (
    <SettingsGruppe titel="Tastatur">
      <SettingsKlappe
        id="sec-tastatur"
        label="Alle Tastenkürzel"
        storageKey="teamflow_settings_tastatur_collapsed"
        zaehler={shortcuts.length}
      >
        {shortcuts.length === 0 ? (
          <SettingsLeer>Keine Kürzel registriert.</SettingsLeer>
        ) : (
          <div>
            {shortcuts.map(s => (
              <div
                key={s.combo}
                className="flex items-center justify-between gap-4 py-[7px] border-t first:border-t-0"
                style={{ borderTopColor: 'var(--tf-border)', borderTopWidth: '0.5px' }}
              >
                <span className="text-[12.5px] text-[var(--tf-text-secondary)]">{s.description}</span>
                <SettingsKbd>{formatiere(s.combo)}</SettingsKbd>
              </div>
            ))}
          </div>
        )}
      </SettingsKlappe>
    </SettingsGruppe>
  );
}
