/**
 * Reine Selektoren über einer geladenen Registry — kein IO, kein React.
 * Genutzt von der Skill-Verwaltung (UI), dem Antragsdetail-Consumer und Tests.
 */
import {
  KNOWN_REGEL_TYPEN, type ArtefaktTyp, type PersoenlicheVorgaben, type Pruefart,
  type QualitaetsRegel, type SkillRecord, type SkillRegistryFile, type WorkflowDef,
  type WorkflowEbene,
} from './types';
import { vorgabenZuRegeln, wendeOverrideAn } from './vorgaben';
import { SEED_WORKFLOWS } from './seed';
import { GA_QS_REGEL_IDS } from './ga-qs.seed';

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
 * Die EINE Auflösung Skill → Regelliste. Zwei Quellen, in dieser Reihenfolge:
 *  1. die skill-eigenen Vorgaben (Umfang & Form), materialisiert als synthetische
 *     Regeln (`vorgaben.ts`),
 *  2. die zugeordneten Bibliotheks-Regeln (Reihenfolge der `regelIds`, fehlende
 *     IDs werden ausgelassen).
 *
 * Die Reihenfolge ist Prompt-Text (sie bestimmt die Zeilenfolge im Block
 * „Formale Vorgaben") und bewusst so gewählt: vor der Umstellung standen die
 * Umfangs-Regeln in den Seed-Skills überwiegend vorn.
 *
 * `opts.vorgabenOverride` legt den persönlichen Override über die freigegebenen
 * Vorgaben — damit prüfen Prompt UND Check gegen denselben Wert.
 */
export function resolveRegeln(
  file: SkillRegistryFile,
  skill: SkillRecord,
  opts?: { vorgabenOverride?: PersoenlicheVorgaben },
): QualitaetsRegel[] {
  const byId = new Map(file.regeln.map(r => [r.id, r]));
  const vorgaben = wendeOverrideAn(skill.vorgaben, opts?.vorgabenOverride);
  return [
    ...vorgabenZuRegeln(skill.id, vorgaben, skill.geaendert_am),
    ...skill.regelIds.map(id => byId.get(id)).filter((r): r is QualitaetsRegel => r !== undefined),
  ];
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
    case 'nf_keine_platzhalter_reste':
      return 'keine Platzhalter-Reste';
    case 'nf_baustein_passung':
      return 'Baustein-Passung (LLM-QS)';
    case 'ga_qs_vollstaendigkeit':
      return 'Vollständigkeit A–G';
    case 'ga_qs_quellenabgleich':
      return 'Quellenabgleich (LLM-QS)';
    case 'ga_qs_konsistenz':
      return 'Konsistenz (LLM-QS)';
    case 'ga_qs_finales_review':
      return 'Finales Review';
    default:
      return 'unbekannter Typ';
  }
}

/**
 * QS-Regelsatz eines Artefakt-Typs (Artefakt-Engine): die Regeln, die über die
 * Skills der `WorkflowDef` dieses Typs gebunden sind. So wählt die QS den richtigen
 * Satz je `artefaktTyp` (NF-Regeln für `'nf'`, GA-Regeln für `'ga'`) — die Bindung
 * läuft über den Workflow, nicht über verstreute Literale. Fehlt eine kuratierte
 * Def, greift der Seed-Workflow als Fallback.
 */
export function qsRegelnFuerArtefakt(file: SkillRegistryFile, typ: ArtefaktTyp): QualitaetsRegel[] {
  // GA: dedizierter QS-Dimensionssatz aus QS v2 (gebunden per ID, nicht über die
  // generativen Skill-Regeln — die bleiben Generierungs-Vorgaben).
  if (typ === 'ga') return file.regeln.filter(r => GA_QS_REGEL_IDS.has(r.id));
  // Sonst (NF …): die QS-Regeln sind die `regelIds` der Skills des Artefakt-Workflows.
  const wf = workflowFuerArtefakt(file, typ);
  if (!wf) return [];
  const skillIds = new Set(wf.steps.map(s => s.skillId));
  const regelIds = new Set(file.skills.filter(s => skillIds.has(s.id)).flatMap(s => s.regelIds));
  return file.regeln.filter(r => regelIds.has(r.id));
}

