import { useTourContext } from '@/core/hooks/useTour';

/**
 * Fußzeilen-Knopf „Neu hier?" — startet die Einführungs-Tour. Nur auf **Home**:
 * die Tour beginnt dort und führt über Sidebar, Suche und Vorgangsliste, also
 * über Rahmen-Elemente, die Umbauten einzelner Seiten überstehen. Der Puls-Punkt
 * zeigt, dass die Tour noch nicht durchlaufen wurde.
 *
 * Bis v2.357 stand auf jeder anderen Seite ein „Zeig es mir", das
 * seitenspezifische Touren ankündigte („In Vorbereitung"). Die Ankündigung ist
 * raus: solange die Seiten aktiv umgebaut werden, hält eine Tour nur eine
 * Klick-Reihenfolge fest, die morgen nicht mehr stimmt — und ein Versprechen,
 * das lange offen bleibt, entwertet den Rest der Oberfläche mit. Wenn Touren
 * kommen, hängen sie im Hilfe-Dialog der jeweiligen Seite (`SeitenHilfeButton`)
 * als zweite Tiefe unter dem Text — ein Einstiegspunkt statt zweier; der Dialog
 * kündigt das dort auch an.
 *
 * Bewusst **ohne** Icon (Design-Entscheidung: die Fußzeile bleibt aufgeräumt).
 */
export function FooterTourButton({ activeId }: { activeId: string }): React.ReactElement | null {
  const tour = useTourContext();

  if (activeId !== 'home') return null;

  return (
    <button
      onClick={() => tour.start()}
      title="Einführungs-Tour starten"
      className={
        'relative flex items-center gap-1.5 py-1.5 px-2 rounded-[var(--tf-radius)] text-[11px] ' +
        'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] ' +
        'transition-colors cursor-pointer shrink-0'
      }
    >
      <span>Neu hier?</span>
      {!tour.hasCompleted && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--tf-primary)] animate-pulse" />
      )}
    </button>
  );
}
