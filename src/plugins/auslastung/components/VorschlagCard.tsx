/**
 * Top-3 MA-Vorschlags-Card im Zuweisungs-Cockpit.
 * Zeigt: anonId gross, Score, Stufe-Badge, Restkapazitaet, matchende
 * Technologien, aehnliche Projekte, Zuweisen/Ablehnen-Buttons.
 */
import type { MatchResult } from '../types';
import { AnonymIdBadge } from './AnonymIdBadge';
import { ConfidenceDot } from './ConfidenceDot';
import { TechnologieTags } from './TechnologieTags';

interface Props {
  match: MatchResult;
  matchendeQueryTokens?: string[];
  onZuweisen: () => void;
  onAblehnen: () => void;
  disabled?: boolean;
}

const STUFE_LABEL: Record<MatchResult['matchStufe'], string> = {
  1: 'BM25',
  2: 'Embedding',
  3: 'Hybrid',
};

export function VorschlagCard({
  match, matchendeQueryTokens, onZuweisen, onAblehnen, disabled,
}: Props): React.ReactElement {
  const score = Math.round(match.kompetenzScore * 100);
  const balancePct = Math.round(match.balanceScore * 100);
  return (
    <div
      className="rounded-[12px] p-4 flex flex-col gap-3"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <AnonymIdBadge anonId={match.anonId} size="lg" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-medium text-[var(--tf-text)]">{score}%</span>
              <span
                className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--tf-bg-secondary)' }}
              >
                {STUFE_LABEL[match.matchStufe]}
              </span>
              <ConfidenceDot confidence={match.confidence} />
            </div>
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">
              Kompetenz {Math.round(match.kompetenzScore * 100)}% · Balance {balancePct}%
            </span>
          </div>
        </div>
      </div>

      {/* Kapazitaet */}
      <div className="text-[12px] text-[var(--tf-text-secondary)]">
        <span className="font-medium text-[var(--tf-text)]">{Math.round(match.restKapazitaet)}h</span>
        {' von '}{Math.round(match.quartalsKapazitaet)}h frei
        {' · '}<span className="text-[var(--tf-text-tertiary)]">Aufwand {match.benoetigteStunden}h</span>
      </div>

      {/* Matchende Technologien */}
      {match.matchendeTechnologien.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
            Matchende Technologien
          </div>
          <TechnologieTags tags={match.matchendeTechnologien} highlight={matchendeQueryTokens} max={6} />
        </div>
      )}

      {/* Aehnliche Projekte */}
      {match.aehnlicheProjekte.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
            Ähnliche Projekte
          </div>
          <ul className="space-y-0.5 text-[11.5px]">
            {match.aehnlicheProjekte.slice(0, 3).map(p => (
              <li key={p.aktenzeichen} className="flex items-baseline gap-2">
                <span className="font-mono text-[var(--tf-text-secondary)]">{p.aktenzeichen}</span>
                <span className="text-[var(--tf-text-tertiary)] truncate">{p.titel ?? '—'}</span>
                <span className="ml-auto text-[10px] text-[var(--tf-text-tertiary)]">
                  {Math.round(p.similarity * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Aktionen */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onZuweisen}
          disabled={disabled}
          className="flex-1 px-3 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          Zuweisen
        </button>
        <button
          type="button"
          onClick={onAblehnen}
          disabled={disabled}
          className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
          style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
        >
          Ablehnen
        </button>
      </div>
    </div>
  );
}
