/**
 * Die Träger-Achse: derselbe Zuwendungsempfänger auf beiden Seiten.
 *
 * **Warum sie die belastbarste der drei Stufen ist.** Wortlaut und Ähnlichkeit
 * schätzen, ob zwei Vorhaben inhaltlich nah sind. Diese Stufe stellt eine
 * Tatsache fest: dieselbe Einrichtung ist hier gemeldet und dort im Bestand.
 * Für die Meldungen aus dem Netzwerk-/Zentrums-Bereich ist sie sogar die
 * **einzige** brauchbare Achse — dort steht als Zuwendungsempfänger die
 * Netzwerkmanagement-Einrichtung, und ihre Aufgabenbeschreibungen ähneln
 * einander so stark, dass die Einbettung sie nicht auseinanderhalten kann (an
 * der 72er-Liste gemessen fielen alle 22 Zentrums-Meldungen auf **dieselben
 * vier** Vorhaben als besten Treffer, `16EP250004` allein achtmal).
 *
 * **Sie urteilt nicht allein.** Ein Institut mit 88 Vorhaben im
 * Betrachtungsbereich träfe sonst immer zu. Die Achse begründet den Blick, die
 * Nähe entscheidet: {@link TRAEGER_NAEHE_SCHWELLE}.
 *
 * **Namensgleichheit, nicht Seltenheit** — an der 72er-Liste gemessen
 * (Betrachtungsbereich 4.327 Vorhaben, 23.08.2026):
 *
 *   ein Token gemeinsam           41 Zeilen · 9.662 Treffer · max 598 je Zeile
 *   seltenstes Token df<=5        21 Zeilen ·    51 Treffer · 17 richtig, 4 falsch
 *   NAMENSGLEICHHEIT              28 Zeilen ·   264 Treffer · Median 1, keine Fehltreffer
 *   + gehärtete Enthaltung        30 Zeilen ·   273 Treffer
 *
 * Die Seltenheits-Regel scheitert an beiden Enden: sie hält „August Friedberg
 * GmbH" für „Georg-August-Universität Göttingen" (gemeinsames Token `august`,
 * df=3) und verliert gleichzeitig die grossen Häuser, weil deren Namen nur aus
 * häufigen Wörtern bestehen — „Technische Universität Chemnitz" hat kein Token
 * unter df=94 und fiel komplett durch, obwohl das Haus 88 Vorhaben im Bereich
 * führt. Gleichheit des ganzen normalisierten Namens hat dieses Problem nicht.
 *
 * Die **Enthaltung** kommt dazu, weil Zuarbeit und Bestand denselben Träger
 * verschieden ausschreiben („ZENIT GmbH" ≙ „ZENIT Zentrum für Innovation und
 * Technik"). Sie ist gehärtet: ohne Härtung fängt sie jeden Namen, der zufällig
 * in einem längeren steckt („H&F-Engineering GmbH" ⊆ „Hasso-Plattner-Institut
 * für Digital Engineering", „ZM-I München GmbH" ⊆ „Universität der Bundeswehr
 * München"). Deshalb muss das seltenste gemeinsame Token unter
 * {@link ENTHALTUNG_MAX_DF} liegen.
 */
import type { AntragListItem } from '@/core/services/csv/types';

/** Wie ein Aktenzeichen zum Träger der Meldung steht. */
export type TraegerBezug = 'gleich' | 'enthalten';

/**
 * Rechtsformen und Füllwörter, die keinen Träger unterscheiden.
 *
 * Sie fliegen VOR dem Vergleich raus, damit „fzmb GmbH" und „fzmb" derselbe
 * Träger sind. Ortsnamen bleiben drin — sie unterscheiden sehr wohl
 * („Hochschule Osnabrück" ≠ „Hochschule Stralsund").
 */
const OHNE_BEDEUTUNG: ReadonlySet<string> = new Set([
  'gmbh', 'mbh', 'ggmbh', 'kgaa', 'ohg', 'gbr', 'kg', 'ag', 'se', 'co',
  'eingetragener', 'verein', 'ev', 'stiftung', 'gemeinnutzige', 'gemeinnützige',
  'und', 'der', 'die', 'das', 'des', 'den', 'für', 'fur', 'zur', 'zum', 'von', 'mit', 'im',
]);

/** Kürzeste Zeichenkette, die als Namensbestandteil zählt. */
const MIN_TOKEN_LEN = 3;

/**
 * So oft darf das seltenste gemeinsame Token höchstens vorkommen, damit eine
 * Enthaltung als Träger-Bezug gilt.
 *
 * Zwanzig, an der Liste abgelesen: `zenit` trägt 7 und ist der Träger, während
 * `engineering`, `münchen` und `dresden` mit 78/75/85 die Fehltreffer stellen.
 */
