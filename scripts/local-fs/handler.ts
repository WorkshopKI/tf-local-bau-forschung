/**
 * Node-Seite der local-fs-Brücke: übersetzt Brücken-Anfragen in `fs`-Operationen.
 *
 * Läuft ausschliesslich im Vite-DEV-Server (`apply: 'serve'`). Jede Operation
 * geht durch `loeseAuf` (Pfad-Guard) und Schreiboperationen zusätzlich durch
 * `inReihe` (Serialisierung pro Pfad).
 *
 * Fehler-Semantik ist load-bearing: der App-Code unterscheidet `NotFoundError`
 * von echten Fehlern und baut Steuerlogik darauf (`atomic-write.ts` `exists()`).
 * Deshalb wird jeder `fs`-Fehlercode bewusst gemappt statt pauschal 500.
 */

import { createReadStream } from 'node:fs';
import * as fsp from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loeseAuf, langpfadTauglich, type SlotTabelle } from './pfad-guard';
import { inReihe } from './schreib-mutex';
import {
  leseAnfrage,
  statusFuerFehler,
  istSchreibOperation,
  HEADER_NAME,
  HEADER_LAST_MODIFIED,
  HEADER_FEHLER,
  type AnfrageParameter,
  type LocalFsFehler,
  type LocalFsOperation,
  type ListenEintrag,
  type StatAntwort,
} from '../../src/core/services/infrastructure/local-fs/protokoll';

/** Fehler mit Domänen-Code — vom Handler geworfen, von `bearbeite` gemappt. */
class BrueckenFehler extends Error {
  constructor(public readonly code: LocalFsFehler, nachricht?: string) {
    super(nachricht ?? code);
  }
}

/**
 * Übersetzt `fs`-Fehlercodes in Domänen-Codes.
 *
 * `EISDIR`/`ENOTDIR` als `falsche-art`: sonst meldete ein Schreibversuch auf ein
 * Verzeichnis „geht nicht" statt „ist ein Verzeichnis", und `atomicWrite`
 * schriebe im schlimmsten Fall über einen Ordner.
 */
function ausFsFehler(err: unknown): BrueckenFehler {
  const code = (err as NodeJS.ErrnoException)?.code;
  switch (code) {
    case 'ENOENT': return new BrueckenFehler('nicht-gefunden', String(err));
    case 'EISDIR':
    case 'ENOTDIR': return new BrueckenFehler('falsche-art', String(err));
    case 'ENOTEMPTY':
    case 'EEXIST': return new BrueckenFehler('nicht-leer', String(err));
    default: return new BrueckenFehler('io-fehler', String(err));
  }
}

/** Löst Slot + Pfad auf oder wirft. Einziger Weg von Anfrage zu absolutem Pfad. */
function aufloesen(slots: SlotTabelle, root: string | undefined, relativ: string | undefined): string {
  if (!root) throw new BrueckenFehler('unbekannter-slot', 'Parameter `root` fehlt');
  const wurzel = slots.wurzeln.get(root);
  if (!wurzel) throw new BrueckenFehler('unbekannter-slot', `Slot "${root}" ist nicht konfiguriert`);
  const res = loeseAuf(wurzel, relativ ?? '');
  if (!res.ok) throw new BrueckenFehler(res.fehler, res.grund);
  return langpfadTauglich(res.absolut);
}

async function leseBody(req: IncomingMessage): Promise<Buffer> {
  const teile: Buffer[] = [];
  for await (const stueck of req) teile.push(stueck as Buffer);
  return Buffer.concat(teile);
}

function sendeJson(res: ServerResponse, daten: unknown): void {
  const body = Buffer.from(JSON.stringify(daten), 'utf-8');
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.length });
  res.end(body);
}

function sendeFehler(res: ServerResponse, code: LocalFsFehler, nachricht: string): void {
  const body = Buffer.from(JSON.stringify({ fehler: code, nachricht }), 'utf-8');
  res.writeHead(statusFuerFehler(code), {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    [HEADER_FEHLER]: code,
  });
  res.end(body);
}

