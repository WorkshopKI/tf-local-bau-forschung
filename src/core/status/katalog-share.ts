/**
 * Der Status-Katalog als **Team-Datei** auf dem Daten-Share.
 *
 * Bis v2.331 war der Katalog gerätelokal — mit der Folge, dass eine Kuration nur
 * auf dem Rechner wirkte, auf dem sie stattfand: entweder kuratierte niemand oder
 * jeder neu. Seit v2.332 liegt er als Sidecar `_intern/status-katalog.json`
 * neben dem Meilenstein-Plan; die IndexedDB bleibt der lokale Cache.
 *
 * **Das Event-Log wandert ausdrücklich NICHT mit.** Es hält fest, wann *diese
 * Installation* eine Änderung beobachtet hat (`erfasstAm` = Importzeitpunkt auf
 * diesem Gerät, Backfill-Marke je Programm). Zwei Rechner, die an verschiedenen
 * Tagen importieren, schreiben für denselben Vorgang verschiedene Zeitstempel —
 * zusammengeführt ergäbe das eine widersprüchliche Historie. Der Guard
 * `status-event-log-local-only` sichert das ab.
 *
 * **Mehrere Schreiber**: seit der Katalog von mehreren PL-Personen asynchron
 * gepflegt wird, liest jeder Schreibvorgang die Datei zuerst und vereinigt die
 * Fassungs**liste** (`katalog-konflikt.ts`) — sonst ersetzte die lokale Liste
 * die fremde Fassung samt ihres Rückwegs. Erkannt wird der Konflikt optimistisch
 * wie im Journal; gelöst wird er nicht automatisch, sondern von einem Menschen.
 *
 * Sidecar-Profil (Pitfall #23): **rotierend mit Archiv** — idempotent-overwrite
 * mit Backup-Rotation, dazu seit v2.414 eine Nachbardatei für alte Fassungen
 * (`katalog-rotation.ts`). Self-gated über `queryPermission`: ohne Schreibrecht
 * ein No-op statt eines Fehlers, und ohne schreibbares Archiv wird gar nicht
 * erst rotiert. Kein DB-Version-Bump: der bestehende Store `status_katalog`
 * wird zum Cache umgedeutet, nicht ersetzt.
 *
 * Die eigentliche Datei-Mechanik wohnt seit dem Vorgangssystem in
 * `sidecar-datei.ts` und wird mit der Trigger-Tabelle geteilt — zwei Dateien,
 * eine Mechanik.
 */
import type { IDBStore } from '@/core/services/storage';
import type { MappingVersion } from './typen';
import { leseSidecar, leseSidecarKopf, leseSidecarLage, schreibeSidecar } from './sidecar-datei';
import { getAktiveVersionsnummer, listeVersionen, setzeAktiv, speichereVersion } from './katalog-store';
import { findeKonflikt, leseNummerAusKopf, planeVereinigung, type KatalogKonflikt } from './katalog-konflikt';
import {
  istKatalogArchiv, planeRotation, vereinigeArchiv,
  STATUS_KATALOG_ARCHIV_PATH, type StatusKatalogArchiv,
} from './katalog-rotation';

export const STATUS_KATALOG_PATH = '_intern/status-katalog.json';

/**
 * Einmalige Sicherung des lokalen Standes VOR der ersten Share-Übernahme. Eine
 * Fassung, die es auf dem Share unter derselben Nummer auch gibt, wird beim
 * Übernehmen überschrieben — ohne diese Kopie wäre lokale Kuration aus der Zeit
 * vor der Umstellung unwiederbringlich.
 */
export const KATALOG_BACKUP_KEY = 'status-katalog:vor-share-uebernahme';

export interface StatusKatalogDatei {
  /** Dateiformat-Version, nicht die Katalog-Fassung. */
  version: 1;
  /** Nummer der team-weit gültigen Fassung. */
  aktiv: number;
  fassungen: MappingVersion[];
  updatedAt: string;
}

