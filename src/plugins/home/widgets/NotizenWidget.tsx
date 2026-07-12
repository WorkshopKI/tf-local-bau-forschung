/**
 * Notizen-Widget (Home, Seitenspalte — Phase 3): Plaintext-Mehrzeiler,
 * bewusst trivial (kein Markdown, keine KI). Persistenz strikt gerätelokal
 * (notizenStore.ts). Speichern debounced + beim Verlassen des Felds.
 */
import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useStorage } from '@/core/hooks/useStorage';
import { loadNotizen, saveNotizen } from './notizenStore';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const SPEICHER_DEBOUNCE_MS = 600;

export function NotizenWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const storage = useStorage();
  const [text, setText] = useState('');
  const [geladen, setGeladen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadNotizen(storage.idb)
      .then(t => { if (!cancelled) { setText(t); setGeladen(true); } })
      .catch(() => { if (!cancelled) setGeladen(true); });
    return () => { cancelled = true; };
  }, [storage.idb]);

  const persist = (wert: string): void => {
    saveNotizen(storage.idb, wert).catch(err => {
      console.warn('[home-notizen] Speichern fehlgeschlagen', err);
    });
  };

  const onChange = (wert: string): void => {
    setText(wert);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => persist(wert), SPEICHER_DEBOUNCE_MS);
  };

  // Beim Unmount letzten Stand sichern (Debounce-Rest).
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  return (
    <WidgetShell
      titel="Notizen"
      variante="seite"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
    >
      <Textarea
        value={text}
        disabled={!geladen}
        onChange={e => onChange(e.target.value)}
        onBlur={() => {
          if (timer.current !== null) window.clearTimeout(timer.current);
          persist(text);
        }}
        placeholder="Kurze Notizen für dich selbst …"
        rows={4}
        className="text-[12.5px] leading-snug resize-y min-h-[72px]"
      />
      <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-[var(--tf-text-tertiary)]">
        <Lock size={10} className="shrink-0" aria-hidden />
        Nur lokal · nie im Snapshot
      </p>
    </WidgetShell>
  );
}
