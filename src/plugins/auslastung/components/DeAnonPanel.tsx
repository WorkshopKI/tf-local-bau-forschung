/**
 * DeAnonPanel (v2.5) — Setup/Activate/Deactivate/ChangePassword fuer die
 * Klartext-Anzeige der TIB-Kuerzel im Auslastungs-Modul.
 *
 * Sichtbar nur in dev + pl Varianten (Feature-Flag `deAnonymisierung`).
 * Liegt im Uebersicht-Tab als kleine Section oben. State:
 *  - **nicht konfiguriert**: "Klartext-Anzeige einrichten" Button → Passwort
 *    setzen.
 *  - **konfiguriert, inaktiv**: "Klartext-Anzeige aktivieren" Button →
 *    Passwort verifizieren, Session starten.
 *  - **aktiv**: Banner mit verbleibender Zeit + "Deaktivieren"-Button.
 *
 * Sekundaeraktion "Passwort aendern" jederzeit verfuegbar (bei konfigurierter
 * Datei). Activity-Tracker ist im Hook implementiert — solange irgendwo in
 * der App geklickt wird, verlaengert sich die 24h-TTL.
 */
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, RotateCcw } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useDeAnonSession, useDeAnonActivityTracker } from '../hooks/useDeAnonSession';

type Mode = 'idle' | 'setup' | 'activate' | 'change-password';

