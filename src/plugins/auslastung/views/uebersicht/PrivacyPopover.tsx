/**
 * PrivacyPopover — Popover-Body fuer die Klartext-Anzeige der TIB-Kuerzel.
 *
 * Portiert die State-Machine aus dem ehemaligen `DeAnonPanel`-Banner in einen
 * schmalen Popover-Container (max-width 460px), der vom `PrivacyChip`
 * positioniert wird. Modi:
 *   - idle:           Status anzeigen + Aktionen (Aktivieren / Passwort aendern / Deaktivieren)
 *   - setup:          Initial-Passwort anlegen
 *   - activate:       Passwort verifizieren + Session starten
 *   - change-password: Altes + neues Passwort
 */
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, RotateCcw } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useDeAnonSession } from '../../hooks/useDeAnonSession';

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

interface Props {
  onRequestClose: () => void;
}

export function PrivacyPopover({ onRequestClose }: Props): React.ReactElement {
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const configured = await session.isConfigured(storage.idb);
      if (!cancelled) setIsConfigured(configured);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage.idb]);

  const resetForm = (): void => {
    setPw1(''); setPw2(''); setPwOld('');
    setError(null); setInfo(null);
    setMode('idle'); setShowPw(false);
  };

  const setupAction = useAsyncAction(async () => {
    setError(null);
    if (pw1.length < 4) { setError('Passwort muss mindestens 4 Zeichen haben.'); return; }
    if (pw1 !== pw2) { setError('Passwörter stimmen nicht überein.'); return; }
    const ok = await session.setup(storage.idb, pw1);
    if (!ok) { setError('Setup fehlgeschlagen. SMB-Handle verfügbar?'); return; }
    setIsConfigured(true);
    setInfo('Passwort gesetzt. Du kannst jetzt aktivieren.');
    setPw1(''); setPw2('');
    setMode('idle');
  });

  const activateAction = useAsyncAction(async () => {
    setError(null);
    const ok = await session.activate(storage.idb, pw1);
    if (!ok) { setError('Passwort falsch.'); return; }
    resetForm();
    onRequestClose();
  });

  const deactivateAction = useAsyncAction(async () => {
    await session.deactivate(storage.idb);
    resetForm();
  });

  const changePwAction = useAsyncAction(async () => {
    setError(null);
    if (pw1.length < 4) { setError('Neues Passwort zu kurz (min. 4 Zeichen).'); return; }
    if (pw1 !== pw2) { setError('Neue Passwörter stimmen nicht überein.'); return; }
    const ok = await session.changePassword(storage.idb, pwOld, pw1);
    if (!ok) { setError('Altes Passwort falsch.'); return; }
    setInfo('Passwort geändert.');
    setPw1(''); setPw2(''); setPwOld('');
    setMode('idle');
  });

  return (
    <div
      role="dialog"
      aria-label="Klartext-Anzeige"
      className="absolute z-50 mt-2 right-0 flex flex-col gap-2"
      style={{
        padding: '14px 16px',
        border: '0.5px solid var(--tf-border-hover)',
        borderRadius: 10,
        background: 'var(--tf-bg)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        maxWidth: 460,
        width: 'max-content',
        minWidth: 320,
      }}
    >
      {isConfigured === null && (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">Wird geprüft …</p>
      )}

      {/* Aktive Session, idle */}
      {isConfigured !== null && session.isActive && mode === 'idle' && (
        <>
          <HeaderRow
            icon={<Eye size={14} />}
            title="Klartext-Anzeige aktiv"
            subtitle={`Verbleibend: ${formatRemaining(session.expiresAt)} · verlängert sich bei Aktivität.`}
          />
          <FooterRow>
            <LinkButton onClick={() => { setInfo(null); setMode('change-password'); }} variant="neutral">
              Passwort ändern
            </LinkButton>
            <LinkButton
              onClick={() => deactivateAction.run()}
              variant="neutral"
              className="ml-auto"
              disabled={deactivateAction.busy}
            >
              Deaktivieren
            </LinkButton>
          </FooterRow>
        </>
      )}

      {/* Setup-Eingang */}
      {isConfigured === false && mode === 'idle' && (
        <>
          <HeaderRow
            icon={<EyeOff size={14} />}
            title="Klartext-Anzeige nicht eingerichtet"
            subtitle="MAs werden anonymisiert angezeigt (MA01…MAxx). Richte ein PL-Passwort ein, um die echten Kürzel parallel zu sehen."
          />
          <FooterRow>
            <LinkButton onClick={() => setMode('setup')} variant="primary" className="ml-auto">
              Einrichten →
            </LinkButton>
          </FooterRow>
        </>
      )}

      {isConfigured === false && mode === 'setup' && (
        <FormBody
          icon={<Lock size={14} />}
          title="Klartext-Anzeige einrichten"
          subtitle="Einmaliges Setup. Das Passwort liegt verschlüsselt auf dem Daten-Share."
          error={error}
          info={info}
          onCancel={resetForm}
          submitLabel={setupAction.busy ? 'Speichere …' : 'Einrichten'}
          submitBusy={setupAction.busy}
          onSubmit={() => void setupAction.run()}
        >
          <PasswordRow label="Passwort" value={pw1} onChange={setPw1} show={showPw} onToggleShow={setShowPw} autoFocus />
          <PasswordRow label="Wiederholen" value={pw2} onChange={setPw2} show={showPw} onToggleShow={setShowPw} />
        </FormBody>
      )}

      {/* Konfiguriert + inaktiv, idle */}
      {isConfigured === true && !session.isActive && mode === 'idle' && (
        <>
          <HeaderRow
            icon={<EyeOff size={14} />}
            title="Klartext-Anzeige inaktiv"
            subtitle="MAs werden anonymisiert als MA01…MAxx angezeigt. Mit Passwort kannst du die echten Kürzel parallel sehen."
          />
          {info && <InfoText text={info} />}
          <FooterRow>
            <LinkButton onClick={() => { setInfo(null); setMode('change-password'); }} variant="neutral">
              Passwort ändern
            </LinkButton>
            <LinkButton
              onClick={() => { setInfo(null); setMode('activate'); }}
              variant="primary"
              className="ml-auto"
            >
              Klartext aktivieren →
            </LinkButton>
          </FooterRow>
        </>
      )}

      {isConfigured === true && !session.isActive && mode === 'activate' && (
        <FormBody
          icon={<Lock size={14} />}
          title="Klartext-Anzeige aktivieren"
          subtitle="Passwort eingeben. Session läuft 24h, verlängert sich bei Aktivität."
          error={error}
          info={null}
          onCancel={resetForm}
          submitLabel={activateAction.busy ? 'Prüfe …' : 'Aktivieren'}
          submitBusy={activateAction.busy}
          onSubmit={() => void activateAction.run()}
        >
          <PasswordRow
            label="Passwort"
            value={pw1}
            onChange={setPw1}
            show={showPw}
            onToggleShow={setShowPw}
            autoFocus
            onEnter={() => void activateAction.run()}
          />
        </FormBody>
      )}

      {isConfigured === true && mode === 'change-password' && (
        <FormBody
          icon={<RotateCcw size={14} />}
          title="Passwort ändern"
          subtitle="Altes + neues Passwort eingeben."
          error={error}
          info={info}
          onCancel={resetForm}
          submitLabel={changePwAction.busy ? 'Speichere …' : 'Ändern'}
          submitBusy={changePwAction.busy}
          onSubmit={() => void changePwAction.run()}
        >
          <PasswordRow label="Altes Passwort" value={pwOld} onChange={setPwOld} show={showPw} onToggleShow={setShowPw} autoFocus />
          <PasswordRow label="Neues Passwort" value={pw1} onChange={setPw1} show={showPw} onToggleShow={setShowPw} />
          <PasswordRow label="Wiederholen" value={pw2} onChange={setPw2} show={showPw} onToggleShow={setShowPw} />
        </FormBody>
      )}
    </div>
  );
}

