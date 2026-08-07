/**
 * Der Reiter **Klärfragen**: was aus dem Bestand offen ist, gezählt je Herkunft,
 * und der Knopf, der daraus die Datei macht.
 *
 * **Reine Anzeige, kein Zustand.** Es gibt hier nichts zu beantworten und nichts
 * zu speichern — die Fälle werden bei jedem Lauf neu abgeleitet, und die
 * Antworten kommen außerhalb der App zurück. Wer in der App antworten will,
 * meint das Modul „Zu klären"; das ist ein Fragebogen und etwas anderes.
 *
 * **Die Liste steht erst nach dem Knopfdruck da.** Ein Durchgang über den
 * ganzen Bestand darf nicht bei jedem Reiterwechsel laufen, und eine Zahl ohne
 * Bestandsstempel wäre eine Behauptung.
 */
import { useState } from 'react';
import { ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { zaehlwort } from '@/core/utils/zaehlwort';
import {
  HERKUENFTE, HERKUNFT_ADRESSAT, HERKUNFT_LABEL,
  type Klaerfrage, type KlaerfragenBestand,
} from '@/core/status/klaerfragen';
import { SCHREIBFEHLER } from '@/core/status/schreibfehler';
import { exportiereKlaerfragen } from './klaerfragenExport';
import { useKlaerfragen } from './useKlaerfragen';
import { feldStil } from './labels';
import type { StatusCockpitApi } from './useStatusCockpit';

const leise = 'text-[11.5px] text-[var(--tf-text-tertiary)]';
const zahl = (n: number): string => n.toLocaleString('de-DE');

function kurzDatum(iso: string | null): string {
  if (iso === null || iso === '') return 'unbekannt';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE');
}

function Zeile({ f }: { f: Klaerfrage }): React.ReactElement {
  const [offen, setOffen] = useState(false);
  return (
    <li className="border-b border-[var(--tf-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-expanded={offen}
        className="w-full flex items-baseline gap-2 py-1.5 text-left cursor-pointer"
      >
        <ChevronRight
          size={13}
          className="text-[var(--tf-text-tertiary)] shrink-0 self-center transition-transform duration-150"
          style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="font-mono tabular-nums text-[11.5px] text-[var(--tf-text-tertiary)] w-[64px] shrink-0 text-right">
          {f.vorkommen === null ? '—' : `${zahl(f.vorkommen)}×`}
        </span>
        <span className="text-[12.5px] text-[var(--tf-text)] font-medium w-[150px] shrink-0 truncate">
          {f.betrifft}
        </span>
        <span className="text-[12.5px] text-[var(--tf-text-secondary)] flex-1">{f.frage}</span>
      </button>
      {offen && (
        <div className="pl-[86px] pb-2 flex flex-col gap-1">
          <p className="text-[12px] text-[var(--tf-text-secondary)]">{f.kontext}</p>
          {f.optionen !== undefined && (
            <p className={leise}>Vorgeschlagene Antworten: {f.optionen.join(' · ')}</p>
          )}
          <p className={`font-mono ${leise}`}>{f.id}</p>
        </div>
      )}
    </li>
  );
}

function Gruppe({ herkunft, fragen }: { herkunft: string; fragen: readonly Klaerfrage[] }): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const label = HERKUNFT_LABEL[herkunft as keyof typeof HERKUNFT_LABEL];
  return (
    <div className="rounded" style={feldStil}>
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-expanded={offen}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left cursor-pointer"
      >
        <ChevronRight
          size={14}
          className="text-[var(--tf-text-tertiary)] shrink-0 transition-transform duration-150"
          style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-[12.5px] text-[var(--tf-text)]">{label}</span>
        <span className="font-mono tabular-nums text-[11.5px] text-[var(--tf-text-tertiary)]">
          {fragen.length}
        </span>
        <span className="flex-1" />
        <span className={leise}>{HERKUNFT_ADRESSAT[herkunft as keyof typeof HERKUNFT_ADRESSAT]}</span>
      </button>
      {offen && <ul className="px-2.5 pb-1.5">{fragen.map(f => <Zeile key={f.id} f={f} />)}</ul>}
    </div>
  );
}

/**
 * Was **im Fachsystem** korrigiert gehört, nicht bei uns.
 *
 * Die App normalisiert diese Wortlaute beim Lesen und zeigt den Rohwert
 * daneben — geschrieben wird nichts. Damit die Korrektur trotzdem nicht
 * vergessen wird, steht sie hier mit ihrem gemessenen Gewicht.
 */
