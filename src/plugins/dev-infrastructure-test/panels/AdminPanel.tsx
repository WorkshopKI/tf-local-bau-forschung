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
import { ActionRow, Field, SectionCaption, StatusPill } from './shared';

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
    <div className="px-8 py-6 max-w-[760px]">
      <h2 className="text-[18px] font-medium text-[var(--tf-text)]">Kurator-Modus</h2>
      <p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed mt-1.5 mb-5 max-w-[620px]">
        Eine Session, in der schreibende Aktionen erlaubt sind und das Audit-Log konsistent geführt wird.
      </p>

      <Field label="Zustand">
        <div className="flex items-center flex-wrap gap-2">
          <StatusPill
            label={session.isActive ? 'aktiv' : configured ? 'konfiguriert · inaktiv' : 'nicht konfiguriert'}
            tone={session.isActive ? 'ok' : 'neutral'}
          />
          {session.kuratorName ? (
            <span className="text-[12px] text-[var(--tf-text-secondary)]">{session.kuratorName}</span>
          ) : null}
          {expiryLabel ? (
            <span className="text-[12px] text-[var(--tf-text-tertiary)]">· läuft noch {expiryLabel}</span>
          ) : null}
        </div>
      </Field>

      <Field label="Session-Dauer (TTL)">
        <div className="flex flex-wrap gap-1.5">
          {TTL_OPTIONS.map(opt => {
            const on = session.ttlMs === opt.ms;
            return (
              <button
                key={opt.ms}
                type="button"
                onClick={() => session.setTtl(opt.ms)}
                className={`px-3 py-1 rounded-full text-[12px] cursor-pointer transition-colors ${
                  on
                    ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]'
                    : 'bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                }`}
                style={on ? undefined : { border: '0.5px solid var(--tf-border)' }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <SectionCaption>Aktionen</SectionCaption>
      {!configured ? (
        <ActionRow
          title="Kurator-Modus initialisieren"
          hint={hasHandle
            ? 'Legt Kurator-Name + Passwort an. kurator-config.enc landet im _intern-Ordner.'
            : 'Erst Daten-Share-Root in Tab 2 auswählen.'}
          btn={
            <Button
              size="sm"
              onClick={() => setSetupOpen(true)}
              disabled={!hasHandle}
            >
              Initialisieren
            </Button>
          }
        />
      ) : !session.isActive ? (
        <ActionRow
          title="Kurator-Modus aktivieren"
          hint="Schaltet schreibende Aktionen frei. TTL läuft, sobald die Session aktiv ist."
          btn={<Button size="sm" onClick={() => setLoginOpen(true)}>Anmelden</Button>}
        />
      ) : (
        <>
          <ActionRow
            title="Session erneuern"
            hint="Setzt die TTL zurück, ohne abzumelden."
            btn={<Button size="sm" onClick={() => session.extend()}>Erneuern</Button>}
          />
          <ActionRow
            title="Abmelden"
            hint="Beendet die Schreib-Session. Sicher und sauber."
            btn={<Button size="sm" variant="outline" onClick={() => void onLogout()}>Abmelden</Button>}
          />
          <ActionRow
            title="Passwort ändern"
            hint="Ersetzt den AES-GCM-Key. Bricht keine laufende Session."
            btn={<Button size="sm" variant="outline" onClick={() => setChangeOpen(true)}>Ändern</Button>}
          />
        </>
      )}

      <div className="flex items-baseline justify-between mt-6 mb-2.5">
        <h3 className="text-[11px] uppercase text-[var(--tf-text-tertiary)] font-medium" style={{ letterSpacing: '0.08em' }}>
          Audit-Log
        </h3>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          ↻ neu laden
        </button>
      </div>
      <div
        className="rounded-[var(--tf-radius)] p-3 bg-[var(--tf-bg-secondary)] font-mono text-[11.5px] leading-[1.7]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {audits.length === 0 ? (
          <span className="text-[var(--tf-text-tertiary)]">Keine Einträge.</span>
        ) : (
          audits.slice().reverse().map((a, i) => (
            <div key={i}>
              <span className="text-[var(--tf-text-tertiary)]">{a.ts.slice(11, 19)}</span>
              <span className="ml-3 text-[var(--tf-text-secondary)]">{a.user}</span>
              <span className="ml-3 text-[var(--tf-text)]">{a.action}</span>
            </div>
          ))
        )}
      </div>

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
          <Input
            type="password"
            placeholder="Passwort"
            value={loginPw}
            onChange={e => setLoginPw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void onLogin(); } }}
            autoFocus
          />
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
