/**
 * Tagesbrief — die Sätze.
 *
 * Ein reiner Bauer je Thema. Die Eingaben sind bewusst **schmal und eigen**:
 * `useTagesbrief` passt die echten Quellen darauf an, damit dieses Modul ohne
 * Hooks, ohne Uhr und ohne Store node-testbar bleibt.
 *
 * **`satz` entsteht immer aus `segmente`** ({@link satzAus}) — nie von Hand
 * daneben geschrieben. Sonst liest die Vorlesesoftware etwas anderes als die
 * Maus zeigt, und niemand merkt es.
 */
import type { AdressTeile } from '@/core/status';
import type { NachtlaufName } from './nachtlaufNamen';
import type { BriefPunkt, Segment, Sprungziel, ThemaId } from './typen';

/** Fügt die Segment-Texte zum Satz. Die einzige Quelle für `BriefPunkt.satz`. */
export function satzAus(segmente: readonly Segment[]): string {
  return segmente.map(s => s.text).join('');
}

function punkt(
  themaId: ThemaId,
  segmente: Segment[],
  tage: number | null,
  frage: string,
  extra?: { rueckfall?: boolean; gruppe?: string },
): BriefPunkt {
  return {
    themaId,
    segmente,
    satz: satzAus(segmente),
    tage,
    frage,
    ...(extra?.rueckfall ? { rueckfall: true } : {}),
    ...(extra?.gruppe ? { gruppe: extra.gruppe } : {}),
  };
}

const text = (t: string): Segment => ({ art: 'text', text: t });
const ziel = (t: string, z: Sprungziel): Segment => ({ art: 'ziel', text: t, ziel: z });

/** „3 Vorgänge" / „ein Vorgang" — die Eins ausgeschrieben, wie im Fließtext üblich. */
function anzahl(n: number, ein: string, viele: string): string {
  return n === 1 ? `ein ${ein}` : `${n} ${viele}`;
}

// ---------------------------------------------------------------- Uhr-Themen --

/**
 * Ein Stillstands-Anlass (Zieltage), wie ihn `fristAnlaesse.ts` liefert — auf
 * das reduziert, was der Satz braucht. Meilensteine führt der Brief nicht
 * (s. `themen.ts`).
 *
 * **Achtung Vorzeichen:** `ueberTage` zählt Tage ÜBER dem Vorgesehenen (negativ
 * = so viel bleibt noch), `BriefPunkt.tage` zählt Tage BIS zur Fälligkeit. Der
 * Adapter dreht das Vorzeichen — hier steht es schon gedreht.
 */
export interface FristRoh {
  verbundId: string;
  akronym: string;
  /** Was los ist: Status oder Kürzel-Paar. */
  grund: string;
  /** Tage bis zur Fälligkeit; negativ = überfällig. */
  tage: number;
  /** Wie viele weitere Anlässe desselben Verbunds diese Zeile mitvertritt. */
  weitere: number;
  /**
   * Die Handlung an diesem Verbund — aus derselben Kaskade wie die Karte „Meine
   * Anträge". Vertritt ein Stillstands-Anlass den Verbund im Brief, verdrängt er
   * dort den To-do-Punkt; ohne dieses Feld fiele die Aufgabe dann ganz weg.
   */
  aufgabe?: AufgabeText;
}

/**
 * Die Uhr nennt ihre Herkunft, der Grund steht in Anführung dahinter.
 *
 * Eine nackte Klammer las sich als Zustand: „KITED ist seit 227 Tagen fällig
 * (QS freigegeben und versendet)" meinte einen Termin, der seit 227 Tagen
 * NICHT erreicht war — und die Karte darunter sagte „Stellungnahme RNE prüfen"
 * (gemessen 11.09.2026, damals am Meilenstein-Thema). Das Fristen-Widget trägt
 * die Herkunft seit v4.86 als Marke; der Brief hatte sie weggeworfen.
 *
 * Zieltage messen Liegezeit, keinen Termin — deshalb „überfällig", nicht
 * „fällig" (CONTEXT.md).
 */
function stillstandSatz(r: FristRoh): BriefPunkt {
  const zielAntrag: Sprungziel = { art: 'antrag', scopeId: r.verbundId };
  const wann = r.tage < 0
    ? `seit ${Math.abs(r.tage)} Tagen überfällig`
    : r.tage === 0
      ? 'heute überfällig'
      : `in ${r.tage} Tagen überfällig`;
  const uhr = `Stillstand${r.grund ? ` „${r.grund}“` : ''} ${wann}`
    + (r.weitere > 0 ? ` — und ${r.weitere} weitere im selben Verbund` : '');
  const a = r.aufgabe;
  // Mit Aufgabe dieselbe Form wie ein To-do-Punkt: die Uhr in der Klammer, die
  // Handlung hinter dem Doppelpunkt.
  const segmente: Segment[] = a
    ? [ziel(r.akronym, zielAntrag), text(` (${uhr}): ${a.text}`), ...vermerke(a), text('.')]
    : [ziel(r.akronym, zielAntrag), text(`: ${uhr}`), text('.')];
  return punkt('stillstand', segmente, r.tage, `Was ist bei ${r.akronym} zu tun?`, {
    rueckfall: a?.rueckfall === true,
    gruppe: r.verbundId,
  });
}

