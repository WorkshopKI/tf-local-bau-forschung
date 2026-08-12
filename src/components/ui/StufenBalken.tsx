/**
 * Ein dreistufiger Mini-Balken mit Beschriftung — „hoch / mittel / gering".
 *
 * Warum kein `ProgressBar`: der zeigt einen Anteil (0..100 %) und liest sich als
 * Fortschritt. Hier geht es um eine EINSTUFUNG, und eine Zahl wie „0,73" sagt
 * niemandem etwas, während drei Striche sofort lesbar sind.
 *
 * Warum nicht `StatusBarRow` erweitern: das ist an die Status-Domäne gebunden
 * (Farbpunkte je Verfahrensschritt). Hier steht ein domänenfreies Primitiv, das
 * jede Skala mit wenigen Stufen darstellen kann.
 *
 * Der Titel gehört an den Aufrufer: nur der weiß, WORAUS die Stufe entstand.
 */

export function StufenBalken({
  stufe,
  stufen = 3,
  label,
  title,
}: {
  /** 1..`stufen`. Werte darüber/darunter werden geklemmt. */
  stufe: number;
  stufen?: number;
  /** Text unter den Strichen. Ohne ihn bleibt die Stufe eine Grafik ohne Aussage. */
  label: string;
  title?: string;
}): React.ReactElement {
  const gefuellt = Math.max(0, Math.min(stufen, Math.round(stufe)));
  return (
    <span
      className="inline-flex flex-col items-end gap-[3px]"
      title={title}
      role="img"
      aria-label={`${label} (${gefuellt} von ${stufen})`}
    >
      <span className="flex items-center gap-[2px]" aria-hidden>
        {Array.from({ length: stufen }, (_, i) => (
          <span
            key={i}
            className="block h-[3px] w-[10px] rounded-[1px]"
            style={{
              background: i < gefuellt
                ? 'var(--tf-primary)'
                : 'var(--tf-border)',
            }}
          />
        ))}
      </span>
      <span className="text-[10.5px] leading-none text-[var(--tf-text-tertiary)]">
        {label}
      </span>
    </span>
  );
}
