/**
 * Gruppe „Account" — wer du bist (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 01).
 *
 * Avatar, Name (inline änderbar), Kürzel-Badge und darunter eine Zeile
 * Zusammenfassung: Programm · Hauptkategorie · Antragstypen. Die Zeile trägt
 * den Anker `sec-programm` — die frühere eigene Sektion „Programmkennung" ist
 * genau diese eine Angabe, und eine eigene Überschrift dafür war zu laut.
 */
import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { kuerzelFuerAnzeige, profilAvatarText } from '@/core/utils/profil-anzeige';
import { Avatar, InfoHint } from '../_shared/settings-primitives';
import { SettingsGruppe, useSprungTreffer } from '@/components/settings';

const TOOLTIP_PROGRAMM =
  'Deine anonyme Programm-ID. Ordnet deine Technologien im Team-Auslastungs-Profil zu, ohne den Klarnamen preiszugeben.';

const KUERZEL_TITEL = 'Dein Bearbeiter-Kürzel — änderbar unter „Welche Anträge du siehst".';

export function AccountGruppe({
  anonId,
  hauptKategorie,
  antragstypen,
}: {
  /** Anonyme Programm-ID (MA-Id) oder null, solange kein Kürzel hinterlegt ist. */
  anonId: string | null;
  hauptKategorie: string;
  antragstypen: readonly string[];
}): React.ReactElement {
  const { profile, updateProfile } = useProfile();
  const meinKuerzel = useMeinKuerzel();
  const avatarText = profilAvatarText(meinKuerzel, profile?.name);
  // „alle" ist der Aus-Zustand des Filters, kein Kürzel — die Pille dürfte
  // sonst „Kürzel ALLE" behaupten (dieselbe Regel wie im Avatar).
  const kuerzelPille = kuerzelFuerAnzeige(meinKuerzel);
  const programmTreffer = useSprungTreffer('sec-programm');

  // Ohne Programm-Id zeigt das Fachprofil daneben seinen Leerzustand — dann
  // wären Hauptkategorie und Antragstypen hier eine Angabe ohne Gegenstück.
  const teile: React.ReactNode[] = [];
  if (!anonId) {
    teile.push(<>Kein Kürzel hinterlegt</>);
  } else {
    teile.push(<>Programm <b className="font-medium text-[var(--tf-text-secondary)]">{anonId}</b></>);
    if (hauptKategorie) {
      teile.push(
        <>Hauptkategorie <b className="font-medium text-[var(--tf-text-secondary)]">{hauptKategorie}</b></>,
      );
    }
    if (antragstypen.length > 0) {
      teile.push(
        <><b className="font-medium text-[var(--tf-text-secondary)]">{antragstypen.join(', ')}</b>-Anträge</>,
      );
    }
  }

  return (
    <SettingsGruppe id="sec-account" titel="Account">
      <div className="flex items-center gap-3 py-2">
        <Avatar text={avatarText} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-medium text-[var(--tf-text)]">
              {profile?.name ?? '—'}
            </span>
            {kuerzelPille && (
              <span
                className="inline-flex items-center text-[11px] px-2 py-[2px] rounded-full text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)]"
                title={KUERZEL_TITEL}
              >
                Kürzel {kuerzelPille}
              </span>
            )}
          </div>
          {/* Eigener Anker ohne Layout-Bauteil — die Treffer-Markierung holt
              sich die Zeile deshalb direkt aus dem Sprung-Kontext. */}
          <p
            id="sec-programm"
            data-tf-treffer={programmTreffer ? '' : undefined}
            className="scroll-mt-20 text-[12px] leading-[1.5] text-[var(--tf-text-tertiary)] mt-0.5 flex items-center gap-1.5 flex-wrap"
          >
            {teile.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>·</span>}
                {t}
              </span>
            ))}
            <InfoHint text={TOOLTIP_PROGRAMM} titel="Programmkennung" />
          </p>
        </div>
        <NameEditor
          name={profile?.name ?? ''}
          onSave={n => updateProfile({ name: n })}
        />
      </div>
    </SettingsGruppe>
  );
}

function NameEditor({
  name,
  onSave,
}: {
  name: string;
  onSave: (next: string) => void;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(name);
    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [editing, name]);

  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setDraft(name); }
        }}
        aria-label="Name"
        className="h-[30px] px-2.5 text-[13px] font-medium text-[var(--tf-text)] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] min-w-[160px] shrink-0"
        style={{ border: '0.5px solid var(--tf-border-hover)' }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="shrink-0 inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[var(--tf-radius)] text-[12.5px] font-medium text-[var(--tf-text)] bg-[var(--tf-bg)] hover:bg-[var(--tf-hover)] cursor-pointer"
      style={{ border: '0.5px solid var(--tf-border-hover)' }}
    >
      <Pencil size={12} strokeWidth={1.75} />
      Namen ändern
    </button>
  );
}
