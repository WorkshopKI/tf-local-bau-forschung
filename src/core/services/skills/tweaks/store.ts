/**
 * Persistenz der Skill-Tweaks (User-Tweaks v2).
 *
 * Primär: generischer `kv`-Store unter `skill-tweaks:<skillId>` — bewusst KEIN
 * dedizierter Object-Store/Version-Bump (Rationale wie kurzfassung-store.ts:
 * Exact-Key-Lookup, und ein Bump triggert unter `file://` mit parallel offenen
 * Varianten ein `onblocked`-Upgrade, siehe recurring-bug-classes.md §3).
 *
 * Best-effort-Spiegel: `ZAH/skill-tweaks.json` im persönlichen Ordner (LWW über
 * `geaendert_am`), analog persoenliches-profil.ts — damit der Tweak dem Nutzer
 * über Rechner/Sessions folgt + IDB-Verlust übersteht. ABER: ohne persönlichen
 * Ordner einfach IDB-only (kein `throw` — Tweaks sind rein privat, kein
 * Team-Sichtbarkeits-Aspekt wie bei auslastung-profil).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { PERSOENLICH_SKILL_TWEAKS_FILE } from '@/core/services/infrastructure/types';
import { TWEAK_FELD_MAX, type SkillTweak, type SkillTweaksFile } from './types';

const keyFor = (skillId: string): string => `skill-tweaks:${skillId}`;

/** LWW-Entscheidung: ist `a` (ISO) neuer als `b`? (rein, testbar) */
export function isNewerTweak(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  return Date.parse(a) > Date.parse(b);
}

/**
 * Versions-Hinweis-Logik (rein, testbar): zeigt den dezenten Hinweis, wenn der
 * Kurator den Skill seit dem Anlegen des (aktiven) Tweaks aktualisiert hat und
 * der Nutzer ihn für diese Version nicht bereits weggeklickt hat.
 */
export function shouldShowVersionHint(
  tweak: SkillTweak | null | undefined,
  skillVersion: number,
): boolean {
  if (!tweak || !tweak.aktiv) return false;
  if (skillVersion <= tweak.angelegtFuerSkillVersion) return false;
  return tweak.hinweisAusgeblendetFuerVersion !== skillVersion;
}

/** Strukturelle Validierung eines roh gelesenen Tweaks. */
export function isValidTweak(raw: unknown): raw is SkillTweak {
  if (!raw || typeof raw !== 'object') return false;
  const t = raw as Record<string, unknown>;
  return (
    typeof t.skillId === 'string' &&
    typeof t.angelegtFuerSkillVersion === 'number' &&
    typeof t.aktiv === 'boolean' &&
    typeof t.stilHinweise === 'string' &&
    typeof t.beispielFormulierungen === 'string' &&
    typeof t.geaendert_am === 'string'
  );
}

/** Klemmt die Freitextfelder defensiv auf die Obergrenze. */
function clampTweak(tweak: SkillTweak): SkillTweak {
  return {
    ...tweak,
    stilHinweise: tweak.stilHinweise.slice(0, TWEAK_FELD_MAX),
    beispielFormulierungen: tweak.beispielFormulierungen.slice(0, TWEAK_FELD_MAX),
  };
}

async function readTweaksFile(handle: FileSystemDirectoryHandle): Promise<SkillTweaksFile | null> {
  const txt = await readText(handle, PERSOENLICH_SKILL_TWEAKS_FILE);
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt) as Record<string, unknown>;
    if (!parsed || parsed.version !== 1 || typeof parsed.tweaks !== 'object' || parsed.tweaks === null) {
      return null;
    }
    return parsed as unknown as SkillTweaksFile;
  } catch {
    return null;
  }
}

/** Nur IDB-Cache (kein Ordner-Zugriff) — für Stellen ohne persönlichen Handle. */
export async function getSkillTweakCached(idb: IDBStore, skillId: string): Promise<SkillTweak | null> {
  return idb.get<SkillTweak>(keyFor(skillId));
}

/**
 * Lädt den Tweak mit Cross-Browser-Kaskade: persönlicher Ordner → IDB-Cache →
 * null. Bei beidseitigem Treffer gewinnt der neuere `geaendert_am`; der Cache
 * wird auf den Gewinner angeglichen.
 */
export async function loadSkillTweak(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
  skillId: string,
): Promise<SkillTweak | null> {
  const cached = (await idb.get<SkillTweak>(keyFor(skillId))) ?? null;
  if (!persHandle) return cached;

  let file: SkillTweaksFile | null = null;
  try {
    file = await readTweaksFile(persHandle);
  } catch {
    return cached;
  }
  const fromFile = file?.tweaks?.[skillId];
  const share = fromFile && isValidTweak(fromFile) ? fromFile : null;
  if (!share) return cached;

  const winner = isNewerTweak(share.geaendert_am, cached?.geaendert_am) ? share : (cached ?? share);
  await idb.set(keyFor(skillId), winner);
  return winner;
}

/**
 * Speichert den Tweak. Schreibt IMMER den IDB-Cache; spiegelt zusätzlich
 * best-effort in den persönlichen Ordner (silent, wenn kein Handle / Schreibfehler).
 */
export async function saveSkillTweak(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
  tweak: SkillTweak,
): Promise<void> {
  const clamped = clampTweak(tweak);
  await idb.set(keyFor(clamped.skillId), clamped);
  if (!persHandle) return;
  try {
    const file = (await readTweaksFile(persHandle)) ?? { version: 1 as const, tweaks: {} };
    file.tweaks[clamped.skillId] = clamped;
    await atomicWrite(persHandle, PERSOENLICH_SKILL_TWEAKS_FILE, JSON.stringify(file, null, 2));
  } catch {
    // best-effort — IDB ist bereits geschrieben
  }
}

/** Entfernt den Tweak aus IDB und (best-effort) aus der Spiegel-Datei. */
export async function deleteSkillTweak(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
  skillId: string,
): Promise<void> {
  await idb.delete(keyFor(skillId));
  if (!persHandle) return;
  try {
    const file = await readTweaksFile(persHandle);
    if (file?.tweaks && skillId in file.tweaks) {
      delete file.tweaks[skillId];
      await atomicWrite(persHandle, PERSOENLICH_SKILL_TWEAKS_FILE, JSON.stringify(file, null, 2));
    }
  } catch {
    // best-effort — IDB-Eintrag ist bereits entfernt
  }
}
