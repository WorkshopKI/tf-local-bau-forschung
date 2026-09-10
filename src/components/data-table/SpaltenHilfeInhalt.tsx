/**
 * Der Inhalt der Spalten-Herkunft: ein Satz, die Regel, die speisenden Felder.
 *
 * Ein Renderer für alle Orte — den Tooltip am Tabellenkopf, die aufgeklappte
 * Zeile im Spalten-Picker und die Quellspalten-Tooltips an Bedingungen und
 * Terminen (`QuellSpaltenTooltip`). Wer die Herkunft an einer weiteren Stelle
 * zeigen will, nimmt diese Komponente, statt die Aufzählung nachzubauen.
 */
import type { SpaltenHilfe } from './types';

/**
 * Obergrenze der gezeigten Felder. Die längste feste Gruppe (FB Status) bringt
 * elf Codes mit — die passen. Eine selbst angelegte Spalte darf beliebig viele
 * referenzieren, und ab etwa fünfzehn wird der Tooltip zur Tapete, die die
 * Tabelle darunter verdeckt. Der Rest wird gezählt, nicht verschwiegen.
 */
const MAX_FELDER = 14;

type Feld = NonNullable<SpaltenHilfe['felder']>[number];

function FeldZeile({ f }: { f: Feld }): React.ReactElement {
  return (
    // Der Code steht vorn und bricht nicht: er ist der Teil, den die
    // Kollegin im Fachsystem wiedererkennt. Umbrechen darf der Klartext.
    <li className="flex gap-1.5 text-[11px]">
      <code className="shrink-0 font-mono text-[10.5px] text-[var(--tf-text)]">
        {f.code}
      </code>
      {f.label && f.label !== f.code && (
        <span className="min-w-0 text-[var(--tf-text-secondary)]">{f.label}</span>
      )}
    </li>
  );
}

/**
 * Nach `fuer` gruppiert, in der Reihenfolge des ersten Auftretens — die ist die
 * Reihenfolge der Felder in der Bedingung, also die, in der man liest.
 */
function gruppiere(felder: readonly Feld[]): [string, Feld[]][] {
  const gruppen: [string, Feld[]][] = [];
  for (const f of felder) {
    const key = f.fuer ?? '';
    const gruppe = gruppen.find(g => g[0] === key);
    if (gruppe) gruppe[1].push(f);
    else gruppen.push([key, [f]]);
  }
  return gruppen;
}

export function SpaltenHilfeInhalt({ hilfe }: { hilfe: SpaltenHilfe }): React.ReactElement {
  const felder = hilfe.felder ?? [];
  const sichtbar = felder.slice(0, MAX_FELDER);
  const rest = felder.length - sichtbar.length;
  const gruppiert = sichtbar.some(f => f.fuer);

  return (
    <div className="text-left">
      <p>{hilfe.satz}</p>
      {hilfe.regel && (
        <p className="mt-1 text-[11px] text-[var(--tf-text-secondary)]">{hilfe.regel}</p>
      )}
      {hilfe.hinweis && (
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--tf-warning-text)' }}>
          {hilfe.hinweis}
        </p>
      )}
      {sichtbar.length > 0 && (
        <div
          className="mt-2 pt-1.5"
          style={{ borderTop: '0.5px solid var(--tf-border)' }}
        >
          <div className="mb-1 text-[9.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
            Speist sich aus
          </div>
          {gruppiert ? (
            <div className="space-y-1">
              {gruppiere(sichtbar).map(([fuer, liste]) => (
                <div key={fuer}>
                  {fuer && <div className="text-[10.5px] text-[var(--tf-text-secondary)]">{fuer}</div>}
                  <ul className="space-y-0.5 pl-2">
                    {liste.map(f => <FeldZeile key={f.code} f={f} />)}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {sichtbar.map(f => <FeldZeile key={f.code} f={f} />)}
            </ul>
          )}
          {rest > 0 && (
            <div className="mt-1 text-[10.5px] text-[var(--tf-text-tertiary)]">
              … und {rest} weitere
            </div>
          )}
        </div>
      )}
    </div>
  );
}
