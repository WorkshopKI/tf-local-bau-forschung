/**
 * Reiner Filter/Sort der Baustein-Liste im Verwaltungs-Tab. UI-frei + testbar.
 */
import type { BausteinArtefaktTyp, BausteinStatus, TextbausteinRecord } from '@/core/services/skills';

export interface BausteinFilter {
  typ: BausteinArtefaktTyp | 'alle';
  status: BausteinStatus | 'alle';
  /** Prüfaspekt-ID (A–J) oder `'alle'`. */
  aspekt: string | 'alle';
  /** Freitext über ID, Thema, Stichworte, Text. */
  suche: string;
}

export const LEERER_FILTER: BausteinFilter = { typ: 'alle', status: 'alle', aspekt: 'alle', suche: '' };

function passtSuche(b: TextbausteinRecord, suche: string): boolean {
  const q = suche.trim().toLowerCase();
  if (!q) return true;
  return [b.id, b.thema, b.kategorie, b.text, ...b.stichworte]
    .some(s => s.toLowerCase().includes(q));
}

/**
 * Filtert + sortiert die Bausteine. Sortierung: Typ (NF→RNE→ABL), dann ID
 * natürlich (`G1.2` vor `G1.10`), damit die Liste stabil und lesbar bleibt.
 */
export function filterBausteine(
  bausteine: readonly TextbausteinRecord[], filter: BausteinFilter,
): TextbausteinRecord[] {
  const TYP_RANG: Record<BausteinArtefaktTyp, number> = { nf: 0, rne: 1, abl: 2 };
  return bausteine
    .filter(b =>
      (filter.typ === 'alle' || b.artefaktTyp === filter.typ)
      && (filter.status === 'alle' || b.status === filter.status)
      && (filter.aspekt === 'alle' || b.aspekte.includes(filter.aspekt))
      && passtSuche(b, filter.suche))
    .sort((a, b) =>
      TYP_RANG[a.artefaktTyp] - TYP_RANG[b.artefaktTyp]
      || a.id.localeCompare(b.id, 'de', { numeric: true }));
}

/** Zählt Bausteine je Status (für die Filter-Kopfzeile). */
export function zaehleStatus(bausteine: readonly TextbausteinRecord[]): Record<BausteinStatus, number> {
  const z: Record<BausteinStatus, number> = { entwurf: 0, freigegeben: 0, stillgelegt: 0 };
  for (const b of bausteine) z[b.status]++;
  return z;
}
