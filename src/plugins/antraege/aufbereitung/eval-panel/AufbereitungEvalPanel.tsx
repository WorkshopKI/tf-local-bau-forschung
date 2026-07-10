/**
 * Dev-only In-App-Eval der Antrag-Aufbereitung: fährt die fiktiven Goldset-Fixtures
 * über die interne Bridge durch die bestehenden Bausteine (`aufbereitung-aspekte`,
 * `aufbereitung-steckbrief`), misst die Aspekt-Zuordnung gegen das partielle Goldset
 * und legt das Ergebnis als kopierbaren Markdown-Block ab.
 *
 * Ort: Einstellungen → KI-Panel, gegated `isDevFixturesEnabled()` (der Parent rendert
 * uns nur dann). Muster: `anfragen/AnfrageRecallEval` (Recall-Eval-Karte) + der
 * dev-Testlauf-Block in `StreamlitBridgeSection`. Nur MESSEN — keine Skill-Aktivierung.
 *
 * Der Transport kommt AUSSCHLIESSLICH über `bridge.getTransportForSkillRun(skill)`
 * (Policy wirft bei externem Provider → Banner, kein Lauf; Pitfall #30). Läufe strikt
 * sequentiell (die Bridge ist ein einzelnes postMessage-Fenster).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, ChevronRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { StatusDot } from '@/components/ui/StatusBadge';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';
import { loadSkillRegistry, getSkillById, type SkillRecord } from '@/core/services/skills';
import {
  AUFBEREITUNG_ASPEKTE_SKILL, AUFBEREITUNG_ASPEKTE_SKILL_ID,
} from '@/core/services/skills/registry/aufbereitung-aspekte.seed';
import {
  AUFBEREITUNG_STECKBRIEF_SKILL, AUFBEREITUNG_STECKBRIEF_SKILL_ID,
} from '@/core/services/skills/registry/aufbereitung-steckbrief.seed';
import {
  AUFBEREITUNG_ZAHLEN_SKILL, AUFBEREITUNG_ZAHLEN_SKILL_ID,
} from '@/core/services/skills/registry/aufbereitung-zahlen.seed';
import {
  AUFBEREITUNG_GLOSSAR_SKILL, AUFBEREITUNG_GLOSSAR_SKILL_ID,
} from '@/core/services/skills/registry/aufbereitung-glossar.seed';
import { loadEvalFixtures } from '@/core/services/skill-eval/fixtures/bundle';
import { loadAspekteGoldset } from '@/core/services/skill-eval/fixtures/aspekte-goldset';
import { SettingsSectionHeader } from '@/plugins/einstellungen/_shared/settings-primitives';
import {
  runAufbereitungEval, STECKBRIEF_FELDER, WIEDERHOLUNGEN_MAX,
  type EvalFixtureQuelle, type FixtureErgebnis, type AufbereitungEvalErgebnis,
} from './runner';
import { formatEvalReport } from './report';
import { resetHatVerlaufsrisiko } from '@/core/services/ai/chat-reset';

type VerlaufStatus = 'pending' | 'running' | 'ok' | 'degradiert' | 'fehler' | 'fehlt';

interface VerlaufZeile {
  vbFile: string;
  status: VerlaufStatus;
  dauerMs?: number;
  kurz?: string;
}

const DOT_FARBE: Record<VerlaufStatus, string> = {
  pending: 'var(--tf-text-tertiary)',
  running: 'var(--tf-warning-text)',
  ok: 'var(--tf-success-text)',
  degradiert: 'var(--tf-warning-text)',
  fehler: 'var(--tf-danger-text)',
  fehlt: 'var(--tf-danger-text)',
};

function statusVon(e: FixtureErgebnis): VerlaufStatus {
  if (!e.gefunden) return 'fehlt';
  return e.aspekte?.status ?? 'fehler';
}

function kurzVon(e: FixtureErgebnis): string {
  if (!e.gefunden) return 'nicht gefunden';
  const teile: string[] = [];
  const a = e.aspekte;
  if (a?.status === 'ok' && a.metrik) {
    teile.push(`P${a.metrik.precision.toFixed(2)} R${a.metrik.recall.toFixed(2)} F1${a.metrik.f1.toFixed(2)}`);
  } else if (a?.status === 'degradiert') teile.push('Aspekte degradiert');
  else if (a?.status === 'fehler') teile.push('Aspekte-Fehler');
  const s = e.steckbrief;
  if (s?.status === 'ok') teile.push(`SB ${s.gefuellteFelder ?? 0}/${STECKBRIEF_FELDER}`);
  else if (s?.status === 'degradiert') teile.push('SB degr.');
  else if (s?.status === 'fehler') teile.push('SB-Fehler');
  const z = e.zahlen;
  if (z?.status === 'ok') teile.push(`Zahlen ${z.claimAnzahl ?? 0}${z.hatTabelle || z.abgeschnitten ? ' ⚠' : ''}`);
  else if (z?.status === 'degradiert') teile.push('Zahlen degr.');
  else if (z?.status === 'fehler') teile.push('Zahlen-Fehler');
  const gl = e.glossar;
  if (gl?.status === 'ok') teile.push(`Glossar ${gl.begriffAnzahl ?? 0}`);
  else if (gl?.status === 'degradiert') teile.push('Glossar degr.');
  else if (gl?.status === 'fehler') teile.push('Glossar-Fehler');
  if ([a?.chatResetStatus, s?.chatResetStatus, z?.chatResetStatus].some(x => x != null && resetHatVerlaufsrisiko(x))) teile.push('⚠ Reset');
  return teile.join(' · ');
}

/** Ein persistierter Rohtext eines auffälligen Laufs (degradiert oder ok-mit-Auffälligkeit). */
interface RohBefund { key: string; titel: string; text: string }

