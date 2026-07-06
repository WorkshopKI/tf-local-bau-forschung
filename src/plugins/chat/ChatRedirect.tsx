import { Navigate } from 'react-router-dom';

/**
 * @deprecated Der Chat ist seit Journey-Paket 1 Phase 4 kein eigener Vollbild-
 * Screen mehr, sondern das andockende „Assistent"-Panel der Suche
 * ([SuchSeite](../suche/SuchSeite.tsx), [ChatPanelHost](./ChatPanelHost.tsx)).
 * Die Route `/chat` bleibt für alte Feld-Bookmarks bestehen und leitet auf die
 * Suche mit geöffnetem Panel um. NICHT löschen.
 */
export function ChatRedirect(): React.ReactElement {
  return <Navigate to="/suche?assistent=1" replace />;
}
