/**
 * VorschlagRow (Redesign v2.26) — kompakte Vorschlagszeile im Zuweisungs-Cockpit,
 * löst die hohe `VorschlagCard` ab. Ein Kürzel, EIN Wert („Passung"), ähnliche
 * Projekte direkt unter dem MA verschachtelt; pro Zeile grob die halbe Höhe der
 * alten Karte, alle 5 Vorschläge ohne langes Scrollen erfassbar.
 *
 * Vier-Spalten-Raster (1fr · Passung · Kapazität · Aktion). Die bereits
 * zugewiesene Zeile bekommt einen neutral-grauen Hintergrund + „✓ zugewiesen"
 * statt der Buttons — Grün liegt bewusst NUR auf dem Zuweisungs-Streifen oben,
 * damit nicht zweimal dieselbe Farbe um Aufmerksamkeit konkurriert.
 *
 * Kapazitäts-/Kontingent-Logik 1:1 aus der früheren VorschlagCard übernommen.
 */
import { Check } from 'lucide-react';
import type { AntragstypBucket, MatchResult, UeberKategorie } from '../types';
import { useDeAnonName } from './AnonymIdBadge';
import { ConfidenceDot } from './ConfidenceDot';
import { TechnologieTags } from './TechnologieTags';
import { useAuslastungData } from '../hooks/useAuslastungData';

interface Props {
  match: MatchResult;
  /** true → diese Zeile ist der freigegebene MA: graue Zeile + „✓ zugewiesen". */
  isAssigned?: boolean;
  matchendeQueryTokens?: string[];
  onZuweisen: () => void;
  onAblehnen: () => void;
  disabled?: boolean;
  /** true → NUR „Zuweisen" gesperrt (Verbund noch nicht vollständig erfasst,
   *  D_XTEC/D_ADV fehlt); „Ablehnen" bleibt erlaubt. */
  zuweisenGesperrt?: boolean;
  /** Anzahl Tage bis Quartals-Ende — Hinweis bei „Kapazität erschöpft". */
  tageImQuartal?: number;
  /** Antragstyp dieses Antrags (für die Typ-Kontingent-Anzeige). */
  antragstyp?: AntragstypBucket | null;
}

/** Balkenfarbe nach Passung (README-Schwellen). */
function barColor(v: number): string {
  if (v >= 70) return 'hsl(145,50%,45%)';
  if (v >= 35) return 'hsl(38,76%,48%)';
  if (v > 0) return 'hsl(0,60%,55%)';
  return 'var(--tf-border-hover)';
}

