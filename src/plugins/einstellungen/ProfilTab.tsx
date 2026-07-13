import { useEffect, useRef, useState } from 'react';
import { Pencil, Minus, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useProfile } from '@/core/hooks/useProfile';
import { useMAIdentity } from '@/core/hooks/useMAIdentity';
import { useKuerzelFilterOptions } from '@/plugins/auslastung/hooks/useKuerzelFilterOptions';
import { useShowInaktiveMasStore } from '@/plugins/antraege/useShowInaktiveMasStore';
import {
  isKuratorMenusEnabled,
  isMaLoginEnabled,
  isAuslastungEnabled,
  isAssistentProtokollEnabled,
} from '@/config/feature-flags';
import {
  SettingsRow,
  SettingsRowGroup,
  SettingsRowSeparator,
  SettingsSectionHeader,
  Avatar,
  InfoHint,
} from './_shared/settings-primitives';
import { KuratorSessionPanel } from './KuratorSessionPanel';
import { AssistentTab } from './AssistentTab';

const NAME_INPUT_CLASS =
  'h-7 px-2 text-[13px] font-medium text-[var(--tf-text)] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]';
const KUERZEL_INPUT_CLASS =
  'h-8 w-24 px-3 text-[13px] uppercase text-[var(--tf-text)] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)] placeholder:normal-case';
const SELECT_CLASS =
  'h-8 px-2 text-[13px] text-[var(--tf-text)] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] outline-none cursor-pointer';
const FIELD_BORDER = { border: '0.5px solid var(--tf-border-hover)' } as const;

export function ProfilTab(): React.ReactElement {
  const { profile, updateProfile } = useProfile();
  const sessionKuerzel = useMAIdentity(s => s.kuerzel);
  const istAngemeldet = useMAIdentity(s => s.istAngemeldet);
  // v2.11: im MA-Login-Modus (prod, angemeldet) ist das Kürzel aus dem Passwort
  // abgeleitet und read-only — kein freies Eingabefeld mehr.
  const maLoginActive = isMaLoginEnabled() && istAngemeldet;

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

  return (
    <div className="space-y-8">
      {/* Section 1 — Account */}
      <section id="sec-account" className="scroll-mt-20">
        <SettingsSectionHeader label="Account" />
        <SettingsRow>
          <SettingsRowGroup>
            <Avatar initials={initials} />
            <NameEditor name={profile.name} onSave={n => updateProfile({ name: n })} />
          </SettingsRowGroup>
        </SettingsRow>
      </section>

      {/* Section 2 — Bearbeiter-Filter */}
      <section id="sec-filter" className="scroll-mt-20">
        <SettingsSectionHeader label="Bearbeiter-Filter" />
        <SettingsRow>
          <SettingsRowGroup>
            {maLoginActive ? (
              <>
                <FieldLabel
                  text="Angemeldet als"
                  hint="Dein Kürzel wird beim Login aus deinem Passwort ermittelt und kann hier nicht geändert werden."
                />
                <span className="h-8 inline-flex items-center px-3 text-[13px] font-medium uppercase text-[var(--tf-text)]">
                  {sessionKuerzel ?? '—'}
                </span>
              </>
            ) : (
              <KuerzelEditor />
            )}
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
      <section id="sec-home" className="scroll-mt-20">
        <SettingsSectionHeader label="Home-Dashboard" />
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
        <section id="sec-kurator" className="scroll-mt-20">
          <SettingsSectionHeader label="Kurator-Bereich" />
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
          <KuratorSessionPanel />
        </section>
      )}

      {/* Assistent & Gedächtnis (Assistent Phase 0, nur dev) — seit v2.235 hier
          gefaltet statt als eigener Menüpunkt. Bringt eigene `sec-assistent-…`-
          Anker mit (Deep-Link/Suche/Scroll unverändert). */}
      {isAssistentProtokollEnabled() && <AssistentTab />}
    </div>
  );
}

// ---------- Sub-Komponenten ----------

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

