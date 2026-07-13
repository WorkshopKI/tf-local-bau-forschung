import { useEffect, useState } from 'react';
import { ArrowRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/ListItem';
import { useNavigation } from '@/core/hooks/useNavigation';
import { isKuerzelDropdownEnabled } from '@/config/feature-flags';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { getEingangAmpel, daysSinceEingang, AMPEL_COLOR, AMPEL_TOOLTIP } from '@/plugins/antraege/eingangAmpel';
import { naechsterSchritt } from '@/core/utils/naechsterSchritt';
import type { AntragVorgang } from './useDashboardData';
import { MeineAntraegeBalken } from './MeineAntraegeBalken';
import { WidgetShell } from './widgets/WidgetShell';
import type { WidgetProps } from './widgets/widgetProps';

/**
 * Spaltet den Title-String in Akronym-Prefix (falls vorhanden + im Title) und
 * den Rest. Wenn der Title mit dem Akronym + " / " beginnt, wird das Akronym
 * separat zurückgegeben. Sonst wird das Akronym nicht aus dem Title entfernt
 * (Fallback: ganzer Title als rest, kein bolder Prefix).
 */
function splitTitle(title: string, acronym: string | undefined): { acronym: string | null; rest: string } {
  if (!acronym) return { acronym: null, rest: title };
  const trimmedAcr = acronym.trim();
  if (trimmedAcr.length === 0) return { acronym: null, rest: title };
  // Match "{acronym} / rest" — Akronym am Anfang gefolgt von optionalem
  // Whitespace, einem Slash, weiterem Whitespace, dann der Rest.
  const escaped = trimmedAcr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\s*/\\s*(.+)$`, 'i');
  const m = title.match(re);
  if (m && m[1]) return { acronym: trimmedAcr, rest: m[1] };
  return { acronym: null, rest: title };
}

/**
 * „Meine Anträge"-Widget (Home, Hauptbereich): offene eigene Förderanträge als
 * Handlungs-Zeile „Phase → nächster Schritt". Trägt seine drei Zustände selbst
 * (früher eine IIFE in HomePage): Kürzel-Onboarding-Karte, Empty-State,
 * Rückstands-Balken + Liste. Collapse lebt in der Widget-Config (Shell);
 * `visibleCount` lebt HIER (überlebt Ein-/Ausklappen, Body ist lazy).
 */
export function MeineAntraegeWidget({ instanz, ctx, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const { navigate } = useNavigation();
  const { data, initialCount } = ctx;
  const antraege = data.meineAntraege;
  const alleMode = !data.bearbeiterFilterActive;
  const [visibleCount, setVisibleCount] = useState(initialCount);

  // Wenn der Profil-Wert ändert (User passt im Einstellungs-Tab an), setzen
  // wir die in-page-Expansion zurück auf den neuen Initialwert.
  useEffect(() => {
    setVisibleCount(initialCount);
  }, [initialCount]);

  // v2.3: "Alle →" springt zu /antraege mit View "Offen" + Sort nach Frist
  // — sonst zeigt die Foerderantraege-Seite eine andere View/Sortierung als
  // die Home-Liste, was Verwirrung stiftete. Bearbeiter-Filter ist via
  // profile.bearbeiter_kuerzel sowieso automatisch aktiv.
  const handleAlle = (): void => {
    const store = useAntraegeStore.getState();
    store.setActiveView('meine_offenen');
    store.setSortForView('meine_offenen', 'frist_asc');
    navigate('antraege');
  };

  const zeigtListe = !(alleMode && !isKuerzelDropdownEnabled()) && antraege.length > 0;

  // Modus sichtbar in der Meta-Zeile (v1.1): „Kürzel THU" vs. „Alle Bearbeiter"
  // — ersetzt den früheren Titel-Swap; der Titel bleibt fix „Meine Anträge".
  const scopeLabel = bearbeiterScopeLabel({
    active: data.bearbeiterFilterActive,
    tokens: data.bearbeiterTokens,
    includeBegleitung: false,
  });

  return (
    <WidgetShell
      titel="Meine Anträge"
      meta={zeigtListe ? `${scopeLabel} · Sortierung: Frist · ${Math.min(visibleCount, antraege.length)} sichtbar` : undefined}
      variante="haupt"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      aktion={
        zeigtListe ? (
          <button
            onClick={handleAlle}
            className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            Alle →
          </button>
        ) : undefined
      }
      zaehler={
        zeigtListe ? (
          <span className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]">
            {Math.min(visibleCount, antraege.length)} von {antraege.length}
          </span>
        ) : undefined
      }
    >
      {alleMode && !isKuerzelDropdownEnabled() ? (
        <KuerzelOnboardingKarte />
      ) : antraege.length === 0 ? (
        <EmptyKarte alleMode={alleMode} bearbeiterTokens={data.bearbeiterTokens} />
      ) : (
        <>
          {/* Rückstands-Balken: eigene offene Anträge nach Quartals-Alter
              (Ab Q-3 · Q-2 · Q-1 · akt. Quartal) mit Hover-Detail. */}
          <MeineAntraegeBalken antraege={antraege} />
          <MeineAntraegeListe
            antraege={antraege}
            visibleCount={visibleCount}
            setVisibleCount={setVisibleCount}
            bearbeiterTokens={data.bearbeiterTokens}
            alleMode={alleMode}
          />
        </>
      )}
    </WidgetShell>
  );
}

/** Onboarding-Karte: Bearbeiter-Kürzel noch nicht gesetzt (Varianten ohne
 *  Kürzel-Dropdown). Früher direkt in HomePage. */
function KuerzelOnboardingKarte(): React.ReactElement {
  const { navigate } = useNavigation();
  return (
    <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-5">
      <div className="flex items-start gap-3">
        <Settings size={18} className="mt-0.5 text-[var(--tf-text-secondary)] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[var(--tf-text)] mb-1">
            Ihr Bearbeiter-Kürzel ist noch nicht gesetzt
          </p>
          <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-snug mb-3">
            Tragen Sie in den Einstellungen Ihr Namenskürzel ein
            (z.B. <span className="font-mono">MUE</span>), damit hier automatisch
            Ihre offenen Anträge erscheinen.
          </p>
          <Button variant="secondary" size="sm" icon={ArrowRight} onClick={() => navigate('einstellungen')}>
            Zu den Einstellungen
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Empty-State: Kürzel aktiv (oder „alle"-Übersicht), aber 0 offene Treffer.
 *  Früher direkt in HomePage. */
function EmptyKarte({ alleMode, bearbeiterTokens }: { alleMode: boolean; bearbeiterTokens: string[] }): React.ReactElement {
  const { navigate } = useNavigation();
  return (
    <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-5">
      <p className="text-[14px] font-medium text-[var(--tf-text)] mb-1">
        {alleMode ? (
          'Keine offenen Anträge'
        ) : (
          <>Keine offenen Anträge für Kürzel{' '}<span className="font-mono">{bearbeiterTokens.join(', ')}</span></>
        )}
      </p>
      <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-snug mb-3">
        {alleMode
          ? 'Aktuell sind keine offenen Förderanträge erfasst. In der Förderanträge-Liste können Sie alle Vorgänge einsehen.'
          : 'Aktuell sind keine offenen Förderanträge auf Sie zugeordnet. In der Förderanträge-Liste können Sie alle Vorgänge einsehen.'}
      </p>
      <Button variant="secondary" size="sm" icon={ArrowRight} onClick={() => navigate('antraege')}>
        Alle Förderanträge öffnen
      </Button>
    </div>
  );
}

interface ListeProps {
  /** Alle offenen eigenen Förderanträge, bereits sortiert (Frist asc → VB-Phase asc). */
  antraege: AntragVorgang[];
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  /** Aktive Bearbeiter-Filter-Tokens (uppercase). Für den Help-Text. */
  bearbeiterTokens: string[];
  /** „alle"-/Übersichtsmodus (pl/dev): MA-Kürzel je Zeile. */
  alleMode: boolean;
}

/** Listen-Body (Inhalte pixel-identisch zur früheren Sektion; Header/Collapse
 *  liegen jetzt in der WidgetShell). */
function MeineAntraegeListe({ antraege, visibleCount, setVisibleCount, bearbeiterTokens, alleMode }: ListeProps): React.ReactElement {
  const { navigate } = useNavigation();
  const visible = antraege.slice(0, visibleCount);
  const hasMore = antraege.length > visibleCount;
  const remaining = antraege.length - visibleCount;
  const nextChunk = Math.min(10, remaining);

  return (
    <div>
      <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-2">
        {alleMode ? (
          'Offene Anträge aller aktiven MAs, sortiert nach Frist · Verbünde als ein Eintrag'
        ) : (
          <>Anträge mit Ihrem Kürzel <span className="font-mono">{bearbeiterTokens.join(', ')}</span>, sortiert nach Frist · Verbünde als ein Eintrag</>
        )}
      </p>
      {visible.map((v, i) => {
        // Verbund-Titel (VB_TITEL) bevorzugt, sonst TV-Titel; Akronym daraus
        // ableiten (Pattern „${akronym} / ${rest}") bzw. aus dem CSV-Feld.
        const baseTitle = v.verbund_titel ?? v.title;
        const split = splitTitle(baseTitle, v.acronym);
        // Primär-Label: Akronym (bevorzugt), sonst der (Verbund-)Titel.
        const displayLabel = split.acronym ?? (v.acronym?.trim() || null) ?? split.rest;

        // Ampel-Punkt + Eingangsalter aus demselben Datum (antragsdatum) — der
        // Punkt spiegelt die Eingangs-Ampel, „vor N T" das Eingangsalter.
        const ampel = getEingangAmpel(v);
        const ageDays = daysSinceEingang(v);
        const ageLabel = ageDays !== null && ageDays >= 0 ? `vor ${ageDays} T` : null;

        // Handlungs-Formel „Phase → Aktion" statt Status-Badge (inkl. PreCheck-Stand).
        // `?? ''` = PreCheck-Kontext bewusst opt-in (leer ⇒ „PreCheck nicht vorhanden").
        const sr = naechsterSchritt(v.status, v.precheck_status_label ?? '');
        const schrittText = sr ? (sr.aktion ? `${sr.phase} → ${sr.aktion}` : sr.phase) : '';

        const dot = ampel ? (
          <span
            className="block w-2 h-2 rounded-full"
            style={{ background: AMPEL_COLOR[ampel] }}
            title={AMPEL_TOOLTIP[ampel]}
            aria-hidden="true"
          />
        ) : (
          <span className="block w-2 h-2 rounded-full bg-[var(--tf-text-tertiary)] opacity-40" aria-hidden="true" />
        );

        return (
          <ListItem
            key={v.id}
            iconBare
            icon={dot}
            title={
              <span className="flex items-baseline gap-2 w-full min-w-0">
                <span className="font-medium text-[var(--tf-text)] shrink-0 max-w-[55%] truncate">{displayLabel}</span>
                {schrittText ? (
                  <span className="text-[var(--tf-text-secondary)] truncate min-w-0 flex-1">{schrittText}</span>
                ) : null}
              </span>
            }
            titleClassName="text-[13px] min-w-0"
            meta={
              ageLabel ? (
                <span className="text-[11px] tabular-nums text-[var(--tf-text-tertiary)] whitespace-nowrap">
                  {ageLabel}
                </span>
              ) : undefined
            }
            onClick={() => navigate('antraege', { selectedId: v.id })}
            last={i === visible.length - 1}
          />
        );
      })}
      {hasMore ? (
        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={() => setVisibleCount(c => Math.min(antraege.length, c + 10))}
            className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            +{nextChunk} mehr anzeigen
          </button>
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">
            {visibleCount} von {antraege.length}
          </span>
        </div>
      ) : null}
    </div>
  );
}
