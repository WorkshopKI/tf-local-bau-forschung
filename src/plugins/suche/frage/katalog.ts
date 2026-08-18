/**
 * Was das Suchfeld im **Frage-Modus der Dokumenten-Suche** vorschlägt — der
 * Katalog. Die Mechanik (Abschnitte, Lücken, Tastatur) ist geteilt und steht in
 * [@/components/frage-vorschlaege](src/components/frage-vorschlaege/abschnitte.ts).
 *
 * **Andere Fragen als in der Antragsliste, und das ist der Punkt.** Dort fragt
 * man nach Metadaten-Achsen (Status, Variante, PreCheck); hier nach einem
 * THEMA, das der [Frageplan](src/core/services/search/frageplan.ts) in
 * Suchbegriffe samt Schreibweisen übersetzt — plus Einschränkungen wie Ort,
 * Jahr oder Bearbeitungsstand, die als `pflicht` in den Plan gehen. Eine
 * Beispielfrage nach dem PreCheck wäre hier eine Einladung ins Leere.
 *
 * **`FRAGEN` ist zugleich der Vorrat des Startzustands** ([StartFragen.tsx](../start/StartFragen.tsx)).
 * Eine Seite, zwei Orte, an denen dieselben Beispiele stehen — aber nur EINE
 * Liste: zwei Vorräte liefen auseinander, und der Reiter „Fragen" ist genau die
 * ungedeckte Fläche, auf der die Liste beim leeren Feld steht.
 */
import { luecke, type FrageKatalog } from '@/components/frage-vorschlaege';

/**
 * Die Beispielfragen — je eine Form pro Sache, die ein Frageplan ausdrücken
 * kann: ein reines Thema mit vielen Schreibweisen, zwei Themen, ein Thema mit
 * Ortsbezug (der Fall, der eine Einschränkung erzeugt), ein Zeitraum
 * (`PlanFacetten.jahr`) und ein Bearbeitungsstand (`PlanFacetten.status`).
 *
 * Die letzten beiden standen bis v4.86 nicht hier — die Facetten gab es, aber
 * kein Beispiel zeigte, dass eine Frage sie setzen darf. Ein Beispiel für ein
 * Können, das niemand sieht, fehlt genauso wie das Können selbst.
 */
export const FRAGEN: readonly { frage: string; erklaerung: string }[] = [
  {
    frage: 'Welche Vorhaben drehen sich hauptsächlich um Normung und Standards?',
    erklaerung: 'findet auch „Normen", „Normierung", „Standardisierung"',
  },
  {
    frage: 'Zeig mir Projekte zu künstlicher Intelligenz in der Medizintechnik',
    erklaerung: 'zwei Themen — wer beide trägt, steht oben',
  },
  {
    frage: 'Was läuft in Bayern zum Thema Leichtbau?',
    erklaerung: 'der Ort schränkt ein, das Thema sucht',
  },
  {
    frage: 'Welche Vorhaben zur Wasserstofftechnologie laufen seit 2023?',
    erklaerung: 'der Zeitraum wird zur Jahresliste',
  },
  {
    frage: 'Was ist bei den noch offenen Anträgen zur Sensorik in Sachsen?',
    erklaerung: 'Stand und Ort schränken ein, das Thema sucht',
  },
];

/**
 * Wie viele Beispiele im Dropdown stehen.
 *
 * **Drei von fünf**: die Liste trägt darüber bis zu drei Verlaufs-Einträge und
 * darunter drei Vorlagen, und der Abschnitt „Zum Ausfüllen" muss ohne Scrollen
 * sichtbar bleiben — er ist der, den niemand sucht, der ihn noch nie gesehen
 * hat. Alle fünf stehen im Reiter „Fragen" des Startzustands, ungekürzt.
 */
const IM_DROPDOWN = 3;

/**
 * Der Katalog dieser Seite.
 *
 * Jede Lücke NENNT, was hineingehört — sie trägt keinen Beispielwert, den man
 * erst als Lücke erkennen müsste. Die drei Vorlagen decken die drei Achsen ab,
 * die eine Frage hier einschränken kann: Ort, Zeit, Stand.
 */
export const SUCHE_FRAGE_KATALOG: FrageKatalog = {
  praefix: 'suche',
  beispiele: FRAGEN.slice(0, IM_DROPDOWN).map(f => ({ text: f.frage, erklaerung: f.erklaerung })),
  vorlagen: [
    {
      text: `Welche Vorhaben drehen sich um ${luecke('Thema')}?`,
      hinweis: 'ein Thema in eigenen Worten — die KI ergänzt die Schreibweisen des Bestands',
    },
    {
      text: `Was läuft in ${luecke('Bundesland')} zum Thema ${luecke('Thema')}?`,
      hinweis: 'der Ort schränkt ein, das Thema sucht',
    },
    {
      text: `Welche noch offenen Anträge zu ${luecke('Thema')} laufen seit ${luecke('Jahr')}?`,
      hinweis: 'Stand und Jahr schränken ein · Jahr wie 2023',
    },
  ],
};
