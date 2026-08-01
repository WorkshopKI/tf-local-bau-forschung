/**
 * Status-Detailsektion (`#status`) der Verbund-Detailseite (Phase 5). Komponiert
 * Timeline + „Warum?"-Panel + Nächste-Schritte aus dem gerätelokalen,
 * read-only `useStatusVerlauf`. Rendert nichts, solange Katalog/Ableitung fehlen
 * (Flag aus oder noch nicht initialisiert).
 *
 * Einklappbar mit Default ZU — im Kopf steht die abgeleitete Phase, aufgeklappt
 * die Begründung dazu.
 */
import { ChevronRight } from 'lucide-react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { HerleitungPopover } from './HerleitungPopover';
import { NaechsteSchritte } from './NaechsteSchritte';
import { useStatusVerlauf } from './useStatusVerlauf';
import { StatusTimeline } from './StatusTimeline';
import { StatusChronik } from './StatusChronik';
import { StatusWarum } from './StatusWarum';
import { StatusCodeListe } from './StatusCodeListe';
import { useTimelinePrefs } from './timelinePrefs';
import { WERKZEUG_LABEL, SPINE_LABEL } from './labels';

export function StatusDetailSection({ verbundId, statusRoh }: {
  verbundId: string;
  /** Der amtliche Verbund-Status — Grundlage der Erklärung (Vorgangssystem). */
  statusRoh?: string | null;
}): React.ReactElement | null {
  const v = useStatusVerlauf(verbundId);
  // Einklappbar, Default ZU (persistierter Zustand gewinnt): die abgeleitete
  // Phase steht als Vorschau im Kopf, Timeline und Begründung sind Nachschlagen.
  // Hook VOR den Early Returns (Hook-Reihenfolge, React #310).
  const [open, toggleOpen] = useCollapsedSection('verbund_status_collapsed', { defaultOpen: false });
  // Eine Präferenz-Instanz für beide Verlaufs-Ansichten (Hook vor den Early
  // Returns — React #310).
  const prefsApi = useTimelinePrefs();

  if (v.laden) {
    return <div className="text-[13px] text-[var(--tf-text-tertiary)]">Lädt …</div>;
  }
  if (!v.version || !v.ableitung) return null;
  const version = v.version;
  const ableitung = v.ableitung;

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronRight
            size={15}
            className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span className="text-[16px] font-medium text-[var(--tf-text)]">Status &amp; Verlauf</span>
        </button>
        {/* Vorschau: die abgeleitete Phase — sonst sagt die eingeklappte Zeile nichts. */}
        <span className="text-[12px] text-[var(--tf-text-secondary)]">{SPINE_LABEL[ableitung.spinePhase]}</span>
        {/* Die Status-Erklärung des Vorgangssystems: hier steht sie NEBEN der
            abgeleiteten Phase, nicht an ihrer Stelle — die beiden Lesarten
            gehen auseinander (siehe Diagnose-Report), und bis zum Rückbau soll
            man beide sehen können. */}
        {isVorgangssystemEnabled() && (
          <HerleitungPopover verbundId={verbundId} statusRoh={statusRoh} />
        )}
        {ableitung.konflikt ? (
          <span className="text-[12px] text-[var(--tf-warning-text)]">Widersprüchliche Statussignale</span>
        ) : null}
      </div>

      <div className={open ? undefined : 'hidden'}>
      {/* Zwei Sichten auf denselben Verlauf: die Chronik liest die Termine aus
          den Datumsfeldern (immer da), der Zeitstrahl das gerätelokale
          Ereignis-Protokoll (erst nach der ersten aufgezeichneten Änderung). */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <ToggleChip
          label="Chronik"
          selected={prefsApi.prefs.ansicht === 'chronik'}
          onToggle={() => prefsApi.setAnsicht('chronik')}
        />
        <ToggleChip
          label="Zeitstrahl"
          selected={prefsApi.prefs.ansicht === 'zeitstrahl'}
          onToggle={() => prefsApi.setAnsicht('zeitstrahl')}
        />
      </div>
      {prefsApi.prefs.ansicht === 'chronik' ? (
        <StatusChronik
          vorkommen={v.vorkommen}
          version={version}
          zeigeNebensaechlich={prefsApi.prefs.zeigeNebensaechlich}
          onToggleNebensaechlich={() => prefsApi.setNebensaechlich(!prefsApi.prefs.zeigeNebensaechlich)}
        />
      ) : (
        <StatusTimeline events={v.events} version={version} grenze={v.grenze} prefsApi={prefsApi} />
      )}

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-2">Warum dieser Status?</div>
          <StatusWarum ableitung={ableitung} version={version} />
        </div>
        <div>
          <div className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-2">Nächste Schritte</div>
          {ableitung.naechsteSchritte.length === 0 ? (
            <div className="text-[12px] text-[var(--tf-text-tertiary)]">Keine offenen Schritte abgeleitet.</div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {ableitung.naechsteSchritte.map((s, i) => (
                <li
                  key={`${s.regelId}:${i}`}
                  className="flex items-center gap-2 text-[12px] text-[var(--tf-text)]"
                >
                  <span>{s.label}</span>
                  {s.werkzeug ? (
                    <span className="text-[10.5px] px-1.5 py-[1px] rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
                      {WERKZEUG_LABEL[s.werkzeug]}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Der Navigator des Vorgangssystems. Er steht NEBEN den abgeleiteten
          „Nächsten Schritten" oben, nicht an ihrer Stelle: die dort kommen aus
          unseren fünf Alt-Regeln, diese aus der Trigger-Tabelle des
          Fachsystems. Bis zum Rückbau soll man beide vergleichen können. */}
      <div className="mt-5">
        <NaechsteSchritte version={version} vorkommen={v.vorkommen} statusRoh={statusRoh} />
      </div>

      {/* Die Ordner des Fachsystems: was steht wo. Die Timeline oben beantwortet
          „wann", diese Liste „in welchem Ordner". */}
      <div className="mt-5">
        <StatusCodeListe version={version} vorkommen={v.vorkommen} />
      </div>
      </div>
    </div>
  );
}
