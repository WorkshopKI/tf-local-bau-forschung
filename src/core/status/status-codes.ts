/**
 * Der Status-Katalog des Fachsystems: **Code ↔ Text**.
 *
 * Der nächtliche Export liefert den Status nur als Text (`STATUS_TV`,
 * `STATUS_VB`). Die amtlichen Codes (11 Skizze … 99 Schlussvermerk) stehen in
 * der Legacy-Parametertabelle. Dieses Modul joint beides — danach rechnet die
 * App intern mit Codes, und Textvarianten betreffen nur noch Beschriftungen.
 *
 * **Zwei Stufen, in dieser Reihenfolge:**
 * 1. exakter Treffer auf `normKey` (NFC + trim + lowercase) über Text + Varianten
 * 2. nachrangig `loseKey` (zusätzlich ohne Interpunktion) — „Stellungnahme zur
 *    Rücknahmeempf." gegen „Stellungnahme zur Rücknahmeempf". Der lose Index
 *    führt **nur eindeutige** Schlüssel: wo zwei Codes auf denselben losen
 *    Schlüssel fielen, wird gar nicht geraten.
 *
 * Kein Treffer heißt **kein Treffer** — die Oberfläche schreibt dann „Statuswert
 * nicht im Katalog" hin, statt still eine Phase zu erfinden.
 *
 * **Der Seed legt keine zweite Werteliste an.** Er reichert die vorhandenen
 * `StatusWertEintrag` an (die aus `status-canonical.ts` stammen, siehe
 * `seed.ts`): Code, Varianten, ZAH-Phase, Marker-Flag. Werte der
 * Bauantrag-Domäne (`neu`, `genehmigt`, `archiviert` …) treffen naturgemäß
 * keinen Förder-Code und bleiben unangetastet — sie gehören nicht in dieses
 * Verfahren (Pitfall #9).
 *
 * Rein und deterministisch: keine IO, keine Uhr, feste Reihenfolge.
 */
import { normKey, loseKey } from './normalisierung';
import { SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES } from './zah-phasen';
import type { StatusWertEintrag, ZahPhaseId } from './typen';

/** Ein Eintrag des Code-Katalogs. */
export interface StatusCodeEintrag {
  /** Amtlicher Code (11…99). */
  code: number;
  /** Amtliche Bezeichnung — wortgetreu aus der Parametertabelle. */
  text: string;
  /**
   * Weitere Schreibweisen, unter denen derselbe Status im Export auftaucht.
   * Erweiterbar: eine neue Variante ist ein Listeneintrag, kein Code-Umbau.
   */
  varianten: readonly string[];
}

/**
 * Die 30 Status-Codes der Legacy-Parametertabelle, in Code-Reihenfolge.
 *
 * Die `varianten` sind gegen die Rohwerte gestellt, die `status-canonical.ts`
 * aus echten CSV-Importen kennt — dort steht „Ablehnung" ohne „versandt" und
 * „VN techn. geprüft" mit Punkt.
 */
export const STATUS_CODE_KATALOG: readonly StatusCodeEintrag[] = [
  { code: 11, text: 'Skizze eingegangen', varianten: [] },
  { code: 29, text: 'Irrläufer', varianten: [] },
  { code: 31, text: 'beantragt', varianten: [] },
  { code: 32, text: 'ablehnungsreif', varianten: [] },
  { code: 33, text: 'unvollständig', varianten: [] },
  { code: 34, text: 'bearbeitungsreif', varianten: [] },
  { code: 35, text: 'NF gestellt', varianten: ['Nachforderung gestellt'] },
  { code: 36, text: 'NL eingegangen', varianten: ['Nachlieferung eingegangen'] },
  { code: 37, text: 'keine weiteren NF', varianten: ['keine weiteren Nachforderungen'] },
  { code: 38, text: 'techn geprüft', varianten: ['techn. geprüft', 'technisch geprüft'] },
  { code: 39, text: 'kaufm geprüft', varianten: ['kaufm. geprüft', 'kaufmännisch geprüft'] },
  { code: 40, text: 'Gutachten fertig', varianten: [] },
  { code: 50, text: 'Bewilligungsentwurf VDI/VDE-IT', varianten: ['Bewilligungsentwurf'] },
  { code: 51, text: 'bewilligungsreif', varianten: [] },
  { code: 59, text: 'bewilligt', varianten: [] },
  { code: 70, text: 'Ablehnung versandt', varianten: ['Ablehnung'] },
  { code: 71, text: 'Rücknahmeempfehlung versandt', varianten: ['Rücknahmeempfehlung', 'RNE versandt'] },
  {
    code: 72,
    text: 'Stellungnahme zur Rücknahmeempfehlung',
    varianten: ['Stellungnahme zur Rücknahmeempf.'],
  },
  { code: 73, text: 'abgelehnt/zurückgezogen', varianten: [] },
  { code: 75, text: 'Widerspruch zur Ablehnung', varianten: [] },
  { code: 88, text: 'Sonderstatus', varianten: [] },
  { code: 89, text: 'Anhörung zum Widerruf', varianten: [] },
  { code: 90, text: 'abgebrochen', varianten: [] },
  { code: 91, text: 'beendet', varianten: [] },
  { code: 92, text: 'Widerruf', varianten: [] },
  { code: 93, text: 'assoziierter Partner', varianten: [] },
  { code: 94, text: 'internationaler Partner', varianten: [] },
  { code: 95, text: 'VN technisch geprüft', varianten: ['VN techn. geprüft', 'VN techn geprüft'] },
  { code: 97, text: 'VN geprüft', varianten: [] },
  { code: 99, text: 'Schlussvermerk', varianten: [] },
];

