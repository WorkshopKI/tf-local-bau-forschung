/**
 * Was das Suchfeld vorschlägt, während getippt wird.
 *
 * Drei Quellen in einer Liste, in dieser Reihenfolge:
 *
 *  1. **Feldnamen** — `or` → `ort:`. Die Feldsuche gibt es seit v4.49, sie stand
 *     aber nur im Startzustand erklärt: sobald jemand tippt, war die Hilfe weg.
 *     Ein Vorschlag an der Stelle, an der man ihn braucht, ersetzt eine
 *     Bedienungsanleitung, die man vorher gelesen haben muss.
 *  2. **Werte aus dem Bestand** — `ort:dre` → „Dresden". Bei Feldern mit
 *     abzählbarem Wertevorrat (siehe
 *     [wert-index.ts](src/plugins/antraege/services/wert-index.ts)). Die 43
 *     Deskriptoren und die 1 270 Netzwerknamen stehen sonst nirgends in der App.
 *  3. **Verlauf** — was bisher schon da war, jetzt hinter den beiden anderen.
 *
 * Zwei Regeln, die den Entwurf tragen:
 *
 * **Vorgeschlagen wird nur, was das Stück unter dem Schreibcursor hergibt.** Die
 * Anfrage kann mehrere Teile haben (`laser ort:dre`); ersetzt wird genau der
 * eine, an dem geschrieben wird — die übrigen bleiben Zeichen für Zeichen
 * stehen.
 *
 * **Mehrwortige Werte kommen in Anführungszeichen.** Ohne sie zerfiele der
 * eingesetzte Wert an Leerzeichen und suchte etwas anderes, als in der Liste
 * stand — `ort:Frankfurt am Main` liefert bei „irgendein Wort genügt" 6 365
 * Treffer, `ort:"Frankfurt am Main"` die 40, die danebenstanden. Der Parser
 * liest die Anführungszeichen seit v4.71
 * ([feldpraefix.ts](src/core/services/search/feldpraefix.ts)).
 *
 * Rein — kein React, kein Store, kein Korpus-Zugriff.
 */
import {
  ALLE_PRAEFIXE, FELD_PRAEFIX, anfrageTokens, feldAusPraefix,
} from '@/core/services/search/feldpraefix';
import { TREFFERFELD_LABEL, type Trefferfeld } from '@/core/services/search/trefferstelle';
import {
  anzahlPassend, istWertFeld, vorschlaegeFuer, type WertIndex,
} from '@/plugins/antraege/services/wert-index';
import { filterRecentSearches } from './suchseite-utils';

export type VorschlagArt = 'feld' | 'wert' | 'verlauf';

export interface Vorschlag {
  art: VorschlagArt;
  /** Was in der Zeile steht. */
  anzeige: string;
  /** Der Halbsatz dahinter — wofür das Feld steht, woher der Wert kommt. */
  erklaerung?: string;
  /** Die ganze Anfrage, wenn dieser Vorschlag übernommen wird. */
  anfrage: string;
  /** Wohin der Schreibcursor danach gehört. */
  cursor: number;
  /**
   * Bleibt die Liste nach der Übernahme offen? Nach einem Feldnamen ja — dort
   * ist der nächste Schritt der Wert, und ihn sofort zu zeigen ist der halbe
   * Sinn der Sache.
   */
  weiter: boolean;
  /** Stabiler Schlüssel für React und für die Trefferzahl-Karte. */
  key: string;
}

/**
 * Wie viele Werte höchstens vorgeschlagen werden.
 *
 * Die 8 stammten aus der Verlaufsliste und waren für einen KATALOG zu wenig:
 * `nw:` hat 1 243 Werte, `ort:` 2 055 — acht davon zu zeigen heißt, das
 * Durchblättern anzubieten und dann zu verweigern.
 *
 * 50, weil dort die eine Zahl beide Fälle bedient: die **42 Deskriptoren**
 * stehen damit vollständig da (dieser Katalog ist der Grund für die ganze
 * Liste — er steht nirgends sonst in der App), und bei den großen Feldern
 * füllen 50 die scrollbare Liste, während der Rest BENANNT wird
 * (`vorschlagsHinweis`) statt still abgeschnitten zu werden.
 *
 * Die Kosten trägt der Probelauf je Wert (gemessen 11 ms über 14 225 Anträge) —
 * er läuft verzögert, in Schüben und wird beim nächsten Tastendruck verworfen
 * ([SearchInput.tsx](src/plugins/suche/SearchInput.tsx)).
 */
