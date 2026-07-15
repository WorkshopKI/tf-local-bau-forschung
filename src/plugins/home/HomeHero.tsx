/**
 * Hero-Band der Startseite („Home optimiert", Design-Handoff homepage-optimiert).
 *
 * Fixes Element (KEIN konfigurierbares Widget — analog Begrüßung /
 * ProgrammeOverviewCards): der morgendliche Arbeitseinstieg. Zwei Karten:
 *  1. Resume-Karte „Weiter, wo du aufgehört hast" — jüngster Arbeitskontext
 *     (reuse `useWeitermachenRows`, ersetzt das gleichnamige Widget im Default).
 *  2. Alert-Karte „Braucht heute Aufmerksamkeit" — drei klickbare Chips:
 *     kritisch / nähern sich (aus den Ampel-Aggregaten) + QS-Freigaben offen
 *     (geteilter `useQsFreigaben`-Hook → gleiche Zahl wie das QS-Widget).
 *
 * Navigation kommt als Callbacks aus HomePage (dieselbe Filter-Logik wie das
 * Antragseingang-Widget: setActiveView + setAmpelQuickfilter). Flach ohne
 * Farbverlauf/Deko-Schatten (DESIGN_GUIDE), Gewicht 500.
 */
import { Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AmpelBucket } from '@/plugins/antraege/eingangAmpel';
import { useWeitermachenRows } from './WeitermachenSection';
import { relativeZeit } from './arbeitskontext-anzeige';
import { useQsFreigaben } from './widgets/useQsFreigaben';
import type { EingangAmpelCounts } from './useEingangAmpelCounts';

const fmt = (n: number): string => n.toLocaleString('de-DE');

export interface HomeHeroProps {
  counts: EingangAmpelCounts;
  /** Öffnet die gefilterte Antragsliste für einen Ampel-Bucket (kritisch/warnung). */
  onOpenBucket: (bucket: AmpelBucket) => void;
  /** Öffnet die Anträge-/Artefakt-Oberfläche (QS-Freigaben). */
  onOpenQs: () => void;
}

export function HomeHero({ counts, onOpenBucket, onOpenQs }: HomeHeroProps): React.ReactElement | null {
  const navigate = useNavigate();
  const resume = useWeitermachenRows()[0] ?? null;
  const { zeilen: qsZeilen } = useQsFreigaben(true);
  const qsCount = qsZeilen.length;

  // Nichts anzuzeigen → Band ganz ausblenden. (HomePage rendert den Hero ohnehin
  // nur bei stats.total > 0; dieser Guard deckt „alles frisch, kein Kontext" ab.)
  if (!resume && counts.kritisch === 0 && counts.warnung === 0 && qsCount === 0) return null;

  return (
    <div className={`grid gap-3.5 ${resume ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
      {resume ? (
        <button
          type="button"
          onClick={() => navigate(resume.target)}
          className="text-left rounded-[var(--tf-radius-lg)] bg-[var(--tf-card-surface)] px-[17px] py-[15px] transition-colors hover:border-[var(--tf-border-hover)] cursor-pointer min-w-0"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--tf-text-tertiary)]">
            <Clock size={13} className="shrink-0" /> Weiter, wo du aufgehört hast
          </div>
          <div className="mt-2 text-[15px] font-medium text-[var(--tf-text)] truncate">
            {resume.anzeige.akronym}
          </div>
          <div className="mt-0.5 text-[12.5px] text-[var(--tf-text-secondary)] truncate">
            {resume.anzeige.kontext}
          </div>
          <div className="mt-0.5 text-[11.5px] tabular-nums text-[var(--tf-text-tertiary)] truncate">
            {relativeZeit(resume.anzeige.ts)} · <span className="font-mono">{resume.anzeige.fkz}</span>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--tf-primary)]">
            Weiter <ArrowRight size={14} />
          </span>
        </button>
      ) : null}

      <div
        className="rounded-[var(--tf-radius-lg)] bg-[var(--tf-card-surface)] px-[17px] py-[15px] min-w-0"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--tf-text-tertiary)]">
          Braucht heute Aufmerksamkeit
        </div>
        <div className="mt-3 flex gap-2">
          <HeroChip
            n={counts.kritisch}
            label="über 90-Tage-Frist"
            color="var(--tf-danger-text)"
            onClick={() => onOpenBucket('kritisch')}
          />
          <HeroChip
            n={counts.warnung}
            label="nähern sich"
            color="var(--tf-warning-text)"
            onClick={() => onOpenBucket('warnung')}
          />
          <HeroChip
            n={qsCount}
            label="QS-Freigaben offen"
            color="var(--tf-primary)"
            onClick={onOpenQs}
          />
        </div>
      </div>
    </div>
  );
}

interface HeroChipProps {
  n: number;
  label: string;
  color: string;
  onClick: () => void;
}

function HeroChip({ n, label, color, onClick }: HeroChipProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 flex flex-col items-start gap-0.5 rounded-[10px] bg-[var(--tf-bg)] px-[11px] py-2.5 transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-[var(--tf-border-hover)] cursor-pointer"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="text-[19px] font-medium tabular-nums leading-none" style={{ color }}>
        {fmt(n)}
      </span>
      <span className="text-[10.5px] leading-tight text-[var(--tf-text-secondary)] text-left">
        {label}
      </span>
    </button>
  );
}
