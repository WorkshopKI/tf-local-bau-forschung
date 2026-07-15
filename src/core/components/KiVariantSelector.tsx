import { useKiZiel } from '@/core/services/ai/ki-ziel';

/**
 * Auswahl der KI-Variante (global, `useKiZiel`): „Standard" (klassische interne KI,
 * Default) vs. „Agentisch" (agentische interne KI, Erprobung). Wird an allen
 * KI-Verbindungs-Stellen angeboten (Einstellungen, Sidebar-Indikator, Home-Karte,
 * Verbinden-Prompt). Die Wahl gilt für ALLE Läufe (Gutachten/Kurzfassung/NF/
 * Aufbereitung/Chat) über `aktivesZielFuerLauf`.
 */
export function KiVariantSelector({ compact = false }: { compact?: boolean } = {}): React.ReactElement {
  const ziel = useKiZiel(s => s.ziel);
  const setZiel = useKiZiel(s => s.setZiel);
  const OPTIONEN = [
    { value: 'standard', label: 'Standard' },
    { value: 'agentisch', label: 'Agentisch' },
  ] as const;

  return (
    <div>
      <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">KI-Variante</div>
      <div className="inline-flex gap-1.5 flex-wrap">
        {OPTIONEN.map(opt => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={ziel === opt.value}
            onClick={() => setZiel(opt.value)}
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
      {!compact && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-1.5 leading-snug">
          Standard = klassische interne KI. Agentisch = agentische interne KI (Erprobung) — setzt einen
          „Agentischer Chat"-Tab in der KI-Oberfläche voraus.
        </p>
      )}
    </div>
  );
}
