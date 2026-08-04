/**
 * „Zu klären" — Fachfragen, die die Kollegen asynchron beantworten.
 *
 * Eine **Klärung** ist ein Fragebogen aus Seed-Daten; die Antworten liegen auf dem
 * Daten-Share, eine Datei je Person. Die erste Klärung ist der ZAH-Phasenschnitt:
 * er steht im Code, wirkt an vielen Stellen (Board-Gruppierung, Filter,
 * Zieltage-Vorschläge, Kategorie-Ableitung) — und war bisher weder sichtbar noch
 * kommentierbar.
 *
 * **Das Modul ändert nichts.** Es schreibt nicht in die Katalog-Fassung und nicht
 * in den Seed. Der Weg einer Änderung bleibt: Klärung → Export → Seed-Änderung →
 * Release. Editierbar wäre der Schnitt auch die falsche Antwort — `prod` lädt
 * keine Fassung, ein in `pl` geänderter Schnitt wäre eine zweite stille Wahrheit.
 *
 * **Bewusst `tools`, nicht `erprobung`** (die Startgruppe neuer Plugins, siehe
 * `docs/agents/add-plugin.md`): die Erprobungs-Gruppe ist zuklappbar und bei
 * Bestandsnutzern womöglich seit Monaten zu. Ein Fragebogen, der heute beantwortet
 * werden soll, darf nicht in einer zugeklappten Schublade liegen.
 *
 * Doku: docs/architecture/klaerung.md
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { ZuKlaerenPage } from './ZuKlaerenPage';

export const zuKlaerenPlugin: TeamFlowPlugin = {
  id: 'zu-klaeren',
  route: '/zu-klaeren',
  featureFlag: 'vorgangssystem',
  name: 'Zu klären',
  icon: 'MessageCircleQuestion',
  category: 'tools',
  order: 26,
  component: ZuKlaerenPage,
};

export { ZuKlaerenPage } from './ZuKlaerenPage';
