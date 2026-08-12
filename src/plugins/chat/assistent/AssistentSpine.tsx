/**
 * Dauerhafte 28px-Spine am rechten Blattrand (Handoff „Docking", schmal):
 * Mini-Primär-Badge oben + dauerhaft sichtbares, vertikales Label „ASSISTENT"
 * (kein Tooltip, das Label ist ohnehin sichtbar → kein Doppel-Tooltip, vgl.
 * v2.255.2). Die Spine bleibt auch bei offenem Panel stehen; das Panel legt
 * sich links daneben. Das Blatt reserviert die SPINE_WIDTH (ShellLayout) →
 * keine Überlappung. Klick togglet.
 *
 * Eigenes Bauteil seit v3.50, weil ZWEI Seiten denselben Streifen tragen: das
 * shell-weite Dock ([[AssistentPanelHost]]) und die Suche, die statt des Docks
 * ihren eigenen Voll-Chat (`ChatPanelHost`) daran hängt. Ein zweiter Nachbau
 * wäre eine Drift-Quelle — der Streifen sieht auf jeder Seite gleich aus.
 */
import { Sparkles } from 'lucide-react';

export interface AssistentSpineProps {
  open: boolean;
  onToggle: () => void;
}

export function AssistentSpine({ open, onToggle }: AssistentSpineProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'Assistent schließen' : 'Assistent öffnen'}
      aria-expanded={open}
      className={`group fixed right-0 top-0 z-[44] h-screen w-[28px] flex flex-col items-center pt-[14px] px-[2px] gap-[10px] transition-colors cursor-pointer ${open ? 'bg-[var(--tf-sheet)]' : 'bg-transparent hover:bg-[var(--tf-hover)]'}`}
    >
      <span className="grid place-items-center w-[18px] h-[18px] text-[var(--tf-text-secondary)] group-hover:text-[var(--tf-text)] transition-colors">
        <Sparkles size={12} />
      </span>
      <span className="[writing-mode:vertical-rl] uppercase text-[10.5px] tracking-[0.14em] text-[var(--tf-text-secondary)] group-hover:text-[var(--tf-text)] transition-colors select-none">
        Assistent
      </span>
    </button>
  );
}
