/**
 * „Widget hinzufügen" am Ende einer Spalte (Handoff §2.3, Screenshot 11).
 *
 * Öffnet das Startseiten-Menü direkt mit dem Widgets-Untermenü — der Weg über
 * „Widgets ▸" wäre hier ein Klick zu viel, weil die Absicht schon im Knopf steht.
 * Der Knopf macht außerdem die leere Spalte bedienbar: ohne ihn gäbe es dort
 * nichts, worauf man zielen könnte, außer der Fläche selbst.
 */
import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { merkeHinweisGesehen } from './RechtsklickHinweis';
import { punktUnter, useStartseiteMenueStore } from './useStartseiteMenue';

export function WidgetHinzufuegen(): React.ReactElement {
  const knopf = useRef<HTMLButtonElement>(null);
  const oeffne = useStartseiteMenueStore(s => s.oeffne);

  return (
    <button
      ref={knopf}
      type="button"
      onClick={() => {
        merkeHinweisGesehen();
        oeffne({ art: 'flaeche' }, punktUnter(knopf.current), { untermenue: 'widgets' });
      }}
      className="flex w-full items-center justify-center gap-2 rounded-[var(--tf-radius-lg)] px-3 py-[13px] text-[12.5px] text-[var(--tf-text-tertiary)] cursor-pointer hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
      style={{ border: '0.5px dashed var(--tf-border-hover)' }}
    >
      <Plus size={14} strokeWidth={1.4} aria-hidden />
      Widget hinzufügen
    </button>
  );
}
