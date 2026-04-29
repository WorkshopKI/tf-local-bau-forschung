#!/usr/bin/env node
/**
 * DMS-CSV-Vorfilter (Phase 2).
 *
 * Liest die ~5M-Zeilen DMS-Export-CSV streaming, behält nur Zeilen, deren
 * `Bezeichnung`-Spalte ein erlaubtes FKZ-Präfix enthält, und schreibt eine
 * gefilterte CSV mit zusätzlicher Spalte `extracted_fkz`.
 *
 * Aufruf:
 *   node scripts/filter-dms-csv.mjs <input.csv> <output.csv> [--prefixes 16EP,16KN,16DS,16DL]
 *
 * Encoding: erkennt UTF-8 vs. windows-1252 anhand der ersten 4 KB.
 * CSV-Format: Semikolon-Trenner, optional gequoted, keine Multi-Line-Felder.
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { argv, exit, stdout } from 'node:process';

const DEFAULT_PREFIXES = ['16EP', '16KN', '16DS', '16DL'];

const COLOR = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function log(msg, color = COLOR.reset) {
  stdout.write(color + msg + COLOR.reset + '\n');
}

function parseArgs(args) {
  const positional = [];
  let prefixes = DEFAULT_PREFIXES.slice();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--prefixes' && args[i + 1]) {
      prefixes = args[i + 1].split(',').map(s => s.trim()).filter(Boolean);
      i++;
    } else if (a.startsWith('--prefixes=')) {
      prefixes = a.slice('--prefixes='.length).split(',').map(s => s.trim()).filter(Boolean);
    } else if (a === '--help' || a === '-h') {
      printHelp();
      exit(0);
    } else {
      positional.push(a);
    }
  }
  for (const p of prefixes) {
    if (!/^\d{2}[A-Z]{2}$/.test(p)) {
      log(`Ungültiges Präfix "${p}" — Format: 2 Ziffern + 2 Großbuchstaben (z.B. 16KN)`, COLOR.red);
      exit(2);
    }
  }
  return { positional, prefixes };
}

function printHelp() {
  log('DMS-CSV-Vorfilter — Phase 2', COLOR.bold);
  log('');
  log('Aufruf:');
  log('  node scripts/filter-dms-csv.mjs <input.csv> <output.csv> [--prefixes 16EP,16KN,16DS,16DL]');
  log('');
  log('Behält nur Zeilen mit FKZ-Treffer in der Bezeichnung-Spalte und schreibt');
  log('eine zusätzliche Spalte extracted_fkz vor das ID-Feld.');
}

/**
 * Encoding-Detection auf den ersten 4096 Bytes:
 * - 0xEF 0xBB 0xBF → UTF-8 mit BOM
 * - Bytes 0x80–0xFF, die als UTF-8-Multibyte ungültig sind → wahrscheinlich windows-1252
 * - sonst → UTF-8
 */
function detectEncoding(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { encoding: 'utf-8', bomLen: 3 };
  }
  // Versuch UTF-8-Decoding mit fatal=true. Schlägt das fehl → cp1252.
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return { encoding: 'utf-8', bomLen: 0 };
  } catch {
    return { encoding: 'windows-1252', bomLen: 0 };
  }
}

/**
 * Parser für eine einzelne CSV-Zeile, Semikolon-getrennt, optional gequoted.
 * Annahme: keine eingebetteten Newlines. Doppelte Anführungszeichen innerhalb
 * eines gequoteten Feldes werden zu einem einzelnen `"`.
 */
function parseCsvLine(line, sep = ';') {
  const out = [];
  let i = 0;
  const n = line.length;
  while (i <= n) {
    let field = '';
    if (i < n && line[i] === '"') {
      // gequotetes Feld
      i++;
      while (i < n) {
        const c = line[i];
        if (c === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += c;
          i++;
        }
      }
      // Folgende Zeichen bis zum nächsten Separator schlucken (sollte leer sein)
      while (i < n && line[i] !== sep) i++;
    } else {
      while (i < n && line[i] !== sep) {
        field += line[i];
        i++;
      }
    }
    out.push(field);
    if (i < n && line[i] === sep) {
      i++;
      if (i === n) {
        // trailing separator → leeres Feld
        out.push('');
        break;
      }
    } else {
      break;
    }
  }
  return out;
}

