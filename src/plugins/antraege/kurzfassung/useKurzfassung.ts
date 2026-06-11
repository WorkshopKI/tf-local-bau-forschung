/**
 * Orchestriert die Kurzfassung-Sektion: lädt VB-Status + persistierten Record,
 * prüft LLM-Verfügbarkeit, fährt Generierung/Modifier/Prüfung/Freigabe und
 * persistiert nach jedem Statuswechsel (nie während der Generierung).
 *
 * Alle Aktionen sind self-catching (Pitfall #15): Fehler landen im `error`-State
 * (→ Banner), nicht in einer verschluckten Promise-Rejection.
 */
import { useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { kurzfassungSkill, runSkill, type SkillModifierKey } from '@/core/services/skills';
import type { Antrag } from '@/core/services/csv/types';
import type { DocumentFull } from '@/plugins/dokumente/store';
import { resolveAntragFkz } from '@/core/components/dokumentAufnahmeFkz';
import { findVorhabensbeschreibung } from './vbDokument';
import { getKurzfassung, putKurzfassung, deleteKurzfassung } from './kurzfassung-store';
import type { KurzfassungRecord } from './types';

export interface KurzfassungController {
  record: KurzfassungRecord | null;
  vbDokument: DocumentFull | null;
  vbVorhanden: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  /** null = noch nicht geprüft. */
  llmAvailable: boolean | null;
  generate: () => void;
  modify: (modifier: SkillModifierKey) => void;
  pruefen: () => void;
  freigeben: () => void;
  verwerfen: () => void;
  refreshVb: () => void;
  stop: () => void;
  clearError: () => void;
}

function buildStammdaten(antrag: Antrag): string {
  const nn = '[Im Antrag nicht genannt]';
  return [
    `- Förderkennzeichen: ${antrag.aktenzeichen}`,
    `- Titel: ${antrag.titel ?? nn}`,
    `- Akronym: ${antrag.akronym ?? nn}`,
    `- Antragsteller: ${antrag.antragsteller ?? nn}`,
  ].join('\n');
}

export function useKurzfassung(antrag: Antrag): KurzfassungController {
  const storage = useStorage();
  const bridge = useAIBridge();
  const az = antrag.aktenzeichen;
  const fkz = resolveAntragFkz(az) ?? az;

  const [record, setRecord] = useState<KurzfassungRecord | null>(null);
  const [vbDokument, setVbDokument] = useState<DocumentFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [rec, vb] = await Promise.all([
        getKurzfassung(storage.idb, az),
        findVorhabensbeschreibung(storage.idb, fkz),
      ]);
      if (cancelled) return;
      setRecord(rec);
      setVbDokument(vb);
      setLoading(false);
      // LLM-Probe nur, wenn Generierung relevant ist (VB da, noch nicht freigegeben).
      // DirectLLM.ping = billiger /v1/models-Fetch; aktive Streamlit-Bridge würde
      // ihr Fenster öffnen (Edge-Case, in den llama.cpp-Konfigs irrelevant).
      if (vb && (!rec || rec.status !== 'freigegeben')) {
        try { if (!cancelled) setLlmAvailable(await bridge.getActiveTransport().ping()); }
        catch { if (!cancelled) setLlmAvailable(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [az, fkz, storage.idb, bridge]);

  const runGeneration = async (modifier?: SkillModifierKey): Promise<void> => {
    if (!vbDokument || busy) return;
    setBusy(true);
    setError(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const transport = bridge.getActiveTransport();
      const ok = await transport.ping();
      setLlmAvailable(ok);
      if (!ok) {
        setError('KI nicht erreichbar — Generierung derzeit nicht möglich.');
        return;
      }
      const result = await runSkill(transport, kurzfassungSkill, {
        stammdaten: buildStammdaten(antrag),
        vbMarkdown: vbDokument.markdown,
        ...(modifier ? { modifier } : {}),
        ...(modifier && record ? { vorherigerText: record.finalerText } : {}),
        signal: abort.signal,
      });
      const rec: KurzfassungRecord = {
        aktenzeichen: az,
        quellenanalyse: result.parsed.quellenanalyse,
        entwurf: result.parsed.entwurf,
        finalerText: result.parsed.finalerText,
        checks: kurzfassungSkill.runChecks(result.parsed.finalerText),
        status: 'entwurf',
        erstellt_am: new Date().toISOString(),
        modell: transport.name,
        vbGekuerzt: result.vbGekuerzt,
        ...(result.parsed.warnung ? { warnung: result.parsed.warnung } : {}),
      };
      setRecord(rec);
      await putKurzfassung(storage.idb, rec); // Persist NACH der Generierung
    } catch (err) {
      if (abort.signal.aborted) return; // bewusster Stop ist kein Fehler
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const pruefen = async (): Promise<void> => {
    if (!record) return;
    try {
      const rec: KurzfassungRecord = { ...record, checks: kurzfassungSkill.runChecks(record.finalerText) };
      setRecord(rec);
      await putKurzfassung(storage.idb, rec);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const freigeben = async (): Promise<void> => {
    if (!record) return;
    try {
      const rec: KurzfassungRecord = { ...record, status: 'freigegeben', freigegeben_am: new Date().toISOString() };
      setRecord(rec);
      await putKurzfassung(storage.idb, rec);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const verwerfen = async (): Promise<void> => {
    try {
      setRecord(null);
      await deleteKurzfassung(storage.idb, az);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const refreshVb = async (): Promise<void> => {
    const vb = await findVorhabensbeschreibung(storage.idb, fkz);
    setVbDokument(vb);
    if (vb && llmAvailable === null) {
      try { setLlmAvailable(await bridge.getActiveTransport().ping()); }
      catch { setLlmAvailable(false); }
    }
  };

  return {
    record,
    vbDokument,
    vbVorhanden: vbDokument !== null,
    loading,
    busy,
    error,
    llmAvailable,
    generate: () => { void runGeneration(); },
    modify: (m) => { void runGeneration(m); },
    pruefen: () => { void pruefen(); },
    freigeben: () => { void freigeben(); },
    verwerfen: () => { void verwerfen(); },
    refreshVb: () => { void refreshVb(); },
    stop: () => abortRef.current?.abort(),
    clearError: () => setError(null),
  };
}
