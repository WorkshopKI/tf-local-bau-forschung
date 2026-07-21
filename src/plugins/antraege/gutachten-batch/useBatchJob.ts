/**
 * Treibt die Batch-Generierung: lädt Registry + persönlichen Ordner, baut die
 * REALE `erzeugeAbschnitt`-Dep (dieselben Primitive wie der Einzellauf —
 * `runSkill` → `runRegelChecks` → `applyGeneration` → `putWorkflowRun`, KEIN
 * zweiter Prompt-Pfad — nur mit `quelle:'entwurf'` + batch-lokalem Disk-Spiegel),
 * fährt den `runBatch`-Runner und persistiert/resümiert den Job.
 *
 * Transport für die Generierung über die gegatete Wahl
 * `bridge.getTransportForSkillRun(skill)` (wie der Einzellauf — DSGVO-Transport-
 * Policy, Pitfall #30); reine Verfügbarkeitschecks über `bridge.pingActive()`.
 * Alle Aktionen self-catching (Pitfall #15).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { uuid } from '@/core/services/id-generator';
import { getAntrag, getVerbund, listAntraegeByVerbund } from '@/core/services/csv/idb-csv';
import type { Antrag } from '@/core/services/csv/types';
import {
  runSkill, loadSkillRegistry, runRegelChecks, loadSkillTweak, ZIM_EP_DEF, type WorkflowStep,
} from '@/core/services/skills';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import { kontextZielFuerLauf } from '@/core/services/ai/ki-ziel';
import {
  runBatch, berechneMengen, putBatchJob, getBatchJob, deleteBatchJob, spiegeleAbschnitt,
  type BatchDeps, type AbschnittErgebnis, type BatchJob, type BatchAbschnitte, type Mengen, type MengenKandidat,
} from '@/core/services/gutachten-batch';
import { buildKurzfassungContext } from '../kurzfassung/context-builder';
import { resolveVb } from '../kurzfassung/vbDokument';
import { isNetzwerkLead } from '../netzwerk';
import type { KurzfassungContext } from '../kurzfassung/types';
import { buildStammdaten, buildSkillMap, type SkillCtx } from '../gutachten/skill-context';
import { resolveActiveWorkflow } from '../gutachten/active-workflow';
import { buildVorherigeAbschnitte } from '../gutachten/context-provider';
import { getWorkflowRun, putWorkflowRun } from '../gutachten/workflow-store';
import { emptyRun, applyGeneration, type GenerationInput } from '../gutachten/runner';
import type { StepId } from '../gutachten/types';

const leadFirstCmp = (x: Antrag, y: Antrag): number => {
  const xL = isNetzwerkLead(x);
  const yL = isNetzwerkLead(y);
  if (xL !== yL) return xL ? -1 : 1;
  return x.aktenzeichen.localeCompare(y.aktenzeichen);
};

export interface StartTransport { verfuegbar: boolean; name: string; }
export interface StartInfo { mengen: Mengen; transport: StartTransport; }

export interface UseBatchJob {
  job: BatchJob | null;
  /** Beim Mount geladener fortsetzbarer Job (laeuft/pausiert)? */
  hatFortsetzbaren: boolean;
  error: string | null;
  ladeStartInfo: (fkzListe: string[], abschnitte: BatchAbschnitte) => Promise<StartInfo>;
  start: (eintraege: MengenKandidatLite[], abschnitte: BatchAbschnitte) => Promise<void>;
  pause: () => void;
  fortsetzen: () => void;
  abbrechenJob: () => void;
  verwerfen: () => Promise<void>;
}

/** Was `start()` braucht — kommt aus `Mengen.bereit`. */
export interface MengenKandidatLite { aktenzeichen: string; fkz: string; titel: string; }

