/**
 * resolveSnapshotAuthor — wer hat den Datenbestand geschrieben?
 *
 * Liefert den besten verfuegbaren menschlichen Urheber-Namen fuers Snapshot-
 * `createdBy` (Anzeige im NewSnapshotBanner: „Neuer Datenbestand … (von X)").
 * Praezedenz best → schlechtest, jeder Schritt defensiv (kein Throw unter
 * `file://`):
 *
 *   1. Profil-Name       — der im Onboarding eingetragene Anzeigename.
 *   2. echtes Profil-Kuerzel — bearbeiter_kuerzel, getrimmt, nicht leer/"alle".
 *   3. Nachname           — Name des persoenlichen Ordners (getPersoenlichHandle().name).
 *   4. build.label        — generisches Rollen-Label ("ZAH PL").
 *   5. 'unbekannt'.
 *
 * Hintergrund: das Profil-Kuerzel ist in pl fast immer "alle" (Uebersichts-Modus)
 * — ohne Schritt 3 landete die Attribution beim generischen Build-Label oder bei
 * "unbekannt", sodass niemand sieht, WER aktualisiert hat. Der persoenliche
 * Ordner heisst auf den Nachnamen des Users.
 *
 * v3.0: Schritt 1 war der Kurator-Name aus `kurator-config.enc`. Mit dem Wegfall
 * der Datei tritt der Profil-Name an seine Stelle — inhaltlich ein Gewinn: der
 * Kurator-Build stempelte bei Shared-Passwort das BUILD-LABEL („ZAH Kurator") in
 * jeden Eintrag, der Profil-Name benennt dagegen einen Menschen.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { getPersoenlichHandle } from './smb-handle';
import { runtimeConfig } from '@/config/runtime-config';

const FALLBACK_AUTHOR = 'unbekannt';

/**
 * Nicht-leeres, nicht-"alle" Kuerzel? Gleiche Semantik wie der "alle"-Sonderwert
 * in parseBearbeiterFilter (src/plugins/antraege/bearbeiterFilter.ts): "alle"
 * (case-insensitive) deaktiviert den Filter und zaehlt hier als "kein Kuerzel".
 */
function istEchtesKuerzel(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const t = raw.trim();
  return t.length > 0 && t.toLowerCase() !== 'alle';
}

export async function resolveSnapshotAuthor(idb: IDBStore): Promise<string> {
  const profile = await idb.get<Record<string, unknown>>('profile').catch(() => null);

  // 1. Profil-Name — der Mensch, so wie er sich selbst eingetragen hat.
  const name = profile?.name;
  if (typeof name === 'string' && name.trim()) return name.trim();

  // 2. Echtes Profil-Kuerzel (nicht "alle"/leer). Service-Pfad → direkter
  //    IDB-Read statt useMeinKuerzel() (das ist ein React-Hook); dieser Code
  //    laeuft nur in pl OHNE MA-Login, wo der Hook ohnehin das Profilfeld
  //    zurueckgibt — semantisch aequivalent.
  const kuerzel = profile?.bearbeiter_kuerzel; // allow-direct-kuerzel: Service-Pfad ohne MA-Login — useMeinKuerzel ist ein Hook
  if (istEchtesKuerzel(kuerzel)) return kuerzel.trim();

  // 3. Nachname = Name des persoenlichen Ordners. getPersoenlichHandle liest nur
  //    aus der IDB (kein SMB-Zugriff, kein Permission-Prompt); .name ist auch
  //    ohne aktive Berechtigung verfuegbar.
  const pers = await getPersoenlichHandle(idb).catch(() => null);
  const nachname = pers?.name?.trim();
  if (nachname) return nachname;

  // 4. Generisches Rollen-Label.
  const label = runtimeConfig.build.label?.trim();
  if (label) return label;

  // 5. Letzter Fallback.
  return FALLBACK_AUTHOR;
}
