/**
 * Der **Fragen-Katalog** des Assistenten — was man hier fragen kann.
 *
 * Löst die fünf festen Schnellfragen ab (bis v6.53 `quickActions.ts`). Die
 * wussten nichts vom Vorgang: „Fristen" stand auch dort, wo keine Uhr läuft, und
 * „Worauf wartet er?" gab es gar nicht, obwohl die Kaskade die Adresse kennt.
 *
 * **Die App entscheidet, nicht das Modell.** Jeder Eintrag hängt an einem
 * Signal der Vorgangsakte und erscheint nur, wenn es vorliegt — „Voraussetzung
 * nicht erfüllt → ausblenden, nicht ausgrauen". Ein Vorschlag, zu dem die Daten
 * fehlen, wäre eine Einladung ins Leere; dieselbe Regel trägt die
 * Frage-Vorschläge der Suche (`frage-vorschlaege/abschnitte.ts`). Ließe man das
 * Modell Folgefragen erfinden, böte es Fragen an, die es nicht beantworten kann.
 *
 * Eine Frage ist NICHTS WEITER als ein vorformulierter Text: der Klick schickt
 * ihn durch denselben `c.send()` wie eine getippte Frage (ein Aufruf je Turn,
 * resetChat, nur interner Transport).
 *
 * Rein — kein React, kein Speicher, keine Uhr.
 */
import { ROLLE_LABEL } from '@/core/status/rollen';
import type { KontextEntitaet, NutzerRolle, VorgangsAkte } from '@/core/services/assistent/kontext';
import type { BlockId } from './zusatzBloecke';

export type FragenGruppe =
  | 'lage' | 'fristen' | 'verlauf' | 'arbeit' | 'inhalt' | 'umfeld' | 'projektleitung' | 'arbeitsvorrat';

/** Reihenfolge der Gruppen im leeren Dock — und Beschriftung. */
export const GRUPPEN: readonly { gruppe: FragenGruppe; titel: string }[] = [
  { gruppe: 'lage', titel: 'Lage und Zuständigkeit' },
  { gruppe: 'fristen', titel: 'Fristen und Plan' },
  { gruppe: 'verlauf', titel: 'Verlauf' },
  { gruppe: 'arbeit', titel: 'Eigene Arbeit' },
  { gruppe: 'inhalt', titel: 'Inhalt' },
  { gruppe: 'umfeld', titel: 'Umfeld' },
  { gruppe: 'projektleitung', titel: 'Projektleitung' },
  { gruppe: 'arbeitsvorrat', titel: 'Arbeitsvorrat' },
];

/** Wie viele Folgefragen unter einer Antwort stehen. */
export const FOLGEFRAGEN_MAX = 3;

export interface FragenKontext {
  entitaet: KontextEntitaet | null;
  routeBeschreibung: string;
  /** Die Akte der Entität; zählt nur, wenn `akte.fuer` zur Entität passt. */
  akte: VorgangsAkte | null;
  nutzer: NutzerRolle;
  /** Ist der Orama-Index geladen? (unrein ermittelt, hereingereicht) */
  hatIndex: boolean;
  /**
   * Kann der Bestandslauf rechnen (Katalog-Fassung geladen)? Sonst gibt es keine
   * Bestandsfragen — ein Klick würde einen Lauf starten, der nie kommt.
   */
  bestandMoeglich?: boolean;
  /** Liefert der Meilenstein-Plan Risiken (Flag `meilensteinMonitoring`)? */
  planMoeglich?: boolean;
}

export interface Frage {
  /** Stabile Id (Reihenfolge, React-`key`, Tests). */
  id: string;
  gruppe: FragenGruppe;
  /** Knopf-Beschriftung. */
  label: string;
  /** Genau dieser Text geht in `c.send()`. */
  frage: string;
  /**
   * Blöcke, die diese Frage zuschaltet (Verlauf, Journal). Sie bleiben für die
   * Unterhaltung stehen, damit Nachfragen dieselbe Grundlage haben.
   */
  bloecke?: readonly BlockId[];
}

