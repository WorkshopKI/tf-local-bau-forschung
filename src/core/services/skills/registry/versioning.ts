/**
 * Versions-Historie eines Skills (additiv, bounded) + reiner Diff.
 *
 * Modell: `SkillRecord.historie` ist newest-first und enthält stets einen
 * Snapshot des AKTUELLEN Standes als Kopf (Invariante `historie[0]` ≙ Record).
 * Jeder Edit/Rollback stellt einen frischen Snapshot des neuen Standes voran und
 * kappt auf `MAX_HISTORIE`. So bleibt die Historie schlank und ein Rollback kann
 * jeden Nicht-Kopf-Eintrag als NEUE Version zurückholen (kein In-Place-Reset).
 *
 * Bewusst rein (keine IO, keine `Date.now`-Seiteneffekte) → memoisierbar im UI
 * und vollständig unit-testbar.
 */
import type { SkillModifierKey, SkillRecord, SkillVersionSnapshot } from './types';

/** Obergrenze der inline gehaltenen Versions-Historie (Pitfall: nicht unbeschränkt). */
export const MAX_HISTORIE = 10;

const MOD_KEYS: readonly SkillModifierKey[] = ['neu', 'kuerzer', 'laenger'];

/** Minimaler Stand, den ein Diff vergleicht (Record ODER Snapshot erfüllen es). */
type VersionLike = Pick<SkillRecord, 'promptTemplate' | 'regelIds' | 'modifiers'>;

function snapshotOf(rec: SkillRecord, opts: { userId?: string; begruendung?: string }): SkillVersionSnapshot {
  const snap: SkillVersionSnapshot = {
    version: rec.version,
    promptTemplate: rec.promptTemplate,
    regelIds: [...rec.regelIds],
    modifiers: { ...rec.modifiers },
    geaendert_am: rec.geaendert_am,
  };
  const uid = opts.userId?.trim();
  if (uid) snap.userId = uid;
  const grund = opts.begruendung?.trim();
  if (grund) snap.begruendung = grund;
  return snap;
}

/**
 * Stellt einen Snapshot des übergebenen (neuen) Standes der Historie voran und
 * kappt auf `MAX_HISTORIE`. `rec.historie` ist die Historie VOR diesem Stand und
 * wird als Tail übernommen. `userId`/`begruendung` beschreiben die Änderung, die
 * zu diesem Stand geführt hat.
 */
export function appendHistorie(
  rec: SkillRecord,
  opts: { userId?: string; begruendung?: string } = {},
): SkillVersionSnapshot[] {
  const tail = rec.historie ?? [];
  return [snapshotOf(rec, opts), ...tail].slice(0, MAX_HISTORIE);
}

/* -------------------------------------------------------------------------- */
/* Diff (Template-Zeilen + Regel-Mengen + Modifier-Keys)                       */
/* -------------------------------------------------------------------------- */

export type DiffZeilenTyp = 'gleich' | 'hinzu' | 'weg';
export interface DiffZeile {
  typ: DiffZeilenTyp;
  text: string;
}

export interface SkillVersionsDiff {
  /** Zeilen-Diff des Prompt-Templates (LCS-basiert). */
  template: DiffZeile[];
  /** Mengen-Diff der zugeordneten Regel-IDs. */
  regeln: { hinzu: string[]; weg: string[] };
  /** Modifier-Keys, deren Text sich geändert hat. */
  modifiers: SkillModifierKey[];
  /** True, wenn keinerlei Unterschied besteht. */
  unveraendert: boolean;
}

/** Zeilen-Diff via LCS (alt → neu). Stabil, ohne Heuristik-Rauschen. */
function diffLines(altText: string, neuText: string): DiffZeile[] {
  const a = altText.split('\n');
  const b = neuText.split('\n');
  const m = a.length;
  const n = b.length;
  // dp[i][j] = LCS-Länge von a[i..] und b[j..]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffZeile[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ typ: 'gleich', text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ typ: 'weg', text: a[i]! });
      i++;
    } else {
      out.push({ typ: 'hinzu', text: b[j]! });
      j++;
    }
  }
  while (i < m) {
    out.push({ typ: 'weg', text: a[i]! });
    i++;
  }
  while (j < n) {
    out.push({ typ: 'hinzu', text: b[j]! });
    j++;
  }
  return out;
}

/** Reiner Diff zweier Skill-Stände (alt → neu): Template, Regeln, Modifikatoren. */
export function diffSkillVersions(alt: VersionLike, neu: VersionLike): SkillVersionsDiff {
  const template = diffLines(alt.promptTemplate, neu.promptTemplate);
  const hinzu = neu.regelIds.filter(id => !alt.regelIds.includes(id));
  const weg = alt.regelIds.filter(id => !neu.regelIds.includes(id));
  const modifiers = MOD_KEYS.filter(k => alt.modifiers[k] !== neu.modifiers[k]);
  const unveraendert =
    template.every(z => z.typ === 'gleich') && hinzu.length === 0 && weg.length === 0 && modifiers.length === 0;
  return { template, regeln: { hinzu, weg }, modifiers, unveraendert };
}
