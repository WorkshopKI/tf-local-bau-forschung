/**
 * Woher kam der Nutzer? — der Rückweg aus einer Detailseite.
 *
 * Die Antrags-Detailseite ist von überall erreichbar: Suche, Vorgangs-Board,
 * Home-Widgets, Dokumente, Arbeitsliste, Fristen. Sie kannte aber nur EIN Ziel
 * für ihr Schließen — die Förderanträge-Tabelle. Wer aus dem Vorgangs-Board kam,
 * landete in einer Liste, die er nie geöffnet hatte, und der Weg zurück zu
 * seinen Treffern war weg.
 *
 * Seit v4.133 trägt die Mechanik einen zweiten Wirt: die **Skill-Verwaltung**,
 * die das Startseiten-Widget „Zuletzt geändert" auf einen einzelnen Eintrag
 * öffnet. Damit sind die beiden früher auf `/antraege` fest verdrahteten Stellen
 * verallgemeinert — `LISTEN_ROUTEN` statt eines Pfad-Literals, und die eigene
 * Route als Parameter von `rueckwegAus` statt als eingebaute Sonderregel.
 *
 * Bis v4.82 lief das über einen Vermerk im `location.state`, den JEDER Aufrufer
 * selbst setzen musste — gesetzt hat ihn genau einer (die Suche). Deshalb jetzt
 * andersherum: die App merkt sich beim Navigieren die zuletzt besuchte Seite,
 * und die Detailseite liest sie. Kein Aufrufer muss etwas mitgeben, künftige
 * Seiten bekommen den Rückweg umsonst.
 *
 * Drei Entscheidungen, die das Verhalten tragen:
 *
 *  - **Detail-Routen werden nicht gemerkt.** Sonst wäre der Rückweg nach einem
 *    Weitersprung im Detail (`openAntrag`, ein Nachbar-TV) die Detailseite
 *    selbst. So bleibt die Herkunft die letzte ECHTE Station.
 *  - **Spiegel in `sessionStorage`.** `location.state` starb bei jedem
 *    Neuladen; danach griff wieder „Schließen → Tabelle". Der Spiegel überlebt
 *    F5, ein neues Fenster startet leer — niemand erbt den Rückweg von gestern.
 *  - **Die Tabelle selbst ist kein Rückweg.** Kommt man aus `/antraege`, steht
 *    die Liste ohnehin daneben und das X führt dorthin; ein Knopf „Zurück zu
 *    Förderanträge" wäre nur Lärm.
 *
 * Rein bis auf den Speicher-Zugriff und ohne Router-Import, damit die
 * Ableitungen ohne Rendering prüfbar sind.
 */

/** Fallback-Ziel des Schließens: die Förderanträge-Liste. */
export const ANTRAEGE_ROUTE = '/antraege';

/** Die Liste der Skill-Verwaltung; darunter liegt ein einzelner Skill bzw. eine Regel. */
export const SKILL_VERWALTUNG_ROUTE = '/kuration/skill-verwaltung';

/**
 * Listen-Routen der App: die Route selbst ist eine echte Station, alles
 * DARUNTER ist Detail (siehe `istDetailRoute`).
 *
 * Eine Liste statt eines Pfad-Literals, weil jede Seite mit Deep-Link auf einen
 * einzelnen Eintrag dieselbe Regel braucht — sonst merkt sich die App den
 * Deep-Link als Station, und der Rückweg zeigt auf die Seite, auf der man steht.
 */
const LISTEN_ROUTEN: readonly string[] = [ANTRAEGE_ROUTE, SKILL_VERWALTUNG_ROUTE];

const SPEICHER_SCHLUESSEL = 'teamflow_letzte_seite';

/** Die zuletzt besuchte Seite außerhalb der Detail-Routen. */
export interface Herkunft {
  /** Router-Pfad inkl. Query (`/kuration?panel=csv-quellen`). */
  route: string;
  /** Name der Seite, wie die Navigation ihn zeigt („Vorgangs-Board"). */
  label: string;
}

/**
 * Ist das die Route eines einzelnen Eintrags?
 *
 * Eine Listen-Route selbst ist eine echte Station; alles darunter
 * (`/antraege/16DS260261`, `/antraege/verbund/ZDS26026`, `…/aufbereitung`,
 * `/kuration/skill-verwaltung/<id>`) ist das Detail und darf nie zur eigenen
 * Herkunft werden.
 */
export function istDetailRoute(pathname: string): boolean {
  return LISTEN_ROUTEN.some(liste => pathname.startsWith(liste + '/'));
}

/** Toleranter Leser: alles Unerwartete heißt „keine Herkunft". */
function lies(): Herkunft | null {
  try {
    const roh = sessionStorage.getItem(SPEICHER_SCHLUESSEL);
    if (!roh) return null;
    const parsed = JSON.parse(roh) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const { route, label } = parsed as Record<string, unknown>;
    if (typeof route !== 'string' || route.length === 0) return null;
    if (typeof label !== 'string' || label.length === 0) return null;
    return { route, label };
  } catch {
    return null;
  }
}

/**
 * Merkt eine besuchte Seite. Detail-Routen werden übergangen (siehe Modulkopf),
 * die Herkunft bleibt dann stehen.
 */
function ohneQuery(route: string): string {
  const [pfad] = route.split('?');
  return pfad ?? route;
}

export function merkeSeite(route: string, label: string): void {
  if (istDetailRoute(ohneQuery(route))) return;
  if (label.length === 0) return;
  try {
    sessionStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify({ route, label }));
  } catch { /* ignore — ohne Spiegel gibt es eben keinen Rückweg */ }
}

/** Die aktuelle Herkunft, oder `null`. */
export function herkunftJetzt(): Herkunft | null {
  return lies();
}

/**
 * Der Rückweg-Knopf, den eine Seite anbietet — oder `null`.
 *
 * `null` heißt: kein Knopf. Das gilt ohne Herkunft und wenn die Herkunft die
 * aufrufende Seite SELBST ist: „Zurück zur Skill-Verwaltung", während man auf
 * ihr steht, ist ein Knopf, der nichts tut. Deshalb nennt jeder Wirt seine
 * eigene Route (`eigeneRoute`) — bis v4.132 stand dafür `/antraege` fest im
 * Code, was die Regel auf einen einzigen Wirt festnagelte.
 *
 * `label` ist der NAME der Seite, kein Satz — den baut die Brotkrume daraus
 * („Zurück zum Vorgangs-Board", siehe `rueckwegSatz.ts` + `RueckwegLink.tsx`).
 * Hier bleibt der Name roh, weil ihn auch das Schließen-Ziel und künftige
 * Aufrufer brauchen.
 */
export function rueckwegAus(h: Herkunft | null, eigeneRoute: string): Herkunft | null {
  if (!h) return null;
  if (ohneQuery(h.route) === eigeneRoute) return null;
  return h;
}

/** Wohin das Schließen des Antrags-Detail-Panels führt. */
export function detailSchliessenZiel(h: Herkunft | null): string {
  return rueckwegAus(h, ANTRAEGE_ROUTE)?.route ?? ANTRAEGE_ROUTE;
}