function formatRemaining(expiresAt: number | null): string {
  if (!expiresAt) return '';
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'abgelaufen';
  const h = Math.floor(ms / (3600 * 1000));
  const m = Math.floor((ms % (3600 * 1000)) / (60 * 1000));
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function DeAnonPanel(): React.ReactElement {
  const storage = useStorage();
  const session = useDeAnonSession();
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwOld, setPwOld] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Activity-Tracker registrieren (verlaengert TTL bei Klicks/Tastatur).
  useDeAnonActivityTracker(storage.idb);

  // Beim Mount: konfiguriert? + Session rehydratisieren
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const configured = await session.isConfigured(storage.idb);
      await session.rehydrate(storage.idb);
      if (!cancelled) setIsConfigured(configured);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage.idb]);

  // 30s-Tick: ablaufende Session wegfangen (parallel zum Shell-Tick).
  useEffect(() => {
    const t = setInterval(() => session.tick(storage.idb), 30_000);
    return () => clearInterval(t);
  }, [session, storage.idb]);

  const resetForm = (): void => {
    setPw1('');
    setPw2('');
    setPwOld('');
    setError(null);
    setInfo(null);
    setMode('idle');
    setShowPw(false);
  };

  const setupAction = useAsyncAction(async () => {
    setError(null);
    if (pw1.length < 4) {
      setError('Passwort muss mindestens 4 Zeichen haben.');
      return;
    }
    if (pw1 !== pw2) {
      setError('Passwoerter stimmen nicht ueberein.');
      return;
    }
    const ok = await session.setup(storage.idb, pw1);
    if (!ok) {
      setError('Setup fehlgeschlagen. SMB-Handle verfuegbar?');
      return;
    }
    setIsConfigured(true);
    setInfo('Passwort gesetzt. Du kannst jetzt aktivieren.');
    setPw1(''); setPw2('');
    setMode('idle');
  });

  const activateAction = useAsyncAction(async () => {
    setError(null);
    const ok = await session.activate(storage.idb, pw1);
    if (!ok) {
      setError('Passwort falsch.');
      return;
    }
    resetForm();
  });

  const deactivateAction = useAsyncAction(async () => {
    await session.deactivate(storage.idb);
    resetForm();
  });

  const changePwAction = useAsyncAction(async () => {
    setError(null);
    if (pw1.length < 4) {
      setError('Neues Passwort zu kurz (min. 4 Zeichen).');
      return;
    }
    if (pw1 !== pw2) {
      setError('Neue Passwoerter stimmen nicht ueberein.');
      return;
    }
    const ok = await session.changePassword(storage.idb, pwOld, pw1);
    if (!ok) {
      setError('Altes Passwort falsch.');
      return;
    }
    setInfo('Passwort geaendert.');
    setPw1(''); setPw2(''); setPwOld('');
    setMode('idle');
  });

  if (isConfigured === null) {
    return (
      <div className="rounded-[12px] p-3 text-[11.5px] text-[var(--tf-text-tertiary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
        Klartext-Anzeige wird geprüft …
      </div>
    );
  }

  // ─── Aktive Session ───────────────────────────────────────────────────
  if (session.isActive) {
    return (
      <div
        className="rounded-[12px] p-3 flex items-center gap-3"
        style={{ border: '0.5px solid var(--tf-success-border, var(--tf-border))', background: 'var(--tf-success-soft, transparent)' }}
      >
        <Eye size={16} className="text-[var(--tf-success-text, var(--tf-text))]" />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium text-[var(--tf-text)]">
            Klartext-Anzeige aktiv
          </p>
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            Verbleibend: {formatRemaining(session.expiresAt)} · verlaengert sich bei Aktivität
          </p>
        </div>
        <button
          type="button"
          onClick={() => deactivateAction.run()}
          disabled={deactivateAction.busy}
          className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer"
          style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
        >
          Deaktivieren
        </button>
      </div>
    );
  }

  // ─── Setup (noch nie konfiguriert) ───────────────────────────────────
  if (!isConfigured) {
    if (mode === 'setup') {
      return (
        <PanelShell
          icon={<Lock size={16} />}
          title="Klartext-Anzeige einrichten"
          subtitle="Einmaliges Setup. Das Passwort liegt verschlüsselt auf dem Daten-Share."
        >
          <PasswordRow label="Passwort" value={pw1} onChange={setPw1} show={showPw} onToggleShow={setShowPw} autoFocus />
          <PasswordRow label="Wiederholen" value={pw2} onChange={setPw2} show={showPw} onToggleShow={setShowPw} />
          {error && <ErrorRow text={error} />}
          {info && <InfoRow text={info} />}
          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={resetForm}>Abbrechen</SecondaryButton>
            <PrimaryButton onClick={() => setupAction.run()} disabled={setupAction.busy}>
              {setupAction.busy ? 'Speichere …' : 'Einrichten'}
            </PrimaryButton>
          </div>
        </PanelShell>
      );
    }
    return (
      <PanelShell
        icon={<EyeOff size={16} />}
        title="Klartext-Anzeige nicht eingerichtet"
        subtitle="MAs werden anonymisiert angezeigt (MA01..MAxx). Richte ein PL-Passwort ein, um die echten Kürzel parallel zu sehen."
      >
        <div className="flex justify-end pt-1">
          <PrimaryButton onClick={() => setMode('setup')}>Einrichten</PrimaryButton>
        </div>
      </PanelShell>
    );
  }

  // ─── Konfiguriert + inaktiv ──────────────────────────────────────────
  if (mode === 'activate') {
    return (
      <PanelShell
        icon={<Lock size={16} />}
        title="Klartext-Anzeige aktivieren"
        subtitle="Passwort eingeben. Session läuft 24h, verlängert sich bei Aktivität."
      >
        <PasswordRow label="Passwort" value={pw1} onChange={setPw1} show={showPw} onToggleShow={setShowPw} autoFocus
          onEnter={() => activateAction.run()} />
        {error && <ErrorRow text={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={resetForm}>Abbrechen</SecondaryButton>
          <PrimaryButton onClick={() => activateAction.run()} disabled={activateAction.busy}>
            {activateAction.busy ? 'Prüfe …' : 'Aktivieren'}
          </PrimaryButton>
        </div>
      </PanelShell>
    );
  }

  if (mode === 'change-password') {
    return (
      <PanelShell
        icon={<RotateCcw size={16} />}
        title="Passwort ändern"
        subtitle="Altes Passwort + neues Passwort eingeben."
      >
        <PasswordRow label="Altes Passwort" value={pwOld} onChange={setPwOld} show={showPw} onToggleShow={setShowPw} autoFocus />
        <PasswordRow label="Neues Passwort" value={pw1} onChange={setPw1} show={showPw} onToggleShow={setShowPw} />
        <PasswordRow label="Wiederholen" value={pw2} onChange={setPw2} show={showPw} onToggleShow={setShowPw} />
        {error && <ErrorRow text={error} />}
        {info && <InfoRow text={info} />}
        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={resetForm}>Abbrechen</SecondaryButton>
          <PrimaryButton onClick={() => changePwAction.run()} disabled={changePwAction.busy}>
            {changePwAction.busy ? 'Speichere …' : 'Ändern'}
          </PrimaryButton>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      icon={<EyeOff size={16} />}
      title="Klartext-Anzeige inaktiv"
      subtitle="MAs werden anonymisiert angezeigt (MA01..MAxx). Mit Passwort kannst du parallel die echten Kürzel sehen."
    >
      {info && <InfoRow text={info} />}
      <div className="flex justify-end gap-2 pt-1">
        <SecondaryButton onClick={() => { setInfo(null); setMode('change-password'); }}>Passwort ändern</SecondaryButton>
        <PrimaryButton onClick={() => { setInfo(null); setMode('activate'); }}>Aktivieren</PrimaryButton>
      </div>
    </PanelShell>
  );
}

function PanelShell({ icon, title, subtitle, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-[12px] p-3 flex flex-col gap-2" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-start gap-2">
        <span className="text-[var(--tf-text-secondary)] mt-0.5">{icon}</span>
        <div className="flex-1">
          <p className="text-[12.5px] font-medium text-[var(--tf-text)]">{title}</p>
          <p className="text-[11px] text-[var(--tf-text-tertiary)] leading-snug">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function PasswordRow({ label, value, onChange, show, onToggleShow, autoFocus, onEnter }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: (v: boolean) => void;
  autoFocus?: boolean;
  onEnter?: () => void;
}): React.ReactElement {
  return (
    <label className="flex items-center gap-2 text-[12px]">
      <span className="w-[120px] text-[var(--tf-text-secondary)]">{label}</span>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter(); }}
        autoFocus={autoFocus}
        className="flex-1 px-2 py-1 rounded font-mono text-[12px]"
        style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
      />
      <button
        type="button"
        onClick={() => onToggleShow(!show)}
        className="px-1.5 py-1 rounded cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
        aria-label={show ? 'Verbergen' : 'Zeigen'}
        title={show ? 'Verbergen' : 'Zeigen'}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </label>
  );
}

function ErrorRow({ text }: { text: string }): React.ReactElement {
  return <p className="text-[11.5px] text-[var(--tf-danger-text)]">{text}</p>;
}

function InfoRow({ text }: { text: string }): React.ReactElement {
  return <p className="text-[11.5px] text-[var(--tf-text-secondary)]">{text}</p>;
}

function PrimaryButton({ onClick, disabled, children }: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
      style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, children }: {
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer"
      style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
    >
      {children}
    </button>
  );
}