/** Grobe Strukturprüfung; Feld-Details prüft `validiereImport` beim JSON-Import. */
export function istKatalogDatei(raw: unknown): raw is StatusKatalogDatei {
  if (!raw || typeof raw !== 'object') return false;
  const d = raw as Record<string, unknown>;
  if (d.version !== 1) return false;
  if (typeof d.aktiv !== 'number' || !Number.isFinite(d.aktiv)) return false;
  if (!Array.isArray(d.fassungen) || d.fassungen.length === 0) return false;
  return d.fassungen.every(f => {
    if (!f || typeof f !== 'object') return false;
    const v = f as Record<string, unknown>;
    return typeof v.version === 'number'
      && Array.isArray(v.felder) && Array.isArray(v.werte);
  });
}

/** Liest die Team-Fassung vom Share (`null` wenn fehlend/offline/kaputt). */
export async function leseKatalogVomShare(idb: IDBStore): Promise<StatusKatalogDatei | null> {
  return await leseSidecar(idb, STATUS_KATALOG_PATH, istKatalogDatei);
}

/** So viel Dateianfang reicht für die Nummer im Kopf (siehe `leseNummerAusKopf`). */
const KOPF_BYTES = 4096;

/**
 * Nur die aktive Fassungsnummer vom Share — ohne die Megabyte dahinter.
 * `null` heißt „keine Aussage" (kein Handle, keine Datei, unerwarteter Kopf).
 */
export async function leseKatalogNummer(idb: IDBStore): Promise<number | null> {
  const kopf = await leseSidecarKopf(idb, STATUS_KATALOG_PATH, KOPF_BYTES);
  return kopf == null ? null : leseNummerAusKopf(kopf);
}

export type KatalogSchreibErgebnis =
  /** Auf dem Share, gilt team-weit. */
  | { art: 'geschrieben' }
  /** Kein Handle, kein Schreibrecht, IO-Fehler — die Arbeit gilt nur hier. */
  | { art: 'nur-lokal' }
  /** Jemand anderes war schneller; nichts geschrieben, ein Mensch entscheidet. */
  | { art: 'konflikt'; konflikt: KatalogKonflikt };

/**
 * Holt fremde Fassungen in den lokalen Cache und meldet, ob dabei ein Konflikt
 * sichtbar wird. Die Übernahme geschieht **immer** — auch wenn der Aufrufer den
 * Konflikt danach bewusst übergeht: damit verschwindet keine fremde Fassung mehr
 * aus der Historie, und der Rückweg bleibt offen.
 */
async function vereinigeUndPruefe(
  idb: IDBStore, datei: StatusKatalogDatei, basis: number | null,
): Promise<KatalogKonflikt | null> {
  const lokal = await listeVersionen(idb);
  const { zuUebernehmen } = planeVereinigung(lokal, datei.fassungen);
  for (const f of zuUebernehmen) await speichereVersion(idb, f);
  const nachher = zuUebernehmen.length > 0 ? await listeVersionen(idb) : lokal;
  return findeKonflikt(nachher, datei.fassungen, datei.aktiv, basis);
}

/**
 * Übernimmt, was der Share an unbekannten Fassungen führt — als Vorschritt vor
 * der Nummernvergabe. Danach kennt die lokale Liste die Share-Nummern, und
 * `naechsteVersionsnummer` kann keine Nummer zweimal vergeben.
 */
export async function vereinigeMitShare(
  idb: IDBStore,
): Promise<{ datei: StatusKatalogDatei | null; uebernommen: number[] }> {
  const datei = await leseKatalogVomShare(idb);
  if (!datei) return { datei: null, uebernommen: [] };
  const { zuUebernehmen } = planeVereinigung(await listeVersionen(idb), datei.fassungen);
  for (const f of zuUebernehmen) await speichereVersion(idb, f);
  return { datei, uebernommen: zuUebernehmen.map(f => f.version) };
}

