/**
 * Reine Selektoren über einer geladenen Registry — kein IO, kein React.
 * Genutzt von der Skill-Verwaltung (UI), dem Antragsdetail-Consumer und Tests.
 */
import {
  KNOWN_REGEL_TYPEN, type ArtefaktTyp, type Pruefart, type QualitaetsRegel, type SkillRecord,
  type SkillRegistryFile, type WorkflowDef, type WorkflowEbene,
} from './types';
import { SEED_WORKFLOWS } from './seed';

/* -------------------------------------------------------------------------- */
/* Artefakt-Engine: Default-Resolver (eine Quelle für die dokumentierten        */
/* Defaults — Normalisierung lässt die Felder bei Alt-Records bewusst weg).     */
/* -------------------------------------------------------------------------- */

/** Artefakt-Typ einer Workflow-Def (fehlt → `'ga'`, GA byte-identisch). */
export function artefaktTypOf(def: WorkflowDef): ArtefaktTyp {
  return def.artefaktTyp ?? 'ga';
}
/** Ebene einer Workflow-Def (fehlt → `'verbund'`). */
export function ebeneOf(def: WorkflowDef): WorkflowEbene {
  return def.ebene ?? 'verbund';
}
/** Prüfart einer Qualitätsregel (fehlt → `'textlich'`, deterministisch). */
export function pruefartOf(regel: QualitaetsRegel): Pruefart {
  return regel.pruefart ?? 'textlich';
}

/** Skill per ID (oder `undefined`). */
export function getSkillById(file: SkillRegistryFile, id: string): SkillRecord | undefined {
  return file.skills.find(s => s.id === id);
}

/** Eine Fundstelle eines Skills in einem Workflow („verwendet in"). */
export interface SkillWorkflowFundstelle {
  workflowId: string;
  stepId: string;
  /** Anzeige-Nummer des Schritts (`"A"`, `"5a"`). */
  nr: string;
  label: string;
}

/**
 * Alle Workflow-Schritte, die einen bestimmten Skill verwenden („verwendet in",
 * Spiegel zu `skillsUsingRegel`). Liest `file.workflows`; ist dort (noch) keine
 * Definition kuratiert, greift der Seed-Workflow als Fallback (P1-weiche
 * Abhängigkeit). Rein — kein IO, kein React.
 */
export function workflowStepsUsingSkill(file: SkillRegistryFile, skillId: string): SkillWorkflowFundstelle[] {
  const workflows = file.workflows && file.workflows.length > 0 ? file.workflows : SEED_WORKFLOWS;
  const treffer: SkillWorkflowFundstelle[] = [];
  for (const wf of workflows) {
    for (const step of wf.steps) {
      if (step.skillId === skillId) {
        treffer.push({ workflowId: wf.id, stepId: step.id, nr: step.nr, label: step.label });
      }
    }
  }
  return treffer;
}

/**
 * Löst die einem Skill zugeordneten Regel-IDs auf konkrete Regeln auf
 * (Reihenfolge der `regelIds`, fehlende IDs werden ausgelassen).
 */
export function resolveRegeln(file: SkillRegistryFile, skill: SkillRecord): QualitaetsRegel[] {
  const byId = new Map(file.regeln.map(r => [r.id, r]));
  return skill.regelIds.map(id => byId.get(id)).filter((r): r is QualitaetsRegel => r !== undefined);
}

/** Namen aller Skills, die eine bestimmte Regel verwenden („verwendet in"). */
export function skillsUsingRegel(file: SkillRegistryFile, regelId: string): string[] {
  return file.skills.filter(s => s.regelIds.includes(regelId)).map(s => s.name);
}

/** True, wenn der Regel-Typ der Engine bekannt ist (sonst „unbekannter Typ"). */
export function isKnownRegelTyp(typ: string): boolean {
  return KNOWN_REGEL_TYPEN.has(typ);
}

function num(params: Record<string, unknown>, key: string): number | undefined {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function str(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  return typeof v === 'string' ? v : '';
}

/** Kurzform der Regel-Parameter für Listen/Tabellen (z.B. „max 1000 Zeichen"). */
export function describeRegelParams(regel: QualitaetsRegel): string {
  const p = regel.params;
  switch (regel.typ) {
    case 'zeichen_max':
      return `max ${num(p, 'max') ?? '—'} Zeichen`;
    case 'wortanzahl': {
      const min = num(p, 'min');
      const max = num(p, 'max');
      if (min !== undefined && max !== undefined) return `${min}–${max} Wörter`;
      if (min !== undefined) return `≥ ${min} Wörter`;
      if (max !== undefined) return `≤ ${max} Wörter`;
      return 'Wortanzahl';
    }
    case 'satzanzahl':
      return `${num(p, 'min') ?? '—'}–${num(p, 'max') ?? '—'} Sätze`;
    case 'satzlaenge_max':
      return `max ${num(p, 'maxWoerter') ?? '—'} Wörter / Satz`;
    case 'verbotenes_muster': {
      const muster = Array.isArray(p.muster) ? (p.muster as unknown[]).filter(x => typeof x === 'string') : [];
      if (muster.length === 0) return 'kein Muster';
      return muster.length === 1 ? `Muster: „${muster[0] as string}"` : `${muster.length} Muster`;
    }
    case 'pflicht_anfang': {
      const t = str(p, 'text');
      return t ? `Anfang: „${t.slice(0, 32)}${t.length > 32 ? '…' : ''}"` : 'Pflicht-Anfang';
    }
    case 'keine_aufzaehlungen':
      return 'im finalen Text';
    case 'absatz_min':
      return `≥ ${num(p, 'min') ?? '—'} Absätze`;
    default:
      return 'unbekannter Typ';
  }
}
