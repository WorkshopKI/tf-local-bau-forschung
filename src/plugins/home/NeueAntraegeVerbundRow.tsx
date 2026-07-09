/**
 * NeueAntraegeVerbundRow — eine Zeile pro Verbund in „Neue Anträge für dich".
 *
 * Bearbeiter übernehmen immer den GANZEN Verbund, nie einzelne Teilvorhaben.
 * Zeigt Akronym (fett) + Verbund-Titel, FKZ-Range, Kategorie-Pills und (bei >1
 * TV) ein „N TV"-Badge. Ein Hover-Tooltip auf der Info-Spalte listet den vollen
 * Verbund-Titel, Antragsteller, Eingangsdatum und die einzelnen TV-Titel — so
 * kann der User vor der Übernahme einschätzen, ob der Antrag zu ihm passt.
 *
 * Optionale `passung` (Tier 2 „Weitere Anträge") rendert einen „Passung X %"-Pill
 * + eine Tooltip-Zeile: die eigene fachliche Passung zu einem schwächer
 * passenden Antrag (Nebenkategorie).
 */
import { Tooltip } from '@/components/ui/Tooltip';
import { formatGermanDate } from '@/core/services/csv';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { KategoriePill } from '@/plugins/auslastung/components/KategoriePill';
import { XswSuffix } from '@/plugins/antraege/XswSuffix';
import type { AntragOderSlim } from '@/core/services/csv/types';
import type { VerbundEintrag } from './neueAntraegeVerbund';

interface Props {
  verbund: VerbundEintrag;
  onUebernehmen: () => void;
  /** „Rückgängig" — Vormerkung zurücknehmen (nur für claimed-Zeilen). */
  onUndo?: () => void;
  disabled?: boolean;
  /** Tier 2: eigene fachliche Passung (0..1) → „Passung X %"-Pill + Tooltip-Zeile. */
  passung?: number;
}

