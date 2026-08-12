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
 * Best-effort: Wenn keine Wurzel verbunden ist, passiert nichts (kein
 * Picker-Prompt im Auto-Pfad) — der manuelle Button bleibt verfügbar.
 *
 * v4.1: mehrere Wurzeln. Erst ALLE lesen, dann Dubletten falten, dann GENAU EIN
 * `applyAggregatedProfiles` — ein Apply je Wurzel liefe in den Save-Lock des
 * Stores (Pitfall #16/#20).
 */
import { useEffect } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getUserFoldersRoots } from '@/core/services/infrastructure/smb-handle';
import { jeWurzel, juengsterGewinnt } from '@/core/services/personal-roots';
import { useAuslastungData } from './useAuslastungData';
import { useAntraegeCache } from './useAntraegeCache';
import { useAuslastungReady } from './useAuslastungReady';
import { collectUserProfiles } from '../services/onboarding';
import { normalizeKuerzel } from '../services/identitaet';
import type { PersoenlichesAuslastungProfil } from '../types';

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
      try {
        const wurzeln = await getUserFoldersRoots(storage.idb);
        const alle: PersoenlichesAuslastungProfil[] = [];
        // jeWurzel laeuft sequenziell und faengt Fehler je Wurzel — eine
        // unerreichbare Gruppe stoppt die andere nicht.
        await jeWurzel(wurzeln, async root => {
          const teil = await collectUserProfiles(root.handle);
          alle.push(...teil);
          return teil.length;
        });
        // Schluessel ist das normalisierte Kuerzel, nicht der Ordnername: der
        // nachgelagerte Merge kollabiert ohnehin auf die Person, und ein
        // Gruppenwechsel benennt den Ordner in aller Regel um. NFC-Normalisierung
        // ist Pflicht (Pitfall #22) — die Wurzeln wurden von verschiedenen
        // Rechnern beschrieben.
        const profile = juengsterGewinnt(alle, p => normalizeKuerzel(p.kuerzel), p => p.updatedAt);
        if (profile.length > 0) {
          await applyAggregatedProfiles(storage, profile, cache.anonymMap);
        }
      } catch {
        // Best-effort — manueller „Team-Profile einsammeln"-Button bleibt.
      }
    })();
  }, [ready, setupDone, cache.anonymMap, applyAggregatedProfiles, storage]);
}
