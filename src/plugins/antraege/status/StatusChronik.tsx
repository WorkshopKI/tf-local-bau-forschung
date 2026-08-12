/**
 * Senkrechte Chronik des Verbunds — der Verlauf als Zeitstrahl von oben nach
 * unten, gruppiert nach Monat.
 *
 * Warum senkrecht und warum aus den Datumsfeldern: die waagerechte Lane-Ansicht
 * ([StatusTimeline](./StatusTimeline.tsx)) zeigt das gerätelokale
 * Ereignis-Protokoll und bleibt leer, solange diese Installation noch keine
 * Änderung mitgeschrieben hat. Die Termine im Vorgang gibt es trotzdem — sie
 * stehen in den Datumsfeldern und ergeben, chronologisch gelesen, die
 * eigentliche Geschichte des Antrags.
 *
 * **Ungekürzt, überall.** Die Liste bekommt keinen Höhendeckel und keinen
 * eigenen Scrollbereich — auch nicht im aufgeklappten Bereich der Tabelle, wo
 * sie länger wird als die Zeile. Ein Kasten, der zehn von 22 Terminen zeigt,
 * liest sich als der ganze Verlauf; die Länge fangen dort die Blöcke darunter
 * ab, indem sie zugeklappt anfangen ({@link VorgangsverlaufReiter}).
 *
 * **Deshalb ist die Höhe hier ein Entwurfsziel.** Gemessen über 13 090 Vorgänge:
 * Median 22 Termine in 6 Monaten, p90 32 in 9. Drei Entscheidungen folgen daraus
 * — der Monat steht in einer **eigenen linken Spalte** statt in einer eigenen
 * Zeile, jeder Termin belegt **genau eine** Zeile (Begleittext gekürzt, voller
 * Wortlaut im Tooltip), und die senkrechte Achse läuft durch alle Monate durch,
 * weil der Blockabstand innerhalb der Liste entsteht.
 *
 * Rein darstellend: `baueChronik` liefert die Daten, hier wird nur gerendert.
 */
import { Milestone } from 'lucide-react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import {
  baueChronik, gruppiereNachMonat, kategoriePfadLabel, monateDazwischen, teileChronik,
  traegerLabel, zahPhaseLabel,
  type ChronikEintrag, type FeldVorkommen, type MappingVersion,
} from '@/core/status';
import { formatDatumsWert } from '@/core/services/csv/dateParse';

/** Ab wann eine Pause eigens benannt wird — ein übersprungener Monat ist Alltag. */
const LUECKE_AB = 2;

const LEISE = 'text-[var(--tf-text-tertiary)]';