/** Kurz-Etikett der Zahlen-Auffälligkeit für die Rohtext-Karte. */
function zahlenAuffaelligkeit(z: FixtureErgebnis['zahlen']): string {
  const flags = [z?.hatTabelle ? 'Tabellen-Präambel' : null, z?.abgeschnitten ? 'JSON abgeschnitten' : null].filter(Boolean);
  return flags.join(', ');
}

/**
 * Sammelt die Rohantworten auffälliger Läufe (Diagnose): degradierte Aspekte/Steckbrief/Zahlen
 * UND `ok`-Zahlen-Läufe, die eine Tabellen-Präambel trugen oder truncated waren (dann liefert
 * der Runner die Roh-Antwort trotz `ok` mit — damit sichtbar wird, WARUM wenige Claims kamen).
 */
function rohBefunde(erg: AufbereitungEvalErgebnis | null): RohBefund[] {
  if (!erg) return [];
  const out: RohBefund[] = [];
  for (const f of erg.fixtures) {
    const a = f.aspekte;
    if (a?.status === 'degradiert' && a.rohtext) {
      out.push({ key: `${f.vbFile}:aspekte`, titel: `${f.vbFile} · Aspekte (degradiert${a.retryAnzahl ? `, nach ${a.retryAnzahl}× Retry` : ''})`, text: a.rohtext });
    }
    if (f.steckbrief?.status === 'degradiert' && f.steckbrief.rohtext) {
      out.push({ key: `${f.vbFile}:steckbrief`, titel: `${f.vbFile} · Steckbrief (degradiert)`, text: f.steckbrief.rohtext });
    }
    const z = f.zahlen;
    if (z?.rohtext) {
      const titel = z.status === 'degradiert'
        ? `${f.vbFile} · Zahlen (degradiert)`
        : `${f.vbFile} · Zahlen (ok — ${zahlenAuffaelligkeit(z) || 'auffällig'})`;
      out.push({ key: `${f.vbFile}:zahlen`, titel, text: z.rohtext });
    }
    if (f.glossar?.status === 'degradiert' && f.glossar.rohtext) {
      out.push({ key: `${f.vbFile}:glossar`, titel: `${f.vbFile} · Glossar (degradiert)`, text: f.glossar.rohtext });
    }
  }
  return out;
}

/** Einklappbarer Rohtext-Block mit Kopier-Knopf (je auffälligem Fixture-Lauf). */
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

