/**
 * Der Suchindex zieht nach, wenn neue CSV-Daten da sind — nicht nach Kalender.
 *
 * **Warum nicht „einmal pro Woche".** Die Kurzbeschreibung eines Vorhabens liegt
 * nur in `9052_PrjBsp…`, und die wird einmal pro Woche exportiert; der Korpus
 * kann sich also nur aendern, wenn dieser Import laeuft. Ein Kalender-Takt ist
 * dafuer ein schlechter Stellvertreter: er feuert, wenn nichts passiert ist
 * (ein 200-MB-Modell fuer nichts), und verpasst es, wenn der Export einen Tag
 * rutscht. Der Import ist das Ereignis — und woran man ihn erkennt, ist nicht
 * sein Dateiname, sondern dass sich Embedding-Texte geaendert haben
 * ([texthashes.ts](@/core/services/embedding-corpus/texthashes)). Ein
 * Dateiname-Literal waere Fremddaten im Code und laege beim naechsten
 * Export-Umbau still daneben.
 *
 * **Warum opt-in und maschine-lokal.** Der Lauf laedt ein ~200-MB-Modell in den
 * RAM dieses Tabs. Ein geteilter Schalter hiesse: alle Rechner tun das
 * gleichzeitig fuer dasselbe Ergebnis — genau das OOM, gegen das v2.47 den
 * Build-Lock eingefuehrt hat. Der Schalter liegt deshalb in der lokalen IDB und
 * geht **nie** nach `auslastung.json` oder auf den Share.
 *
 * **Was er NICHT tut:** den Bruch einer Textfassung heilen (v2 → v3). Weicht die
 * Signatur ab, waere „inkrementell" ein ~40-Minuten-Vollbau; der bleibt
 * Handarbeit in der Kuration. Der Nachlauf ist die Instandhaltung danach.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { StorageService } from '@/core/services/storage';
import { listAntraegeByProgramm } from '@/core/services/csv/idb-csv';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import {
  countEmbeddings,
  aktuelleKorpusSignatur,
  ladeKorpusSignatur,
  signaturenGleich,
} from '@/core/services/embedding-corpus';
import { acquireBuildLock, heartbeat, releaseLock } from '@/core/services/infrastructure/build-lock';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { useEmbeddingCorpusMirror } from '@/core/hooks/useEmbeddingCorpusMirror';
// Direktimport statt Barrel: `./index.ts` zieht das ganze Matching-Submodul,
// und dieser Pfad laeuft beim Start (leere Zyklen-Allowlist, `npm run cycles`).
import { buildEmbeddingCorpus, ermittleKorpusBestand } from './embedding-corpus';
import { bumpAuslastungCorpusSignal } from './corpus-signal';

/** Schalter — maschine-lokal, nie auf dem Share (siehe Dateikopf). */
export const NACHLAUF_AN_KEY = 'emb-korpus-nachlauf';
/** ISO-Zeitstempel des letzten erfolgreichen Nachlaufs. */
export const NACHLAUF_STAND_KEY = 'emb-korpus-letzter-lauf';

export async function istNachlaufAn(idb: IDBStore): Promise<boolean> {
  return (await idb.get<boolean>(NACHLAUF_AN_KEY)) === true;
}

export async function setzeNachlauf(idb: IDBStore, an: boolean): Promise<void> {
  await idb.set(NACHLAUF_AN_KEY, an);
}

export async function ladeNachlaufStand(idb: IDBStore): Promise<string | null> {
  return (await idb.get<string>(NACHLAUF_STAND_KEY)) ?? null;
}

export async function merkeNachlaufStand(idb: IDBStore, iso: string): Promise<void> {
  await idb.set(NACHLAUF_STAND_KEY, iso);
}

/** Warum ein Nachlauf gerade NICHT laeuft. Jeder Fall hat einen eigenen Namen,
 *  damit „passiert nichts" nicht als ein Zustand erscheint, der es nicht ist. */
export type NachlaufSperre =
  | 'aus'
  | 'offline'
  | 'kein-schreibrecht'
  | 'daten-laufen'
  | 'korpus-leer'
  | 'fremder-raum'
  | 'nichts-zu-tun'
  | 'lock-belegt';

/**
 * Welche Sperren loesen sich von selbst wieder auf?
 *
 * Der Aufrufer prueft einmal je Sitzung (Einmal-Latch, sonst laedt jeder Render
 * ein 200-MB-Modell). Nach einer VORUEBERGEHENDEN Sperre waere dieser eine
 * Versuch verschenkt: beide treten bevorzugt beim Start auf, wo die
 * Datenaktualisierung gemessene 3,4–5,1 s laeuft und der Nachlauf nach
 * `requestIdleCallback(…, {timeout: 3000})` prueft — ein Muenzwurf, dessen
 * Verlierer den Nachlauf fuer die ganze Sitzung verlor (v4.128).
 *
 * Die Einteilung steht hier und nicht beim Aufrufer: sie folgt aus der Natur
 * der Sperre, und eine neue Sperre soll die Frage im selben Blick beantworten.
 */
