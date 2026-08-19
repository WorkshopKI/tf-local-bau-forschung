/**
 * Die eine Frage-Stelle: „darf dieser Nutzer die Kurator-SEITEN sehen?"
 *
 * Drei Bedingungen UND-verknuepft — die Profil-Flagge, die Build-Variante
 * (`kuratorMenus`) und die Laufzeit-Freischaltung des Modul-Schlosses. Bis
 * v4.119 stand derselbe Ausdruck zweimal von Hand da (Sidebar-Filter im
 * `ShellLayout`, Routen-Schutz im `Router`) und ein DRITTER Aufrufer — der
 * Startzustand der Suche — fragte nur die halbe Bedingung ab
 * (`isKuratorFreigeschaltet()`, also Bauzeit + Schloss ohne die Flagge). Er bot
 * damit eine Tuer an, die die Sidebar demselben Nutzer verweigerte und hinter
 * der die Sperrseite stand.
 *
 * Abgrenzung: das hier ist SICHTBARKEIT, nicht Schreibrecht. Ob eine
 * Schreib-Aktion offen ist, entscheidet die Kurator-SITZUNG
 * (`useKuratorSession`) — „Sichtbarkeit ist nicht Berechtigung".
 */
import { isKuratorMenusEnabled } from '@/config/feature-flags';
import { useKuratorFrei } from '@/core/modul-freischaltung';
import { useProfile } from './useProfile';

export function useKuratorSeiten(): boolean {
  const { profile } = useProfile();
  const kuratorFrei = useKuratorFrei();
  return !!(profile?.is_kurator ?? profile?.is_admin) && isKuratorMenusEnabled() && kuratorFrei;
}
