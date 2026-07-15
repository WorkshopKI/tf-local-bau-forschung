import { useEffect, useRef, useState } from 'react';
import { ExternalLink, GripVertical, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { BRIDGE_BOOKMARKLET } from '@/core/services/ai/streamlit-bridge/snippet';
import { connectInternalKi } from '@/core/services/ai/connect-ki';
import { KiVariantSelector } from '@/core/components/KiVariantSelector';
import type { AIProviderConfig } from '@/core/types/config';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { isDevContext } from '@/config/feature-flags';
import { SettingsSectionHeader } from './_shared/settings-primitives';

const inputClass = 'w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

interface StreamlitBridgeSectionProps {
  aiConfig: AIProviderConfig;
  setAiConfig: (config: AIProviderConfig) => void;
}

/**
 * In-App-Installer für die Streamlit-Bridge: Streamlit-URL konfigurieren,
 * Bookmarklet in die Lesezeichenleiste ziehen, Verbindung testen.
 * Der Transport (`StreamlitBridgeTransport`) öffnet die URL im Tab
 * `teamflow-streamlit`; das Bookmarklet aktiviert dort die postMessage-Bridge.
 */
export function StreamlitBridgeSection({ aiConfig, setAiConfig }: StreamlitBridgeSectionProps): React.ReactElement {
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const url = (aiConfig.endpoint || 'https://gpt.vdivde-it.de/').trim();

  // React sanitisiert `javascript:`-hrefs (Warnung). Bookmarklet-URL daher
  // imperativ via setAttribute setzen — landet zuverlässig im DOM zum Ziehen.
  useEffect(() => {
    if (linkRef.current) linkRef.current.setAttribute('href', BRIDGE_BOOKMARKLET);
  }, []);

  const save = useAsyncAction(async () => {
    const cfg: AIProviderConfig = { type: 'streamlit', endpoint: url, model: '', apiKey: '' };
    await storage.idb.set('ai-provider', cfg);
    aiBridge.switchProvider(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  });

  const test = useAsyncAction(async () => {
    setTestResult(null);
    // PERSISTENTEN Streamlit-Transport nutzen (nicht neu anlegen) — er hält das
    // per `tf-bridge-ready`-Announce gecapturte Fenster-Handle → pingt den echten
    // Bookmarklet-Tab (tf-ping → tf-pong), ohne ihn per window.open neu zu laden.
    // `url` synchronisiert die Origin-Prüfung.
    const ok = await aiBridge.getStreamlitTransport(url).ping();
    setTestResult(ok ? 'success' : 'error');
    setTimeout(() => setTestResult(null), 5000);
  });

  const openTab = (): void => {
    // Gemeinsamer Helper: synchronisiert die Transport-URL (Origin-Prüfung) und
    // öffnet SYNCHRON den geteilten Tab `teamflow-streamlit` (kein Popup-Blocker).
    connectInternalKi(aiBridge, url);
  };

  // Zweit-LLM-Erprobung (nur dev): Rundlauf gezielt gegen einen Tab der
  // KI-Oberfläche — validiert Tab-Umschaltung + Scrape + Reset (`ziel`-Feld im
  // Bridge-Protokoll), BEVOR irgendein Produktiv-Pfad darauf aufsetzt.
  const [zweitLlm, setZweitLlm] = useState<{ ziel: BridgeZiel; ok: boolean; text: string } | null>(null);
  const zielTest = useAsyncAction(async (ziel: BridgeZiel) => {
    setZweitLlm(null);
    const a = 10 + Math.floor(Math.random() * 80);
    const b = 10 + Math.floor(Math.random() * 80);
    const frage = `Was ist ${a} + ${b}?`;
    const transport = aiBridge.getStreamlitTransport(url);
    const antwort = await transport.submitMessage(frage, undefined, { ziel });
    const ok = antwort.replace(/\s+/g, ' ').includes(String(a + b));
    setZweitLlm({ ziel, ok, text: antwort.slice(0, 200) });
    // Test-Chat aufräumen (best-effort, resetChat rejected nie)
    void transport.resetChat(ziel);
  });

  return (
    <section id="sec-internki" className="scroll-mt-20 space-y-4">
      <SettingsSectionHeader label="Browser-KI-Verbindung" hint="Zugang über einen parallelen Browser-Tab; das Lesezeichen aktiviert die Verbindung dort." />
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] max-w-2xl">
        Zugang zur internen KI über einen parallelen Browser-Tab. Diese App öffnet den Tab und tauscht
        die Daten aus; das Lesezeichen aktiviert die Verbindung im Tab der internen KI.
      </p>

      {/* URL + Speichern */}
      <div className="flex flex-col gap-1.5 max-w-sm">
        <label className="text-[13px] font-medium text-[var(--tf-text)]">Adresse der internen KI</label>
        <input
          value={aiConfig.endpoint}
          onChange={e => setAiConfig({ ...aiConfig, endpoint: e.target.value })}
          placeholder="https://gpt.vdivde-it.de/"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => save.run()} disabled={save.busy}>
          {save.busy ? 'Speichern…' : 'Speichern & Aktivieren'}
        </Button>
        {saved && <Badge variant="success">Aktiviert</Badge>}
        <Button variant="secondary" onClick={openTab} disabled={!url}>
          <ExternalLink size={14} className="mr-1.5" />Interne KI öffnen
        </Button>
        <Button variant="secondary" onClick={() => test.run()} disabled={test.busy || !url}>
          {test.busy ? 'Teste…' : 'Verbindung testen'}
        </Button>
        {testResult === 'success' && <Badge variant="success">Interne KI erreichbar</Badge>}
        {testResult === 'error' && <Badge variant="error">Interne KI nicht erreichbar</Badge>}
      </div>
      {save.error && <p className="text-[12px] text-[var(--tf-danger-text)]">Fehler: {save.error}</p>}
      {test.error && <p className="text-[12px] text-[var(--tf-danger-text)]">Fehler: {test.error}</p>}

      {/* Lesezeichen einrichten — Anleitung (aufklappbar wie im Design-Handoff) */}
      <details className="max-w-2xl">
        <summary className="text-[12.5px] font-medium text-[var(--tf-primary)] cursor-pointer">
          Lesezeichen einrichten — Anleitung
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Kein CTA: ein ZIEHBARES Lesezeichen. Greif-Punkte + Lesezeichen-Icon +
                Grab-Cursor + neutrale (outline) Fläche signalisieren „zieh mich in die
                Leiste", nicht „klick mich" (der javascript:-href tut beim Klick nichts). */}
            <Button asChild variant="secondary" className="cursor-grab select-none">
              {/* href wird imperativ gesetzt (javascript:-Bookmarklet), kein echtes Anker-Ziel — a11y-Anchor-Regel bewusst nicht anwendbar */}
              <a
                ref={linkRef}
                draggable
                onClick={e => e.preventDefault()}
                title="In die Lesezeichenleiste ziehen"
              >
                <GripVertical className="text-[var(--tf-text-tertiary)]" aria-hidden />
                <Bookmark className="text-[var(--tf-primary)]" aria-hidden />
                Interne KI
              </a>
            </Button>
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">In die Lesezeichenleiste ziehen (nicht anklicken)</span>
          </div>
          <ol className="text-[12px] text-[var(--tf-text-secondary)] list-decimal pl-5 space-y-1">
            <li>Adresse der internen KI eintragen und <strong>Speichern &amp; Aktivieren</strong>.</li>
            <li>
              Das ziehbare Lesezeichen{' '}
              <span className="inline-flex items-center gap-1 rounded border border-[var(--tf-border)] px-1.5 py-px align-middle text-[var(--tf-text-secondary)]">
                <GripVertical size={11} className="text-[var(--tf-text-tertiary)]" aria-hidden />
                <Bookmark size={11} className="text-[var(--tf-primary)]" aria-hidden />
                <strong className="font-medium">Interne KI</strong>
              </span>{' '}
              einmalig in die Lesezeichenleiste <strong>ziehen</strong> (nicht anklicken).
            </li>
            <li><strong>Interne KI öffnen</strong> klicken (der Tab muss <em>aus der App</em> geöffnet werden).</li>
            <li>Im Tab der internen KI das Lesezeichen anklicken — unten rechts erscheint eine kleine Status-Pill, die kurz die Prüfungen durchläuft und dann auf grün <strong>„Verbunden"</strong> ruht (ein Klick darauf prüft die Verbindung erneut).</li>
            <li>Zurück hier: <strong>Verbindung testen</strong> → „Interne KI erreichbar". Danach läuft der KI-Chat über die Verbindung.</li>
          </ol>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Hinweis: Das Lesezeichen muss pro KI-Tab einmal angeklickt werden (nach jedem Neuladen erneut).
          </p>
        </div>
      </details>

      {/* KI-Variante (produktiv): Standard vs. agentische interne KI — gilt für alle Läufe. */}
      <div className="max-w-2xl border-t border-[var(--tf-border)] pt-3">
        <KiVariantSelector />
      </div>

      {/* Zweit-LLM-Erprobung (nur dev): Ziel-Routing gegen „Chat" vs. „Agentischer Chat" testen */}
      {isDevContext() && (
        <div className="space-y-2 max-w-2xl border-t border-[var(--tf-border)] pt-3">
          <p className="text-[12.5px] font-medium text-[var(--tf-text)]">Zweit-LLM (Erprobung, dev)</p>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Rundlauf gezielt gegen einen Tab der internen KI („Chat" bzw. „Agentischer Chat"/Qwen):
            Rechenfrage senden, Antwort auslesen, Chat zurücksetzen. Voraussetzung: KI-Tab offen und
            Lesezeichen dort aktiviert.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="secondary" onClick={() => zielTest.run('standard')} disabled={zielTest.busy || !url}>
              Standard testen
            </Button>
            <Button variant="secondary" onClick={() => zielTest.run('agentisch')} disabled={zielTest.busy || !url}>
              Agentisch testen
            </Button>
            {zielTest.busy && <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Läuft… (kann bei Last mehrere Minuten dauern)</span>}
          </div>
          {zweitLlm && (
            <div className="space-y-1">
              <Badge variant={zweitLlm.ok ? 'success' : 'error'}>
                {zweitLlm.ziel === 'agentisch' ? 'Agentisch' : 'Standard'}: {zweitLlm.ok ? 'OK' : 'prüfen'}
              </Badge>
              <p className="text-[12px] text-[var(--tf-text-secondary)] break-words">{zweitLlm.text}</p>
            </div>
          )}
          {zielTest.error && <p className="text-[12px] text-[var(--tf-danger-text)]">Fehler: {zielTest.error}</p>}
        </div>
      )}
    </section>
  );
}
