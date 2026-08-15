/**
 * Der Inhalt der Spalten-Herkunft: ein Satz, die Regel, die speisenden Felder.
 *
 * Ein Renderer für beide Orte — den Tooltip am Tabellenkopf und die aufgeklappte
 * Zeile im Spalten-Picker. Wer die Herkunft an einer dritten Stelle zeigen will,
 * nimmt diese Komponente, statt die Aufzählung nachzubauen.
 */
import type { SpaltenHilfe } from './types';

/**
 * Obergrenze der gezeigten Felder. Die längste feste Gruppe (FB Status) bringt
 * elf Codes mit — die passen. Eine selbst angelegte Spalte darf beliebig viele
 * referenzieren, und ab etwa fünfzehn wird der Tooltip zur Tapete, die die
 * Tabelle darunter verdeckt. Der Rest wird gezählt, nicht verschwiegen.
 */
const MAX_FELDER = 14;

export function SpaltenHilfeInhalt({ hilfe }: { hilfe: SpaltenHilfe }): React.ReactElement {
  const felder = hilfe.felder ?? [];
  const sichtbar = felder.slice(0, MAX_FELDER);
  const rest = felder.length - sichtbar.length;

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
          <ul className="space-y-0.5">
            {sichtbar.map(f => (
              // Der Code steht vorn und bricht nicht: er ist der Teil, den die
              // Kollegin im Fachsystem wiedererkennt. Umbrechen darf der Klartext.
              <li key={f.code} className="flex gap-1.5 text-[11px]">
                <code className="shrink-0 font-mono text-[10.5px] text-[var(--tf-text)]">
                  {f.code}
                </code>
                {f.label && f.label !== f.code && (
                  <span className="min-w-0 text-[var(--tf-text-secondary)]">{f.label}</span>
                )}
              </li>
            ))}
          </ul>
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