export const SPERRE_VORUEBERGEHEND: ReadonlySet<NachlaufSperre> = new Set<NachlaufSperre>([
  'daten-laufen', // die Aktualisierung ist in Sekunden durch
  'lock-belegt',  // ein anderer Rechner baut gerade
]);

export interface NachlaufLage {
  /** Hat dieser Rechner den Nachlauf eingeschaltet? */
  an: boolean;
  /** Datenspeicher erreichbar? */
  online: boolean;
  /** Darf dieser Build/Nutzer auf den Share schreiben? */
  darfSchreiben: boolean;
  /** Laeuft gerade eine Datenaktualisierung (Snapshot/CSV)? */
  datenUpdateLaeuft: boolean;
  /** Wie viele Vektoren lokal liegen. */
  lokalCount: number;
  /** Stimmt die lokale Korpus-Signatur mit der ueberein, die dieser Lauf erzeugen wuerde? */
  raumAktuell: boolean;
  /** Wie viele Antraege fehlen oder haben geaenderten Text. */
  zuEmbedden: number;
  /** Ist der Build-Lock frei? */
  lockFrei: boolean;
}

export interface NachlaufUrteil {
  laeuft: boolean;
  sperre?: NachlaufSperre;
  /** Ein Satz — geht so in die Oberflaeche und ins Log. */
  grund: string;
}

/**
 * Die Vorbedingungen, rein und in fester Reihenfolge — von „gar nicht gewollt"
 * ueber „waere teuer" zu „gibt nichts zu tun".
 *
 * Rein, weil die Karte dieselbe Regel anzeigen muss, nach der der Lauf
 * entscheidet: ein Nachlauf, der „3 Anträge" ankuendigt und dann schweigend
 * nicht startet, ist schlimmer als keiner.
 */
export function pruefeNachlauf(lage: NachlaufLage): NachlaufUrteil {
  if (!lage.an) {
    return { laeuft: false, sperre: 'aus', grund: 'Der automatische Nachlauf ist auf diesem Rechner aus.' };
  }
  if (!lage.online) {
    return { laeuft: false, sperre: 'offline', grund: 'Der Datenspeicher ist nicht erreichbar.' };
  }
  // Ohne Upload waeren ~40 Minuten Rechenzeit fuer einen Korpus, den niemand
  // sonst bekommt — der Lauf lohnt sich nur, wenn das Ergebnis das Team erreicht.
  if (!lage.darfSchreiben) {
    return {
      laeuft: false, sperre: 'kein-schreibrecht',
      grund: 'Dieser Build darf nicht auf den Datenspeicher schreiben — der gebaute Korpus käme beim Team nie an.',
    };
  }
  if (lage.datenUpdateLaeuft) {
    return {
      laeuft: false, sperre: 'daten-laufen',
      grund: 'Es läuft gerade eine Datenaktualisierung — der Nachlauf würde einen überholten Stand einbetten.',
    };
  }
  if (lage.lokalCount === 0) {
    return {
      laeuft: false, sperre: 'korpus-leer',
      grund: 'Lokal liegt kein Korpus — der erste Aufbau ist Handarbeit, kein Nachlauf.',
    };
  }
  if (!lage.raumAktuell) {
    return {
      laeuft: false, sperre: 'fremder-raum',
      grund: 'Der lokale Korpus stammt aus einer anderen Textfassung — „nachziehen" wäre ein voller Neuaufbau und bleibt Handarbeit.',
    };
  }
  if (lage.zuEmbedden === 0) {
    return { laeuft: false, sperre: 'nichts-zu-tun', grund: 'Alle Vorhaben haben einen Vektor zu ihrem aktuellen Text.' };
  }
  if (!lage.lockFrei) {
    return { laeuft: false, sperre: 'lock-belegt', grund: 'Ein anderer Rechner baut gerade — der Nachlauf wartet auf den nächsten Start.' };
  }
  return {
    laeuft: true,
    grund: `${lage.zuEmbedden.toLocaleString('de-DE')} Vorhaben haben keinen oder einen überholten Vektor — sie werden nachgezogen.`,
  };
}

/** Die Lock-Stufe des Korpus-Baus — dieselbe wie beim Handlauf. */
export const LOCK_STUFE_KORPUS = 'auslastung-corpus-build';

