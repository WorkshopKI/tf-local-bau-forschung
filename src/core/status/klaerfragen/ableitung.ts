/**
 * Je Herkunft eine reine Funktion, die aus dem gemessenen Bestand Klärfragen
 * ableitet. Keine IO, keine Uhr.
 *
 * **Gefragt wird nur, wo eine Antwort etwas ändert.** Ein Kürzel, dessen
 * Bedeutung zwischen NW und FuE auseinandergeht, ist unschön — aber solange
 * beide Formen einen eigenen Katalogeintrag haben, zeigt die App jedem Vorgang
 * die richtige Bedeutung. Falsch wird die Anzeige erst, wo **geliehen** werden
 * muss, und das ist im Bestand die Projektform **DS**: für sie führt der
 * Katalog keinen einzigen Eintrag. Die Bedeutungs-Herkünfte sind deshalb auf
 * Kürzel beschränkt, die in DS-Vorgängen wirklich vorkommen. *Irrläufer* leihen
 * ebenfalls, sind aber begrifflich keine Projektform und keine Vorgänge von uns
 * — sie mitzuzählen blähte die Zahl mit Fällen, die niemand beantworten muss.
 */
import { statusKurzLabelMit } from '@/core/utils/status-wert-labels';
import { normalisiereWert } from '../typen';
import { normKey } from '../normalisierung';
import { offeneBedeutungen, uneinigeKuerzel, type UneinigesKuerzel } from '../kuerzel-katalog';
import { STATUS_CODE_KATALOG, KURZLABEL_MAX, findeStatusCode } from '../status-codes';
import { normalisiereSchreibfehler } from '../schreibfehler';
import { bezeichnungsAbweichungen } from './fachlich-bestaetigt';
import type { Klaerfrage, KlaerfragenBestand, KlaerfragenEingabe } from './typen';

/** Wie viele Kurzlabel-Zeilen die Liste führt. Der Kurator arbeitet von oben ab. */
export const KURZLABEL_SPITZE = 20;

/** Wie viele Schreibweisen-Vorschläge ein Wert ohne Code bekommt. */
const VORSCHLAEGE = 3;

function zahl(n: number): string {
  return n.toLocaleString('de-DE');
}

/**
 * Vorgänge zu einem Wortlaut — **normalisiert nachgeschlagen**, nicht per
 * `rohStatus.get(text)`.
 *
 * `rohStatus` ist nach dem Rohwert des Exports geschlüsselt, wortgetreu. Ein
 * exakter Nachschlag verlangt damit Übereinstimmung in Groß-/Kleinschreibung,
 * Weißraum und Unicode-Normalform — und genau die drei sind an Fremddaten nicht
 * zugesichert (Pitfall #22). Trifft er daneben, steht dort nicht „unbekannt",
 * sondern eine gemessene **0**: der Befund verschwindet lautlos, statt sich zu
 * melden. Schreibvarianten desselben Wortlauts werden addiert; sie sind
 * derselbe Wert.
 */
export function vorkommenFuerWortlaut(
  rohStatus: ReadonlyMap<string, number>, wortlaut: string,
): number {
  const k = normKey(wortlaut);
  let summe = 0;
  for (const [roh, n] of rohStatus) if (normKey(roh) === k) summe += n;
  return summe;
}

/**
 * Anführungszeichen, wie sie im ganzen Projekt stehen.
 *
 * Das schließende Zeichen ist ausdrücklich das typografische `“`, nicht das
 * gerade `"`: die Auswahllisten des Exports müssen gerade Anführungszeichen
 * ersetzen (Excels Inline-Liste kennt dafür kein Escape), und ein gerades
 * Schlusszeichen käme dort als `„VN geprüft'` heraus — auf halbem Weg ersetzt.
 */
function zitat(s: string): string {
  return `„${s}“`;
}

/**
 * Editierabstand, gedeckelt — nur zum **Vorschlagen** von Antworten, nie zum
 * Einstufen. Ob ein Wert ein Tippfehler ist, entscheidet der Mensch in der
 * Antwortspalte; die Ähnlichkeit sortiert lediglich die Auswahlliste, damit aus
 * „VN gegrüft" ein Klick statt einer Recherche wird.
 */
