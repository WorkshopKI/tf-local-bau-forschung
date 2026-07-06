import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ListItem } from '@/components/ui/ListItem';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { getEingangAmpel, daysSinceEingang, AMPEL_COLOR, AMPEL_TOOLTIP } from '@/plugins/antraege/eingangAmpel';
import { naechsterSchritt } from '@/core/utils/naechsterSchritt';
import type { AntragVorgang } from './useDashboardData';

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

interface Props {
  /** Alle offenen eigenen Förderanträge, bereits sortiert (Frist asc → VB-Phase asc). */
  antraege: AntragVorgang[];
  /** Initiale Anzahl angezeigter Anträge (aus Profil, gelampt 5–15). */
  initialCount: number;
  /** Aktive Bearbeiter-Filter-Tokens (uppercase). Für den Help-Text. */
  bearbeiterTokens: string[];
  /** „alle"-/Übersichtsmodus (pl/dev): Titel „Alle Anträge" + MA-Kürzel je Zeile. */
  alleMode?: boolean;
}

/**
 * Eigene Sektion auf der Home-Page, die ausschließlich die offenen Förderanträge
 * des Profils zeigt — als Handlungs-Zeile „Phase → nächster Schritt".
 *
 * Sichtbarkeit:
 * - Wird durch HomePage nur eingebunden, wenn der Bearbeiter-Filter aktiv ist
 *   und mindestens ein Antrag matched.
 */
export function MeineAntraegeSection({ antraege, initialCount, bearbeiterTokens, alleMode = false }: Props): React.ReactElement | null {
  const { navigate } = useNavigation();
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [open, toggleOpen] = useCollapsedSection('home_meine_antraege_collapsed');

  // Wenn der Profil-Wert ändert (User passt im Einstellungs-Tab an), setzen
  // wir die in-page-Expansion zurück auf den neuen Initialwert.
  useEffect(() => {
    setVisibleCount(initialCount);
  }, [initialCount]);

  if (antraege.length === 0) return null;

  const visible = antraege.slice(0, visibleCount);
  const hasMore = antraege.length > visibleCount;
  const remaining = antraege.length - visibleCount;
  const nextChunk = Math.min(10, remaining);

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

  return (
    <div className="mb-6">
      <SectionHeader
        label={alleMode ? 'Alle Anträge' : 'Meine Anträge'}
        collapsible
        collapsed={!open}
        onToggleCollapsed={toggleOpen}
        action={
          <button
            onClick={handleAlle}
            className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            Alle →
          </button>
        }
      />
      <div
        className="grid transition-[grid-template-rows] ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', transitionDuration: 'var(--tf-duration-med)' }}
      >
        <div className="overflow-hidden">
      <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-2 -mt-1">
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
      </div>
    </div>
  );
}
