/**
 * Die Grundsatzfragen — der Abschnitt unter der Tabelle.
 *
 * Sie hängen nicht an einem einzelnen Code, sondern an einer Entscheidung über den
 * Schnitt als Ganzes. Deshalb kein Urteil, nur Text: „passt / gehört nach …" wäre
 * hier eine Scheinpräzision.
 *
 * Bewusst **immer sichtbar** statt hinter dem Zeilen-Filter: die Fragen, über die
 * am meisten zu reden ist, dürfen von einem Filter „nur strittige" nicht
 * verschwinden.
 */
import { rahmenStil } from './labels';
import { PunktKommentare } from './PunktKommentare';
import { beitraegeSortiert } from './fold';
import type { AntwortKontext } from './PunkteTabelle';
import type { KlaerungPunkt } from './typen';

export function GrundsatzFragen({
  fragen, kontext,
}: {
  fragen: readonly KlaerungPunkt[];
  kontext: AntwortKontext;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-medium text-[var(--tf-text)]">Grundsatzfragen</h2>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">
          {fragen.length} Fragen zum Schnitt als Ganzes — nur Text, kein Urteil
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {fragen.map((frage, i) => {
          const beitraege = beitraegeSortiert(kontext.stand, frage.id);
          return (
            <div key={frage.id} className="rounded px-3 py-3 flex flex-col gap-2" style={rahmenStil}>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-mono tabular-nums text-[var(--tf-text-tertiary)] shrink-0">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[12.5px] font-medium text-[var(--tf-text)]">{frage.titel}</h3>
                  {frage.zusatz != null && (
                    <p className="text-[12px] text-[var(--tf-text-secondary)] leading-snug">
                      {frage.zusatz}
                    </p>
                  )}
                </div>
              </div>
              <div className="pl-6">
                <PunktKommentare
                  punktId={frage.id}
                  beitraege={beitraege}
                  meinKuerzel={kontext.meinKuerzel}
                  gesperrt={kontext.gesperrt}
                  sperrGrund={kontext.sperrGrund}
                  aeussern={kontext.aeussern}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