/** `2026-03` → „März 2026" in der Kurzform, die in die schmale Spalte passt. */
function monatLabel(monat: string): string {
  const d = new Date(`${monat}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return monat;
  return d.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
}

/** `2026-03-10` → „10.03." — das Jahr steht schon in der Monatsspalte.
 *  Über die zentrale Kette, damit hier nicht ein zweites Datumsformat entsteht. */
function tagLabel(tag: string): string {
  return formatDatumsWert(tag).slice(0, 6);
}

/**
 * Was der Tooltip einer Zeile trägt: Bezeichnung, Begleittext im **vollen**
 * Wortlaut, Ordnerpfad. Die Zeile selbst kürzt — der Titel darf das nicht.
 */
function zeilenTitel(e: ChronikEintrag, pfad: string): string {
  return [e.feld.label, e.text, pfad].filter(t => t !== undefined && t !== '').join('\n');
}

/** Punkt auf der Achse, Größe nach Prominenz (gleiche Sprache wie die Lane-Ansicht). */
function Punkt({ eintrag }: { eintrag: ChronikEintrag }): React.ReactElement {
  const p = eintrag.feld.prominenzDefault;
  if (p === 'meilenstein') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 14, height: 14, background: 'var(--tf-primary)', color: 'var(--tf-on-primary)' }}
      >
        <Milestone size={9} aria-hidden="true" />
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

/** Eine Zeile: Punkt · Tag · Bezeichnung (+ Notiz) · Phase · Träger. */
function Zeile({ e, version }: { e: ChronikEintrag; version: MappingVersion }): React.ReactElement {
  const pfad = kategoriePfadLabel(version.kategorien ?? [], e.feld.kategorieId);
  return (
    <li className="relative pl-4">
      <span
        className="absolute left-0 flex -translate-x-1/2 items-center justify-center"
        style={{ width: 14, height: 14, top: 3 }}
      >
        <Punkt eintrag={e} />
      </span>
      {/* Kein senkrechtes Padding: die Zeilenhöhe trägt den Abstand allein —
          bei 28 Terminen sind 3 px je Zeile ein ganzer Eintrag. Und sie steht
          in **px**, nicht als Faktor: ein Faktor rechnet gegen die geerbte
          Schriftgröße, und die ist im Ausklapp eine andere als auf der
          Detailseite (gemessen: 20 px hier, 24 px dort). Dieselbe Ansicht darf
          nicht je nach Umgebung eine andere Dichte haben. */}
      <div className="flex items-baseline gap-2 leading-[18px]">
        <span className={`w-[42px] shrink-0 font-mono text-[11px] ${LEISE}`}>
          {tagLabel(e.tag)}
        </span>
        <span className="min-w-0 flex-1 truncate" title={zeilenTitel(e, pfad)}>
          <span
            className="text-[12.5px] text-[var(--tf-text)]"
            style={e.feld.prominenzDefault === 'meilenstein' ? { fontWeight: 500 } : undefined}
          >
            {e.feld.label}
          </span>
          {e.text ? (
            <span className={`text-[11.5px] ${LEISE}`}>{' · '}{e.text}</span>
          ) : null}
        </span>
        {e.feld.zahPhaseId ? (
          <span className="shrink-0 rounded-full bg-[var(--tf-bg-secondary)] px-1.5 text-[10.5px] text-[var(--tf-text-secondary)]">
            {zahPhaseLabel(e.feld.zahPhaseId, version.zahPhasen)}
          </span>
        ) : null}
        <span className={`shrink-0 min-w-[72px] text-right text-[11px] ${LEISE}`}>
          {traegerLabel(e.tvIds)}
        </span>
      </div>
    </li>
  );
}

export function StatusChronik({
  vorkommen,
  version,
  zeigeNebensaechlich,
  onToggleNebensaechlich,
}: {
  /** `readonly`, weil der Ausklapp seine Vorkommen unveränderlich durchreicht
   *  (`ZeilenVerlauf.vorkommen`) — gelesen wird hier ohnehin nur. */
  vorkommen: readonly FeldVorkommen[];
  version: MappingVersion;
  zeigeNebensaechlich: boolean;
  onToggleNebensaechlich: () => void;
}): React.ReactElement {
  // EIN Aufbau, danach geteilt: die Anzeige muss wissen, ob der Schalter
  // überhaupt etwas bewirkt, bevor sie ihn anbietet (`teileChronik`). Die
  // volle Liste wird NICHT neu sortiert — sie kommt bereits geordnet, und eine
  // zweite Sortierregel wäre eine zweite Ordnung über denselben Daten.
  const alle = baueChronik(vorkommen, { zeigeNebensaechlich: true });
  const { haupt, neben } = teileChronik(alle);
  const eintraege = zeigeNebensaechlich ? alle : haupt;
  const monate = gruppiereNachMonat(eintraege);

  const ersterMonat = monate[0]?.monat;
  const letzterMonat = monate[monate.length - 1]?.monat;
  const spanne = ersterMonat === undefined || letzterMonat === undefined
    ? null
    : ersterMonat === letzterMonat
      ? monatLabel(ersterMonat)
      : `${monatLabel(ersterMonat)} – ${monatLabel(letzterMonat)}`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {neben.length > 0 && (
          <ToggleChip
            label={`Nebensächliches ${neben.length}`}
            selected={zeigeNebensaechlich}
            onToggle={onToggleNebensaechlich}
          />
        )}
        <span className={`text-[11.5px] ${LEISE}`}>
          {eintraege.length} {eintraege.length === 1 ? 'Termin' : 'Termine'} aus den Datumsfeldern
          {spanne === null ? '' : ` · ${spanne}`}
        </span>
      </div>

      {eintraege.length === 0 ? (
        <div className={`py-6 text-[12px] ${LEISE}`}>
          Keine datierten Statuseinträge. Wert- und Textfelder stehen unten in der Ordner-Ansicht.
        </div>
      ) : (
        <div className="flex flex-col">
          {monate.map((m, i) => {
            const vorheriger = monate[i - 1]?.monat;
            const luecke = vorheriger === undefined ? 0 : monateDazwischen(vorheriger, m.monat);
            const abstand = i === 0 ? '' : 'pt-2';
            return (
              <div key={m.monat} className="flex">
                <div className={`w-[84px] shrink-0 pr-2 ${abstand}`}>
                  <div className={`text-[11px] font-medium uppercase tracking-wide ${LEISE}`}>
                    {monatLabel(m.monat)}
                  </div>
                  {luecke >= LUECKE_AB ? (
                    <div className={`text-[10px] leading-tight ${LEISE}`} style={{ opacity: 0.75 }}>
                      {luecke} Monate ohne Termin
                    </div>
                  ) : null}
                </div>
                <ol className={`min-w-0 flex-1 border-l border-[var(--tf-border)] ${abstand}`}>
                  {m.eintraege.map(e => (
                    <Zeile key={`${e.feld.feldId}:${e.tag}`} e={e} version={version} />
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
