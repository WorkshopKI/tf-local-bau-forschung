/**
 * Die Feld-Zeilen der Detail-Spalte: Bezeichnung links, Wert rechts.
 *
 * Bewusst KEINE Tabelle: die Detail-Spalte ist schmal, und die drei Arten von
 * Einträgen tragen verschiedene Felder. Eine gemeinsame Spaltenachse behauptete
 * eine Vergleichbarkeit, die es nicht gibt.
 */
export function Feld({ label, children, leer }: {
  label: string;
  children?: React.ReactNode;
  /** Was statt des Werts steht, wenn keiner da ist. Nie einfach nichts. */
  leer?: string;
}): React.ReactElement {
  const hatWert = children !== undefined && children !== null && children !== '';
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <dt className="w-[112px] shrink-0 text-[11.5px] text-[var(--tf-text-tertiary)]">
        {label}
      </dt>
      <dd className={`min-w-0 flex-1 text-[12.5px] ${
        hatWert ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'
      }`}>
        {hatWert ? children : (leer ?? '—')}
      </dd>
    </div>
  );
}

export function Felder({ children }: { children: React.ReactNode }): React.ReactElement {
  return <dl className="flex flex-col">{children}</dl>;
}

/** Überschrift eines Detail-Abschnitts. */
export function Abschnitt({ titel, children }: {
  titel: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-1.5 border-t border-[var(--tf-border)] pt-3">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">
        {titel}
      </h3>
      {children}
    </section>
  );
}

/** Kopfzeile eines Detail-Eintrags: der Begriff und, wenn es sie gibt, seine Langform. */
export function DetailKopf({ titel, unter }: {
  titel: string;
  unter?: string;
}): React.ReactElement {
  return (
    <header className="flex flex-col gap-0.5">
      <h2 className="text-[18px] font-semibold text-[var(--tf-text)]">{titel}</h2>
      {unter !== undefined && unter !== '' && (
        <p className="text-[13px] text-[var(--tf-text-secondary)]">{unter}</p>
      )}
    </header>
  );
}
