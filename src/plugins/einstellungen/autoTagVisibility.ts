/**
 * Reine Kürzungs-Logik der Auto-Tag-Chip-Wand („Aus deinen bisherigen Anträgen").
 *
 * Regel (Mockup `einstellungen-chips.png`): GEWÄHLTE (aktive) Chips sind IMMER
 * sichtbar; nur UNGEWÄHLTE werden bis zum Cap aufgefüllt, der Rest landet hinter
 * „+ N weitere". Aktiv ⇔ der Tag ist NICHT in `excluded` (Datenmodell unverändert
 * — `excluded` = `ausgeblendeteAutoTags`). Reihenfolge = Original-Reihenfolge.
 */

export interface AutoTagVisibility {
  /** Zu rendernde Chips in Original-Reihenfolge. */
  sichtbar: string[];
  /** Anzahl ausgeblendeter (nur ungewählte) Chips — 0 bei `expanded` oder wenn alles passt. */
  versteckt: number;
}

export function computeAutoTagVisibility(
  tags: string[],
  excluded: Set<string> | string[],
  cap: number,
  expanded: boolean,
): AutoTagVisibility {
  const excludedSet = excluded instanceof Set ? excluded : new Set(excluded);
  const aktivAnzahl = tags.reduce((n, t) => n + (excludedSet.has(t) ? 0 : 1), 0);
  const inaktivGesamt = tags.length - aktivAnzahl;
  // Gewählte immer sichtbar → Slots für ungewählte = Rest bis zum Cap.
  const slots = Math.max(0, cap - aktivAnzahl);

  let inaktivGezeigt = 0;
  const sichtbar: string[] = [];
  for (const tag of tags) {
    const aktiv = !excludedSet.has(tag);
    if (aktiv || expanded) { sichtbar.push(tag); continue; }
    if (inaktivGezeigt < slots) { sichtbar.push(tag); inaktivGezeigt += 1; }
  }
  const versteckt = expanded ? 0 : inaktivGesamt - Math.min(inaktivGesamt, slots);
  return { sichtbar, versteckt };
}
