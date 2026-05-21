/**
 * "Meine Technologien" — User-sichtbarer Settings-Tab.
 *
 * Drei Sections (Design-Handoff `_design/handoff/einstellungen-technologien/`):
 *  1. Programmkennung — Avatar + Name + Programm-Pill (anonyme MA-ID)
 *  2. Aus deinen bisherigen Anträgen — read-only Auto-Tag-Wand, lange Tags
 *     werden abgekürzt, Volltext per Hover-Tooltip
 *  3. Zusätzliche Kompetenzen — Chip-Input (Enter/Komma → neuer Chip,
 *     Backspace im leeren Input → letzten Chip entfernen, × pro Chip)
 *
 * Save-Row separiert mit Hairline. Persistiert in localStorage UND in
 * `auslastung.json` (via `useAuslastungData`, gegen die anonyme MA-ID).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { Tooltip } from '@/ui';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { useAntraegeCache } from '@/plugins/auslastung/hooks/useAntraegeCache';
import { resolveAnonIdForUser } from '@/plugins/auslastung/services/anonym-map';
import { aggregateMaProfile } from '@/plugins/auslastung/services/profil-aggregator';
import {
  SettingsRow,
  SettingsRowGroup,
  SettingsRowSeparator,
  Avatar,
  InfoHint,
  SettingsSectionHeader,
} from './_shared/settings-primitives';

const LS_KEY = 'teamflow-meineTechnologien';

const TOOLTIP_PROGRAMM =
  'Deine anonyme Programm-ID. Wird verwendet, um deine Technologien im Team-Auslastungs-Profil zuzuordnen, ohne den Klarnamen preiszugeben.';
const TOOLTIP_AUTO =
  'Automatisch aus deinen bisherigen Anträgen abgeleitet (Branchen-/Technologie-Spalten). Aktualisiert sich beim nächsten Import — nicht direkt editierbar.';
const TOOLTIP_MANUAL =
  'Frei eingegebene Stichworte ergänzen die automatische Erkennung. Sichtbar im Team-Auslastungs-Profil.';

const MAX_CHIPS = 20;
const MAX_CHIP_LEN = 60;

export function MeineTechnologienTab(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const data = useAuslastungData(s => s.data);
  const load = useAuslastungData(s => s.load);
  const upsertMitarbeiter = useAuslastungData(s => s.upsertMitarbeiter);
  const createMitarbeiter = useAuslastungData(s => s.createMitarbeiter);
  const cache = useAntraegeCache();

  const [manualTags, setManualTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Initial-Load: aus localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setManualTags(parsed.filter(s => typeof s === 'string'));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(storage); }, [storage, load]);

  const myAnonId = resolveAnonIdForUser(profile?.bearbeiter_kuerzel, cache.anonymMap);
  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const automatic = useMemo(() => {
    if (!profile?.bearbeiter_kuerzel) return [];
    return aggregateMaProfile(cache.antraege, profile.bearbeiter_kuerzel);
  }, [cache.antraege, profile?.bearbeiter_kuerzel]);

  async function speichern(): Promise<void> {
    setSaving(true);
    try {
      try { localStorage.setItem(LS_KEY, JSON.stringify(manualTags)); } catch { /* ignore */ }
      if (myAnonId) {
        const existing = data.mitarbeiter[myAnonId];
        if (existing) {
          await upsertMitarbeiter(storage, { ...existing, manuelleTechnologien: manualTags });
        } else {
          await createMitarbeiter(storage, { manuelleTechnologien: manualTags, onboardingAbgeschlossen: true });
        }
      }
      setSavedAt(new Date().toISOString());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Section 1 — Programmkennung */}
      <section>
        <SettingsSectionHeader label="Programmkennung" />
        <SettingsRow gap="lg">
          <SettingsRowGroup>
            <Avatar initials={initials} />
            <span className="text-[13px] font-medium text-[var(--tf-text)]">{profile?.name ?? '—'}</span>
          </SettingsRowGroup>
          <SettingsRowSeparator />
          <SettingsRowGroup>
            <label className="text-[13px] text-[var(--tf-text-secondary)] inline-flex items-center gap-1.5">
              Programm
              <InfoHint text={TOOLTIP_PROGRAMM} />
            </label>
            {myAnonId ? (
              <ProgrammPill anonId={myAnonId} />
            ) : (
              <span className="text-[12px] text-[var(--tf-text-tertiary)]">
                Kein Kürzel hinterlegt
              </span>
            )}
          </SettingsRowGroup>
        </SettingsRow>
      </section>

      {/* Section 2 — Auto-Tags */}
      <section className="mt-8">
        <SettingsSectionHeader
          label="Aus deinen bisherigen Anträgen"
          count={automatic.length}
          hint={TOOLTIP_AUTO}
        />
        {automatic.length > 0 ? (
          <AutoTagWand tags={automatic} />
        ) : (
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">
            Keine historischen Anträge mit Branchen-/Technologie-Spalten gefunden.
          </p>
        )}
      </section>

      {/* Section 3 — Manuelle Chips */}
      <section className="mt-8">
        <SettingsSectionHeader label="Zusätzliche Kompetenzen" hint={TOOLTIP_MANUAL} />
        <ChipInput
          tags={manualTags}
          onChange={setManualTags}
          maxChips={MAX_CHIPS}
          maxChipLen={MAX_CHIP_LEN}
          placeholder="Stichwort eintippen, Enter zum Hinzufügen…"
        />
      </section>

      {/* Save-Row */}
      <div
        className="mt-8 pt-5 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderTop: '0.5px solid var(--tf-border)' }}
      >
        <p className="text-[12px] leading-relaxed text-[var(--tf-text-secondary)] max-w-md">
          Speichern aktualisiert dein{' '}
          <span className="font-medium text-[var(--tf-text)]">Team-Auslastungs-Profil</span>{' '}
          — andere im Team sehen deine Technologien dort.
        </p>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">
              ✓ {new Date(savedAt).toLocaleTimeString('de-DE')}
            </span>
          )}
          <button
            type="button"
            onClick={() => void speichern()}
            disabled={saving}
            className="h-9 px-[18px] rounded-[var(--tf-radius)] text-[13px] font-medium cursor-pointer disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            {saving ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Sub-Komponenten ----------

