/**
 * Dev-only In-App-Eval des Assistent-Gedächtnisses (Phase 2): fährt die 5 FIKTIVEN
 * Gedächtnis-Fixtures über die interne Bridge durch die reale Konsolidierungs-
 * Pipeline (`laufeFixture` → Assertions → interner Judge) und legt die Zahlen als
 * kopierbaren Report + JSONL-Download ab.
 *
 * Ort: Einstellungen → KI-Panel, gegated `isDevFixturesEnabled()` (der Parent
 * rendert uns nur dann). Schwester des `AufbereitungEvalPanel` — dieselbe UX. Nur
 * MESSEN: das Panel schreibt NICHT in den `assistent_gedaechtnis`-Store und braucht
 * das `assistentGedaechtnis`-Flag nicht (es fährt Fixtures über die Eval-Lib).
 *
 * Transport: intern über `bridge.getTransportForAssistent()` (DSGVO intern-only,
 * Vordergrund-Lease, wirft bei externem Provider → Banner, kein Lauf; Guard #30).
 * Default `agentisch` (Qwen-Tab). Der `openrouter`-Modus ist nur in dev sichtbar
 * (`isOpenRouterEnabled()`) und zulässig, weil die Fixtures FIKTIV sind
 * (`fiktiv: true`-Provenienz-Guard vor jedem externen Call). Generator UND Judge
 * laufen im selben Modus; Läufe strikt sequentiell (ein postMessage-Fenster).
 */