export const MAX_WERTE = 50;
/** Wie viele Feldnamen höchstens vorgeschlagen werden. */
const MAX_FELDER = 5;
/** Wie viel Verlauf daneben noch Platz hat. */
const MAX_VERLAUF_DANEBEN = 3;

export interface VorschlagEingabe {
  text: string;
  /** Position des Schreibcursors im Text. */
  cursor: number;
  /** Der Wertevorrat des Bestands. `null` = noch nicht geladen. */
  index: WertIndex | null;
  verlauf: readonly string[];
}

/**
 * Das Stück der Eingabe, an dem gerade geschrieben wird.
 *
 * Steht der Cursor im Leerraum zwischen zwei Stücken, gehört er zu keinem —
 * dann gibt es nichts zu vervollständigen. Am Ende eines Stücks gehört er noch
 * dazu (`ort:dre|`), sonst verschwände die Liste genau beim Tippen.
 */
export function tokenAmCursor(
  text: string, cursor: number,
): { roh: string; start: number; ende: number } | null {
  for (const t of anfrageTokens(text)) {
    if (cursor >= t.start && cursor <= t.ende) return t;
  }
  return null;
}

/** Ersetzt ein Stück der Eingabe und sagt, wo der Cursor danach steht. */
function ersetze(
  text: string, start: number, ende: number, neu: string,
): { anfrage: string; cursor: number } {
  return {
    anfrage: `${text.slice(0, start)}${neu}${text.slice(ende)}`,
    cursor: start + neu.length,
  };
}

/**
 * Der Wert, wie er in der Anfrage stehen muss.
 *
 * Anführungszeichen NUR, wenn nötig — `ort:Dresden` liest sich besser als
 * `ort:"Dresden"` und tut dasselbe. Ein Anführungszeichen IM Wert fällt weg: es
 * beendete das Zitat mitten im Namen.
 */