export const ENTHALTUNG_MAX_DF = 20;

/**
 * Ab welcher Ähnlichkeit ein Träger-Bezug eine Übereinstimmung auslöst.
 *
 * Der Träger allein reicht nicht — ein Haus mit 88 Vorhaben im Bereich träfe
 * sonst bei jeder Meldung zu. Gemessen an den Träger-Mengen der 72er-Liste
 * (höchste Ähnlichkeit INNERHALB der Menge desselben Trägers): über 0,45 liegen
 * genau zwei Zeilen, und beide sind echte Funde —
 * `49MF260044 fzmb → 16KN073848 VetDx/ZytoVet` (0,514) und
 * `49VF260016 STFI → 16KN096936 InnoTecOP OP-Kühlkleidung` (0,493). Die dritte
 * Zeile folgt erst bei 0,42.
 *
 * Die Hürde liegt bewusst unter der `AEHNLICHKEIT_SCHWELLE` der freien Suche:
 * dort muss die Nähe den Blick allein rechtfertigen, hier hat der gemeinsame
 * Träger das schon getan.
 */
export const TRAEGER_NAEHE_SCHWELLE = 0.45;

/** Ein Trägername als Menge bedeutungstragender Bestandteile. */
export function traegerTokens(name: string): Set<string> {
  return new Set(
    (name ?? '').normalize('NFC').toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/[^a-zäöü0-9]+/g, ' ')
      .split(' ')
      .filter(t => t.length >= MIN_TOKEN_LEN && !OHNE_BEDEUTUNG.has(t)),
  );
}

/** Der vorbereitete Bestand: je Aktenzeichen die Tokens, dazu ihre Häufigkeit. */
export interface TraegerIndex {
  proAktenzeichen: ReadonlyMap<string, ReadonlySet<string>>;
  /** Wie viele Anträge des Bereichs dieses Token im Trägernamen führen. */
  haeufigkeit: ReadonlyMap<string, number>;
}

/**
 * Den Index über die Anträge des Betrachtungsbereichs bauen — einmal je Lauf.
 *
 * `imBereich` wird hereingereicht statt hier gefiltert: der Bereich ist ein
 * Parameter, kein stiller Filter (Pitfall #46).
 */
export function baueTraegerIndex(
  items: readonly AntragListItem[],
  imBereich: ReadonlySet<string>,
): TraegerIndex {
  const proAktenzeichen = new Map<string, ReadonlySet<string>>();
  const haeufigkeit = new Map<string, number>();
  for (const item of items) {
    if (!imBereich.has(item.aktenzeichen)) continue;
    const tokens = traegerTokens(item.antragsteller ?? '');
    proAktenzeichen.set(item.aktenzeichen, tokens);
    for (const t of tokens) haeufigkeit.set(t, (haeufigkeit.get(t) ?? 0) + 1);
  }
  return { proAktenzeichen, haeufigkeit };
}

/** Steckt `a` vollständig in `b`? Leere Mengen zählen nicht als enthalten. */
function stecktIn(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size === 0) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

/**
 * Welche Anträge des Bereichs denselben Träger führen wie diese Meldung.
 *
 * Leerer Trägername → leere Menge, nicht „alle": eine fehlende Angabe ist kein
 * Beleg.
 */
export function traegerAbgleich(
  zuwendungsempfaenger: string,
  index: TraegerIndex,
): Map<string, TraegerBezug> {
  const out = new Map<string, TraegerBezug>();
  const gemeldet = traegerTokens(zuwendungsempfaenger);
  if (gemeldet.size === 0) return out;

  for (const [akz, bestand] of index.proAktenzeichen) {
    if (gemeldet.size === bestand.size && stecktIn(gemeldet, bestand)) {
      out.set(akz, 'gleich');
      continue;
    }
    if (!stecktIn(gemeldet, bestand) && !stecktIn(bestand, gemeldet)) continue;
    // Gehärtete Enthaltung: das seltenste gemeinsame Token muss den Träger
    // wirklich benennen, nicht bloss seine Stadt oder seine Branche.
    let seltenstes = Number.POSITIVE_INFINITY;
    for (const t of gemeldet) {
      if (!bestand.has(t)) continue;
      seltenstes = Math.min(seltenstes, index.haeufigkeit.get(t) ?? 0);
    }
    if (seltenstes <= ENTHALTUNG_MAX_DF) out.set(akz, 'enthalten');
  }
  return out;
}
