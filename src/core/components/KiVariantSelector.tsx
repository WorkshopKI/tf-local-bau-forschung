import { useState } from 'react';
import { useKiZiel, sollWechselHinweisZeigen } from '@/core/services/ai/ki-ziel';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useChatStore } from '@/plugins/chat/store';

/**
 * Auswahl der KI-Variante (global, `useKiZiel`): „Standard" (klassische interne KI,
 * Default) vs. „Agentisch" (agentische interne KI, Erprobung). Wird an allen
 * KI-Verbindungs-Stellen angeboten (Einstellungen, Sidebar-Indikator, Home-Karte,
 * Verbinden-Prompt). Die Wahl gilt für ALLE Läufe (Gutachten/Kurzfassung/NF/
 * Aufbereitung/Chat) über `aktivesZielFuerLauf`.
 *
 * Wechsel MITTEN im Chat bekommt einen Hinweis (v2.275): der Wechsel schaltet den
 * Streamlit-Tab um, und weil die Bridge aus App-Sicht single-turn ist, liegt der
 * Gesprächsfaden in der Historie des Tabs — der neue kennt ihn nicht. Bewusst ein
 * nachgelagerter Hinweis statt eines Bestätigungsdialogs: der Wechsel ist
 * verlustfrei umkehrbar, und ein Dialog auf einem Zwei-Knopf-Umschalter nervt
 * genau die Nutzer, die wissen was sie tun. Wann gewarnt wird, entscheidet die
 * reine `sollWechselHinweisZeigen`.
 *
 * Drei Stufen: voll (Label + Chips + Erklärung), `compact` (ohne Erklärung) und
 * `nurSteuerung` (nur die Chips). Letzteres für Wirte, die Label und Erklärung
 * selbst mitbringen — die `SettingsOption` der Einstellungen tut das, und ohne
 * die Stufe stünde „KI-Variante" dort zweimal und der Erklärabsatz liefe in der
 * schmalen Nebenspalte über den Kartenrand.
 */
export function KiVariantSelector({
  compact = false,
  nurSteuerung = false,
}: { compact?: boolean; nurSteuerung?: boolean } = {}): React.ReactElement {
  const ziel = useKiZiel(s => s.ziel);
  const setZiel = useKiZiel(s => s.setZiel);
  const bridge = useAIBridge();
  const [hinweis, setHinweis] = useState(false);
  const OPTIONEN = [
    { value: 'standard', label: 'Standard' },
    { value: 'agentisch', label: 'Agentisch' },
  ] as const;

  const waehle = (neu: typeof OPTIONEN[number]['value']): void => {
    setHinweis(sollWechselHinweisZeigen({
      bridgeAktiv: bridge.istBridgeAktiv(),
      gespraechLaeuft: useChatStore.getState().activeMessages.length > 0,
      altesZiel: ziel,
      neuesZiel: neu,
    }));
    setZiel(neu);
  };

  return (
    <div className={nurSteuerung ? 'max-w-[240px]' : undefined}>
      {!nurSteuerung && (
        <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">KI-Variante</div>
      )}
      <div className="inline-flex gap-1.5 flex-wrap">
        {OPTIONEN.map(opt => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={ziel === opt.value}
            onClick={() => waehle(opt.value)}
            className={
              ziel === opt.value
                ? 'px-3 py-1 rounded-[16px] text-[12px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
                : 'px-3 py-1 rounded-[16px] text-[12px] border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-hover)]'
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
      {hinweis && (
        <div
          className="mt-1.5 rounded px-2.5 py-1.5 text-[11px] leading-snug"
          style={{ background: 'color-mix(in srgb, var(--tf-warning, #f59e0b) 10%, var(--tf-bg))' }}
        >
          <p className="text-[var(--tf-text)]">
            Ihr laufendes Gespräch geht in der neuen Variante nicht weiter.
          </p>
          <p className="text-[var(--tf-text-secondary)] mt-0.5">
            Die Unterhaltung bleibt hier vollständig sichtbar, aber die KI antwortet ab jetzt aus
            einem anderen Chat und kennt die bisherigen Fragen nicht. Zurückschalten stellt den
            alten Stand wieder her — oder starten Sie ein neues Gespräch.
          </p>
        </div>
      )}
      {!compact && !nurSteuerung && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-1.5 leading-snug">
          Standard = klassische interne KI. Agentisch = agentische interne KI (Erprobung) — setzt einen
          „Agentischer Chat"-Tab in der KI-Oberfläche voraus.
        </p>
      )}
    </div>
  );
}