/**
 * Verzeichnis-Listing, eine Ebene.
 *
 * `withFileTypes` vermeidet ein `stat` je Eintrag — bei `programm/antraege/` mit
 * vielen Dateien ist das der Unterschied zwischen einem und n Syscalls. Namen
 * werden NFC-normalisiert, damit der Client sie so wiederfindet, wie er sie
 * anfragt (die Platte kann NFD tragen).
 */
async function liste(absolut: string): Promise<ListenEintrag[]> {
  const eintraege = await fsp.readdir(absolut, { withFileTypes: true });
  const out: ListenEintrag[] = [];
  for (const e of eintraege) {
    // Sockets, FIFOs, Geräte überspringen — die FSAPI kennt nur file/directory.
    if (e.isFile()) out.push({ name: e.name.normalize('NFC'), kind: 'file' });
    else if (e.isDirectory()) out.push({ name: e.name.normalize('NFC'), kind: 'directory' });
  }
  return out;
}

async function stat(absolut: string): Promise<StatAntwort> {
  const s = await fsp.stat(absolut);
  return {
    kind: s.isDirectory() ? 'directory' : 'file',
    name: path.basename(absolut).normalize('NFC'),
    size: s.size,
    lastModified: Math.floor(s.mtimeMs),
  };
}

/** Datei streamen. Kein Buffern — die Kopie enthält CSVs jenseits von 60 MB. */
async function sendeDatei(res: ServerResponse, absolut: string): Promise<void> {
  const s = await fsp.stat(absolut);
  if (s.isDirectory()) throw new BrueckenFehler('falsche-art', 'Pfad ist ein Verzeichnis');
  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': s.size,
    [HEADER_NAME]: encodeURIComponent(path.basename(absolut).normalize('NFC')),
    [HEADER_LAST_MODIFIED]: String(Math.floor(s.mtimeMs)),
  });
  await new Promise<void>((fertig, fehler) => {
    const strom = createReadStream(absolut);
    strom.on('error', fehler);
    strom.on('end', () => fertig());
    strom.pipe(res);
  });
}

/**
 * Datei schreiben.
 *
 * Ohne `keep` (Normalfall): ersetzen, Elternordner anlegen — das entspricht
 * `createWritable()` ohne `keepExistingData`, das die Datei auf 0 kürzt.
 *
 * Mit `keep` + `position`: an eine bestehende Datei an der Byte-Position
 * schreiben, OHNE zu kürzen. Einziger Nutzer ist heute `phase2/triage/run-log.ts`
 * (echtes Append via `keepExistingData` + `position: file.size`).
 */
async function schreibe(absolut: string, daten: Buffer, params: AnfrageParameter): Promise<void> {
  await fsp.mkdir(path.dirname(absolut), { recursive: true });
  if (!params.keep) {
    await fsp.writeFile(absolut, daten);
    return;
  }
  // 'r+' verlangt eine existierende Datei; 'a+' könnte nicht positionieren.
  // Deshalb: anlegen, falls nötig, dann positioniert schreiben.
  let griff: fsp.FileHandle;
  try {
    griff = await fsp.open(absolut, 'r+');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    griff = await fsp.open(absolut, 'w+');
  }
  try {
    await griff.write(daten, 0, daten.length, params.position ?? 0);
  } finally {
    await griff.close();
  }
}

async function entferne(absolut: string, rekursiv: boolean): Promise<void> {
  const s = await fsp.lstat(absolut);
  if (s.isDirectory() && !rekursiv) {
    // FSAPI-Semantik: removeEntry auf nicht-leerem Verzeichnis ohne
    // {recursive:true} wirft InvalidModificationError.
    const inhalt = await fsp.readdir(absolut);
    if (inhalt.length > 0) throw new BrueckenFehler('nicht-leer', 'Verzeichnis ist nicht leer');
    await fsp.rmdir(absolut);
    return;
  }
  await fsp.rm(absolut, { recursive: rekursiv, force: false });
}

/**
 * Führt eine Operation aus. Reine Dispatch-Funktion — der Guard ist in
 * `aufloesen`, die Serialisierung in `bearbeite`.
 */