export function VorschlagRow({
  match, isAssigned, matchendeQueryTokens, onZuweisen, onAblehnen, disabled, zuweisenGesperrt, tageImQuartal, antragstyp,
}: Props): React.ReactElement {
  const score = Math.round(match.kompetenzScore * 100);
  const config = useAuslastungData(s => s.data.config);
  const stundenProTV = config.stundenProTV ?? 9;
  // v2.4: Rest-Sicht in TVs (echte Buchungseinheit). restStunden / stundenProTV = freie TVs.
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

  // Kapazität (Spalte 3) — farbige Rest-/Überbucht-/Erschöpft-Variante.
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

  // Typ-Kontingent (Spalte 3, v2.16) — weicher Deckel.
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
      className="grid grid-cols-[minmax(0,1fr)_122px_156px_auto] gap-[18px] items-start px-3.5 py-2.5 border-t-[0.5px] border-[var(--tf-border)] first:border-t-0 hover:bg-[var(--tf-hover)]"
      style={isAssigned ? { background: 'var(--tf-bg-secondary)' } : undefined}
    >
      {/* Spalte 1 — Kürzel (einmalig, plain) + Tech + Aspekt + ähnliche Projekte */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] font-medium text-[var(--tf-text)]"
            title={realName ? match.anonId : undefined}
          >
            {realName ?? match.anonId}
          </span>
          {match.manuell && (
            <span
              className="text-[10px] uppercase tracking-wider text-[var(--tf-text-secondary)] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--tf-bg-secondary)' }}
            >
              Manuell
            </span>
          )}
        </div>

        {/* Matchende Technologien (in der Zeile sichtbar, User-Entscheidung) */}
        {match.matchendeTechnologien.length > 0 && (
          <div className="mt-1.5">
            <TechnologieTags tags={match.matchendeTechnologien} highlight={matchendeQueryTokens} max={6} />
          </div>
        )}

        {/* Aspekt-Match-Hinweise (1.17) */}
        {aspektMatchKategorien.length > 0 && (
          <div className="mt-1 text-[11px] text-emerald-700">
            {aspektMatchKategorien.map(k => `✓ ${k.id}-Aspekt abgedeckt`).join(' · ')}
            {(match.aspektBonus ?? 0) > 0 && (
              <span className="text-[var(--tf-text-tertiary)]"> · Aspekt +{Math.round((match.aspektBonus ?? 0) * 100)}%</span>
            )}
          </div>
        )}

        {/* Ähnliche Projekte — verschachtelt unter dem MA */}
        {match.aehnlicheProjekte.length > 0 ? (
          <div className="mt-1.5 flex flex-col gap-0.5">
            {match.aehnlicheProjekte.slice(0, 3).map(p => (
              <div key={p.aktenzeichen} className="flex items-baseline gap-1.5 min-w-0 text-[11px] text-[var(--tf-text-tertiary)]">
                <span className="shrink-0 text-[var(--tf-border-hover)]">↳</span>
                <span className="shrink-0 font-mono text-[var(--tf-text-secondary)]">{p.aktenzeichen}</span>
                <span className="shrink-0 font-mono text-[var(--tf-text-secondary)]">{Math.round(p.similarity * 100)}%</span>
                <span className="truncate min-w-0">{p.titel ?? '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          !match.manuell && (
            <div className="mt-1.5 text-[10.5px] text-[var(--tf-text-tertiary)]">keine ähnlichen Projekte</div>
          )
        )}
      </div>

      {/* Spalte 2 — Passung (ein Wert) */}
      <div className="flex flex-col gap-1">
        {match.manuell ? (
          <span className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">manuell</span>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <ConfidenceDot confidence={match.confidence} />
              <span className="text-[16px] font-medium text-[var(--tf-text)]">{score}%</span>
            </div>
            <div className="w-[60px] h-1 rounded-sm overflow-hidden" style={{ background: 'var(--tf-bg-secondary)' }}>
              <span className="block h-full rounded-sm" style={{ width: `${Math.max(score, 3)}%`, background: barColor(score) }} />
            </div>
            <span
              className="text-[9.5px] uppercase tracking-[0.05em] text-[var(--tf-text-tertiary)] cursor-help"
              title="Fachliche Passung des/der MA zu diesem Antrag — abgeleitet aus ähnlichen früheren Anträgen, Stichwörtern und der Kompetenzmatrix. Kein Maß der persönlichen Kompetenz."
            >
              Passung
            </span>
          </>
        )}
      </div>

      {/* Spalte 3 — Kapazität (rechtsbündig) */}
      <div className="text-right">
        <div className="text-[12px] leading-[1.3]">{kapazitaetNode}</div>
        {kontingentNode && <div className="text-[11px] leading-[1.3] mt-0.5">{kontingentNode}</div>}
      </div>

      {/* Spalte 4 — Aktion bzw. zugewiesen-Status */}
      <div className="inline-flex items-center gap-2 justify-self-end">
        {isAssigned ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: 'var(--tf-success-text)' }}>
            <Check size={14} aria-hidden />
            zugewiesen
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onZuweisen}
              disabled={disabled || zuweisenGesperrt}
              title={zuweisenGesperrt ? 'Verbund noch nicht vollständig erfasst (D_XTEC/D_ADV fehlt) — Zuweisung gesperrt' : undefined}
              className="h-[27px] px-2.5 rounded-md text-[11.5px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              Zuweisen
            </button>
            <button
              type="button"
              onClick={onAblehnen}
              disabled={disabled}
              className="h-[27px] px-2.5 rounded-md text-[11.5px] cursor-pointer text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] disabled:opacity-50"
            >
              Ablehnen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
