/**
 * Deterministischer Wächter über dem sprachlichen Feinschliff (Lektor-Skill).
 *
 * Der Lektor SOLL nur die Sprache ändern — ob er sich daran gehalten hat, prüft
 * NICHT das Modell, sondern dieser reine Vergleich zwischen Vor- und Nachfassung:
 *  - **Zahlen-Inventar** (Multiset): verschwundene/neue Zahlen, Beträge, Prozente,
 *    Jahreszahlen sind der verlässlichste Indikator für eine inhaltliche Änderung.
 *  - **Längen-Delta**: der Umfang war bereits abgenommen; weicht er spürbar ab,
 *    hat der Lauf gekürzt oder ausgebaut.
 *
 * Drei Stufen: `istVerdaechtigGekuerzt` und `gebrocheneRegeln` sind HARTE Tore
 * (der Lauf wird verworfen, der Abschnitt bleibt unverändert), `pruefeLektorat`
 * ist rein BERATEND (Hinweiszeile an der Karte, blockiert nie).
 *
 * Reine Funktionen — node-testbar, kein React/IO.
 */
import type { CheckResult } from '@/core/services/skills';

/** Ab dieser relativen Längenänderung (in %) wird ein beratender Hinweis gezeigt. */
export const LEKTORAT_LAENGEN_SCHWELLE = 10;

/**
 * Unterhalb dieses Anteils der Ausgangslänge gilt das Ergebnis als abgeschnitten
 * (Output-Budget erschöpft) und wird gar nicht erst übernommen.
 */
export const LEKTORAT_KAPP_VERDACHT = 0.6;

/** Befund des Vergleichs Vorfassung ↔ redigierte Fassung. */
export interface LektoratBefund {
  /** Zahlen, die in der Vorfassung standen und jetzt fehlen (Reihenfolge wie im Text). */
  zahlenVerloren: string[];
  /** Zahlen, die neu hinzugekommen sind. */
  zahlenNeu: string[];
  laengeVorher: number;
  laengeNachher: number;
  /** Relative Längenänderung in Prozent, gerundet (negativ = kürzer geworden). */
  laengenDeltaProzent: number;
  /** True, wenn es etwas zu melden gibt (Zahlen-Abweichung ODER Längen-Drift über der Schwelle). */
  auffaellig: boolean;
}

/**
 * Zahlen-Token eines Textes in Lesereihenfolge, normalisiert für den Vergleich.
 * Erfasst deutsche Schreibweisen inkl. Tausenderpunkt/Dezimalkomma und der
 * gängigen Einheiten-Suffixe (`%`, `€`, `Mio.`, `Mrd.`, `T€`, `Mio. €` …). Das
 * Suffix gehört zum Token, damit „12 %" und „12 Mio." nicht als gleich gelten.
 * Reine Ziffernfolgen ohne Suffix (Jahreszahlen, Stückzahlen) zählen ebenfalls.
 */
export function zahlenInventar(text: string): string[] {
  const re = /\d+(?:[.,]\d+)*(?:\s*(?:%|€|EUR|TEUR|T€|Mio\.?|Mrd\.?|Tsd\.?|km|kg|mm|cm|m²|h|kW|kWh)(?:\s*€)?)?/giu;
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    out.push(m[0].replace(/\s+/gu, ' ').trim().toLowerCase());
  }
  return out;
}

/** Multiset-Differenz `a \ b` (Reihenfolge von `a`, Vielfachheiten berücksichtigt). */
function multisetDiff(a: string[], b: string[]): string[] {
  const rest = new Map<string, number>();
  for (const t of b) rest.set(t, (rest.get(t) ?? 0) + 1);
  const out: string[] = [];
  for (const t of a) {
    const n = rest.get(t) ?? 0;
    if (n > 0) rest.set(t, n - 1);
    else out.push(t);
  }
  return out;
}

/**
 * Vergleicht die Vorfassung mit der redigierten Fassung. Beratend — der Aufrufer
 * zeigt bei `auffaellig` einen Hinweis, ändert aber nie den Text.
 */