/**
 * Die Workflow-Definition eines Artefakt-Typs. Fehlt eine kuratierte Def, greift der
 * Seed-Workflow — dieselbe Auflösung, die `qsRegelnFuerArtefakt` schon nutzte; sie
 * stand dort inline und wird jetzt geteilt (eine Heimat).
 */
export function workflowFuerArtefakt(file: SkillRegistryFile, typ: ArtefaktTyp): WorkflowDef | undefined {
  const workflows = file.workflows && file.workflows.length > 0 ? file.workflows : SEED_WORKFLOWS;
  return workflows.find(w => artefaktTypOf(w) === typ);
}

/* -------------------------------------------------------------------------- */
/* Prüfer eines Artefakts (fachlich / administrativ / sprachlich)              */
/* -------------------------------------------------------------------------- */

/**
 * Die Prüfer eines Artefakt-Typs, in Lauf-Reihenfolge — aufgelöst aus
 * `WorkflowDef.pruefer` (Skill-IDs) gegen die Skill-Liste.
 *
 * **Zwei Tore, beide hier und nicht beim Aufrufer:**
 *  - `aktiv === false` fliegt raus (Kurator-Kill-Switch, Muster `ga-lektor`) —
 *    damit ein noch nicht abgenommener Prüfer nicht bei jedem Abschnitt einen
 *    KI-Lauf kostet;
 *  - eine ID ohne Skill fliegt still raus (verwaiste Referenz nach einem Löschen).
 *
 * Fehlt `pruefer` ganz → `[]` ⇒ die Kette verhält sich exakt wie vor v6.27.
 */
export function prueferFuerArtefakt(file: SkillRegistryFile, typ: ArtefaktTyp): SkillRecord[] {
  const ids = workflowFuerArtefakt(file, typ)?.pruefer ?? [];
  if (ids.length === 0) return [];
  const byId = new Map(file.skills.map(s => [s.id, s]));
  return ids
    .map(id => byId.get(id))
    .filter((s): s is SkillRecord => s !== undefined && s.aktiv !== false);
}

/** Der Prüfer einer bestimmten Art (der erste, falls mehrere) oder `undefined`. */
export function prueferMitArt(
  file: SkillRegistryFile, typ: ArtefaktTyp, art: Pruefart,
): SkillRecord | undefined {
  return prueferFuerArtefakt(file, typ).find(s => s.pruefart === art);
}

/**
 * Die Kriterien, die für EINEN Abschnitt gelten — als flache Satz-Liste, wie sie
 * `buildQsKriterienBlock` erwartet.
 *
 * Rangfolge: **die engere Angabe schlägt die weitere.** Trägt der Abschnitts-Skill
 * eigene `qsKriterien`, gelten nur sie; sonst der Katalog des Prüfers, zugeschnitten
 * über `giltFuer` (fehlt/leer = gilt überall). So bleibt der seit v2.336 vorhandene
 * Weg gültig, ohne dass beide Quellen sich vermischen — eine Mischung wäre für einen
 * Kurator nicht mehr vorhersagbar.
 *
 * `aktiv === false` fällt weg; die Reihenfolge des Katalogs bleibt erhalten (sie ist
 * Prompt-Text, wie bei den Vorgaben).
 */
export function pruefItemsFuer(
  pruefer: SkillRecord | undefined,
  stepId: string,
  abschnittsSkill?: SkillRecord,
): string[] {
  const eigene = abschnittsSkill?.qsKriterien?.map(k => k.trim()).filter(Boolean) ?? [];
  if (eigene.length > 0) return eigene;
  return (pruefer?.pruefkatalog ?? [])
    .filter(i => i.aktiv !== false)
    .filter(i => !i.giltFuer || i.giltFuer.length === 0 || i.giltFuer.includes(stepId))
    .map(i => i.kriterium);
}
