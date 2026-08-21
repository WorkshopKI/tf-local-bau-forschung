import { useKiZiel } from '@/core/services/ai/ki-ziel';
import { getLlmContextTokens } from '@/core/services/ai/llm-context';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';

/**
 * Auswahl des Modells der internen KI (global, `useKiZiel`): **gpt-oss-120b**
 * (schnell, kleines Fenster) vs. **Qwen3.6-35B** (grosses Fenster). Die Wahl gilt
 * für ALLE Läufe (Gutachten/Kurzfassung/NF/Aufbereitung/Chat/Assistent) über
 * `aktivesZielFuerLauf`.
 *
 * **Die Wahl ist eine Untergrenze, keine Festlegung.** Passt der Umfang eines
 * Laufs nicht in das gewählte Fenster, hebt ihn `waehleModellFuerUmfang`
 * ([modell-wahl.ts](@/core/services/ai/modell-wahl)) selbst auf Qwen3.6 an und
 * sagt es am Lauf. Nach unten korrigiert nie jemand.
 *
 * **Der agentische Chat steht sichtbar, aber gesperrt** — nicht aus Bequemlichkeit,
 * sondern weil er eine Aussage trägt: es gibt ihn, wir nutzen ihn nicht. Er ist
 * Qwen3.6 **plus fest eingebautem Kontext**, und genau diesen Kontext stellt diese
 * App bewusst selbst zusammen. Ihn wegzulassen liesse die Frage offen, warum der
 * dritte Eintrag der KI-Oberfläche hier fehlt.
 *
 * Kein Wechsel-Hinweis mehr (bis v4 stand hier einer): der Verlauf liegt in der
 * serverseitigen Sitzung der KI-Seite und überlebt einen Modellwechsel — die
 * Warnung wäre ab jetzt schlicht falsch.
 *
 * Drei Stufen: voll (Label + Chips + Erklärung), `compact` (ohne Erklärung) und
 * `nurSteuerung` (nur die Chips). Letzteres für Wirte, die Label und Erklärung
 * selbst mitbringen — die `SettingsOption` der Einstellungen tut das.
 */

interface ModellOption {
  value: BridgeZiel;
  label: string;
}

const OPTIONEN: readonly ModellOption[] = [
  { value: 'gpt-oss', label: 'gpt-oss-120b' },
  { value: 'qwen35', label: 'Qwen3.6-35B' },
];

const AGENTISCH_GRUND =
  'Nicht angebunden: der agentische Chat ist Qwen3.6 mit eigenem, fest eingebautem Kontext — den stellt diese App selbst zusammen.';

/**
 * Fenstergrösse als Kurzangabe („62k"), damit die Wahl eine Grundlage hat.
 *
 * **Immer `bridge: true`**, auch wenn gerade ein lokales LLM eingestellt ist: die
 * Zahl beschreibt das MODELL, und dessen Fenster hängt nicht daran, welcher
 * Provider im Moment aktiv ist. Mit `bridge: bridgeAktiv` fiel die Rechnung sonst
 * auf den lokalen Kontextwert zurück — und beide Chips zeigten dieselbe Zahl
 * (82k), was die Auswahl zur Behauptung ohne Unterschied machte.
 */
function fensterKurz(ziel: BridgeZiel): string {
  const tokens = getLlmContextTokens({ bridge: true, ziel });
  return `${Math.round(tokens / 1000)}k`;
}

export function KiModellSelector({
  compact = false,
  nurSteuerung = false,
}: { compact?: boolean; nurSteuerung?: boolean } = {}): React.ReactElement {
  const ziel = useKiZiel(s => s.ziel);
  const setZiel = useKiZiel(s => s.setZiel);

  return (
    <div className={nurSteuerung ? 'max-w-[280px]' : undefined}>
      {!nurSteuerung && (
        <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">Modell der internen KI</div>
      )}
      <div className="inline-flex gap-1.5 flex-wrap">
        {OPTIONEN.map(opt => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={ziel === opt.value}
            onClick={() => setZiel(opt.value)}
            title={`Kontextfenster ${fensterKurz(opt.value)} Tokens`}
            className={
              ziel === opt.value
                ? 'px-3 py-1 rounded-[16px] text-[12px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
                : 'px-3 py-1 rounded-[16px] text-[12px] border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-hover)]'
            }
          >
            <span>{opt.label}</span>
            <span className="ml-1.5 text-[10.5px] opacity-70">{fensterKurz(opt.value)}</span>
          </button>
        ))}
        <button
          type="button"
          disabled
          aria-disabled
          title={AGENTISCH_GRUND}
          // „Inaktiv" trägt hier die RAHMENFORM (gestrichelt) + der Cursor, nicht
          // die Blässe: mit `text-tertiary` und `opacity-60` mass der Chip 1,71:1
          // und war damit praktisch unlesbar — ausgerechnet der Eintrag, dessen
          // ganzer Zweck es ist, gelesen zu werden.
          className="px-3 py-1 rounded-[16px] text-[12px] border-[0.5px] border-dashed border-[var(--tf-border)] text-[var(--tf-text-secondary)] cursor-not-allowed"
        >
          Agentischer Chat
        </button>
      </div>
      {!compact && !nurSteuerung && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-1.5 leading-snug">
          Passt ein Dokument nicht in das gewählte Fenster, wechselt die App für diesen Lauf selbst
          auf Qwen3.6 und vermerkt es. {AGENTISCH_GRUND}
        </p>
      )}
    </div>
  );
}