/** Zieltage: der Stillstands-Wächter — misst Liegezeit, keinen Termin. */
export function stillstandPunkte(anlaesse: readonly FristRoh[]): BriefPunkt[] {
  return anlaesse.map(stillstandSatz);
}

/** Die Handlung an einem Vorgang, aus der To-do-Kaskade (oder dem Rückfall). */
export interface AufgabeRoh {
  /** Sprungziel: Verbund-Id, ersatzweise Aktenzeichen. */
  scopeId: string;
  titel: string;
  /** Der To-do-Text der Kaskade bzw. der alten Formel. */
  text: string;
  /** Restfrist in Tagen; negativ = überfällig. */
  tage: number;
  /** Der Text kommt aus dem Rückfall, nicht aus der Kaskade. */
  rueckfall: boolean;
  /** Der Text stammt aus dem Bestand vor der letzten Datenaktualisierung. */
  vorlaeufig?: boolean;
}

/** Der Teil einer Aufgabe, den ein Satz spricht — ohne Uhr und Sprungziel. */
export type AufgabeText = Pick<AufgabeRoh, 'text' | 'rueckfall' | 'vorlaeufig'>;

/** Die Vermerke einer Aufgabe — an jedem Satz, der eine spricht. */
function vermerke(a: AufgabeText): Segment[] {
  return [
    // Ein Rückfall, der sich nicht zu erkennen gibt, spricht die widerlegte
    // Formel, als wäre sie belegt.
    text(a.rueckfall ? ' — aus dem Status abgeleitet, keine Regel greift' : ''),
    // Der Stand von vor dem Import sagt, dass er einer ist — in Worten wie der
    // Rückfall: der Brief ist Text, ein Symbol hätte hier keinen Platz.
    text(a.vorlaeufig ? ' (Stand vor der Datenaktualisierung, wird neu berechnet)' : ''),
  ];
}

/**
 * Die Uhr gehört IN den Satz.
 *
 * Der Brief ist nach Tagen sortiert; steht die Zahl nicht da, liest sich die
 * Reihenfolge als willkürlich. Gemessen am echten Bestand standen drei To-dos
 * ohne jede Zeitangabe über einer Frist, die „seit 167 Tagen fällig" sagte —
 * niemand konnte sehen, warum.
 */
function uhrText(tage: number): string {
  if (tage < 0) return `seit ${Math.abs(tage)} Tagen überfällig`;
  if (tage === 0) return 'heute fällig';
  return `noch ${tage} Tage`;
}

export function zuTunPunkte(aufgaben: readonly AufgabeRoh[]): BriefPunkt[] {
  return aufgaben.map(a => {
    const segmente: Segment[] = [
      ziel(a.titel, { art: 'antrag', scopeId: a.scopeId }),
      text(` (${uhrText(a.tage)}): ${a.text}`),
      ...vermerke(a),
      text('.'),
    ];
    return punkt('zu-tun', segmente, a.tage, `Was ist bei ${a.titel} zu tun?`, { rueckfall: a.rueckfall, gruppe: a.scopeId });
  });
}

// ------------------------------------------------------------ Nachsatz-Themen --

/** Wie viele Namen eine Liste im Nachsatz nennt, bevor „und N weitere" übernimmt. */
export const MAX_NAMEN = 3;

/** Ein Name einer Liste: Sprungziel plus optionaler Zusatz dahinter. */
interface ListenName {
  text: string;
  scopeId: string;
  zusatz?: string;
}

/**
 * „A, B und C" bzw. „A, B, C und 2 weitere" — jeder Name ein eigenes Sprungziel.
 *
 * Der Rest wird gezählt, nicht verschwiegen. Er ist kein Sprungziel, weil keine
 * Seite genau diese Menge zeigt.
 */
function namensListe(namen: readonly ListenName[]): Segment[] {
  const gezeigt = namen.slice(0, MAX_NAMEN);
  const rest = namen.length - gezeigt.length;
  const segmente: Segment[] = [];
  gezeigt.forEach((n, i) => {
    if (i > 0) segmente.push(text(rest === 0 && i === gezeigt.length - 1 ? ' und ' : ', '));
    segmente.push(ziel(n.text, { art: 'antrag', scopeId: n.scopeId }));
    if (n.zusatz) segmente.push(text(n.zusatz));
  });
  if (rest > 0) segmente.push(text(` und ${rest} weitere`));
  return segmente;
}