/** Liest das Archiv; `null` = keins da oder nicht lesbar (beides gleich zu behandeln). */
export async function leseKatalogArchiv(idb: IDBStore): Promise<StatusKatalogArchiv | null> {
  return await leseSidecar(idb, STATUS_KATALOG_ARCHIV_PATH, istKatalogArchiv);
}

/**
 * Lagert alte Fassungen aus und liefert, was in die Hauptdatei gehört.
 *
 * **Archiv zuerst, Hauptdatei danach — und bei Fehlschlag gar nicht.** Es gibt
 * keine Transaktion über zwei Dateien. Ließe sich das Archiv nicht schreiben
 * (kein Handle, kein Recht, IO-Fehler) und die Hauptdatei würde trotzdem
 * gekürzt, wären die abgeschälten Fassungen weg. Lieber eine große Datei als
 * eine verlorene Fassung; deshalb gibt die Funktion dann die volle Liste
 * zurück, und beim nächsten Speichern wird es erneut versucht.
 */
async function rotiere(
  idb: IDBStore, fassungen: readonly MappingVersion[], aktiv: number,
): Promise<MappingVersion[]> {
  const plan = planeRotation(fassungen, aktiv);
  if (plan.auslagern.length === 0) return plan.behalten;

  // LAGE statt `leseKatalogArchiv` (v4.12): das Archiv wird gleich VOLLSTAENDIG
  // neu geschrieben. Ein „unlesbar", das als leeres Archiv durchgeht, ersetzt
  // alle bisher ausgelagerten Fassungen durch die eine, die gerade abgeschält
  // wird — und auf einem Rechner, der den Katalog vom Share bezogen hat, kennt
  // die lokale Liste diese alten Fassungen gar nicht mehr. Dann lieber nicht
  // rotieren: eine große Datei ist der Preis, eine verlorene Fassung nicht.
  const lage = await leseSidecarLage(idb, STATUS_KATALOG_ARCHIV_PATH, istKatalogArchiv);
  if (lage.status === 'unlesbar') {
    console.warn('[status] Archiv nicht lesbar — es wird nicht rotiert.');
    return [...fassungen];
  }
  const bisher = lage.status === 'ok' ? lage.daten : null;
  const archiv: StatusKatalogArchiv = {
    version: 1,
    fassungen: vereinigeArchiv(bisher?.fassungen ?? [], plan.auslagern),
    updatedAt: new Date().toISOString(),
  };
  if (!(await schreibeSidecar(idb, STATUS_KATALOG_ARCHIV_PATH, archiv))) {
    console.warn('[status] Archiv nicht schreibbar — es wird nicht rotiert.');
    return [...fassungen];
  }
  return plan.behalten;
}

/**
 * Schreibt den lokalen Katalog-Stand als Team-Fassung — **read-before-write**.
 *
 * Der Katalog wird von mehreren PL-Personen asynchron gepflegt. Vor dem
 * Schreiben wird deshalb gelesen, die Fassungs**liste** vereinigt (nie ihr
 * Inhalt) und geprüft, ob jemand zwischenzeitlich veröffentlicht hat. Ohne
 * `basisVersion` bleibt nur die Vereinigung — dann wird nicht auf „jemand war
 * schneller" geprüft, wohl aber auf Nummern-Kollisionen.
 *
 * Self-gated: ohne readwrite-Berechtigung ein No-op (`nur-lokal`) statt eines
 * NotAllowedError — der Aufrufer sagt dem Nutzer dann, dass die Fassung nur
 * lokal gilt.
 */