function abstand(a: string, b: string): number {
  let vorige = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const zeile = [i];
    for (let j = 1; j <= b.length; j++) {
      zeile[j] = Math.min(
        (vorige[j] ?? 0) + 1,
        (zeile[j - 1] ?? 0) + 1,
        (vorige[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    vorige = zeile;
  }
  return vorige[b.length] ?? 0;
}

/** Die amtlichen Texte, die einem Rohwert am nächsten stehen. */
function naechsteSchreibweisen(roh: string): string[] {
  const k = normalisiereWert(roh);
  return STATUS_CODE_KATALOG
    .map(e => ({ text: e.text, d: abstand(k, normalisiereWert(e.text)) }))
    .sort((x, y) => x.d - y.d || x.text.localeCompare(y.text, 'de'))
    .slice(0, VORSCHLAEGE)
    .map(x => x.text);
}

// --- Bedeutung ------------------------------------------------------------

/**
 * `offen` ist ein Parameter mit Vorgabe — dieselbe Mechanik wie bei
 * `bezeichnungsAbweichungen`. Am heutigen Katalog geht die Menge **leer** aus
 * (jedes uneinige Kürzel führt eine FuE-Form, aus der die Sammelregel schöpft),
 * und eine Ableitung, die immer nichts liefert, ist ohne Gegenprobe nicht von
 * einer kaputten zu unterscheiden.
 */
export function bedeutungsFragen(
  b: KlaerfragenBestand, offen: readonly UneinigesKuerzel[] = offeneBedeutungen(),
  ruhend: ReadonlySet<string> = new Set(),
): Klaerfrage[] {
  const out: Klaerfrage[] = [];
  for (const u of offen) {
    if (ruhend.has(u.kuerzel.normalize('NFC'))) continue;
    // NFC wie eine Zeile darüber: `proKuerzelDs` ist über `kuerzelEinesVorgangs`
    // normalisiert geschlüsselt, und `ÄA`/`ASÜ` gäbe es sonst zweimal.
    const dsVorkommen = b.proKuerzelDs.get(u.kuerzel.normalize('NFC')) ?? 0;
    if (dsVorkommen === 0) continue;

    const nw = u.bedeutungen.find(x => x.form === 'NW');
    const fue = u.bedeutungen.find(x => x.form === 'FuE');
    const nwFue = nw !== undefined && fue !== undefined && nw.bezeichnung !== fue.bezeichnung;
    const gelesen = u.bedeutungen.map(x => `${x.form}: ${zitat(x.bezeichnung)}`).join(' · ');
    const wortlaute = [...new Set(u.bedeutungen.map(x => x.bezeichnung))];

    out.push(nwFue
      ? {
        id: `bedeutung-nw-fue:${u.kuerzel}`,
        herkunft: 'bedeutung-nw-fue',
        betrifft: u.kuerzel,
        frage: `Welche Bedeutung hat das Kürzel ${zitat(u.kuerzel)}?`,
        kontext: `${gelesen}. Schon NW und FuE widersprechen sich — ein Katalogproblem, `
          + `das die Projektform DS nur sichtbar macht. ${zahl(dsVorkommen)} DS-Vorgänge tragen `
          + `dieses Kürzel und bekommen eine der Bedeutungen geliehen.`
          + (u.strittig ? ' Der Katalog führt den Marker „strittig".' : ''),
        optionen: [...wortlaute, 'beide gelten — je Projektform verschieden'],
        vorkommen: dsVorkommen,
      }
      : {
        id: `bedeutung-ds-anleihe:${u.kuerzel}`,
        herkunft: 'bedeutung-ds-anleihe',
        betrifft: u.kuerzel,
        frage: `Welche Bedeutung von ${zitat(u.kuerzel)} gilt für Durchführbarkeitsstudien?`,
        kontext: `${gelesen}. Für DS führt der Katalog keinen Eintrag; angezeigt wird die `
          + `Bezeichnung der erstgeführten Form. ${zahl(dsVorkommen)} DS-Vorgänge betroffen.`
          + (u.strittig ? ' Der Katalog führt den Marker „strittig".' : ''),
        optionen: wortlaute,
        vorkommen: dsVorkommen,
      });
  }
  return out;
}

// --- Marker ---------------------------------------------------------------
//
// Die Frage `strittig-marker` ist **entschieden und deshalb entfallen**. Sie
// lautete: „Soll der Marker `strittig` auch Bedeutungsunterschiede zwischen
// Projektformen kennzeichnen?" Die Antwortspalte blieb leer; entschieden wurde
// sie als Vorgabe, und zwar auf die Option „nein — Bedeutungsunterschiede
// brauchen ein eigenes Kennzeichen".
//
// Seitdem gibt es `bedeutungsdivergenz` neben `strittig`: zwei Marker, zwei
// Aussagen. Dasselbe Feld für beides machte die Auswertung unbrauchbar — der
// eine misst ein Patt bei SCHREIBVARIANTEN desselben Textes (vom Generator
// gesetzt), der andere einen inhaltlichen Widerspruch. `YW` trägt beide.
//
// Die Id `strittig-marker` bleibt vergeben (`STILLGELEGTE_HERKUENFTE` in
// `typen.ts` führt sie mit) — sie steht in einer Datei, die zurückkam.

// --- DS ohne Quelle -------------------------------------------------------

export function dsFrage(b: KlaerfragenBestand): Klaerfrage[] {
  if (b.dsVorgaenge === 0) return [];
  const kuerzel = [...b.proKuerzelDs.keys()];
  const vorkommen = [...b.proKuerzelDs.values()].reduce((n, v) => n + v, 0);
  const uneinig = uneinigeKuerzel()
    .filter(u => (b.proKuerzelDs.get(u.kuerzel.normalize('NFC')) ?? 0) > 0).length;

  return [{
    id: 'ds-ohne-quelle',
    herkunft: 'ds-ohne-quelle',
    betrifft: 'Projektform DS (Durchführbarkeitsstudien)',
    frage: 'Wer kann eine Kürzel-Quelle für Durchführbarkeitsstudien liefern?',
    kontext: `${zahl(b.dsVerbuende)} Verbünde, ${zahl(b.dsVorgaenge)} Vorgänge, `
      + `${zahl(kuerzel.length)} verschiedene Kürzel, ${zahl(vorkommen)} Vorkommen. Der `
      + `Kürzelkatalog führt für DS KEINEN einzigen Eintrag — die Zuarbeit ist älter als die `
      + `Richtlinie 2020, mit der DS hinzukam. Die App zeigt deshalb eine aus einer anderen `
      + `Projektform geliehene Bezeichnung; bei ${zahl(uneinig)} Kürzeln widersprechen die `
      + `Formen einander. Gefragt ist nicht, welche Bedeutung gilt, sondern wer eine Quelle `
      + `liefern kann: es existiert keine.`,
    vorkommen: b.dsVorgaenge,
  }];
}

// --- Statuswerte ----------------------------------------------------------

/** Ein Rohwert mit allem, was seine Schreibvarianten zusammen wiegen. */
interface Bündel {
  /** Die häufigste Schreibweise — sie steht in der Spalte „Betrifft". */
  roh: string;
  /** Der Nachschlage-Schlüssel; er bildet zugleich die Id der Frage. */
  k: string;
  /** Vorgänge über alle Schreibweisen. */
  n: number;
  verbuende: number;
}

/**
 * Rohwerte nach ihrem **Nachschlage-Schlüssel** bündeln.
 *
 * Die Id einer Klärfrage ist normalisiert (`wert-ohne-code:vn geprüft`), die
 * Schleife darüber lief bis v4.120 über die rohen Schlüssel von `rohStatus`.
 * Zwei Schreibweisen desselben Wertes — „VN geprüft" und „VN Geprüft", oder ein
 * belegter Schreibfehler neben seinem gemeinten Wortlaut — erzeugten damit
 * **zwei Zeilen mit derselben ID**. Genau diese ID ist der Schlüssel, über den
 * die Antworten aus der herumgereichten Datei zurückgeordnet werden; doppelt
 * vergeben trägt sie zwei verschiedene Antworten zu einem Fall.
 *
 * Gebündelt wird auch das Gewicht: sonst wöge derselbe Wert in zwei
 * Schreibweisen zweimal halb statt einmal ganz.
 */
function buendleRohwerte(b: KlaerfragenBestand): Bündel[] {
  const nach = new Map<string, Bündel>();
  for (const [roh, n] of b.rohStatus) {
    const k = normalisiereWert(normalisiereSchreibfehler(roh));
    if (k === '') continue;
    const verbuende = b.rohStatusVerbuende.get(roh) ?? 0;
    const bisher = nach.get(k);
    if (bisher === undefined) {
      nach.set(k, { roh, k, n, verbuende });
      continue;
    }
    // Die häufigste Schreibweise vertritt den Wert; bei Gleichstand die
    // alphabetisch erste, damit die Ausgabe nicht von der Map-Ordnung abhängt.
    if (n > bisher.n || (n === bisher.n && roh.localeCompare(bisher.roh, 'de') < 0)) {
      bisher.roh = roh;
    }
    bisher.n += n;
    bisher.verbuende += verbuende;
  }
  return [...nach.values()];
}

/**
 * Die drei Wert-Herkünfte in **einem** Durchlauf, damit sie disjunkt bleiben:
 * je Rohwert gewinnt der erste Treffer. Getrennte Funktionen müssten dieselbe
 * Reihenfolge jede für sich kennen — und würden beim ersten Nachtrag auseinanderlaufen.
 */
export function wertFragen(
  e: KlaerfragenEingabe,
  /**
   * Wie viele Kurzlabel-Zeilen die Liste führt. Parameter, damit sich der
   * **Rückstand** ausrechnen lässt (`klaerfragenAuslassungen`): eine stille
   * Kappung auf 20 las sich in einer Datei, die wochenlang unterwegs ist, wie
   * ein Katalog, dem nur noch 20 Kurzformen fehlen.
   */
  spitze: number = KURZLABEL_SPITZE,
): Klaerfrage[] {
  const { bestand: b, fassungsWerte } = e;
  const out: Klaerfrage[] = [];
  const ohneKurz: { roh: string; k: string; n: number }[] = [];

  // Ein belegter Schreibfehler des Quellsystems ist beantwortet: die App löst
  // ihn auf und zeigt den Rohwert daneben. Gefragt wird nach dem GEMEINTEN
  // Wortlaut — sonst meldete sich derselbe Wert als „kennt die Fassung nicht",
  // obwohl sie ihn kennt. Genau deshalb bündelt `buendleRohwerte` vorher.
  for (const { roh, k, n, verbuende } of buendleRohwerte(b)) {
    const wo = verbuende > 0
      ? `${zahl(n)} Vorgänge, davon ${zahl(verbuende)} Verbünde mit diesem Verbundstatus`
      : `${zahl(n)} Vorgänge`;

    // 1. Kennt die Fassung den Wert überhaupt?
    if (fassungsWerte !== null && !fassungsWerte.has(k)) {
      // Auch hier die nächstliegenden Wortlaute: ein unbekannter Wert ist oft
      // ein verschriebener bekannter (`VN gegrüft`). Ohne den Vorschlag stünde
      // die Frage „ist er gültig?" da, und wer sie beantwortet, müsste den
      // Katalog erst selbst durchsuchen.
      const nah = naechsteSchreibweisen(roh);
      const eigenerCode = findeStatusCode(roh) !== null;
      out.push({
        id: `wert-nicht-in-fassung:${k}`,
        herkunft: 'wert-nicht-in-fassung',
        betrifft: roh,
        frage: `Der Statuswert ${zitat(roh)} kommt im Bestand vor, die Katalog-Fassung führt ihn nicht. Ist er gültig?`,
        kontext: `${wo}. Ohne Eintrag in der Fassung bleibt der Wert unkuratiert: keine Kategorie, `
          + `keine Phase, keine Kurzform — er fällt aus Gruppierungen und Filtern heraus. `
          + (eigenerCode
            ? 'Der amtliche Katalog kennt den Wortlaut — es fehlt nur der Eintrag in der Fassung.'
            : `Der amtliche Katalog kennt den Wortlaut NICHT; nächstliegende bekannte Wortlaute: `
              + `${nah.map(zitat).join(', ')}.`),
        optionen: eigenerCode
          ? ['gültig — in die Fassung übernehmen', 'stillgelegt lassen', 'unklar']
          : [...nah.map(t => `Schreibfehler — gemeint ist ${zitat(t)}`), 'eigenständiger Wert — in die Fassung übernehmen', 'unklar'],
        vorkommen: n,
      });
      continue;
    }

    // 2. Lässt er sich einem amtlichen Code zuordnen?
    if (findeStatusCode(roh) === null) {
      out.push({
        id: `wert-ohne-code:${k}`,
        herkunft: 'wert-ohne-code',
        betrifft: roh,
        frage: `Welcher amtliche Statuscode ist mit ${zitat(roh)} gemeint?`,
        kontext: `${wo}. Die Fassung führt den Wert, aber keine bekannte Schreibweise passt auf `
          + `einen amtlichen Code — er bleibt ohne Phase und ohne Kategorie. Nächstliegende `
          + `bekannte Wortlaute: ${naechsteSchreibweisen(roh).map(zitat).join(', ')}.`,
        optionen: [...naechsteSchreibweisen(roh), 'kein amtlicher Code — eigenständiger Wert'],
        vorkommen: n,
      });
      continue;
    }

    // 3. Greift eine Kurzform? (Nur die häufigsten — deshalb erst gesammelt.)
    if (statusKurzLabelMit(roh).herkunft === 'ohne') ohneKurz.push({ roh, k, n });
  }

  ohneKurz.sort((x, y) => y.n - x.n || x.roh.localeCompare(y.roh, 'de'));
  for (const { roh, k, n } of ohneKurz.slice(0, spitze)) {
    const heute = statusKurzLabelMit(roh);
    out.push({
      id: `kurzlabel:${k}`,
      herkunft: 'kurzlabel',
      betrifft: roh,
      frage: `Welche Kurzform soll für ${zitat(roh)} in engen Flächen stehen (höchstens ${KURZLABEL_MAX} Zeichen)?`,
      kontext: `${zahl(n)} Vorgänge. Heute steht dort ${zitat(heute.text)}`
        + `${heute.gekuerzt ? ' — der abgeschnittene Bezeichner, sichtbar unfertig' : ''}. `
        + `Im VerlaufsBand steht diese Kurzform unmittelbar im Statussegment, ohne den `
        + `vollen Wortlaut daneben.`,
      vorkommen: n,
    });
  }
  return out;
}

// --- Amtliche Texte -------------------------------------------------------
//
// `textFragen` ist **entfallen**. Zwölf amtliche Texte beginnen klein; die
// Antwortrunde hat alle zwölf bestätigt („amtlich korrekt — bleibt klein").
// Damit ist die Frageklasse beantwortet, nicht bloß eine Liste abgearbeitet:
// der amtliche Text ist Fremddatum und wird nie korrigiert, auch nicht bei
// künftigen Fällen, die falsch aussehen. Darstellungswünsche gehen über
// `StatusCodeEintrag.kurz` bzw. `StatusWertEintrag.kurzLabel`.
//
// Siehe `STILLGELEGTE_HERKUENFTE` in `typen.ts` und Pitfall #43 in CLAUDE.md.

// --- Bestätigte Wortlaute -------------------------------------------------

export function abweichungsFragen(b: KlaerfragenBestand): Klaerfrage[] {
  return bezeichnungsAbweichungen().map(a => {
    const wo = a.wo === 'auslieferung' ? 'Die Auslieferung' : 'Die geladene Fassung';
    return {
      id: `bezeichnung-weicht-ab:code-${a.bestaetigung.code}:${a.wo}`,
      herkunft: 'bezeichnung-weicht-ab' as const,
      betrifft: `${a.bestaetigung.code} ${a.bestaetigung.wortlaut}`,
      frage: a.art === 'fehlt'
        ? `Der Statuskatalog führt Code ${a.bestaetigung.code} nicht, obwohl der Wortlaut bestätigt ist. Welcher gilt?`
        : `${wo} nennt Code ${a.bestaetigung.code} ${zitat(a.gefunden ?? '')}, bestätigt ist ${zitat(a.bestaetigung.wortlaut)}. Welcher gilt?`,
      kontext: `Bestätigt: ${a.bestaetigung.quelle}. `
        + `${zahl(vorkommenFuerWortlaut(b.rohStatus, a.bestaetigung.wortlaut))} Vorgänge tragen den bestätigten `
        + `Wortlaut. Ein abweichender Bezeichner fällt im VerlaufsBand nicht auf — dort steht `
        + `die Beschriftung ohne den Rohwert daneben.`,
      ...(a.gefunden !== null ? { optionen: [a.bestaetigung.wortlaut, a.gefunden] } : {}),
      vorkommen: vorkommenFuerWortlaut(b.rohStatus, a.bestaetigung.wortlaut),
    };
  });
}
