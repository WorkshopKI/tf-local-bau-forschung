/**
 * Passwort-Dialog fuer den verschluesselten Export.
 *
 * Pflichtfelder: Passwort + Bestaetigung. Min-Laenge 8. Stärke-Indikator
 * (rein heuristisch: Laenge + Zeichenklassen).
 */
import { useMemo, useState } from 'react';
import { useDialogEsc } from './useDialogEsc';

interface Props {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void> | void;
  title?: string;
  description?: string;
}

interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

function strength(pw: string): Strength {
  if (pw.length < 4) return { score: 0, label: 'Zu kurz', color: 'bg-rose-500' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const map: Strength[] = [
    { score: 0, label: 'Sehr schwach', color: 'bg-rose-500' },
    { score: 1, label: 'Schwach', color: 'bg-amber-500' },
    { score: 2, label: 'OK', color: 'bg-amber-400' },
    { score: 3, label: 'Gut', color: 'bg-emerald-500' },
    { score: 4, label: 'Stark', color: 'bg-emerald-600' },
  ];
  return map[s] ?? map[0]!;
}

export function PasswortDialog({
  open, busy, onClose, onConfirm,
  title = 'Passwort setzen',
  description = 'Das XLSX wird in einem AES-256-verschlüsselten ZIP gespeichert. Ohne dieses Passwort kann es nicht geöffnet werden — bitte sicher aufbewahren.',
}: Props): React.ReactElement | null {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = useMemo(() => strength(pw1), [pw1]);
  const valid = pw1.length >= 8 && pw1 === pw2;

  useDialogEsc(open, !!busy, onClose);

  if (!open) return null;

  async function submit(): Promise<void> {
    if (pw1.length < 8) { setError('Mindestens 8 Zeichen.'); return; }
    if (pw1 !== pw2) { setError('Passwörter stimmen nicht überein.'); return; }
    setError(null);
    await onConfirm(pw1);
    setPw1(''); setPw2('');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.35)' }}
    >
      <div
        className="w-[420px] max-h-[90vh] overflow-y-auto rounded-[12px] p-5 flex flex-col gap-3"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium">{title}</h3>
          <button type="button" onClick={onClose} disabled={busy} className="cursor-pointer text-[var(--tf-text-tertiary)] disabled:opacity-50">×</button>
        </div>
        <p className="text-[12px] text-[var(--tf-text-secondary)]">{description}</p>

        <div className="flex flex-col gap-1">
          <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Passwort</label>
          <input
            type={show ? 'text' : 'password'}
            value={pw1}
            onChange={e => setPw1(e.target.value)}
            autoFocus
            disabled={busy}
            className="text-[13px] px-2 py-1.5 rounded outline-none"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </div>

        {pw1 && (
          <div>
            <div className="flex items-center justify-between text-[10.5px] mb-1">
              <span className="text-[var(--tf-text-tertiary)]">Stärke</span>
              <span className="text-[var(--tf-text-secondary)]">{s.label}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden flex" style={{ background: 'var(--tf-bg-secondary)' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`flex-1 mx-[1px] ${i < s.score ? s.color : ''}`} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Passwort bestätigen</label>
          <input
            type={show ? 'text' : 'password'}
            value={pw2}
            onChange={e => setPw2(e.target.value)}
            disabled={busy}
            className="text-[13px] px-2 py-1.5 rounded outline-none"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </div>

        <label className="flex items-center gap-2 text-[11.5px] cursor-pointer">
          <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />
          <span>Passwort anzeigen</span>
        </label>

        {error && <div className="text-[11.5px] text-rose-700">{error}</div>}

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || busy}
            className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            {busy ? 'Exportiere…' : 'Verschlüsselt exportieren'}
          </button>
        </div>
      </div>
    </div>
  );
}
