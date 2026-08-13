/**
 * Migration von Legacy-Struktur (v1.8-Test-Setup) zu v1.9.
 *
 * Legacy:                           Neu:
 *   programm-test/csv-sources/*  →  programm/antraege/imports/*
 *   programm-test/csv-schemas/*  →  programm/schemas/*
 *   programm-test/index/*        →  programm/index/*
 *   programm-test/vorgaenge/*    →  programm/antraege/*
 *   programm-test/admin/*.enc    →  _intern/kurator-config.enc (renamed)
 *   programm-test/admin/*.jsonl  →  _intern/audit-log.jsonl
 *   programm-test/admin/*.json   →  _intern/build-lock.json
 *   programm-test/admin/admin-name-*.txt → _intern/kurator-name-*.txt
 *   programm-test/dokumente/*    →  GELÖSCHT (Dokumentenquelle wird separater Handle)
 *   feedback/feedback.json       →  _intern/feedback/feedback.json
 *   feedback/system-prompt.md    →  _intern/feedback/system-prompt.md
 *   backups/programm-test/*      →  backups/* (ein Level flacher)
 *   EVAL_REPORT.md               →  GELÖSCHT (gehört ins Repo)
 */

import { ensureReadme, getInternHandle } from './smb-handle';
import { logAudit } from './audit-log';
import type { FolderValidationResult } from './types';

async function listKinds(parent: FileSystemDirectoryHandle): Promise<{ dirs: string[]; files: string[] }> {
  const dirs: string[] = [];
  const files: string[] = [];
  for await (const entry of (parent as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind === 'directory') dirs.push(entry.name);
    else files.push(entry.name);
  }
  return { dirs, files };
}

async function countFilesRecursive(dir: FileSystemDirectoryHandle): Promise<number> {
  let count = 0;
  for await (const entry of (dir as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind === 'file') count += 1;
    else if (entry.kind === 'directory') count += await countFilesRecursive(entry as FileSystemDirectoryHandle);
  }
  return count;
}

/**
 * Klassifiziert den vom User gewählten Ordner anhand sichtbarer Marker.
 */
export async function validateSelectedFolder(folder: FileSystemDirectoryHandle): Promise<FolderValidationResult> {
  const { dirs, files } = await listKinds(folder);
  const has = (name: string): boolean => dirs.includes(name) || files.includes(name);

  // Fall D: User ist in einen TeamFlow-Subordner navigiert.
  if (has('imports') && dirs.includes('imports') && (has('antraege') === false && has('schemas') === false)) {
    // Unklarer Indikator; nur strenge Marker verwenden.
  }
  if (has('kurator-config.enc') || has('audit-log.jsonl') || has('build-lock.json')) {
    return { kind: 'subfolder', detected: 'intern' };
  }
  if ((has('antraege') || has('schemas') || has('index')) && !has('programm') && !has('_intern')) {
    return { kind: 'subfolder', detected: 'programm' };
  }
  if (has('csv-sources') || has('csv-schemas') || has('admin') || has('vorgaenge')) {
    if (!has('programm-test') && !has('programm')) {
      return { kind: 'subfolder', detected: 'legacy-programm-test' };
    }
  }

  const hasLegacyProgramm = has('programm-test');
  const hasLegacyFeedback = has('feedback');
  const hasLegacyBackupWrapper = has('backups') && dirs.includes('backups');
  const hasNewProgramm = has('programm');
  const hasNewIntern = has('_intern');

  if (hasNewProgramm && hasNewIntern) {
    return { kind: 'current' };
  }

  if (hasLegacyProgramm || hasLegacyFeedback) {
    let legacyFilesCount = 0;
    let dokumenteFileCount = 0;
    if (hasLegacyProgramm) {
      const legacy = await folder.getDirectoryHandle('programm-test').catch(() => null);
      if (legacy) {
        const dok = await legacy.getDirectoryHandle('dokumente').catch(() => null);
        if (dok) dokumenteFileCount = await countFilesRecursive(dok);
        // Andere zu migrierende Dateien zählen
        for (const sub of ['csv-sources', 'csv-schemas', 'index', 'admin', 'vorgaenge']) {
          const s = await legacy.getDirectoryHandle(sub).catch(() => null);
          if (s) legacyFilesCount += await countFilesRecursive(s);
        }
      }
    }
    if (hasLegacyFeedback) {
      const fb = await folder.getDirectoryHandle('feedback').catch(() => null);
      if (fb) legacyFilesCount += await countFilesRecursive(fb);
    }
    if (hasLegacyBackupWrapper) {
      const backups = await folder.getDirectoryHandle('backups').catch(() => null);
      if (backups) {
        const oldWrapper = await backups.getDirectoryHandle('programm-test').catch(() => null);
        if (oldWrapper) legacyFilesCount += await countFilesRecursive(oldWrapper);
      }
    }
    return { kind: 'legacy', legacyFilesCount, dokumenteFileCount };
  }

  return { kind: 'empty' };
}

