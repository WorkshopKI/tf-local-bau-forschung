/**
 * `baueVerlauf` — die Bahnen eines Vorhabens: eine Spur je Teilvorhaben plus
 * eine für den Verbund.
 *
 * **Abweichungen von der ursprünglichen Signatur**, jeweils mit Grund:
 *
 * **Regelquelle ist C16** (seit v3.23), nicht mehr die Kürzel-Zuarbeit: der
 * Aufrufer reicht die importierte Trigger-Tabelle herein, ausgewählt wird über
 * `VerlaufsBezug.programm`. Die Zuarbeit bleibt für **Bezeichnung, Rollen und
 * Kategorien** zuständig — nur ihre 41 Statuswechsel-Regeln sind abgelöst.
 *
 * - **Kein `kuerzelKatalog`-Parameter.** Nachgeschlagen wird über
 *   `kuerzelAuskunft(kuerzel, projektform)`; der Guard `kuerzel-nie-flach`
 *   verbietet jeden Zugriff auf die Rohtabelle, und ihn durchzureichen hieße,
 *   sie zu exportieren.
 * - **`statusKatalog` ist die `MappingVersion`.** Sie liefert den Marker-Schnitt
 *   und die bekannten Kürzel; die Beschriftung kommt über `statusKurzLabelMit`
 *   aus der einen Quelle (Pitfall #50).
 * - **`fristErgebnis` ist auf `bezugsZeitpunkt` eingedampft.**
 *   `frist-ergebnis.ts` importiert selbst aus `@/core/status`; den Typ hier
 *   hereinzuziehen wäre ein Laufzeit-Zyklus, und `npm run cycles` hat eine leere
 *   Allowlist. Der Aufrufer liest `FristErgebnis.bezugsZeitpunkt` — Stichtag bei
 *   laufender, Haltedatum bei angehaltener Uhr — und reicht den ISO-Tag herein.
 *
 * Der Parameter heißt `VerlaufsBezug`, nicht `Bezug`: „Bezug" ist im Modul schon
 * zweimal vergeben (`bezugsZeitpunkt`, die C16-Bezugsdatei-Nummern 210/211).
 *
 * Rein und deterministisch: keine IO, keine Uhr. Memoisierbar über FKZ und
 * Datenstand-Hash.
 */
import { schnittVon } from '../phasen-schnitt';
import { nachschlageformVonLage, projektformLage } from '../kuerzel-katalog';
import { baueChronik } from '../chronik';
import { kuerzelIndex } from '../feld-zugriff';
import { normKey } from '../normalisierung';
import type { FeldVorkommen } from '../feld-aufloesung';
import type { JournalEintrag } from '../journal/typen';
import type { AntragsChronik, FeldChronik } from '../journal/lesen';
import type { MappingVersion, TriggerZeile } from '../typen';
import { beurteileStand } from './bearbeitungsstand';
import { baueUebergaenge, type GesetztesKuerzel } from './uebergaenge';
import {
  baueC16Regeln, erreichbareCodes as c16ErreichbareCodes, wirktAufVerbund, type C16Regeln,
} from './c16-regeln';
import { baueSegmente } from './segmente';
import type { SpurArt, VerlaufsSpur, VerlaufsUebergang } from './typen';

export * from './typen';
// `baueVerlaufFuerVorgang` wird hier bewusst NICHT re-exportiert: diese Datei ist
// Barrel UND Implementierung von `baueVerlauf`, ein Re-Export machte daraus einen
// Laufzeit-Zyklus (`cycles` hat eine leere Allowlist). Aufrufer importieren direkt
// aus `@/core/status/verlauf/fuer-vorgang`.
export { beurteileStand, type StandUrteil } from './bearbeitungsstand';
export { statusRefVonText, statusRefVonCode, gleicherStatus } from './status-ref';
export { baueUebergaenge, type GesetztesKuerzel, type UebergangsEingabe } from './uebergaenge';
export {
  baueC16Regeln, zeilenFuer, zielStatusFuer, wirktAufVerbund,
  type C16Index, type C16Regeln,
} from './c16-regeln';
export { baueSegmente, type SegmentErgebnis } from './segmente';
export {
  leereBefunde, nimmAuf, c16Treffer, anteil,
  histogrammSumme, quantilAusHistogramm, histogrammUeber, DAUER_HIST_MAX,
  type VerlaufsBefunde, type LaengsteSpur, type ZustandsZaehler, type KonfidenzZaehler,
  type UnsicherAufschluesselung,
} from './erhebung';