function ProgrammPill({ anonId }: { anonId: string }): React.ReactElement {
  return (
    <span
      className="inline-flex items-center font-mono font-medium text-[12px] text-[var(--tf-primary)] bg-[var(--tf-primary-light)] px-2.5 py-1 rounded-full"
      style={{
        border: '0.5px solid hsl(var(--tf-primary-h), var(--tf-primary-s), 80%)',
        letterSpacing: '0.02em',
      }}
    >
      {anonId}
    </span>
  );
}

const LONG_TAG_THRESHOLD = 38;

/**
 * Kürzt einen WZ-Tag der Form "präfix (a, b, c, d, e)" auf
 * "präfix (a, b, …)" wenn er zu lang ist. Tags ohne Klammer werden nur dann
 * abgekürzt wenn sie über die Schwelle gehen — dann ellipsen wir am Ende.
 */
function truncateWZ(label: string): { short: string; truncated: boolean } {
  if (label.length <= LONG_TAG_THRESHOLD) return { short: label, truncated: false };
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m && m[1] != null && m[2] != null) {
    const head = m[1].trim();
    const parts = m[2].split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 2) {
      return { short: `${head} (${parts.slice(0, 2).join(', ')}, …)`, truncated: true };
    }
  }
  return { short: label.slice(0, LONG_TAG_THRESHOLD - 1) + '…', truncated: true };
}

function AutoTagWand({ tags }: { tags: string[] }): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tag => {
        const { short, truncated } = truncateWZ(tag);
        if (!truncated) {
          return (
            <span
              key={tag}
              className="text-[12px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)] px-2.5 py-1.5 rounded-md"
              style={{ border: '0.5px solid transparent' }}
            >
              {tag}
            </span>
          );
        }
        return (
          <Tooltip key={tag} text={tag}>
            <span
              tabIndex={0}
              className="text-[12px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)] px-2.5 py-1.5 rounded-md cursor-default outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40 hover:bg-[var(--tf-bg)] transition-colors"
              style={{ border: '0.5px solid transparent' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--tf-border-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
            >
              {short}
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}

function ChipInput({
  tags,
  onChange,
  maxChips,
  maxChipLen,
  placeholder,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  maxChips: number;
  maxChipLen: number;
  placeholder: string;
}): React.ReactElement {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string): void => {
    const candidate = raw.trim().slice(0, maxChipLen);
    if (!candidate) return;
    if (tags.length >= maxChips) return;
    const lower = candidate.toLowerCase();
    if (tags.some(t => t.toLowerCase() === lower)) {
      setDraft('');
      return;
    }
    onChange([...tags, candidate]);
    setDraft('');
  };

  const removeAt = (idx: number): void => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      e.preventDefault();
      removeAt(tags.length - 1);
    }
  };

  const onChangeRaw = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    // Komma im Wert (z.B. Paste) sofort splitten und committen
    if (val.includes(',')) {
      const parts = val.split(',');
      const last = parts.pop() ?? '';
      for (const p of parts) commit(p);
      setDraft(last);
      return;
    }
    setDraft(val);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 p-2 rounded-[var(--tf-radius)] bg-[var(--tf-bg)] min-h-[44px] cursor-text"
      style={{ border: '0.5px solid var(--tf-border-hover)' }}
      onClick={e => {
        if (e.target === e.currentTarget) inputRef.current?.focus();
      }}
    >
      {tags.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text)] bg-[var(--tf-bg)] pl-2.5 pr-1 py-1 rounded-md"
          style={{ border: '0.5px solid var(--tf-border-hover)' }}
        >
          {tag}
          <button
            type="button"
            aria-label={`Stichwort '${tag}' entfernen`}
            onClick={() => removeAt(idx)}
            className="w-[18px] h-[18px] inline-flex items-center justify-center rounded text-[14px] leading-none text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={onChangeRaw}
        onKeyDown={onKey}
        onBlur={() => { if (draft) commit(draft); }}
        placeholder={tags.length === 0 ? placeholder : ''}
        disabled={tags.length >= maxChips}
        className="flex-1 min-w-[160px] py-1 px-1 bg-transparent text-[12px] text-[var(--tf-text)] outline-none placeholder:text-[var(--tf-text-tertiary)] disabled:cursor-not-allowed"
      />
    </div>
  );
}