export interface FragenAbschnitt {
  gruppe: FragenGruppe;
  titel: string;
  fragen: Frage[];
}

type Text = string | ((k: FragenKontext) => string);

interface KatalogEintrag {
  id: string;
  gruppe: FragenGruppe;
  label: Text;
  frage: Text;
  bloecke?: readonly BlockId[];
  /** Rein deterministisch — nie entscheidet ein Modell, was erscheint. */
  sichtbarWenn: (k: FragenKontext, akte: VorgangsAkte | null) => boolean;
}

const mitVorgang = (k: FragenKontext): boolean => k.entitaet !== null;
/** Bestandsfragen: ohne Vorgang, mit PL-Schalter, und nur, wenn ein Lauf möglich ist. */
const imBestand = (k: FragenKontext): boolean =>
  k.entitaet === null && k.nutzer.projektleitung && k.bestandMoeglich === true;
const fachKurz = (k: FragenKontext): string =>
  (k.nutzer.fachrolle === 'alle' ? '' : ROLLE_LABEL[k.nutzer.fachrolle]);

/**
 * Katalog in STABILER Reihenfolge — die gefilterte Leiste behält sie, damit sie
 * beim Wechsel des Vorgangs nicht springt. Neben jedem Eintrag steht das Signal,
 * das ihn trägt; die Akte liefert es, der Faktenblock trägt es ins Modell.
 */