function HeaderRow({ icon, title, subtitle }: {
  icon: React.ReactNode; title: string; subtitle: string;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[var(--tf-text)] mt-[2px]">{icon}</span>
      <div>
        <p className="text-[12.5px] font-medium text-[var(--tf-text)]">{title}</p>
        <p className="text-[12px] text-[var(--tf-text-secondary)] leading-snug">{subtitle}</p>
      </div>
    </div>
  );
}

function FooterRow({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      className="pt-2 mt-1 flex items-center gap-3"
      style={{ borderTop: '0.5px solid var(--tf-border)' }}
    >
      {children}
    </div>
  );
}

function LinkButton({
  children, onClick, variant, className, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant: 'primary' | 'neutral';
  className?: string;
  disabled?: boolean;
}): React.ReactElement {
  const color = variant === 'primary' ? 'var(--tf-primary)' : 'var(--tf-text-secondary)';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-[12px] cursor-pointer hover:underline disabled:opacity-50 ${className ?? ''}`}
      style={{ color }}
    >
      {children}
    </button>
  );
}

function InfoText({ text }: { text: string }): React.ReactElement {
  return <p className="text-[11.5px] text-[var(--tf-text-secondary)]">{text}</p>;
}

function FormBody({
  icon, title, subtitle, children, error, info,
  onCancel, onSubmit, submitLabel, submitBusy,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  error: string | null;
  info: string | null;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitBusy: boolean;
}): React.ReactElement {
  return (
    <>
      <HeaderRow icon={icon} title={title} subtitle={subtitle} />
      <div className="flex flex-col gap-1.5">{children}</div>
      {error && <p className="text-[11.5px] text-[var(--tf-danger-text)]">{error}</p>}
      {info && <InfoText text={info} />}
      <div
        className="pt-2 mt-1 flex justify-end gap-2"
        style={{ borderTop: '0.5px solid var(--tf-border)' }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 rounded-md text-[12px] text-[var(--tf-text-secondary)] cursor-pointer"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitBusy}
          className="px-2.5 py-1 rounded-md text-[12px] font-medium cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          {submitLabel}
        </button>
      </div>
    </>
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
