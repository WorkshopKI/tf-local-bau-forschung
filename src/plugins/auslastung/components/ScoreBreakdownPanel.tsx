/**
 * ScoreBreakdownPanel (v2.48) — aufklappbare Aufschlüsselung der „Passung".
 *
 * Beantwortet die Tester-Frage „wieviel tragen historische Anträge und wieviel
 * die Kompetenzmatrix zum Score bei?": zeigt den 50/50-Blend aus Historie-Signal
 * (`breakdown.histScore`) und PL-Kompetenztabelle (`breakdown.matrixScore`), den
 * Aspekt-Bonus, den internen Historie-Mix (BM25 ↔ Embedding über `alpha`) sowie
 * die Match-Stufe. Reine Anzeige — alle Werte kommen fertig aus der Engine.
 */
import type { MatchResult } from '../types';

interface Props {
  match: MatchResult;
}

const pct = (x: number): number => Math.round(x * 100);

const STUFE_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Stufe 1 — überwiegend Wortlaut-Treffer (Stichwörter dominieren)',
  2: 'Stufe 2 — überwiegend semantisch (ähnliche Projekte dominieren)',
  3: 'Stufe 3 — gemischt (Wortlaut + semantisch)',
};

/** Eine Aufschlüsselungs-Zeile: Label · Balken · Wert · optionaler Gewichts-Hinweis. */
function Zeile({
  label, value, barClass, hinweis, gedimmt,
}: {
  label: string;
  /** Anzeige-Wert UND Balkenbreite (z.B. „70%"). */
  value: string;
  barClass: string;
  hinweis?: string;
  gedimmt?: boolean;
}): React.ReactElement {
  return (
    <div className={`flex items-center gap-2.5 ${gedimmt ? 'opacity-55' : ''}`}>
      <span className="w-[148px] shrink-0 text-[11px] text-[var(--tf-text-secondary)]">{label}</span>
      <span className="flex-1 h-1.5 rounded-sm overflow-hidden" style={{ background: 'var(--tf-bg-secondary)' }}>
        <span className={`block h-full rounded-sm ${barClass}`} style={{ width: value }} />
      </span>
      <span className="w-[78px] shrink-0 text-right text-[11px] tabular-nums text-[var(--tf-text)]">
        {hinweis ? <span className="text-[var(--tf-text-tertiary)]">{hinweis} </span> : null}
        {value}
      </span>
    </div>
  );
}

export function ScoreBreakdownPanel({ match }: Props): React.ReactElement | null {
  const b = match.breakdown;
  if (!b) return null;

  const w = b.matrixGewicht;
  const hist = b.histScore;
  const matrix = b.matrixScore; // number | null
  const aspekt = match.aspektBonus ?? 0;
  const bm25 = match.bm25Score;
  const emb = match.embeddingScore;
  const ast = match.astBoost ?? 0;
  const alpha = b.alpha;

  return (
    <div
      className="px-3.5 py-3 text-[11px] flex flex-col gap-3"
      style={{ background: 'var(--tf-bg-secondary)' }}
    >
      {/* Block 1 — Zusammensetzung der Passung (Historie ↔ Kompetenztabelle) */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
          Zusammensetzung der Passung
        </div>
        <Zeile
          label="Historische Anträge"
          value={`${pct(hist)}%`}
          barClass="bg-sky-500"
          hinweis={matrix !== null ? `× ${pct(1 - w)}%` : 'zählt voll'}
        />
        {matrix !== null ? (
          <Zeile
            label="Kompetenztabelle"
            value={`${pct(matrix)}%`}
            barClass="bg-violet-500"
            hinweis={`× ${pct(w)}%`}
          />
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="w-[148px] shrink-0 text-[11px] text-[var(--tf-text-secondary)]">Kompetenztabelle</span>
            <span className="flex-1 text-[11px] text-[var(--tf-text-tertiary)] italic">
              keine Bewertung hinterlegt → nur Historie
            </span>
          </div>
        )}
        {aspekt > 0 && (
          <Zeile
            label="Aspekt-Bonus"
            value={`+${pct(aspekt)}%`}
            barClass="bg-emerald-500"
          />
        )}
      </div>

      {/* Block 2 — Woraus die Historie besteht (BM25 ↔ Embedding über alpha) */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
          Historie im Detail
        </div>
        <Zeile
          label="Stichwörter (Wortlaut)"
          value={`${pct(bm25)}%`}
          barClass="bg-sky-400"
          hinweis={`× ${pct(alpha)}%`}
          gedimmt={alpha === 0}
        />
        <Zeile
          label="Ähnliche Projekte (semantisch)"
          value={`${pct(emb)}%`}
          barClass="bg-indigo-400"
          hinweis={`× ${pct(1 - alpha)}%`}
          gedimmt={alpha >= 1}
        />
        {ast > 0 && (
          <Zeile
            label="Gleicher Antragsteller"
            value={`+${pct(ast)}%`}
            barClass="bg-teal-400"
            hinweis={match.astMatchCount > 0 ? `${match.astMatchCount}×` : undefined}
          />
        )}
      </div>

      {/* Match-Stufe + Fußnote */}
      <div className="flex flex-col gap-1 text-[10.5px] text-[var(--tf-text-tertiary)]">
        <div>{STUFE_LABEL[match.matchStufe]}</div>
        <div>Reihenfolge zusätzlich nach freier Kapazität gewichtet — „Passung" misst nur die fachliche Eignung.</div>
      </div>
    </div>
  );
}
