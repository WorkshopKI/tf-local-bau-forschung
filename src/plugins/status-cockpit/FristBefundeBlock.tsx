/**
 * Die vollen Zahlen des **Haltedatums** — der Detailteil des Bestandslaufs.
 *
 * Sie beantworten eine Frage: was ändert die dritte Quelle wirklich? Dafür
 * rechnet der Lauf jeden Vorgang zweimal — ohne und mit Verlaufsableitung — und
 * zeigt beides nebeneinander.
 *
 * Seit v4.52 ohne eigenen Kopf, Knopf und Rahmen. **Die Zusage steht jetzt
 * oben** im Befund (`bestandslaufBefund.ts`), zusammen mit der Lesart, die aus
 * drei Nullzeilen nicht hervorging: greift die Quelle nirgends, während Vorhaben
 * ohne Haltedatum dastehen, ist „diagonal" zwar wahr, aber leer.
 *
 * Reine Anzeige; gerechnet wird in `fristErhebung.ts` und `useFristErhebung`.
 */
import { HALT_HERKUNFT } from '@/plugins/antraege/fristAnzeige';
import type { HaltedatumQuelle } from '@/core/status/haltedatum';
import { musterSortiert } from './fristErhebung';
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

export function FristBefundeBlock({ lauf }: { lauf: FristLauf }): React.ReactElement | null {
  const b = lauf.befunde;
  if (b === null) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] font-medium text-[var(--tf-text-secondary)]">
        Haltedatum aus dem Verlauf · {zahl(b.vorgaenge)} Vorhaben
      </p>
      <span className={leise}>
        Jeder Vorgang wird zweimal gerechnet — ohne und mit Verlaufsableitung. Die
        Zustände dürfen sich dabei NICHT bewegen; nur Haltedatum, Quelle und das
        rechte Ende der Bahn.
      </span>

      <div className="flex flex-col gap-2 pt-1">
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
    </div>
  );
}
