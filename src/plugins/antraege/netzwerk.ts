/**
 * Netzwerk-Erkennung für 16KN-Förderanträge.
 *
 * Domain-Regel: FKZ-Präfix `16KN` markiert einen Antrag als Teil eines
 * Netzwerks. Die ersten 4 Ziffern nach dem Präfix identifizieren das
 * Netzwerk; die letzten 2 Ziffern sind die Position innerhalb des Netzwerks
 * (`01`/`02` = Lead in Phase 1/2, höhere Suffixe = Teilvorhaben).
 *
 * Beispiele:
 *   16KN106201 → Netzwerk 1062, Lead Phase 1 (vb_phase=1)
 *   16KN106202 → Netzwerk 1062, Lead Phase 2 (vb_phase=2)
 *   16KN106227 → Netzwerk 1062, TV
 *   16EP123456 → kein Netzwerk (Einzelantrag)
 *
 * Bewusst eigenständige, minimale Parse-Logik (statt Import aus
 * `src/phase2/matcher/fkz-extractor`), weil das Antrags-Plugin nicht an
 * den Phase-2-Pipeline-Code gekoppelt sein soll — `aktenzeichen` ist hier
 * bereits kanonisch (keine tolerante OCR-Tolerierung nötig).
 */
import type { AntragListItem } from '@/core/services/csv/types';
import { toVbPhaseNumber } from '@/core/utils/vb-phase-mappings';

/** Regex für ein kanonisches 16KN-FKZ. */
const KN_FKZ_PATTERN = /^16KN(\d{4})(\d{2})$/;

/**
 * Liefert die 4-stellige Netzwerk-ID (z. B. `"1062"`) für ein 16KN-FKZ,
 * sonst `null`.
 */
export function extractNetzwerkId(aktenzeichen: string): string | null {
  if (typeof aktenzeichen !== 'string') return null;
  const m = KN_FKZ_PATTERN.exec(aktenzeichen.trim());
  return m ? m[1]! : null;
}

/**
 * Liefert das 2-stellige Suffix nach den 4 Netzwerk-Ziffern (z. B. `"01"`,
 * `"27"`), oder `null` für nicht-16KN-FKZs.
 */
export function extractNetzwerkSuffix(aktenzeichen: string): string | null {
  if (typeof aktenzeichen !== 'string') return null;
  const m = KN_FKZ_PATTERN.exec(aktenzeichen.trim());
  return m ? m[2]! : null;
}

/**
 * `true` wenn der Antrag der Netzwerk-Lead ist — FKZ endet auf `01`/`02`
 * und vb_phase ist `1` oder `2`. Die Programm-Bedingung (136/76/46) wird
 * nicht hart geprüft, weil der Programm-ID-Namespace produktiv frei
 * vergeben wird; das Tupel `vb_phase + Suffix` ist programmübergreifend
 * robust.
 */
export function isNetzwerkLead(item: Pick<AntragListItem, 'aktenzeichen' | 'vb_phase'>): boolean {
  const suffix = extractNetzwerkSuffix(item.aktenzeichen);
  if (suffix !== '01' && suffix !== '02') return false;
  const phase = toVbPhaseNumber(item.vb_phase);
  return phase === 1 || phase === 2;
}

/**
 * Sortier-Schlüssel für die TV-Reihenfolge innerhalb einer Netzwerk-Gruppe:
 * Leads zuerst (Suffix `01` vor `02`), dann alle anderen nach Aktenzeichen
 * aufsteigend.
 */
export function compareNetzwerkOrder(a: AntragListItem, b: AntragListItem): number {
  const aLead = isNetzwerkLead(a);
  const bLead = isNetzwerkLead(b);
  if (aLead !== bLead) return aLead ? -1 : 1;
  return a.aktenzeichen.localeCompare(b.aktenzeichen);
}

/**
 * Formatiert das Gruppen-Label `"Netzwerk 1062"`. Wenn mehrere Phasen
 * vertreten sind, wird der Phase-Hinweis angehängt: `"Netzwerk 1062 · Phase 1 + 2"`.
 */
export function formatNetzwerkLabel(netzwerkId: string, phases: Set<number>): string {
  const known = [...phases].filter(p => p === 1 || p === 2).sort();
  if (known.length === 0) return `Netzwerk ${netzwerkId}`;
  if (known.length === 1) return `Netzwerk ${netzwerkId} · Phase ${known[0]}`;
  return `Netzwerk ${netzwerkId} · Phase ${known.join(' + ')}`;
}

/**
 * Sammelt alle vb_phase-Werte (1/2) aus einer TV-Liste.
 */
export function collectPhases(tvs: AntragListItem[]): Set<number> {
  const out = new Set<number>();
  for (const tv of tvs) {
    const p = toVbPhaseNumber(tv.vb_phase);
    if (p === 1 || p === 2) out.add(p);
  }
  return out;
}