const KATALOG: readonly KatalogEintrag[] = [
  // ── Lage und Zuständigkeit ────────────────────────────────────────────────
  {
    id: 'naechster-schritt', gruppe: 'lage', label: 'Nächster Schritt',
    frage: 'Was ist hier als Nächstes zu tun – und von wem?',
    sichtbarWenn: mitVorgang,
  },
  {
    // Nur mit gewählter Fachrolle: sonst gibt es kein „ich".
    id: 'meine-aufgabe', gruppe: 'lage',
    label: k => `Meine Aufgabe als ${fachKurz(k)}`,
    frage: k => `Was muss ich als ${fachKurz(k)} hier tun?`,
    sichtbarWenn: k => mitVorgang(k) && k.nutzer.fachrolle !== 'alle',
  },
  {
    // Die Kaskade benennt eine wartende Rolle, oder ein Kürzel-Paar ist halb offen.
    id: 'worauf-wartet', gruppe: 'lage', label: 'Worauf wartet er?',
    frage: 'Worauf wartet der Vorgang gerade?',
    sichtbarWenn: (_k, a) => a !== null
      && (a.aufgaben.some(t => t.adresse?.startsWith('wartet auf') === true) || a.offenePaare.length > 0),
  },
  {
    id: 'wo-stehe-ich', gruppe: 'lage', label: 'Wo steht er?',
    frage: 'Wo im Verfahren steht dieser Vorgang?',
    sichtbarWenn: mitVorgang,
  },
  {
    // Nur wenn sich die Teilvorhaben tatsächlich unterscheiden.
    id: 'tv-vergleich', gruppe: 'lage', label: 'Teilvorhaben im Vergleich',
    frage: 'Welche Teilvorhaben hängen hinterher?',
    sichtbarWenn: (k, a) => k.entitaet?.art === 'verbund' && a !== null && a.teilvorhaben.length > 1
      && (new Set(a.teilvorhaben.map(t => t.status ?? '')).size > 1 || a.aufgaben.some(t => t.anteil !== undefined)),
  },

  // ── Fristen und Plan ──────────────────────────────────────────────────────
  {
    id: 'frist-rest', gruppe: 'fristen', label: 'Wie viel Zeit bleibt?',
    frage: 'Wie viel Zeit bleibt bis zur Frist – und ab wann zählt sie?',
    sichtbarWenn: (_k, a) => a?.frist?.zustand === 'laeuft',
  },
  {
    id: 'frist-angehalten', gruppe: 'fristen', label: 'Warum angehalten?',
    frage: 'Warum ist die Frist angehalten?',
    sichtbarWenn: (_k, a) => a?.frist?.zustand === 'angehalten',
  },
  {
    id: 'plan-halten', gruppe: 'fristen', label: 'Plan noch zu halten?',
    frage: 'Ist der Bearbeitungsplan noch zu halten?',
    sichtbarWenn: (_k, a) => a !== null && a.meilensteine !== undefined
      && a.meilensteine.prognose !== 'abgeschlossen' && a.meilensteine.prognose !== 'unbekannt',
  },
  {
    id: 'liegt-zu-lange', gruppe: 'fristen', label: 'Liegt er zu lange?',
    frage: 'Liegt der Vorgang zu lange?',
    sichtbarWenn: (_k, a) => a?.stillstand?.urteil === 'haengt',
  },
  {
    // Der Vergleich braucht den Bestand: Median und p90 je Status.
    id: 'liegezeit-vergleich', gruppe: 'fristen', label: 'Ist das ungewöhnlich lang?',
    frage: 'Ist die Liegezeit für diesen Status ungewöhnlich lang?', bloecke: ['bestand'],
    sichtbarWenn: (k, a) => k.bestandMoeglich === true
      && a?.stillstand !== undefined && a.stillstand.urteil !== 'unbewertet',
  },

  // ── Verlauf ───────────────────────────────────────────────────────────────
  {
    // Mit dem vollen Verlauf: die Akte trägt nur die jüngsten 30 Termine.
    id: 'seit-eingang', gruppe: 'verlauf', label: 'Was ist passiert?',
    frage: 'Was ist seit dem Eingang passiert?', bloecke: ['verlauf'],
    sichtbarWenn: (_k, a) => (a?.verlauf?.termine.length ?? 0) > 0,
  },
  {
    // Nur, wo die Verlaufsableitung Statusabschnitte ergibt (C16-Trigger vorhanden).
    id: 'status-dauer', gruppe: 'verlauf', label: 'Wie lange in welchem Status?',
    frage: 'Wie lange stand der Vorgang in welchem Status?', bloecke: ['verlauf'],
    sichtbarWenn: (_k, a) => (a?.verlauf?.statusAbschnitte ?? 0) > 0,
  },
  {
    id: 'tv-eingaenge', gruppe: 'verlauf', label: 'Eingänge der Teilanträge',
    frage: 'Wann kamen die Teilanträge – und wann war der Verbund vollständig?',
    sichtbarWenn: (k, a) => k.entitaet?.art === 'verbund' && a !== null
      && a.teilvorhaben.filter(t => t.eingang !== undefined).length > 1,
  },
  {
    // Nur mit einem Journal, das eine Anzeige der Seite schon geladen hat.
    id: 'seit-export', gruppe: 'verlauf', label: 'Was hat sich geändert?',
    frage: 'Was hat sich seit dem letzten Export geändert?', bloecke: ['journal'],
    sichtbarWenn: (_k, a) => (a?.journal?.aenderungen ?? 0) > 0,
  },
  {
    id: 'zurueckgenommen', gruppe: 'verlauf', label: 'Zurückgenommen oder verschoben?',
    frage: 'Wurde etwas zurückgenommen oder verschoben?', bloecke: ['journal'],
    sichtbarWenn: (_k, a) => (a?.journal?.zurueckgenommen ?? 0) > 0,
  },

  // ── Eigene Arbeit ─────────────────────────────────────────────────────────
  {
    id: 'gutachten-stand', gruppe: 'arbeit', label: 'Stand des Gutachtens',
    frage: 'Wie weit ist das Gutachten?',
    sichtbarWenn: (_k, a) => a?.artefakte?.gutachten !== undefined,
  },
  {
    id: 'nf-stand', gruppe: 'arbeit', label: 'Stand der Nachforderungen',
    frage: 'Wie weit sind die Nachforderungen?',
    sichtbarWenn: (_k, a) => a?.artefakte?.nachforderung !== undefined,
  },
  {
    id: 'pruefer', gruppe: 'arbeit', label: 'Hinweise der Prüfer',
    frage: 'Was haben die Prüfer am Gutachten angemerkt?',
    sichtbarWenn: (_k, a) => (a?.artefakte?.pruefHinweise.length ?? 0) > 0,
  },

  // ── Inhalt ────────────────────────────────────────────────────────────────
  {
    // Immer: die Titel von Verbund und Teilvorhaben reichen für einen Anfang.
    id: 'worum-geht-es', gruppe: 'inhalt', label: 'Worum geht es?',
    frage: 'Worum geht es in dem Vorhaben?',
    sichtbarWenn: mitVorgang,
  },
  {
    id: 'zusammenfassen', gruppe: 'inhalt', label: 'Zusammenfassen',
    frage: 'Fasse den aktuellen Vorgang zusammen.',
    sichtbarWenn: k => mitVorgang(k) && k.hatIndex,
  },

  // ── Umfeld ────────────────────────────────────────────────────────────────
  {
    id: 'vorgaenger', gruppe: 'umfeld', label: 'Frühere Anträge',
    frage: 'Gab es frühere, abgelehnte Anträge zu diesem Projekt?',
    sichtbarWenn: (_k, a) => (a?.vorgaenger?.length ?? 0) > 0,
  },

  // ── Projektleitung ────────────────────────────────────────────────────────
  {
    id: 'pl-gefaehrdet', gruppe: 'projektleitung', label: 'Ist er gefährdet?',
    frage: 'Ist dieser Vorgang gefährdet – und woran hängt es?',
    sichtbarWenn: (k, a) => k.nutzer.projektleitung && a !== null
      && (a.meilensteine !== undefined || a.stillstand !== undefined || a.frist !== undefined),
  },
  {
    // Nur ob, nie wer — die Akte zählt die Besetzung, sie kennt keine Kürzel.
    id: 'pl-zugewiesen', gruppe: 'projektleitung', label: 'AB und FB zugewiesen?',
    frage: 'Sind AB und FB zugewiesen?',
    sichtbarWenn: (k, a) => k.nutzer.projektleitung && (a?.zuweisung?.von ?? 0) > 0,
  },
  // Über den ganzen Bestand — auf Startseite und Liste, nur mit PL-Schalter. Der
  // Klick startet den Bestandslauf, falls kein gültiges Ergebnis vorliegt.
  {
    id: 'pl-stau', gruppe: 'projektleitung', label: 'Wo klemmt es?',
    frage: 'Wo klemmt es – bei welcher Rolle stauen sich Vorgänge?', bloecke: ['bestand'],
    sichtbarWenn: k => imBestand(k),
  },
  {
    id: 'pl-plan', gruppe: 'projektleitung', label: 'Wer reißt den Plan?',
    frage: 'Welche Verbünde reißen ihren Bearbeitungsplan?', bloecke: ['bestand'],
    sichtbarWenn: k => imBestand(k) && k.planMoeglich === true,
  },
  {
    id: 'pl-fristen', gruppe: 'projektleitung', label: 'Fristen der nächsten 14 Tage',
    frage: 'Welche Fristen laufen in den nächsten 14 Tagen ab – über alle?', bloecke: ['bestand'],
    sichtbarWenn: k => imBestand(k),
  },
  {
    id: 'pl-ohne-bearbeiter', gruppe: 'projektleitung', label: 'Ohne Bearbeiter',
    frage: 'Wie viele offene Vorgänge haben keine AB oder keinen FB?', bloecke: ['bestand'],
    sichtbarWenn: k => imBestand(k),
  },
  {
    id: 'pl-phasen', gruppe: 'projektleitung', label: 'Verteilung auf Verfahrensschritte',
    frage: 'Wie verteilt sich der Bestand auf die Verfahrensschritte?', bloecke: ['bestand'],
    sichtbarWenn: k => imBestand(k),
  },
  {
    id: 'pl-liegezeiten', gruppe: 'projektleitung', label: 'Liegezeiten je Status',
    frage: 'Wie lange liegen Vorgänge je Status – wo ist der lange Schwanz?', bloecke: ['bestand'],
    sichtbarWenn: k => imBestand(k),
  },

  // ── Arbeitsvorrat (Liste, Startseite) ─────────────────────────────────────
  {
    id: 'fristen', gruppe: 'arbeitsvorrat', label: 'Fristen',
    frage: 'Welche Fristen stehen an?',
    sichtbarWenn: k => k.entitaet === null,
  },
  {
    id: 'heute-dran', gruppe: 'arbeitsvorrat', label: 'Was ist heute dran?',
    frage: 'Was ist heute in meinem Arbeitsvorrat dran?',
    sichtbarWenn: k => k.entitaet === null,
  },
];

