/**
 * Online-Tab (Einstellungen, nur pl/dev — gegated via `isOnlineStatusTabEnabled`).
 *
 * Zeigt, wer die App zuletzt genutzt hat — aus den Heartbeat-Dateien
 * (`ZAH/online-status.json`) aller User unter dem User-Folders-Root. „Online" =
 * Heartbeat juenger als ONLINE_STALE_WINDOW_MS (5 Min). Auto-Refresh alle ~45 s,
 * solange der Tab offen ist. Serverless: kein Echtzeit-Presence, sondern
 * „zuletzt aktiv vor X Min".
 */
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, FolderOpen } from 'lucide-react';
import { Button, SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  getUserFoldersRootHandle,
  pickAndStoreUserFoldersRootHandle,
  queryUserFoldersRootPermission,
  refreshUserFoldersRootPermission,
} from '@/core/services/infrastructure/smb-handle';
import { collectHeartbeats, type OnlineUser } from '@/core/services/presence';
import { formatRelativeTime } from '@/components/feedback';

const REFRESH_INTERVAL_MS = 45_000;

export function OnlineTab(): React.ReactElement {
  const storage = useStorage();
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [rootMissing, setRootMissing] = useState(false);
  // Handle in IDB, aber Permission unter file:// nach Neustart verfallen → Re-Grant
  // im Klick-Gesture nötig (der Auto-Load darf nicht prompten).
  const [needsRegrant, setNeedsRegrant] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const applyList = useCallback((list: OnlineUser[]) => {
    // Online zuerst, dann nach Aktualitaet absteigend.
    list.sort((a, b) =>
      Number(b.online) - Number(a.online) ||
      Date.parse(b.lastActive) - Date.parse(a.lastActive));
    setUsers(list);
    setLoaded(true);
  }, []);

  // Auto-/Manuell-Refresh: liest NUR den bestehenden Handle — KEIN Picker (der
  // FSAPI-Ordner-Dialog darf ausschliesslich aus einer echten Klick-Geste kommen).
  const load = useAsyncAction(async () => {
    const root = await getUserFoldersRootHandle(storage.idb);
    if (!root) {
      setRootMissing(true);
      setNeedsRegrant(false);
      setUsers([]);
      setLoaded(true);
      return;
    }
    setRootMissing(false);
    // Permission kann unter file:// nach Neustart verfallen sein. Erst non-invasiv
    // prüfen — sonst wirft schon das Verzeichnis-Iterieren in collectHeartbeats
    // (kein Gesture hier → requestPermission unmöglich). Re-Grant via Button unten.
    const perm = await queryUserFoldersRootPermission(storage.idb);
    if (perm !== 'granted') {
      setNeedsRegrant(true);
      setUsers([]);
      setLoaded(true);
      return;
    }
    setNeedsRegrant(false);
    try {
      applyList(await collectHeartbeats(root));
    } catch {
      // Sicherheitsnetz: Permission zwischen Query und Iteration entzogen → kein
      // roher Fehlerbanner, sondern Re-Grant anbieten.
      setNeedsRegrant(true);
      setUsers([]);
      setLoaded(true);
    }
  });

  // Re-Grant (Klick-Gesture): gibt das bestehende Handle erneut frei — kein
  // erneutes Auswählen des Ordners nötig. Fällt bei denied/missing auf den
  // Re-Pick-Pfad (rootMissing → connect) zurück.
  const regrant = useAsyncAction(async () => {
    const state = await refreshUserFoldersRootPermission(storage.idb);
    if (state !== 'granted') {
      setNeedsRegrant(false);
      setRootMissing(true);
      return;
    }
    const root = await getUserFoldersRootHandle(storage.idb);
    if (!root) {
      setNeedsRegrant(false);
      setRootMissing(true);
      return;
    }
    setNeedsRegrant(false);
    applyList(await collectHeartbeats(root));
  });

  // Erstverbindung: oeffnet den Ordner-Picker (nur im Klick-Gesture) und sammelt
  // dann ein. Gespiegelt von MaListSection „Profile einsammeln".
  const connect = useAsyncAction(async () => {
    const res = await pickAndStoreUserFoldersRootHandle(storage.idb);
    if (!res.ok) {
      if (res.reason === 'aborted') return;
      throw new Error(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
    }
    setRootMissing(false);
    setNeedsRegrant(false);
    applyList(await collectHeartbeats(res.handle));
  });

  useEffect(() => {
    void load.run();
    const h = window.setInterval(() => void load.run(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onlineCount = users.filter(u => u.online).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionHeader label="Online" />
          <p className="text-[13px] text-[var(--tf-text-secondary)] mt-1 max-w-prose">
            Wer die App zuletzt genutzt hat. „Online" = in den letzten 5&nbsp;Minuten
            aktiv. Aktualisiert sich automatisch alle 45&nbsp;Sekunden.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} loading={load.busy}
          onClick={() => load.run()}>
          Aktualisieren
        </Button>
      </div>

      {load.error && (
        <div className="text-[13px] rounded-[var(--tf-radius)] px-3 py-2 bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]"
          style={{ border: '0.5px solid var(--tf-danger-border)' }}>
          Konnte den Online-Status nicht laden: {load.error}
        </div>
      )}

      {needsRegrant && loaded && (
        <div className="rounded-[var(--tf-radius)] px-4 py-4 space-y-3"
          style={{ border: '0.5px solid var(--tf-border)' }}>
          <p className="text-[13px] text-[var(--tf-text-secondary)] max-w-prose">
            Der Zugriff auf den Ordner der Teammitglieder muss nach dem Browser-Neustart
            einmal erneut bestätigt werden (Sicherheitsvorgabe für lokale Apps). Nur
            Lesezugriff.
          </p>
          {regrant.error && (
            <p className="text-[12px] text-[var(--tf-danger-text)]">{regrant.error}</p>
          )}
          <Button variant="primary" size="sm" icon={FolderOpen} loading={regrant.busy}
            onClick={() => regrant.run()}>
            Erneut freigeben
          </Button>
        </div>
      )}

      {rootMissing && loaded && (
        <div className="rounded-[var(--tf-radius)] px-4 py-4 space-y-3"
          style={{ border: '0.5px solid var(--tf-border)' }}>
          <p className="text-[13px] text-[var(--tf-text-secondary)] max-w-prose">
            Noch nicht verbunden. Wähle den{' '}
            <span className="text-[var(--tf-text)]">übergeordneten Ordner mit den
            persönlichen Ordnern aller Teammitglieder</span> — das Verzeichnis, in dem
            die Ordner der Kolleg:innen liegen. Daraus liest die App den Online-Status
            (nur Lesezugriff, einmalig). Es ist derselbe Ordner wie für „Profile
            einsammeln" im Auslastung-Modul.
          </p>
          {connect.error && (
            <p className="text-[12px] text-[var(--tf-danger-text)]">{connect.error}</p>
          )}
          <Button variant="primary" size="sm" icon={FolderOpen} loading={connect.busy}
            onClick={() => connect.run()}>
            Benutzer-Ordner verbinden
          </Button>
        </div>
      )}

      {!rootMissing && !needsRegrant && loaded && users.length === 0 && (
        <div className="text-[13px] text-[var(--tf-text-secondary)] rounded-[var(--tf-radius)] px-3 py-3"
          style={{ border: '0.5px solid var(--tf-border)' }}>
          Aktuell ist niemand online.
        </div>
      )}

      {users.length > 0 && (
        <div className="space-y-2">
          <div className="text-[12px] text-[var(--tf-text-secondary)]">
            {onlineCount} {onlineCount === 1 ? 'Person' : 'Personen'} online
            {users.length > onlineCount && ` · ${users.length - onlineCount} zuletzt aktiv`}
          </div>
          <ul className="rounded-[var(--tf-radius)] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
            {users.map((u, i) => (
              <li key={u.deviceId}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                style={{ borderBottom: i < users.length - 1 ? '0.5px solid var(--tf-border)' : 'none' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: u.online ? 'var(--tf-success-text)' : 'var(--tf-text-secondary)' }}
                    title={u.online ? 'Online' : 'Offline'} />
                  <span className={`text-[13px] truncate ${u.online ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'}`}>
                    {u.display}
                  </span>
                </div>
                <span className={`text-[12px] shrink-0 ${u.online ? 'text-[var(--tf-success-text)]' : 'text-[var(--tf-text-secondary)]'}`}>
                  {formatRelativeTime(u.lastActive)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