export interface NachlaufKontext {
  storage: StorageService;
  programmId: string | null;
  online: boolean;
  darfSchreiben: boolean;
  datenUpdateLaeuft: boolean;
  profilName?: string;
  onProgress?: (done: number, total: number) => void;
}

export interface NachlaufErgebnis {
  urteil: NachlaufUrteil;
  /** Wie viele Vektoren tatsaechlich neu entstanden sind. */
  eingebettet: number;
  /** Ist der Korpus danach beim Team angekommen? */
  hochgeladen: boolean;
  fehler?: string;
}

/**
 * Die Lage erheben und — wenn sie es hergibt — nachziehen.
 *
 * Die Erhebung ist bewusst NICHT billig (eine Cursor-Passage ueber den Bestand,
 * ~14 k Records ohne Modell). Deshalb ruft der Aufrufer sie nur, wenn der
 * Schalter an ist: die Kosten landen auf dem Rechner, der sich dafuer gemeldet
 * hat, nicht auf jedem.
 */
export async function fuehreNachlaufAus(ctx: NachlaufKontext): Promise<NachlaufErgebnis> {
  const { storage, programmId } = ctx;
  const idb = storage.idb;

  const an = await istNachlaufAn(idb);
  // Reihenfolge: erst die billigen Bedingungen, dann die Bestandsaufnahme.
  // Wer den Schalter aus hat, soll dafuer keine Cursor-Passage bezahlen.
  const vorab = pruefeNachlauf({
    an,
    online: ctx.online,
    darfSchreiben: ctx.darfSchreiben,
    datenUpdateLaeuft: ctx.datenUpdateLaeuft,
    lokalCount: 1, raumAktuell: true, zuEmbedden: 1, lockFrei: true,
  });
  if (!vorab.laeuft) return { urteil: vorab, eingebettet: 0, hochgeladen: false };

  const lokalCount = await countEmbeddings(idb);
  const modellId = await getActiveModelId(idb);
  const aktiv = aktuelleKorpusSignatur(getModelById(modellId));
  const lokalSignatur = await ladeKorpusSignatur(idb);
  const bestand = await ermittleKorpusBestand(idb, programmId);

  const lage: NachlaufLage = {
    an: true,
    online: ctx.online,
    darfSchreiben: ctx.darfSchreiben,
    datenUpdateLaeuft: ctx.datenUpdateLaeuft,
    lokalCount,
    raumAktuell: lokalSignatur !== null && signaturenGleich(lokalSignatur, aktiv),
    zuEmbedden: bestand.zuEmbedden.length,
    lockFrei: true, // wird gleich beim Acquire entschieden
  };
  const urteil = pruefeNachlauf(lage);
  if (!urteil.laeuft) return { urteil, eingebettet: 0, hochgeladen: false };

  const lock = await acquireBuildLock(idb, LOCK_STUFE_KORPUS);
  if (!lock.acquired) {
    return {
      urteil: pruefeNachlauf({ ...lage, lockFrei: false }),
      eingebettet: 0, hochgeladen: false,
    };
  }

  let eingebettet = 0;
  let hochgeladen = false;
  let fehler: string | undefined;
  try {
    // Volle Records nur fuer den Lauf — die Texte liegen nicht im Slim-Cache.
    const antraege = programmId ? await listAntraegeByProgramm(idb, programmId) : [];
    const erg = await buildEmbeddingCorpus(idb, antraege, {
      incremental: true,
      programmId,
      onProgress: p => ctx.onProgress?.(p.done, p.total),
    });
    eingebettet = erg.done - erg.skipped;
    await heartbeat(idb).catch(() => undefined);
    bumpAuslastungCorpusSignal();

    // Ohne Upload bliebe das Ergebnis auf diesem Rechner — der halbe Zweck.
    await useEmbeddingCorpusMirror.getState().uploadFromIdb(
      storage, aktiv.modellId, aktiv.dim, ctx.profilName, { skipLock: true },
    );
    hochgeladen = true;
    await merkeNachlaufStand(idb, new Date().toISOString());
    await logAudit(idb, {
      action: 'korpus_nachlauf',
      user: ctx.profilName,
      details: { eingebettet, zuEmbedden: bestand.zuEmbedden.length, programmId },
    }).catch(() => undefined);
  } catch (err) {
    fehler = err instanceof Error ? err.message : String(err);
    console.warn('[korpus-nachlauf] fehlgeschlagen:', err);
  } finally {
    await releaseLock(idb).catch(() => undefined);
  }

  return { urteil, eingebettet, hochgeladen, fehler };
}