export function pruefeLektorat(vorher: string, nachher: string): LektoratBefund {
  const vorherZahlen = zahlenInventar(vorher);
  const nachherZahlen = zahlenInventar(nachher);
  const laengeVorher = vorher.length;
  const laengeNachher = nachher.length;
  const laengenDeltaProzent = laengeVorher === 0
    ? 0
    : Math.round(((laengeNachher - laengeVorher) / laengeVorher) * 100);
  const zahlenVerloren = multisetDiff(vorherZahlen, nachherZahlen);
  const zahlenNeu = multisetDiff(nachherZahlen, vorherZahlen);
  return {
    zahlenVerloren,
    zahlenNeu,
    laengeVorher,
    laengeNachher,
    laengenDeltaProzent,
    auffaellig: zahlenVerloren.length > 0
      || zahlenNeu.length > 0
      || Math.abs(laengenDeltaProzent) > LEKTORAT_LAENGEN_SCHWELLE,
  };
}

/**
 * Hartes Tor gegen abgeschnittene Antworten (Output-Budget erschöpft): das
 * Ergebnis ist deutlich kürzer als der Ausgangstext. Ein leeres Ergebnis fängt
 * der Aufrufer separat ab; bei leerem Ausgangstext gibt es nichts zu redigieren.
 */
export function istVerdaechtigGekuerzt(vorher: string, nachher: string): boolean {
  if (vorher.length === 0) return false;
  return nachher.length < vorher.length * LEKTORAT_KAPP_VERDACHT;
}

/**
 * Hartes Tor gegen einen Feinschliff, der eine **zuvor erfüllte `fehler`-Regel
 * bricht**.
 *
 * Gemessen am 22.08.2026 an Abschnitt G: der Rohentwurf trug den Pflicht-Anfang
 * wörtlich (`ok`), der Lektor formulierte genau diesen Wortlaut stilistisch um
 * („wird sehr positive Auswirkungen … haben" → „wird … erheblich stärken") und
 * die Prüfung meldete danach `fehler: Pflicht-Anfang fehlt`. Das Modell hatte
 * geliefert, die Kette hat es kaputt gemacht — und der beschädigte Stand war der
 * angezeigte.
 *
 * Bewusst NICHT im Lektor-Prompt gelöst: der Lektor kennt die Regeln des
 * Abschnitts nicht, und jede künftige `fehler`-Regel müsste dort erneut
 * nachgetragen werden. Dieses Tor deckt sie alle ab, ohne dass eine neue Regel
 * etwas davon wissen muss.
 *
 * Gezählt wird nur die **Verschlechterung**: eine Regel, die schon vorher
 * `fehler` war, bleibt es und rechtfertigt kein Verwerfen (der Feinschliff hat
 * sie nicht kaputt gemacht). Eine Regel, die es vorher gar nicht gab, kann nicht
 * erfüllt gewesen sein — auch sie zählt nicht. `hinweis` blockiert nie.
 */
export function gebrocheneRegeln(vorher: CheckResult[], nachher: CheckResult[]): CheckResult[] {
  const vorherLevel = new Map(vorher.map(c => [c.id, c.level]));
  return nachher.filter(c => {
    if (c.level !== 'fehler') return false;
    const alt = vorherLevel.get(c.id);
    return alt !== undefined && alt !== 'fehler';
  });
}

/**
 * Kurze, menschenlesbare Zusammenfassung eines auffälligen Befundes (eine Zeile
 * für die Karte). Gibt `''` zurück, wenn nichts zu melden ist — die UI rendert
 * dann keinen Hinweis. Zahlen werden gekappt aufgezählt, damit die Zeile kurz bleibt.
 */
export function befundText(b: LektoratBefund, maxZahlen = 3): string {
  if (!b.auffaellig) return '';
  const teile: string[] = [];
  if (b.zahlenVerloren.length > 0) {
    teile.push(`${b.zahlenVerloren.length} ${b.zahlenVerloren.length === 1 ? 'Zahl fehlt' : 'Zahlen fehlen'} (${listeKurz(b.zahlenVerloren, maxZahlen)})`);
  }
  if (b.zahlenNeu.length > 0) {
    teile.push(`${b.zahlenNeu.length} ${b.zahlenNeu.length === 1 ? 'Zahl ist neu' : 'Zahlen sind neu'} (${listeKurz(b.zahlenNeu, maxZahlen)})`);
  }
  if (Math.abs(b.laengenDeltaProzent) > LEKTORAT_LAENGEN_SCHWELLE) {
    const vz = b.laengenDeltaProzent > 0 ? '+' : '−';
    teile.push(`Länge ${vz}${Math.abs(b.laengenDeltaProzent)} %`);
  }
  return teile.join(' · ');
}

function listeKurz(werte: string[], max: number): string {
  const sichtbar = werte.slice(0, max).join(', ');
  return werte.length > max ? `${sichtbar}, …` : sichtbar;
}
