import { useEffect, useRef, useState } from 'react';
import { Pencil, Minus, Plus } from 'lucide-react';
import { SectionHeader, Tooltip } from '@/ui';
import { Switch } from '@/components/ui/switch';
import { useProfile } from '@/core/hooks/useProfile';
import {
  isKuratorMenusEnabled,
  isAntraegeEnabled,
  isBauantraegeEnabled,
  menuLabel,
} from '@/config/feature-flags';
import type { UserProfile } from '@/core/types/config';

const NAME_INPUT_CLASS =
  'h-7 px-2 text-[13px] font-medium text-[var(--tf-text)] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]';
const KUERZEL_INPUT_CLASS =
  'h-8 w-24 px-3 text-[13px] uppercase text-[var(--tf-text)] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)] placeholder:normal-case';
const SELECT_CLASS =
  'h-8 px-2 text-[13px] text-[var(--tf-text)] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] outline-none cursor-pointer';
const FIELD_BORDER = { border: '0.5px solid var(--tf-border-hover)' } as const;

export function ProfilTab(): React.ReactElement {
  const { profile, updateProfile } = useProfile();

  if (!profile) {
    return (
      <div className="py-8 text-center text-[13px] text-[var(--tf-text-tertiary)]">
        Kein Profil geladen. Bitte App-Storage leeren und Onboarding neu durchlaufen.
      </div>
    );
  }

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const departmentLabel =
    profile.department === 'antraege' ? menuLabel('antraege', 'Förderanträge')
      : profile.department === 'bauantraege' ? menuLabel('bauantraege', 'Bauanträge')
      : 'Beide';

  const departmentOptions: Array<{ value: UserProfile['department']; label: string }> = [];
  if (isAntraegeEnabled()) departmentOptions.push({ value: 'antraege', label: menuLabel('antraege', 'Förderanträge') });
  if (isBauantraegeEnabled()) departmentOptions.push({ value: 'bauantraege', label: menuLabel('bauantraege', 'Bauanträge') });
  if (departmentOptions.length >= 2) departmentOptions.push({ value: 'beide', label: 'Beide' });
  const showDepartmentSelect = departmentOptions.length >= 2;

  return (
    <div className="space-y-8">
      {/* Section 1 — Account */}
      <section>
        <SectionHeader label="Account" />
        <SettingsRow>
          <SettingsRowGroup>
            <Avatar initials={initials} />
            <NameEditor name={profile.name} onSave={n => updateProfile({ name: n })} />
          </SettingsRowGroup>
          <SettingsRowSeparator />
          <SettingsRowGroup>
            {showDepartmentSelect ? (
              <select
                value={profile.department}
                onChange={e => updateProfile({ department: e.target.value as UserProfile['department'] })}
                className={SELECT_CLASS}
                style={FIELD_BORDER}
                aria-label="Abteilung"
              >
                {departmentOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <span className="text-[13px] text-[var(--tf-text-secondary)]">{departmentLabel}</span>
            )}
          </SettingsRowGroup>
        </SettingsRow>
      </section>

      {/* Section 2 — Bearbeiter-Filter */}
      <section>
        <SectionHeader label="Bearbeiter-Filter" />
        <SettingsRow>
          <SettingsRowGroup>
            <FieldLabel
              text="Kürzel"
              hint="Mehrere Kürzel komma-separiert für Vertretungen (z.B. MUE, SCH). Wert 'alle' deaktiviert den Filter (Übersichtsmodus)."
            />
            <input
              value={profile.bearbeiter_kuerzel ?? ''}
              onChange={e => updateProfile({ bearbeiter_kuerzel: e.target.value })}
              placeholder="z.B. MUE"
              className={KUERZEL_INPUT_CLASS}
              style={FIELD_BORDER}
            />
          </SettingsRowGroup>
          <SettingsRowSeparator />
          <SettingsRowGroup>
            <Switch
              checked={!!profile.bearbeiter_inkl_begleitung}
              onCheckedChange={v => updateProfile({ bearbeiter_inkl_begleitung: v })}
              aria-label="Begleitungen einschließen"
            />
            <FieldLabel
              text="Begleitungen einschließen"
              hint="Matcht zusätzlich auf ZTP_KUERZ und PFM_KUERZ und zeigt Anträge in VN-/ZB-Stati. Frist für VN-Anträge: D_VBE + 6 Monate."
            />
          </SettingsRowGroup>
        </SettingsRow>
      </section>

      {/* Section 3 — Home-Dashboard */}
      <section>
        <SectionHeader label="Home-Dashboard" />
        <SettingsRow>
          <SettingsRowGroup>
            <FieldLabel
              text="Initial sichtbare Anträge"
              hint="Anzahl der offenen Anträge, die beim Öffnen von Home erscheinen. Über '+10 mehr' lassen sich weitere in-page laden."
            />
            <Stepper
              value={profile.home_meine_antraege_count ?? 5}
              min={5}
              max={15}
              step={1}
              onChange={v => updateProfile({ home_meine_antraege_count: v })}
            />
          </SettingsRowGroup>
        </SettingsRow>
      </section>

      {/* Section 4 — Kurator-Bereich (nur in kurator-Variante) */}
      {isKuratorMenusEnabled() && (
        <section>
          <SectionHeader label="Kurator-Bereich" />
          <SettingsRow>
            <SettingsRowGroup>
              <Switch
                checked={!!(profile.is_kurator ?? profile.is_admin)}
                onCheckedChange={v => updateProfile({ is_kurator: v })}
                aria-label="Kurator-Menüs aktivieren"
              />
              <FieldLabel
                text="Kurator-Menüs aktivieren"
                hint="Schaltet die Kurations-Menüpunkte (Suchindex, Programme, CSV-Quellen, Filter, Feedback-Verwaltung, Review) in der Sidebar frei."
              />
            </SettingsRowGroup>
          </SettingsRow>
        </section>
      )}
    </div>
  );
}

// ---------- Sub-Komponenten ----------

function SettingsRow({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="flex items-center gap-5 flex-wrap min-h-9">{children}</div>;
}

function SettingsRowGroup({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="inline-flex items-center gap-2.5">{children}</div>;
}

function SettingsRowSeparator(): React.ReactElement {
  return <div className="w-px h-5 bg-[var(--tf-border)]" aria-hidden />;
}

function Avatar({ initials }: { initials: string }): React.ReactElement {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-medium shrink-0"
      style={{
        background: 'hsl(var(--tf-primary-h), var(--tf-primary-s), 35%)',
        letterSpacing: '0.03em',
      }}
      aria-hidden
    >
      {initials}
    </div>
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
    if (editing) {
      setDraft(name);
      // Microtask, damit autoFocus + select() nach dem Mount greift
      queueMicrotask(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, name]);

  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onSave(trimmed);
    setEditing(false);
  };

  const cancel = (): void => {
    setEditing(false);
    setDraft(name);
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
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        className={NAME_INPUT_CLASS}
        style={{ ...FIELD_BORDER, minWidth: '160px' }}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[13px] font-medium text-[var(--tf-text)]">{name}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Namen ändern"
        className="w-6 h-6 rounded-md inline-flex items-center justify-center text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] transition-colors cursor-pointer"
      >
        <Pencil size={13} strokeWidth={1.5} />
      </button>
    </span>
  );
}

function FieldLabel({ text, hint }: { text: string; hint: string }): React.ReactElement {
  return (
    <label className="text-[13px] text-[var(--tf-text)] inline-flex items-center gap-1.5">
      {text}
      <InfoHint text={hint} />
    </label>
  );
}

function InfoHint({ text }: { text: string }): React.ReactElement {
  return (
    <Tooltip text={text}>
      <span
        tabIndex={0}
        role="img"
        aria-label="Info"
        className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-medium text-[var(--tf-text-tertiary)] cursor-help bg-[var(--tf-bg)] hover:text-[var(--tf-text)] focus:text-[var(--tf-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40"
        style={{ border: '0.5px solid var(--tf-border-hover)', lineHeight: 1 }}
      >
        i
      </span>
    </Tooltip>
  );
}

function Stepper({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}): React.ReactElement {
  const clamp = (v: number): number => Math.max(min, Math.min(max, v));
  const dec = (): void => onChange(clamp(value - step));
  const inc = (): void => onChange(clamp(value + step));

  return (
    <div
      className="inline-flex items-stretch h-8 rounded-[var(--tf-radius)] overflow-hidden"
      style={FIELD_BORDER}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Weniger"
        className="w-7 inline-flex items-center justify-center text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Minus size={12} strokeWidth={1.75} />
      </button>
      <div
        className="w-11 inline-flex items-center justify-center text-[13px] text-[var(--tf-text)]"
        style={{
          borderLeft: '0.5px solid var(--tf-border)',
          borderRight: '0.5px solid var(--tf-border)',
        }}
        aria-live="polite"
      >
        {value}
      </div>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Mehr"
        className="w-7 inline-flex items-center justify-center text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Plus size={12} strokeWidth={1.75} />
      </button>
    </div>
  );
}
