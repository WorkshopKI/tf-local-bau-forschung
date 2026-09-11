/**
 * Wurzel der Startseite, die dem offenen Assistent-Dock ausweicht (v6.57).
 *
 * Das Dock liegt app-weit als Overlay über dem Blatt — breite Tabellen sollen
 * darunter ihre Breite behalten (assistent-panel.md, „Dock-Form"). Die Startseite
 * hat keine solche Tabelle, nur Karten, und was unter dem Dock läge, wäre schlicht
 * nicht lesbar. Deshalb hält sie rechts genau die Dock-Breite frei, solange es
 * offen ist; die Spalten enden links davon.
 *
 * Eine eigene Komponente, weil das Dock beim Ziehen seine Breite bei JEDER
 * Mausbewegung in den Store schreibt: abonniert wird hier, und pro Frame rendert
 * nur dieser Rahmen — die Kinder sind dieselben Elemente und werden übersprungen.
 */
import { useStore } from 'zustand';
import { isAssistentPanelEnabled } from '@/config/feature-flags';
import { assistentPanelUiStore } from '@/plugins/chat/assistent/panelUiStore';

interface Props {
  className?: string;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  children: React.ReactNode;
}

export function DockAussparung({ className, onContextMenu, children }: Props): React.ReactElement {
  const offen = useStore(assistentPanelUiStore, s => s.open);
  const breite = useStore(assistentPanelUiStore, s => s.width);
  // Ohne Flag ist kein Dock gemountet — ein in localStorage gemerktes `open`
  // darf dann nichts aussparen.
  const aussparen = isAssistentPanelEnabled() && offen;
  return (
    <div
      className={className}
      onContextMenu={onContextMenu}
      // Außenabstand statt Innenabstand: das `px-8` des Aufrufers bleibt als
      // Luft zur Dock-Kante stehen, statt überschrieben zu werden.
      style={aussparen ? { marginRight: breite } : undefined}
    >
      {children}
    </div>
  );
}
