/**
 * Gruppe „Erscheinungsbild" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 05).
 *
 * Zwei Zeilen offen — Farbschema als Segment, Primärfarbe als Swatch-Reihe —
 * und die Farb-Vorschau eingeklappt. Die Vorschau erklärt sich selbst, sobald
 * man sie sieht; dauerhaft sichtbar war sie nur laut.
 */
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { PRESET_COLORS, applyThemeColor } from '@/components/ui/theme';
import { useProfile } from '@/core/hooks/useProfile';
import { useDarkMode } from '@/core/hooks/useDarkMode';
import {
  SettingsGruppe,
  SettingsKbd,
  SettingsKlappe,
  SettingsOption,
} from '../_shared/settings-layout';

const HINT_FARBE =
  'Die Primärfarbe färbt Akzente, Links, aktive Zustände und Auswahl-Markierungen. Sie gilt nur auf diesem Gerät und ändert nichts an den Daten.';

export function ErscheinungsbildGruppe(): React.ReactElement {
  const { profile, updateProfile } = useProfile();
  const { dark, umschalten } = useDarkMode();
  const aktuelleHue = profile?.theme.hue ?? 215;

  const farbeWaehlen = (h: number, s: string, l: string): void => {
    applyThemeColor(h, s, l);
    if (profile) void updateProfile({ theme: { ...profile.theme, hue: h } });
  };

  return (
    <SettingsGruppe titel="Erscheinungsbild">
      <SettingsOption
        id="sec-erscheinung"
        label={
          <span className="inline-flex items-center gap-2">
            Farbschema
            <SettingsKbd>Strg + Umschalt + D</SettingsKbd>
          </span>
        }
      >
        <SegmentedToggle
          rolle="auswahl"
          ariaLabel="Farbschema"
          value={dark ? 'dunkel' : 'hell'}
          onChange={id => { if ((id === 'dunkel') !== dark) umschalten(); }}
          options={[{ id: 'hell', label: 'Hell' }, { id: 'dunkel', label: 'Dunkel' }]}
        />
      </SettingsOption>

      <SettingsOption id="sec-farbe" label="Primärfarbe" hint={HINT_FARBE}>
        <div className="flex gap-2">
          {PRESET_COLORS.map(c => {
            const gewaehlt = aktuelleHue === c.h;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => farbeWaehlen(c.h, c.s, c.l)}
                title={c.name}
                aria-label={c.name}
                aria-pressed={gewaehlt}
                className="w-[26px] h-[26px] rounded-full cursor-pointer inline-flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  backgroundColor: `hsl(${c.h}, ${c.s}, ${c.l})`,
                  outline: gewaehlt ? '2px solid var(--tf-text)' : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              >
                {gewaehlt && <Check size={13} className="text-white" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </SettingsOption>

      <SettingsKlappe
        id="sec-farb-vorschau"
        label="Farb-Vorschau"
        storageKey="teamflow_settings_farbvorschau_collapsed"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] bg-[var(--tf-primary)] text-white">Akzent</span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)]">Akzent Light</span>
          <Badge variant="info">Info</Badge>
          <Badge variant="success">Erfolg</Badge>
          <Badge variant="warning">Warnung</Badge>
          <Badge variant="error">Fehler</Badge>
          <span className="text-[13px] text-[var(--tf-primary)] ml-1">Link in Primärfarbe</span>
        </div>
      </SettingsKlappe>
    </SettingsGruppe>
  );
}
