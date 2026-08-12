/**
 * Das `⋯` im Widget-Kopf — dritter Auslöser desselben Widget-Menüs.
 *
 * Löst den Stift ab (bis v4.5 `WidgetQuickEdit`): der erschien nur bei Kanban und
 * Ampel, das `⋯` gilt für jedes Widget, und die Widget-Einstellungen stehen jetzt
 * als Eintrag IM Menü. Zwei Knöpfe nebeneinander wären dieselbe Bedienung zweimal.
 *
 * Sichtbar beim Überfahren der Karte, bei Tastatur-Fokus und solange sein Menü
 * offen ist — `opacity`, nie `display:none`: ein ausgeblendeter Knopf ist auch
 * per Tab nicht mehr erreichbar.
 */
import { useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { merkeHinweisGesehen } from './RechtsklickHinweis';
import { punktUnter, useStartseiteMenueStore } from './useStartseiteMenue';

export function WidgetMenueKnopf({ instanzId, titel }: {
  instanzId: string;
  titel: string;
}): React.ReactElement {
  const knopf = useRef<HTMLButtonElement>(null);
  const oeffne = useStartseiteMenueStore(s => s.oeffne);
  const offen = useStartseiteMenueStore(
    s => s.offen?.ziel.art === 'widget' && s.offen.ziel.instanzId === instanzId,
  );

  return (
    <button
      ref={knopf}
      type="button"
      aria-label={`Aktionen für ${titel}`}
      aria-haspopup="menu"
      aria-expanded={offen}
      title="Widget-Menü"
      onClick={() => {
        merkeHinweisGesehen();
        oeffne({ art: 'widget', instanzId }, punktUnter(knopf.current));
      }}
      className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-[var(--tf-radius-sm)] text-[var(--tf-text-tertiary)] cursor-pointer transition-opacity hover:bg-[var(--tf-bg-secondary)] hover:text-[var(--tf-text)] focus-visible:opacity-100 ${
        offen ? 'opacity-100' : 'opacity-0 group-hover/widget:opacity-100'
      }`}
    >
      <MoreHorizontal size={14} aria-hidden />
    </button>
  );
}
