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
import { hatModulSchloss, isKuratorMenusEnabled } from '@/config/feature-flags';
import type { ModulSlot } from '@/config/runtime-config';

interface ModulSchlossGateProps {
  /** Ist der Bereich frei? */
  frei: boolean;
  /** Anzeigename des Bereichs, z.B. „Auslastung". */
  bereich: string;
  /**
   * Das Modul-Schloss des Bereichs, falls er eines traegt.
   *
   * Entscheidet den WORTLAUT: nur wo dieser Build wirklich ein Schloss hat,
   * ist „Zusatzpasswort" die Erklaerung. Ohne Schloss ist `frei === false`
   * eine ganz andere Aussage — die Kurator-Flagge steht auf aus, oder die
   * Programmfassung kennt den Bereich gar nicht.
   */
  slot?: ModulSlot;
  children: ReactNode;
}

/**
 * Was die Sperre erklaert — und wohin ihr Knopf zeigt.
 *
 * Bis v4.119 gab es nur EINEN Text: „mit einem Zusatzpasswort freischalten",
 * plus ein Ziel `sec-freischaltung`. Beides stimmt nur in Builds MIT Schloss.
 * In dev/local nannte die Sperre ein Passwort, das dieser Build nicht hat, und
 * ihr Knopf sprang auf einen Abschnitt, den die Einstellungen dort nie
 * registrieren — ein Knopf ohne Ziel.
 */
function erklaerung(slot: ModulSlot | undefined): {
  text: string;
  knopf: string;
  ziel: string;
} {
  // Ohne eigenes Schloss ist der Bereich `kuratorOnly` — dann entscheidet das
  // Kurator-Schloss, ob ein Passwort die Erklaerung ist.
  const perSchloss = slot != null ? hatModulSchloss(slot) : hatModulSchloss('kurator');
  if (perSchloss) {
    return {
      text: 'Dieser Bereich lässt sich mit einem Zusatzpasswort freischalten. Die Freischaltung gilt anschließend 12 Stunden und übersteht einen Neustart.',
      knopf: 'Zur Freischaltung',
      // Auf den Abschnitt, nicht auf die blanke Seite: „Zusatz-Module" steht
      // in „Mein Profil" weit unten (bei 1280 × 720 rund 170 px unterhalb der
      // Fensterkante), und der Knopf verspricht einen Weg dorthin.
      ziel: '/einstellungen?sektion=sec-freischaltung',
    };
  }
  // `sec-kurator` steht in der Registry unter GENAU dieser Bedingung — der
  // freie Kurator-Schalter existiert nur in Builds ohne Schloss.
  if (isKuratorMenusEnabled() && !hatModulSchloss('kurator')) {
    return {
      text: 'Dieser Bereich gehört zur Kuration und steht offen, sobald der Kurator-Modus eingeschaltet ist.',
      knopf: 'Zum Kurator-Bereich',
      ziel: '/einstellungen?sektion=sec-kurator',
    };
  }
  return {
    text: 'Diese Programmfassung enthält den Bereich nicht. Wer ihn braucht, arbeitet mit der Kurator-Fassung der App.',
    knopf: 'Zur Startseite',
    ziel: '/',
  };
}

export function ModulSchlossGate({ frei, bereich, slot, children }: ModulSchlossGateProps): ReactElement {
  const navigate = useNavigate();

  if (frei) return <>{children}</>;

  const { text, knopf, ziel } = erklaerung(slot);

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
        {text}
      </p>
      <Button type="button" variant="primary" size="sm" onClick={() => navigate(ziel)}>
        {knopf}
      </Button>
    </div>
  );
}
