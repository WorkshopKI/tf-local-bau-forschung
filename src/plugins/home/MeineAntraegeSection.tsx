import { useEffect, useState } from 'react';
import { Badge, SectionHeader, ListItem } from '@/ui';
import { useNavigation } from '@/core/hooks/useNavigation';
import { getVbPhaseLabel, getVbPhaseVariant } from '@/core/utils/vb-phase-mappings';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
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
}

function formatDaysShort(deadline: string | undefined): string | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (Number.isNaN(diff)) return null;
  if (diff < 0) return `${diff}d`;
  return `+${diff}d`;
}

/**
 * Eigene Sektion auf der Home-Page, die ausschließlich die offenen Förderanträge
 * des Profils zeigt — gruppiert nach VB-Phase (badge prominent als Icon).
 *
 * Sichtbarkeit:
 * - Wird durch HomePage nur eingebunden, wenn `department !== 'bauantraege'`
 *   und der Bearbeiter-Filter aktiv ist und mindestens ein Antrag matched.
 */
export function MeineAntraegeSection({ antraege, initialCount, bearbeiterTokens }: Props): React.ReactElement | null {
  const { navigate } = useNavigation();
  const [visibleCount, setVisibleCount] = useState(initialCount);

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

  return (
    <div className="mb-6">
      <SectionHeader
        label="Meine Anträge"
        action={
          <button
            onClick={() => navigate('antraege')}
            className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            Alle →
          </button>
        }
      />
      <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-2 -mt-1">
        Anträge mit Ihrem Kürzel <span className="font-mono">{bearbeiterTokens.join(', ')}</span>, sortiert nach Frist · Verbünde als ein Eintrag
      </p>
      {visible.map((v, i) => {
        const phaseLabel = getVbPhaseLabel(v.vb_phase);
        const daysFmt = formatDaysShort(v.deadline);
        const isVerbund = (v.tv_count ?? 1) > 1;
        // Verbund-Titel (VB_TITEL aus dem Verbund-Store) bevorzugt — konsistent
        // fuer Verbund-Cluster (gleich fuer alle TVs) und Einzelprojekte (dort
        // typischerweise identisch zum TV-Titel). Fallback auf TV-Titel wenn
        // verbund_titel nicht gepflegt ist.
        const baseTitle = v.verbund_titel ?? v.title;
        // splitTitle erkennt das Pattern "${akronym} / ${rest}" im Titel und
        // splittet das Akronym ab (bold-Rendering). Wenn der Verbund-Titel
        // OHNE Akronym-Praefix gepflegt ist (Normalfall bei VB_TITEL), prefixen
        // wir das Akronym manuell aus dem CSV-Feld — sonst geht es in der
        // Anzeige verloren.
        const split = splitTitle(baseTitle, v.acronym);
        const displayAcronym = split.acronym ?? (v.acronym?.trim() || null);
        const titleNode = displayAcronym ? (
          <span className="truncate">
            <span className="font-medium text-[var(--tf-text)]">{displayAcronym}</span>
            <span className="text-[var(--tf-text-secondary)]"> / {split.rest}</span>
          </span>
        ) : (
          <span className="truncate text-[var(--tf-text-secondary)]">{split.rest}</span>
        );
        // Subtitle: Aktenzeichen + "+N TV"-Suffix bei Verbund-Clustern.
        // N = Anzahl weiterer TVs (= tv_count − 1).
        const subtitleText = isVerbund
          ? `${v.id} · +${(v.tv_count ?? 1) - 1} TV`
          : v.id;
        return (
          <ListItem
            key={v.id}
            iconBare
            icon={
              phaseLabel ? (
                <Badge variant={getVbPhaseVariant(v.vb_phase)}>{phaseLabel}</Badge>
              ) : (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--tf-text-tertiary)] opacity-40" />
              )
            }
            title={titleNode}
            titleClassName="text-[13px] truncate"
            subtitle={subtitleText}
            subtitleClassName="text-[11px] font-mono text-[var(--tf-text-tertiary)] truncate"
            meta={
              <>
                {daysFmt ? (
                  <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums font-mono">
                    {daysFmt}
                  </span>
                ) : null}
                <Badge variant={getStatusVariant(v.status)}>{getStatusLabel(v.status)}</Badge>
              </>
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
