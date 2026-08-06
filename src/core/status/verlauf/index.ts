/**
 * `baueVerlauf` — die Bahnen eines Vorhabens: eine Spur je Teilvorhaben plus
 * eine für den Verbund.
 *
 * **Abweichungen von der ursprünglichen Signatur**, jeweils mit Grund:
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
import { projektformLage, type Projektform } from '../kuerzel-katalog';
import type { FeldVorkommen } from '../feld-aufloesung';
import type { KuerzelTriggerRegel } from '../kuerzel-trigger.data';
import type { JournalEintrag } from '../journal/typen';
import type { AntragsChronik, FeldChronik } from '../journal/lesen';
import type { MappingVersion } from '../typen';
import { beurteileStand } from './bearbeitungsstand';
import { baueRegelIndex, baueUebergaenge, type RegelIndex } from './uebergaenge';
import { baueSegmente } from './segmente';
import type { SpurArt, VerlaufsSpur, VerlaufsUebergang } from './typen';

export * from './typen';
export { beurteileStand, type StandUrteil } from './bearbeitungsstand';
export { statusRefVonText, statusRefVonRegel, gleicherStatus } from './status-ref';
export { baueRegelIndex, baueUebergaenge, type RegelIndex } from './uebergaenge';
export { baueSegmente, type SegmentErgebnis } from './segmente';
export {
  leereBefunde, nimmAuf, c16Treffer, anteil,
  type VerlaufsBefunde, type LaengsteSpur, type ZustandsZaehler, type KonfidenzZaehler,
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
  /** `vb_phase` — Grundlage der Projektform (Kürzel × Projektform, nie flach). */
  vbPhaseRoh: unknown;
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

/** Ohne Projektform greift keine Regel — also ist auch kein Status erreichbar. */
const LEER: ReadonlySet<number> = new Set();

function alsText(roh: unknown): string {
  return typeof roh === 'string' ? roh.trim() : roh === undefined || roh === null ? '' : String(roh).trim();
}

/**
 * Was auf die Verbundspur gehört — und warum das mehr ist als die `X`-Codes.
 *
 * Zwei Quellen:
 *
 * 1. **Verbund-Einträge** (`ebene: 'verbund'`, die `X`-Codes). Sie stehen
 *    identisch auf jeder TV-Zeile; `sammleVorkommen` meldet sie je
 *    Teilvorhaben-Aufruf einmal, über mehrere Aufrufe also mehrfach. Entdoppelt
 *    über die `feldId` — sonst stünde ein Verbund-Termin so oft in der Bahn, wie
 *    das Vorhaben Teilvorhaben hat.
 * 2. **Teilvorhaben-Kürzel, die den Verbund umsetzen.** `ABB` und `AB` sind
 *    TV-Felder (kein `X`-Präfix), ihre Regel trägt aber `scope: 'tv+verbund'` —
 *    ein Teilvorhaben wird bewilligt, und der Verbund kippt mit. Ohne sie bliebe
 *    die Verbundspur für die Projektform NW **vollständig** leer.
 *
 * Aufgenommen wird ein TV-Kürzel nur, wenn die Regel **dieser Projektform** ihm
 * Verbund-Wirkung gibt — nicht, wenn irgendeine andere Form das täte. Sonst
 * wanderten TV-Termine als Vermutung auf die Verbundbahn.
 *
 * Setzen mehrere Teilvorhaben dasselbe Kürzel an verschiedenen Tagen, sind das
 * mehrere Übergänge; am selben Tag fasst `baueChronik` sie zu einem zusammen.
 */
function verbundVorkommen(
  bezug: VerlaufsBezug, regeln: RegelIndex, projektform: Projektform | null,
): FeldVorkommen[] {
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
      if (projektform === null || !v.feld.code) continue;
      const regel = regeln.get(`${v.feld.code.normalize('NFC').toUpperCase()}|${projektform}`);
      if (regel && (regel.scope === 'verbund' || regel.scope === 'tv+verbund')) out.push(v);
    }
  }
  return out;
}

/**
 * Prüft `XPC+`/`XPC?` über die Teilvorhaben.
 *
 * `null` heißt „nicht prüfbar": das Kürzel steht in keinem Datumsfeld der
 * Fassung, es ist also gar nicht lesbar. Bekannte Grenze: eine Spalte, die die
 * Fassung führt, das Programm-Schema aber nicht mappt, sieht hier aus wie
 * „nirgends gesetzt" — im Bestandslauf ausgewiesen, nicht stillschweigend.
 */