export async function schreibeKatalogAufShare(
  idb: IDBStore,
  opts: {
    /** Fassung, auf der der Entwurf beruht. Fehlt sie, entfällt die Prüfung. */
    basisVersion?: number | null;
    /** Bereits gelesener Share-Stand (spart das zweite Volllesen von ~2,9 MB). */
    stand?: StatusKatalogDatei | null;
  } = {},
): Promise<KatalogSchreibErgebnis> {
  try {
    const basis = opts.basisVersion ?? null;
    let stand = opts.stand !== undefined ? opts.stand : await leseKatalogVomShare(idb);
    // Höchstens zwei Anläufe. Bewegt sich der Aktiv-Zeiger zwischen Lesen und
    // Schreiben, wird einmal frisch gelesen und vereinigt — die Prüfung sitzt
    // damit so spät wie möglich (Vorbild: optimistische Sperre im Journal), und
    // sie kostet 4 KB statt der ganzen Datei. Bewegt er sich dann immer noch,
    // helfen weitere Anläufe nicht; dann entscheidet ein Mensch.
    for (let anlauf = 0; stand != null; anlauf += 1) {
      const konflikt = await vereinigeUndPruefe(idb, stand, basis);
      if (konflikt) return { art: 'konflikt', konflikt };
      const jetzt = await leseKatalogNummer(idb);
      if (jetzt == null || jetzt === stand.aktiv) break;
      if (anlauf >= 1) {
        return {
          art: 'konflikt',
          konflikt: {
            fremde: { version: jetzt, autor: null, zeitstempel: '' },
            basis,
            grund: 'neuer-stand',
          },
        };
      }
      stand = await leseKatalogVomShare(idb);
    }

    const fassungen = await listeVersionen(idb);
    const aktiv = await getAktiveVersionsnummer(idb);
    if (fassungen.length === 0 || aktiv == null) return { art: 'nur-lokal' };

    // Rotation VOR dem Schreiben: der Schreiber serialisiert die komplette
    // lokale Liste, ein Filter irgendwo anders würde vom nächsten Client wieder
    // überschrieben (siehe `katalog-rotation.ts`).
    const geschrieben = await rotiere(idb, fassungen, aktiv);

    const datei: StatusKatalogDatei = {
      version: 1,
      aktiv,
      fassungen: geschrieben,
      updatedAt: new Date().toISOString(),
    };
    return (await schreibeSidecar(idb, STATUS_KATALOG_PATH, datei))
      ? { art: 'geschrieben' }
      : { art: 'nur-lokal' };
  } catch (err) {
    console.error('[status] schreibeKatalogAufShare failed:', err);
    return { art: 'nur-lokal' };
  }
}

/**
 * Löst eine Nummern-Kollision auf, ohne eine der beiden Fassungen zu verlieren:
 * die **eigene** wandert auf die nächste freie Nummer, die fremde bekommt ihre
 * Nummer zurück. Aufgerufen nur, wenn der Mensch „trotzdem veröffentlichen"
 * gewählt hat — automatisch passiert das nie.
 *
 * Gibt die neue Nummer der eigenen Fassung zurück (`null`, wenn nichts zu tun war).
 */
export async function umnummeriereEigeneFassung(
  idb: IDBStore, nummer: number, fremd: MappingVersion,
): Promise<number | null> {
  const lokal = await listeVersionen(idb);
  const eigen = lokal.find(v => v.version === nummer);
  if (!eigen) return null;
  const neueNummer = lokal.reduce((m, v) => Math.max(m, v.version), 1) + 1;
  await speichereVersion(idb, { ...eigen, version: neueNummer });
  await speichereVersion(idb, fremd);
  const aktiv = await getAktiveVersionsnummer(idb);
  if (aktiv === nummer) await setzeAktiv(idb, neueNummer);
  return neueNummer;
}

/**
 * Was der Share-Abgleich am Aktiv-Zeiger getan hat.
 *
 * Bis v2.410 gab `uebernehmeKatalogVomShare` konstant `true` zurück — die
 * Signatur trug keine Information, und das Umsetzen des Aktiv-Zeigers geschah
 * unbemerkt. Wer lokal eine ältere Fassung zum Vergleich reaktiviert hatte,
 * verlor das beim nächsten Laden spurlos.
 */
export interface KatalogUebernahmeErgebnis {
  /** Lokal aktive Nummer VOR dem Abgleich; `null`, wenn es keine gab. */
  aktivVorher: number | null;
  /** Nummer, auf die der Abgleich gesetzt hat. */
  aktivNachher: number;
  /** Hat der Abgleich den Zeiger bewegt? */
  aktivGewechselt: boolean;
}

