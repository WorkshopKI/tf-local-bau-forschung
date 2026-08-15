/**
 * Die beiden Häkchen der Mehrfachauswahl: eines je Zeile, eines im Spaltenkopf.
 *
 * Beide sitzen in der Identitätsspalte („Antrag") und werden dort von
 * `AntraegeTable` eingehängt — die Spaltenregistry kennt die Auswahl nicht.
 * Damit bleibt das Häkchen AUSSERHALB der Navigations-Klickzone der Zelle: es
 * wählt aus, es öffnet nicht.
 */
import { useEffect, useRef } from 'react';
import { useAntraegeAuswahl, haekchenStand } from './useAntraegeAuswahl';

/** Gemeinsames Aussehen — und die einzige Stelle, die `indeterminate` setzt
 *  (HTML kennt dafür kein Attribut, nur die DOM-Eigenschaft). */
function Haekchen({
  an, teilweise, titel, ariaLabel, onChange,
}: {
  an: boolean;
  teilweise: boolean;
  titel: string;
  ariaLabel: string;
  onChange: (an: boolean) => void;
}): React.ReactElement {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = teilweise;
  }, [teilweise]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={an}
      title={titel}
      aria-label={ariaLabel}
      onChange={e => onChange(e.target.checked)}
      // Der Klick darf weder die Zeile öffnen noch den Ausklappbereich schalten.
      onClick={e => e.stopPropagation()}
      className="shrink-0 accent-[var(--tf-primary)] cursor-pointer"
    />
  );
}

/** Häkchen einer Zeile. `keys` sind alle Teilvorhaben, die sie umfasst. */
export function AuswahlZelle({ keys }: { keys: readonly string[] }): React.ReactElement {
  const gewaehlt = useAntraegeAuswahl(s => s.gewaehlt);
  const setzeViele = useAntraegeAuswahl(s => s.setzeViele);
  const { an, teilweise } = haekchenStand(keys, gewaehlt);
  const mehr = keys.length > 1;
  return (
    <Haekchen
      an={an}
      teilweise={teilweise}
      titel={mehr ? `Verbund mit ${keys.length} Teilvorhaben auswählen` : 'Antrag auswählen'}
      ariaLabel={mehr ? `Verbund mit ${keys.length} Teilvorhaben auswählen` : 'Antrag auswählen'}
      onChange={next => setzeViele(keys, next)}
    />
  );
}

/**
 * Häkchen im Spaltenkopf: alle Zeilen der Tabelle.
 *
 * „Alle" heißt hier ALLE Zeilen der aktuellen Liste, nicht nur die nachgeladene
 * Seite — die Seitengröße ist eine Eigenschaft des Scrollens, keine Auswahl, die
 * jemand getroffen hat.
 */
export function AuswahlKopf({ keys }: { keys: readonly string[] }): React.ReactElement {
  const gewaehlt = useAntraegeAuswahl(s => s.gewaehlt);
  const setzeViele = useAntraegeAuswahl(s => s.setzeViele);
  const { an, teilweise } = haekchenStand(keys, gewaehlt);
  const titel = an
    ? `Auswahl aufheben (${keys.length})`
    : `Alle ${keys.length.toLocaleString('de-DE')} Anträge dieser Liste auswählen`;
  return (
    <Haekchen
      an={an}
      teilweise={teilweise}
      titel={titel}
      ariaLabel={titel}
      onChange={next => setzeViele(keys, next)}
    />
  );
}
