/**
 * PrivacyChip — schmaler Page-Header-Chip fuer die Klartext-Anzeige.
 *
 * Ersetzt den ehemaligen `DeAnonPanel`-Banner. Sichtbar nur wenn das Feature
 * aktiv ist (Aufrufer gated mit `isDeAnonymisierungEnabled()`).
 *
 * Inhalt:
 *  - inaktiv: EyeOff-Icon + "anonymisiert"
 *  - aktiv:   Eye-Icon + "Klartext (Xh)" (Restzeit)
 *
 * Klick toggelt das Popover (PrivacyPopover) — schliesst per Click-Outside
 * oder Escape. Aktivitaets-Tracker laeuft unabhaengig im Hintergrund.
 */
import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';
import { useStorage } from '@/core/hooks/useStorage';
import { useDeAnonSession, useDeAnonActivityTracker } from '../../hooks/useDeAnonSession';
import { PrivacyPopover } from './PrivacyPopover';

function formatRemainingShort(expiresAt: number | null): string {
  if (!expiresAt) return '';
  const ms = expiresAt - Date.now();
  if (ms <= 0) return '';
  const h = Math.floor(ms / (3600 * 1000));
  if (h > 0) return `${h}h`;
  const m = Math.max(1, Math.floor(ms / (60 * 1000)));
  return `${m}m`;
}

export function PrivacyChip(): React.ReactElement {
  const storage = useStorage();
  const session = useDeAnonSession();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Activity-Tracker registrieren (verlaengert TTL bei Klicks/Tastatur).
  useDeAnonActivityTracker(storage.idb);

  // Mount: persistierte Session rehydrieren.
  useEffect(() => {
    void session.rehydrate(storage.idb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage.idb]);

  // 30s-Tick: ablaufende Sessions wegfangen.
  useEffect(() => {
    const t = setInterval(() => session.tick(storage.idb), 30_000);
    return () => clearInterval(t);
  }, [session, storage.idb]);

  // Escape schliesst das Popover.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useClickOutside(wrapperRef, () => setOpen(false), open);

  const active = session.isActive;
  const remaining = active ? formatRemainingShort(session.expiresAt) : '';
  const label = active
    ? (remaining ? `Klartext (${remaining})` : 'Klartext aktiv')
    : 'anonymisiert';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 cursor-pointer transition-colors hover:bg-[var(--tf-hover)]"
        style={{
          height: 22,
          padding: '3px 8px 3px 7px',
          borderRadius: 'var(--tf-radius-pill)',
          border: '0.5px solid',
          borderColor: open ? 'var(--tf-border-hover)' : 'var(--tf-border)',
          background: open ? 'var(--tf-bg-secondary)' : 'transparent',
          color: open ? 'var(--tf-text)' : 'var(--tf-text-tertiary)',
          fontSize: 11,
          lineHeight: 1,
        }}
      >
        {active ? <Eye size={11} /> : <EyeOff size={11} />}
        <span>{label}</span>
      </button>
      {open && <PrivacyPopover onRequestClose={() => setOpen(false)} />}
    </div>
  );
}
