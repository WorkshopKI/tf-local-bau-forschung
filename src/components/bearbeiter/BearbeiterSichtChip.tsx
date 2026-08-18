/**
 * Der **Bearbeiter-Sicht-Chip** im Kopf der Antragslisten und der Startseite:
 * meine Anträge oder die aller Bearbeiter.
 *
 * Schwester des `BereichChip` — beide beantworten dieselbe Frage („welchen
 * Ausschnitt sehe ich gerade?") für verschiedene Achsen. Im Förderanträge-Kopf
 * stehen sie nebeneinander; auf der Startseite steht dieser hier allein neben
 * der Begrüßung (der Bereich wird dort gewechselt, wo die Liste an ihm hängt).
 * Er **erscheint in beiden Zuständen**: ein Umschalter, der sich nach dem
 * Umschalten versteckt, wäre eine Einbahnstraße, und eine Liste, die still nur
 * den eigenen Vorrat zeigt, liest sich wie der ganze Bestand.
 *
 * Die **Beschriftung kommt aus `bearbeiterScopeLabel`**, derselben Quelle wie
 * die Meta-Zeilen der Startseiten-Widgets — Chip und Karte können so nicht
 * auseinanderlaufen.
 *
 * Vorgänger war die `BearbeiterFilterPill`, die den Zustand nur ANZEIGTE und in
 * die Einstellungen führte; dieser Weg lebt als Fußzeile des Popovers weiter.
 */
import { useState } from 'react';
import { User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { useAntraegeStore } from '@/plugins/antraege/store';

export function BearbeiterSichtChip(): React.ReactElement | null {
  const { sicht, kannUmschalten, ausFrage, mode, eigeneTokens, setSicht } = useBearbeiterSicht();
  const setFrageKuerzel = useAntraegeStore(s => s.setFrageKuerzel);
  const navigate = useNavigate();
  const [offen, setOffen] = useState(false);

  // Ausschnitt aus einer Frage („für Bearbeiter THÜ"): eigener Chip mit
  // Rückweg. Ihn wie die eigene Sicht aussehen zu lassen wäre die Liste, die
  // stumm den halben Bestand ausblendet — und die Umschalt-Optionen darunter
  // beschrieben eine Wahl, die gerade gar nicht gilt (Pitfall #46).
  if (ausFrage) {
    return (
      <button
        type="button"
        onClick={() => setFrageKuerzel(null)}
        title="Der Ausschnitt kommt aus Ihrer Frage. Klick nimmt ihn zurück."
        className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] transition-colors shrink-0"
      >
        <User size={11} />
        <span>{bearbeiterScopeLabel(mode)}</span>
        <span className="text-[var(--tf-text-tertiary)]">· aus der Frage</span>
        <X size={11} />
      </button>
    );
  }

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
        {/* Bewusst ohne Erklärtext über den Optionen: die zwei Beschriftungen
            sagen bereits, was sie tun, und der Satz davor behauptete zudem,
            das Kürzel „bleibe stehen" — sichtbar bleibt es aber nur hier in
            der Option, nicht am Chip. Was der Leser nicht sehen kann (Reichweite
            + Gerätebindung), steht als eine Zeile darunter. */}
        <div className="flex flex-col gap-2">
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

          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            {kannUmschalten
              ? 'Gilt für Listen und Zähler — nur auf diesem Rechner.'
              : 'Ohne eigenes Kürzel zeigen die Listen den ganzen Bestand.'}
          </p>

          {/* Mit `?sektion=` statt nackt auf die Seite: der Hub scrollt die
              Karte „Welche Anträge du siehst" an und lässt ihre Markierung
              stehen, bis der Nutzer das nächste Mal klickt — derselbe Weg, den
              die Einstellungs-Suche nimmt (SettingsHubPage). Ohne ihn landet
              man auf einer Seite mit acht Karten und sucht die gemeinte. */}
          <button
            type="button"
            onClick={() => { setOffen(false); navigate('/einstellungen?sektion=sec-filter'); }}
            className="text-left text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            Kürzel ändern → Einstellungen
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
