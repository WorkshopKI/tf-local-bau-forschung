/**
 * State-/IO-Schicht der Aufbereitungs-Seite: lädt den (deterministischen) Run,
 * bietet „Neu aufbereiten" (via `useAsyncAction` → Fehlerbanner) und den
 * Offene-Punkte-Toggle, prüft best-effort auf veraltete Quellen, und orchestriert
 * die LLM-Bausteine (Paket 2) — sequentiell, tolerant, ohne den deterministischen
 * Teil je zu blockieren.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { hashText } from '@/plugins/antraege/gutachten/runner';
import {
  loadSkillRegistry,
  AUFBEREITUNG_ASPEKTE_SKILL, AUFBEREITUNG_ASPEKTE_SKILL_ID,
  AUFBEREITUNG_STECKBRIEF_SKILL, AUFBEREITUNG_STECKBRIEF_SKILL_ID,
  type SkillRecord,
} from '@/core/services/skills';
import { resolveVb, resolveAnlage5 } from './quellen';
import {
  aufbereitungKey, computeAufbereitung, loadAufbereitung, istVeraltet, toggleOffenerPunkt,
  type AufbereitungContext,
} from './store';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { ChatResetStatus } from '@/core/services/ai/chat-reset';
import { istAufbereitungBausteinFreigeschaltet, loescheBausteinCaches, type BausteinResult } from './bausteine';
import { computeAspekteBaustein, type AspektMapping } from './aspekte';
import { computeSteckbriefBaustein, type SteckbriefDaten } from './steckbrief';
import type { AufbereitungRun } from './types';

/** UI-Status eines Bausteins (Compute-Status + die Vor-Zustände `fehlt`/`laeuft`). */
export type BausteinUiStatus = 'fehlt' | 'laeuft' | 'ok' | 'degradiert' | 'fehler';

export interface BausteinUiState<T> {
  status: BausteinUiStatus;
  daten?: T;
  /** Roh-Antwort bei `degradiert` (einsehbar im UI). */
  rohtext?: string;
  /** Chat-Reset-Status des Laufs (Pitfall #36) — `'nicht-gefunden'`/`'timeout'` →
   *  Warn-Banner auf der Seite. Nur bei echtem Submit gesetzt (nicht bei Cache-Hit). */
  chatResetStatus?: ChatResetStatus;
  /** Anzahl automatischer Retries (nur bei Auffälligkeit gesetzt). */
  retryAnzahl?: number;
  /** Begründung der Degradation (z.B. „Modell hat keine Sektion zugeordnet"). */
  begruendung?: string;
}

export interface UseAufbereitungResult {
  run: AufbereitungRun | null;
  loading: boolean;
  veraltet: boolean;
  neu: UseAsyncActionResult<[]>;
  toggle: UseAsyncActionResult<[string]>;
  /** Aspekt-Mapping-Baustein (Paket 2). */
  aspekte: BausteinUiState<AspektMapping>;
  /** Steckbrief-Baustein (Paket 2). */
  steckbrief: BausteinUiState<SteckbriefDaten>;
  /** VB-Volltext (für Fundstellen-Auszüge) — gesetzt sobald ein Baustein-Lauf die VB auflöst. */
  vbMarkdown: string | null;
  /** Läuft alle Bausteine sequentiell (Aspekte → Steckbrief). */
  bausteine: UseAsyncActionResult<[]>;
  /** Verwirft die Baustein-Caches und rechnet neu (dev-Aktion „KI-Bausteine neu berechnen"). */
  bausteineNeu: UseAsyncActionResult<[]>;
}

const FEHLT: BausteinUiState<never> = { status: 'fehlt' };

