/**
 * Reiner Selektor des QS-Freigaben-Widgets (Phase 3 v1.1), node-testbar.
 *
 * Aus den lokal gelesenen Artefakt-Workflow-Runs die Abschnitte mit
 * `status === 'entwurf'` (generiert, aber NICHT freigegeben) → Zeilen. Der IDB-
 * Bulk-Read (`idb.entries`) + der Anträge-Join passieren im Widget; hier nur die
 * reine Transformation + Sortierung.
 *
 * „Offene Regeln" = fehlgeschlagene mechanische `CheckResult` je Abschnitt
 * (`level !== 'ok'`), NICHT die beratenden `qsHinweise`. Pflichtfreigabe ist eine
 * Anzeige-Konvention (ABL/RNE) — real existieren heute nur GA/NF-Runs, die Rampe
 * wird erst mit ABL/RNE-Artefakten sichtbar. Das Widget gibt NIE frei (Invariante).
 */
import type { WorkflowRun } from '@/plugins/antraege/gutachten/types';

/** Ein lokal gelesener Run inkl. aus dem Key geparstem Artefakt-Typ + Scope. */
export interface QsRunEintrag {
  typ: string;
  scopeId: string;
  run: WorkflowRun;
}

/** Join-Ergebnis für einen Scope (Aktenzeichen/Verbund-ID) + Sichtbarkeit. */
export interface QsScopeInfo {
  akronym?: string;
  titel?: string;
  /** true, wenn der Scope dem Bearbeiter-Filter genügt (Filter inaktiv → immer true). */
  sichtbar: boolean;
}

export interface QsFreigabeZeile {
  key: string;
  typ: string;
  typBadge: string;
  scopeId: string;
  /** Akronym (bevorzugt) → Titel → scopeId. */
  titel: string;
  /** Artefakt-Label (bei GA zusätzlich „· Abschnitt X"). */
  untertitel: string;
  alterTage: number | null;
  offeneRegeln: number;
  regelnGruen: boolean;
  pflichtfreigabe: boolean;
}

/** Anzeige-Konvention (ABL/RNE = strikt) — im Code existiert kein strict/standard-
 *  Split; ABL/RNE sind Platzhalter, die Rampe greift erst mit echten Artefakten. */
const PFLICHTFREIGABE_TYPEN = new Set(['abl', 'rne']);

const ARTEFAKT_LABEL: Record<string, string> = {
  ga: 'Gutachten',
  nf: 'Nachforderung',
  abl: 'Ablehnungsbescheid',
  rne: 'Rücknahmeempfehlung',
  precheck: 'PreCheck',
};

function alterVon(iso: string | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000));
}

/**
 * Baut die Zeilen: je Run die Entwurf-Schritte, gejoint + bearbeiter-gefiltert
 * über `scopeInfo`, sortiert (Pflichtfreigabe zuerst, dann Alter absteigend).
 */
export function baueQsFreigabenZeilen(
  runs: QsRunEintrag[],
  scopeInfo: (scopeId: string) => QsScopeInfo,
  nowMs: number,
): QsFreigabeZeile[] {
  const zeilen: QsFreigabeZeile[] = [];
  for (const { typ, scopeId, run } of runs) {
    const info = scopeInfo(scopeId);
    if (!info.sichtbar) continue;
    const label = ARTEFAKT_LABEL[typ] ?? typ.toUpperCase();
    const titel = info.akronym?.trim() || info.titel?.trim() || scopeId;
    for (const [stepId, step] of Object.entries(run.schritte)) {
      if (!step || step.status !== 'entwurf') continue;
      const offeneRegeln = step.checks.filter(c => c.level !== 'ok').length;
      zeilen.push({
        key: `${typ}:${scopeId}:${stepId}`,
        typ,
        typBadge: typ.toUpperCase(),
        scopeId,
        titel,
        untertitel: typ === 'ga' ? `${label} · Abschnitt ${stepId}` : label,
        alterTage: alterVon(step.erstellt_am ?? run.geaendert_am, nowMs),
        offeneRegeln,
        regelnGruen: offeneRegeln === 0,
        pflichtfreigabe: PFLICHTFREIGABE_TYPEN.has(typ),
      });
    }
  }
  zeilen.sort((a, b) => {
    if (a.pflichtfreigabe !== b.pflichtfreigabe) return a.pflichtfreigabe ? -1 : 1;
    return (b.alterTage ?? -1) - (a.alterTage ?? -1);
  });
  return zeilen;
}

/** Zähler je Artefakt-Typ (Reihenfolge des ersten Auftretens) — für die Pills. */
export function zaehleProTyp(zeilen: QsFreigabeZeile[]): Array<{ typ: string; badge: string; count: number }> {
  const m = new Map<string, number>();
  for (const z of zeilen) m.set(z.typ, (m.get(z.typ) ?? 0) + 1);
  return [...m.entries()].map(([typ, count]) => ({ typ, badge: typ.toUpperCase(), count }));
}
