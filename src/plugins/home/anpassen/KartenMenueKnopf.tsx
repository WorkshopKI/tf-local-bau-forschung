/**
 * Das `⋯` im Kopf einer Karte — der Auslöser ihres eigenen Menüs.
 *
 * EIN Knopf für beide Wirte (v4.41): die Widget-Karten (`WidgetShell`) und die
 * zwei festen Karten des Hero-Bandes. Er unterscheidet sie nur am `ziel`; hieße
 * er weiter `WidgetMenueKnopf` und stünde trotzdem im Hero, wäre der Name eine
 * Falschaussage — und eine zweite Kopie desselben Knopfes liefe auseinander,
 * sobald jemand nur einen von beiden anfasst.
 *
 * Löst den Stift ab (bis v4.5 `WidgetQuickEdit`): der erschien nur bei Kanban und
 * Ampel, das `⋯` gilt für jede Karte, und die Widget-Einstellungen stehen jetzt
 * als Eintrag IM Menü.
 *
 * Sichtbar beim Überfahren der Karte, bei Tastatur-Fokus und solange sein Menü
 * offen ist — `opacity`, nie `display:none`: ein ausgeblendeter Knopf ist auch
 * per Tab nicht mehr erreichbar.
 */
import { useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { merkeHinweisGesehen } from './RechtsklickHinweis';
import { punktUnter, useStartseiteMenueStore, zielGleich, type MenueZiel } from './useStartseiteMenue';

export function KartenMenueKnopf({ ziel, titel }: {
  ziel: MenueZiel;
  titel: string;
}): React.ReactElement {
  const knopf = useRef<HTMLButtonElement>(null);
  const oeffne = useStartseiteMenueStore(s => s.oeffne);
  const offen = useStartseiteMenueStore(s => zielGleich(s.offen?.ziel, ziel));

  return (
    <button
      ref={knopf}
      type="button"
      aria-label={`Aktionen für ${titel}`}
      aria-haspopup="menu"
      aria-expanded={offen}
      title="Karten-Menü"
      onClick={() => {
        merkeHinweisGesehen();
        oeffne(ziel, punktUnter(knopf.current));
      }}
      className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-[var(--tf-radius-sm)] text-[var(--tf-text-tertiary)] cursor-pointer transition-opacity hover:bg-[var(--tf-bg-secondary)] hover:text-[var(--tf-text)] focus-visible:opacity-100 ${
        offen ? 'opacity-100' : 'opacity-0 group-hover/widget:opacity-100'
      }`}
    >
      <MoreHorizontal size={14} aria-hidden />
    </button>
  );
}
