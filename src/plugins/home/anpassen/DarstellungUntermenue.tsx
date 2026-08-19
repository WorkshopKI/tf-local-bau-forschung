/**
 * Untermenü „Darstellung": Primärfarbe und Hell/Dunkel — dieselben zwei Regler
 * wie in Einstellungen › Darstellung, nur dort, wo man ihre Wirkung sieht.
 * Beide schreiben über die bestehenden Wege (`applyThemeColor` + Profil bzw.
 * `useDarkMode`), es gibt keinen zweiten Schreibpfad und keinen eigenen Zustand.
 *
 * „Dichte Normal/Kompakt" aus dem Handoff-Prototyp fehlt hier bewusst: eine
 * app-weite Dichte gibt es nicht, und der Prototyp löst sie über `body{font-size}`
 * — das träfe jede Seite der App. Dichte bleibt eine Achse der einzelnen Listen
 * (`DarstellungDropdown`).
 */
import { Check } from 'lucide-react';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import {
  PRESET_COLORS,
  applyThemeColor,
  farbeAusProfil,
  istGewaehlteFarbe,
} from '@/components/ui/theme';
import { useDarkMode } from '@/core/hooks/useDarkMode';
import { useProfile } from '@/core/hooks/useProfile';
import { MenueLabel } from './menueZeilen';

export function DarstellungUntermenue(): React.ReactElement {
  const { profile, updateProfile } = useProfile();
  const { dark, umschalten } = useDarkMode();
  const aktuelleFarbe = farbeAusProfil(profile?.theme);

  const waehleFarbe = (h: number, s: string, l: string): void => {
    applyThemeColor(h, s, l);
    // Alle DREI Werte — siehe `farbeAusProfil`.
    if (profile) void updateProfile({ theme: { ...profile.theme, hue: h, sat: s, lit: l } });
  };

  return (
    <>
      <MenueLabel>Primärfarbe</MenueLabel>
      <div className="flex flex-wrap gap-[7px] px-2.5 pb-2.5 pt-0.5">
        {PRESET_COLORS.map(c => {
          const gewaehlt = istGewaehlteFarbe(c, aktuelleFarbe);
          return (
            <button
              key={c.name}
              type="button"
              title={c.name}
              aria-label={c.name}
              aria-pressed={gewaehlt}
              onClick={() => waehleFarbe(c.h, c.s, c.l)}
              className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--tf-primary)] focus-visible:outline-offset-2"
              style={{
                backgroundColor: `hsl(${c.h}, ${c.s}, ${c.l})`,
                border: `1.5px solid ${gewaehlt ? 'var(--tf-text)' : 'transparent'}`,
              }}
            >
              {/* `invisible` statt bedingtem Rendern — konstante Maße, kein
                  Sprung beim Wechsel (Pitfall #14). */}
              <Check size={11} strokeWidth={2.6} className={gewaehlt ? 'text-white' : 'invisible'} />
            </button>
          );
        })}
      </div>
      <MenueLabel>Erscheinungsbild</MenueLabel>
      <div className="px-2.5 pb-2.5 pt-0.5">
        <SegmentedToggle
          rolle="auswahl"
          breit
          ariaLabel="Erscheinungsbild"
          value={dark ? 'dunkel' : 'hell'}
          options={[{ id: 'hell', label: 'Hell' }, { id: 'dunkel', label: 'Dunkel' }]}
          onChange={id => { if ((id === 'dunkel') !== dark) umschalten(); }}
        />
      </div>
    </>
  );
}