/** Ein Vorgang, dessen Aufgabe bei einer anderen Rolle liegt oder auf jemanden wartet. */
export interface FremdRoh {
  scopeId: string;
  titel: string;
  /** Tage bis bzw. seit Fälligkeit — ordnet die Liste, der Satz nennt sie nicht. */
  tage: number;
  adresse: AdressTeile;
}

/** Im Satz „auf den Antragsteller"; die Rollen bleiben Kürzel wie in der Nebenzeile. */
function wartetAufWen(wer: string): string {
  return wer === 'Antragsteller' ? 'den Antragsteller' : wer;
}

/**
 * Was bei anderen liegt — je Adresse ein Punkt im Nachsatz, dringlichste zuerst.
 *
 * Eine Aufgabe einer anderen Rolle ist eine Auskunft, keine Handlung
 * (aufgaben-anzeige.ts). Gemessen am 11.09.2026 (Kürzel THü, liest als FB)
 * stand AIRES „GA schreiben" — liegt bei AB — an der Spitze, als wäre es die
 * Aufgabe des Lesers. Ein Vorgang steht einmal, an seinem dringlichsten Anlass.
 */
export function liegtBeiAnderenPunkte(fremde: readonly FremdRoh[]): BriefPunkt[] {
  const gruppen = new Map<string, FremdRoh[]>();
  const gesehen = new Set<string>();
  for (const f of [...fremde].sort((a, b) => a.tage - b.tage)) {
    if (gesehen.has(f.scopeId)) continue;
    gesehen.add(f.scopeId);
    const schluessel = `${f.adresse.art}:${f.adresse.wer}`;
    const liste = gruppen.get(schluessel);
    if (liste) liste.push(f); else gruppen.set(schluessel, [f]);
  }
  return [...gruppen.values()].map(liste => {
    const erster = liste[0]!;
    const { art, wer } = erster.adresse;
    const eins = liste.length === 1;
    const kopf = art === 'liegt'
      ? `bei ${wer} ${eins ? 'liegt' : 'liegen'} `
      : `auf ${wartetAufWen(wer)} ${eins ? 'wartet' : 'warten'} `;
    const segmente: Segment[] = [
      text(kopf),
      ...namensListe(liste.map(f => ({ text: f.titel, scopeId: f.scopeId }))),
    ];
    if (eins) {
      return punkt('liegt-bei-anderen', segmente, null, `Wo steht ${erster.titel} gerade?`, { gruppe: erster.scopeId });
    }
    return punkt('liegt-bei-anderen', segmente, null, art === 'liegt'
      ? `Welche meiner Vorgänge liegen bei ${wer}?`
      : `Welche meiner Vorgänge warten auf ${wartetAufWen(wer)}?`);
  });
}

/** Ein Vorgang, der laut Kürzeln erledigt ist, dessen amtlicher Status aber noch offen sagt. */
export interface WiderspruchRoh {
  scopeId: string;
  titel: string;
  /** Der rohe amtliche Status — nur gezeigt, nie verglichen (Pitfall #12). */
  status: string;
}

/**
 * Kürzel ↔ Status — ein Befund, keine Aufgabe.
 *
 * Die Kürzel sind der jüngere Stand; „Meine Anträge" zählt solche Vorgänge
 * nicht mehr als offen (Sperre im AB-Satz, `erledigtLautKuerzeln`). Der Satz
 * nennt den Widerspruch und behauptet nichts darüber, wer ihn auflöst: die App
 * leitet keinen Status ab (Pitfall #44).
 *
 * Nicht zu verwechseln mit „Keine Aufgabe mehr" in der Sicht einer ANDEREN
 * Rolle: ist nur deren Satz gesperrt (FB nach „RNE oder Ablehnung begonnen"),
 * liegt der Vorgang beim AB — das sagt „Liegt bei anderen", nicht dieser Satz.
 */
export function kuerzelStatusPunkt(vorgaenge: readonly WiderspruchRoh[]): BriefPunkt | null {
  if (vorgaenge.length === 0) return null;
  if (vorgaenge.length === 1) {
    const v = vorgaenge[0]!;
    const status = v.status.trim();
    const segmente: Segment[] = [
      ziel(v.titel, { art: 'antrag', scopeId: v.scopeId }),
      text(status
        ? ` ist laut Kürzeln erledigt, der Status sagt noch „${status}“`
        : ' ist laut Kürzeln erledigt, trägt aber noch einen offenen Status'),
    ];
    return punkt('kuerzel-status', segmente, null,
      `Warum sagt der Status bei ${v.titel} noch etwas anderes als die Kürzel?`, { gruppe: v.scopeId });
  }
  const segmente: Segment[] = [
    text('laut Kürzeln erledigt, der Status sagt noch etwas anderes: '),
    ...namensListe(vorgaenge.map(v => ({
      text: v.titel,
      scopeId: v.scopeId,
      ...(v.status.trim() ? { zusatz: ` („${v.status.trim()}“)` } : {}),
    }))),
  ];
  return punkt('kuerzel-status', segmente, null,
    'Welche Vorgänge sind laut Kürzeln erledigt, tragen aber noch einen offenen Status?');
}

