/**
 * Kern der proportionalen Silhouette (Paket 5). Ein Block je Ebene-1-Kapitel,
 * Masse = kontinuierlicher Zeichen-Span bis zum nächsten Ebene-1-Kapitel (inkl.
 * Unterabschnitte), Anteil = Masse / Gesamt. Rein/Node-testbar.
 *
 * Genutzt von der Abdeckungs-`SilhouetteAnsicht` (aspekt-angereichert).
 */
import type { VbSektion } from './gliederung';

export interface SilhouetteBlockKern {
  sektion: VbSektion;
  /** Zeichen-Masse (Span bis zum nächsten Ebene-1-Kapitel). */
  masse: number;
  /** Anteil an der Gesamtmasse (0…1). */
  anteil: number;
}

/**
 * Ebene-1-Blöcke (ohne `s-toc`, nur mit positiver Masse) in Dokumentreihenfolge, je mit
 * Masse + Anteil. `s-intro`/`Anlage …` bleiben enthalten — die Filterung/Bündelung ist
 * Sache der jeweiligen Ansicht (die Abdeckungs-Silhouette bündelt Anlagen).
 */
export function baueSilhouetteBloecke(gliederung: VbSektion[]): SilhouetteBlockKern[] {
  const docLen = gliederung.reduce((m, s) => Math.max(m, s.end), 0);
  const alleL1 = gliederung.filter(s => s.ebene === 1).sort((a, b) => a.start - b.start);
  const roh = alleL1
    .map((s, i) => ({ sektion: s, masse: (alleL1[i + 1]?.start ?? docLen) - s.start }))
    .filter(b => b.sektion.id !== 's-toc' && b.masse > 0);
  const gesamt = roh.reduce((sum, b) => sum + b.masse, 0) || 1;
  return roh.map(b => ({ sektion: b.sektion, masse: b.masse, anteil: b.masse / gesamt }));
}
