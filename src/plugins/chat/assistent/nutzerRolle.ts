/**
 * **Wer fragt** — die Fachrolle aus dem Profil und, unabhängig davon, ob der
 * Nutzer Projektleitung ist.
 *
 * Zwei getrennte Angaben, weil viele PL nebenbei noch als FB oder AB
 * bearbeiten: sie wählen ihre Fachrolle UND den PL-Schalter. Wer nur noch PL
 * ist, lässt die Fachrolle auf „alle". Eine sechste Rolle `pl` hätte die
 * Doppelrolle nicht abbilden können — und `Rolle` meint im Status-Kern „wer
 * setzt ein Kürzel in C16", was die PL nicht tut.
 *
 * `leseStatusRolle` bleibt dafür unverändert: Statusliste, Chronik und Board
 * lesen weiter nur die Fachrolle.
 */
import { leseStatusRolle } from '@/core/status/rollen';
import type { NutzerRolle } from '@/core/services/assistent/kontext';

/** Nur die beiden Profilfelder, die hier zählen. */
export interface ProfilRollenFelder {
  status_rolle?: string;
  projektleitung?: boolean;
}

export function leseNutzerRolle(profil: ProfilRollenFelder | null | undefined): NutzerRolle {
  return {
    fachrolle: leseStatusRolle(profil?.status_rolle),
    projektleitung: profil?.projektleitung === true,
  };
}
