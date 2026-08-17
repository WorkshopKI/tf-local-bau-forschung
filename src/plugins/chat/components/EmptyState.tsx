import { Sparkles } from 'lucide-react';
import { Composer, type ComposerProps } from './Composer';

/**
 * Leerer Chat: Sparkles-Mark, Titel, Composer.
 *
 * **Ohne Vorschlags-Chips** (v4.86). Hier standen bis dahin vier Beispiele
 * („Anträge zu einem Thema clustern", „Gutachten-Entwurf vorbereiten" …). Sie
 * beschrieben Fähigkeiten, die der Assistent so noch nicht hat: ein Klick
 * schickte den Satz als gewöhnliche Frage los und lieferte eine Antwort, die
 * das Versprechen des Knopfes nicht einlöste. Ein Beispiel ist eine Zusage —
 * eine, die nicht gehalten wird, kostet mehr Vertrauen, als die leere Fläche
 * kostet.
 *
 * Die kontextgebundenen Quick-Actions des Shell-Docks
 * ([quickActions.ts](../assistent/quickActions.ts)) bleiben davon unberührt:
 * die werden beantwortet, weil die App ihren Kontext selbst zusammenstellt.
 */
export function EmptyState(composer: ComposerProps): React.ReactElement {
  return (
    <div className="empty">
      <div className="empty-mark"><Sparkles size={22} /></div>
      <h1 className="empty-title">Wie kann ich unterstützen?</h1>
      <div className="empty-sub">Frag den Archiv-Assistenten zu Anträgen, Dokumenten und Gutachten.</div>
      <Composer {...composer} autoFocus />
    </div>
  );
}
