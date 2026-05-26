/**
 * KuratorSessionPanel — gekapseltes Setup/Login/Logout/Passwort-aendern-UI
 * fuer den Kurator-Modus. Verwendet in:
 *  - Einstellungen → Profil → "Kurator-Bereich" (kurator-Build)
 *  - Dev-Infrastructure-Panel "Kurator-Modus" (dev-Build, dort plus
 *    TTL-Auswahl + Audit-Log)
 *
 * Das Panel macht keine Annahmen ueber den umgebenden Layout-Kontext —
 * es rendert seinen eigenen Status- und Aktionen-Block.
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { isKuratorConfigured } from '@/core/services/infrastructure/kurator-config';
import { getSmbHandle } from '@/core/services/infrastructure/smb-handle';

export function KuratorSessionPanel(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [configured, setConfigured] = useState(false);
  const [hasHandle, setHasHandle] = useState(false);
  const [expiryLabel, setExpiryLabel] = useState('');

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupPw, setSetupPw] = useState('');

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPw, setLoginPw] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [changeOpen, setChangeOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setConfigured(await isKuratorConfigured(storage.idb));
    setHasHandle(!!(await getSmbHandle(storage.idb)));
  }, [storage.idb]);

  useEffect(() => { void refresh(); }, [refresh, session.isActive]);

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

  const setupAction = useAsyncAction(async () => {
    if (!setupName.trim() || !setupPw) {
      throw new Error('Name und Passwort erforderlich');
    }
    if (!hasHandle) {
      throw new Error('Erst Daten-Share-Ordner zuweisen.');
    }
    const ok = await session.setup(storage.idb, setupName.trim(), setupPw);
    if (!ok) throw new Error('Setup fehlgeschlagen. Siehe Browser-Konsole.');
    setSetupOpen(false);
    setSetupName('');
    setSetupPw('');
    await refresh();
  });

  const loginAction = useAsyncAction(async () => {
    setLoginError(null);
    const ok = await session.activate(storage.idb, loginPw);
    if (!ok) {
      setLoginError('Passwort falsch');
      return;
    }
    setLoginOpen(false);
    setLoginPw('');
    await refresh();
  });

  const logoutAction = useAsyncAction(async () => {
    await session.deactivate(storage.idb);
    await refresh();
  });

  const changeAction = useAsyncAction(async () => {
    setChangeError(null);
    if (!oldPw || !newPw) {
      setChangeError('Beide Passworte erforderlich');
      return;
    }
    const ok = await session.changePassword(storage.idb, oldPw, newPw);
    if (!ok) {
      setChangeError('Altes Passwort falsch');
      return;
    }
    setChangeOpen(false);
    setOldPw('');
    setNewPw('');
  });

  const statusLabel = session.isActive
    ? 'aktiv'
    : configured
      ? 'konfiguriert · inaktiv'
      : 'nicht konfiguriert';
  const statusTone: 'ok' | 'neutral' = session.isActive ? 'ok' : 'neutral';

  return (
    <div className="mt-4">
      {/* Status-Zeile */}
      <div className="flex items-center flex-wrap gap-2 mb-3">
        <StatusPill label={statusLabel} tone={statusTone} />
        {session.kuratorName ? (
          <span className="text-[12px] text-[var(--tf-text-secondary)]">{session.kuratorName}</span>
        ) : null}
        {expiryLabel ? (
          <span className="text-[12px] text-[var(--tf-text-tertiary)]">· läuft noch {expiryLabel}</span>
        ) : null}
      </div>

      {/* Aktionen je nach Zustand */}
      {!configured ? (
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            onClick={() => setSetupOpen(true)}
            disabled={!hasHandle}
          >
            Kurator-Modus initialisieren
          </Button>
          <span className="text-[12px] text-[var(--tf-text-tertiary)]">
            {hasHandle
              ? 'Legt Kurator-Name + Passwort an. kurator-config.enc landet im _intern-Ordner.'
              : 'Erst Daten-Share-Ordner zuweisen.'}
          </span>
        </div>
      ) : !session.isActive ? (
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" onClick={() => setLoginOpen(true)}>Anmelden</Button>
          <span className="text-[12px] text-[var(--tf-text-tertiary)]">
            Schaltet schreibende Aktionen frei. TTL läuft, sobald die Session aktiv ist.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => void logoutAction.run()} disabled={logoutAction.busy}>
            Abmelden
          </Button>
          <Button size="sm" variant="outline" onClick={() => setChangeOpen(true)}>
            Passwort ändern
          </Button>
          <Button size="sm" variant="outline" onClick={() => session.extend()}>
            Session erneuern
          </Button>
        </div>
      )}

      {logoutAction.error ? (
        <div className="mt-2 text-[12px] text-red-700">{logoutAction.error}</div>
      ) : null}

      {/* Setup-Dialog */}
      <Dialog
        open={setupOpen}
        onClose={() => { setSetupOpen(false); setupAction.clearError(); }}
        title="Kurator-Modus initialisieren"
        description="Lege Kurator-Name und Passwort fest. kurator-config.enc wird im Daten-Share gespeichert."
        footer={<>
          <Button size="sm" variant="ghost" onClick={() => { setSetupOpen(false); setupAction.clearError(); }}>
            Abbrechen
          </Button>
          <Button size="sm" variant="default" onClick={() => void setupAction.run()} disabled={setupAction.busy}>
            {setupAction.busy ? 'Erstellen…' : 'Erstellen'}
          </Button>
        </>}
      >
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Name für Audit-Log (z.B. thomas@behoerde)"
            value={setupName}
            onChange={e => setSetupName(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Passwort"
            value={setupPw}
            onChange={e => setSetupPw(e.target.value)}
          />
          {setupAction.error ? (
            <div className="text-[12px] text-red-700">{setupAction.error}</div>
          ) : null}
        </div>
      </Dialog>

      {/* Login-Dialog */}
      <Dialog
        open={loginOpen}
        onClose={() => { setLoginOpen(false); setLoginError(null); loginAction.clearError(); }}
        title="Kurator-Modus aktivieren"
        footer={<>
          <Button size="sm" variant="ghost" onClick={() => { setLoginOpen(false); setLoginError(null); loginAction.clearError(); }}>
            Abbrechen
          </Button>
          <Button size="sm" variant="default" onClick={() => void loginAction.run()} disabled={loginAction.busy}>
            {loginAction.busy ? 'Anmelden…' : 'Anmelden'}
          </Button>
        </>}
      >
        <div className="flex flex-col gap-2">
          <Input
            type="password"
            placeholder="Passwort"
            value={loginPw}
            onChange={e => setLoginPw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void loginAction.run(); } }}
            autoFocus
          />
          {loginError ? <div className="text-[12px] text-red-700">{loginError}</div> : null}
          {loginAction.error ? <div className="text-[12px] text-red-700">{loginAction.error}</div> : null}
        </div>
      </Dialog>

      {/* Passwort-aendern-Dialog */}
      <Dialog
        open={changeOpen}
        onClose={() => { setChangeOpen(false); setChangeError(null); changeAction.clearError(); }}
        title="Passwort ändern"
        footer={<>
          <Button size="sm" variant="ghost" onClick={() => { setChangeOpen(false); setChangeError(null); changeAction.clearError(); }}>
            Abbrechen
          </Button>
          <Button size="sm" variant="default" onClick={() => void changeAction.run()} disabled={changeAction.busy}>
            {changeAction.busy ? 'Speichern…' : 'Speichern'}
          </Button>
        </>}
      >
        <div className="flex flex-col gap-2">
          <Input
            type="password"
            placeholder="Altes Passwort"
            value={oldPw}
            onChange={e => setOldPw(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Neues Passwort"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
          />
          {changeError ? <div className="text-[12px] text-red-700">{changeError}</div> : null}
          {changeAction.error ? <div className="text-[12px] text-red-700">{changeAction.error}</div> : null}
        </div>
      </Dialog>
    </div>
  );
}

// Lokales Status-Pill (bewusst nicht aus dev-infrastructure-test importiert,
// um Cross-Plugin-Abhaengigkeit zu vermeiden).
function StatusPill({ label, tone }: { label: string; tone: 'ok' | 'neutral' }): React.ReactElement {
  const cls = tone === 'ok'
    ? 'bg-emerald-50 text-emerald-800'
    : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] ${cls}`}>
      {label}
    </span>
  );
}
