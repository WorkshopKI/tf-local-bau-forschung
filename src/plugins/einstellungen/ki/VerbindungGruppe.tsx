/**
 * Gruppe „Verbindung" zur internen KI (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshots 11/12).
 *
 * Oben eine Status-Karte (Punkt + Klartext + Adresse) mit den beiden Knöpfen,
 * die man wirklich braucht; darunter das Adressfeld mit **explizitem**
 * Speichern (eine halb getippte Adresse darf nicht wirksam werden) und die
 * Einrichtung in fünf Schritten als Klappe.
 *
 * Der Zugang läuft über einen parallelen Browser-Tab: Diese App öffnet den Tab
 * und tauscht die Daten aus; ein Lesezeichen aktiviert die Verbindung dort —
 * pro KI-Tab einmal anklicken, nach jedem Neuladen erneut.
 */
import { useEffect, useRef, useState } from 'react';
import { Bookmark, ExternalLink, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { BRIDGE_BOOKMARKLET } from '@/core/services/ai/streamlit-bridge/snippet';
import { connectInternalKi } from '@/core/services/ai/connect-ki';
import type { AIProviderConfig } from '@/core/types/config';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { isDevContext } from '@/config/feature-flags';
import { SettingsGruppe, SettingsKlappe } from '@/components/settings';

const HINT_GRUPPE =
  'Der Zugang läuft über einen parallelen Browser-Tab: Diese App öffnet den Tab und tauscht die Daten aus. Ein Lesezeichen aktiviert die Verbindung im Tab der internen KI — pro KI-Tab einmal anklicken, nach jedem Neuladen erneut.';

export function VerbindungGruppe({
  aiConfig,
  setAiConfig,
}: {
  aiConfig: AIProviderConfig;
  setAiConfig: (config: AIProviderConfig) => void;
}): React.ReactElement {
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const [testErgebnis, setTestErgebnis] = useState<'success' | 'error' | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const url = (aiConfig.endpoint || 'https://gpt.vdivde-it.de/').trim();

  // React sanitisiert `javascript:`-hrefs (Warnung). Bookmarklet-URL daher
  // imperativ via setAttribute setzen — landet zuverlässig im DOM zum Ziehen.
  useEffect(() => {
    if (linkRef.current) linkRef.current.setAttribute('href', BRIDGE_BOOKMARKLET);
  }, []);

  const speichern = useAsyncAction(async () => {
    const cfg: AIProviderConfig = { type: 'streamlit', endpoint: url, model: '', apiKey: '' };
    await storage.idb.set('ai-provider', cfg);
    aiBridge.switchProvider(cfg);
    setGespeichert(true);
    setTimeout(() => setGespeichert(false), 3000);
  });

  const testen = useAsyncAction(async () => {
    setTestErgebnis(null);
    // PERSISTENTEN Streamlit-Transport nutzen (nicht neu anlegen) — er hält das
    // per `tf-bridge-ready`-Announce gecapturte Fenster-Handle → pingt den echten
    // Bookmarklet-Tab (tf-ping → tf-pong), ohne ihn per window.open neu zu laden.
    const ok = await aiBridge.getStreamlitTransport(url).ping(); // allow-oeffnender-ping: „Verbindung testen" — Öffnen ist hier die Wirkung
    setTestErgebnis(ok ? 'success' : 'error');
    setTimeout(() => setTestErgebnis(null), 5000);
  });

  const verbunden = testErgebnis === 'success';
  const statusText = testErgebnis === 'success'
    ? 'Verbunden'
    : testErgebnis === 'error'
      ? 'Nicht erreichbar'
      : 'Nicht verbunden';

  return (
    <SettingsGruppe id="sec-internki" titel="Verbindung" hint={HINT_GRUPPE}>
      <div
        className="flex items-center gap-3 flex-wrap rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg-secondary)] px-4 py-3.5 mt-1"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-medium text-[var(--tf-text)] flex items-center gap-2">
            <span
              aria-hidden
              className="w-[7px] h-[7px] rounded-full shrink-0"
              style={{ background: verbunden ? 'var(--tf-success-text)' : 'var(--tf-text-tertiary)' }}
            />
            {statusText}
          </p>
          <p className="text-[12px] leading-[1.5] text-[var(--tf-text-tertiary)] mt-0.5 break-all">
            {url}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => testen.run()} disabled={testen.busy || !url}>
            {testen.busy ? 'Teste…' : 'Verbindung testen'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={ExternalLink}
            onClick={() => connectInternalKi(aiBridge, url)}
            disabled={!url}
          >
            Interne KI öffnen
          </Button>
        </div>
      </div>
      {testen.error && <p className="text-[12px] text-[var(--tf-danger-text)] pt-2">Fehler: {testen.error}</p>}

      <div className="flex items-end gap-2 flex-wrap pt-3">
        <label className="flex-1 min-w-[200px]">
          <span className="block text-[12.5px] text-[var(--tf-text-secondary)] mb-1">Adresse der internen KI</span>
          <input
            value={aiConfig.endpoint}
            onChange={e => setAiConfig({ ...aiConfig, endpoint: e.target.value })}
            placeholder="https://gpt.vdivde-it.de/"
            spellCheck={false}
            className="w-full h-[30px] px-2.5 text-[12px] font-mono bg-[var(--tf-bg)] text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]"
            style={{ border: '0.5px solid var(--tf-border-hover)' }}
          />
        </label>
        <Button size="sm" onClick={() => speichern.run()} disabled={speichern.busy}>
          {speichern.busy ? 'Speichern…' : 'Speichern'}
        </Button>
        {gespeichert && <Badge variant="success">Aktiviert</Badge>}
      </div>
      {speichern.error && <p className="text-[12px] text-[var(--tf-danger-text)] pt-1.5">Fehler: {speichern.error}</p>}

      <div className="pt-2">
        <SettingsKlappe
          id="sec-internki-einrichtung"
          label="Verbindung einrichten"
          storageKey="teamflow_settings_bridge_einrichtung_collapsed"
          zaehler="5 Schritte"
        >
          <div className="flex items-center gap-3 flex-wrap mb-3">
            {/* Kein CTA: ein ZIEHBARES Lesezeichen. Greif-Punkte + Lesezeichen-Icon +
                Grab-Cursor + neutrale Fläche signalisieren „zieh mich in die Leiste",
                nicht „klick mich" (der javascript:-href tut beim Klick nichts). */}
            <Button asChild variant="secondary" size="sm" className="cursor-grab select-none">
              {/* href wird imperativ gesetzt (javascript:-Bookmarklet), kein echtes Anker-Ziel */}
              <a ref={linkRef} draggable onClick={e => e.preventDefault()} title="In die Lesezeichenleiste ziehen">
                <GripVertical className="text-[var(--tf-text-tertiary)]" aria-hidden />
                <Bookmark className="text-[var(--tf-primary)]" aria-hidden />
                Interne KI
              </a>
            </Button>
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              In die Lesezeichenleiste ziehen (nicht anklicken)
            </span>
          </div>
          <ol className="text-[12px] leading-[1.6] text-[var(--tf-text-secondary)] list-decimal pl-5 space-y-1">
            <li>Adresse der internen KI eintragen und <strong className="font-medium text-[var(--tf-text)]">Speichern</strong>.</li>
            <li>Das ziehbare Lesezeichen einmalig in die Lesezeichenleiste <strong className="font-medium text-[var(--tf-text)]">ziehen</strong> (nicht anklicken).</li>
            <li><strong className="font-medium text-[var(--tf-text)]">Interne KI öffnen</strong> klicken — der Tab muss <em>aus der App</em> geöffnet werden.</li>
            <li>Im KI-Tab das Lesezeichen anklicken; unten rechts erscheint eine Status-Pille, die auf grün „Verbunden" ruht.</li>
            <li>Zurück hier: <strong className="font-medium text-[var(--tf-text)]">Verbindung testen</strong> → „Verbunden". Danach laufen die KI-Läufe darüber.</li>
          </ol>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-2">
            Das Lesezeichen muss pro KI-Tab einmal angeklickt werden — nach jedem Neuladen erneut.
          </p>
        </SettingsKlappe>
      </div>

      {isDevContext() && <ZweitLlmKlappe url={url} />}
    </SettingsGruppe>
  );
}

/**
 * Zweit-LLM-Erprobung (nur dev): Rundlauf gezielt gegen einen Tab der
 * KI-Oberfläche — validiert Tab-Umschaltung, Scrape und Reset (`ziel`-Feld im
 * Bridge-Protokoll), BEVOR ein Produktiv-Pfad darauf aufsetzt.
 */
function ZweitLlmKlappe({ url }: { url: string }): React.ReactElement {
  const aiBridge = useAIBridge();
  const [ergebnis, setErgebnis] = useState<{ ziel: BridgeZiel; ok: boolean; text: string } | null>(null);

  const zielTest = useAsyncAction(async (ziel: BridgeZiel) => {
    setErgebnis(null);
    const a = 10 + Math.floor(Math.random() * 80);
    const b = 10 + Math.floor(Math.random() * 80);
    const transport = aiBridge.getStreamlitTransport(url);
    const antwort = await transport.submitMessage(`Was ist ${a} + ${b}?`, undefined, { ziel });
    const ok = antwort.replace(/\s+/g, ' ').includes(String(a + b));
    setErgebnis({ ziel, ok, text: antwort.slice(0, 200) });
    // Test-Chat aufräumen (best-effort, resetChat rejected nie)
    void transport.resetChat(ziel);
  });

  return (
    <SettingsKlappe
      id="sec-zweit-llm"
      label="Zweit-LLM (Erprobung, dev)"
      storageKey="teamflow_settings_zweitllm_collapsed"
    >
      <p className="text-[12px] leading-[1.5] text-[var(--tf-text-tertiary)] mb-2">
        Rundlauf gezielt gegen einen Tab der internen KI („Chat" bzw. „Agentischer Chat"): Rechenfrage
        senden, Antwort auslesen, Chat zurücksetzen. Voraussetzung: KI-Tab offen, Lesezeichen dort aktiviert.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="secondary" size="sm" onClick={() => zielTest.run('standard')} disabled={zielTest.busy || !url}>
          Standard testen
        </Button>
        <Button variant="secondary" size="sm" onClick={() => zielTest.run('agentisch')} disabled={zielTest.busy || !url}>
          Agentisch testen
        </Button>
        {zielTest.busy && (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Läuft… (kann bei Last mehrere Minuten dauern)</span>
        )}
      </div>
      {ergebnis && (
        <div className="space-y-1 mt-2">
          <Badge variant={ergebnis.ok ? 'success' : 'error'}>
            {ergebnis.ziel === 'agentisch' ? 'Agentisch' : 'Standard'}: {ergebnis.ok ? 'OK' : 'prüfen'}
          </Badge>
          <p className="text-[12px] text-[var(--tf-text-secondary)] break-words">{ergebnis.text}</p>
        </div>
      )}
      {zielTest.error && <p className="text-[12px] text-[var(--tf-danger-text)] mt-1.5">Fehler: {zielTest.error}</p>}
    </SettingsKlappe>
  );
}
