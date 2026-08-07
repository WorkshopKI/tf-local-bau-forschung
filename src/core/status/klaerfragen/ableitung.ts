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
import { uneinigeKuerzel } from '../kuerzel-katalog';
import { STATUS_CODE_KATALOG, KURZLABEL_MAX, findeStatusCode } from '../status-codes';
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

export function bedeutungsFragen(b: KlaerfragenBestand): Klaerfrage[] {
  const out: Klaerfrage[] = [];
  for (const u of uneinigeKuerzel()) {
    const dsVorkommen = b.proKuerzelDs.get(u.kuerzel) ?? 0;
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

export function markerFrage(b: KlaerfragenBestand): Klaerfrage[] {
  const betroffen = uneinigeKuerzel().filter(u => (b.proKuerzelDs.get(u.kuerzel) ?? 0) > 0);
  if (betroffen.length === 0) return [];
  const markiert = betroffen.filter(u => u.strittig);
  const offen = betroffen.filter(u => !u.strittig);
  const gewicht = offen.reduce((n, u) => n + (b.proKuerzelDs.get(u.kuerzel) ?? 0), 0);

  return [{
    id: 'strittig-marker',
    herkunft: 'strittig-marker',
    betrifft: 'Marker „strittig"',
    frage: 'Soll der Marker „strittig" auch Bedeutungsunterschiede zwischen Projektformen kennzeichnen?',
    kontext: `${zahl(betroffen.length)} im DS-Bestand vorkommende Kürzel führen je Projektform `
      + `verschiedene Bedeutungen; davon tragen ${zahl(markiert.length)} den Marker. Er misst heute `
      + `etwas anderes — ein Patt bei SCHREIBVARIANTEN desselben Textes, vom Generator gesetzt, `
      + `nicht von Hand. Solange das so bleibt, kennzeichnet nichts die inhaltlichen `
      + `Widersprüche: ${zahl(offen.length)} Kürzel mit zusammen ${zahl(gewicht)} DS-Vorgängen `
      + `stehen unmarkiert da.`,
    optionen: [
      'ja — der Marker soll beides kennzeichnen',
      'nein — Bedeutungsunterschiede brauchen ein eigenes Kennzeichen',
      'nein — der Marker bleibt wie er ist, kein zusätzliches Kennzeichen',
    ],
    vorkommen: gewicht,
  }];
}

// --- DS ohne Quelle -------------------------------------------------------

export function dsFrage(b: KlaerfragenBestand): Klaerfrage[] {
  if (b.dsVorgaenge === 0) return [];
  const kuerzel = [...b.proKuerzelDs.keys()];
  const vorkommen = [...b.proKuerzelDs.values()].reduce((n, v) => n + v, 0);
  const uneinig = uneinigeKuerzel().filter(u => (b.proKuerzelDs.get(u.kuerzel) ?? 0) > 0).length;

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

/**
 * Die drei Wert-Herkünfte in **einem** Durchlauf, damit sie disjunkt bleiben:
 * je Rohwert gewinnt der erste Treffer. Getrennte Funktionen müssten dieselbe
 * Reihenfolge jede für sich kennen — und würden beim ersten Nachtrag auseinanderlaufen.
 */
export function wertFragen(e: KlaerfragenEingabe): Klaerfrage[] {
  const { bestand: b, fassungsWerte } = e;
  const out: Klaerfrage[] = [];
  const ohneKurz: { roh: string; n: number }[] = [];

  for (const [roh, n] of b.rohStatus) {
    const k = normalisiereWert(roh);
    if (k === '') continue;
    const verbuende = b.rohStatusVerbuende.get(roh) ?? 0;
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
    if (statusKurzLabelMit(roh).herkunft === 'ohne') ohneKurz.push({ roh, n });
  }

  ohneKurz.sort((x, y) => y.n - x.n || x.roh.localeCompare(y.roh, 'de'));
  for (const { roh, n } of ohneKurz.slice(0, KURZLABEL_SPITZE)) {
    const heute = statusKurzLabelMit(roh);
    out.push({
      id: `kurzlabel:${normalisiereWert(roh)}`,
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

/** Beginnt der amtliche Text mit einem Kleinbuchstaben? */
function beginntKlein(text: string): boolean {
  const c = text.trim().charAt(0);
  return c !== '' && c.toLowerCase() === c && c.toUpperCase() !== c;
}

export function textFragen(b: KlaerfragenBestand): Klaerfrage[] {
  const out: Klaerfrage[] = [];
  for (const e of STATUS_CODE_KATALOG) {
    if (!beginntKlein(e.text)) continue;
    const n = b.rohStatus.get(e.text) ?? 0;
    // Ein Code, der im Bestand nicht vorkommt, erzeugt keine Anzeige und damit
    // keine falsche — er gehört nach demselben Kriterium nicht in die Liste wie
    // die Kürzel ohne DS-Vorkommen. Die Marker-Werte (93/94) stehen laut §14.4
    // ausschließlich auf Roh-Exportzeilen ohne Förderkennzeichen; sie hier zu
    // fragen kostete den Fachbereich Zeit an Zeilen, die keine Anträge sind.
    if (n === 0) continue;
    out.push({
      id: `amtlicher-text-klein:code-${e.code}`,
      herkunft: 'amtlicher-text-klein',
      betrifft: `${e.code} ${e.text}`,
      frage: `Ist ${zitat(e.text)} der amtliche Wortlaut, oder ist die Kleinschreibung ein Erfassungsfehler in der Parametertabelle?`,
      kontext: `Code ${e.code}, ${zahl(n)} Vorgänge. Die App gibt den amtlichen Text wortgetreu `
        + `aus (Tooltip, Export, Prompt); die Pille daneben sagt ${zitat(e.kurz)} — das ist `
        + `unsere Beschriftung und bleibt davon unberührt. Gefragt ist allein, ob der amtliche `
        + `Wortlaut so stimmt.`,
      optionen: ['amtlich korrekt — bleibt klein', 'Erfassungsfehler — beginnt groß', 'unklar'],
      vorkommen: n,
    });
  }
  return out;
}

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
        + `${zahl(b.rohStatus.get(a.bestaetigung.wortlaut) ?? 0)} Vorgänge tragen den bestätigten `
        + `Wortlaut. Ein abweichender Bezeichner fällt im VerlaufsBand nicht auf — dort steht `
        + `die Beschriftung ohne den Rohwert daneben.`,
      ...(a.gefunden !== null ? { optionen: [a.bestaetigung.wortlaut, a.gefunden] } : {}),
      vorkommen: b.rohStatus.get(a.bestaetigung.wortlaut) ?? 0,
    };
  });
}