/** Ein Teilvorhaben, so wie die Ableitung es braucht. */
export interface VerlaufsBezugTv {
  aktenzeichen: string;
  /** Roher `STATUS_TV`, wie importiert. */
  statusTvRoh: unknown;
  /** `sammleVorkommen(version.felder, vbRecord, [dieses TV], aufloesung)`. */
  vorkommen: readonly FeldVorkommen[];
  /** Überschreibt `VerlaufsBezug.vbPhaseRoh`, falls das TV eine eigene führt. */
  vbPhaseRoh?: unknown;
}

/** Woraus die Bahnen gebaut werden. */
export interface VerlaufsBezug {
  /** `null` = Einzelvorhaben ohne Verbund-Record. */
  verbundId: string | null;
  /** Roher `STATUS_VB`, wie importiert. */
  statusVbRoh: unknown;
  /** `vb_phase` — Grundlage der **Bezeichnung** (Kürzel × Projektform, nie flach).
   *  Die REGEL hängt seit v3.23 am Programm, nicht mehr an der Projektform. */
  vbPhaseRoh: unknown;
  /**
   * Richtlinien-Nummer (`FM_NUMMER` → `unterprogramm_id`) — der Schlüssel der
   * Regelquelle. `null` = unbekannt; dann greift KEINE Regel, statt die eines
   * fremden Programms zu nehmen (Pitfall #44).
   */
  programm: string | null;
  teilvorhaben: readonly VerlaufsBezugTv[];
  /** ISO-Tag, an dem die Achse endet. Bei entschiedenen Vorgängen das
   *  Entscheidungsdatum aus Phase 0, nicht heute. */
  bezugsZeitpunkt: string;
}

export interface VerlaufsOptionen {
  /** Überschreibt die Marker-Menge des Katalogs (Test/Erhebung). */
  ohneBearbeitungsstand?: ReadonlySet<number>;
}

/** Die Journal-Spalte, die einen Statuswechsel dieser Ebene belegt. */
const JOURNAL_FELD: Record<SpurArt, string> = { tv: 'STATUS_TV', verbund: 'STATUS_VB' };

function alsText(roh: unknown): string {
  return typeof roh === 'string' ? roh.trim() : roh === undefined || roh === null ? '' : String(roh).trim();
}

/**
 * Was auf die Verbundspur gehört — und warum das mehr ist als die `X`-Codes.
 *
 * Zwei Quellen, und der Unterschied ist genau der zwischen **Setzebene** und
 * **Wirkungsebene**:
 *
 * 1. **Verbund-Einträge** (`ebene: 'verbund'`, die `X`-Codes) — Setzebene.
 *    Sie stehen identisch auf jeder TV-Zeile; `sammleVorkommen` meldet sie je
 *    Teilvorhaben-Aufruf einmal, über mehrere Aufrufe also mehrfach. Entdoppelt
 *    über die `feldId` — sonst stünde ein Verbund-Termin so oft in der Bahn, wie
 *    das Vorhaben Teilvorhaben hat.
 * 2. **Teilvorhaben-Kürzel, die den Verbund umsetzen** — Wirkungsebene. `ABB`
 *    und `AB` tragen kein `X`, werden am Teilvorhaben gesetzt, füllen in C16
 *    aber `statusVb`: ein Teilvorhaben wird bewilligt, und der Verbund kippt mit.
 *    Ohne sie bliebe die Verbundspur weitgehend leer.
 *
 * Aufgenommen wird ein TV-Kürzel nur, wenn eine Zeile **dieses Programms** ihm
 * Verbund-Wirkung gibt — nicht, wenn irgendeine andere Richtlinie das täte. Sonst
 * wanderten TV-Termine als Vermutung auf die Verbundbahn.
 *
 * Setzen mehrere Teilvorhaben dasselbe Kürzel an verschiedenen Tagen, sind das
 * mehrere Übergänge; am selben Tag fasst `baueChronik` sie zu einem zusammen.
 */
function verbundVorkommen(bezug: VerlaufsBezug, regeln: C16Regeln): FeldVorkommen[] {
  const gesehen = new Set<string>();
  const out: FeldVorkommen[] = [];
  for (const tv of bezug.teilvorhaben) {
    for (const v of tv.vorkommen) {
      if (v.feld.ebene === 'verbund') {
        if (gesehen.has(v.feld.feldId)) continue;
        gesehen.add(v.feld.feldId);
        out.push(v);
        continue;
      }
      if (v.feld.code && wirktAufVerbund(regeln.index, v.feld.code)) out.push(v);
    }
  }
  return out;
}

/**
 * Alle Kürzel des Verbunds mit ihrem Tag — über **alle** Teilvorhaben.
 *
 * Grundlage der „kein Teilvorhaben trägt X"-Bedingungen. Dasselbe Kürzel an
 * mehreren Teilvorhaben zählt mit dem **frühesten** Tag: gefragt ist, ab wann es
 * im Verbund gesetzt war, nicht wann das letzte nachzog.
 */