import { useEffect, useRef, useState } from 'react';
import { FlaskConical, ChevronDown, ChevronRight, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/StatusBadge';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';
import {
  JUDGE_IDB_KEY, JUDGE_DEFAULTS, type EvalJudgeConfig,
} from '@/core/services/skill-eval/eval-batch';
import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import { isOpenRouterEnabled } from '@/config/feature-flags';
import type { AITransport, BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { GEDAECHTNIS_FIXTURES } from '@/core/services/skill-eval/gedaechtnis-fixtures';
import {
  laufeGedaechtnisEval,
  type FixtureAggregat, type GedaechtnisEvalErgebnis,
} from '@/core/services/skill-eval/gedaechtnis-eval-runner';
import { SettingsSectionHeader } from './_shared/settings-primitives';

type VerlaufStatus = 'pending' | 'running' | 'ok' | 'degradiert' | 'fehler';

/** Generierungs-/Judge-Transport: intern (Standard-Chat gpt-oss), intern-agentisch
 *  (Qwen-Tab) oder OpenRouter (extern — nur fiktive Fixtures, dev-only). */
type TransportModus = 'intern' | 'agentisch' | 'openrouter';

/** n-Obergrenze je Fixture (Varianz-Messung ohne den Bridge-Durchlauf zu sprengen). */
const WIEDERHOLUNGEN_MAX = 5;

interface VerlaufZeile {
  id: string;
  status: VerlaufStatus;
  kurz?: string;
}

const DOT_FARBE: Record<VerlaufStatus, string> = {
  pending: 'var(--tf-text-tertiary)',
  running: 'var(--tf-warning-text)',
  ok: 'var(--tf-success-text)',
  degradiert: 'var(--tf-warning-text)',
  fehler: 'var(--tf-danger-text)',
};

function statusVon(a: FixtureAggregat): VerlaufStatus {
  if (a.okLaeufe === a.n) return 'ok';
  if (a.okLaeufe === 0) return 'fehler';
  return 'degradiert';
}

function kurzVon(a: FixtureAggregat): string {
  const teile = [`Assertions ${a.okLaeufe}/${a.n}`];
  if (a.judgeF != null) {
    teile.push(`Judge F${a.judgeF.toFixed(2)} N${(a.judgeN ?? 0).toFixed(2)}${a.judgeFehler ? ` (${a.judgeFehler} Parse-Fehler)` : ''}`);
  } else if (a.judgeFehler) {
    teile.push(`Judge: ${a.judgeFehler} Parse-Fehler`);
  }
  if (a.beispielVerletzung?.length) teile.push(a.beispielVerletzung.join(', '));
  return teile.join(' · ');
}

/** Menschenlesbares Ziel-Tab-Etikett für den Report-Kopf. */
function zielLabel(ziel?: BridgeZiel): string {
  return ziel === 'agentisch' ? 'agentisch (Qwen, 260k)' : 'Standard-Chat (gpt-oss)';
}

interface ReportMeta {
  zeitpunkt: string;
  transportName: string;
  ziel?: BridgeZiel;
  modell?: string;
  n: number;
}

/** Formt das Aggregat zu einem kopierbaren Markdown-Block (ohne App-Kontext lesbar). */
function formatGedaechtnisReport(erg: GedaechtnisEvalErgebnis, meta: ReportMeta): string {
  const kopf = [
    '# Assistent-Gedächtnis — Eval (In-App, interne Bridge)',
    '',
    `- Datum: ${meta.zeitpunkt}`,
    meta.modell != null
      ? `- Transport: ${meta.transportName} · ${meta.modell} (extern, fiktive Fixtures)`
      : `- Transport: ${meta.transportName} · ${zielLabel(meta.ziel)}`,
    `- Wiederholungen je Fixture: ${meta.n}`,
    `- Fixtures: ${erg.aggregate.length}`,
    ...(erg.abgebrochen ? ['- ⚠ Lauf abgebrochen (Teilergebnis)'] : []),
    '',
    '## Ergebnisse',
  ];
  const koerper = erg.aggregate.flatMap(a => {
    const zeilen = [`### ${a.id} (${a.szenario})`, `- Assertions: ${a.okLaeufe}/${a.n} ok`];
    if (a.judgeF != null) {
      zeilen.push(`- Judge: F=${a.judgeF.toFixed(2)} N=${(a.judgeN ?? 0).toFixed(2)}${a.judgeFehler ? ` (${a.judgeFehler} Parse-Fehler ausgenommen)` : ''}`);
    } else if (a.judgeFehler) {
      zeilen.push(`- Judge: nur Parse-Fehler (${a.judgeFehler})`);
    }
    if (a.okLaeufe < a.n) zeilen.push(`- Verletzungen: ${a.beispielVerletzung?.join(', ') ?? 'unbekannt'}`);
    return [...zeilen, ''];
  });
  const gate = [
    '## Gate',
    `- Deterministische Assertions: ${erg.alleAssertionsOk ? 'BESTANDEN (100 %)' : 'FEHLGESCHLAGEN'}`,
  ];
  return [...kopf, ...koerper, ...gate].join('\n').trimEnd() + '\n';
}

/** Rohtext-Block eines auffälligen Fixture-Laufs (Assertion-Verletzung). */
interface RohBefund { key: string; titel: string; text: string }

function rohBefunde(erg: GedaechtnisEvalErgebnis | null): RohBefund[] {
  if (!erg) return [];
  const out: RohBefund[] = [];
  for (const a of erg.aggregate) {
    if (a.okLaeufe === a.n) continue;
    const raw = erg.rawProFixture[a.id];
    if (!raw || raw.length === 0) continue;
    // Erster fehlgeschlagener Lauf ist nicht separat markiert — der letzte Lauf
    // reicht als Diagnose (alle Zyklen-Rohantworten, getrennt).
    const letzter = raw[raw.length - 1] ?? [];
    out.push({
      key: `${a.id}:roh`,
      titel: `${a.id} · ${a.szenario} (Assertions ${a.okLaeufe}/${a.n})`,
      text: letzter.join('\n\n───\n\n'),
    });
  }
  return out;
}

/** Einklappbarer Rohtext-Block mit Kopier-Knopf. */
function RohtextKarte({ titel, text }: { titel: string; text: string }): React.ReactElement {
  const kopieren = useAsyncAction(async () => { await navigator.clipboard.writeText(text); });
  return (
    <details className="rounded-[var(--tf-radius)] border border-[var(--tf-border)]">
      <summary className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer select-none">
        <span className="truncate">{titel}</span>
        <button
          type="button"
          onClick={e => { e.preventDefault(); kopieren.run(); }}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--tf-primary)] hover:underline shrink-0"
        >
          <Copy size={11} /> {kopieren.error ? 'Fehler' : 'Rohtext kopieren'}
        </button>
      </summary>
      <pre className="text-[10.5px] leading-[1.5] font-mono whitespace-pre-wrap text-[var(--tf-text)] max-h-[30vh] overflow-y-auto px-2.5 py-2 border-t border-[var(--tf-border)]">
        {text}
      </pre>
    </details>
  );
}