interface MoveStat { moved: number; errors: string[] }

async function moveAllInto(
  source: FileSystemDirectoryHandle,
  target: FileSystemDirectoryHandle,
  stat: MoveStat,
): Promise<void> {
  for await (const entry of (source as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    try {
      if (entry.kind === 'file') {
        const src = await source.getFileHandle(entry.name);
        const f = await src.getFile();
        const dst = await target.getFileHandle(entry.name, { create: true });
        const w = await dst.createWritable();
        await w.write(f);
        await w.close();
        await source.removeEntry(entry.name);
        stat.moved += 1;
      } else if (entry.kind === 'directory') {
        const srcDir = entry as FileSystemDirectoryHandle;
        const dstDir = await target.getDirectoryHandle(entry.name, { create: true });
        await moveAllInto(srcDir, dstDir, stat);
        // Source-Ordner ist nach dem Merge leer → entfernen
        try { await source.removeEntry(entry.name, { recursive: true }); } catch { /* ignore */ }
      }
    } catch (err) {
      stat.errors.push(`${entry.name}: ${(err as Error).message}`);
    }
  }
}

export interface MigrationResult {
  filesMoved: number;
  filesDeleted: number;
  foldersRemoved: string[];
  errors: string[];
}

/**
 * Verschiebt einen Ordner und räumt die Quelle **nur dann** ab, wenn dabei kein
 * einziger Eintrag liegen geblieben ist (v4.12).
 *
 * `moveAllInto` fängt pro Datei ab, sammelt die Meldung in `stat.errors` und
 * läuft weiter — es liefert keinen Erfolgsstatus. Das anschließende
 * `removeEntry(..., { recursive: true })` nahm die nicht kopierten Dateien
 * deshalb mit: sie waren danach an beiden Orten weg. Ausgewertet wurden die
 * Fehler erst ganz am Ende der Migration, lange nach dem Löschen — der Nutzer
 * sah „teilweise fehlgeschlagen", als nichts mehr zu retten war.
 */
async function verschiebeUndRaeumeAb(
  quelleParent: FileSystemDirectoryHandle,
  ordnerName: string,
  quelle: FileSystemDirectoryHandle,
  ziel: FileSystemDirectoryHandle,
  label: string,
  moveStat: MoveStat,
  result: MigrationResult,
): Promise<void> {
  const fehlerVorher = moveStat.errors.length;
  await moveAllInto(quelle, ziel, moveStat);
  const neueFehler = moveStat.errors.length - fehlerVorher;
  if (neueFehler > 0) {
    result.errors.push(
      `${label}: ${neueFehler} Eintrag/Einträge nicht verschiebbar — Quellordner bleibt `
      + `erhalten, es wurde nichts gelöscht.`,
    );
    return;
  }
  try {
    await quelleParent.removeEntry(ordnerName, { recursive: true });
    result.foldersRemoved.push(label);
  } catch (err) {
    result.errors.push(`remove ${ordnerName}: ${(err as Error).message}`);
  }
}

/**
 * Führt die Legacy→v1.9-Migration durch. Idempotent: prüft Zielpfade vor jedem Schritt.
 * Schreibt Audit-Eintrag `kurator_structure_migrated` mit Statistik.
 */
export async function migrateLegacyStructure(
  idb: import('@/core/services/storage/idb-store').IDBStore,
  parent: FileSystemDirectoryHandle,
): Promise<MigrationResult> {
  const result: MigrationResult = { filesMoved: 0, filesDeleted: 0, foldersRemoved: [], errors: [] };
  const moveStat: MoveStat = { moved: 0, errors: [] };

  // Sicherheit: Zielordner anlegen.
  const intern = await getInternHandle(parent);
  const internFeedback = await intern.getDirectoryHandle('feedback', { create: true });
  const programm = await parent.getDirectoryHandle('programm', { create: true });
  const antraege = await programm.getDirectoryHandle('antraege', { create: true });
  const antraegeImports = await antraege.getDirectoryHandle('imports', { create: true });
  const schemas = await programm.getDirectoryHandle('schemas', { create: true });
  const index = await programm.getDirectoryHandle('index', { create: true });

  // 1. programm-test/ verarbeiten
  const legacyProgramm = await parent.getDirectoryHandle('programm-test').catch(() => null);
  if (legacyProgramm) {
    const legacyCsvSources = await legacyProgramm.getDirectoryHandle('csv-sources').catch(() => null);
    if (legacyCsvSources) {
      await verschiebeUndRaeumeAb(legacyProgramm, 'csv-sources', legacyCsvSources, antraegeImports,
        'programm-test/csv-sources', moveStat, result);
    }
    const legacyCsvSchemas = await legacyProgramm.getDirectoryHandle('csv-schemas').catch(() => null);
    if (legacyCsvSchemas) {
      await verschiebeUndRaeumeAb(legacyProgramm, 'csv-schemas', legacyCsvSchemas, schemas,
        'programm-test/csv-schemas', moveStat, result);
    }
    const legacyIndex = await legacyProgramm.getDirectoryHandle('index').catch(() => null);
    if (legacyIndex) {
      await verschiebeUndRaeumeAb(legacyProgramm, 'index', legacyIndex, index,
        'programm-test/index', moveStat, result);
    }
    const legacyVorgaenge = await legacyProgramm.getDirectoryHandle('vorgaenge').catch(() => null);
    if (legacyVorgaenge) {
      await verschiebeUndRaeumeAb(legacyProgramm, 'vorgaenge', legacyVorgaenge, antraege,
        'programm-test/vorgaenge', moveStat, result);
    }
    // admin/ → _intern/ (mit Datei-Umbenennung)
    const legacyAdmin = await legacyProgramm.getDirectoryHandle('admin').catch(() => null);
    if (legacyAdmin) {
      // admin-config.enc → kurator-config.enc (rename + move)
      const cfg = await legacyAdmin.getFileHandle('admin-config.enc').catch(() => null);
      if (cfg) {
        try {
          const f = await cfg.getFile();
          const dst = await intern.getFileHandle('kurator-config.enc', { create: true });
          const w = await dst.createWritable();
          await w.write(f);
          await w.close();
          await legacyAdmin.removeEntry('admin-config.enc');
          moveStat.moved += 1;
        } catch (err) { result.errors.push(`admin-config.enc: ${(err as Error).message}`); }
      }
      // audit-log.jsonl (append-based merge)
      const audit = await legacyAdmin.getFileHandle('audit-log.jsonl').catch(() => null);
      if (audit) {
        try {
          const f = await audit.getFile();
          const content = await f.text();
          const dst = await intern.getFileHandle('audit-log.jsonl', { create: true });
          const existing = await (await dst.getFile()).text().catch(() => '');
          const w = await dst.createWritable();
          const sep = existing && !existing.endsWith('\n') ? '\n' : '';
          await w.write(existing + sep + content);
          await w.close();
          await legacyAdmin.removeEntry('audit-log.jsonl');
          moveStat.moved += 1;
        } catch (err) { result.errors.push(`audit-log.jsonl: ${(err as Error).message}`); }
      }
      // build-lock.json, heartbeat-probe
      for (const fname of ['build-lock.json', 'heartbeat-probe']) {
        const fh = await legacyAdmin.getFileHandle(fname).catch(() => null);
        if (!fh) continue;
        try {
          const f = await fh.getFile();
          const dst = await intern.getFileHandle(fname, { create: true });
          const w = await dst.createWritable();
          await w.write(f);
          await w.close();
          await legacyAdmin.removeEntry(fname);
          moveStat.moved += 1;
        } catch (err) { result.errors.push(`${fname}: ${(err as Error).message}`); }
      }
      // admin-name-*.txt → kurator-name-*.txt (in _intern/)
      for await (const entry of (legacyAdmin as FileSystemDirectoryHandle & {
        values(): AsyncIterableIterator<FileSystemHandle>;
      }).values()) {
        if (entry.kind !== 'file' || !entry.name.startsWith('admin-name-')) continue;
        try {
          const src = await legacyAdmin.getFileHandle(entry.name);
          const f = await src.getFile();
          const newName = 'kurator-name-' + entry.name.slice('admin-name-'.length);
          const dst = await intern.getFileHandle(newName, { create: true });
          const w = await dst.createWritable();
          await w.write(f);
          await w.close();
          await legacyAdmin.removeEntry(entry.name);
          moveStat.moved += 1;
        } catch (err) { result.errors.push(`${entry.name}: ${(err as Error).message}`); }
      }
      try { await legacyProgramm.removeEntry('admin', { recursive: true }); result.foldersRemoved.push('programm-test/admin'); }
      catch (err) { result.errors.push(`remove admin: ${(err as Error).message}`); }
    }
    // dokumente/ gelöscht (separater Handle später)
    const legacyDokumente = await legacyProgramm.getDirectoryHandle('dokumente').catch(() => null);
    if (legacyDokumente) {
      const count = await countFilesRecursive(legacyDokumente);
      result.filesDeleted += count;
      try { await legacyProgramm.removeEntry('dokumente', { recursive: true }); result.foldersRemoved.push('programm-test/dokumente'); }
      catch (err) { result.errors.push(`remove dokumente: ${(err as Error).message}`); }
    }
    // programm-test/ jetzt löschen — aber nur, wenn wirklich alles umgezogen ist.
    // Der alte Kommentar lautete „sollte leer sein"; geprüft wurde das nie, und
    // ein rekursives Löschen hätte jeden liegen gebliebenen Rest mitgenommen.
    if (moveStat.errors.length === 0) {
      try { await parent.removeEntry('programm-test', { recursive: true }); result.foldersRemoved.push('programm-test/'); }
      catch (err) { result.errors.push(`remove programm-test: ${(err as Error).message}`); }
    } else {
      result.errors.push('programm-test/ bleibt erhalten — nicht alles konnte umgezogen werden.');
    }
  }

  // 2. feedback/ → _intern/feedback/
  const legacyFeedback = await parent.getDirectoryHandle('feedback').catch(() => null);
  if (legacyFeedback) {
    await verschiebeUndRaeumeAb(parent, 'feedback', legacyFeedback, internFeedback,
      'feedback/', moveStat, result);
  }

  // 3. backups/programm-test/* → backups/*
  const backups = await parent.getDirectoryHandle('backups').catch(() => null);
  if (backups) {
    const wrapper = await backups.getDirectoryHandle('programm-test').catch(() => null);
    if (wrapper) {
      await verschiebeUndRaeumeAb(backups, 'programm-test', wrapper, backups,
        'backups/programm-test', moveStat, result);
    }
  }

  // 4. EVAL_REPORT.md löschen (gehört ins Repo)
  try { await parent.removeEntry('EVAL_REPORT.md'); result.filesDeleted += 1; } catch { /* existiert nicht */ }

  // 5. README.txt anlegen falls fehlt
  await ensureReadme(parent);

  result.filesMoved = moveStat.moved;
  result.errors.push(...moveStat.errors);

  await logAudit(idb, {
    action: 'kurator_structure_migrated',
    details: {
      filesMoved: result.filesMoved,
      filesDeleted: result.filesDeleted,
      foldersRemoved: result.foldersRemoved,
      errorsCount: result.errors.length,
    },
  });
  return result;
}

export { countFilesRecursive };
