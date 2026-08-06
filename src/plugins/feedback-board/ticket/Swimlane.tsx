/**
 * Ein Gruppen-Band (v3.18): klappbare Kopfzeile mit Name und Anzahl, darunter
 * das Board bzw. die Liste dieser Gruppe.
 *
 * Der Aufklapp-Zustand lebt im Band selbst und ist bewusst nicht persistiert —
 * er gehört zur Gruppierung, und die wechselt man häufiger als die Ansicht.
 * Bänder werden über den stabilen Gruppen-Schlüssel gekeyt, nie über den
 * Anzeigenamen: sonst verlöre ein umbenannter Bereich seinen Zustand.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function Swimlane({ label, anzahl, children }: {
  label: string;
  anzahl: number;
  children: React.ReactNode;
}): React.ReactElement {
  const [offen, setOffen] = useState(true);
  return (
    <section className="fb-lane">
      <button
        type="button"
        className="fb-lane-kopf"
        aria-expanded={offen}
        onClick={() => setOffen(o => !o)}
      >
        {offen ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
        <span className="fb-lane-nm">{label}</span>
        <span className="fb-lane-n">{anzahl}</span>
      </button>
      {offen && children}
    </section>
  );
}