export function GedaechtnisEvalPanel(): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();
  const bridgeStatus = useBridgeStatus(s => s.status);
  const verbunden = bridgeStatus === 'connected';

  const [wiederholungen, setWiederholungen] = useState(3);
  // Fixture-Auswahl: Degradation (20 Zyklen) ist der teure Lauf → Default AUS,
  // damit die schnelle Baseline (4 Ein-Zyklus-Fixtures) in Minuten durchläuft.
  const [ausgewaehlt, setAusgewaehlt] = useState<Record<string, boolean>>(
    () => Object.fromEntries(GEDAECHTNIS_FIXTURES.map(f => [f.id, f.id !== 'degradation-1'])),
  );
  // Default agentisch (Qwen) — der interne Zweit-LLM-Tab für die Baseline.
  const [transportModus, setTransportModus] = useState<TransportModus>('agentisch');
  const openRouterVerfuegbar = isOpenRouterEnabled();
  const [orConfig, setOrConfig] = useState<EvalJudgeConfig>(JUDGE_DEFAULTS);
  const [orOpen, setOrOpen] = useState(false);
  const [verlauf, setVerlauf] = useState<VerlaufZeile[]>([]);
  const [ergebnis, setErgebnis] = useState<GedaechtnisEvalErgebnis | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Gespeicherte OpenRouter-Config laden (dev-eval-eigener Key, geteilt mit dem Skill-Eval-Judge).
  useEffect(() => {
    if (!openRouterVerfuegbar) return;
    let cancelled = false;
    void (async () => {
      const saved = await storage.idb.get<EvalJudgeConfig>(JUDGE_IDB_KEY);
      if (!cancelled && saved) setOrConfig({ ...JUDGE_DEFAULTS, ...saved });
    })();
    return () => { cancelled = true; };
  }, [storage.idb, openRouterVerfuegbar]);

  const transportBereit = transportModus === 'openrouter' ? orConfig.apiKey.trim() !== '' : verbunden;
  const gewaehlteFixtures = GEDAECHTNIS_FIXTURES.filter(f => ausgewaehlt[f.id]);

  const start = useAsyncAction(async () => {
    let transport: AITransport;
    let ziel: BridgeZiel | undefined;
    let modell: string | undefined;
    if (transportModus === 'openrouter') {
      // Externer Pfad NUR für fiktive Fixtures — Provenienz-Guard VOR dem Transport-Bau.
      if (!GEDAECHTNIS_FIXTURES.every(f => f.fiktiv === true)) {
        throw new Error('Provenienz-Guard: nicht alle Fixtures sind fiktiv.');
      }
      if (!isOpenRouterEnabled()) {
        throw new Error('OpenRouter ist in dieser Build-Variante deaktiviert.');
      }
      await storage.idb.set(JUDGE_IDB_KEY, orConfig);
      transport = new DirectLLMTransport(orConfig.endpoint, orConfig.model, orConfig.apiKey);
      modell = orConfig.model;
    } else {
      // DSGVO intern-only (Guard #30): wirft bei externem Provider → Banner, kein Lauf.
      transport = bridge.getTransportForAssistent();
      ziel = transportModus === 'agentisch' ? 'agentisch' : undefined;
    }

    const n = Math.max(1, Math.min(wiederholungen, WIEDERHOLUNGEN_MAX));
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setReport(null);
    setErgebnis(null);
    setVerlauf(gewaehlteFixtures.map(f => ({ id: f.id, status: 'pending' as const })));
    try {
      const erg = await laufeGedaechtnisEval(
        { n, transport, judgeTransport: transport, ziel, reset: true, signal: ctrl.signal, fixtures: gewaehlteFixtures },
        {
          onFixtureStart: (id) =>
            setVerlauf(v => v.map(x => (x.id === id ? { ...x, status: 'running' } : x))),
          onFixtureDone: (a) =>
            setVerlauf(v => v.map(x => (x.id === a.id
              ? { ...x, status: statusVon(a), kurz: kurzVon(a) }
              : x))),
        },
      );
      setErgebnis(erg);
      setReport(formatGedaechtnisReport(erg, {
        zeitpunkt: new Date().toLocaleString('de-DE'),
        transportName: transport.displayName ?? transport.name,
        ziel,
        modell,
        n,
      }));
    } finally {
      abortRef.current = null;
    }
  });

  const kopieren = useAsyncAction(async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
  });

  const herunterladen = useAsyncAction(async () => {
    if (!ergebnis) return;
    const inhalt = ergebnis.zeilen.map(z => JSON.stringify(z)).join('\n') + '\n';
    const blob = new Blob([inhalt], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gedaechtnis-eval.jsonl';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  return (
    <div className="rounded-[var(--tf-radius)] border border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-[12px] text-[var(--tf-text-secondary)] cursor-pointer text-left"
      >
        <ChevronRight
          size={13}
          className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <FlaskConical size={13} className="shrink-0" /> Eval öffnen (fiktive Fixtures · nur Messung)
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 space-y-3">
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              Fährt die 5 fiktiven Gedächtnis-Fixtures (Kaltstart, Fortschreibung, Widerspruch,
              Poisoning, Degradation) sequentiell durch die reale Konsolidierungs-Pipeline und
              prüft die deterministischen Assertions (hartes Gate) plus einen internen LLM-Judge
              (Faktentreue/Nützlichkeit). Es wird nur gemessen — keine Assistenz-Funktion wird
              scharfgeschaltet, nichts wird gespeichert.
            </p>

            {/* Transport-Bereitschaft (intern: Bridge verbunden · OpenRouter: Key vorhanden) */}
            {transportModus === 'openrouter' ? (
              <div className="flex items-center gap-2 text-[11.5px]">
                <StatusDot color={transportBereit ? 'var(--tf-success-text)' : 'var(--tf-warning-text)'} />
                <span className="text-[var(--tf-text-secondary)]">
                  {transportBereit
                    ? 'OpenRouter (extern) — es verlassen ausschließlich fiktive Fixtures die App.'
                    : 'OpenRouter: kein API-Key — unten in der Konfiguration eintragen.'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11.5px]">
                <StatusDot color={verbunden ? 'var(--tf-success-text)' : 'var(--tf-warning-text)'} />
                <span className="text-[var(--tf-text-secondary)]">
                  {verbunden
                    ? 'Interne KI verbunden'
                    : 'Interne KI nicht verbunden — im Abschnitt „Interne KI" verbinden.'}
                </span>
              </div>
            )}

            {/* Steuerung */}
            <div className="flex items-center gap-4 flex-wrap">
              <label
                className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]"
                title="Jede Fixture n× fahren (Varianz-Messung)."
              >
                Wiederholungen
                <input
                  type="number"
                  min={1}
                  max={WIEDERHOLUNGEN_MAX}
                  value={wiederholungen}
                  onChange={e => setWiederholungen(Math.max(1, Math.min(parseInt(e.target.value, 10) || 1, WIEDERHOLUNGEN_MAX)))}
                  className="w-16 px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                />
                <span className="text-[var(--tf-text-tertiary)]">/ {WIEDERHOLUNGEN_MAX}</span>
              </label>
              <label
                className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]"
                title="Transport: Intern = Standard-Chat (gpt-oss) · Intern agentisch = Qwen-Tab (Tab muss offen + Lesezeichen aktiv sein) · OpenRouter = externes Referenz-Modell (nur fiktive Fixtures, dev-only). Generator und Judge laufen im selben Modus."
              >
                Transport
                <select
                  value={transportModus}
                  onChange={e => setTransportModus(e.target.value as TransportModus)}
                  disabled={start.busy}
                  className="px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                >
                  <option value="intern">Intern (gpt-oss)</option>
                  <option value="agentisch">Intern agentisch (Qwen)</option>
                  {openRouterVerfuegbar && <option value="openrouter">OpenRouter (extern)</option>}
                </select>
              </label>
            </div>

            {/* Fixture-Auswahl — Degradation (20 Zyklen) ist der langsame Lauf, Default aus. */}
            <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap text-[12px] text-[var(--tf-text-secondary)]">
              <span className="text-[var(--tf-text-tertiary)]">Fixtures</span>
              {GEDAECHTNIS_FIXTURES.map(f => (
                <label key={f.id} className="flex items-center gap-1.5 cursor-pointer" title={f.beschreibung}>
                  <input
                    type="checkbox"
                    checked={!!ausgewaehlt[f.id]}
                    disabled={start.busy}
                    onChange={e => setAusgewaehlt(a => ({ ...a, [f.id]: e.target.checked }))}
                    className="accent-[var(--tf-primary)]"
                  />
                  {f.szenario}
                  {f.zyklen.length > 1 && (
                    <span className="text-[var(--tf-text-tertiary)]">({f.zyklen.length}×)</span>
                  )}
                </label>
              ))}
            </div>

            {/* OpenRouter-Konfiguration (geteilter dev-eval-Key) */}
            {transportModus === 'openrouter' && (
              <div className="rounded-[var(--tf-radius)] border border-[var(--tf-border)]">
                <button
                  type="button"
                  onClick={() => setOrOpen(o => !o)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
                >
                  {orOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  OpenRouter-Konfiguration
                  <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)] truncate">{orConfig.model}</span>
                  {orConfig.apiKey.trim() === '' && (
                    <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] shrink-0">kein Key</span>
                  )}
                </button>
                {orOpen && (
                  <div className="px-3 pb-3 flex flex-col gap-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--tf-text-tertiary)]">Endpoint</span>
                      <input
                        value={orConfig.endpoint}
                        onChange={e => setOrConfig(c => ({ ...c, endpoint: e.target.value }))}
                        className="text-[12.5px] px-2.5 py-1.5 rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)]"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--tf-text-tertiary)]">Modell</span>
                      <input
                        value={orConfig.model}
                        onChange={e => setOrConfig(c => ({ ...c, model: e.target.value }))}
                        className="text-[12.5px] px-2.5 py-1.5 rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)]"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[var(--tf-text-tertiary)]">API-Key (OpenRouter)</span>
                      <input
                        type="password"
                        value={orConfig.apiKey}
                        onChange={e => setOrConfig(c => ({ ...c, apiKey: e.target.value }))}
                        placeholder="sk-or-…"
                        autoComplete="off"
                        className="text-[12.5px] px-2.5 py-1.5 rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] font-mono"
                      />
                    </label>
                    <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">
                      Wird beim Start gespeichert — dieselbe Config wie der Skill-Eval-Judge
                      (dev-eval-eigener Schlüssel, getrennt vom KI-Assistent-Provider).
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Aktionen */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => start.run()}
                loading={start.busy}
                disabled={!transportBereit || start.busy || gewaehlteFixtures.length === 0}
              >
                Eval starten
              </Button>
              {start.busy && (
                <Button type="button" variant="secondary" size="sm" onClick={() => abortRef.current?.abort()}>
                  Abbrechen
                </Button>
              )}
              {ergebnis && !start.busy && (
                <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                  Gate {ergebnis.alleAssertionsOk ? 'bestanden' : 'fehlgeschlagen'}
                  {ergebnis.abgebrochen ? ' · abgebrochen' : ''}
                </span>
              )}
            </div>

            {start.error && (
              <p className="text-[12px] text-[var(--tf-danger-text)]">Fehler: {start.error}</p>
            )}

            {/* Fortschritt je Fixture */}
            {verlauf.length > 0 && (
              <ul className="space-y-1">
                {verlauf.map(z => (
                  <li key={z.id} className="flex items-center gap-2 text-[11.5px]">
                    <StatusDot color={DOT_FARBE[z.status]} />
                    <span className="font-mono text-[var(--tf-text-secondary)] truncate max-w-[40%]" title={z.id}>
                      {z.id}
                    </span>
                    <span className="text-[var(--tf-text-tertiary)]">
                      {z.status === 'running' ? 'läuft…' : z.kurz}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Ergebnisblock */}
            {report && (
              <div className="space-y-2">
                <SettingsSectionHeader
                  label="Ergebnis"
                  action={
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => herunterladen.run()}
                        className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-primary)] hover:underline"
                      >
                        <Download size={12} /> JSONL
                      </button>
                      <button
                        type="button"
                        onClick={() => kopieren.run()}
                        className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-primary)] hover:underline"
                      >
                        <Copy size={12} /> Ergebnis kopieren
                      </button>
                    </div>
                  }
                />
                {(kopieren.error || herunterladen.error) && (
                  <p className="text-[11.5px] text-[var(--tf-danger-text)]">
                    {kopieren.error ? 'Kopieren fehlgeschlagen — Text unten manuell markieren.' : 'Download fehlgeschlagen.'}
                  </p>
                )}
                <pre className="text-[11px] leading-[1.5] font-mono whitespace-pre-wrap text-[var(--tf-text)] max-h-[40vh] overflow-y-auto">
                  {report}
                </pre>
              </div>
            )}

            {/* Rohantworten auffälliger Läufe (Diagnose) */}
            {ergebnis && rohBefunde(ergebnis).length > 0 && (
              <div className="space-y-2">
                <SettingsSectionHeader label="Rohantworten (auffällige Läufe)" />
                <div className="space-y-1.5">
                  {rohBefunde(ergebnis).map(b => <RohtextKarte key={b.key} titel={b.titel} text={b.text} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
