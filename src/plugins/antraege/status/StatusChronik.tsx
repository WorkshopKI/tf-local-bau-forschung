/**
 * Senkrechte Chronik des Verbunds — der Verlauf als Zeitstrahl von oben nach
 * unten, gruppiert nach Monat.
 *
 * Warum senkrecht und warum aus den Datumsfeldern: die waagerechte Lane-Ansicht
 * ([StatusTimeline](./StatusTimeline.tsx)) zeigt das gerätelokale
 * Ereignis-Protokoll und bleibt leer, solange diese Installation noch keine
 * Änderung mitgeschrieben hat. Die Termine im Vorgang gibt es trotzdem — sie
 * stehen in den Datumsfeldern und ergeben, chronologisch gelesen, die
 * eigentliche Geschichte des Antrags. Senkrecht, weil ein Termin dann eine
 * Zeile mit Datum, Bezeichnung und Begleittext bekommt statt eines Punktes mit
 * Tooltip.
 *
 * Rein darstellend: `baueChronik` liefert die Daten, hier wird nur gerendert.
 */
import { Milestone } from 'lucide-react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import {
  baueChronik, gruppiereNachMonat, kategoriePfadLabel,
  type ChronikEintrag, type FeldVorkommen, type MappingVersion,
} from '@/core/status';
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import { SPINE_LABEL } from './labels';

/** `2026-03` → „März 2026". */
function monatLabel(monat: string): string {
  const d = new Date(`${monat}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return monat;
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

/** `2026-03-10` → „10.03." — das Jahr steht schon in der Monatsüberschrift.
 *  Über die zentrale Kette, damit hier nicht ein zweites Datumsformat entsteht. */
function tagLabel(tag: string): string {
  return formatDatumsWert(tag).slice(0, 6);
}

/** Punkt auf der Achse, Größe nach Prominenz (gleiche Sprache wie die Lane-Ansicht). */
function Punkt({ eintrag }: { eintrag: ChronikEintrag }): React.ReactElement {
  const p = eintrag.feld.prominenzDefault;
  if (p === 'meilenstein') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 18, height: 18, background: 'var(--tf-primary)', color: 'var(--tf-on-primary)' }}
      >
        <Milestone size={11} aria-hidden="true" />
      </span>
    );
  }
  if (p === 'nebensaechlich') {
    return (
      <span
        className="inline-block rounded-full"
        style={{ width: 7, height: 7, border: '1px solid var(--tf-text-tertiary)', background: 'var(--tf-bg)' }}
      />
    );
  }
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: 9, height: 9, background: 'var(--tf-text-tertiary)' }}
    />
  );
}

/** Wer trägt den Eintrag: der Verbund oder N Teilvorhaben. */
function traegerLabel(tvIds: readonly string[]): string {
  if (tvIds.length === 0) return 'Verbund';
  if (tvIds.length === 1) return tvIds[0] ?? '';
  return `${tvIds.length} Teilvorhaben`;
}

export function StatusChronik({
  vorkommen,
  version,
  zeigeNebensaechlich,
  onToggleNebensaechlich,
}: {
  vorkommen: FeldVorkommen[];
  version: MappingVersion;
  zeigeNebensaechlich: boolean;
  onToggleNebensaechlich: () => void;
}): React.ReactElement {
  const eintraege = baueChronik(vorkommen, { zeigeNebensaechlich });
  const monate = gruppiereNachMonat(eintraege);
  const kategorien = version.kategorien ?? [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ToggleChip
          label="Nebensächliches"
          selected={zeigeNebensaechlich}
          onToggle={onToggleNebensaechlich}
        />
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {eintraege.length} {eintraege.length === 1 ? 'Termin' : 'Termine'} aus den Datumsfeldern
        </span>
      </div>

      {eintraege.length === 0 ? (
        <div className="py-6 text-[12px] text-[var(--tf-text-tertiary)]">
          Keine datierten Statuseinträge. Wert- und Textfelder stehen unten in der Ordner-Ansicht.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {monate.map(m => (
            <div key={m.monat}>
              <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">
                {monatLabel(m.monat)}
              </div>
              <ol className="ml-[9px] border-l border-[var(--tf-border)]">
                {m.eintraege.map(e => (
                  <li key={`${e.feld.feldId}:${e.tag}`} className="relative py-[3px] pl-5">
                    <span
                      className="absolute left-0 flex -translate-x-1/2 items-center justify-center"
                      style={{ width: 18, height: 18, top: 4 }}
                    >
                      <Punkt eintrag={e} />
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="w-[46px] shrink-0 font-mono text-[11px] text-[var(--tf-text-tertiary)]">
                        {tagLabel(e.tag)}
                      </span>
                      <span
                        className={`text-[12.5px] text-[var(--tf-text)] ${
                          e.feld.prominenzDefault === 'meilenstein' ? 'font-medium' : ''}`}
                        title={kategoriePfadLabel(kategorien, e.feld.kategorieId) || undefined}
                      >
                        {e.feld.label}
                      </span>
                      {e.feld.spinePhase && e.feld.spinePhase !== 'keine' ? (
                        <span className="rounded-full bg-[var(--tf-bg-secondary)] px-1.5 py-[1px] text-[10.5px] text-[var(--tf-text-secondary)]">
                          {SPINE_LABEL[e.feld.spinePhase]}
                        </span>
                      ) : null}
                      <span className="truncate text-[11px] text-[var(--tf-text-tertiary)]">
                        {traegerLabel(e.tvIds)}
                      </span>
                    </div>
                    {e.text ? (
                      <div className="pl-[54px] text-[11.5px] text-[var(--tf-text-secondary)]">{e.text}</div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
