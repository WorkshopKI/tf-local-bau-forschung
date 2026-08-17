/**
 * Die Sektion **„Nicht im Blick"** unter dem Ordnerbaum des Kürzel-Tabs.
 *
 * Der Katalog führt gut 500 Kürzel, von denen die App knapp die Hälfte nie zu
 * sehen bekommt. Sie stehen weiterhin da — nichts wird gelöscht —, aber
 * zugeklappt und mit ihrem Grund davor, damit die Arbeit sich auf die Kürzel
 * richten kann, die wirklich laufen.
 *
 * **Zwei Gründe, zwei Untergruppen, und die bleiben getrennt.** „Kommt im Export
 * nicht vor" heißt nicht „außer Gebrauch": das Fachsystem setzt `YE`
 * (E-Mail) sicher täglich, nur exportiert es die Spalte nicht. Beides in einen
 * Topf zu werfen hieße, eine Falschaussage zu beschriften.
 *
 * Flache Tabelle statt Ordnerbaum: hier wird nichts mehr einsortiert, hier wird
 * nachgeschlagen und im Zweifel ein Kürzel zurückgeholt.
 */
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { zaehlwort } from '@/core/utils/zaehlwort';
import type { RuheGrund, SchlafendesKuerzel, StatusFeldEintrag } from '@/core/status';
import { EBENE_LABEL, feldStil } from './labels';

const thKlasse = 'text-left font-medium text-[11px] text-[var(--tf-text-tertiary)] px-2 py-1.5 whitespace-nowrap';
const tdKlasse = 'px-2 py-1.5 align-middle text-[12px]';
const leise = 'text-[11.5px] text-[var(--tf-text-tertiary)]';
const zahl = (n: number): string => n.toLocaleString('de-DE');

/** Ein ruhendes Feld samt seinem Grund und dem, was der Bestand dazu weiß. */
export interface RuhendeZeile {
  feld: StatusFeldEintrag;
  grund: Exclude<RuheGrund, null>;
  ordner: string;
  /** Frühere Treffer aus dem Bestandslauf; `null` = nicht gemessen. */
  frueher: number | null;
}

