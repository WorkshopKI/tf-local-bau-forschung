/**
 * Seite „Interne KI" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshots 11/12).
 *
 * Links die Verbindung — sie ist die Voraussetzung für alles Übrige und trägt
 * deshalb die Statuskarte; rechts, wie die KI antwortet, und wohin die
 * Recherche-Knöpfe führen. Die dev-Werkbänke (Provider, Eval-Panels) stehen
 * eingeklappt unter der Verbindung.
 *
 * Speichern bleibt hier EXPLIZIT: eine halb getippte Adresse oder Ziel-URL darf
 * nicht wirksam werden (anders als Profil/Fachprofil, die automatisch sichern).
 */
import {
  isAntragAufbereitungEnabled,
  isDevContext,
  isDevFixturesEnabled,
  isLlmKontextSettingEnabled,
} from '@/config/feature-flags';
import { AufbereitungEvalPanel } from '@/plugins/antraege/aufbereitung/eval-panel/AufbereitungEvalPanel';
import { AufbereitungRechercheSettings } from '@/plugins/antraege/aufbereitung/AufbereitungRechercheSettings';
import type { AIProviderConfig } from '@/core/types/config';
import { GedaechtnisEvalPanel } from '../GedaechtnisEvalPanel';
import { SettingsGruppe, SettingsKlappe, SettingsZweiSpalten } from '@/components/settings';
import { VerbindungGruppe } from './VerbindungGruppe';
import { AntwortverhaltenGruppe } from './AntwortverhaltenGruppe';
import { ProviderKlappe } from './ProviderKlappe';

const HINT_RECHERCHE =
  'Ziel-Seiten der „Kopieren & … öffnen"-Knöpfe in der Antrag-Aufbereitung. Leer lassen = Standard-URL. Team-weit gespeichert, änderbar nur mit Kurator-Schreibrecht.';

export function KiPanel({
  aiConfig,
  setAiConfig,
}: {
  aiConfig: AIProviderConfig;
  setAiConfig: (config: AIProviderConfig) => void;
}): React.ReactElement {
  return (
    <SettingsZweiSpalten
      haupt={
        <>
          <VerbindungGruppe aiConfig={aiConfig} setAiConfig={setAiConfig} />
          {isDevContext() && (
            <SettingsGruppe titel="Werkbank (dev)" unterzeile="Nur im Entwickler-Build sichtbar.">
              <ProviderKlappe aiConfig={aiConfig} setAiConfig={setAiConfig} />
              {/* Fiktive Fixtures — die 2-MB-VBs bleiben über den dev-Guard aus
                  prod/pl heraus; die Panels messen über die Bridge (kein Cache). */}
              {isDevFixturesEnabled() && (
                <>
                  <SettingsKlappe
                    id="sec-aufbereitung-eval"
                    label="Aufbereitung: Baustein-Eval"
                    storageKey="teamflow_settings_aufbereitung_eval_collapsed"
                  >
                    <AufbereitungEvalPanel />
                  </SettingsKlappe>
                  <SettingsKlappe
                    id="sec-gedaechtnis-eval"
                    label="Gedächtnis: Eval"
                    storageKey="teamflow_settings_gedaechtnis_eval_collapsed"
                  >
                    <GedaechtnisEvalPanel />
                  </SettingsKlappe>
                </>
              )}
            </SettingsGruppe>
          )}
        </>
      }
      neben={
        <>
          {/* Kontextlänge + Thinking nur, wo die LLM-Skill-Generierung läuft
              (dev + pl). Sonst erscheint die Seite nur wegen der Bridge. */}
          {isLlmKontextSettingEnabled() && <AntwortverhaltenGruppe aiConfig={aiConfig} />}
          {isAntragAufbereitungEnabled() && (
            <SettingsGruppe
              id="sec-aufbereitung-recherche"
              titel="Externe Recherche-Ziele"
              hint={HINT_RECHERCHE}
              unterzeile={'Wohin die „Kopieren & öffnen"-Knöpfe führen.'}
            >
              <SettingsKlappe
                id="sec-recherche-adressen"
                label="Ziel-Adressen bearbeiten"
                storageKey="teamflow_settings_recherche_collapsed"
                zaehler="3 Dienste"
              >
                <AufbereitungRechercheSettings />
              </SettingsKlappe>
            </SettingsGruppe>
          )}
        </>
      }
    />
  );
}
