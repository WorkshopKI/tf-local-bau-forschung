/**
 * Eine To-do-Regel als **deutscher Satz**: „WENN … DANN «…», zuständig AB".
 *
 * Wer eine Regel lesen kann, kann sie prüfen — und darum geht es, denn die
 * Kaskade ersetzt eine Rechnung, die bisher nur eine Person überblickte. Der
 * Satz steht deshalb in beiden Gestalten der Regel: in der breiten Karte und
 * noch einmal im Detail-Kopf, wo sonst nur die Einzelfelder des Editors stünden.
 */
import { QuellSpaltenTooltip } from '@/components/quellspalten';
import {
  ROLLE_LABEL, bedingungSatz,
  type MappingVersion, type TodoRegel,
} from '@/core/status';
import { bedingungQuellen } from '@/core/status/bedingung-quellen';
import { sperrSatz } from './todoRegelnAnsicht';

// Die Satzform der Sperre wohnt im Ansichts-Modell — dort ist sie ohne React
// prüfbar, und ihre Grammatik hat genau das gebraucht (v2.412).
export { sperrSatz } from './todoRegelnAnsicht';

export function TodoRegelSatz({ r, version, className = '' }: {
  r: TodoRegel;
  version: MappingVersion;
  className?: string;
}): React.ReactElement {
  const istSperre = (r.sperrt?.length ?? 0) > 0;
  return (
    // `leading-[1.35]` statt des Default-Leadings: der Satz läuft regelmäßig über
    // zwei Zeilen, und die Karte soll kompakt bleiben.
    <p className={`text-[12.5px] leading-[1.35] text-[var(--tf-text-secondary)] ${className}`}>
      <span className="text-[var(--tf-text-tertiary)]">WENN</span>{' '}
      {/* Die Quellspalten der Bedingung: aus welchen CSV-Spalten die Felder
          lesen, und wo ein Programm eines davon nicht mappt. */}
      <QuellSpaltenTooltip erklaere={idx => bedingungQuellen(r.bedingung, idx, version)}>
        <span className="cursor-help">{bedingungSatz(r.bedingung, version)}</span>
      </QuellSpaltenTooltip>{' '}
      <span className="text-[var(--tf-text-tertiary)]">DANN</span>{' '}
      {istSperre ? (
        <span className="text-[var(--tf-text)]">{sperrSatz(r)}</span>
      ) : (
        <>
          <span className="text-[var(--tf-text)]">„{r.todo}"</span>
          {r.zustaendig.length > 0 && (
            <>, zuständig {r.zustaendig.map(x => ROLLE_LABEL[x]).join('/')}</>
          )}
          {r.wartetAuf && (
            <>, wartet auf {r.wartetAuf === 'ast' ? 'Antragsteller' : ROLLE_LABEL[r.wartetAuf]}</>
          )}
        </>
      )}
    </p>
  );
}
