/**
 * Gruppe „Antwortverhalten" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 11, rechte Spalte).
 *
 * Drei Zeilen: Thinking, KI-Variante (Standard/Agentisch) und das
 * Kontextfenster als Automatik/Manuell. Aus dem Kontextfenster folgt, wie lang
 * eine Vorhabensbeschreibung sein darf — deshalb steht die Zahl daneben in
 * Klartext („~173.712 Zeichen"), nicht nur in Tokens.
 */
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { KiVariantSelector } from '@/core/components/KiVariantSelector';
import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import {
  BRIDGE_AGENTISCH_CONTEXT_TOKENS,
  BRIDGE_STANDARD_CONTEXT_TOKENS,
  MAX_LLM_CONTEXT_TOKENS,
  MIN_LLM_CONTEXT_TOKENS,
  clearManualLlmContextTokens,
  computeVbCharCap,
  getLlmContextSource,
  getLlmContextTokens,
  setDetectedLlmContextTokens,
  setLlmContextTokens,
  type LlmContextSource,
} from '@/core/services/ai/llm-context';
import { getLlmThinkingEnabled, setLlmThinkingEnabled } from '@/core/services/ai/llm-thinking';
import type { AIProviderConfig } from '@/core/types/config';
import { SettingsGruppe, SettingsOption } from '../_shared/settings-layout';

const HINT_THINKING =
  'Lässt das LLM vor der Antwort „nachdenken" — oft bessere Ergebnisse, aber langsamer. Der Denkprozess wird pro Fassung aufklappbar angezeigt. Nur die Voreinstellung: bei jeder Generierung („Neu"/„Kürzer"/„Länger") direkt per Schalter umschaltbar.';
const HINT_VARIANTE =
  'Welcher Tab der internen KI angesprochen wird. „Standard" ist der normale Chat, „Agentisch" die Oberfläche mit Werkzeugen — sie hat ein größeres Kontextfenster, antwortet aber langsamer.';
const HINT_KONTEXT =
  'Maximale Tokenzahl des Modells. Daraus folgt, wie lang eine Vorhabensbeschreibung sein darf — längere werden vor der Analyse automatisch gekürzt. „Automatik" nimmt den erkannten bzw. den internen llama.cpp-Standardwert; „Manuell" übersteuert beides.';

