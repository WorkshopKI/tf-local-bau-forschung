/**
 * Das schmale Meldungskästchen unter dem Ergebniskopf.
 *
 * Dreimal dieselbe Kiste — fehlgeschlagene KI-Analyse, ihre Warnungen, der
 * Toast der Seite —, bis v4.111 dreimal ausgeschrieben, inklusive des
 * `style`-Tripels. Herausgezogen, als die Suchseite ihre Zeilengrenze riss
 * (CLAUDE.md „Aufteilung opportunistisch"): drei Kopien einer Kiste sind drei
 * Stellen, an denen ein Ton- oder Abstandswechsel vergessen werden kann.
 *
 * Reine Darstellung — kein Zustand, keine Entscheidung, wann sie erscheint.
 */
export function SucheMeldung({ text, status }: {
  text: string;
  /** Setzt `role="status"` — für Meldungen, die eine ABGESCHLOSSENE Aktion
   *  quittieren und deshalb vorgelesen werden sollen. */
  status?: boolean;
}): React.ReactElement {
  return (
    <div
      {...(status ? { role: 'status' } : {})}
      className="mt-3 rounded px-3 py-2 text-[12px] text-[var(--tf-text)]"
      style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}
    >
      {text}
    </div>
  );
}
