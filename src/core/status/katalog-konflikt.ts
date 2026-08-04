/**
 * Der Konfliktfall des Status-Katalogs — rein, ohne Share-Wissen.
 *
 * Seit mehrere PL-Personen den Katalog asynchron pflegen, ist die Annahme „ein
 * Schreiber" nicht mehr haltbar: `naechsteVersionsnummer` zählt die LOKALE Liste
 * hoch, und `schreibeKatalogAufShare` ersetzte die Datei durch eben diese Liste.
 * Wer eine fremde Fassung nicht kannte, überschrieb sie — und nahm ihr dabei
 * auch noch den Rückweg, weil sie aus der Fassungsliste verschwand.
 *
 * Dieses Modul beantwortet die drei Fragen, die dafür nötig sind, und **nur**
 * die: Was fehlt mir von drüben? Ist das ein Konflikt? Wie groß ist er? Der
 * Share-Zugriff bleibt in `katalog-share.ts`, damit hier alles node-only
 * prüfbar ist.
 *
 * **Inhalte werden nie zusammengeführt.** Vereinigt wird die LISTE der
 * Fassungen, nie ihr Inhalt — eine feldweise Mischung ergäbe einen Katalog, den
 * niemand beschlossen hat.
 */
import type { MappingVersion } from './typen';

/** Die fremde Fassung, so wie die Meldung sie benennt. */
export interface FremdeFassung {
  version: number;
  autor: string | null;
  zeitstempel: string;
}

export interface KatalogKonflikt {
  fremde: FremdeFassung;
  /** Fassung, auf der der eigene Entwurf beruht (`null` = keine Angabe). */
  basis: number | null;
  /**
   * `neuer-stand`: jemand hat veröffentlicht, seit dieser Entwurf entstand.
   * `nummern-kollision`: dieselbe Nummer trägt hier und dort verschiedene
   * Fassungen — der seltene Rest, den die Vereinigung nicht auflösen kann,
   * weil eine der beiden umnummeriert werden muss.
   */
  grund: 'neuer-stand' | 'nummern-kollision';
}

export interface Vereinigung {
  /** Fremde Fassungen, die die lokale Liste nicht kennt. */
  zuUebernehmen: MappingVersion[];
  /** Nummern, die hier UND dort vergeben sind — mit verschiedenem Inhalt. */
  kollisionen: number[];
}

/**
 * Zwei Fassungen sind dieselbe, wenn sie aus demselben Veröffentlichungs-Akt
 * stammen. Verglichen werden Nummer, Autor und Zeitstempel statt des Inhalts:
 * eine Fassung wiegt ~200 KB, und ein Tiefenvergleich hinge zusätzlich an der
 * Schlüsselreihenfolge zweier verschieden entstandener Objekte.
 */
export function istSelbeFassung(a: MappingVersion, b: MappingVersion): boolean {
  return a.version === b.version && a.zeitstempel === b.zeitstempel && a.autor === b.autor;
}

/**
 * Was von der Share-Liste in den lokalen Cache gehört — und wo beide dieselbe
 * Nummer verschieden belegt haben.
 */
export function planeVereinigung(
  lokal: readonly MappingVersion[], fremd: readonly MappingVersion[],
): Vereinigung {
  const nachNummer = new Map(lokal.map(v => [v.version, v]));
  const zuUebernehmen: MappingVersion[] = [];
  const kollisionen: number[] = [];
  for (const f of fremd) {
    const eigen = nachNummer.get(f.version);
    if (!eigen) zuUebernehmen.push(f);
    else if (!istSelbeFassung(eigen, f)) kollisionen.push(f.version);
  }
  return { zuUebernehmen, kollisionen: kollisionen.sort((a, b) => a - b) };
}

function alsFremde(v: MappingVersion): FremdeFassung {
  return { version: v.version, autor: v.autor, zeitstempel: v.zeitstempel };
}

