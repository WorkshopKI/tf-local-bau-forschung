/**
 * Eckdaten-Zeile des Verbund-Kopfes (Journey-Paket 2 Phase 6) — reine Ableitung.
 *
 * Kompakte Fakten-Liste unter der Beschreibung: Programm/Typ · TV-Anzahl ·
 * Antragsdatum · beantragte Kosten. Fehlende Werte werden AUSGELASSEN (kein „—"),
 * damit der Kopf schlank bleibt. Nutzt dieselben Primitive wie `glanceFacts`
 * (`sumBeantragteKosten`, `verbundAntragsdatum`, `getVbPhaseLabel`).
 */
import type { Antrag } from '@/core/services/csv/types';
import { getVbPhaseLabel } from '@/core/utils/vb-phase-mappings';
import { verbundAntragsdatum } from '@/core/services/csv/frist';
import { sumBeantragteKosten } from './alleFelder/glanceFacts';
import { formatDateish } from './alleFelder/format';

export interface KopfEckdatenInput {
  tvs: Antrag[];
  /** Bereits aufgelöstes Unterprogramm-Label (Caller liefert es via Hook). */
  unterprogramm: string | null;
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return v == null ? null : String(v);
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/** Beträge kompakt in Tausend-Euro: `812.000` → `812 T€`, `< 1000` → `n €`. */
export function formatEuroKompakt(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000).toLocaleString('de-DE')} T€`;
  return `${n.toLocaleString('de-DE')} €`;
}

/**
 * Baut die Eckdaten-Segmente. Jedes Segment ist ein fertiger String; leere
 * Werte fehlen ganz (kein Platzhalter „—").
 */
export function buildKopfEckdaten({ tvs, unterprogramm }: KopfEckdatenInput): string[] {
  const lead = tvs[0];
  const out: string[] = [];

  // Programm/Typ: VB-Phase-Label · Unterprogramm-Label
  const phaseLabel = lead ? str(getVbPhaseLabel(lead.vb_phase)) : null;
  const programmTyp = [phaseLabel, str(unterprogramm)].filter(Boolean).join(' · ');
  if (programmTyp) out.push(programmTyp);

  // Teilvorhaben-Anzahl
  if (tvs.length > 0) out.push(`${tvs.length} Teilvorhaben`);

  // Antragsdatum (Verbund = spätestes TV-Antragsdatum)
  const antragsdatum = formatDateish(verbundAntragsdatum(tvs));
  if (antragsdatum) out.push(`Antragsdatum ${antragsdatum}`);

  // Beantragte Kosten (Summe über alle TVs), kompakt in T€
  const kosten = sumBeantragteKosten(tvs);
  if (kosten !== null) out.push(`Beantragt ${formatEuroKompakt(kosten)}`);

  return out;
}