/**
 * Bearbeiter-Kürzel-Auswahl im Nicht-MA-Login-Modus.
 *
 * - pl/dev (Auslastungs-Modul aktiv, MAs vorhanden): Dropdown mit „Alle" +
 *   jedem MA (Klartext-Kürzel). Inaktive MAs sind per Checkbox einblendbar
 *   (geteilter Store, wirkt auch auf die Anträge-Ausblendung in Liste + Home).
 * - sonst (kurator/demo oder noch keine MA-Daten): bestehendes Freitextfeld.
 */
function KuerzelEditor(): React.ReactElement {
  const { profile, updateProfile } = useProfile();
  const options = useKuerzelFilterOptions();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);
  const setShowInaktive = useShowInaktiveMasStore(s => s.setShowInaktive);
  const current = profile?.bearbeiter_kuerzel ?? '';

  // Stale-Guard: ist ein inaktives Kürzel gewählt und werden Inaktive wieder
  // ausgeblendet, würde es aus dem Dropdown verschwinden — zurück auf „alle".
  useEffect(() => {
    if (showInaktive || !options) return;
    const cur = current.trim();
    if (!cur || cur.toLowerCase() === 'alle') return;
    const opt = options.find(o => o.kuerzel === cur.toUpperCase());
    if (opt && !opt.aktiv) updateProfile({ bearbeiter_kuerzel: 'alle' });
  }, [showInaktive, options, current, updateProfile]);

  // Fallback NUR, wenn das Auslastungs-Modul aus ist (options === null →
  // kurator/demo) → bestehendes Freitextfeld. In pl/dev (options ist ein Array,
  // ggf. leer) IMMER der Dropdown — bei leerem Stand zeigt er nur „Alle", füllt
  // sich aber automatisch, sobald Anträge geladen sind. Kein Freitext in pl/dev.
  if (options === null) {
    return (
      <>
        <FieldLabel
          text="Kürzel"
          hint="Mehrere Kürzel komma-separiert für Vertretungen (z.B. MUE, SCH). Wert 'alle' deaktiviert den Filter (Übersichtsmodus)."
        />
        <input
          value={current}
          onChange={e => updateProfile({ bearbeiter_kuerzel: e.target.value })}
          placeholder="z.B. MUE"
          className={KUERZEL_INPUT_CLASS}
          style={FIELD_BORDER}
        />
      </>
    );
  }

  const visibleOptions = showInaktive ? options : options.filter(o => o.aktiv);
  // Angezeigter Wert: leer = „Alle" (gleiches Filterverhalten, kein Zwangs-Save).
  // Ein gewähltes, aber gerade nicht sichtbares Kürzel fällt visuell auf „Alle".
  const cur = current.trim();
  const upper = cur.toUpperCase();
  const selectValue =
    !cur || cur.toLowerCase() === 'alle' || !visibleOptions.some(o => o.kuerzel === upper)
      ? 'alle'
      : upper;

  return (
    <>
      <FieldLabel
        text="Kürzel"
        hint="Kürzel auswählen, dessen Anträge angezeigt werden. 'Alle' zeigt die Anträge aller MAs (Übersichtsmodus)."
      />
      <select
        value={selectValue}
        onChange={e => updateProfile({ bearbeiter_kuerzel: e.target.value })}
        className={SELECT_CLASS}
        style={FIELD_BORDER}
        aria-label="Bearbeiter-Kürzel"
      >
        <option value="alle">Alle</option>
        {visibleOptions.map(o => (
          <option key={o.kuerzel} value={o.kuerzel}>{o.kuerzel}</option>
        ))}
      </select>
      {/* „Inaktive einblenden" braucht Aktiv/Inaktiv-Daten aus dem Auslastungs-
          Modul. Ohne dieses Modul (z.B. AS-Variante: Dropdown via kuerzelDropdown,
          aber kein MA-Sync) gibt es keine inaktiven MAs — Checkbox ausblenden. */}
      {isAuslastungEnabled() && (
        <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            checked={showInaktive}
            onChange={e => setShowInaktive(e.target.checked)}
            className="accent-[var(--tf-primary)] cursor-pointer"
          />
          Inaktive einblenden
        </label>
      )}
    </>
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
