import { useEffect, useState } from 'react';
import { Badge, SectionHeader, ListItem } from '@/ui';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { getVbPhaseLabel, getVbPhaseVariant } from '@/core/utils/vb-phase-mappings';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { XswSuffix } from '@/plugins/antraege/XswSuffix';
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

type FristTone = 'overdue' | 'urgent' | 'normal';

interface FristLabel {
  /** Sprachlicher Kurz-Text: "vor 189d", "in 6d", "heute". */
  label: string;
  tone: FristTone;
  /** ISO-Date der Frist; wird im Tooltip absolut ausgegeben. */
  iso: string;
}

/**
 * Bildet die phasen-abhängige Frist auf ein sprachliches Kurz-Label ab.
 * Ohne Vorzeichen-Magie: "vor X d" für Vergangenheit, "in X d" für Zukunft,
 * "heute" für diff=0. Tone steuert die Farb-Zuordnung im Render.
 */
function formatDaysShort(deadline: string | undefined): FristLabel | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (Number.isNaN(diff)) return null;
  if (diff === 0) return { label: 'heute', tone: 'urgent', iso: deadline };
  if (diff < 0) return { label: `vor ${-diff}d`, tone: 'overdue', iso: deadline };
  if (diff <= 7) return { label: `in ${diff}d`, tone: 'urgent', iso: deadline };
  return { label: `in ${diff}d`, tone: 'normal', iso: deadline };
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
        label="Meine Anträge"
        action={
          <button
            onClick={handleAlle}
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
        const frist = formatDaysShort(v.deadline);
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
          <span className="truncate min-w-0">
            <span className="font-medium text-[var(--tf-text)]">{displayAcronym}</span>
            <span className="text-[var(--tf-text-secondary)]"> / {split.rest}</span>
          </span>
        ) : (
          <span className="truncate min-w-0 text-[var(--tf-text-secondary)]">{split.rest}</span>
        );
        // Subtitle: Aktenzeichen + "+N TV"-Suffix bei Verbund-Clustern.
        // N = Anzahl weiterer TVs (= tv_count − 1).
        const subtitleText = isVerbund
          ? `${v.id} · +${(v.tv_count ?? 1) - 1} TV`
          : v.id;
        // Frist + FuE-Phase als kombinierter Icon-Slot links vor dem Antrag.
        // Frist mit fixer Breite, damit die Akronyme vertikal aligniert bleiben.
        // Tone bestimmt die Farbe: rot/medium für ueberfaellig, amber/medium
        // fuer "diese Woche" (heute oder in <=7d), grau/regular fuer alles
        // darueber. Tooltip zeigt das absolute Frist-Datum.
        const fristToneClass =
          frist?.tone === 'overdue'
            ? 'text-[var(--tf-danger-text)] font-medium'
            : frist?.tone === 'urgent'
              ? 'text-[var(--tf-warning-text)] font-medium'
              : 'text-[var(--tf-text-tertiary)]';
        const iconNode = (
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 w-[68px] text-right text-[11px] tabular-nums ${fristToneClass}`}
              title={frist ? `Frist: ${new Date(frist.iso).toLocaleDateString('de-DE')}` : undefined}
            >
              {frist?.label ?? ''}
            </span>
            {phaseLabel ? (
              <Badge variant={getVbPhaseVariant(v.vb_phase)}>{phaseLabel}</Badge>
            ) : (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--tf-text-tertiary)] opacity-40" />
            )}
          </div>
        );
        return (
          <ListItem
            key={v.id}
            iconBare
            icon={iconNode}
            title={<>{titleNode}<XswSuffix value={v.t_xsw} className="shrink-0 max-w-[40%] truncate" /></>}
            titleClassName="text-[13px] flex items-baseline gap-1 min-w-0"
            subtitle={subtitleText}
            subtitleClassName="text-[11px] font-mono text-[var(--tf-text-tertiary)] truncate"
            meta={<Badge variant={getStatusVariant(v.status)}>{getStatusLabel(v.status)}</Badge>}
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