function verbundKuerzel(bezug: VerlaufsBezug): GesetztesKuerzel[] {
  const alle: FeldVorkommen[] = [];
  for (const tv of bezug.teilvorhaben) alle.push(...tv.vorkommen);
  // Über `baueChronik`, nicht über die Rohwerte: der Export führt deutsche
  // Datumsformate, die Übergänge ISO-Tage. Zwei Schreibweisen gegeneinander zu
  // vergleichen ergäbe eine Reihenfolge, die keine ist.
  const frueheste = new Map<string, string>();
  for (const e of baueChronik(alle, { zeigeNebensaechlich: false })) {
    const code = e.feld.code;
    if (!code) continue;
    const key = normKey(code);
    const bisher = frueheste.get(key);
    if (bisher === undefined || e.tag < bisher) frueheste.set(key, e.tag);
  }
  return [...frueheste].map(([key, tag]) => ({ key, tag }));
}

/** Statuswechsel dieser Ebene, die das Journal belegt. */
function statusEintraege(
  journal: AntragsChronik | null, art: SpurArt,
): JournalEintrag[] {
  if (!journal?.gefuehrt) return [];
  const feld = JOURNAL_FELD[art];
  return journal.felder
    .filter((f: FeldChronik) => f.feld.toUpperCase() === feld)
    .flatMap((f: FeldChronik) => f.eintraege)
    .filter((e: JournalEintrag) => e.art === 'gesetzt' || e.art === 'geaendert');
}

/**
 * Hebt Übergänge auf `zeitliche_naehe`, die zeitlich zu einem belegten
 * Statuswechsel passen — und nur die, die sonst nichts zu sagen hätten.
 *
 * Ein `unscharf`-Eintrag deckt eine **Spanne** ab; sie wird als Spanne geprüft,
 * nicht auf ein Datum verengt.
 */
function abgleichMitJournal(
  uebergaenge: VerlaufsUebergang[], eintraege: readonly JournalEintrag[],
): void {
  if (eintraege.length === 0) return;
  for (const u of uebergaenge) {
    if (u.konfidenz !== 'kein_kuerzel') continue;
    const passt = eintraege.some(e => {
      const von = (e.unscharf && e.vonDatum ? e.vonDatum : e.datum).slice(0, 10);
      const bis = (e.unscharf && e.bisDatum ? e.bisDatum : e.datum).slice(0, 10);
      return u.datum >= von && u.datum <= bis;
    });
    if (passt) u.konfidenz = 'zeitliche_naehe';
  }
}

function baueSpur(
  art: SpurArt, id: string, statusRoh: string,
  vorkommen: readonly FeldVorkommen[],
  bezug: VerlaufsBezug,
  ctx: {
    projektform: ReturnType<typeof projektformLage>;
    regeln: C16Regeln;
    felderNachCode: ReturnType<typeof kuerzelIndex>;
    verbundKuerzel: readonly GesetztesKuerzel[];
    markerCodes: ReadonlySet<number>;
    journal: AntragsChronik | null;
    erreichbareCodes: (art: SpurArt) => ReadonlySet<number>;
  },
): VerlaufsSpur {
  const journalAb = ctx.journal?.journalAb ?? null;
  const grundlage = {
    art, id, herkunft: 'abgeleitet' as const, journalAb, projektform: ctx.projektform,
  };

  if (statusRoh === '') {
    return {
      ...grundlage, zustand: 'kein_wert_im_csv', segmente: [], uebergaenge: [],
      begruendung: art === 'tv'
        ? 'Das Teilvorhaben führt keinen Statuswert im Export.'
        : 'Der Verbund führt keinen Statuswert im Export.',
    };
  }

  const uebergaenge = baueUebergaenge({
    vorkommen,
    // Seit der Klärrunde antwortet die Kuration auch für DS — deshalb die
    // Nachschlageform statt der Projektform der Zuarbeit.
    projektform: nachschlageformVonLage(ctx.projektform),
    art,
    regeln: ctx.regeln.index,
    felderNachCode: ctx.felderNachCode,
    verbundKuerzel: ctx.verbundKuerzel,
  });

  const urteil = beurteileStand(statusRoh, ctx.markerCodes);
  if (!urteil.traegtStand) {
    return {
      ...grundlage, zustand: 'kein_bearbeitungsstand', segmente: [], uebergaenge: [],
      begruendung: urteil.begruendung ?? '',
      verworfeneTermine: uebergaenge.length,
    };
  }

  const eintraege = statusEintraege(ctx.journal, art);
  abgleichMitJournal(uebergaenge, eintraege);

  const { segmente, abweichung, belegteWechsel } = baueSegmente(
    uebergaenge, statusRoh, bezug.bezugsZeitpunkt, ctx.erreichbareCodes(art),
  );

  const beobachtet = eintraege.length > 0;
  const ohneWechsel = belegteWechsel === 0;
  return {
    ...grundlage,
    herkunft: beobachtet ? 'beobachtet' : 'abgeleitet',
    zustand: ohneWechsel ? 'nicht_beobachtet' : 'verlauf',
    segmente,
    uebergaenge,
    ...(ohneWechsel ? { begruendung: ohneWechselGrund(ctx.regeln, uebergaenge.length) } : {}),
    // Dieselbe Unterscheidung wie im Begründungstext, aber als Wert: die Bahn
    // zeichnet „keine Regelquelle" anders als „kein Bearbeitungsstand".
    ...(ohneWechsel && ctx.regeln.lage !== 'regeln' ? { regelLage: ctx.regeln.lage } : {}),
    ...(abweichung ? { abweichung } : {}),
  };
}