function Tabelle({ zeilen, onBeachten }: {
  zeilen: readonly RuhendeZeile[];
  onBeachten: (feldId: string) => void;
}): React.ReactElement {
  return (
    <div className="overflow-x-auto rounded" style={feldStil}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
            <th className={thKlasse}>Code</th>
            <th className={thKlasse}>Bezeichnung</th>
            <th className={thKlasse}>Ebene</th>
            <th className={thKlasse}>Ordner</th>
            <th className={thKlasse}>früher gesetzt</th>
            <th
              className={`${thKlasse} text-center`}
              title="Holt das Kürzel zurück in den Ordnerbaum, in die Regel-Auswahl und in die Klärfragen"
            >
              trotzdem beachten
            </th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map(({ feld, ordner, frueher }) => (
            <tr key={feld.feldId} className="border-b border-[var(--tf-border)] hover:bg-[var(--tf-hover)]">
              <td className={`${tdKlasse} font-mono whitespace-nowrap text-[var(--tf-text-secondary)]`}>
                <span>{feld.code ?? feld.feldId}</span>
                {feld.relevant === true && (
                  <Badge variant="warning" className="ml-1.5">relevant</Badge>
                )}
              </td>
              <td className={`${tdKlasse} text-[var(--tf-text)]`}>{feld.label}</td>
              <td className={`${tdKlasse} text-[var(--tf-text-tertiary)]`}>{EBENE_LABEL[feld.ebene]}</td>
              <td className={`${tdKlasse} text-[var(--tf-text-tertiary)]`}>{ordner}</td>
              <td className={`${tdKlasse} tabular-nums text-[var(--tf-text-tertiary)]`}>
                {frueher === null ? '—' : frueher === 0 ? 'nie' : `${zahl(frueher)}×`}
              </td>
              <td className={`${tdKlasse} text-center`}>
                <input
                  type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer"
                  checked={feld.ruht === false}
                  onChange={() => onBeachten(feld.feldId)}
                  title="Zurück in den Blick holen"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Untergruppe({ id, titel, erklaerung, zeilen, suchModus, onBeachten }: {
  id: string;
  titel: string;
  erklaerung: string;
  zeilen: readonly RuhendeZeile[];
  suchModus: boolean;
  onBeachten: (feldId: string) => void;
}): React.ReactElement | null {
  const [offen, toggle] = useCollapsedSection(
    `status-cockpit:ruhend:${id}`, { defaultOpen: false },
  );
  if (zeilen.length === 0) return null;
  const zeigeOffen = offen || suchModus;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button" aria-expanded={zeigeOffen} onClick={toggle} disabled={suchModus}
        className="flex items-center gap-1.5 py-1 text-left cursor-pointer disabled:cursor-default"
      >
        <ChevronRight
          size={13} className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
          style={{ transform: zeigeOffen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-[13px] font-medium text-[var(--tf-text)]">{titel}</span>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">{zeilen.length}</span>
      </button>
      <p className={`${leise} pl-[19px]`}>{erklaerung}</p>
      {zeigeOffen && <Tabelle zeilen={zeilen} onBeachten={onBeachten} />}
    </div>
  );
}

/**
 * Der Vorschlag aus dem Bestandslauf — steht **über** den Gruppen, weil er eine
 * Aktion ist und die Gruppen darunter nur Nachschlagewerk sind.
 *
 * Erscheint nur nach einem Durchgang und nur, wenn er etwas gefunden hat. Ohne
 * Messung steht hier nichts: „0 eingeschlafene Kürzel" wäre die Zahl vor der
 * Messung, nicht ihr Ergebnis.
 */
function Vorschlag({ schlafend, jahre, onRuhenLassen }: {
  schlafend: readonly SchlafendesKuerzel[];
  jahre: readonly number[];
  onRuhenLassen: () => void;
}): React.ReactElement | null {
  if (schlafend.length === 0) return null;
  const spitze = schlafend.slice(0, 4);
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap rounded px-2.5 py-2" style={feldStil}>
      <span className="text-[12.5px] text-[var(--tf-text)]">
        {zaehlwort(schlafend.length, 'Kürzel hat', 'Kürzel haben')} eine Spalte im Export, {}
        {schlafend.length === 1 ? 'wurde' : 'wurden'} in {}
        {jahre.length === 1 ? `Richtlinie ${jahre[0]}` : `den Richtlinien ${jahre.join(' + ')}`} {}
        aber nicht mehr gesetzt.{' '}
        <span className={leise}>
          {spitze.map(s => `${s.code} (${s.frueher === 0 ? 'nie' : `${zahl(s.frueher)}× früher`})`).join(', ')}
          {schlafend.length > spitze.length && ' …'}
        </span>
      </span>
      <Button variant="secondary" size="sm" onClick={onRuhenLassen}>
        {zaehlwort(schlafend.length, 'Kürzel', 'Kürzel')} ruhen lassen
      </Button>
    </div>
  );
}

export function RuhendeKuerzel({
  zeilen, schlafend, jahre, relevanteRuhende, suchModus,
  onBeachten, onRuhenLassen, onRelevanzRaeumen,
}: {
  zeilen: readonly RuhendeZeile[];
  /** Was der Bestandslauf zusätzlich zum Ruhen vorschlägt (leer ohne Messung). */
  schlafend: readonly SchlafendesKuerzel[];
  jahre: readonly number[];
  /** Ruhende Felder mit Relevanz-Häkchen — Kuration, die nirgends ankommt. */
  relevanteRuhende: readonly string[];
  /** Bei aktiver Suche steht die Sektion offen — sonst versteckte sie Treffer. */
  suchModus: boolean;
  onBeachten: (feldId: string) => void;
  onRuhenLassen: () => void;
  onRelevanzRaeumen: () => void;
}): React.ReactElement | null {
  const [offen, toggle] = useCollapsedSection(
    'status-cockpit:ruhende-kuerzel', { defaultOpen: false },
  );
  if (zeilen.length === 0 && schlafend.length === 0) return null;
  const zeigeOffen = offen || suchModus;

  const ohneSpalte = zeilen.filter(z => z.grund === 'nicht-im-export');
  const kuratiert = zeilen.filter(z => z.grund === 'kuratiert');

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button" aria-expanded={zeigeOffen} onClick={toggle} disabled={suchModus}
        title={suchModus ? 'Während der Suche steht die Sektion offen' : undefined}
        className="flex items-center gap-1.5 text-left cursor-pointer disabled:cursor-default"
      >
        <ChevronRight
          size={14} className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
          style={{ transform: zeigeOffen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-[13px] font-medium text-[var(--tf-text)]">Nicht im Blick</span>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">{zeilen.length}</span>
      </button>

      <div className={zeigeOffen ? 'flex flex-col gap-3' : 'hidden'}>
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Diese Kürzel bleiben vollständig erhalten, halten sich aber aus Ordnerbaum,
          Regel-Auswahl und Klärfragen heraus. Was am Antrag steht, bleibt sichtbar —
          eine Chronik von 2017 verliert keinen Eintrag.
        </p>

        <Vorschlag schlafend={schlafend} jahre={jahre} onRuhenLassen={onRuhenLassen} />

        {relevanteRuhende.length > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap rounded px-2.5 py-2" style={feldStil}>
            <span className="text-[12.5px] text-[var(--tf-text)]">
              {zaehlwort(relevanteRuhende.length, 'ruhendes Kürzel trägt', 'ruhende Kürzel tragen')}
              {' '}ein Relevanz-Häkchen. Navigator und Wächter sehen sie nie — das Häkchen
              wirkt dort nicht.
            </span>
            <Button variant="secondary" size="sm" onClick={onRelevanzRaeumen}>
              Häkchen abräumen
            </Button>
          </div>
        )}

        <Untergruppe
          id="ohne-spalte" titel="Kommt im Export nicht vor" zeilen={ohneSpalte}
          erklaerung={'Keine der CSV-Quellen führt eine D_- oder T_-Spalte dazu. Das Fachsystem '
            + 'setzt diese Kürzel möglicherweise weiterhin — unsere Daten zeigen sie nur nie, '
            + 'und deshalb kann hier keine Phase, keine Regel und keine Frage greifen.'}
          suchModus={suchModus} onBeachten={onBeachten}
        />
        <Untergruppe
          id="kuratiert" titel="Von der Projektleitung ruhend gestellt" zeilen={kuratiert}
          erklaerung={'Eine Spalte gibt es, gesetzt wurde sie in den aktuellen Richtlinien aber '
            + 'nicht mehr. Die Zahl rechts sagt, wie oft das Kürzel früher lief.'}
          suchModus={suchModus} onBeachten={onBeachten}
        />
      </div>
    </section>
  );
}
