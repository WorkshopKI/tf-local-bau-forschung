/**
 * Relative Zeitangaben — die drei Register der App an EINER Stelle.
 *
 * Es gab drei unabhängige Implementierungen (Feedback-Listen, Home-
 * „Weitermachen", Dokument-Review). Sie unterschieden sich nicht nur in der
 * Rechnung — jede brachte ihre eigene Behandlung ungültiger Zeitstempel mit,
 * und niemand wusste von den anderen. Hier stehen sie nebeneinander: die
 * Rechnung teilen sie sich, die WORTWAHL bleibt bewusst verschieden, weil sie
 * an verschiedene Orte gehört. Wer sie vereinheitlichen will, sieht jetzt in
 * einem Blick, was das kostet.
 *
 *   lang     „vor 3 Min." / „gestern" / „vor 2 Wochen" / „8.6.2026"
 *            → Feedback-Listen: älteste Einträge brauchen ein echtes Datum.
 *   kurz     „vor 3 Min" / „vor 1 Tag" / „vor 2 Monaten"
 *            → Home-„Weitermachen": nie ein Datum, immer ein Abstand.
 *   kompakt  „3 min" / „5 h" / „2 Tg"
 *            → Dokument-Review-Liste: eine schmale Spalte, ohne „vor".
 *
 * Alle drei nehmen `now` als Parameter (Tests injizieren es) und sind pur.
 */

/** Zerlegter Zeitabstand. `ungueltig` bei nicht parsbarem Zeitstempel. */
export interface Zeitabstand {
  ungueltig: boolean;
  minuten: number;
  stunden: number;
  tage: number;
  wochen: number;
  monate: number;
}

/**
 * Abstand zu `ts` in gestaffelten Einheiten. `runden: true` rundet kaufmännisch
 * (90 Min → 2 Std) statt abzuschneiden — das Dokument-Review rechnet so, die
 * beiden anderen Register schneiden ab. Der Unterschied ist sichtbar gehalten
 * statt in drei Kopien versteckt.
 */
export function zeitAbstand(ts: string, now: number, runden = false): Zeitabstand {
  const then = Date.parse(ts);
  if (Number.isNaN(then)) {
    return { ungueltig: true, minuten: 0, stunden: 0, tage: 0, wochen: 0, monate: 0 };
  }
  const teile = runden ? Math.round : Math.floor;
  const minuten = teile((now - then) / 60000);
  const stunden = teile(minuten / 60);
  const tage = teile(stunden / 24);
  return {
    ungueltig: false,
    minuten,
    stunden,
    tage,
    wochen: Math.floor(tage / 7),
    monate: Math.floor(tage / 30),
  };
}

/**
 * Feedback-Register: ab 30 Tagen das absolute Datum, weil alte Tickets sonst
 * als „vor 14 Wochen" unlesbar würden. Ungültiger Zeitstempel → leerer String
 * (zeigte vorher „Invalid Date" in der Nutzerliste).
 */
export function relativeZeitLang(iso: string, now: number = Date.now()): string {
  const a = zeitAbstand(iso, now);
  if (a.ungueltig) return '';
  if (a.minuten < 1) return 'gerade eben';
  if (a.minuten < 60) return `vor ${a.minuten} Min.`;
  if (a.stunden < 24) return `vor ${a.stunden} Std.`;
  if (a.tage === 1) return 'gestern';
  if (a.tage < 7) return `vor ${a.tage} Tagen`;
  if (a.tage < 30) return `vor ${a.wochen} Woche${a.tage < 14 ? '' : 'n'}`;
  return new Date(iso).toLocaleDateString('de-DE');
}

/**
 * Home-Register: bleibt bis in die Monate hinein relativ — der „Weitermachen"-
 * Hinweis beantwortet „wie lange her", nie „wann genau".
 */
export function relativeZeitKurz(ts: string, now: number = Date.now()): string {
  const a = zeitAbstand(ts, now);
  if (a.ungueltig) return '';
  if (a.minuten < 1) return 'gerade eben';
  if (a.minuten < 60) return `vor ${a.minuten} Min`;
  if (a.stunden < 24) return `vor ${a.stunden} Std`;
  if (a.tage === 1) return 'vor 1 Tag';
  if (a.tage < 30) return `vor ${a.tage} Tagen`;
  if (a.monate === 1) return 'vor 1 Monat';
  return `vor ${a.monate} Monaten`;
}

/**
 * Alter in TAGEN, ausgeschrieben — für Stellen, die bewusst die exakte Tagezahl
 * zeigen (Eingangsalter treibt dort die Ampel, „vor 12 Monaten" verlöre die
 * Genauigkeit). Ersetzt vier Kopien von `` `vor ${n} T` ``: das abgekürzte „T"
 * stand direkt neben ausgeschriebenen „≤ 30 Tage"/„> 90 Tage" (v2.372.1).
 *
 * Negative Werte (Datum in der Zukunft) → `null`, damit die Aufrufer nichts
 * anzeigen statt „vor -3 Tagen".
 */
export function alterInTagen(tage: number | null | undefined): string | null {
  if (typeof tage !== 'number' || !Number.isFinite(tage) || tage < 0) return null;
  return tage === 1 ? 'vor 1 Tag' : `vor ${tage} Tagen`;
}

/**
 * Listen-Register: gerundet und ohne „vor", weil die Spalte schmal ist.
 * Ungültiger Zeitstempel → der Rohwert (er ist dort die einzige Spur).
 */
export function relativeZeitKompakt(iso: string, now: number = Date.now()): string {
  const a = zeitAbstand(iso, now, true);
  if (a.ungueltig) return iso;
  if (a.minuten < 1) return 'gerade eben';
  if (a.minuten < 60) return `${a.minuten} min`;
  if (a.stunden < 24) return `${a.stunden} h`;
  return `${a.tage} Tg`;
}
