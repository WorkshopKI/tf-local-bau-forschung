/**
 * Eine To-do-Regel, lesend: unter welcher Bedingung sie greift, was sie dann
 * sagt, wer sie abarbeitet.
 *
 * Die Bedingung kommt aus `bedingungSatz` — dem EINEN Formatierer (Pitfall #41).
 * Ein zweiter liefe still auseinander: genau das war der Zustand, als
 * `tageSeit` und `datumNachFeld` andernorts als leerer String erschienen.
 */
import { Badge } from '@/components/ui/badge';
import { ROLLE_LABEL, ROLLE_LANG, sortiereRollen } from '@/core/status';
import type { RegelZeile } from './glossarZeilen';
import { DetailKopf, Feld, Felder } from './GlossarFelder';
import { RegelnVerweis } from './RegelnVerweis';

export function RegelDetail({ zeile }: { zeile: RegelZeile }): React.ReactElement {
  const r = zeile.regel;
  const zustaendig = sortiereRollen([...r.zustaendig]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-6 py-5">
      <DetailKopf titel={r.beschreibung} unter={zeile.sperre ? undefined : r.todo} />

      {zeile.sperre && (
        <p className="flex items-baseline gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
          <Badge variant="warning">Sperre</Badge>
          Erzeugt kein To-do, sondern legt andere Regeln still, solange sie greift.
        </p>
      )}
      {!r.aktiv && (
        <p className="flex items-baseline gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
          <Badge variant="default">stillgelegt</Badge>
          Diese Regel ist derzeit nicht in Kraft.
        </p>
      )}

      <Felder>
        <Feld label="Wenn">{zeile.satz}</Feld>
        <Feld label="Dann" leer="kein To-do — siehe Sperre oben">{r.todo}</Feld>
        <Feld label="Zuständig" leer="keine Rolle benannt">
          {zustaendig.map(x => ROLLE_LABEL[x]).join('/')}
        </Feld>
        <Feld label="Wartet auf" leer="niemanden">
          {r.wartetAuf === 'ast'
            ? 'Antragsteller'
            : r.wartetAuf ? ROLLE_LANG[r.wartetAuf] : ''}
        </Feld>
        <Feld label="Regelsatz">{ROLLE_LANG[zeile.regelsatz]}</Feld>
        <Feld label="Strang" leer="keiner">{r.strang}</Feld>
      </Felder>

      {r.begruendung !== undefined && r.begruendung !== '' && (
        <p className="text-[12px] leading-relaxed text-[var(--tf-text-secondary)]">
          {r.begruendung}
        </p>
      )}

      <RegelnVerweis />
    </div>
  );
}
