/**
 * Linke Spalte des Zuweisungs-Cockpits (Screen 1b) — die filter-/sortierte
 * Verbund-Liste mit Status-Signalen (zugewiesen / Interessenten / vorgemerkt)
 * und Inline-Rücknahme. Aus ZuweisungsCockpit.tsx ausgelagert (Kohäsion vor
 * Zeilenzahl), Verhalten unverändert — rein prop-getrieben.
 */
import { AlertTriangle, Info, Undo2 } from 'lucide-react';
import { SkeletonRows } from '../components/Skeleton';
import { KategoriePill } from '../components/KategoriePill';
import { ConfidenceDot } from '../components/ConfidenceDot';
import { AnonymIdBadge, useDeAnonResolver } from '../components/AnonymIdBadge';
import { istUnvollstaendigAz, unvollstaendigGrund, type VollstaendigkeitsGateAz, type VerbundZuweisungRow } from '../services/verbund';
import type { UeberKategorie, Zuweisung } from '../types';
import type { AntragListItem } from '@/core/services/csv/types';
import {
  formatAntragsdatum,
  interessentenNachWunschzeit,
  unbestaetigteFreigabeTage,
} from './cockpit-helpers';

/** Ab wie vielen Interessenten die Zeile auf „+N" kürzt (Zeilen bleiben schmal). */
const MAX_INTERESSENTEN_BADGES = 3;