async function fuehreAus(
  op: LocalFsOperation,
  slots: SlotTabelle,
  params: AnfrageParameter,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  switch (op) {
    case 'roots': {
      const out: Record<string, { name: string }> = {};
      for (const [slot, wurzel] of slots.wurzeln) out[slot] = { name: path.basename(wurzel) };
      sendeJson(res, { slots: out, fehlend: slots.fehlend });
      return;
    }
    case 'stat':
      sendeJson(res, await stat(aufloesen(slots, params.root, params.path)));
      return;
    case 'list':
      sendeJson(res, { entries: await liste(aufloesen(slots, params.root, params.path)) });
      return;
    case 'read':
      await sendeDatei(res, aufloesen(slots, params.root, params.path));
      return;
    case 'write': {
      const ziel = aufloesen(slots, params.root, params.path);
      const daten = await leseBody(req);
      await inReihe(ziel, () => schreibe(ziel, daten, params));
      sendeJson(res, { ok: true, bytes: daten.length });
      return;
    }
    case 'truncate': {
      const ziel = aufloesen(slots, params.root, params.path);
      await inReihe(ziel, () => fsp.truncate(ziel, params.size ?? 0));
      sendeJson(res, { ok: true });
      return;
    }
    case 'mkdir': {
      const ziel = aufloesen(slots, params.root, params.path);
      await inReihe(ziel, () => fsp.mkdir(ziel, { recursive: true }).then(() => undefined));
      sendeJson(res, { ok: true });
      return;
    }
    case 'remove': {
      const ziel = aufloesen(slots, params.root, params.path);
      await inReihe(ziel, () => entferne(ziel, params.recursive === true));
      sendeJson(res, { ok: true });
      return;
    }
    case 'move': {
      const von = aufloesen(slots, params.root, params.from);
      const nach = aufloesen(slots, params.root, params.to);
      // Beide Pfade über DENSELBEN Schlüssel serialisieren, sonst könnte ein
      // paralleler Write auf das Ziel zwischen rename und Antwort schlüpfen.
      await inReihe(von < nach ? von : nach, async () => {
        await fsp.mkdir(path.dirname(nach), { recursive: true });
        await fsp.rename(von, nach);
      });
      sendeJson(res, { ok: true });
      return;
    }
  }
}

/**
 * Middleware-Einstieg. Gibt `true` zurück, wenn die Anfrage bearbeitet wurde
 * (dann darf Vite sie nicht weiterreichen).
 */
export async function bearbeite(
  req: IncomingMessage,
  res: ServerResponse,
  slots: SlotTabelle,
  erlaubterOrigin: string,
): Promise<boolean> {
  const anfrage = leseAnfrage(req.url ?? '');
  if (!anfrage) return false;

  // Nur Loopback. Die Brücke reicht Dateisystem-Zugriff durch — sie darf nie
  // über `--host` im Netz landen.
  const entfernt = req.socket.remoteAddress ?? '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(entfernt)) {
    sendeFehler(res, 'ungueltiger-pfad', `Zugriff nur von localhost (war: ${entfernt})`);
    return true;
  }
  // Fremder Origin = eine andere Seite im selben Browser versucht mitzulesen.
  const origin = req.headers.origin;
  if (origin && origin !== erlaubterOrigin) {
    sendeFehler(res, 'ungueltiger-pfad', `Fremder Origin: ${origin}`);
    return true;
  }

  const methode = (req.method ?? 'GET').toUpperCase();
  const erwartet = istSchreibOperation(anfrage.op) ? 'POST' : 'GET';
  if (methode !== erwartet) {
    sendeFehler(res, 'ungueltiger-pfad', `${anfrage.op} erwartet ${erwartet}, war ${methode}`);
    return true;
  }

  try {
    await fuehreAus(anfrage.op, slots, anfrage.params, req, res);
  } catch (err) {
    const bf = err instanceof BrueckenFehler ? err : ausFsFehler(err);
    if (res.headersSent) {
      // Beim Streamen (read) sind die Header schon raus — nur noch abbrechen.
      res.destroy();
    } else {
      sendeFehler(res, bf.code, bf.message);
    }
  }
  return true;
}
