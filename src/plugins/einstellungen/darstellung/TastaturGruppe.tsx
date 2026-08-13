/**
 * Gruppe „Tastatur" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 05).
 *
 * Die Kürzel-Liste ist der Musterfall für die Klappen-Regel: gebraucht wird sie
 * selten, sie ist aber lang. Also eingeklappt, mit der Anzahl in der Zeile.
 */
import { keyboardService } from '@/core/services/keyboard';
import { SettingsGruppe, SettingsKbd, SettingsKlappe, SettingsLeer } from '../_shared/settings-layout';

export function TastaturGruppe(): React.ReactElement {
  const shortcuts = keyboardService.getAll();

  const istMac = navigator.platform.includes('Mac');
  const formatiere = (combo: string): string =>
    combo
      .replace('mod', istMac ? '⌘' : 'Strg')
      .replace('shift', istMac ? '⇧' : 'Umschalt')
      .replace('alt', istMac ? '⌥' : 'Alt')
      .split('+')
      .join(istMac ? '' : ' + ');

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
