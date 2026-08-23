/**
 * Doppelförderungs-Prüfung — gemeldete Frühkoordinierungs-Vorhaben gegen den
 * ZIM-Bestand halten.
 *
 * **Nicht in der Navigation** (`hideFromNav`): die Prüfung gehört fachlich zur
 * Suche und wird zweimal im Monat gebraucht, nicht täglich. Der Einstieg ist der
 * ⋯-Menüpunkt im Kopf der Suchseite; die Route bleibt trotzdem registriert, so
 * dass ein Lesezeichen und ein Deep-Link weiter funktionieren (der Router liest
 * die ungefilterte Plugin-Liste).
 *
 * Doku: docs/architecture/doppelfoerderung.md
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { DoppelfoerderungSeite } from './DoppelfoerderungSeite';

export const DOPPELFOERDERUNG_ROUTE = '/doppelfoerderung';

export const doppelfoerderungPlugin: TeamFlowPlugin = {
  id: 'doppelfoerderung',
  route: DOPPELFOERDERUNG_ROUTE,
  featureFlag: 'doppelfoerderung',
  name: 'Doppelförderung',
  icon: 'CopyCheck',
  category: 'erprobung',
  order: 46,
  hideFromNav: true,
  component: DoppelfoerderungSeite,
};

export { DoppelfoerderungSeite } from './DoppelfoerderungSeite';
export type {
  BereichsWahl, MeldungsListe, MeldungsZeile, TrefferBefund, ZeilenErgebnis,
} from './types';
