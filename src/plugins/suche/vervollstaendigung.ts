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
import { KERN_FELDER, nadelKern } from '@/core/services/search/namensKern';
import {
  istWertFeld, ohneZitatzeichen, vorschlaegeFuer, type WertIndex,
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
 * **Werte haben keinen Deckel mehr** (v4.88).
 *
 * Erst waren es 8, dann 50 — und jede Zahl war die Antwort auf „welche zeigen
 * wir", statt auf die Frage, die der Nutzer stellt: „welche gibt es". Gefragt
 * wurde ausdrücklich nach allen Netzwerken; und wenn die Liste alphabetisch ist
 * und scrollt, gibt es keinen Grund, sie vorher zu beschneiden. Damit entfällt
 * auch die Fußzeile „50 von 1.243" — sie erklärte einen Deckel, den es nicht
 * mehr gibt.
 *
 * Bezahlt wird das an anderer Stelle: die Trefferzahl je Wert kostet einen
 * echten Probelauf (gemessen 11–20 ms über 14 225 Anträge), und 1 270 davon
 * wären ~20 s Hintergrundarbeit. Gerechnet wird deshalb nur noch für Zeilen,
 * die tatsächlich im Sichtfenster stehen
 * ([useProbeZahlen.ts](src/plugins/suche/useProbeZahlen.ts)).
 */
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
 *
 * **Es fällt auf BEIDEN Seiten weg** (`ohneZitatzeichen`). Bis v4.111 legte nur
 * die Anfrage es ab, der Korpus behielt es — die Zeile `"EIKBOOM" Gesellschaft
 * mit beschränkter Haftung` bot damit eine Suche an, die 0 fand, während
 * `ast:EIKBOOM` 2 lieferte. Weil alphabetisch sortiert wird, standen genau diese
 * Werte ganz oben in der Liste.
 *
 * **Ein Namensfeld setzt seinen Kern ein** (v4.128.1), nicht die Schreibweise:
 * `nw:NaFaTech` statt `nw:"NaFa Tech"`. Der Grund ist genau das
 * Anführungszeichen — zitiert heißt wörtlich, und wörtlich hebt die
 * Fugenblindheit auf, die die Zeile überhaupt erst zusammengeführt hat. Am
 * Bestand gemessen war das ein echter Bruch: `nw:"NaFa Tech"` fand 9,
 * `nw:NaFa-Tech` 29 — dasselbe Netzwerk, zwei Zahlen, und der Unterschied kam
 * aus dieser Klammer statt aus den Daten. 189 der 1 025 Netzwerknamen tragen
 * ein Leerzeichen, wären also betroffen.
 *
 * Ist der Kern zu kurz für die Fugenblindheit (unter drei Zeichen, siehe
 * `nadelKern`), bleibt es beim wörtlichen Wert: sonst böte die Zeile eine
 * Anfrage an, die ihren eigenen Wert nicht mehr findet.
 */
export function alsAnfrageWert(wert: string, feld?: Trefferfeld): string {
  const sauber = ohneZitatzeichen(wert).trim();
  if (feld !== undefined && KERN_FELDER.has(feld)) {
    const kern = nadelKern(sauber, null);
    if (kern.length > 0) return kern;
  }
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
  return vorschlaegeFuer(index, geteilt.feld, teil).map(e => {
    const neu = `${geteilt.praefix}:${alsAnfrageWert(e.wert, geteilt.feld)}`;
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

/**
 * Steht die Vorschlagsliste?
 *
 * Eine Bedingung für Anzeige, Tastatur und `aria-expanded` — eine unsichtbare
 * Liste, in der die Pfeiltasten navigieren, ist keine.
 *
 * **Beim leeren Feld bleibt sie zu** (v4.106.2). Dort steht darunter der
 * Startzustand, und sein Reiter „Zuletzt" führt denselben Verlauf — ungekürzt
 * und ohne etwas zu verdecken. Das Dropdown legte sich stattdessen über dessen
 * Reiterleiste („Alle · Zuletzt · Suchsprache · Fragen · Stöbern") und nahm die
 * Suchhilfen weg, um eine Liste zu zeigen, die zwei Zeilen tiefer schon steht.
 * Durchsichtig zu machen löste das nicht: die Fläche fängt die Klicks weiterhin
 * ab, und Text auf Text fällt unter AA (DESIGN_GUIDE, „nie über `opacity`").
 */
export function vorschlagslisteSteht(offen: boolean, text: string, anzahl: number): boolean {
  return offen && text.trim() !== '' && anzahl > 0;
}