/**
 * Änderungen des letzten Nachtlaufs — mit Namen, je Vorgang einer.
 *
 * Bis v6.60 stand hier nur die Zahl („4 Vorgänge haben sich über Nacht
 * geändert"); gemeint waren zwei Verbünde. Hat sich der amtliche Status
 * geändert, steht der neue in Worten dabei; reine Kürzel-Setzungen nennen nur
 * den Namen — ihr Klartext steht auf der Karte „Änderungen der letzten Nacht".
 * **Keine Personen-Achse** (Pitfall #48).
 */
export function nachtlaufPunkt(namen: readonly NachtlaufName[], zeitraum: string): BriefPunkt | null {
  if (namen.length === 0) return null;
  const segmente: Segment[] = [
    text(`${zeitraum} geändert: `),
    ...namensListe(namen.map(n => ({
      text: n.name,
      scopeId: n.scopeId,
      ...(n.statusNeu ? { zusatz: ` (Status jetzt „${n.statusNeu}“)` } : {}),
    }))),
  ];
  return punkt('nachtlauf', segmente, null, 'Was hat sich über Nacht geändert?');
}

/**
 * Neu dazugekommen — die `antrag-neu`-Einträge des Journals.
 *
 * Bewusst **nicht** die Eingangs-Ampel: deren zwei Zahlen stehen bereits als
 * Kacheln in der Hero-Karte darüber, und sie messen Alter, nicht Zugang.
 */
export function neuPunkt(anzahlNeu: number): BriefPunkt | null {
  if (anzahlNeu <= 0) return null;
  const segmente: Segment[] = [
    ziel(anzahl(anzahlNeu, 'Antrag', 'Anträge'), { art: 'seite', plugin: 'antraege' }),
    text(anzahlNeu === 1 ? ' ist neu dazugekommen' : ' sind neu dazugekommen'),
  ];
  return punkt('eingang', segmente, null, 'Welche Anträge sind neu dazugekommen?');
}

export function entwuerfePunkt(anzahlOffen: number, ersterScopeId: string | null): BriefPunkt | null {
  if (anzahlOffen <= 0) return null;
  const beschriftung = anzahl(anzahlOffen, 'eigener Entwurf', 'eigene Entwürfe');
  const segmente: Segment[] = [
    ersterScopeId
      ? ziel(beschriftung, { art: 'antrag', scopeId: ersterScopeId })
      : text(beschriftung),
    text(anzahlOffen === 1 ? ' wartet auf dich' : ' warten auf dich'),
  ];
  return punkt('entwuerfe', segmente, null, 'Welche Entwürfe habe ich offen?');
}

export function weitermachenPunkt(titel: string, scopeId: string): BriefPunkt | null {
  if (!titel.trim()) return null;
  const segmente: Segment[] = [
    text('zuletzt warst du bei '),
    ziel(titel, { art: 'antrag', scopeId }),
  ];
  // Die Frage nach dem Stand braucht ihren Vorgang am dringendsten. Im Nachsatz
  // kostet die Gruppe nichts: die Entdopplung in `baueBrief` läuft nur über die
  // Uhr-Punkte (`tage !== null`), der Nachsatz wird getrennt gefiltert.
  return punkt('weitermachen', segmente, null, `Wo stehe ich bei ${titel}?`, { gruppe: scopeId });
}

export function feedbackPunkt(neuigkeiten: number): BriefPunkt | null {
  if (neuigkeiten <= 0) return null;
  const segmente: Segment[] = [
    ziel(
      anzahl(neuigkeiten, 'Feedback-Neuigkeit', 'Feedback-Neuigkeiten'),
      { art: 'seite', plugin: 'feedback-board' },
    ),
  ];
  return punkt('feedback', segmente, null, 'Was gibt es Neues im Feedback?');
}

export function registryPunkt(aenderungen: number): BriefPunkt | null {
  if (aenderungen <= 0) return null;
  const segmente: Segment[] = [
    ziel(
      anzahl(aenderungen, 'Änderung', 'Änderungen'),
      { art: 'seite', plugin: 'skill-verwaltung' },
    ),
    text(' an Skills und Regeln'),
  ];
  return punkt('registry', segmente, null, 'Was wurde an Skills und Regeln geändert?');
}
