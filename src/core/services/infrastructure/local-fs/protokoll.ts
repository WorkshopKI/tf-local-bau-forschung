/**
 * Gemeinsames Protokoll der local-fs-Brücke — die einzige Wahrheit über
 * Endpunkte, Query-Parameter, Header und Fehler-Übersetzung.
 *
 * **ZERO-IMPORT wie `pfad-segmente.ts`**: beide Seiten der Brücke importieren
 * dieses Modul — der Client-Adapter im Browser und der Node-Handler unter
 * `scripts/local-fs/`, der über `vite.config.ts` von esbuild gebündelt wird.
 *
 * Warum ein eigenes Modul statt String-Literale auf beiden Seiten: Client und
 * Server müssen sich über Fehler-Semantik einig sein. Der Infrastructure-Layer
 * verlässt sich fast überall auf den WURF, nicht auf `null`
 * (`atomic-write.ts` `exists()` fängt `getFileHandle` ab, `csv-source-handle.ts`
 * unterscheidet `NotFoundError` von echten Fehlern). Ein falsch gemappter Status
 * äußert sich deshalb nicht als Fehlermeldung, sondern als stilles Fehlverhalten.
 */

/** URL-Präfix aller Brücken-Endpunkte. Bewusst unwahrscheinlich als echter Pfad. */
export const LOCAL_FS_PREFIX = '/__tf-local-fs';

/** Response-Header mit Datei-Metadaten (`getFile()` braucht sie für `File`). */
export const HEADER_NAME = 'x-tf-name';
export const HEADER_LAST_MODIFIED = 'x-tf-last-modified';
/** Fehler-Code im Response-Header — robuster als Body-Parsing bei HEAD/Streams. */
export const HEADER_FEHLER = 'x-tf-fehler';

/** Alle Operationen der Brücke. */
export type LocalFsOperation =
  | 'roots'
  | 'stat'
  | 'list'
  | 'read'
  | 'write'
  | 'truncate'
  | 'mkdir'
  | 'remove'
  | 'move';

/** Operationen, die den Zustand ändern (POST); alle übrigen sind GET. */
const SCHREIB_OPERATIONEN = new Set<LocalFsOperation>([
  'write', 'truncate', 'mkdir', 'remove', 'move',
]);

export function istSchreibOperation(op: LocalFsOperation): boolean {
  return SCHREIB_OPERATIONEN.has(op);
}

/**
 * Domänen-Fehlercodes. Bewusst NICHT die DOMException-Namen: der Server denkt in
 * Dateisystem-Zuständen, der Client übersetzt sie an genau einer Stelle
 * (`fehlerNachDomName`) in die Namen, die der App-Code erwartet.
 */
export type LocalFsFehler =
  | 'nicht-gefunden'
  | 'falsche-art'
  | 'nicht-leer'
  | 'ungueltiger-pfad'
  | 'unbekannter-slot'
  | 'io-fehler';

const FEHLER_ZU_STATUS: Record<LocalFsFehler, number> = {
  'nicht-gefunden': 404,
  'falsche-art': 409,
  'nicht-leer': 409,
  'ungueltiger-pfad': 400,
  'unbekannter-slot': 400,
  'io-fehler': 500,
};

/**
 * DOMException-Namen, die der App-Code erwartet.
 *
 * - `NotFoundError` — `getFileHandle` ohne `{create:true}` auf Fehlendes. Trägt
 *   die halbe Steuerlogik: `atomic-write.ts` `exists()` und `readText()` bauen
 *   ihr Verhalten darauf.
 * - `TypeMismatchError` — Datei statt Verzeichnis (oder umgekehrt).
 * - `InvalidModificationError` — `removeEntry` auf nicht-leerem Verzeichnis ohne
 *   `{recursive:true}`.
 * - `NotReadableError` — echter I/O-/Transportfehler. Bewusst NICHT
 *   `NotFoundError`, sonst schlucken die `catch`-Zweige einen kaputten Server
 *   als „Datei gibt es halt nicht".
 */
const FEHLER_ZU_DOM_NAME: Record<LocalFsFehler, string> = {
  'nicht-gefunden': 'NotFoundError',
  'falsche-art': 'TypeMismatchError',
  'nicht-leer': 'InvalidModificationError',
  'ungueltiger-pfad': 'TypeError',
  'unbekannter-slot': 'TypeError',
  'io-fehler': 'NotReadableError',
};

export function statusFuerFehler(fehler: LocalFsFehler): number {
  return FEHLER_ZU_STATUS[fehler];
}

export function domNameFuerFehler(fehler: LocalFsFehler): string {
  return FEHLER_ZU_DOM_NAME[fehler];
}