function baueAggregationsPruefung(
  bezug: VerlaufsBezug, bekannteCodes: ReadonlySet<string>,
): (kuerzel: string, quantor: 'alle' | 'kein') => boolean | null {
  return (kuerzel, quantor) => {
    const code = kuerzel.normalize('NFC').toUpperCase();
    if (!bekannteCodes.has(code) || bezug.teilvorhaben.length === 0) return null;
    const hat = (tv: VerlaufsBezugTv): boolean => tv.vorkommen.some(
      v => v.feld.code?.normalize('NFC').toUpperCase() === code && v.wert.trim() !== '');
    return quantor === 'alle'
      ? bezug.teilvorhaben.every(hat)
      : !bezug.teilvorhaben.some(hat);
  };
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
    regeln: RegelIndex;
    markerCodes: ReadonlySet<number>;
    journal: AntragsChronik | null;
    pruefeAggregation: (k: string, q: 'alle' | 'kein') => boolean | null;
    erreichbareCodes: (art: SpurArt, form: Projektform | null) => ReadonlySet<number>;
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
    projektform: ctx.projektform.art === 'bekannt' ? ctx.projektform.form : null,
    art,
    regeln: ctx.regeln,
    pruefeAggregation: ctx.pruefeAggregation,
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

  const form = ctx.projektform.art === 'bekannt' ? ctx.projektform.form : null;
  const { segmente, abweichung, belegteWechsel } = baueSegmente(
    uebergaenge, statusRoh, bezug.bezugsZeitpunkt, ctx.erreichbareCodes(art, form),
  );

  const beobachtet = eintraege.length > 0;
  const ohneWechsel = belegteWechsel === 0;
  return {
    ...grundlage,
    herkunft: beobachtet ? 'beobachtet' : 'abgeleitet',
    zustand: ohneWechsel ? 'nicht_beobachtet' : 'verlauf',
    segmente,
    uebergaenge,
    ...(ohneWechsel
      ? {
        begruendung: `Kein Übergang erklärt diesen Status — ${uebergaenge.length} `
          + `${uebergaenge.length === 1 ? 'Termin' : 'Termine'} ohne bekannten Statuswechsel.`,
      }
      : {}),
    ...(abweichung ? { abweichung } : {}),
  };
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
  triggerRegeln: readonly KuerzelTriggerRegel[],
  journal: AntragsChronik | null,
  opts: VerlaufsOptionen = {},
): VerlaufsSpur[] {
  const regeln = baueRegelIndex(triggerRegeln);
  const markerCodes = opts.ohneBearbeitungsstand ?? schnittVon(version).markerCodes;
  const bekannteCodes = new Set<string>();
  for (const f of version.felder) {
    if (f.typ === 'datum' && f.code) bekannteCodes.add(f.code.normalize('NFC').toUpperCase());
  }
  const pruefeAggregation = baueAggregationsPruefung(bezug, bekannteCodes);

  // Welche Statuscodes kann die Ableitung je Ebene und Projektform überhaupt
  // erreichen? Die Frage entscheidet, ob eine Abweichung ein Widerspruch ist
  // oder nur eine Lücke im Regelwerk — und gemessen ist fast alles Letzteres.
  const erreichbarCache = new Map<string, ReadonlySet<number>>();
  const erreichbareCodes = (art: SpurArt, form: Projektform | null): ReadonlySet<number> => {
    if (form === null) return LEER;
    const k = `${art}|${form}`;
    const bekannt = erreichbarCache.get(k);
    if (bekannt) return bekannt;
    const menge = new Set<number>();
    for (const r of triggerRegeln) {
      if (r.projektform !== form || r.zielStatus?.code == null) continue;
      const passt = art === 'tv'
        ? r.scope === 'tv' || r.scope === 'tv+verbund'
        : r.scope === 'verbund' || r.scope === 'tv+verbund';
      if (passt) menge.add(r.zielStatus.code);
    }
    erreichbarCache.set(k, menge);
    return menge;
  };

  const spuren: VerlaufsSpur[] = [];
  for (const tv of bezug.teilvorhaben) {
    spuren.push(baueSpur('tv', tv.aktenzeichen, alsText(tv.statusTvRoh), tv.vorkommen, bezug, {
      projektform: projektformLage(tv.vbPhaseRoh ?? bezug.vbPhaseRoh),
      regeln, markerCodes, journal, pruefeAggregation, erreichbareCodes,
    }));
  }

  const vbLage = projektformLage(bezug.vbPhaseRoh);
  spuren.push(baueSpur(
    'verbund', bezug.verbundId ?? '', alsText(bezug.statusVbRoh),
    verbundVorkommen(bezug, regeln, vbLage.art === 'bekannt' ? vbLage.form : null), bezug,
    { projektform: vbLage, regeln, markerCodes, journal, pruefeAggregation, erreichbareCodes },
  ));

  return spuren;
}
