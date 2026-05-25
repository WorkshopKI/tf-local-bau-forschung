/**
 * Top-3 MA-Vorschlags-Card im Zuweisungs-Cockpit.
 * Zeigt: anonId gross, Score, Stufe-Badge, Kapazitaet in Antraegen (NICHT
 * Stunden — User-facing seit 1.17), Aspekt-Match-Hinweise, matchende
 * Technologien, aehnliche Projekte, Zuweisen/Ablehnen-Buttons.
 */
import type { MatchResult, UeberKategorie } from '../types';
import { AnonymIdBadge } from './AnonymIdBadge';
import { ConfidenceDot } from './ConfidenceDot';
import { TechnologieTags } from './TechnologieTags';
import { useAuslastungData } from '../hooks/useAuslastungData';

interface Props {
  match: MatchResult;
  matchendeQueryTokens?: string[];
  onZuweisen: () => void;
  onAblehnen: () => void;
  disabled?: boolean;
  /** Anzahl Tage bis Quartals-Ende. Wenn < quartalsEndeBonusTage, zeigen wir
   *  einen Hinweis bei "Kapazitaet erschoepft". Optional. */
  tageImQuartal?: number;
}

const STUFE_LABEL: Record<MatchResult['matchStufe'], string> = {
  1: 'BM25',
  2: 'Embedding',
  3: 'Hybrid',
};

export function VorschlagCard({
  match, matchendeQueryTokens, onZuweisen, onAblehnen, disabled, tageImQuartal,
}: Props): React.ReactElement {
  const score = Math.round(match.kompetenzScore * 100);
  const config = useAuslastungData(s => s.data.config);
  const stundenProTV = config.stundenProTV ?? 9;
  const durchschnittTV = config.durchschnittTVproAntrag ?? 2;
  const antragsStunden = stundenProTV * durchschnittTV;
  const restAntraege = Math.floor(match.restKapazitaet / antragsStunden);
  const maxAntraege = Math.floor(match.quartalsKapazitaet / antragsStunden);
  const ueberbuchungAntraege = Math.ceil((match.ueberbuchung ?? 0) / antragsStunden);
  const quartalsEndeBonusTage = config.quartalsEndeBonusTage ?? 21;
  const kategorienById = new Map(config.ueberKategorien.map(k => [k.id, k]));
  const aspektMatchKategorien = (match.aspektMatchIds ?? [])
    .map(id => kategorienById.get(id))
    .filter((k): k is UeberKategorie => k != null);

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
              Kompetenz {score}%
              {(match.aspektBonus ?? 0) > 0 && (
                <> · Aspekt +{Math.round((match.aspektBonus ?? 0) * 100)}%</>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Kapazitaet — Antraege statt Stunden (1.17) */}
      <div className="text-[12px]">
        {ueberbuchungAntraege > 0 ? (
          <span className="text-rose-700 font-medium">
            Überbucht um ~{ueberbuchungAntraege} {ueberbuchungAntraege === 1 ? 'Antrag' : 'Anträge'}
          </span>
        ) : restAntraege === 0 ? (
          <span className="text-orange-700">
            Kapazität erschöpft
            {tageImQuartal != null && tageImQuartal < quartalsEndeBonusTage && (
              <span className="text-[var(--tf-text-tertiary)]"> · Neues Quartal in {tageImQuartal} Tagen</span>
            )}
          </span>
        ) : restAntraege === 1 ? (
          <span className="text-amber-700">1 Antrag frei</span>
        ) : (
          <span className="text-[var(--tf-text-secondary)]">
            <span className="font-medium text-[var(--tf-text)]">{restAntraege}</span>
            {' von '}{maxAntraege} Anträgen frei
          </span>
        )}
      </div>

      {/* Aspekt-Match-Anzeige (1.17) */}
      {aspektMatchKategorien.length > 0 && (
        <div className="text-[11.5px] text-emerald-700">
          {aspektMatchKategorien.map(k => `✓ ${k.id}-Aspekt abgedeckt`).join(' · ')}
        </div>
      )}

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
