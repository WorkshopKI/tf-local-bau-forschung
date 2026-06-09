/**
 * useHeartbeat — Hintergrund-Writer fuer den Presence-Heartbeat.
 *
 * Mountet in `ShellLayout` (jede Variante). Schreibt beim Mount und danach alle
 * ~45 s `ZAH/online-status.json` in den persoenlichen Ordner, solange die App
 * offen ist. Best-effort und **bewusst silent**: kein persoenlicher Handle →
 * NO-OP; Permission-/SMB-Fehler werden geschluckt. Daher KEIN `useAsyncAction`
 * (CLAUDE.md Pitfall #15 zielt auf onClick-Handler mit sichtbarem busy/error —
 * hier gibt es keine UI-Affordance). Quelle fuer den PL-„Online"-Tab.
 *
 * Kuerzel kommt aus `useMeinKuerzel` (Pitfall #27), nicht direkt aus
 * `profile.bearbeiter_kuerzel`.
 */
import { useEffect } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { isPresenceHeartbeatEnabled } from '@/config/feature-flags';
import { runtimeConfig, appVersion } from '@/config/runtime-config';
import { getOrCreateDeviceId } from './device-id';
import { writeHeartbeat } from './writer';
import type { OnlineHeartbeat } from './types';

const HEARTBEAT_INTERVAL_MS = 45_000;

export function useHeartbeat(): void {
  const storage = useStorage();
  const { profile } = useProfile();
  const kuerzel = useMeinKuerzel();
  const name = profile?.name;

  useEffect(() => {
    if (!isPresenceHeartbeatEnabled()) return;
    let cancelled = false;

    const tick = async (): Promise<void> => {
      try {
        const persHandle = await getPersoenlichHandle(storage.idb);
        if (!persHandle || cancelled) return;
        const hb: OnlineHeartbeat = {
          version: 1,
          kuerzel: kuerzel || undefined,
          name: name || undefined,
          deviceId: await getOrCreateDeviceId(storage.idb),
          lastActive: new Date().toISOString(),
          appVersion,
          variant: runtimeConfig.variant,
        };
        if (cancelled) return;
        await writeHeartbeat(persHandle, hb);
      } catch {
        /* best-effort: kein Handle / NotAllowedError / SMB-Haenger → schlucken */
      }
    };

    void tick();
    const h = window.setInterval(() => void tick(), HEARTBEAT_INTERVAL_MS);
    return () => { cancelled = true; window.clearInterval(h); };
  // Identitaet (kuerzel/name) kann spaeter hydrieren → Effect neu binden, damit
  // der naechste Heartbeat die aktuelle Identitaet schreibt.
  }, [storage, kuerzel, name]);
}