/**
 * Übernimmt die Team-Fassung in den lokalen Cache und setzt den Aktiv-Zeiger.
 *
 * Fassungen, die es lokal unter einer Nummer gibt, die der Share nicht kennt,
 * bleiben unangetastet — sie verschwinden nicht, sondern stehen weiter in der
 * Versionsliste. Gleichnummerige werden vom Share überschrieben; genau davor
 * schützt die einmalige Sicherung unter `KATALOG_BACKUP_KEY`.
 */
export async function uebernehmeKatalogVomShare(
  idb: IDBStore, datei: StatusKatalogDatei,
): Promise<KatalogUebernahmeErgebnis> {
  // VOR der Sicherung lesen: der Zweig unten läuft nur beim ersten Mal, der
  // Vorher-Wert wird aber bei jedem Abgleich gebraucht.
  const aktivVorher = await getAktiveVersionsnummer(idb);
  const lokal = await listeVersionen(idb);
  const bereitsGesichert = (await idb.get<unknown>(KATALOG_BACKUP_KEY)) != null;
  if (!bereitsGesichert && lokal.length > 0) {
    await idb.set(KATALOG_BACKUP_KEY, {
      gesichertAm: new Date().toISOString(),
      aktiv: aktivVorher,
      fassungen: lokal,
    });
  }

  for (const fassung of datei.fassungen) await speichereVersion(idb, fassung);
  const aktivVorhanden = datei.fassungen.some(f => f.version === datei.aktiv);
  const aktivNachher = aktivVorhanden ? datei.aktiv : datei.fassungen[0]!.version;
  await setzeAktiv(idb, aktivNachher);
  return {
    aktivVorher,
    aktivNachher,
    // Ein erstmalig gesetzter Zeiger (vorher `null`) ist kein Wechsel — da gab
    // es nichts, was der Nutzer verloren hätte.
    aktivGewechselt: aktivVorher != null && aktivVorher !== aktivNachher,
  };
}

/**
 * Session-lokale Notiz für die Oberfläche: Der Startup-Abgleich läuft lange,
 * bevor jemand den Status-Katalog öffnet, deshalb kann der Hinweis nicht am
 * Aufrufer hängen. Bewusst KEIN persistenter Zustand — die Meldung gilt für
 * diese Sitzung, nicht für die nächste.
 */
let offenerAktivWechsel: KatalogUebernahmeErgebnis | null = null;

/** Liest den letzten Aktiv-Wechsel, ohne ihn zu quittieren. */
export function letzterKatalogAktivWechsel(): KatalogUebernahmeErgebnis | null {
  return offenerAktivWechsel;
}

/** Quittiert den Hinweis — er kommt in dieser Sitzung nicht wieder. */
export function quittiereKatalogAktivWechsel(): void {
  offenerAktivWechsel = null;
}

/**
 * Startup-Abgleich: Team-Fassung holen, wenn es eine gibt. Best-effort — ohne
 * Share (offline, kein Handle, keine Datei) bleibt der lokale Stand maßgeblich,
 * damit die App genauso funktioniert wie vor der Umstellung.
 *
 * `null` heißt „nichts übernommen" (keine Datei oder Fehler) — der Ergebnis-Typ
 * wird durchgereicht, sonst ginge der Aktiv-Wechsel auf halbem Weg verloren.
 */
export async function synchronisiereKatalogVomShare(
  idb: IDBStore,
): Promise<KatalogUebernahmeErgebnis | null> {
  try {
    const datei = await leseKatalogVomShare(idb);
    if (!datei) return null;
    const ergebnis = await uebernehmeKatalogVomShare(idb, datei);
    if (ergebnis.aktivGewechselt) offenerAktivWechsel = ergebnis;
    return ergebnis;
  } catch (err) {
    console.warn('[status] synchronisiereKatalogVomShare fehlgeschlagen:', err);
    return null;
  }
}