/**
 * Der Konflikt, oder `null`.
 *
 * Eine Nummern-Kollision zählt **immer** — auch ohne `basis`: dort würde eine
 * fremde Fassung aus der Datei fallen, und genau das soll nicht mehr still
 * passieren. `basis == null` schaltet nur die Prüfung „jemand war schneller" ab
 * (der Aufrufer hat sie nicht angefordert).
 */
export function findeKonflikt(
  lokal: readonly MappingVersion[],
  fremd: readonly MappingVersion[],
  aktivAufShare: number,
  basis: number | null,
): KatalogKonflikt | null {
  const { kollisionen } = planeVereinigung(lokal, fremd);
  if (kollisionen.length > 0) {
    const nr = kollisionen[kollisionen.length - 1]!;
    const f = fremd.find(v => v.version === nr);
    if (f) return { fremde: alsFremde(f), basis, grund: 'nummern-kollision' };
  }
  if (basis != null && aktivAufShare > basis) {
    const f = fremd.find(v => v.version === aktivAufShare);
    return {
      fremde: f ? alsFremde(f) : { version: aktivAufShare, autor: null, zeitstempel: '' },
      basis,
      grund: 'neuer-stand',
    };
  }
  return null;
}

function zaehleListe<T>(
  a: readonly T[] | undefined, b: readonly T[] | undefined, schluessel: (e: T) => string,
): number {
  const links = new Map((a ?? []).map(e => [schluessel(e), JSON.stringify(e)]));
  const rechts = new Map((b ?? []).map(e => [schluessel(e), JSON.stringify(e)]));
  let n = 0;
  for (const [k, v] of links) if (rechts.get(k) !== v) n += 1;
  for (const k of rechts.keys()) if (!links.has(k)) n += 1;
  return n;
}

/**
 * Wie weit zwei Fassungen auseinanderliegen — als Zahl für den Menschen vor der
 * Entscheidung „welche der beiden gilt". Gezählt werden neue, entfallene und
 * geänderte Einträge über alle kuratierten Listen.
 *
 * Eine **Größenordnung**, kein Gate: ein Eintrag mit gleicher Bedeutung, aber
 * anderer Schlüsselreihenfolge zählte hier als Änderung. Für die Frage „lohnt
 * sich das Nachsehen" reicht das; entschieden wird nichts daran.
 */
export function zaehleAbweichungen(a: MappingVersion, b: MappingVersion): number {
  return zaehleListe(a.werte, b.werte, e => `${e.feldId}::${e.wert}`)
    + zaehleListe(a.felder, b.felder, e => e.feldId)
    + zaehleListe(a.kategorien, b.kategorien, e => e.id)
    + zaehleListe(a.todoRegeln, b.todoRegeln, e => e.id)
    + zaehleListe(a.zahPhasen, b.zahPhasen, e => e.id)
    + zaehleListe(a.textbausteine, b.textbausteine, e => e.kennung);
}

/**
 * Die aktive Fassungsnummer aus dem ANFANG der Katalog-Datei.
 *
 * Die Datei wiegt ~2,9 MB (gemessen am 04.08.2026, zwölf Fassungen) — sie beim
 * Fensterfokus komplett über SMB zu holen und zu parsen, wäre für die eine Zahl
 * nicht vertretbar. `schreibeKatalogAufShare` serialisiert mit
 * `JSON.stringify(datei, null, 2)` und legt `aktiv` als zweiten Schlüssel ab;
 * die Zahl steht damit rund 24 Byte hinter dem Dateianfang. Die `aktiv`-Flags
 * an Ordnern und Feldern sind Wahrheitswerte und können nicht treffen.
 *
 * `null` heißt „keine Aussage" — der Aufrufer warnt dann nicht, statt ersatzweise
 * die ganze Datei zu lesen.
 */
export function leseNummerAusKopf(kopf: string): number | null {
  const m = /"aktiv"\s*:\s*(\d+)/.exec(kopf);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
