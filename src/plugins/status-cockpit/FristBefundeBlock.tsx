/**
 * Der Bestandslauf des **Haltedatums**, an einer Stelle lesbar.
 *
 * Er beantwortet eine Frage: was ändert die dritte Quelle wirklich? Dafür
 * rechnet der Lauf jeden Vorgang zweimal — ohne und mit Verlaufsableitung — und
 * zeigt beides nebeneinander.
 *
 * **Die erste Zeile ist eine Zusage, keine Statistik.** Der Frist-Zustand kann
 * sich nicht bewegen: `berechneFrist` liest das Haltedatum erst, nachdem der
 * Zustand feststeht. Steht dort etwas anderes als „diagonal", ist das ein
 * Fehler und wird als solcher gemeldet.
 *
 * Reine Anzeige; gerechnet wird in `fristErhebung.ts` und `useFristErhebung`.
 */
import { Button } from '@/components/ui/button';
import { HALT_HERKUNFT } from '@/plugins/antraege/fristAnzeige';
import type { HaltedatumQuelle } from '@/core/status/haltedatum';
import { matrixDiagonal, musterSortiert } from './fristErhebung';
import { feldStil } from './labels';
import type { FristLauf } from './useFristErhebung';

const leise = 'text-[11.5px] text-[var(--tf-text-tertiary)]';
const zahl = (n: number): string => n.toLocaleString('de-DE');

const QUELLE_LABEL: Readonly<Record<HaltedatumQuelle, string>> = {
  ...HALT_HERKUNFT,
  unbekannt: 'kein Haltedatum bekannt',
};

function Zeile({ label, wert, hinweis }: {
  label: string; wert: string; hinweis?: string;
}): React.ReactElement {
  return (
    <li className="flex items-baseline gap-2 flex-wrap text-[12px]">
      <span className="font-mono tabular-nums text-[var(--tf-text)] w-[92px] shrink-0 text-right">
        {wert}
      </span>
      <span className="text-[var(--tf-text-secondary)]">{label}</span>
      {hinweis !== undefined && <span className={leise}>{hinweis}</span>}
    </li>
  );
}

export function FristBefundeBlock({ lauf }: { lauf: FristLauf }): React.ReactElement {
  const b = lauf.befunde;
  return (
    <div className="rounded px-2.5 py-2 flex flex-col gap-2" style={feldStil}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text)]">
          Haltedatum aus dem Verlauf — was die dritte Quelle ändert
        </span>
        <Button
          variant="secondary" size="sm"
          disabled={lauf.aktion.busy}
          onClick={lauf.aktion.run}
        >
          {lauf.aktion.busy ? 'Rechnet …' : b === null ? 'Bestand messen' : 'Neu messen'}
        </Button>
      </div>
      <span className={leise}>
        Jeder Vorgang wird zweimal gerechnet — ohne und mit Verlaufsableitung. Die
        Zustände dürfen sich dabei NICHT bewegen; nur Haltedatum, Quelle und das
        rechte Ende der Bahn.
      </span>
      {lauf.aktion.error != null && (
        <span className="text-[12px] text-[var(--tf-danger-text)]">⚠ {String(lauf.aktion.error)}</span>
      )}

      {b !== null && (
        <div className="flex flex-col gap-2 pt-1">
          <span className={leise}>
            {zahl(b.vorgaenge)} Vorhaben · {lauf.bereichText ?? '—'} · Stichtag {lauf.stichtag}
            {lauf.dauerMs !== null && ` · Durchlauf ${zahl(lauf.dauerMs)} ms`}
          </span>

          <p className={matrixDiagonal(b)
            ? 'text-[12px] text-[var(--tf-success-text)]'
            : 'text-[12px] text-[var(--tf-danger-text)]'}
          >
            {matrixDiagonal(b)
              ? '✓ Kein Vorgang wechselt den Frist-Zustand — die Quelle ist additiv.'
              : '⚠ Ein Vorgang hat den Frist-Zustand gewechselt. Das darf nicht sein.'}
          </p>

          <div className="flex flex-col gap-0.5">
            <p className={`uppercase tracking-wider ${leise}`}>Was sich bewegt</p>
            <ul className="flex flex-col gap-0.5">
              <Zeile
                label="erstmals ein Haltedatum"
                wert={zahl(b.neuDatiert)}
                hinweis="vorher „unbekannt“, jetzt ein bestimmter Tag"
              />
              <Zeile
                label="Achse der Bahn endet woanders"
                wert={zahl(b.achseVerschoben)}
                hinweis="der Bezugszeitpunkt hat sich verschoben"
              />
              <Zeile
                label="umdatiert"
                wert={zahl(b.umdatiert)}
                hinweis="hatte schon eins und bekommt ein anderes — muss 0 sein"
              />
            </ul>
          </div>

          <div className="flex flex-col gap-0.5">
            <p className={`uppercase tracking-wider ${leise}`}>Je Quelle (nachher)</p>
            <ul className="flex flex-col gap-0.5">
              {[...b.jeQuelle.entries()]
                .sort((x, y) => y[1] - x[1])
                .map(([q, n]) => (
                  <Zeile key={q} label={QUELLE_LABEL[q]} wert={zahl(n)} />
                ))}
            </ul>
          </div>

          <div className="flex flex-col gap-0.5">
            <p className={`uppercase tracking-wider ${leise}`}>Muster</p>
            <ul className="flex flex-col gap-0.5">
              {musterSortiert(b).map(m => (
                <Zeile
                  key={m.schluessel}
                  label={m.schluessel}
                  wert={zahl(m.anzahl)}
                  hinweis={m.beispiele.length > 0
                    ? `z. B. ${m.beispiele.slice(0, 3).join(', ')}${m.kuerzelBeispiel ? ` · Kürzel ${m.kuerzelBeispiel}` : ''}`
                    : undefined}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
