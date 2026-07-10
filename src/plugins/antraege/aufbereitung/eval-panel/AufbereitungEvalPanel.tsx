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
import { loadEvalFixtures } from '@/core/services/skill-eval/fixtures/bundle';
import { loadAspekteGoldset } from '@/core/services/skill-eval/fixtures/aspekte-goldset';
import { SettingsSectionHeader } from '@/plugins/einstellungen/_shared/settings-primitives';
import {
  runAufbereitungEval, STECKBRIEF_FELDER,
  type EvalFixtureQuelle, type FixtureErgebnis, type AufbereitungEvalErgebnis,
} from './runner';
import { formatEvalReport } from './report';

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
  return teile.join(' · ');
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
  const [anzahl, setAnzahl] = useState(3);
  const [mitSteckbrief, setMitSteckbrief] = useState(true);
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
        { aspekteSkill, steckbriefSkill, transport, fixtures, goldset },
        {
          limit: grenze,
          includeSteckbrief: mitSteckbrief,
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
              <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
                <Switch checked={mitSteckbrief} onCheckedChange={setMitSteckbrief} />
                Steckbrief einschließen
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
          </div>
        </div>
      </div>
    </div>
  );
}
