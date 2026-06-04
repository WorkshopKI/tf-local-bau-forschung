/**
 * Top-3 MA-Vorschlags-Card im Zuweisungs-Cockpit.
 * Zeigt: anonId gross, Kompetenz-Score, Kapazitaet in Antraegen (NICHT
 * Stunden — User-facing seit 1.17), Aspekt-Match-Hinweise, matchende
 * Technologien, aehnliche Projekte, Zuweisen/Ablehnen-Buttons.
 */
import type { AntragstypBucket, MatchResult, UeberKategorie } from '../types';
import { AnonymIdBadge, useDeAnonName } from './AnonymIdBadge';
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
  /** Antragstyp dieses Antrags (für die Typ-Kontingent-Anzeige). Optional. */
  antragstyp?: AntragstypBucket | null;
}

export function VorschlagCard({
  match, matchendeQueryTokens, onZuweisen, onAblehnen, disabled, tageImQuartal, antragstyp,
}: Props): React.ReactElement {
  const score = Math.round(match.kompetenzScore * 100);
  const config = useAuslastungData(s => s.data.config);
  const stundenProTV = config.stundenProTV ?? 9;
  // v2.4: Rest-Sicht in TVs (echte Buchungseinheit), nicht in "Anträgen"
  // (Heuristik mit durchschnittTV). restStunden / stundenProTV = freie TVs.
  const restStunden = Math.max(0, match.restKapazitaet);
  const restTVs = Math.floor(restStunden / stundenProTV);
  const ueberbuchungStunden = Math.max(0, match.ueberbuchung ?? 0);
  const ueberbuchungTVs = Math.ceil(ueberbuchungStunden / stundenProTV);
  const quartalsEndeBonusTage = config.quartalsEndeBonusTage ?? 21;
  const kategorienById = new Map(config.ueberKategorien.map(k => [k.id, k]));
  const aspektMatchKategorien = (match.aspektMatchIds ?? [])
    .map(id => kategorienById.get(id))
    .filter((k): k is UeberKategorie => k != null);
  const realName = useDeAnonName(match.anonId);

  // Kapazität (rechts in der Titelzeile) — farbige Rest-/Überbucht-/Erschöpft-Variante.
  const kapazitaetNode = ueberbuchungStunden > 0 ? (
    <span className="text-rose-700 font-medium">
      Überbucht um {Math.round(ueberbuchungStunden)}h (~{ueberbuchungTVs} {ueberbuchungTVs === 1 ? 'TV' : 'TVs'})
    </span>
  ) : restTVs === 0 ? (
    <span className="text-orange-700">
      Kapazität erschöpft
      {tageImQuartal != null && tageImQuartal < quartalsEndeBonusTage && (
        <span className="text-[var(--tf-text-tertiary)]"> · Neues Quartal in {tageImQuartal} T.</span>
      )}
    </span>
  ) : restTVs === 1 ? (
    <span className="text-amber-700">1 TV frei ({Math.round(restStunden)}h)</span>
  ) : (
    <span className="text-[var(--tf-text-secondary)]">
      <span className="font-medium text-[var(--tf-text)]">{restTVs}</span>
      {' TVs frei ('}{Math.round(restStunden)}{'h)'}
    </span>
  );

  // Typ-Kontingent (rechts in der Titelzeile, v2.16) — weicher Deckel.
  const kontingentNode = match.kontingentQuartal != null ? (
    (match.kontingentRest ?? 0) <= 0 ? (
      <span className="text-orange-700">{antragstyp ?? 'Typ'}-Kontingent erschöpft</span>
    ) : (
      <span className="text-[var(--tf-text-tertiary)]">
        {antragstyp ?? 'Typ'}-Kontingent:{' '}
        <span className="text-[var(--tf-text-secondary)]">
          {Math.max(0, Math.floor(match.kontingentRest ?? 0))}/{Math.round(match.kontingentQuartal ?? 0)} TVs
        </span>
      </span>
    )
  ) : null;

  return (
    <div
      className="rounded-[12px] p-3 flex flex-col gap-2"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {/* Header — Identität + Score links, Kapazität + Kontingent rechts (kompakt) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <AnonymIdBadge anonId={match.anonId} size="lg" realName={realName} />
          <div className="flex flex-col">
            {match.manuell ? (
              // Manuell hinzugefuegt: kein Score, nur ein dezentes Badge.
              <span
                className="self-start text-[10.5px] uppercase tracking-wider text-[var(--tf-text-secondary)] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--tf-bg-secondary)' }}
              >
                Manuell hinzugefügt
              </span>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-medium text-[var(--tf-text)]">{score}%</span>
                  <span className="text-[12px] text-[var(--tf-text-secondary)]">Kompetenz</span>
                  <ConfidenceDot confidence={match.confidence} />
                </div>
                {(match.aspektBonus ?? 0) > 0 && (
                  <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                    Aspekt +{Math.round((match.aspektBonus ?? 0) * 100)}%
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {/* Kapazität (v2.4) + Typ-Kontingent (v2.16) — kompakt in der Titelzeile */}
        <div className="flex flex-col items-end text-right gap-0.5 shrink-0">
          <span className="text-[11.5px]">{kapazitaetNode}</span>
          {kontingentNode && <span className="text-[10.5px]">{kontingentNode}</span>}
        </div>
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
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={onZuweisen}
          disabled={disabled}
          className="px-3 py-1 rounded-md text-[12px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          Zuweisen
        </button>
        <button
          type="button"
          onClick={onAblehnen}
          disabled={disabled}
          className="px-3 py-1 rounded-md text-[12px] cursor-pointer disabled:opacity-50"
          style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
        >
          Ablehnen
        </button>
      </div>
    </div>
  );
}
