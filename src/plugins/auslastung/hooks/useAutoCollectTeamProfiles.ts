/**
 * useAutoCollectTeamProfiles (v2.8) — sammelt beim Öffnen des Auslastungs-
 * Moduls automatisch die MA-Selbst-Profile aus den persönlichen Ordnern ein
 * und merged sie in `auslastung.json`.
 *
 * Hintergrund: Seit v2.6 pflegen MAs ihre Technologien/Antragstyp-Präferenz in
 * ihrem persönlichen Ordner (`ZAH/auslastung-profil.json`). Der Matcher liest
 * aber `auslastung.json`. Ohne Einsammeln wirkt z.B. eine FuE-Präferenz nicht —
 * ein FuE-MA würde weiter für DS-Anträge vorgeschlagen. Dieser Hook übernimmt
 * das Einsammeln automatisch (einmal pro App-Session), sodass der PL nicht jedes
 * Mal manuell „Team-Profile einsammeln" klicken muss.
 *
 * Best-effort: Wenn der User-Folders-Root nicht verbunden ist, passiert nichts
 * (kein Picker-Prompt im Auto-Pfad) — der manuelle Button bleibt verfügbar.
 */
import { useEffect } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getUserFoldersRootHandle } from '@/core/services/infrastructure/smb-handle';
import { useAuslastungData } from './useAuslastungData';
import { useAntraegeCache } from './useAntraegeCache';
import { useAuslastungReady } from './useAuslastungReady';
import { collectUserProfiles } from '../services/profil-einsammeln';

/** Einmal pro App-Session (überlebt Plugin-/Tab-Wechsel-Remounts). */
let autoCollectDone = false;

/** Nur für Tests — setzt das Session-Flag zurück. */
export function resetAutoCollectForTests(): void {
  autoCollectDone = false;
}

export function useAutoCollectTeamProfiles(): void {
  const storage = useStorage();
  const { ready } = useAuslastungReady();
  const cache = useAntraegeCache();
  const setupDone = useAuslastungData(s => s.data.config.setupAbgeschlossen);
  const applyAggregatedProfiles = useAuslastungData(s => s.applyAggregatedProfiles);

  useEffect(() => {
    if (!ready) return;
    // Cold-Start-Clobber-Schutz: nur einsammeln, wenn das Modul wirklich
    // eingerichtet ist. Ein transienter Leer-Read setzt zwar `loaded=true`
    // (→ ready), liefert aber `setupAbgeschlossen=false`/0 MAs — dann darf
    // NICHTS auf die leere Basis persistiert werden (sonst 263→7-KB-Clobber).
    // Flag NICHT setzen → laeuft nach, sobald Setup steht / echte Daten da sind.
    if (!setupDone) return;
    // AnonymMap muss geladen sein — sonst würde mergeProfilesIntoMitarbeiter
    // jedes Kürzel als unbekannt behandeln und Dubletten-MAs anlegen.
    if (cache.anonymMap.toAnon.size === 0) return;
    if (autoCollectDone) return;
    autoCollectDone = true;

    void (async () => {
      const root = await getUserFoldersRootHandle(storage.idb).catch(() => null);
      if (!root) return; // Root nicht verbunden — still überspringen.
      try {
        const profile = await collectUserProfiles(root);
        if (profile.length > 0) {
          await applyAggregatedProfiles(storage, profile, cache.anonymMap);
        }
      } catch {
        // Best-effort — manueller „Team-Profile einsammeln"-Button bleibt.
      }
    })();
  }, [ready, setupDone, cache.anonymMap, applyAggregatedProfiles, storage]);
}
