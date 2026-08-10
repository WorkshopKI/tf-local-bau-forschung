/**
 * Die Einträge **ohne Termin** — reine Anzeige.
 *
 * Ein Satz erklärt, warum sie nicht in der Chronik darüber stehen. Ohne ihn
 * läse sich der Block als „hier ist das Datum abhandengekommen"; tatsächlich
 * führt der Export für diese Codes von vornherein nur den Wert.
 *
 * Leere Liste ⇒ `null`. Eine Überschrift ohne Zeilen wäre die Ankündigung von
 * nichts.
 */
import type { OhneDatumEintrag } from './ohneDatum';

const LEISE = 'text-[11px] text-[var(--tf-text-tertiary)]';

export function OhneDatumBlock({ eintraege }: {
  eintraege: readonly OhneDatumEintrag[];
}): React.ReactElement | null {
  if (eintraege.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11.5px] text-[var(--tf-text-secondary)]">
        Diese Codes führt das Fachsystem im Export nur als Wert (Spalte
        {' '}<code className="font-mono text-[11px]">T_…</code>), nicht als Termin
        {' '}(<code className="font-mono text-[11px]">D_…</code>) — auf der Zeitachse haben sie
        deshalb keinen Platz.
      </p>
      <ul className="flex flex-col gap-0.5">
        {eintraege.map(e => (
          <li key={e.feldId} className="flex items-baseline gap-2 flex-wrap text-[12px]">
            <code className="font-mono text-[11.5px] text-[var(--tf-text-tertiary)]">{e.code}</code>
            <span className="text-[var(--tf-text-secondary)]">{e.label}</span>
            <span className="text-[var(--tf-text)]" style={{ fontWeight: 500 }}>{e.wert}</span>
            <span className={LEISE}>{e.traeger}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
