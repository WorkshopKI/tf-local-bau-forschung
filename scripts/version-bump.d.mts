// Typ-Deklarationen für die puren Funktionen aus version-bump.mjs
// (das Script ist reines JS/Node-Stdlib; hier nur die Test-Oberfläche typisiert).

export function bumpVersionField(
  pkgText: string,
  kind: string,
): { text: string; version: string };

export function splitIntoBlocks(text: string): { header: string; blocks: string[] };

export function insertChangelogSkeleton(
  changelogText: string,
  opts: { version: string; title: string; kind: string; monthYear: string },
): string;

export function insertUserSkeleton(
  userText: string,
  opts: { majorMinor: string; isoMonth: string },
): string;

export function rotateChangelog(
  changelogText: string,
  archiveText: string,
  opts?: { trigger?: number; targetMax?: number; minKeep?: number },
): { changelog: string; archive: string; rotated: number };