function escapeCsvField(value, sep = ';') {
  if (value == null) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(sep) || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function main() {
  const args = argv.slice(2);
  const { positional, prefixes } = parseArgs(args);
  if (positional.length < 2) {
    printHelp();
    exit(1);
  }
  const [inputPath, outputPath] = positional;

  const inputStat = await stat(inputPath).catch(() => null);
  if (!inputStat || !inputStat.isFile()) {
    log(`Eingabe nicht gefunden: ${inputPath}`, COLOR.red);
    exit(2);
  }

  // Encoding detect
  const headBuf = await readHead(inputPath, 4096);
  const enc = detectEncoding(headBuf);
  log(`Encoding: ${enc.encoding}`, COLOR.gray);

  // \b funktioniert nicht zwischen \w und `_` — und FKZs sind im DMS-Export
  // typischerweise von `_` umrahmt. Stattdessen: nicht von einer Ziffer
  // gefolgt (verhindert dass 16KN0849351 fälschlich als 16KN084935 matcht).
  const fkzPattern = new RegExp(`(${prefixes.join('|')})\\d{6}(?!\\d)`);

  const decoder = new TextDecoder(enc.encoding);
  const stream = createReadStream(inputPath, { highWaterMark: 64 * 1024 });
  const out = createWriteStream(outputPath, { encoding: 'utf-8' });

  let leftover = '';
  let firstChunk = true;
  let header = null;
  let bezIdx = -1;
  let aktenplanIdx = -1;
  let vonIdx = -1;

  let rowsTotal = 0;
  let rowsKept = 0;
  let rowsDropped = 0;
  const perPrefix = Object.fromEntries(prefixes.map(p => [p, 0]));
  const aktenplanCounts = new Map();
  const vonCounts = new Map();

  for await (const chunk of stream) {
    let buf = chunk;
    if (firstChunk && enc.bomLen > 0) {
      buf = buf.slice(enc.bomLen);
      firstChunk = false;
    } else if (firstChunk) {
      firstChunk = false;
    }
    const text = leftover + decoder.decode(buf, { stream: true });
    const lines = text.split(/\r?\n/);
    leftover = lines.pop() ?? '';
    for (const line of lines) {
      if (line.length === 0) continue;
      if (header === null) {
        header = parseCsvLine(line, ';');
        bezIdx = header.findIndex(h => h.trim().toLowerCase() === 'bezeichnung');
        aktenplanIdx = header.findIndex(h => h.trim().toLowerCase() === 'aktenplanzuordnung');
        vonIdx = header.findIndex(h => h.trim().toLowerCase() === 'von');
        if (bezIdx < 0) {
          log('Header enthält keine "Bezeichnung"-Spalte — Abbruch.', COLOR.red);
          exit(3);
        }
        // Schreibe Header mit Zusatzspalte extracted_fkz hinten dran
        const newHeader = [...header, 'extracted_fkz'];
        out.write(newHeader.map(f => escapeCsvField(f, ';')).join(';') + '\n');
        continue;
      }
      rowsTotal++;
      const fields = parseCsvLine(line, ';');
      const bez = fields[bezIdx] ?? '';
      const m = fkzPattern.exec(bez);
      if (!m) {
        rowsDropped++;
        continue;
      }
      const fkz = m[0];
      const prefix = m[1];
      perPrefix[prefix] = (perPrefix[prefix] ?? 0) + 1;
      rowsKept++;

      if (aktenplanIdx >= 0) {
        const v = (fields[aktenplanIdx] ?? '').trim();
        if (v) aktenplanCounts.set(v, (aktenplanCounts.get(v) ?? 0) + 1);
      }
      if (vonIdx >= 0) {
        const v = (fields[vonIdx] ?? '').trim();
        if (v) vonCounts.set(v, (vonCounts.get(v) ?? 0) + 1);
      }

      const newFields = [...fields, fkz];
      out.write(newFields.map(f => escapeCsvField(f, ';')).join(';') + '\n');
    }
  }
  // Finalen leftover (falls Datei ohne Newline endet) verarbeiten
  if (leftover.length > 0 && header !== null) {
    rowsTotal++;
    const fields = parseCsvLine(leftover, ';');
    const bez = fields[bezIdx] ?? '';
    const m = fkzPattern.exec(bez);
    if (m) {
      const fkz = m[0];
      const prefix = m[1];
      perPrefix[prefix] = (perPrefix[prefix] ?? 0) + 1;
      rowsKept++;
      if (aktenplanIdx >= 0) {
        const v = (fields[aktenplanIdx] ?? '').trim();
        if (v) aktenplanCounts.set(v, (aktenplanCounts.get(v) ?? 0) + 1);
      }
      if (vonIdx >= 0) {
        const v = (fields[vonIdx] ?? '').trim();
        if (v) vonCounts.set(v, (vonCounts.get(v) ?? 0) + 1);
      }
      out.write([...fields, fkz].map(f => escapeCsvField(f, ';')).join(';') + '\n');
    } else {
      rowsDropped++;
    }
  }

  await new Promise(resolve => out.end(resolve));

  // Summary
  log('');
  log('=== Summary ===', COLOR.bold);
  log(`rows_total: ${rowsTotal}`);
  log(`rows_kept:  ${rowsKept}`, COLOR.green);
  log(`rows_dropped: ${rowsDropped}`, COLOR.gray);
  log('per_prefix:');
  for (const p of prefixes) {
    log(`  ${p}: ${perPrefix[p] ?? 0}`);
  }
  log('top_aktenplan:');
  topN(aktenplanCounts, 20).forEach(([k, v]) => log(`  ${v.toString().padStart(6, ' ')}  ${k}`));
  log('top_von:');
  topN(vonCounts, 20).forEach(([k, v]) => log(`  ${v.toString().padStart(6, ' ')}  ${k}`));

  log('');
  log(`Output geschrieben: ${outputPath}`, COLOR.green);
}

function topN(map, n) {
  const arr = [...map.entries()];
  arr.sort((a, b) => b[1] - a[1]);
  return arr.slice(0, n);
}

async function readHead(path, bytes) {
  const fd = await import('node:fs/promises').then(m => m.open(path, 'r'));
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fd.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fd.close();
  }
}

main().catch(err => {
  log(String(err.stack ?? err), COLOR.red);
  exit(1);
});
