/**
 * Dark-Mode: EIN Weg, der DOM und Profil zusammenhält.
 *
 * Bis v2.371 gab es zwei Wege mit verschiedenem Ergebnis — Einstellungen →
 * Darstellung schrieb `theme.dark` ins Profil, Strg+Umschalt+D und der
 * Command-Palette-Eintrag setzten nur das `data-theme`-Attribut. Der über die
 * Tastatur gewählte Dark-Mode war nach dem nächsten Start wieder weg (App.tsx
 * wendet beim Boot `profile.theme.dark` an).
 *
 * `dark` kommt aus dem Profil, nicht aus lokalem State: so zieht die
 * Einstellungen-Seite mit, wenn nebenher das Tastenkürzel gedrückt wird.
 * Ohne Profil (Onboarding) bleibt nur der DOM-Zustand — dort gibt es noch
 * nichts zu persistieren.
 */
import { useCallback } from 'react';
import { isDarkMode, setDarkMode } from '@/components/ui/theme';
import { useProfile } from '@/core/hooks/useProfile';

export interface UseDarkModeReturn {
  dark: boolean;
  umschalten: () => void;
}

export function useDarkMode(): UseDarkModeReturn {
  const { profile, updateProfile } = useProfile();
  const dark = profile?.theme.dark ?? isDarkMode();

  const umschalten = useCallback((): void => {
    // Gegen den DOM prüfen statt gegen `dark`: der Callback landet in einem
    // Tastatur-Handler mit leeren Deps und darf nicht auf einem alten Wert sitzen.
    const next = !isDarkMode();
    setDarkMode(next);
    if (profile) void updateProfile({ theme: { ...profile.theme, dark: next } });
  }, [profile, updateProfile]);

  return { dark, umschalten };
}
