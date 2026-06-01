/**
 * NeueAntraegeVerbundRow — eine Zeile pro Verbund in „Neue Anträge für dich".
 *
 * Ersetzt die frühere per-TV-Row: Bearbeiter übernehmen immer den ganzen
 * Verbund. Zeigt Akronym (fett) + Verbund-Titel, FKZ-Range, bei >1 TV ein
 * „N TV"-Badge, dessen Tooltip die einzelnen Teilvorhaben-Titel auflistet —
 * so sieht der User Details, bevor er den Verbund übernimmt.
 *
 * Voll-Variante (erste 5 Zeilen) + kompakte Variante (im „Alle"-Modal).
 */
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { KategoriePill } from '@/plugins/auslastung/components/KategoriePill';
import { XswSuffix } from '@/plugins/antraege/XswSuffix';
import type { VerbundEintrag } from './neueAntraegeVerbund';

interface Props {
  verbund: VerbundEintrag;
  onUebernehmen: () => void;
  /** „Rückgängig" — Vormerkung zurücknehmen (nur für claimed-Zeilen). */
  onUndo?: () => void;
  disabled?: boolean;
  /** Kompakte Layout-Variante fürs „Alle"-Modal. */
  compact?: boolean;
}

/** Tooltip-Text für den „N TV"-Badge: ein TV pro Zeile („FKZ — Titel"). */
function tvTooltip(verbund: VerbundEintrag): string {
  return verbund.alleTvs
    .map(tv => (tv.titel ? `${tv.aktenzeichen} — ${tv.titel}` : tv.aktenzeichen))
    .join('\n');
}

export function NeueAntraegeVerbundRow({
  verbund,
  onUebernehmen,
  onUndo,
  disabled,
  compact,
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

  // „N TV"-Badge nur bei echtem Verbund (>1 TV). Tooltip listet die TV-Titel,
  // damit der User vor der Übernahme sieht, was im Verbund steckt.
  const tvBadge = tvCount > 1 ? (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded text-[var(--tf-text-secondary)] cursor-help shrink-0"
      style={{ border: '0.5px solid var(--tf-border)' }}
      title={tvTooltip(verbund)}
    >
      {tvCount} TV
    </span>
  ) : null;

  if (compact) {
    return (
      <div className="rounded-[8px] px-2.5 py-1.5 flex items-center gap-3" style={rowStyle}>
        <span
          className="font-mono text-[10.5px] text-[var(--tf-text-secondary)] shrink-0 w-[124px] truncate"
          title={fkzRange}
        >
          {fkzRange}
        </span>
        {primaerKat && (
          <div className="shrink-0"><KategoriePill kategorie={primaerKat} active /></div>
        )}
        {tvBadge}
        <div className="flex-1 min-w-0 text-[12px] text-[var(--tf-text)] truncate">
          {akronym && <span className="font-medium">{akronym}</span>}
          {akronym && <span className="text-[var(--tf-text-tertiary)]"> · </span>}
          <span className="text-[var(--tf-text-secondary)]">{titel}</span>
        </div>
        <XswSuffix value={leadAntrag} className="shrink-0 max-w-[35%] truncate text-[12px]" />
        {claimed ? (
          <span className="text-[10.5px] shrink-0 text-[var(--tf-text-tertiary)]">Vorgemerkt</span>
        ) : (
          <span className={`text-[10.5px] tabular-nums shrink-0 ${fristTone}`} title="Verbleibende Frist">
            Noch {daysLeft}d
          </span>
        )}
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className={`${buttonClasses} px-2.5 py-1 shrink-0`}
          style={buttonStyle}
          aria-label={actionAria}
        >
          {actionLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] p-3 flex items-center gap-4" style={rowStyle}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">{fkzRange}</span>
          {primaerKat && <KategoriePill kategorie={primaerKat} active />}
          {aspektKats.map(k => (
            <KategoriePill key={k.id} kategorie={k} active={false} />
          ))}
          {tvBadge}
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