function SchreibfehlerBlock({ bestand }: { bestand: KlaerfragenBestand }): React.ReactElement | null {
  const zeilen = SCHREIBFEHLER
    .map(s => ({ s, n: bestand.rohStatus.get(s.roh) ?? 0 }))
    .filter(x => x.n > 0);
  if (zeilen.length === 0) return null;
  return (
    <div className="rounded px-2.5 py-2 flex flex-col gap-1" style={feldStil}>
      <span className="text-[12.5px] text-[var(--tf-text)]">
        Bekannte Schreibfehler im Quellsystem
      </span>
      <span className={leise}>
        Die App liest sie richtig und zeigt den Rohwert daneben. Korrigiert gehören
        sie im Fachsystem — hier steht nur, wie viel daran hängt.
      </span>
      <ul className="flex flex-col gap-0.5 pt-0.5">
        {zeilen.map(({ s, n }) => (
          <li key={s.roh} className="flex items-baseline gap-2 text-[12px]">
            <span className="font-mono tabular-nums text-[11.5px] text-[var(--tf-text-tertiary)] w-[64px] shrink-0 text-right">
              {zahl(n)}×
            </span>
            <span className="text-[var(--tf-text)]">„{s.roh}“</span>
            <span className={leise}>gelesen als „{s.gemeint}“ (Code {s.code})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KlaerfragenTab({ api }: { api: StatusCockpitApi }): React.ReactElement {
  const lauf = useKlaerfragen(api.entwurf);
  const [bericht, setBericht] = useState<string | null>(null);

  const exportieren = useAsyncAction(async () => {
    if (lauf.fragen === null || lauf.bestand === null) return;
    const r = await exportiereKlaerfragen({
      fragen: lauf.fragen, bestand: lauf.bestand, jetztIso: new Date().toISOString(),
    });
    // Ausgelassene Auswahllisten werden GENANNT, nicht verschluckt: sonst liest
    // sich eine Datei ohne Dropdown wie eine, die keines braucht.
    setBericht(r.validierungenAusgelassen === 0
      ? null
      : `${zaehlwort(r.validierungenAusgelassen, 'Auswahlliste war', 'Auswahllisten waren')} `
        + 'zu lang für Excel und wurde weggelassen — die Vorschläge stehen weiter in der Spalte Kontext.');
  });

  const fragen = lauf.fragen;

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="flex flex-col gap-2 rounded px-2.5 py-2" style={feldStil}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[12.5px] text-[var(--tf-text)]">
            {fragen === null
              ? 'Was am Status- und Kürzelkatalog fachlich offen ist — aus dem Bestand abgeleitet, nicht gepflegt.'
              : <>{zaehlwort(fragen.length, 'Klärfrage', 'Klärfragen')} aus{' '}
                {zahl(lauf.bestand?.gesamtVorgaenge ?? 0)} Vorgängen · Bestand vom{' '}
                {kurzDatum(lauf.bestand?.importiertAm ?? null)} · ganzer Bestand, ohne Betrachtungsbereich</>}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary" size="sm"
              disabled={lauf.aktion.busy || api.entwurf === null}
              onClick={lauf.aktion.run}
            >
              {lauf.aktion.busy ? 'Misst …' : fragen === null ? 'Klärfragen erheben' : 'Neu erheben'}
            </Button>
            {fragen !== null && fragen.length > 0 && (
              <Button variant="primary" size="sm" disabled={exportieren.busy} onClick={exportieren.run}>
                <Download size={13} className="mr-1" />
                {exportieren.busy ? 'Schreibt …' : 'Arbeitsmappe (XLSX)'}
              </Button>
            )}
          </div>
        </div>
        {lauf.dauerMs !== null && <span className={leise}>Durchlauf {zahl(lauf.dauerMs)} ms</span>}
        {lauf.aktion.error != null && (
          <span className="text-[12px] text-[var(--tf-danger-text)]">⚠ {String(lauf.aktion.error)}</span>
        )}
        {exportieren.error != null && (
          <span className="text-[12px] text-[var(--tf-danger-text)]">⚠ {String(exportieren.error)}</span>
        )}
        {bericht !== null && <span className={leise}>{bericht}</span>}
      </div>

      {fragen !== null && fragen.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          Nichts offen — der Katalog beantwortet alles, was der Bestand aufwirft.
        </p>
      )}

      {lauf.bestand !== null && <SchreibfehlerBlock bestand={lauf.bestand} />}

      {fragen !== null && HERKUENFTE.map(h => {
        const gruppe = fragen.filter(f => f.herkunft === h);
        return gruppe.length === 0 ? null : <Gruppe key={h} herkunft={h} fragen={gruppe} />;
      })}
    </div>
  );
}