export function useAufbereitung(ctx: AufbereitungContext | null): UseAufbereitungResult {
  const storage = useStorage();
  const bridge = useAIBridge();
  const [run, setRun] = useState<AufbereitungRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [veraltet, setVeraltet] = useState(false);
  const [aspekteSkill, setAspekteSkill] = useState<SkillRecord>(AUFBEREITUNG_ASPEKTE_SKILL);
  const [steckbriefSkill, setSteckbriefSkill] = useState<SkillRecord>(AUFBEREITUNG_STECKBRIEF_SKILL);
  const [aspekte, setAspekte] = useState<BausteinUiState<AspektMapping>>(FEHLT);
  const [steckbrief, setSteckbrief] = useState<BausteinUiState<SteckbriefDaten>>(FEHLT);
  const [vbMarkdown, setVbMarkdown] = useState<string | null>(null);
  const key = ctx?.key ?? null;

  // Gespeicherten Run laden (bei Kontext-Wechsel neu) — Baustein-Status zurücksetzen.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAspekte(FEHLT);
    setSteckbrief(FEHLT);
    setVbMarkdown(null);
    (async () => {
      if (!key) { setRun(null); setLoading(false); return; }
      const r = await loadAufbereitung(storage.idb, key);
      if (!cancelled) { setRun(r); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [key, storage.idb]);

  // Baustein-Skills aus der Registry laden (Fallback: Seeds).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadSkillRegistry(storage);
        const asp = loaded.file.skills.find(x => x.id === AUFBEREITUNG_ASPEKTE_SKILL_ID) ?? AUFBEREITUNG_ASPEKTE_SKILL;
        const stb = loaded.file.skills.find(x => x.id === AUFBEREITUNG_STECKBRIEF_SKILL_ID) ?? AUFBEREITUNG_STECKBRIEF_SKILL;
        if (!cancelled) { setAspekteSkill(asp); setSteckbriefSkill(stb); }
      } catch { /* Seed-Fallback bleibt gesetzt. */ }
    })();
    return () => { cancelled = true; };
  }, [storage]);

  // Best-effort Veraltet-Prüfung: aktuelle Quell-Hashes gegen die gestempelten.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ctx || !run) { setVeraltet(false); return; }
      try {
        const vbA = await resolveVb(storage.idb, ctx);
        const anlageA = await resolveAnlage5(storage.idb, ctx).catch(() => null);
        const aktuell = {
          vbHash: vbA ? hashText(vbA.markdown) : undefined,
          anlage5Hash: anlageA ? hashText(anlageA.markdown) : undefined,
        };
        if (!cancelled) setVeraltet(istVeraltet(run, aktuell));
      } catch { /* Veraltet-Hinweis ist optional — Fehler still schlucken. */ }
    })();
    return () => { cancelled = true; };
  }, [ctx, run, storage.idb]);

  const neu = useAsyncAction(async () => {
    if (!ctx) return;
    const r = await computeAufbereitung(storage.idb, ctx);
    setRun(r);
    setVeraltet(false);
    setAspekte(FEHLT);    // Neuer deterministischer Stand → Bausteine erneut anfordern.
    setSteckbrief(FEHLT);
  });

  /**
   * Fährt EINEN Baustein-Lauf, fängt ALLES intern und bildet es auf den
   * Baustein-Status ab (getTransportForSkillRun kann bei externem Provider werfen).
   * Der deterministische Teil bleibt unberührt; nie throw. Setzt zuvor `laeuft`.
   */
  const laufEinen = async <T>(
    skill: SkillRecord,
    set: (s: BausteinUiState<T>) => void,
    compute: (t: AITransport) => Promise<BausteinResult<T>>,
  ): Promise<void> => {
    if (!istAufbereitungBausteinFreigeschaltet(skill)) { set({ status: 'fehler' }); return; }
    set({ status: 'laeuft' });
    try {
      const t = bridge.getTransportForSkillRun(skill);
      const res = await compute(t);
      set({
        status: res.status, daten: res.daten, rohtext: res.rohtext, chatResetStatus: res.chatResetStatus,
        retryAnzahl: res.retryAnzahl, begruendung: res.begruendung,
      });
    } catch {
      set({ status: 'fehler' });
    }
  };

  /**
   * Fährt alle Bausteine SEQUENTIELL (Aspekte → Steckbrief) gegen einen vorhandenen
   * Run. Sequentiell, weil der interne Transport (Streamlit-Bridge) ein einzelnes
   * postMessage-Fenster ist. VB einmal auflösen.
   */
  const laufBausteine = async (aktRun: AufbereitungRun, aktCtx: AufbereitungContext, force: boolean): Promise<void> => {
    const vbA = await resolveVb(storage.idb, aktCtx).catch(() => null);
    if (!vbA) { setAspekte({ status: 'fehler' }); setSteckbrief({ status: 'fehler' }); return; }
    setVbMarkdown(vbA.markdown); // für Fundstellen-Auszüge im UI
    await laufEinen<AspektMapping>(aspekteSkill, setAspekte, t =>
      computeAspekteBaustein(storage.idb, t, aspekteSkill, aktCtx.key, aktRun.gliederung, vbA.markdown, { force }));
    await laufEinen<SteckbriefDaten>(steckbriefSkill, setSteckbrief, t =>
      computeSteckbriefBaustein(storage.idb, t, steckbriefSkill, aktCtx.key, aktRun.gliederung, vbA.markdown, { force }));
  };

  const bausteine = useAsyncAction(async () => {
    if (!ctx) return;
    // Sicherstellen, dass ein Run (mit Gliederung) existiert.
    const aktRun = run ?? await computeAufbereitung(storage.idb, ctx);
    if (!run) setRun(aktRun);
    await laufBausteine(aktRun, ctx, false);
  });

  const bausteineNeu = useAsyncAction(async () => {
    if (!ctx) return;
    const aktRun = run ?? await computeAufbereitung(storage.idb, ctx);
    if (!run) setRun(aktRun);
    await loescheBausteinCaches(storage.idb, ctx.key);
    await laufBausteine(aktRun, ctx, true);
  });

  const toggle = useAsyncAction(async (befund: string) => {
    if (!run) return;
    const next = toggleOffenerPunkt(run, befund);
    setRun(next);
    await storage.idb.set(aufbereitungKey(next.antragKey), next);
  });

  return { run, loading, veraltet, neu, toggle, aspekte, steckbrief, vbMarkdown, bausteine, bausteineNeu };
}