/**
 * Warum keine Bahn entstand — und die drei Fälle sind nicht derselbe.
 *
 * Ohne diese Unterscheidung läse sich „kein Übergang erklärt diesen Status" auch
 * dort, wo die App gar keine Regeln hat: eine Aussage über den Vorgang, wo eine
 * über die Datenlage hingehört. Programm 46/47/48 (Richtlinie 2015) führt C16
 * nicht — dort ist das der Regelfall, nicht der Befund.
 */
function ohneWechselGrund(regeln: C16Regeln, termine: number): string {
  const zaehlwort = `${termine} ${termine === 1 ? 'Termin' : 'Termine'}`;
  if (regeln.lage === 'programm-unbekannt') {
    return `Die Richtlinie des Vorgangs ist unbekannt — ohne sie greift keine Regel (${zaehlwort}).`;
  }
  if (regeln.lage === 'programm-ohne-regeln') {
    return `Die Trigger-Tabelle führt für diese Richtlinie keine Regeln (${zaehlwort}).`;
  }
  return `Kein Übergang erklärt diesen Status — ${zaehlwort} ohne bekannten Statuswechsel.`;
}

/**
 * Baut alle Bahnen eines Vorhabens: je Teilvorhaben eine, dazu die des Verbunds.
 *
 * Die Verbundspur ist **abgeleitet, nicht beobachtet** — solange das
 * Import-Diff-Journal für den Vorgang nichts führt. Sobald es das tut, steigt
 * `herkunft` auf `beobachtet`; widerspricht die Beobachtung, wird das als
 * `abweichung` ausgewiesen und nicht überschrieben.
 */
export function baueVerlauf(
  bezug: VerlaufsBezug,
  version: MappingVersion,
  trigger: readonly TriggerZeile[],
  journal: AntragsChronik | null,
  opts: VerlaufsOptionen = {},
): VerlaufsSpur[] {
  const regeln = baueC16Regeln(trigger, bezug.programm);
  const markerCodes = opts.ohneBearbeitungsstand ?? schnittVon(version).markerCodes;
  const felderNachCode = kuerzelIndex(version.felder);
  const kuerzel = verbundKuerzel(bezug);

  // Welche Statuscodes kann die Ableitung je Ebene überhaupt erreichen? Die
  // Frage entscheidet, ob eine Abweichung ein Widerspruch ist oder nur eine
  // Lücke im Regelwerk — und gemessen ist fast alles Letzteres. Einmal je Ebene,
  // nicht je Spur: der Index steht für den ganzen Vorgang.
  const erreichbar = {
    tv: c16ErreichbareCodes(regeln.index, 'tv'),
    verbund: c16ErreichbareCodes(regeln.index, 'verbund'),
  };
  const erreichbareCodes = (art: SpurArt): ReadonlySet<number> => erreichbar[art];
  const gemeinsam = {
    regeln, felderNachCode, verbundKuerzel: kuerzel, markerCodes, journal, erreichbareCodes,
  };

  const spuren: VerlaufsSpur[] = [];
  for (const tv of bezug.teilvorhaben) {
    spuren.push(baueSpur('tv', tv.aktenzeichen, alsText(tv.statusTvRoh), tv.vorkommen, bezug, {
      projektform: projektformLage(tv.vbPhaseRoh ?? bezug.vbPhaseRoh),
      ...gemeinsam,
    }));
  }

  spuren.push(baueSpur(
    'verbund', bezug.verbundId ?? '', alsText(bezug.statusVbRoh),
    verbundVorkommen(bezug, regeln), bezug,
    { projektform: projektformLage(bezug.vbPhaseRoh), ...gemeinsam },
  ));

  return spuren;
}
