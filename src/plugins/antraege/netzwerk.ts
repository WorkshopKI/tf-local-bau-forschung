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

function trimmedString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/**
 * Liefert den fachlichen Netzwerk-Namen aus dem `akronym`-Feld (CSV-Spalte
 * `VB_KURZNAM`) des Netzwerk-Lead-Antrags. Bei einem Netzwerk-Antrag (Suffix
 * `01`/`02` + vb_phase 1/2) ist der Akronym-Wert gleichzeitig der Name des
 * Netzwerks, zu dem alle Anträge mit derselben 4-Ziffer-ID gehören.
 *
 * Wenn beide Phasen-Leads im Snapshot sind und unterschiedliche Akronyme
 * tragen, gewinnt der Phase-1-Lead (er repräsentiert den ursprünglichen
 * Netzwerk-Namen). Wenn kein Lead im Snapshot ist, return `null` —
 * Caller fällt auf `"Netzwerk <id>"` zurück.
 */
export function getNetzwerkName(members: AntragListItem[]): string | null {
  const leads = members.filter(isNetzwerkLead);
  if (leads.length === 0) return null;
  // Phase-1-Lead bevorzugt; falls nicht vorhanden, Phase-2-Lead.
  const phase1Lead = leads.find(l => toVbPhaseNumber(l.vb_phase) === 1);
  const chosen = phase1Lead ?? leads[0]!;
  return trimmedString(chosen.akronym);
}

/**
 * Baut einen Cross-Programm-Index: `netzwerkId (4 Ziffern) → Netzwerk-Name`,
 * der aus *allen* Netzwerk-Lead-Anträgen über alle Programme hinweg gebildet
 * wird. Wird gebraucht, weil die Netzwerk-Leads (Programme 136 / 76 / 46)
 * typischerweise NICHT im selben Programm liegen wie die TVs (16KN-Anträge
 * in anderen Programmen). Im aktiven RAM-Snapshot der Liste fehlt der Lead
 * daher meist, und der lokale `getNetzwerkName(members)` würde `null`
 * liefern — der Index schließt diese Lücke.
 *
 * Phase-1-Lead schlägt Phase-2-Lead bei abweichenden Akronymen.
 */
export function buildNetzwerkNameIndex(items: AntragListItem[]): Map<string, string> {
  const phase1 = new Map<string, string>();
  const phase2 = new Map<string, string>();
  for (const item of items) {
    if (!isNetzwerkLead(item)) continue;
    const nid = extractNetzwerkId(item.aktenzeichen);
    if (nid === null) continue;
    const name = trimmedString(item.akronym);
    if (name === null) continue;
    const phase = toVbPhaseNumber(item.vb_phase);
    if (phase === 1) phase1.set(nid, name);
    else if (phase === 2) phase2.set(nid, name);
  }
  const out = new Map<string, string>();
  // Phase-2 zuerst eintragen, dann mit Phase-1 überschreiben.
  for (const [k, v] of phase2) out.set(k, v);
  for (const [k, v] of phase1) out.set(k, v);
  return out;
}

/**
 * Wählt den finalen Netzwerk-Namen: Index-Wert hat Vorrang, danach
 * der lokale Member-Scan, danach `null` (Caller-Fallback zu
 * `"Netzwerk <id>"`).
 */
export function resolveNetzwerkName(
  netzwerkId: string,
  members: AntragListItem[],
  index?: Map<string, string> | null,
): string | null {
  const fromIndex = index?.get(netzwerkId);
  if (fromIndex) return fromIndex;
  return getNetzwerkName(members);
}

/**
 * Formatiert das Gruppen-Label. Wenn ein Netzwerk-Name aus dem Lead bekannt
 * ist, wird er als Präfix verwendet; ansonsten der technische Fallback
 * `"Netzwerk <id>"`. Phasen werden angehängt: `"INNOWERK · Phase 1 + 2"`.
 */
export function formatNetzwerkLabel(
  netzwerkId: string,
  phases: Set<number>,
  name: string | null,
): string {
  const head = name ?? `Netzwerk ${netzwerkId}`;
  const known = [...phases].filter(p => p === 1 || p === 2).sort();
  if (known.length === 0) return head;
  if (known.length === 1) return `${head} · Phase ${known[0]}`;
  return `${head} · Phase ${known.join(' + ')}`;
}
