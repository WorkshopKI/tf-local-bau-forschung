/**
 * Eine To-do-Regel als **deutscher Satz**: „WENN … DANN «…», zuständig AB".
 *
 * Wer eine Regel lesen kann, kann sie prüfen — und darum geht es, denn die
 * Kaskade ersetzt eine Rechnung, die bisher nur eine Person überblickte. Der
 * Satz steht deshalb in beiden Gestalten der Regel: in der breiten Karte und
 * noch einmal im Detail-Kopf, wo sonst nur die Einzelfelder des Editors stünden.
 */
import {
  ROLLE_LABEL, bedingungSatz, ALLE_STRAENGE,
  type MappingVersion, type TodoRegel,
} from '@/core/status';

/** Was eine Sperre stilllegt — und was sie bewusst durchlässt. */
export function sperrSatz(r: TodoRegel): string {
  const ids = r.sperrt ?? [];
  const ausnahmen = (r.sperrtNicht ?? []).join(', ');
  const rest = ausnahmen ? ` — außer ${ausnahmen}` : '';
  return ids.includes(ALLE_STRAENGE)
    ? `kein To-do mehr${rest}`
    : `${ids.length} Regeln überspringen (${ids.join(', ')})${rest}`;
}

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
      {bedingungSatz(r.bedingung, version)}{' '}
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
