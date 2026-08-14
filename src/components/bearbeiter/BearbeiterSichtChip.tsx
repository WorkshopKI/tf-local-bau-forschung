/**
 * Der **Bearbeiter-Sicht-Chip** im Kopf der Antragslisten und der Startseite:
 * meine Anträge oder die aller Bearbeiter.
 *
 * Schwester des `BereichChip` — beide beantworten dieselbe Frage („welchen
 * Ausschnitt sehe ich gerade?") für verschiedene Achsen und stehen deshalb
 * nebeneinander in einer Zeile. Er **erscheint in beiden Zuständen**: ein
 * Umschalter, der sich nach dem Umschalten versteckt, wäre eine Einbahnstraße,
 * und eine Liste, die still nur den eigenen Vorrat zeigt, liest sich wie der
 * ganze Bestand.
 *
 * Die **Beschriftung kommt aus `bearbeiterScopeLabel`**, derselben Quelle wie
 * die Meta-Zeilen der Startseiten-Widgets — Chip und Karte können so nicht
 * auseinanderlaufen.
 *
 * Vorgänger war die `BearbeiterFilterPill`, die den Zustand nur ANZEIGTE und in
 * die Einstellungen führte; dieser Weg lebt als Fußzeile des Popovers weiter.
 */
import { useState } from 'react';
import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';

export function BearbeiterSichtChip(): React.ReactElement | null {
  const { sicht, kannUmschalten, mode, eigeneTokens, setSicht } = useBearbeiterSicht();
  const navigate = useNavigate();
  const [offen, setOffen] = useState(false);

  // Feste Identität (MA-Login, prod): der Ausschnitt ist ans angemeldete Kürzel
  // gebunden. Der Chip nennt ihn weiterhin — ein Popover mit zwei toten Optionen
  // wäre ein Versprechen, das die Variante nicht halten kann.
  if (!kannUmschalten && mode.active) {
    return (
      <span
        title="Ihr Kürzel stammt aus der Anmeldung — der Ausschnitt ist daran gebunden."
        className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] shrink-0"
      >
        <User size={11} />
        <span>{bearbeiterScopeLabel(mode)}</span>
        {mode.includeBegleitung ? (
          <span style={{ color: 'var(--tf-primary)' }}>· inkl. Begleitung</span>
        ) : null}
      </span>
    );
  }

  const eigenesLabel = eigeneTokens.length > 0
    ? `Meine Anträge (${eigeneTokens.join(', ')})`
    : 'Meine Anträge';

  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={kannUmschalten
            ? 'Zwischen den eigenen Anträgen und dem Team-Bestand wechseln.'
            : 'Kein Bearbeiter-Kürzel gesetzt — Klick führt zu den Einstellungen.'}
          className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] transition-colors shrink-0"
        >
          <User size={11} />
          <span>{bearbeiterScopeLabel(mode)}</span>
          {mode.includeBegleitung ? (
            <span style={{ color: 'var(--tf-primary)' }}>· inkl. Begleitung</span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px]">
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            Wessen Anträge <strong>Listen, Zähler und Startseite</strong> zeigen. Ihr Kürzel
            bleibt dabei stehen — die Wahl gilt nur für diesen Rechner.
          </p>

          <div className="flex flex-wrap gap-1.5">
            <ToggleChip
              label={eigenesLabel}
              selected={sicht === 'meine'}
              disabled={!kannUmschalten}
              title={kannUmschalten ? undefined : 'Erst ein Bearbeiter-Kürzel im Profil setzen.'}
              onToggle={() => { setSicht('meine'); setOffen(false); }}
            />
            <ToggleChip
              label="Alle Bearbeiter"
              selected={sicht === 'alle'}
              disabled={!kannUmschalten}
              title={kannUmschalten ? undefined : 'Ohne Kürzel sind ohnehin alle Anträge zu sehen.'}
              onToggle={() => { setSicht('alle'); setOffen(false); }}
            />
          </div>

          {!kannUmschalten && (
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              Ohne eigenes Kürzel gibt es nichts einzugrenzen — die Listen zeigen den
              ganzen Bestand.
            </p>
          )}

          <button
            type="button"
            onClick={() => { setOffen(false); navigate('/einstellungen'); }}
            className="text-left text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            Kürzel ändern → Einstellungen
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
