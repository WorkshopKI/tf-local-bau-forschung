/**
 * Reine Gegenüberstellung „Laut Antrag" ↔ „Extern (nicht verifiziert)" (Paket 5, Phase 3).
 *
 * Zuordnung AUSSCHLIESSLICH über die geteilte Kategorie — KEIN Fuzzy-Matching einzelner
 * Claims, KEINE automatische Widerspruchs-Wertung. Die App stellt nur gegenüber; der
 * Prüfer vergleicht selbst. `sdt`-Aussagen (Stand der Technik) erscheinen NICHT hier,
 * sondern im Recherche-Tab unter dem Import. UI-frei/Node-testbar.
 */
import { VERWERTUNG_KATEGORIEN, type VerwertungAussage, type VerwertungKategorie } from './verwertung';
import type { ExterneAussage, ExterneRecherche } from './types';

/** Eine externe Aussage mit ihrer Herkunft (Modell-Label + Import-Zeitpunkt) für die Anzeige. */
export interface ExterneAussageMitHerkunft extends ExterneAussage {
  modellLabel?: string;
  importiertAm: string;
}

export interface VergleichGruppe {
  kat: VerwertungKategorie;
  antrag: VerwertungAussage[];
  extern: ExterneAussageMitHerkunft[];
}

/**
 * Gruppiert Antrags- und externe Aussagen je Verwertungs-Kategorie (kanonische Reihenfolge).
 * Nur Kategorien mit mindestens einer Aussage (Antrag ODER extern) erscheinen. `sdt` wird
 * verworfen (kein Verwertungs-Vergleich).
 */
export function gruppiereVergleich(
  antragAussagen: VerwertungAussage[],
  externRecherchen: ExterneRecherche[] | undefined,
): VergleichGruppe[] {
  const externAlle: ExterneAussageMitHerkunft[] = [];
  for (const r of externRecherchen ?? []) {
    for (const a of r.aussagen) {
      if (a.kategorie === 'sdt') continue; // gehört in den Recherche-Tab
      externAlle.push({ ...a, modellLabel: r.modellLabel, importiertAm: r.importiertAm });
    }
  }

  const antragProKat = new Map<VerwertungKategorie, VerwertungAussage[]>();
  for (const a of antragAussagen) {
    (antragProKat.get(a.kategorie) ?? antragProKat.set(a.kategorie, []).get(a.kategorie)!).push(a);
  }
  const externProKat = new Map<VerwertungKategorie, ExterneAussageMitHerkunft[]>();
  for (const a of externAlle) {
    const kat = a.kategorie as VerwertungKategorie; // sdt bereits ausgefiltert
    (externProKat.get(kat) ?? externProKat.set(kat, []).get(kat)!).push(a);
  }

  return VERWERTUNG_KATEGORIEN
    .map(kat => ({ kat, antrag: antragProKat.get(kat) ?? [], extern: externProKat.get(kat) ?? [] }))
    .filter(g => g.antrag.length > 0 || g.extern.length > 0);
}

/** Gibt es überhaupt externe (nicht-sdt) Verwertungs-Aussagen? (für den Leer-Hinweis). */
export function hatExterneVerwertung(externRecherchen: ExterneRecherche[] | undefined): boolean {
  return (externRecherchen ?? []).some(r => r.aussagen.some(a => a.kategorie !== 'sdt'));
}
