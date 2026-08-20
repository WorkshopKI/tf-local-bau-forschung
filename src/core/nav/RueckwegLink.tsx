/**
 * Der Rückweg als Brotkrume: „← Zurück zum Vorgangs-Board".
 *
 * Die Optik steckte bis v4.133 in der `PanelShell` der Antrags-Detailseite. Mit
 * der Skill-Verwaltung kam ein zweiter Wirt dazu, und der darf nicht in
 * `plugins/antraege` importieren — also liegt der Knopf jetzt neben der
 * Mechanik, die ihn speist ([herkunft.ts](./herkunft.ts) +
 * [rueckwegSatz.ts](./rueckwegSatz.ts)). Eine Optik, zwei Aufrufer; ein zweiter
 * nachgebauter Pfeil wäre genau die Drift, die dieses Modul verhindern soll.
 *
 * Gewicht bewusst wie eine Brotkrume, nicht wie ein Hinweis: Primärfarbe der
 * Textfarbe, 13,5 px, normale Strichstärke (der volle Satz trägt sich selbst,
 * halbfett drängte er sich vor den Titel darunter), mit einer Hover-Fläche als
 * echtes Klickziel. Als 12,5-px-Sekundärtext wurde er übersehen — der einzige
 * Weg zurück zu einer Trefferliste, in Hint-Größe.
 */
import { ArrowLeft } from 'lucide-react';
import { rueckwegSatz } from './rueckwegSatz';

export function RueckwegLink({ label, onClick }: {
  /** NAME der Herkunfts-Seite („Vorgangs-Board") — die Fügung baut `rueckwegSatz`. */
  label: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1.5 inline-flex items-center gap-1.5 rounded-[7px] px-1.5 py-1 text-[13.5px] font-normal text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
    >
      <ArrowLeft size={15} aria-hidden /> {rueckwegSatz(label)}
    </button>
  );
}
