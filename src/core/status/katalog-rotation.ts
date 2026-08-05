/**
 * Die Katalogdatei wächst — Rotation nach dem Muster des CHANGELOG.
 *
 * Eine `MappingVersion` wiegt rund 250 KB (505 Statuscodes × zwei Ebenen, dazu
 * die Kürzel). Bei zwölf Fassungen sind das 2,93 MB, und `atomicWrite` legt
 * daneben eine `.backup` an — also fast 6 MB auf dem Share, die bei **jedem**
 * App-Start vollständig gelesen und geparst werden. Mit fünf schreibenden
 * Personen ist das binnen Wochen die Startzeitbremse.
 *
 * **Die jüngsten {@link FASSUNGEN_IN_HAUPTDATEI} bleiben, ältere wandern ins
 * Archiv daneben.** Keine wird gelöscht: die Versionierung existiert, damit man
 * zurückkann, und eine Rotation, die das nimmt, wäre eine Löschfunktion mit
 * freundlichem Namen.
 *
 * **Die Rotation gehört in den SCHREIBpfad.** Der Schreiber serialisiert die
 * komplette lokale IDB-Liste; ein Filter beim Lesen oder eine einmalige
 * Aufräumaktion würde vom nächsten beliebigen Client wieder überschrieben.
 *
 * Rein: keine IO, keine Uhr. Wer schreibt, entscheidet der Aufrufer — und der
 * schreibt das Archiv ZUERST (siehe `katalog-share.ts`).
 */
import type { MappingVersion } from './typen';

/**
 * So viele Fassungen bleiben in der Hauptdatei.
 *
 * Acht, weil das die Spanne ist, in der jemand tatsächlich zurückgeht: die
 * Fassung von gestern, die vor der strittigen Änderung, die vor dem letzten
 * Import. Bei ~250 KB je Fassung bleibt die Hauptdatei damit rund 2 MB statt
 * unbegrenzt zu wachsen.
 *
 * Bewusst eine Anzahl und keine Byte-Schwelle wie beim CHANGELOG: dort sind die
 * Blöcke verschieden groß, hier sind alle Fassungen gleich schwer. Eine Zahl ist
 * dann das ehrlichere Maß — sie sagt „acht Schritte zurück", nicht „irgendwas
 * unter zwei Megabyte".
 */
export const FASSUNGEN_IN_HAUPTDATEI = 8;

/** Die Archivdatei liegt neben der Hauptdatei, nicht in einem Unterordner. */
export const STATUS_KATALOG_ARCHIV_PATH = '_intern/status-katalog-archiv.json';

export interface StatusKatalogArchiv {
  /** Dateiformat-Version, nicht die Katalog-Fassung. */
  version: 1;
  /** Ältere Fassungen, aufsteigend nach Nummer. */
  fassungen: MappingVersion[];
  updatedAt: string;
}

/**
 * Strukturprüfung des Archivs.
 *
 * Anders als `istKatalogDatei` **erlaubt** sie eine leere Liste: ein Archiv ohne
 * Einträge ist ein gültiger Zustand (noch nie rotiert), während eine Hauptdatei
 * ohne Fassungen bedeutungslos wäre. Ein `aktiv`-Zeiger fehlt hier bewusst — das
 * Archiv sagt nichts darüber, was gilt.
 */
export function istKatalogArchiv(raw: unknown): raw is StatusKatalogArchiv {
  if (!raw || typeof raw !== 'object') return false;
  const d = raw as Record<string, unknown>;
  if (d.version !== 1) return false;
  if (!Array.isArray(d.fassungen)) return false;
  return d.fassungen.every(f => {
    if (!f || typeof f !== 'object') return false;
    const v = f as Record<string, unknown>;
    return typeof v.version === 'number'
      && Array.isArray(v.felder) && Array.isArray(v.werte);
  });
}

/** Was die Rotation aus einer Fassungsliste macht. */
export interface RotationsPlan {
  /** Die jüngsten n — sie bleiben in der Hauptdatei. */
  behalten: MappingVersion[];
  /** Ältere, die ins Archiv wandern. Leer ⇒ nichts zu tun. */
  auslagern: MappingVersion[];
}

/**
 * Teilt die Liste auf, ohne etwas zu verlieren. Rein.
 *
 * **Die aktive Fassung bleibt IMMER in der Hauptdatei**, auch wenn sie alt ist:
 * sie ist die, die jeder Client beim Start braucht, und sie im Archiv zu suchen
 * hieße, die Datei doch wieder ganz zu lesen. Der Fall ist real — wer eine alte
 * Fassung reaktiviert und veröffentlicht, macht genau das.
 *
 * @param aktiv Nummer der geltenden Fassung; `null` = keine Sonderbehandlung.
 * @param grenze Wie viele in der Hauptdatei bleiben (Vorgabe
 *   {@link FASSUNGEN_IN_HAUPTDATEI}); Werte < 1 werden auf 1 gehoben — eine
 *   leere Hauptdatei wäre nach `istKatalogDatei` ungültig.
 */
export function planeRotation(
  fassungen: readonly MappingVersion[],
  aktiv: number | null,
  grenze: number = FASSUNGEN_IN_HAUPTDATEI,
): RotationsPlan {
  const n = Math.max(1, Math.floor(grenze));
  if (fassungen.length <= n) return { behalten: [...fassungen], auslagern: [] };

  const sortiert = [...fassungen].sort((a, b) => a.version - b.version);
  const behalten = sortiert.slice(-n);
  const auslagern = sortiert.slice(0, -n);

  // Die aktive Fassung zurückholen, falls sie beim Abschälen mitgegangen wäre.
  // Sie tauscht mit der ältesten der behaltenen — die Anzahl bleibt damit
  // konstant, und ausgelagert wird weiterhin von unten.
  const idx = aktiv === null ? -1 : auslagern.findIndex(f => f.version === aktiv);
  if (idx >= 0) {
    const aktive = auslagern.splice(idx, 1)[0]!;
    const verdraengt = behalten.shift();
    if (verdraengt) auslagern.push(verdraengt);
    behalten.unshift(aktive);
    behalten.sort((a, b) => a.version - b.version);
    auslagern.sort((a, b) => a.version - b.version);
  }

  return { behalten, auslagern };
}

/**
 * Führt bestehendes Archiv und neu ausgelagerte Fassungen zusammen.
 *
 * Dedupe über die Versionsnummer, **die vorhandene gewinnt**: eine Fassung, die
 * schon im Archiv liegt, ist dort seit ihrer Auslagerung unverändert — die
 * lokale Kopie könnte von einem Rechner stammen, der sie nie hätte ändern
 * dürfen. Aufsteigend sortiert, damit zwei Läufe dieselbe Datei ergeben (sie
 * wird verglichen).
 */
export function vereinigeArchiv(
  vorhanden: readonly MappingVersion[],
  neu: readonly MappingVersion[],
): MappingVersion[] {
  const nachNummer = new Map<number, MappingVersion>();
  for (const f of neu) nachNummer.set(f.version, f);
  for (const f of vorhanden) nachNummer.set(f.version, f);
  return [...nachNummer.values()].sort((a, b) => a.version - b.version);
}