export function AufbereitungEvalPanel(): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();
  const bridgeStatus = useBridgeStatus(s => s.status);
  const verbunden = bridgeStatus === 'connected';

  const goldset = useMemo(() => {
    try { return loadAspekteGoldset(); } catch { return null; }
  }, []);
  const maxAnzahl = goldset?.fixtures.length ?? 0;

  const [aspekteSkill, setAspekteSkill] = useState<SkillRecord | null>(null);
  const [steckbriefSkill, setSteckbriefSkill] = useState<SkillRecord | null>(null);
  const [zahlenSkill, setZahlenSkill] = useState<SkillRecord | null>(null);
  const [glossarSkill, setGlossarSkill] = useState<SkillRecord | null>(null);
  const [anzahl, setAnzahl] = useState(3);
  const [wiederholungen, setWiederholungen] = useState(1);
  const [mitSteckbrief, setMitSteckbrief] = useState(true);
  const [mitZahlen, setMitZahlen] = useState(true);
  const [mitGlossar, setMitGlossar] = useState(true);
  // Zweit-LLM-A/B: aus = Standard-Chat (gpt-oss), an = agentischer Qwen-Tab (260k).
  const [agentisch, setAgentisch] = useState(false);
  const [verlauf, setVerlauf] = useState<VerlaufZeile[]>([]);
  const [ergebnis, setErgebnis] = useState<AufbereitungEvalErgebnis | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadSkillRegistry(storage);
      if (cancelled) return;
      setAspekteSkill(getSkillById(loaded.file, AUFBEREITUNG_ASPEKTE_SKILL_ID) ?? AUFBEREITUNG_ASPEKTE_SKILL);
      setSteckbriefSkill(getSkillById(loaded.file, AUFBEREITUNG_STECKBRIEF_SKILL_ID) ?? AUFBEREITUNG_STECKBRIEF_SKILL);
      setZahlenSkill(getSkillById(loaded.file, AUFBEREITUNG_ZAHLEN_SKILL_ID) ?? AUFBEREITUNG_ZAHLEN_SKILL);
      setGlossarSkill(getSkillById(loaded.file, AUFBEREITUNG_GLOSSAR_SKILL_ID) ?? AUFBEREITUNG_GLOSSAR_SKILL);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  const bereit = verbunden && !!aspekteSkill && !!steckbriefSkill && !!goldset && maxAnzahl > 0;

  const start = useAsyncAction(async () => {
    if (!aspekteSkill || !steckbriefSkill || !goldset) return;
    // Policy-Pfad: wirft bei externem Provider (dann kein Lauf, Banner unten).
    const transport = bridge.getTransportForSkillRun(aspekteSkill);
    let fixtures: EvalFixtureQuelle[];
    try {
      fixtures = loadEvalFixtures();
    } catch (e) {
      throw new Error(`Fixtures nicht verfügbar (nur dev): ${e instanceof Error ? e.message : String(e)}`);
    }
    const grenze = Math.max(1, Math.min(anzahl, maxAnzahl));
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setReport(null);
    setErgebnis(null);
    setVerlauf(goldset.fixtures.slice(0, grenze).map(g => ({ vbFile: g.vbFile, status: 'pending' as const })));
    try {
      const erg = await runAufbereitungEval(
        { aspekteSkill, steckbriefSkill, zahlenSkill: zahlenSkill ?? undefined, glossarSkill: glossarSkill ?? undefined, transport, fixtures, goldset },
        {
          limit: grenze,
          includeSteckbrief: mitSteckbrief,
          includeZahlen: mitZahlen,
          includeGlossar: mitGlossar,
          wiederholungen,
          ziel: agentisch ? 'agentisch' : undefined,
          signal: ctrl.signal,
          onFixtureStart: (vbFile) =>
            setVerlauf(v => v.map(x => (x.vbFile === vbFile ? { ...x, status: 'running' } : x))),
          onFixtureDone: (e) =>
            setVerlauf(v => v.map(x => (x.vbFile === e.vbFile
              ? { ...x, status: statusVon(e), dauerMs: e.dauerMs, kurz: kurzVon(e) }
              : x))),
        },
      );
      setErgebnis(erg);
      setReport(formatEvalReport(erg, {
        zeitpunkt: new Date().toLocaleString('de-DE'),
        transportName: transport.displayName ?? transport.name,
        steckbriefEingeschlossen: mitSteckbrief,
        ziel: agentisch ? 'agentisch' : undefined,
      }));
    } finally {
      abortRef.current = null;
    }
  });

  const kopieren = useAsyncAction(async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
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
        <FlaskConical size={13} className="shrink-0" /> Eval öffnen (fiktive Fixtures · interne KI · nur Messung)
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 space-y-3">
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              Fährt die drei fiktiven Goldset-VBs sequentiell über die interne KI durch den
              Aspekt-Mapping-Baustein (Precision/Recall/F1 gegen das partielle Goldset) und den
              Steckbrief-Baustein (Smoke-Test: nur Status + Anzahl gefüllter Felder). Je Lauf grob
              0,5–2&nbsp;Min über die Bridge. Es werden nur die bestehenden Bausteine gemessen — keine
              Skill-Aktivierung.
            </p>

            {/* Bridge-Bereitschaft */}
            <div className="flex items-center gap-2 text-[11.5px]">
              <StatusDot color={verbunden ? 'var(--tf-success-text)' : 'var(--tf-warning-text)'} />
              <span className="text-[var(--tf-text-secondary)]">
                {verbunden
                  ? 'Interne KI verbunden'
                  : 'Interne KI nicht verbunden — im Abschnitt „Interne KI" verbinden.'}
              </span>
            </div>

            {/* Steuerung */}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
                Fixtures
                <input
                  type="number"
                  min={1}
                  max={maxAnzahl || 1}
                  value={anzahl}
                  onChange={e => setAnzahl(Math.max(1, Math.min(parseInt(e.target.value, 10) || 1, maxAnzahl || 1)))}
                  className="w-16 px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                />
                <span className="text-[var(--tf-text-tertiary)]">/ {maxAnzahl}</span>
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]" title="Aspekte je Fixture n× fahren (Varianz-Messung). Steckbrief-Smoke bleibt 1 Lauf.">
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
              <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
                <Switch checked={mitSteckbrief} onCheckedChange={setMitSteckbrief} />
                Steckbrief einschließen
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
                <Switch checked={mitZahlen} onCheckedChange={setMitZahlen} />
                Zahlen einschließen
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
                <Switch checked={mitGlossar} onCheckedChange={setMitGlossar} />
                Glossar einschließen
              </label>
              <label
                className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]"
                title="A/B: Läufe an den agentischen Qwen-Tab (260k Kontext) statt den Standard-Chat (gpt-oss) senden. Voraussetzung: der Qwen-Tab ist offen und das Lesezeichen dort aktiviert."
              >
                <Switch checked={agentisch} onCheckedChange={setAgentisch} />
                Agentisch (Qwen, 260k)
              </label>
            </div>

            {/* Aktionen */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => start.run()}
                loading={start.busy}
                disabled={!bereit || start.busy}
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
                  Mikro-F1 {ergebnis.zusammenfassung.mikroF1.toFixed(3)}
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
                  <li key={z.vbFile} className="flex items-center gap-2 text-[11.5px]">
                    <StatusDot color={DOT_FARBE[z.status]} />
                    <span className="font-mono text-[var(--tf-text-secondary)] truncate max-w-[46%]" title={z.vbFile}>
                      {z.vbFile}
                    </span>
                    <span className="text-[var(--tf-text-tertiary)]">
                      {z.status === 'running' ? 'läuft…' : z.kurz}
                      {z.dauerMs != null ? ` · ${(z.dauerMs / 1000).toFixed(1)}s` : ''}
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
                    <button
                      type="button"
                      onClick={() => kopieren.run()}
                      className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-primary)] hover:underline"
                    >
                      <Copy size={12} /> Ergebnis kopieren
                    </button>
                  }
                />
                {kopieren.error && (
                  <p className="text-[11.5px] text-[var(--tf-danger-text)]">
                    Kopieren fehlgeschlagen — Text unten manuell markieren.
                  </p>
                )}
                <pre className="text-[11px] leading-[1.5] font-mono whitespace-pre-wrap text-[var(--tf-text)] max-h-[40vh] overflow-y-auto">
                  {report}
                </pre>
              </div>
            )}

            {/* Rohantworten auffälliger Läufe (Diagnose): degradiert + ok-mit-Tabelle/Truncation */}
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
