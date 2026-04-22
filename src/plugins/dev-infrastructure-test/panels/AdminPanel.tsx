import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { isKuratorConfigured } from '@/core/services/infrastructure/kurator-config';
import { getRecentAudits } from '@/core/services/infrastructure/audit-log';
import { getSmbHandle } from '@/core/services/infrastructure/smb-handle';
import type { AuditEntry } from '@/core/services/infrastructure/types';
import { DevRow, DevLog, StatusPill } from './shared';

const TTL_OPTIONS: Array<{ label: string; ms: number }> = [
  { label: '30 s', ms: 30_000 },
  { label: '5 min', ms: 5 * 60_000 },
  { label: '12 h', ms: 12 * 60 * 60_000 },
];

export function AdminPanel(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const smbStatus = useSmbStatus();
  const [configured, setConfigured] = useState(false);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupPw, setSetupPw] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [hasHandle, setHasHandle] = useState<boolean>(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPw, setLoginPw] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [expiryLabel, setExpiryLabel] = useState<string>('');

  const refresh = useCallback(async () => {
    setConfigured(await isKuratorConfigured(storage.idb));
    setAudits(await getRecentAudits(storage.idb, 10));
    setHasHandle(!!(await getSmbHandle(storage.idb)));
  }, [storage.idb]);

  useEffect(() => { void refresh(); }, [refresh, session.isActive, smbStatus.status, smbStatus.lastCheck]);

  // Countdown-Label, einmal/sek.
  useEffect(() => {
    if (!session.isActive || session.expiresAt === null) {
      setExpiryLabel('');
      return;
    }
    const update = (): void => {
      const diff = (session.expiresAt ?? 0) - Date.now();
      if (diff <= 0) { setExpiryLabel('abgelaufen'); return; }
      const s = Math.floor(diff / 1000);
      if (s < 60) setExpiryLabel(`${s}s`);
      else if (s < 3600) setExpiryLabel(`${Math.floor(s / 60)}m ${s % 60}s`);
      else setExpiryLabel(`${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);
    };
    update();
    const h = window.setInterval(update, 1000);
    return () => window.clearInterval(h);
  }, [session.isActive, session.expiresAt]);

  const onSetup = async (): Promise<void> => {
    setSetupError(null);
    if (!setupName.trim() || !setupPw) { setSetupError('Name und Passwort erforderlich'); return; }
    const handle = await getSmbHandle(storage.idb);
    if (!handle) { setSetupError('Bitte zuerst in Spalte 1 einen Programm-Ordner auswählen'); return; }
    const ok = await session.setup(storage.idb, setupName.trim(), setupPw);
    if (ok) {
      setSetupOpen(false);
      setSetupName('');
      setSetupPw('');
      setSetupError(null);
      await refresh();
    } else {
      setSetupError('Setup fehlgeschlagen. Siehe Browser-Konsole.');
    }
  };

  const onLogin = async (): Promise<void> => {
    setLoginError(null);
    const ok = await session.activate(storage.idb, loginPw);
    if (ok) {
      setLoginOpen(false);
      setLoginPw('');
      await refresh();
    } else {
      setLoginError('Passwort falsch');
    }
  };

  const onLogout = async (): Promise<void> => {
    await session.deactivate(storage.idb);
    await refresh();
  };

  const onChange = async (): Promise<void> => {
    setChangeError(null);
    if (!oldPw || !newPw) return;
    const ok = await session.changePassword(storage.idb, oldPw, newPw);
    if (ok) {
      setChangeOpen(false);
      setOldPw('');
      setNewPw('');
    } else {
      setChangeError('Altes Passwort falsch');
    }
  };

  return (
    <div>
      <DevRow label="Zustand">
        <StatusPill label={configured ? 'konfiguriert' : 'nicht konfiguriert'} tone={configured ? 'ok' : 'neutral'} />
        <StatusPill label={session.isActive ? 'Kurator aktiv' : 'nicht angemeldet'} tone={session.isActive ? 'ok' : 'neutral'} />
        {session.kuratorName ? <StatusPill label={session.kuratorName} tone="neutral" /> : null}
        {expiryLabel ? <StatusPill label={`↻ ${expiryLabel}`} tone="neutral" /> : null}
      </DevRow>
      <DevRow label="Session-TTL">
        {TTL_OPTIONS.map(opt => (
          <Button key={opt.ms} size="xs" variant={session.ttlMs === opt.ms ? 'secondary' : 'outline'} onClick={() => session.setTtl(opt.ms)}>
            {opt.label}
          </Button>
        ))}
      </DevRow>
      <DevRow label="Aktionen">
        {!configured ? (
          <>
            <Button size="sm" variant="default" onClick={() => setSetupOpen(true)} disabled={!hasHandle} title={!hasHandle ? 'Erst Programm-Ordner in Spalte 1 auswählen' : undefined}>Kurator-Modus initialisieren</Button>
            {!hasHandle ? <span className="text-[11px] text-[var(--tf-text-tertiary)]">erst Programm-Ordner wählen</span> : null}
          </>
        ) : !session.isActive ? (
          <Button size="sm" variant="default" onClick={() => setLoginOpen(true)}>Kurator-Modus aktivieren</Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => session.extend()}>Session verlängern</Button>
            <Button size="sm" variant="outline" onClick={() => setChangeOpen(true)}>Passwort ändern</Button>
            <Button size="sm" variant="ghost" onClick={onLogout}>Logout</Button>
          </>
        )}
      </DevRow>
      <DevRow label="Letzte Audit-Einträge">
        <div className="w-full">
          <DevLog lines={audits.map(a => `${a.ts.slice(11, 19)}  ${a.user.padEnd(16)}  ${a.action}`)} />
          <div className="mt-1 flex justify-end">
            <Button size="xs" variant="ghost" onClick={() => void refresh()}>Neu laden</Button>
          </div>
        </div>
      </DevRow>

      <Dialog
        open={setupOpen}
        onClose={() => { setSetupOpen(false); setSetupError(null); }}
        title="Kurator-Modus initialisieren"
        description="Lege Kurator-Name und Passwort fest. kurator-config.enc wird im Programm-Ordner gespeichert."
        footer={<>
          <Button size="sm" variant="ghost" onClick={() => { setSetupOpen(false); setSetupError(null); }}>Abbrechen</Button>
          <Button size="sm" variant="default" onClick={onSetup}>Erstellen</Button>
        </>}
      >
        <div className="flex flex-col gap-2">
          <Input placeholder="Name für Audit-Log (z.B. thomas@behoerde)" value={setupName} onChange={e => setSetupName(e.target.value)} />
          <Input type="password" placeholder="Passwort" value={setupPw} onChange={e => setSetupPw(e.target.value)} />
          {setupError ? <div className="text-[12px] text-red-700">{setupError}</div> : null}
        </div>
      </Dialog>

      <Dialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        title="Kurator-Modus aktivieren"
        footer={<>
          <Button size="sm" variant="ghost" onClick={() => setLoginOpen(false)}>Abbrechen</Button>
          <Button size="sm" variant="default" onClick={onLogin}>Anmelden</Button>
        </>}
      >
        <div className="flex flex-col gap-2">
          <Input type="password" placeholder="Passwort" value={loginPw} onChange={e => setLoginPw(e.target.value)} autoFocus />
          {loginError ? <div className="text-[12px] text-red-700">{loginError}</div> : null}
        </div>
      </Dialog>

      <Dialog
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        title="Passwort ändern"
        footer={<>
          <Button size="sm" variant="ghost" onClick={() => setChangeOpen(false)}>Abbrechen</Button>
          <Button size="sm" variant="default" onClick={onChange}>Speichern</Button>
        </>}
      >
        <div className="flex flex-col gap-2">
          <Input type="password" placeholder="Altes Passwort" value={oldPw} onChange={e => setOldPw(e.target.value)} />
          <Input type="password" placeholder="Neues Passwort" value={newPw} onChange={e => setNewPw(e.target.value)} />
          {changeError ? <div className="text-[12px] text-red-700">{changeError}</div> : null}
        </div>
      </Dialog>
    </div>
  );
}