export function useBatchJob(): UseBatchJob {
  const storage = useStorage();
  const bridge = useAIBridge();
  const [job, setJob] = useState<BatchJob | null>(null);
  const [hatFortsetzbaren, setHatFortsetzbaren] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skillMapRef = useRef<Map<StepId, SkillCtx>>(new Map());
  /** Geordnete Schritte der aktiven WorkflowDef (Fallback: Seed). */
  const stepsRef = useRef<WorkflowStep[]>(ZIM_EP_DEF.steps);
  const persHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** true = der nächste Abort ist eine PAUSE (nicht Abbruch). */
  const pauseRef = useRef(false);
  const idb = storage.idb;

  // Registry + persönlichen Ordner einmal laden; vorhandenen Job als fortsetzbar anbieten.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loaded, persHandle, vorhandenerJob] = await Promise.all([
        loadSkillRegistry(storage),
        getPersoenlichHandle(idb).catch(() => null),
        getBatchJob(idb),
      ]);
      if (cancelled) return;
      skillMapRef.current = buildSkillMap(loaded.file);
      stepsRef.current = resolveActiveWorkflow(loaded.file);
      persHandleRef.current = persHandle;
      if (vorhandenerJob && (vorhandenerJob.jobStatus === 'laeuft' || vorhandenerJob.jobStatus === 'pausiert')) {
        setJob(vorhandenerJob);
        setHatFortsetzbaren(true);
      }
    })();
    return () => { cancelled = true; };
  }, [idb, storage]);

  /** FKZ (Ordnername; TV-Az ODER Verbund-ID) → Kontext + Spiegel-FKZ. */
  const ladeContextFromFkz = useCallback(async (fkz: string): Promise<{ ctx: KurzfassungContext; mirrorFkz: string } | null> => {
    const antrag = await getAntrag(idb, fkz);
    if (antrag?.verbund_id) {
      const verbund = await getVerbund(idb, antrag.verbund_id);
      const tvs = (await listAntraegeByVerbund(idb, antrag.verbund_id)).sort(leadFirstCmp);
      return { ctx: buildKurzfassungContext(verbund, tvs, antrag.verbund_id, verbund?.verbund_id ?? antrag.verbund_id), mirrorFkz: fkz };
    }
    if (antrag) return { ctx: buildKurzfassungContext(null, [antrag], antrag.aktenzeichen), mirrorFkz: fkz };
    const verbund = await getVerbund(idb, fkz);
    if (verbund) {
      const tvs = (await listAntraegeByVerbund(idb, fkz)).sort(leadFirstCmp);
      return { ctx: buildKurzfassungContext(verbund, tvs, fkz, fkz), mirrorFkz: fkz };
    }
    return null;
  }, [idb]);

  /** Verbund-Key (= Eintrags-Aktenzeichen) → Kontext (Laufzeit-Auflösung). */
  const ladeContextByKey = useCallback(async (key: string): Promise<KurzfassungContext | null> => {
    const verbund = await getVerbund(idb, key);
    if (verbund) {
      const tvs = (await listAntraegeByVerbund(idb, key)).sort(leadFirstCmp);
      return buildKurzfassungContext(verbund, tvs, key, verbund.verbund_id);
    }
    const antrag = await getAntrag(idb, key);
    if (antrag) return buildKurzfassungContext(null, [antrag], key);
    return null;
  }, [idb]);

  const erzeugeAbschnitt = useCallback(async (
    { aktenzeichen, fkz, stepId, signal }: { aktenzeichen: string; fkz: string; stepId: StepId; signal: AbortSignal },
  ): Promise<AbschnittErgebnis> => {
    const ctx = await ladeContextByKey(aktenzeichen);
    if (!ctx) throw new Error(`Antrag ${aktenzeichen} nicht gefunden`);
    const sc = skillMapRef.current.get(stepId);
    if (!sc) throw new Error(`Kein Skill für Abschnitt ${stepId}`);
    const run = (await getWorkflowRun(idb, ctx.key)) ?? emptyRun(ctx.key, new Date().toISOString());
    const vorhanden = run.schritte[stepId]?.status;
    if (vorhanden === 'entwurf' || vorhanden === 'freigegeben') return { erzeugt: false, uebersprungen: true, hinweise: 0 };
    const vb = await resolveVb(idb, ctx);
    if (!vb) throw new Error(`Keine Vorhabensbeschreibung für ${ctx.key}`);

    const transport = bridge.getTransportForSkillRun(sc.skill);
    const persHandle = persHandleRef.current;
    const tweak = await loadSkillTweak(idb, persHandle, sc.skill.id).catch(() => null);
    const tweakWirksam = !!(tweak?.aktiv && (tweak.stilHinweise.trim() || tweak.beispielFormulierungen.trim()));
    const result = await runSkill(transport, sc.skill, sc.regeln, {
      stammdaten: buildStammdaten(ctx),
      vbMarkdown: vb.markdown,
      vbCharCap: getVbCharCap(kontextZielFuerLauf(bridge)),
      vorherigeAbschnitte: buildVorherigeAbschnitte(run, stepId, stepsRef.current, 2000, 'entwurf'),
      ...(tweakWirksam ? { tweak } : {}),
      signal,
    });
    const checks = runRegelChecks(result.parsed.finalerText, sc.regeln);
    const gen: GenerationInput = {
      quellenanalyse: result.parsed.quellenanalyse,
      entwurf: result.parsed.entwurf,
      finalerText: result.parsed.finalerText,
      checks,
      modell: transport.displayName ?? transport.name,
      skillId: sc.skill.id,
      skillVersion: sc.skill.version,
      vbGekuerzt: result.vbGekuerzt,
      ...(result.parsed.warnung ? { warnung: result.parsed.warnung } : {}),
      ...(tweakWirksam ? { mitTweak: true, tweakGeaendertAm: tweak!.geaendert_am } : {}),
    };
    const now = new Date().toISOString();
    await putWorkflowRun(idb, applyGeneration(run, stepId, gen, now));
    if (persHandle) await spiegeleAbschnitt(persHandle, fkz, stepId, result.parsed.finalerText, now).catch(() => {});
    return { erzeugt: true, uebersprungen: false, hinweise: checks.filter(c => c.level === 'hinweis').length };
  }, [idb, bridge, ladeContextByKey]);

  const treibe = useCallback(async (start: BatchJob): Promise<void> => {
    const ac = new AbortController();
    abortRef.current = ac;
    pauseRef.current = false;
    setHatFortsetzbaren(false);
    const deps: BatchDeps = {
      transportVerfuegbar: async () => { try { return await bridge.pingActive(); } catch { return false; } },
      erzeugeAbschnitt,
      order: stepsRef.current.map(s => s.id),
      persistJob: async j => { await putBatchJob(idb, j); },
      onUpdate: j => setJob(j),
      signal: ac.signal,
    };
    try {
      const end = await runBatch(start, deps);
      // Vom User pausiert: der Runner hat per Abbruch-Signal 'abgebrochen' gesetzt
      // (aktueller Eintrag bereits auf 'wartet' zurück) → in 'pausiert' umdeuten.
      if (pauseRef.current && end.jobStatus === 'abgebrochen') {
        const paused: BatchJob = { ...end, jobStatus: 'pausiert' };
        setJob(paused);
        await putBatchJob(idb, paused);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      pauseRef.current = false;
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, [idb, bridge, erzeugeAbschnitt]);

  const ladeStartInfo = useCallback(async (fkzListe: string[], abschnitte: BatchAbschnitte): Promise<StartInfo> => {
    const byKey = new Map<string, { ctx: KurzfassungContext; mirrorFkz: string }>();
    for (const fkz of fkzListe) {
      const res = await ladeContextFromFkz(fkz);
      if (res && !byKey.has(res.ctx.key)) byKey.set(res.ctx.key, res);
    }
    const order = stepsRef.current.map(s => s.id);
    const kandidaten: MengenKandidat[] = [];
    const staende: Record<string, Partial<Record<StepId, string>>> = {};
    for (const { ctx, mirrorFkz } of byKey.values()) {
      const vb = await resolveVb(idb, ctx);
      kandidaten.push({ aktenzeichen: ctx.key, fkz: mirrorFkz, titel: ctx.akronym, hatVb: vb !== null });
      const run = await getWorkflowRun(idb, ctx.key);
      if (run) {
        const s: Partial<Record<StepId, string>> = {};
        for (const id of order) { const st = run.schritte[id]?.status; if (st) s[id] = st; }
        staende[ctx.key] = s;
      }
    }
    const mengen = berechneMengen(kandidaten, abschnitte, staende, order);
    let verfuegbar = false;
    let name = '';
    try {
      name = bridge.getActiveProviderName();
      verfuegbar = await bridge.pingActive();
    } catch { verfuegbar = false; }
    return { mengen, transport: { verfuegbar, name } };
  }, [idb, bridge, ladeContextFromFkz]);

  const start = useCallback(async (eintraege: MengenKandidatLite[], abschnitte: BatchAbschnitte): Promise<void> => {
    setError(null);
    const neu: BatchJob = {
      id: uuid(),
      erstellt_am: new Date().toISOString(),
      abschnitte,
      eintraege: eintraege.map(e => ({ aktenzeichen: e.aktenzeichen, fkz: e.fkz, titel: e.titel, status: 'wartet' as const })),
      aktiverIndex: 0,
      jobStatus: 'laeuft',
      schemaVersion: 1,
    };
    setJob(neu);
    await putBatchJob(idb, neu);
    void treibe(neu);
  }, [idb, treibe]);

  const fortsetzen = useCallback((): void => {
    if (job && (job.jobStatus === 'pausiert' || job.jobStatus === 'laeuft')) void treibe(job);
  }, [job, treibe]);

  const pause = useCallback((): void => { pauseRef.current = true; abortRef.current?.abort(); }, []);
  const abbrechenJob = useCallback((): void => { pauseRef.current = false; abortRef.current?.abort(); }, []);

  const verwerfen = useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    try {
      await deleteBatchJob(idb);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setJob(null);
    setHatFortsetzbaren(false);
  }, [idb]);

  // Beim Unmount laufenden Runner abbrechen (Job bleibt in IDB → wieder fortsetzbar).
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { job, hatFortsetzbaren, error, ladeStartInfo, start, pause, fortsetzen, abbrechenJob, verwerfen };
}
