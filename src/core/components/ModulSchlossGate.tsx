/**
 * Routen-Schutz fuer gesperrte Bereiche (v3.0).
 *
 * Die Sidebar filtert gesperrte Plugins zwar heraus, aber `Router.tsx` baut die
 * Routen aus der UNGEFILTERTEN Plugin-Liste — ein Lesezeichen auf `#/auslastung`
 * oder `#/kuration/programme` kam bisher durch. Dieses Gate schliesst das.
 *
 * Bewusst KEIN stilles `<Navigate to="/">`: eine Umleitung aus einem Lesezeichen
 * heraus liest sich wie ein Fehler („mein Link ist kaputt"). Die Sperre sagt
 * stattdessen, was los ist und wo man sie aufhebt.
 */

import type { ReactElement, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModulSchlossGateProps {
  /** Ist der Bereich frei? */
  frei: boolean;
  /** Anzeigename des Bereichs, z.B. „Auslastung". */
  bereich: string;
  children: ReactNode;
}

export function ModulSchlossGate({ frei, bereich, children }: ModulSchlossGateProps): ReactElement {
  const navigate = useNavigate();

  if (frei) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <Lock size={20} className="text-[var(--tf-text-tertiary)]" />
      </div>
      <h2 className="text-[17px] font-medium text-[var(--tf-text)] mb-1.5">
        {bereich} ist gesperrt
      </h2>
      <p className="text-[13px] text-[var(--tf-text-secondary)] max-w-[420px] mb-5 leading-relaxed">
        Dieser Bereich lässt sich mit einem Zusatzpasswort freischalten. Die Freischaltung
        gilt anschließend 12 Stunden und übersteht einen Neustart.
      </p>
      <Button type="button" variant="primary" size="sm" onClick={() => navigate('/einstellungen')}>
        Zur Freischaltung
      </Button>
    </div>
  );
}
