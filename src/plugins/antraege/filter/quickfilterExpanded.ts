/**
 * Persistenz + Reducer für die **offenen Quickfilter-Pillen** der
 * Förderanträge-Liste.
 *
 * Die Toolbar zeigt mehrere Filter-Pillen (Status / Antragstyp / Projektart /
 * PreCheck / Sortiert-nach) in EINER Zeile. Bis v3.12 war es ein Akkordeon:
 * höchstens EINE Pille offen, strukturell garantiert durch einen Einzelwert.
 * Das war eine Einschränkung ohne Nutzen — wer nach Antragstyp UND Projektart
 * eingrenzt, will beide Leisten sehen, gerade weil die Zahlen der einen von der
 * Auswahl der anderen abhängen. Der Zustand ist deshalb eine **Menge**.
 *
 * Persistenz pro View (`teamflow_antraege_quickfilter_expanded_{viewId}`) als
 * kommagetrennte Liste; ein alter Einzelwert liest sich als einelementige Menge,
 * ein bestehender Stand geht also nicht verloren. Reines Modul (kein
 * React/Store-Import) → testbar.
 */

/** Die aufklappbaren Segmente der Quickfilter-Zeile. */
export type QuickfilterSegId = 'status' | 'antragstyp' | 'projektart' | 'precheck' | 'sort';

/** Reihenfolge = Anzeige-Reihenfolge in der Toolbar; sie bestimmt auch, wie der
 *  persistierte String sortiert wird. */
const SEG_ORDER: readonly QuickfilterSegId[] = [
  'status',
  'antragstyp',
  'projektart',
  'precheck',
  'sort',
];

const VALID_SEGS: ReadonlySet<QuickfilterSegId> = new Set<QuickfilterSegId>(SEG_ORDER);

/** Erstnutzung: Status-Segment offen (Design-Vorgabe). */
export const DEFAULT_EXPANDED_SEG: QuickfilterSegId = 'status';

/** Erstnutzung als Menge. */
export const DEFAULT_EXPANDED_SEGS: ReadonlySet<QuickfilterSegId> = new Set([DEFAULT_EXPANDED_SEG]);

const KEY_PREFIX = 'teamflow_antraege_quickfilter_expanded_';

/** Sentinel im Storage für „alle Segmente zugeklappt" (bewusst vom User). */
const NONE_SENTINEL = '';

function storageKey(viewId: string): string {
  return `${KEY_PREFIX}${viewId}`;
}

function isSeg(v: unknown): v is QuickfilterSegId {
  return typeof v === 'string' && VALID_SEGS.has(v as QuickfilterSegId);
}

/**
 * Liest die offenen Segmente einer View.
 * - Schlüssel fehlt (Erstnutzung) → `DEFAULT_EXPANDED_SEGS` (`{status}`).
 * - Schlüssel = `''` (User hat alles zugeklappt) → leere Menge.
 * - Kommaliste → deren gültige Einträge (unbekannte werden still verworfen,
 *   nicht auf den Default zurückgeworfen: eine umbenannte Seg-Id soll nicht die
 *   übrige Auswahl mitreißen).
 * - Nur ungültige Einträge / kaputt → Default.
 */
export function loadExpandedSegs(viewId: string): Set<QuickfilterSegId> {
  try {
    const raw = localStorage.getItem(storageKey(viewId));
    if (raw === null) return new Set(DEFAULT_EXPANDED_SEGS);
    if (raw === NONE_SENTINEL) return new Set();
    const segs = raw.split(',').map(s => s.trim()).filter(isSeg);
    return segs.length > 0 ? new Set(segs) : new Set(DEFAULT_EXPANDED_SEGS);
  } catch {
    return new Set(DEFAULT_EXPANDED_SEGS);
  }
}

/** Persistiert die offenen Segmente (leere Menge = alles zu). Geschrieben wird
 *  in `VALID_SEGS`-Reihenfolge, damit derselbe Zustand denselben String ergibt. */
export function saveExpandedSegs(viewId: string, segs: ReadonlySet<QuickfilterSegId>): void {
  try {
    const geordnet = SEG_ORDER.filter(s => segs.has(s));
    localStorage.setItem(storageKey(viewId), geordnet.join(','));
  } catch {
    /* ignore */
  }
}

/**
 * Klick auf ein Segment: auf/zu, ohne die anderen anzufassen.
 * Gibt eine NEUE Menge zurück (React-State darf nicht mutiert werden).
 */
export function toggleExpandedSeg(
  current: ReadonlySet<QuickfilterSegId>,
  clicked: QuickfilterSegId,
): Set<QuickfilterSegId> {
  const next = new Set(current);
  if (!next.delete(clicked)) next.add(clicked);
  return next;
}
