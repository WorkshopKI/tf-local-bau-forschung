/**
 * Eine Zeile: „die Sitzung laeuft nicht, alles ist lesbar, hier geht es zum
 * Aufschliessen." Rendert NICHTS, solange die Kurator-Sitzung aktiv ist.
 *
 * Bis v4.36 stand dieser Satz viermal von Hand da (CSV-Quellen, Filter,
 * Unterprogramme, Skill-Verwaltung) — mit vier Formulierungen und einem
 * Wegweiser, der seit dem Einstellungs-Redesign (v4.28) ins Leere zeigte
 * („Profil → Kurator-Bereich"; die Seite heisst „Mein Profil", die Gruppe
 * „Zusatz-Module"). Genau dafuer taugen Handkopien nicht: sie altern einzeln.
 *
 * Der Hinweis liest die Sitzung SELBST — der Aufrufer soll nicht entscheiden
 * muessen, wann er ihn zeigt, sonst entstehen wieder vier Antworten auf
 * dieselbe Frage.
 */
import { useKuratorSession } from '@/core/hooks/useKuratorSession';

export function KuratorGesperrtHinweis({
  was = 'Änderungen',
}: {
  /** Was gesperrt ist, im Plural — „Filter", „Skills und Regeln". */
  was?: string;
}): React.ReactElement | null {
  const session = useKuratorSession();
  if (session.isActive) return null;

  return (
    <div
      className="mb-4 rounded-[8px] px-3.5 py-2.5 text-[12.5px] leading-[1.5] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      Kurator-Modus nicht aktiv — {was} sind nur lesbar. Freischalten in{' '}
      <span className="text-[var(--tf-text)]">Einstellungen → Mein Profil → Zusatz-Module</span>.
    </div>
  );
}
