/**
 * Die Einträge **ohne Termin** — reine Anzeige.
 *
 * Ein Satz erklärt, warum sie nicht in der Chronik darüber stehen. Ohne ihn
 * läse sich der Block als „hier ist das Datum abhandengekommen"; tatsächlich
 * führt der Export für diese Codes von vornherein nur den Wert.
 *
 * **Ein Feld, eine Zeile — außer die Teilvorhaben widersprechen sich.** Tragen
 * alle denselben Wert, steht er wie bisher hinter der Bezeichnung. Weichen sie
 * ab (bei `T_ABK` der Normalfall, siehe `ohneDatum.ts`), rückt jeder Wert in
 * eine eigene Zeile unter die Bezeichnung, mit seinem eigenen Träger. Die
 * Bezeichnung bleibt dabei oben stehen und wird nicht je Wert wiederholt: das
 * Feld ist eines, nur seine Werte sind mehrere.
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
        {eintraege.map(e => {
          const einzeln = e.werte.length === 1 ? e.werte[0] : undefined;
          return (
            <li key={e.feldId} className="flex flex-col gap-0.5 text-[12px]">
              <span className="flex items-baseline gap-2 flex-wrap">
                <code className="font-mono text-[11.5px] text-[var(--tf-text-tertiary)]">{e.code}</code>
                <span className="text-[var(--tf-text-secondary)]">{e.label}</span>
                {einzeln && (
                  <>
                    <span className="text-[var(--tf-text)]" style={{ fontWeight: 500 }}>{einzeln.wert}</span>
                    <span className={LEISE}>{einzeln.traeger}</span>
                  </>
                )}
                {!einzeln && (
                  <span className={LEISE}>{e.werte.length} verschiedene Werte</span>
                )}
              </span>
              {!einzeln && (
                <ul className="flex flex-col gap-0.5 pl-[26px]">
                  {e.werte.map(w => (
                    <li key={w.wert} className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[var(--tf-text)]" style={{ fontWeight: 500 }}>{w.wert}</span>
                      <span className={LEISE}>{w.traeger}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