export function AntwortverhaltenGruppe({ aiConfig }: { aiConfig: AIProviderConfig }): React.ReactElement {
  const [thinking, setThinking] = useState(getLlmThinkingEnabled());
  const [tokens, setTokens] = useState(getLlmContextTokens());
  const [eingabe, setEingabe] = useState(String(getLlmContextTokens()));
  const [quelle, setQuelle] = useState<LlmContextSource>(getLlmContextSource());
  const [erkannteTokens, setErkannteTokens] = useState<number | null>(null);

  /** Wirksamen Wert + Quelle nach einer Änderung nachziehen. */
  const syncKontext = (): void => {
    const eff = getLlmContextTokens();
    setTokens(eff);
    setEingabe(String(eff));
    setQuelle(getLlmContextSource());
  };

  // Kontextfenster vom laufenden llama.cpp-Server (/props) übernehmen. Nur bei
  // Direct-LLM-Endpunkten sinnvoll — Bridge/nicht erreichbar → Fehlermeldung.
  const erkennen = useAsyncAction(async () => {
    const transport = new DirectLLMTransport(aiConfig.endpoint, aiConfig.model, aiConfig.apiKey || undefined);
    const n = await transport.getContextWindow();
    if (n == null) throw new Error('Kein Kontextfenster vom Server erhalten (/props nicht erreichbar).');
    setDetectedLlmContextTokens(n);
    setErkannteTokens(n);
    syncKontext();
  });

  // Commit beim Verlassen des Feldes: parsen, clampen, persistieren (kein
  // Clampen mitten im Tippen). Ungültig → auf den letzten gültigen Wert zurück.
  const uebernehmen = (): void => {
    const n = parseInt(eingabe, 10);
    if (!Number.isFinite(n)) { setEingabe(String(tokens)); return; }
    const geklemmt = Math.min(Math.max(n, MIN_LLM_CONTEXT_TOKENS), MAX_LLM_CONTEXT_TOKENS);
    setLlmContextTokens(geklemmt);
    setTokens(geklemmt);
    setEingabe(String(geklemmt));
    setQuelle('manuell');
  };

  const manuell = quelle === 'manuell';
  // Hilfetext live aus der Eingabe ableiten (nicht erst nach Commit) — so passt
  // der angezeigte Zeichen-Cap zum gerade eingetippten Token-Wert.
  const getippt = parseInt(eingabe, 10);
  const liveTokens = Number.isFinite(getippt) ? getippt : tokens;

  return (
    <SettingsGruppe titel="Antwortverhalten">
      <SettingsOption id="sec-kontext" label="Thinking nutzen" badge={<span className="text-[11px] text-[var(--tf-text-tertiary)]">Standard</span>} hint={HINT_THINKING}>
        <Switch
          checked={thinking}
          onCheckedChange={v => { setThinking(v); setLlmThinkingEnabled(v); }}
          aria-label="Thinking nutzen"
        />
      </SettingsOption>

      <SettingsOption label="KI-Variante" hint={HINT_VARIANTE}>
        <KiVariantSelector />
      </SettingsOption>

      <SettingsOption
        oben
        label="Kontextfenster"
        hint={HINT_KONTEXT}
        kurzzeile={
          <>
            {tokens.toLocaleString('de-DE')} Tokens · reicht für{' '}
            <b className="font-medium text-[var(--tf-text-secondary)]">
              ~{computeVbCharCap(liveTokens).toLocaleString('de-DE')} Zeichen
            </b>{' '}
            VB
            {/* Bei aktiver Bridge gilt dieser Wert NICHT — sonst zeigte die
                Einstellung eine Zahl an, gegen die nichts geprüft wird. */}
            {aiConfig.type === 'streamlit' && !manuell && (
              <span className="block mt-1">
                Aktiv ist die Bridge — dort gilt das Kontextfenster des gewählten Tabs:
                Standard ~{computeVbCharCap(BRIDGE_STANDARD_CONTEXT_TOKENS).toLocaleString('de-DE')},
                Agentisch ~{computeVbCharCap(BRIDGE_AGENTISCH_CONTEXT_TOKENS).toLocaleString('de-DE')} Zeichen.
                Ein manuell gesetzter Wert übersteuert beide.
              </span>
            )}
            {erkennen.error && (
              <span className="block mt-1 text-[var(--tf-danger-text)]">{erkennen.error}</span>
            )}
            {erkannteTokens != null && !erkennen.error && (
              <span className="block mt-1 text-[var(--tf-success-text)]">
                Server meldet {erkannteTokens.toLocaleString('de-DE')} Tokens
                {manuell ? ' — der manuelle Wert bleibt aktiv' : ''}.
              </span>
            )}
            <button
              type="button"
              onClick={() => erkennen.run()}
              disabled={erkennen.busy}
              className="block mt-1 text-[var(--tf-primary)] hover:underline disabled:opacity-50 cursor-pointer"
            >
              {erkennen.busy ? 'Erkenne…' : 'Vom Server erkennen'}
            </button>
          </>
        }
      >
        <div className="flex items-center gap-2">
          <SegmentedToggle
            rolle="auswahl"
            ariaLabel="Kontextfenster"
            value={manuell ? 'manuell' : 'automatik'}
            onChange={id => {
              if (id === 'automatik') { clearManualLlmContextTokens(); syncKontext(); }
              else { setLlmContextTokens(tokens); setQuelle('manuell'); }
            }}
            options={[{ id: 'automatik', label: 'Automatik' }, { id: 'manuell', label: 'Manuell' }]}
          />
          {manuell && (
            <input
              type="number"
              min={MIN_LLM_CONTEXT_TOKENS}
              max={MAX_LLM_CONTEXT_TOKENS}
              step={1024}
              value={eingabe}
              onChange={e => setEingabe(e.target.value)}
              onBlur={uebernehmen}
              aria-label="Kontextfenster in Tokens"
              className="w-[82px] h-[30px] px-2 text-[12.5px] text-[var(--tf-text)] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] tabular-nums"
              style={{ border: '0.5px solid var(--tf-border-hover)' }}
            />
          )}
        </div>
      </SettingsOption>
    </SettingsGruppe>
  );
}
