/**
 * Die Wurzeln der persönlichen Ordner — eine Lesestelle, keine Gruppen-Id im Code.
 *
 * Die persönlichen Ordner der Anwender liegen seit v4.1 unter MEHREREN Wurzeln
 * (PL-Gruppe, Bearbeiter-Gruppe), die beim Einsammeln alle verbunden sein
 * müssen. Welche das sind, steht in `personalFolder.roots` der Config —
 * ausschließlich dort. Eine dritte Gruppe ist damit ein Config-Eintrag und kein
 * Release.
 *
 * Der Alt-Slot `user-folders-root` (eine Wurzel, bis v4.0) bleibt lesbar und
 * erscheint als eigener Eintrag unter der reservierten Id `legacy`. Er wird
 * NICHT automatisch einer Gruppe zugeordnet — welche es war, weiß niemand.
 */

import { runtimeConfig, type TeamflowPersonalFolderConfig } from './runtime-config';

export interface PersonalRootDef {
  id: string;
  label: string;
}

/** Reservierte Id des Alt-Slots `user-folders-root` (eine Wurzel, bis v4.0). */
export const PERSONAL_ROOT_LEGACY_ID = 'legacy';

/**
 * Beschriftung des Alt-Slots — bewusst NEUTRAL.
 *
 * Sie stand bis v4.1.0 als „Bisheriger Ordner (bitte neu zuordnen)" hier und
 * war damit eine Aufforderung, die je nach Lage falsch ist: sobald alle
 * Gruppen verbunden sind, ist längst zugeordnet und übrig bleibt nur der alte
 * Verweis. Was zu tun ist, entscheidet deshalb die Zeile (`wurzelLage.ts`),
 * nicht die Konstante — sie erscheint auch im Sammelbericht („Bisheriger
 * Ordner: 3 gelesen"), wo eine Aufforderung nichts zu suchen hat.
 */
export const PERSONAL_ROOT_LEGACY_LABEL = 'Bisheriger Ordner';

/**
 * Die konfigurierten Wurzeln in Config-Reihenfolge. Rein — nimmt die Config als
 * Parameter, damit sie ohne Build-Define testbar ist.
 */
export function personalRootsAusConfig(
  cfg: TeamflowPersonalFolderConfig | undefined,
): PersonalRootDef[] {
  const roots = cfg?.roots ?? [];
  return roots
    .filter(r => r && typeof r.id === 'string' && r.id !== PERSONAL_ROOT_LEGACY_ID)
    .map(r => ({ id: r.id, label: r.label || r.id }));
}

/** Die Wurzeln dieses Builds. */
export function personalRoots(): PersonalRootDef[] {
  return personalRootsAusConfig(runtimeConfig.personalFolder);
}