function aufloesen(t: Text, k: FragenKontext): string {
  return typeof t === 'function' ? t(k) : t;
}

/** Die Akte, sofern sie zur Entität gehört — sonst trägt sie kein Signal. */
function akteDer(k: FragenKontext): VorgangsAkte | null {
  return k.akte && k.entitaet && k.akte.fuer === k.entitaet.id ? k.akte : null;
}

/** Die sichtbaren Fragen in Katalogreihenfolge. Nie leer. */
export function fragenFuer(k: FragenKontext): Frage[] {
  const akte = akteDer(k);
  return KATALOG
    .filter(e => e.sichtbarWenn(k, akte))
    .map(e => ({
      id: e.id, gruppe: e.gruppe, label: aufloesen(e.label, k), frage: aufloesen(e.frage, k),
      ...(e.bloecke ? { bloecke: e.bloecke } : {}),
    }));
}

/**
 * Die Blöcke nach einem Klick: die schon zugeschalteten plus die der Frage, in
 * stabiler Reihenfolge. Zugeschaltet bleibt zugeschaltet, bis die Unterhaltung
 * neu beginnt oder der Vorgang wechselt.
 */
export function mitBloecken(aktiv: readonly BlockId[], neue: readonly BlockId[] = []): BlockId[] {
  return [...new Set([...aktiv, ...neue])];
}