/** Nachschlage-Index über einen Code-Katalog (exakt + nachrangig lose). */
export interface StatusCodeIndex {
  exakt: ReadonlyMap<string, StatusCodeEintrag>;
  /** Nur EINDEUTIGE lose Schlüssel — mehrdeutige werden verworfen, nicht geraten. */
  lose: ReadonlyMap<string, StatusCodeEintrag>;
  nachCode: ReadonlyMap<number, StatusCodeEintrag>;
}

/** Baut den Nachschlage-Index. Rein; bei gleichem Eingang gleicher Ausgang. */
export function baueStatusCodeIndex(
  katalog: readonly StatusCodeEintrag[] = STATUS_CODE_KATALOG,
): StatusCodeIndex {
  const exakt = new Map<string, StatusCodeEintrag>();
  const nachCode = new Map<number, StatusCodeEintrag>();
  const loseZaehler = new Map<string, StatusCodeEintrag | null>();

  for (const e of katalog) {
    nachCode.set(e.code, e);
    for (const schreibweise of [e.text, ...e.varianten]) {
      const k = normKey(schreibweise);
      if (k && !exakt.has(k)) exakt.set(k, e);
      const l = loseKey(schreibweise);
      if (!l) continue;
      const bisher = loseZaehler.get(l);
      // Zweiter Anwärter auf denselben losen Schlüssel ⇒ mehrdeutig ⇒ raus.
      if (bisher === undefined) loseZaehler.set(l, e);
      else if (bisher !== null && bisher.code !== e.code) loseZaehler.set(l, null);
    }
  }

  const lose = new Map<string, StatusCodeEintrag>();
  for (const [k, e] of loseZaehler) {
    // Ein loser Schlüssel, der schon exakt trifft, bringt nichts Neues.
    if (e && !exakt.has(k)) lose.set(k, e);
  }
  return { exakt, lose, nachCode };
}

/** Der Index über die Auslieferung — einmal gebaut, nicht je Aufruf. */
const SEED_INDEX = baueStatusCodeIndex();

/** Wie ein Text auf seinen Code kam — für die ehrliche Anzeige. */
export type JoinArt = 'exakt' | 'variante-lose';

export interface StatusCodeTreffer {
  eintrag: StatusCodeEintrag;
  art: JoinArt;
}

/**
 * Status-Rohtext → Code-Eintrag. `null`, wenn der Katalog den Text nicht kennt —
 * die Oberfläche sagt das dann, statt eine Phase zu erfinden.
 */
export function findeStatusCode(
  text: unknown, index: StatusCodeIndex = SEED_INDEX,
): StatusCodeTreffer | null {
  if (typeof text !== 'string') return null;
  const k = normKey(text);
  if (!k) return null;
  const treffer = index.exakt.get(k);
  if (treffer) return { eintrag: treffer, art: 'exakt' };
  const los = index.lose.get(loseKey(text));
  return los ? { eintrag: los, art: 'variante-lose' } : null;
}

/** Eintrag zu einem Code (für Beschriftungen aus gespeicherten Codes). */
export function statusCodeEintrag(
  code: number, index: StatusCodeIndex = SEED_INDEX,
): StatusCodeEintrag | null {
  return index.nachCode.get(code) ?? null;
}

/**
 * Reichert Statuswerte um Code, Varianten, ZAH-Phase und Marker-Flag an.
 *
 * Additiv und **nicht überschreibend**: was die PL schon kuratiert hat (eine von
 * Hand umgehängte `zahPhaseId`, ein gepflegter `zieltage`-Wert) bleibt stehen.
 * Nur fehlende Angaben werden ergänzt — sonst nähme jeder Seed-Nachzug der PL
 * ihre Arbeit wieder weg.
 *
 * Werte ohne Code-Treffer werden unverändert durchgereicht.
 */
export function reichereWerteAn(
  werte: readonly StatusWertEintrag[], index: StatusCodeIndex = SEED_INDEX,
): StatusWertEintrag[] {
  return werte.map(w => {
    if (w.code !== undefined) return w;                 // schon zugeordnet
    const treffer = findeStatusCode(w.wert, index);
    if (!treffer) return w;
    const { code, varianten } = treffer.eintrag;
    // Kein Eintrag in der Schnitt-Tabelle heißt „ohne Phase": Marker laufen
    // neben dem Verfahren. `null` ist hier eine Aussage, kein fehlender Wert.
    const phase: ZahPhaseId | null = SEED_CODE_ZU_ZAH_PHASE.get(code) ?? null;
    return {
      ...w,
      code,
      ...(varianten.length > 0 ? { varianten: [...varianten] } : {}),
      ...(w.zahPhaseId === undefined ? { zahPhaseId: phase } : {}),
      ...(SEED_MARKER_CODES.has(code) ? { marker: true } : {}),
    };
  });
}

/**
 * Wie viele Statuswerte einer Fassung noch keinen Code tragen — die Zahl hinter
 * dem Hinweis „n Statuswerte ohne Code-Zuordnung". Zählt nur aktive Werte der
 * Wert-Felder, die der Aufrufer übergibt.
 */
export function zaehleOhneCode(werte: readonly StatusWertEintrag[]): number {
  return werte.filter(w => w.aktiv && w.code === undefined).length;
}
