/**
 * Sidebar-Modus: die entscheidbaren Teile der Auf/Zu-Logik, getrennt vom
 * ShellLayout — die Codebase kennt keine Render-Tests (`@testing-library` ist
 * nicht installiert, `environment: 'node'`), also wandert alles Prüfbare in
 * pure Funktionen (Muster wie `abschnittAnzeige.ts`).
 *
 * Die eine Regel, die hier bewacht wird: **das schmale Fenster erzwingt die
 * Schiene, ändert aber die Wahl des Nutzers nicht.** Bis v2.371 schrieb der
 * Mobil-Zweig direkt in denselben State, der nach localStorage persistiert
 * wurde — ein einziges schmales Fenster (angedockt, kleine Citrix-Auflösung)
 * rastete die Icon-Leiste damit dauerhaft ein, auch auf großen Bildschirmen,
 * und der einzige Rückweg war das kleine Chevron im Kopf der Leiste.
 */

export type SidebarModus = 'expanded' | 'rail';

/** Ab hier gilt das Fenster als schmal — die Leiste wird zur Schublade. */
export const MOBILE_BREAKPOINT = 768;

export interface SidebarZustand {
  /** Bewusste Wahl des Nutzers. Der EINZIGE Wert, der persistiert wird. */
  nutzerWahl: SidebarModus;
  /** Fensterbreite unter `MOBILE_BREAKPOINT`. */
  schmalesFenster: boolean;
  /** Nutzer hat die Schublade im schmalen Fenster aufgezogen (flüchtig). */
  schubladeOffen: boolean;
}

/**
 * Was der Nutzer sieht. Im schmalen Fenster entscheidet allein die Schublade,
 * im breiten allein die gespeicherte Wahl.
 */
export function effektiverModus({ nutzerWahl, schmalesFenster, schubladeOffen }: SidebarZustand): SidebarModus {
  if (schmalesFenster) return schubladeOffen ? 'expanded' : 'rail';
  return nutzerWahl;
}

/** Umschalten im breiten Fenster: das ist die neue gespeicherte Wahl. */
export function umgeschalteteWahl(nutzerWahl: SidebarModus): SidebarModus {
  return nutzerWahl === 'expanded' ? 'rail' : 'expanded';
}

/**
 * Was nach einem Fensterwechsel gespeichert bleibt — per Konstruktion die
 * unveränderte Nutzerwahl. Existiert als benannte Funktion, damit der
 * Regressionstest die Aussage direkt prüfen kann statt sie nachzubauen.
 */
export function zuPersistierenderModus(zustand: SidebarZustand): SidebarModus {
  return zustand.nutzerWahl;
}
