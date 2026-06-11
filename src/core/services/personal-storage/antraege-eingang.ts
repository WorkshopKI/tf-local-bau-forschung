/**
 * FS-Schreiber für die ZIP-Aufnahme (Teil A) + den VB-Ordner-Fallback (A4).
 * Schreibt AUSSCHLIESSLICH in den persönlichen Ordner (`getPersoenlichHandle`),
 * über `atomicWrite`. Layout-Pfade kommen aus `personal-layout.ts`.
 *
 * Schreib-Profil: alle Dateien `skipBackup: true` — die Wahrheit sind die
 * Quell-ZIPs in `eingang/` (Dokument-MD) bzw. der WorkflowRun in IDB (Gutachten);
 * eine `.backup`-Rotation würde nur die Share-Quota fluten (vgl. Pitfall #23).
 */
import {
  atomicWrite, readText, removeFile, listFilesWithBackupInfo,
} from '@/core/services/infrastructure/atomic-write';
import type { DokumentMeta } from '@/plugins/antraege/aufnahme-einfach/frontmatter';
import { buildMarkdownMitFrontmatter, parseFrontmatter } from '@/plugins/antraege/aufnahme-einfach/frontmatter';
import type { EingangManifest } from '@/plugins/antraege/aufnahme-einfach/manifest';
import {
  dokumentMdPath, dokumenteDir, eingangZipPath, eingangManifestPath, EINGANG_DIR,
} from './personal-layout';

/** Konvertiertes Dokument als `.md` (Frontmatter + Inhalt) atomar ablegen. */
export async function writeDokumentMarkdown(
  root: FileSystemDirectoryHandle, fkz: string, meta: DokumentMeta, body: string,
): Promise<void> {
  await atomicWrite(root, dokumentMdPath(fkz, meta.quelle), buildMarkdownMitFrontmatter(meta, body), { skipBackup: true });
}

export interface OrdnerVb {
  markdown: string;
  quelle: string;
  fkz: string;
  konvertiert_am: string;
}

/**
 * VB-Fallback (A4): scannt `ZAH/antraege/{id}/dokumente/*.md` über ALLE
 * `knownIds`, filtert auf Frontmatter `typ: vorhabensbeschreibung`, gibt die
 * jüngste zurück (`konvertiert_am` absteigend). Tolerant ggü. fehlendem Ordner
 * (`listFilesWithBackupInfo` liefert dann `[]`).
 */
export async function readVbAusOrdner(
  root: FileSystemDirectoryHandle, knownIds: string[],
): Promise<OrdnerVb | null> {
  const kandidaten: OrdnerVb[] = [];
  for (const id of knownIds) {
    const dir = dokumenteDir(id);
    const namen = (await listFilesWithBackupInfo(root, dir)).map(f => f.name);
    for (const name of namen) {
      if (!name.endsWith('.md')) continue;
      const raw = await readText(root, `${dir}/${name}`);
      if (!raw) continue;
      const parsed = parseFrontmatter(raw);
      if (parsed?.meta.typ === 'vorhabensbeschreibung') {
        kandidaten.push({
          markdown: parsed.body, quelle: parsed.meta.quelle, fkz: id, konvertiert_am: parsed.meta.konvertiert_am,
        });
      }
    }
  }
  kandidaten.sort((a, b) => b.konvertiert_am.localeCompare(a.konvertiert_am));
  return kandidaten[0] ?? null;
}

export async function copyZipToEingang(root: FileSystemDirectoryHandle, zipname: string, zip: Blob): Promise<void> {
  await atomicWrite(root, eingangZipPath(zipname), zip, { skipBackup: true });
}

export async function writeManifest(root: FileSystemDirectoryHandle, m: EingangManifest): Promise<void> {
  await atomicWrite(root, eingangManifestPath(m.zipname), JSON.stringify(m, null, 2), { skipBackup: true });
}

export async function readManifest(root: FileSystemDirectoryHandle, zipname: string): Promise<EingangManifest | null> {
  const raw = await readText(root, eingangManifestPath(zipname));
  return raw ? (JSON.parse(raw) as EingangManifest) : null;
}

export async function listEingangBundles(root: FileSystemDirectoryHandle): Promise<EingangManifest[]> {
  const files = await listFilesWithBackupInfo(root, EINGANG_DIR);
  const out: EingangManifest[] = [];
  for (const f of files) {
    if (!f.name.endsWith('.manifest.json')) continue;
    const raw = await readText(root, `${EINGANG_DIR}/${f.name}`);
    if (raw) out.push(JSON.parse(raw) as EingangManifest);
  }
  return out;
}

export async function deleteEingangBundle(root: FileSystemDirectoryHandle, zipname: string): Promise<void> {
  await removeFile(root, eingangZipPath(zipname)).catch(() => {});
  await removeFile(root, eingangManifestPath(zipname)).catch(() => {});
}
