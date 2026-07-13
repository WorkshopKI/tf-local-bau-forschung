import { keyboardService } from '@/core/services/keyboard';
import { CollapsibleSettingsSection } from './_shared/settings-primitives';

export function TastaturTab(): React.ReactElement {
  const shortcuts = keyboardService.getAll();

  const isMac = navigator.platform.includes('Mac');
  const formatCombo = (combo: string): string => {
    return combo
      .replace('mod', isMac ? '⌘' : 'Strg')
      .replace('shift', isMac ? '⇧' : 'Umschalt')
      .replace('alt', isMac ? '⌥' : 'Alt')
      .split('+').join(isMac ? '' : ' + ');
  };

  return (
    <CollapsibleSettingsSection
      id="sec-tastatur"
      label="Tastatur Shortcuts"
      storageKey="teamflow_settings_tastatur_collapsed"
      defaultOpen={false}
      count={shortcuts.length}
    >
      {shortcuts.length === 0 ? (
        <p className="text-[13px] text-[var(--tf-text-secondary)]">Keine Shortcuts registriert</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
          {shortcuts.map(s => (
            <div
              key={s.combo}
              className="flex items-center justify-between py-2.5 border-b border-[var(--tf-border)]"
            >
              <span className="text-[13px] text-[var(--tf-text-secondary)]">{s.description}</span>
              <span className="font-mono text-[11px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)] rounded-[5px] px-1.5 py-[3px] whitespace-nowrap" style={{ border: '0.5px solid var(--tf-border)' }}>
                {formatCombo(s.combo)}
              </span>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSettingsSection>
  );
}