/** Die sichtbaren Fragen nach Gruppe; leere Gruppen entfallen. */
export function fragenNachGruppe(k: FragenKontext): FragenAbschnitt[] {
  const fragen = fragenFuer(k);
  return GRUPPEN
    .map(g => ({ ...g, fragen: fragen.filter(f => f.gruppe === g.gruppe) }))
    .filter(g => g.fragen.length > 0);
}

const norm = (s: string): string => s.trim().toLowerCase();

/**
 * Die Folgefragen unter einer Antwort: sichtbar und noch nicht gestellt, zuerst
 * aus der Gruppe der zuletzt gestellten Frage — wer nach der Frist gefragt hat,
 * will eher „warum angehalten?" als „worum geht es?".
 */
export function folgefragen(
  k: FragenKontext, gestellt: readonly string[], max: number = FOLGEFRAGEN_MAX,
): Frage[] {
  const alle = fragenFuer(k);
  const schon = new Set(gestellt.map(norm));
  const letzteText = gestellt[gestellt.length - 1];
  const gruppe = letzteText === undefined
    ? undefined
    : alle.find(f => norm(f.frage) === norm(letzteText))?.gruppe;
  const offen = alle.filter(f => !schon.has(norm(f.frage)));
  const vorn = gruppe ? offen.filter(f => f.gruppe === gruppe) : [];
  const rest = gruppe ? offen.filter(f => f.gruppe !== gruppe) : offen;
  return [...vorn, ...rest].slice(0, max);
}