export function alsAnfrageWert(wert: string): string {
  const sauber = wert.replace(/"/g, '').trim();
  return /\s/.test(sauber) ? `"${sauber}"` : sauber;
}

/** Trennt `feld:rest` auf, ohne die Anführungszeichen abzuziehen. */
function teileToken(roh: string): { praefix: string; feld: Trefferfeld; rest: string } | null {
  const i = roh.indexOf(':');
  if (i <= 0) return null;
  const praefix = roh.slice(0, i);
  const feld = feldAusPraefix(praefix);
  if (feld === undefined) return null;
  return { praefix, feld, rest: roh.slice(i + 1) };
}

/** Die Anführungszeichen um einen angefangenen Wert weg — tolerant, weil beim
 *  Tippen das Schlusszeichen fehlt. */
function rohWert(rest: string): string {
  const t = rest.trim();
  if (!t.startsWith('"')) return t;
  return (t.endsWith('"') && t.length > 1 ? t.slice(1, -1) : t.slice(1)).trim();
}

/**
 * Die Feldnamen, die zu einem angefangenen Wort passen.
 *
 * Gesucht wird über ALLE Schreibweisen (`netz` findet das Netzwerk), eingesetzt
 * wird immer die eine, die die App auch selbst schreibt — sonst stünden acht
 * Namen derselben Sache in der Liste
 * ([feldpraefix.ts](src/core/services/search/feldpraefix.ts)).
 */
function feldVorschlaege(text: string, token: { roh: string; start: number; ende: number }): Vorschlag[] {
  const q = token.roh.toLowerCase();
  if (q.length === 0 || q.includes(':') || q.startsWith('"')) return [];
  const getroffen = new Set<Trefferfeld>();
  for (const [alias, feld] of ALLE_PRAEFIXE) {
    if (alias.startsWith(q)) getroffen.add(feld);
  }
  // Zwei Ränge: erst die Felder, deren EIGENER Name so anfängt, dann die, die
  // nur über eine Nebenschreibweise passen. „or" meint `ort:`, auch wenn `ast:`
  // über seinen Alias `org` ebenfalls zutrifft — der Name, den die App selbst
  // schreibt, ist der, den man am ehesten tippt.
  const eigen: Vorschlag[] = [];
  const ueberAlias: Vorschlag[] = [];
  for (const [feld, praefix] of Object.entries(FELD_PRAEFIX) as [Trefferfeld, string][]) {
    if (!getroffen.has(feld)) continue;
    const { anfrage, cursor } = ersetze(text, token.start, token.ende, `${praefix}:`);
    const v: Vorschlag = {
      art: 'feld',
      anzeige: `${praefix}:`,
      erklaerung: `nur ${TREFFERFELD_LABEL[feld]}`,
      anfrage,
      cursor,
      weiter: true,
      key: `feld:${feld}`,
    };
    (praefix.startsWith(q) ? eigen : ueberAlias).push(v);
  }
  return [...eigen, ...ueberAlias].slice(0, MAX_FELDER);
}

/** Die Werte, die der Bestand zu einem angefangenen Feldwert führt. */
function wertVorschlaege(
  text: string,
  token: { roh: string; start: number; ende: number },
  index: WertIndex | null,
): Vorschlag[] {
  if (!index) return [];
  const geteilt = teileToken(token.roh);
  if (!geteilt || !istWertFeld(geteilt.feld)) return [];
  const teil = rohWert(geteilt.rest);
  return vorschlaegeFuer(index, geteilt.feld, teil, MAX_WERTE).map(e => {
    const neu = `${geteilt.praefix}:${alsAnfrageWert(e.wert)}`;
    const { anfrage, cursor } = ersetze(text, token.start, token.ende, neu);
    return {
      art: 'wert' as const,
      anzeige: e.wert,
      erklaerung: TREFFERFELD_LABEL[geteilt.feld],
      anfrage,
      cursor,
      weiter: false,
      key: `wert:${geteilt.feld}:${e.wert.toLowerCase()}`,
    };
  });
}

/**
 * Was unter der Liste steht, wenn es mehr gibt als gezeigt.
 *
 * Ein Deckel, der sich nicht zu erkennen gibt, liest sich als Vollständigkeit:
 * acht Netzwerke unter `nw:` sähen aus, als gäbe es acht. `null` heißt „alles
 * da" — dann steht auch nichts da.
 */
export function vorschlagsHinweis(opt: VorschlagEingabe): string | null {
  const { text, cursor, index } = opt;
  if (!index) return null;
  const token = tokenAmCursor(text, cursor);
  if (!token) return null;
  const geteilt = teileToken(token.roh);
  if (!geteilt || !istWertFeld(geteilt.feld)) return null;
  const gesamt = anzahlPassend(index, geteilt.feld, rohWert(geteilt.rest));
  if (gesamt <= MAX_WERTE) return null;
  return `${MAX_WERTE} von ${gesamt.toLocaleString('de-DE')} — tippe weiter, um einzugrenzen`;
}

/**
 * Die Vorschlagsliste zu einer Eingabe.
 *
 * Der Verlauf steht immer dabei, aber hinten und gekürzt, sobald Feld oder Wert
 * etwas beisteuern: die gezielte Hilfe zum gerade getippten Wort ist näher an
 * der Absicht als eine Suche von vorgestern.
 */
export function berechneVorschlaege(opt: VorschlagEingabe): Vorschlag[] {
  const { text, cursor, index, verlauf } = opt;
  const token = tokenAmCursor(text, cursor);
  const gezielt = token
    ? [...wertVorschlaege(text, token, index), ...feldVorschlaege(text, token)]
    : [];
  const verlaufMax = gezielt.length > 0 ? MAX_VERLAUF_DANEBEN : 8;
  const ausVerlauf: Vorschlag[] = filterRecentSearches(
    verlauf as string[], text, verlaufMax,
  ).map(q => ({
    art: 'verlauf' as const,
    anzeige: q,
    anfrage: q,
    cursor: q.length,
    weiter: false,
    key: `verlauf:${q.toLowerCase()}`,
  }));
  return [...gezielt, ...ausVerlauf];
}
