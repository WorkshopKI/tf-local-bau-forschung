/**
 * „Glossar" — nachschlagen, was die App und das Fachsystem benennen.
 *
 * Statuswerte, Kürzel, ihre Trigger-Wirkung und die Zieltage sind gepflegt, aber
 * bisher nur über „Vorgangs-Regeln" erreichbar — ein Kurationswerkzeug voller
 * Eingabefelder. Wer wissen will, was ein Kürzel bedeutet, öffnet es nicht. Hier
 * steht dasselbe Wissen lesend, mit einem Suchfeld darüber.
 *
 * **Kein eigener Bestand außer den Abkürzungen.** Alles Übrige kommt zur
 * Laufzeit aus der Katalog-Fassung und der Trigger-Tabelle; eine Kopie stimmte
 * nach zwei Wochen nicht mehr. Und **nichts ist editierbar**: kuriert wird
 * weiter unter „Vorgangs-Regeln". Zwei Orte für dieselbe Wahrheit sind schlimmer
 * als ein umständlicher Weg.
 *
 * **Bewusst `tools`, nicht `erprobung`** (die Startgruppe neuer Plugins, siehe
 * `docs/agents/add-plugin.md`): ein Nachschlagewerk hilft nur, wenn man es
 * findet, während man die Frage hat. Die Erprobungs-Gruppe ist zuklappbar und
 * bei Bestandsnutzern womöglich seit Monaten zu.
 *
 * **Kein Feature-Flag.** Abkürzungen und Begriffe nützen jeder Ausgabe; die
 * datengetriebenen Gruppen fehlen ohne geladenen Katalog ohnehin von selbst und
 * sagen an Ort und Stelle, warum.
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { GlossarPage } from './GlossarPage';

export const glossarPlugin: TeamFlowPlugin = {
  id: 'glossar',
  route: '/glossar',
  name: 'Glossar',
  icon: 'BookA',
  category: 'tools',
  // Direkt hinter „Suche" (20): beides sind Wege, etwas zu finden.
  order: 21,
  component: GlossarPage,
};

export { GlossarPage } from './GlossarPage';