/** Liest ein String-Feld defensiv aus dem (Slim-)Antrag; leer → undefined. */
function readStringField(a: AntragOderSlim, feld: string): string | undefined {
  const v = (a as Record<string, unknown>)[feld];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

/** Reicher Hover-Inhalt: voller Verbund-Titel + Antragsteller/Datum + TV-Titel. */
function AntragTooltipCard({ verbund, passung }: { verbund: VerbundEintrag; passung?: number }): React.ReactElement {
  const antragsteller = readStringField(verbund.leadAntrag, 'antragsteller');
  const datumRaw = readStringField(verbund.leadAntrag, 'antragsdatum');
  const datum = datumRaw ? formatGermanDate(datumRaw) : '';
  return (
    <div className="text-left">
      <div className="text-[12px] font-medium text-[var(--tf-text)] mb-1 whitespace-normal">
        {verbund.verbundTitel || '—'}
      </div>
      <div className="flex flex-col gap-0.5 text-[11px]">
        {antragsteller && (
          <div>
            <span className="text-[var(--tf-text-tertiary)]">Antragsteller: </span>
            <span className="text-[var(--tf-text-secondary)]">{antragsteller}</span>
          </div>
        )}
        {datum && (
          <div>
            <span className="text-[var(--tf-text-tertiary)]">Eingang: </span>
            <span className="text-[var(--tf-text-secondary)]">{datum}</span>
          </div>
        )}
        {passung != null && (
          <div>
            <span className="text-[var(--tf-text-tertiary)]">Passung: </span>
            <span className="text-[var(--tf-text-secondary)]">{Math.round(passung * 100)} %</span>
          </div>
        )}
      </div>
      {verbund.alleTvs.length > 0 && (
        <div className="mt-1.5 pt-1.5 flex flex-col gap-0.5" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          {verbund.alleTvs.map(tv => (
            <div key={tv.aktenzeichen} className="flex gap-1.5 text-[11px]">
              <span className="font-mono text-[var(--tf-text-tertiary)] shrink-0">{tv.aktenzeichen}</span>
              <span className="text-[var(--tf-text-secondary)] whitespace-normal">{tv.titel || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NeueAntraegeVerbundRow({
  verbund,
  onUebernehmen,
  onUndo,
  disabled,
  passung,
}: Props): React.ReactElement {
  const config = useAuslastungData(s => s.data.config);
  const { akronym, verbundTitel, fkzRange, klassifizierung, daysLeft, claimed, tvCount, leadAntrag } = verbund;
  const primaerId = klassifizierung.freigegebenePrimaer;
  const aspektIds = klassifizierung.freigegebeneAspekte;
  const primaerKat = config.ueberKategorien.find(k => k.id === primaerId);
  const aspektKats = aspektIds
    .map(id => config.ueberKategorien.find(k => k.id === id))
    .filter((k): k is NonNullable<typeof k> => k != null);
  const titel = verbundTitel || '—';
  const fristTone = daysLeft <= 2 ? 'text-rose-700 font-medium'
    : daysLeft <= 3 ? 'text-amber-700 font-medium'
    : 'text-[var(--tf-text-tertiary)]';

  // Dezenter Secondary-CTA — der User signalisiert nur Absicht, die PL
  // entscheidet final (vgl. v2.3-Lesson der Vorgänger-Row).
  const buttonClasses = 'rounded-md text-[12px] cursor-pointer border bg-[var(--tf-bg)] hover:bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
  const buttonStyle: React.CSSProperties = { borderColor: 'var(--tf-border)' };
  const rowStyle: React.CSSProperties = claimed
    ? { border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }
    : { border: '0.5px solid var(--tf-border)' };
  const actionLabel = claimed ? 'Rückgängig' : 'Kann ich übernehmen';
  const onAction = claimed ? onUndo : onUebernehmen;
  const actionAria = `${actionLabel} — ${akronym || fkzRange}`;

  // „N TV"-Badge nur bei echtem Verbund (>1 TV). Die TV-Titel stehen im
  // Hover-Tooltip der Info-Spalte (nicht mehr im nativen title-Attribut).
  const tvBadge = tvCount > 1 ? (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded text-[var(--tf-text-secondary)] shrink-0"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {tvCount} TV
    </span>
  ) : null;

  return (
    <div className="rounded-[12px] p-3 flex items-center gap-4" style={rowStyle}>
      <Tooltip
        maxWidth={420}
        wrapperClassName="flex-1 min-w-0"
        content={<AntragTooltipCard verbund={verbund} passung={passung} />}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">{fkzRange}</span>
            {primaerKat && <KategoriePill kategorie={primaerKat} active />}
            {aspektKats.map(k => (
              <KategoriePill key={k.id} kategorie={k} active={false} />
            ))}
            {tvBadge}
            {passung != null && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded text-[var(--tf-text-secondary)] shrink-0"
                style={{ border: '0.5px solid var(--tf-border)' }}
                title="Deine fachliche Passung zu diesem Antrag (aus ähnlichen früheren Anträgen + Kompetenztabelle). Kein Maß persönlicher Kompetenz."
              >
                Passung {Math.round(passung * 100)} %
              </span>
            )}
            {claimed && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded text-[var(--tf-text-tertiary)]"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                Vorgemerkt
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 min-w-0">
            {akronym && <span className="text-[12.5px] font-medium text-[var(--tf-text)] shrink-0">{akronym}</span>}
            {akronym && <span className="text-[12.5px] text-[var(--tf-text-tertiary)] shrink-0">·</span>}
            <span className="text-[12.5px] text-[var(--tf-text)] truncate">{titel}</span>
            <XswSuffix value={leadAntrag} className="shrink-0 max-w-[50%] truncate text-[12.5px]" />
          </div>
        </div>
      </Tooltip>
      <div className="text-right flex flex-col items-end gap-1 shrink-0">
        {!claimed && (
          <span className={`text-[10.5px] ${fristTone}`}>
            Noch {daysLeft} Tag{daysLeft === 1 ? '' : 'e'}
          </span>
        )}
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className={`${buttonClasses} px-3 py-1`}
          style={buttonStyle}
          aria-label={actionAria}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
