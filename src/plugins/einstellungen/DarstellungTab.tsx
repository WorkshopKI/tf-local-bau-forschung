import { useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PRESET_COLORS, applyThemeColor, setDarkMode, isDarkMode } from '@/components/ui/theme';
import { useProfile } from '@/core/hooks/useProfile';
import { SettingsSectionHeader } from './_shared/settings-primitives';

/**
 * „Darstellung"-Inhalt (Primärfarbe, Erscheinungsbild, Vorschau) — aus der
 * EinstellungenPage ausgelagert (Design-Handoff `_design/handoff/einstellungen-*`).
 * Im Panel „Darstellung & Bedienung" gefolgt von der Tastatur-Sektion.
 */
export function DarstellungTab(): React.ReactElement {
  const { profile, updateProfile } = useProfile();
  const [dark, setDark] = useState(isDarkMode());

  const currentHue = profile?.theme.hue ?? 215;

  const handleColorChange = (h: number, s: string, l: string): void => {
    applyThemeColor(h, s, l);
    if (profile) updateProfile({ theme: { ...profile.theme, hue: h } });
  };

  const handleDarkToggle = (): void => {
    const next = !dark;
    setDark(next);
    setDarkMode(next);
    if (profile) updateProfile({ theme: { ...profile.theme, dark: next } });
  };

  return (
    <div className="space-y-8">
      {/* Primärfarbe */}
      <section id="sec-farbe" className="scroll-mt-20">
        <SettingsSectionHeader label="Primärfarbe" />
        <div className="flex gap-2.5">
          {PRESET_COLORS.map(c => {
            const selected = currentHue === c.h;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => handleColorChange(c.h, c.s, c.l)}
                title={c.name}
                aria-label={c.name}
                aria-pressed={selected}
                className="w-[30px] h-[30px] rounded-full cursor-pointer inline-flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  backgroundColor: `hsl(${c.h}, ${c.s}, ${c.l})`,
                  outline: selected ? '2px solid var(--tf-text)' : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              >
                {selected && <Check size={16} className="text-white" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Erscheinungsbild */}
      <section id="sec-erscheinung" className="scroll-mt-20">
        <SettingsSectionHeader label="Erscheinungsbild" />
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[13.5px] text-[var(--tf-text)]">{dark ? 'Dark Mode' : 'Light Mode'}</span>
          <Kbd>Strg + Umschalt + D</Kbd>
          <span className="flex-1" />
          <button
            type="button"
            onClick={handleDarkToggle}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-[var(--tf-radius)] text-[13px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
            style={{ border: '0.5px solid var(--tf-border-hover)' }}
          >
            {dark ? <Sun size={13} strokeWidth={1.5} /> : <Moon size={13} strokeWidth={1.5} />}
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>

        {/* Vorschau */}
        <div className="flex items-center gap-2 flex-wrap mt-4">
          <span className="text-[12px] text-[var(--tf-text-tertiary)] mr-1">Vorschau</span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] bg-[var(--tf-primary)] text-white">Akzent</span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)]">Akzent Light</span>
          <Badge variant="info">Info</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <a
            href="#"
            onClick={e => e.preventDefault()}
            className="text-[13px] text-[var(--tf-primary)] hover:underline ml-1"
          >
            Link in Primärfarbe
          </a>
        </div>
      </section>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span
      className="font-mono text-[11px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)] rounded-[5px] px-1.5 py-[3px] whitespace-nowrap"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {children}
    </span>
  );
}
