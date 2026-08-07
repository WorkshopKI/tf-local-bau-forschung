/**
 * Status-Detailsektion (`#status`) der Verbund-Detailseite. Komponiert Chronik
 * bzw. Zeitstrahl, die Status-Erklärung und den Navigator aus dem gerätelokalen,
 * read-only `useStatusVerlauf`. Rendert nichts, solange der Katalog fehlt (Flag
 * aus oder noch nicht initialisiert).
 *
 * Einklappbar mit Default ZU — im Kopf steht die **ZAH-Phase** des amtlichen
 * Status, aufgeklappt der Verlauf.
 *
 * Bis v2.383 stand hier die abgeleitete Spine-Phase, daneben ein „Warum dieser
 * Status?"-Panel aus Rängen und ein zweiter Block „Nächste Schritte" aus fünf
 * handgeschriebenen Regeln. Beide sind mit dem Rückbau entfallen: die Frage
 * „warum?" beantwortet das Herleitungs-Popover aus dem amtlichen Status, die
 * Frage „was jetzt?" der Navigator aus der Trigger-Tabelle. Zwei
 * Erklärungs-Oberflächen nebeneinander waren der Übergangszustand, nicht das Ziel.
 */
import { useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { zahPhaseLabel, zahPhaseFuerStatusText } from '@/core/status';
import { HerleitungPopover } from './HerleitungPopover';
import { NaechsteSchritte } from './NaechsteSchritte';
import { OffeneAufgaben } from './OffeneAufgaben';
import { useStatusVerlauf } from './useStatusVerlauf';
import { StatusTimeline } from './StatusTimeline';
import { StatusChronik } from './StatusChronik';
import { StatusCodeListe } from './StatusCodeListe';
import { useTimelinePrefs } from './timelinePrefs';
import { VerbundBand } from '../verlauf-band/VerbundBand';
import { VerbundFristenBand } from '../fristen-band/VerbundFristenBand';

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
  // Einmal je Seitenaufruf gestempelt und in die reine Engine injiziert — nie
  // eine Uhr in der Berechnung (Hook vor den Early Returns, React #310).
  const stichtagRef = useRef<string>(new Date().toISOString());
  const stichtag = stichtagRef.current;

  if (v.laden) {
    return <div className="text-[13px] text-[var(--tf-text-tertiary)]">Lädt …</div>;
  }
  if (!v.version) return null;
  const version = v.version;
  // Die Phase des AMTLICHEN Status — nicht abgeleitet. Ohne Katalog-Treffer
  // bleibt die Vorschau leer statt eine Phase zu erfinden.
  const phase = zahPhaseFuerStatusText(statusRoh);

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
        {/* Vorschau: die ZAH-Phase — sonst sagt die eingeklappte Zeile nichts. */}
        {phase !== null && (
          <span className="text-[12px] text-[var(--tf-text-secondary)]">
            {zahPhaseLabel(phase, version.zahPhasen)}
          </span>
        )}
        {isVorgangssystemEnabled() && (
          <HerleitungPopover verbundId={verbundId} statusRoh={statusRoh} ebene="verbund" />
        )}
      </div>

      {/* Die Bearbeitungsfrist steht VOR dem Aufklapp-Rumpf und AUSSERHALB der
          drei Verlaufs-Sichten: sie ist ein anderer Gegenstand als „wann war
          was", und wer die Seite öffnet, will sie sehen, ohne erst aufzuklappen. */}
      <div className="mb-4 max-w-[640px]">
        <VerbundFristenBand verbundId={verbundId} statusRoh={statusRoh} stichtag={stichtag} />
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
        {/* Die dritte Sicht: die ABGELEITETE Bahn aus den Datumsspalten. Der
            Zeitstrahl daneben zeigt das gerätelokale Ereignis-Protokoll und ist
            damit erst ab dessen Nullpunkt vollständig — das Band reicht so weit
            zurück wie die Termine. Zwei Antworten auf „wann", zwei Quellen. */}
        {isVorgangssystemEnabled() && (
          <ToggleChip
            label="Band"
            selected={prefsApi.prefs.ansicht === 'band'}
            onToggle={() => prefsApi.setAnsicht('band')}
          />
        )}
      </div>
      {prefsApi.prefs.ansicht === 'chronik' && (
        <StatusChronik
          vorkommen={v.vorkommen}
          version={version}
          zeigeNebensaechlich={prefsApi.prefs.zeigeNebensaechlich}
          onToggleNebensaechlich={() => prefsApi.setNebensaechlich(!prefsApi.prefs.zeigeNebensaechlich)}
        />
      )}
      {prefsApi.prefs.ansicht === 'zeitstrahl' && (
        <StatusTimeline events={v.events} version={version} grenze={v.grenze} prefsApi={prefsApi} />
      )}
      {prefsApi.prefs.ansicht === 'band' && (
        <VerbundBand verbundId={verbundId} statusRoh={statusRoh} stichtag={stichtag.slice(0, 10)} />
      )}

      {/* Was steht an — dieselbe Kaskade wie im Board, je Teilvorhaben und je
          Rolle. Steht VOR dem Navigator: „was ist meine Aufgabe" kommt vor
          „welches Kürzel setze ich dafür". */}
      {isVorgangssystemEnabled() && (
        <div className="mt-5">
          <OffeneAufgaben
            version={version} jeTeilvorhaben={v.jeTeilvorhaben} stichtag={stichtag}
          />
        </div>
      )}

      {/* Der Navigator: was ist als Nächstes zu setzen, von wem, was löst es aus.
          Aus der Trigger-Tabelle des Fachsystems — nicht abgeleitet. */}
      <div className="mt-5">
        <NaechsteSchritte
          version={version} vorkommen={v.vorkommen} statusRoh={statusRoh} programm={v.programm}
        />
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
