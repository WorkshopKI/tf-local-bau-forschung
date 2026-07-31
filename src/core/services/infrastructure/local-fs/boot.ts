/**
 * Profil-Seed der Variante „local".
 *
 * Warum das nötig ist: `App.tsx` prüft `onboarding-complete` BEVOR es das
 * Handle-Gate auswertet. Ist der Wert falsy, rendert das Onboarding-Formular und
 * `refreshHandleGate` läuft gar nicht erst — die frische, per Definition leere
 * IDB `teamflow-zah-local` landete also bei jedem ersten Start in einer
 * Eingabemaske, an der eine Automation hängen bleibt.
 *
 * Der Seed schreibt daher einmalig ein Profil aus `runtimeConfig.local.profil`.
 * Idempotent: ein bereits vorhandenes Profil wird NICHT überschrieben, damit
 * Änderungen in den Einstellungen einen Reload überleben.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import { runtimeConfig } from '@/config/runtime-config';
import type { UserProfile } from '@/core/types/config';

/**
 * Legt Profil + `onboarding-complete` an, falls noch nicht vorhanden.
 * No-op ohne `local`-Block oder ohne `local.profil`.
 *
 * Gibt zurück, ob geseedet wurde (für Logging/Diagnose).
 */
export async function sorgeFuerLokalesProfil(idb: IDBStore): Promise<boolean> {
  if (!__TEAMFLOW_LOCAL_FS__) return false;
  const seed = runtimeConfig.local?.profil;
  if (!seed?.name) return false;

  const vorhanden = await idb.get<UserProfile>('profile');
  const abgeschlossen = await idb.get<boolean>('onboarding-complete');
  if (vorhanden && abgeschlossen) return false;

  const profil: UserProfile = {
    ...vorhanden,
    name: vorhanden?.name ?? seed.name,
    department: vorhanden?.department ?? 'antraege',
    // Default `'alle'`: der Bearbeiter-Filter greift in Antraegeliste UND
    // Home-Dashboard. Ein erfundenes Kuerzel wie „LOC" matcht keine echte
    // TiB_KUERZ/BIB_KUERZ-Spalte — die Seite zeigte dann trotz 14.000 geladener
    // Antraege „Keine Antraege matchen die aktuellen Filter". `'alle'` ist der
    // dafuer vorgesehene Spezialwert (siehe UserProfile.bearbeiter_kuerzel) und
    // fuer eine Sicht-/Automations-Variante die richtige Vorgabe.
    bearbeiter_kuerzel: vorhanden?.bearbeiter_kuerzel ?? seed.kuerzel ?? 'alle', // allow-direct-kuerzel: Seed SCHREIBT das Profil vor jeder Session — useMeinKuerzel() haette hier nichts zu lesen
    is_kurator: vorhanden?.is_kurator ?? seed.isKurator === true,
    theme: vorhanden?.theme ?? { hue: 210, dark: false },
  };

  await idb.set('profile', profil);
  await idb.set('onboarding-complete', true);
  return true;
}
