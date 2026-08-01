/**
 * Hero-Band der Startseite („Home optimiert", Design-Handoff homepage-optimiert).
 *
 * Fixes Element (KEIN konfigurierbares Widget — analog Begrüßung /
 * ProgrammeOverviewCards): der morgendliche Arbeitseinstieg. Zwei Karten:
 *  1. Resume-Karte „Weiter, wo du aufgehört hast" — jüngster Arbeitskontext
 *     (reuse `useWeitermachenRows`, ersetzt das gleichnamige Widget im Default).
 *  2. Alert-Karte „Braucht heute Aufmerksamkeit" — bis zu drei klickbare Chips:
 *     kritisch / nähern sich (aus den Ampel-Aggregaten) + QS-Freigaben offen
 *     (geteilter `useQsFreigaben`-Hook → gleiche Zahl wie das QS-Widget).
 *
 * Chips mit Zähler 0 werden NICHT gerendert, und ohne Chip entfällt die ganze
 * Karte: unter der Überschrift „Braucht heute Aufmerksamkeit" ist eine 0 keine
 * Information, sondern ein Klickziel, das nichts zeigt (bis v2.371 führte die
 * QS-Kachel bei 0 in die ungefilterte Antragsliste).
 *
 * Navigation kommt als Callbacks aus HomePage (dieselbe Filter-Logik wie das
 * Antragseingang-Widget: setActiveView + setAmpelQuickfilter). Flach ohne
 * Farbverlauf/Deko-Schatten (DESIGN_GUIDE), Gewicht 500.
 */
import { Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AmpelBucket } from '@/plugins/antraege/eingangAmpel';
import { useWeitermachenRows } from './WeitermachenSection';
import { relativeZeitKurz } from '@/core/utils/relativeZeit';
import { useQsFreigaben } from './widgets/useQsFreigaben';
import { heroChipSichtbarkeit } from './heroChips';
import type { EingangAmpelCounts } from './useEingangAmpelCounts';

const fmt = (n: number): string => n.toLocaleString('de-DE');

export interface HomeHeroProps {
  counts: EingangAmpelCounts;
  /** Öffnet die gefilterte Antragsliste für einen Ampel-Bucket (kritisch/warnung). */
  onOpenBucket: (bucket: AmpelBucket) => void;
  /**
   * Öffnet die Anträge-/Artefakt-Oberfläche für einen offenen Entwurf. Die
   * `scopeId` ist der erste offene QS-Vorgang — eine QS-Listenseite, auf die
   * man filtern könnte, gibt es nicht (das QS-Widget springt genauso direkt
   * in den Vorgang).
   */
  onOpenQs: (scopeId: string) => void;
}

export function HomeHero({ counts, onOpenBucket, onOpenQs }: HomeHeroProps): React.ReactElement | null {
  const navigate = useNavigate();
  const resume = useWeitermachenRows()[0] ?? null;
  const { zeilen: qsZeilen } = useQsFreigaben(true);
  const qsCount = qsZeilen.length;
  const ersteQsScopeId = qsZeilen[0]?.scopeId;

  const chips = heroChipSichtbarkeit({
    kritisch: counts.kritisch,
    warnung: counts.warnung,
    qsCount,
    ersteQsScopeId,
  });

  // Nichts anzuzeigen → Band ganz ausblenden. (HomePage rendert den Hero ohnehin
  // nur bei stats.total > 0; dieser Guard deckt „alles frisch, kein Kontext" ab.)
  if (!resume && !chips.karte) return null;

  return (
    <div className={`grid gap-3.5 ${resume && chips.karte ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
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
            {relativeZeitKurz(resume.anzeige.ts)} · <span className="font-mono">{resume.anzeige.fkz}</span>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--tf-primary)]">
            Weiter <ArrowRight size={14} />
          </span>
        </button>
      ) : null}

      {chips.karte ? (
        <div
          className="rounded-[var(--tf-radius-lg)] bg-[var(--tf-card-surface)] px-[17px] py-[15px] min-w-0"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--tf-text-tertiary)]">
            Braucht heute Aufmerksamkeit
          </div>
          <div className="mt-3 flex gap-2">
            {chips.kritisch ? (
              <HeroChip
                n={counts.kritisch}
                label="über 90-Tage-Frist"
                color="var(--tf-danger-text)"
                onClick={() => onOpenBucket('kritisch')}
              />
            ) : null}
            {chips.warnung ? (
              <HeroChip
                n={counts.warnung}
                label="nähern sich"
                color="var(--tf-warning-text)"
                onClick={() => onOpenBucket('warnung')}
              />
            ) : null}
            {chips.qs && ersteQsScopeId !== undefined ? (
              <HeroChip
                n={qsCount}
                label="QS-Freigaben offen"
                color="var(--tf-primary)"
                onClick={() => onOpenQs(ersteQsScopeId)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
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