export function VerbundListe({
  leftPct, rows, isInitialLoading, verteilLookbackMonate,
  selectedAz, onSelect, antragByAz, gate, ueberKategorien,
  zuweisungen, pendingByAntrag, confirmUnassignId,
  onSetConfirmUnassign, onUnassignRow, unassignBusy,
}: {
  /** Breite der linken Liste in % (Resizable Split, vom Cockpit gehalten). */
  leftPct: number;
  /** Filter-/sortierte Verbund-Zeilen. */
  rows: VerbundZuweisungRow[];
  isInitialLoading: boolean;
  /** Rollierendes Verteil-Fenster in Monaten (Header-Hinweis). */
  verteilLookbackMonate: number | undefined;
  selectedAz: string | null;
  onSelect: (az: string) => void;
  /** Lead-Antrag pro Aktenzeichen (Vollständigkeits-Markierung). */
  antragByAz: Map<string, AntragListItem>;
  gate: VollstaendigkeitsGateAz;
  ueberKategorien: UeberKategorie[];
  zuweisungen: Zuweisung[];
  /** anonIds mit offenem (noch nicht eingesammeltem) Übernahme-Wunsch je Antrag. */
  pendingByAntrag: Map<string, string[]>;
  /** verbundId, für den die Inline-Rücknahme-Bestätigung offen ist (oder null). */
  confirmUnassignId: string | null;
  onSetConfirmUnassign: (verbundId: string | null) => void;
  onUnassignRow: (row: VerbundZuweisungRow) => void;
  unassignBusy: boolean;
}): React.ReactElement {
  const resolveName = useDeAnonResolver();
  // Ein Render-Zeitpunkt für alle Zeilen (Alter der unbestätigten Freigaben).
  const jetzt = Date.now();
  return (
    <div
      className="rounded-[12px] overflow-hidden flex flex-col min-w-0"
      style={{ width: `${leftPct}%`, border: '0.5px solid var(--tf-border)' }}
    >
      <div className="px-3 py-2 flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <span>{isInitialLoading ? '…' : `${rows.length} Verbund${rows.length !== 1 ? 'e' : ''}`}</span>
        {!isInitialLoading && (
          <>
            <span>· nur ohne TIB-Kürzel (letzte {verteilLookbackMonate ?? 6} Mon.)</span>
            <span
              className="cursor-help inline-flex opacity-70 hover:opacity-100"
              title={`Gelistet werden nur Anträge OHNE Bearbeiter-Kürzel (tib_kuerz) mit Antragsdatum aus den letzten ${verteilLookbackMonate ?? 6} Monaten (rollierend — gleitet über den Jahreswechsel). Bereits vergebene, ältere oder „abgelehnt/zurückgezogen"/„Irrläufer"-Anträge erscheinen nicht.`}
              aria-label="Filter-Hinweis: nur unverteilte Anträge der letzten Monate"
            >
              <Info size={11} aria-hidden />
            </span>
          </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {isInitialLoading && (
          <SkeletonRows count={8} columns={[80, 64, 180, 60, 24]} />
        )}
        {!isInitialLoading && rows.map(row => {
          const isSel = selectedAz === row.leadAktenzeichen;
          const rowLead = antragByAz.get(row.leadAktenzeichen);
          const unvollstaendig = rowLead != null && istUnvollstaendigAz(rowLead, gate);
          const unvollstaendigGrundText = unvollstaendig && rowLead ? unvollstaendigGrund(rowLead) : '';
          // 1.17: Primaer (gefuellt) vs Aspekte (outline) trennen.
          const primaerId = row.klassifizierung.freigegebenePrimaer;
          const aspektIds = row.klassifizierung.freigegebeneAspekte;
          const primaerKat = ueberKategorien.find(k => k.id === primaerId);
          const aspektKats = aspektIds
            .map(id => ueberKategorien.find(k => k.id === id))
            .filter((k): k is NonNullable<typeof k> => k != null);
          // Status ueber ALLE TVs des Verbundes aggregieren.
          const ze = zuweisungen.filter(z => row.tvAktenzeichen.includes(z.antragId));
          const zug = ze.some(z => z.status === 'freigegeben');
          // v2.18: an wen zugewiesen (freigegeben) — fuer die „zugewiesen an"-Anzeige.
          const assignedAnonIds = Array.from(new Set(
            ze.filter(z => z.status === 'freigegeben').map(z => z.anonId),
          ));
          // v2.9: distinct Interessenten (selbst-Zuweisungen), zuerst Wollender
          // vorne. v2.288: die Zeile zeigt die Kürzel, nicht nur die Anzahl —
          // in der „offen"-Liste ist sofort sichtbar, WER übernehmen möchte.
          const interessentenAnonIds = interessentenNachWunschzeit(ze).map(z => z.anonId);
          const interessentenNamen = interessentenAnonIds.map(a => resolveName(a) ?? a);
          // Offene (noch nicht eingesammelte) Übernahme-Wünsche — abzüglich
          // bereits im Store erfasster anonIds (sonst Doppel-Signal nach Einsammeln).
          const storeWunschAnonIds = new Set(
            ze.filter(z => z.status === 'selbst' || z.selbstEingetragen || z.status === 'freigegeben').map(z => z.anonId),
          );
          const pendingAnonIds = Array.from(new Set(
            row.tvAktenzeichen.flatMap(az => pendingByAntrag.get(az) ?? []),
          )).filter(a => !storeWunschAnonIds.has(a));
          return (
            <div
              key={row.verbundId}
              onClick={() => onSelect(row.leadAktenzeichen)}
              className="px-3 py-2 cursor-pointer flex items-center gap-2"
              style={{
                background: isSel ? 'var(--tf-bg-secondary)' : 'transparent',
                borderBottom: '0.5px solid var(--tf-border)',
              }}
            >
              {unvollstaendig && (
                <span className="text-amber-600 shrink-0 inline-flex" title={unvollstaendigGrundText} aria-label={unvollstaendigGrundText}>
                  <AlertTriangle size={12} aria-hidden />
                </span>
              )}
              <span className="font-mono text-[11px] text-[var(--tf-text-secondary)] shrink-0">{row.leadAktenzeichen}</span>
              <span
                className="text-[10.5px] text-[var(--tf-text-tertiary)] tabular-nums shrink-0 w-[64px]"
                title="Antragsdatum"
              >
                {formatAntragsdatum(row.antragsdatum)}
              </span>
              {row.akronym && (
                <span className="text-[10.5px] px-1 py-0.5 rounded bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] shrink-0">{row.akronym}</span>
              )}
              <span className="flex-1 truncate text-[12px]" title={row.verbundTitel || undefined}>{row.verbundTitel || '—'}</span>
              {row.tvCount > 1 && (
                <span className="text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0" title={`${row.tvCount} Teilvorhaben`}>×{row.tvCount} TVs</span>
              )}
              <div className="flex gap-0.5">
                {primaerKat && <KategoriePill key={primaerKat.id} kategorie={primaerKat} mode="primaer" />}
                {aspektKats.map(k => <KategoriePill key={k.id} kategorie={k} mode="aspekt" />)}
              </div>
              {zug && (
                <div className="flex items-center gap-1 shrink-0">
                  {/* Die Liste führt nur Anträge OHNE tib_kuerz — eine Freigabe hier
                      ist noch nicht aus dem Fachsystem zurückgemeldet. Nach ein paar
                      Tagen ist das ein Prüfsignal, kein normales Warten. */}
                  {(() => {
                    const offenTage = unbestaetigteFreigabeTage(ze, jetzt);
                    return offenTage === null ? null : (
                      <span
                        className="text-amber-700 text-[10.5px] font-medium shrink-0 cursor-help"
                        title={`Seit ${offenTage} Tagen zugewiesen, aber noch nicht per CSV bestätigt (kein TIB-Kürzel am Antrag). Im Fachsystem prüfen — oder die Zuweisung hier zurücknehmen.`}
                      >
                        ⧗ {offenTage} T
                      </span>
                    );
                  })()}
                  {assignedAnonIds.map(a => (
                    <AnonymIdBadge key={a} anonId={a} size="sm" realName={resolveName(a)} />
                  ))}
                  {confirmUnassignId === row.verbundId ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Zuweisung wirklich zurücknehmen"
                        disabled={unassignBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetConfirmUnassign(null);
                          onUnassignRow(row);
                        }}
                        className="text-[10.5px] font-medium px-1.5 py-0.5 rounded cursor-pointer disabled:opacity-50"
                        style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}
                      >
                        Zurücknehmen
                      </button>
                      <button
                        type="button"
                        title="Abbrechen"
                        onClick={(e) => { e.stopPropagation(); onSetConfirmUnassign(null); }}
                        className="text-[11px] text-[var(--tf-text-tertiary)] px-1 cursor-pointer"
                      >
                        ✗
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="Zuweisung zurücknehmen"
                      onClick={(e) => { e.stopPropagation(); onSetConfirmUnassign(row.verbundId); }}
                      className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer p-0.5 rounded"
                    >
                      <Undo2 size={13} />
                    </button>
                  )}
                </div>
              )}
              {interessentenAnonIds.length > 0 && !zug && (
                <span
                  className="flex items-center gap-1 shrink-0"
                  title={`Übernahme-Wunsch: ${interessentenNamen.join(', ')}`}
                >
                  <span className="text-blue-700 text-[10.5px] font-medium">will</span>
                  {interessentenAnonIds.slice(0, MAX_INTERESSENTEN_BADGES).map(a => (
                    <AnonymIdBadge key={a} anonId={a} size="sm" realName={resolveName(a)} />
                  ))}
                  {interessentenAnonIds.length > MAX_INTERESSENTEN_BADGES && (
                    <span className="text-blue-700 text-[10.5px] font-medium">
                      +{interessentenAnonIds.length - MAX_INTERESSENTEN_BADGES}
                    </span>
                  )}
                </span>
              )}
              {pendingAnonIds.length > 0 && !zug && (
                <span
                  className="text-amber-700 text-[10.5px] font-medium shrink-0"
                  title={`Vorgemerkt (noch nicht eingesammelt): ${pendingAnonIds.map(a => resolveName(a) ?? a).join(', ')}`}
                >
                  ⚑ {pendingAnonIds.length} vorgemerkt
                </span>
              )}
              <ConfidenceDot confidence={row.confidence} manuell={row.manuell} />
            </div>
          );
        })}
        {!isInitialLoading && rows.length === 0 && (
          <div className="px-3 py-8 text-center text-[var(--tf-text-tertiary)] text-[12.5px]">
            Keine freigegebenen Verbünde in dieser Ansicht.
          </div>
        )}
      </div>
    </div>
  );
}