/** Ist der String ein bekannter Fehlercode? (Header-Werte sind ungeprüfte Eingabe.) */
export function istLocalFsFehler(wert: string | null | undefined): wert is LocalFsFehler {
  return typeof wert === 'string' && wert in FEHLER_ZU_STATUS;
}

/**
 * Übersetzt eine Server-Antwort in den DOMException-Namen für den Client.
 * Fällt ohne (oder mit unbekanntem) Fehler-Header auf den Status zurück, damit
 * auch ein Proxy-/Vite-Fehler sinnvoll ankommt statt als `undefined`.
 */
export function domNameFuerAntwort(status: number, fehlerHeader: string | null): string {
  if (istLocalFsFehler(fehlerHeader)) return domNameFuerFehler(fehlerHeader);
  if (status === 404) return 'NotFoundError';
  if (status === 400) return 'TypeError';
  return 'NotReadableError';
}

export interface AnfrageParameter {
  /** Slot-Name (z.B. `daten-share`) — NIE ein absoluter Pfad. */
  root?: string;
  /** Relativer POSIX-Pfad unterhalb der Slot-Wurzel. */
  path?: string;
  /** `move`: Quell- und Zielpfad. */
  from?: string;
  to?: string;
  /** `write`: an bestehende Datei anhängen statt sie zu ersetzen. */
  keep?: boolean;
  /** `write`: Byte-Offset (nur mit `keep`). `truncate`: neue Länge. */
  position?: number;
  size?: number;
  /** `remove`: Verzeichnis samt Inhalt löschen. */
  recursive?: boolean;
}

/**
 * Baut die URL einer Brücken-Anfrage. Einzige Stelle, die Query-Parameter
 * benennt — der Handler liest sie über `leseParameter` symmetrisch zurück.
 */
export function baueUrl(op: LocalFsOperation, params: AnfrageParameter): string {
  const query = new URLSearchParams();
  if (params.root !== undefined) query.set('root', params.root);
  if (params.path !== undefined) query.set('path', params.path);
  if (params.from !== undefined) query.set('from', params.from);
  if (params.to !== undefined) query.set('to', params.to);
  if (params.keep) query.set('keep', '1');
  if (params.recursive) query.set('recursive', '1');
  if (params.position !== undefined) query.set('position', String(params.position));
  if (params.size !== undefined) query.set('size', String(params.size));
  const qs = query.toString();
  return `${LOCAL_FS_PREFIX}/${op}${qs ? `?${qs}` : ''}`;
}

/**
 * Liest die Parameter aus `URLSearchParams` zurück. `URLSearchParams` dekodiert
 * bereits — hier NICHT zusätzlich `decodeURIComponent` aufrufen, doppelte
 * Dekodierung ist selbst eine Traversal-Lücke (`%252e%252e` → `..`).
 */
export function leseParameter(query: URLSearchParams): AnfrageParameter {
  const zahl = (name: string): number | undefined => {
    const roh = query.get(name);
    if (roh === null) return undefined;
    const n = Number(roh);
    return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
  };
  return {
    root: query.get('root') ?? undefined,
    path: query.get('path') ?? undefined,
    from: query.get('from') ?? undefined,
    to: query.get('to') ?? undefined,
    keep: query.get('keep') === '1',
    recursive: query.get('recursive') === '1',
    position: zahl('position'),
    size: zahl('size'),
  };
}

/** Zerlegt eine Request-URL in Operation + Parameter. `null` = nicht für uns. */
export function leseAnfrage(url: string): { op: LocalFsOperation; params: AnfrageParameter } | null {
  // Basis ist egal — wir brauchen nur Pfad + Query, nie den Host.
  const parsed = new URL(url, 'http://localhost');
  if (!parsed.pathname.startsWith(`${LOCAL_FS_PREFIX}/`)) return null;
  const op = parsed.pathname.slice(LOCAL_FS_PREFIX.length + 1) as LocalFsOperation;
  if (!ALLE_OPERATIONEN.has(op)) return null;
  return { op, params: leseParameter(parsed.searchParams) };
}

const ALLE_OPERATIONEN = new Set<LocalFsOperation>([
  'roots', 'stat', 'list', 'read', 'write', 'truncate', 'mkdir', 'remove', 'move',
]);

/** Eintrag eines Verzeichnis-Listings. */
export interface ListenEintrag {
  name: string;
  kind: 'file' | 'directory';
}

/** Antwort von `/stat`. */
export interface StatAntwort {
  kind: 'file' | 'directory';
  name: string;
  size: number;
  lastModified: number;
}
