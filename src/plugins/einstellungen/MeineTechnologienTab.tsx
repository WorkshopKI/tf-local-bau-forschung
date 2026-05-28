// TODO(refactor v2.4+): 660 Zeilen — opportunistisch splitten, wenn diese Datei naechstes Mal angefasst wird.
// Vorschlag: AutoTagSection.tsx + CategoriesSection.tsx + ChipsInput.tsx extrahieren, Aggregations-Logik in eigenen Hook.
/**
 * "Meine Technologien" — User-sichtbarer Settings-Tab.
 *
 * Sections (Design-Handoff `_design/handoff/einstellungen-technologien/`):
 *  1. Programmkennung — Avatar + Name + Programm-Pill (anonyme MA-ID)
 *  2. Meine Kategorien (1.17) — Hauptkategorie-Dropdown + Nebenkategorien-Toggle
 *  3. Aus deinen bisherigen Anträgen — read-only Auto-Tag-Wand, lange Tags
 *     werden abgekürzt, Volltext per Hover-Tooltip
 *  4. Zusätzliche Kompetenzen — Chip-Input (Enter/Komma → neuer Chip,
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
import { hasPlOverride } from '@/plugins/auslastung/services/antragstyp-praeferenz';
import { KategoriePill } from '@/plugins/auslastung/components/KategoriePill';
import { ALL_ANTRAGSTYP_BUCKETS, type AntragstypBucket } from '@/plugins/auslastung/types';
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
const TOOLTIP_HAUPT =
  'Bestimmt, in welchem Pool du fuer die Selbsteintragung + Top-3-Vorschlaege landest. Genau eine Kategorie — das Kernthema deiner Antragsbearbeitung.';
const TOOLTIP_NEBEN =
  'Bei Antraegen mit diesen Aspekten als Querschnittstechnologie wirst du bevorzugt vorgeschlagen. Mehrere moeglich.';
const TOOLTIP_ANTRAGSTYP =
  'Welche Antragstypen bearbeitest du grundsaetzlich? Nichts ausgewaehlt = alle (Backwards-Kompat). Sonst werden in der Home + im Matching nur Antraege dieser Typen angezeigt.';
const TOOLTIP_AUTO =
  'Automatisch aus deinen bisherigen Anträgen abgeleitet (TECHN_*-Spalten + Zukunftstechnologien). Nicht zutreffende Tags kannst du per Klick ausblenden — sie verschwinden dann aus deinem Team-Profil. Aktualisiert sich beim nächsten Import.';
const TOOLTIP_MANUAL =
  'Frei eingegebene Stichworte ergänzen die automatische Erkennung. Sichtbar im Team-Auslastungs-Profil.';

const MAX_CHIPS = 20;
const MAX_CHIP_LEN = 60;

export function MeineTechnologienTab(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const data = useAuslastungData(s => s.data);
  const config = useAuslastungData(s => s.data.config);
  const load = useAuslastungData(s => s.load);
  const upsertMitarbeiter = useAuslastungData(s => s.upsertMitarbeiter);
  const createMitarbeiter = useAuslastungData(s => s.createMitarbeiter);
  const cache = useAntraegeCache();

  const [manualTags, setManualTags] = useState<string[]>([]);
  const [excludedAutoTags, setExcludedAutoTags] = useState<string[]>([]);
  const [hauptKategorie, setHauptKategorie] = useState<string>('');
  const [nebenKategorien, setNebenKategorien] = useState<string[]>([]);
  const [antragstypBevorzugt, setAntragstypBevorzugt] = useState<AntragstypBucket[]>([]);
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

  // Initial-Load der MA-Profil-Felder aus `auslastung.json` — sobald sowohl
  // AnonId aufgelöst als auch der Store geladen ist. Idempotent gegenueber
  // spaeteren Re-Renders, ueberschreibt User-Eingaben nicht (nur initial).
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!myAnonId) return;
    if (hydratedRef.current === myAnonId) return;  // schon befuellt fuer diese ID
    const existing = data.mitarbeiter[myAnonId];
    if (existing) {
      setExcludedAutoTags(existing.ausgeblendeteAutoTags ?? []);
      // 1.17: Haupt/Neben — Migration im Store liefert sie bereits korrekt.
      // Fallback fuer ganz frische MAs ohne Eintrag: leer.
      setHauptKategorie(existing.hauptKategorie ?? '');
      setNebenKategorien(existing.nebenKategorien ?? []);
      // v2.2: Antragstyp-Praeferenz hydrieren (nur das vom MA gepflegte Feld;
      // Override gehoert dem PL und wird nur als Hinweis-Banner angezeigt).
      setAntragstypBevorzugt(existing.antragstypBevorzugt ?? []);
      hydratedRef.current = myAnonId;
    }
  }, [myAnonId, data.mitarbeiter]);

  const automatic = useMemo(() => {
    if (!profile?.bearbeiter_kuerzel) return [];
    return aggregateMaProfile(cache.antraege, profile.bearbeiter_kuerzel);
  }, [cache.antraege, profile?.bearbeiter_kuerzel]);

  const toggleAutoTag = (tag: string): void => {
    setExcludedAutoTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  const toggleNebenKategorie = (id: string): void => {
    // Wenn die ID gerade Hauptkategorie ist → kein Toggle (sonst wuerde sie
    // Haupt UND Neben sein, was inkonsistent waere). User muss erst die
    // Hauptkategorie wechseln.
    if (id === hauptKategorie) return;
    setNebenKategorien(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const setHauptUndBereinige = (id: string): void => {
    // Wenn neue Hauptkategorie schon in Neben war → aus Neben entfernen.
    setHauptKategorie(id);
    setNebenKategorien(prev => prev.filter(x => x !== id));
  };

  const toggleAntragstyp = (bucket: AntragstypBucket): void => {
    setAntragstypBevorzugt(prev =>
      prev.includes(bucket) ? prev.filter(b => b !== bucket) : [...prev, bucket],
    );
  };

  async function speichern(): Promise<void> {
    setSaving(true);
    try {
      try { localStorage.setItem(LS_KEY, JSON.stringify(manualTags)); } catch { /* ignore */ }
      if (myAnonId) {
        const existing = data.mitarbeiter[myAnonId];
        // 1.17: zusaetzlich hauptKategorie + nebenKategorien speichern.
        // ueberKategorien (deprecated) wird via withLegacyFields beim Save
        // automatisch rekonstruiert; wir schreiben es trotzdem konsistent
        // mit, damit Aufrufer die das Feld direkt lesen aktuell bleiben.
        const reconstructedUeber = hauptKategorie
          ? [hauptKategorie, ...nebenKategorien]
          : nebenKategorien;
        const patch = {
          manuelleTechnologien: manualTags,
          ausgeblendeteAutoTags: excludedAutoTags,
          hauptKategorie,
          nebenKategorien,
          ueberKategorien: reconstructedUeber,
          // v2.2: Antragstyp-Praeferenz (Override ist PL-only, nicht hier).
          antragstypBevorzugt,
        };
        if (existing) {
          await upsertMitarbeiter(storage, { ...existing, ...patch });
        } else {
          await createMitarbeiter(storage, { ...patch, onboardingAbgeschlossen: true });
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

      {/* Section 2 — Meine Kategorien (1.17) */}
      <section className="mt-8">
        <SettingsSectionHeader label="Meine Kategorien" hint={TOOLTIP_HAUPT} />
        {myAnonId ? (
          <KategorienSection
            kategorien={config.ueberKategorien}
            haupt={hauptKategorie}
            neben={nebenKategorien}
            onSetHaupt={setHauptUndBereinige}
            onToggleNeben={toggleNebenKategorie}
          />
        ) : (
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">
            Bearbeiter-Kürzel im Profil hinterlegen — dann erscheint hier dein Kategorie-Profil.
          </p>
        )}
      </section>

      {/* Section 3 — Antragstyp-Praeferenz (v2.2) */}
      {myAnonId && (
        <section className="mt-8">
          <SettingsSectionHeader label="Welche Antragstypen bearbeite ich?" hint={TOOLTIP_ANTRAGSTYP} />
          <AntragstypSection
            currentMa={data.mitarbeiter[myAnonId]}
            bevorzugt={antragstypBevorzugt}
            onToggle={toggleAntragstyp}
          />
        </section>
      )}

      {/* Section 4 — Auto-Tags */}
      <section className="mt-8">
        <SettingsSectionHeader
          label="Aus deinen bisherigen Anträgen"
          count={automatic.length}
          hint={TOOLTIP_AUTO}
        />
        {automatic.length > 0 ? (
          <AutoTagToggleWand
            tags={automatic}
            excluded={excludedAutoTags}
            onToggle={toggleAutoTag}
          />
        ) : (
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">
            Keine historischen Anträge mit Technologie-Spalten gefunden.
          </p>
        )}
      </section>

      {/* Section 5 — Manuelle Chips */}
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

/**
 * Meine-Kategorien-Section (1.17): Hauptkategorie als Radio-Pills + Nebenkategorien
 * als Toggle-Pills. Klick auf gefüllten Pill der Hauptkategorie ist no-op
 * (Hauptkategorie wechseln = anderen Pill anklicken). Nebenkategorien-Pill
 * der aktuellen Hauptkategorie wird grau/disabled gerendert.
 */
function KategorienSection({
  kategorien,
  haupt,
  neben,
  onSetHaupt,
  onToggleNeben,
}: {
  kategorien: import('@/plugins/auslastung/types').UeberKategorie[];
  haupt: string;
  neben: string[];
  onSetHaupt: (id: string) => void;
  onToggleNeben: (id: string) => void;
}): React.ReactElement {
  const nebenSet = new Set(neben);
  return (
    <div className="flex flex-col gap-4">
      {/* Hauptkategorie — Radio-style Pills */}
      <div>
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-1.5">
          Hauptkategorie · <span className="text-[var(--tf-text-tertiary)]">Ich bearbeite grundsätzlich Anträge aus diesem Bereich.</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {kategorien.map(k => {
            const isHaupt = haupt === k.id;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => onSetHaupt(k.id)}
                className="cursor-pointer"
                aria-pressed={isHaupt}
                title={isHaupt ? `${k.name} (aktuelle Hauptkategorie)` : `${k.name} als Hauptkategorie wählen`}
              >
                <KategoriePill kategorie={k} mode={isHaupt ? 'primaer' : 'inactive'} />
              </button>
            );
          })}
        </div>
        {!haupt && (
          <p className="text-[11px] text-amber-700 mt-1.5">
            Noch keine Hauptkategorie gesetzt — bis dahin erscheinen keine neuen Anträge auf deiner Home-Page.
          </p>
        )}
      </div>

      {/* Nebenkategorien — Toggle-Pills (Outline = Aspekt aktiv) */}
      <div>
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-1.5 inline-flex items-center gap-1.5">
          Ergänzende Erfahrungen
          <InfoHint text={TOOLTIP_NEBEN} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {kategorien.map(k => {
            const isHaupt = haupt === k.id;
            const isNeben = nebenSet.has(k.id);
            const mode: 'primaer' | 'aspekt' | 'inactive' =
              isHaupt ? 'inactive'  // bewusst nicht selektierbar — Haupt darf nicht auch Neben sein
              : isNeben ? 'aspekt'
              : 'inactive';
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => onToggleNeben(k.id)}
                disabled={isHaupt}
                className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                aria-pressed={isNeben}
                title={
                  isHaupt ? `${k.name} ist deine Hauptkategorie — kann nicht zusätzlich als Aspekt gesetzt werden.`
                  : isNeben ? `${k.name} als Aspekt entfernen`
                  : `${k.name} als Aspekt hinzufügen`
                }
              >
                <KategoriePill kategorie={k} mode={mode} />
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-1.5">
          Bei Anträgen mit diesen Aspekten wirst du im Matching bevorzugt vorgeschlagen.
        </p>
      </div>
    </div>
  );
}

/**
 * Antragstyp-Praeferenz-Section (v2.2): Toggle-Pills fuer FuE/DS/DL/NW.
 *
 * Wenn PL aktuell einen Override gesetzt hat, zeigt ein Amber-Banner den
 * effektiven Wert + die unwirksame MA-Praeferenz. MA kann seine Praeferenz
 * trotzdem editieren — sie greift sobald PL den Override leert.
 */
function AntragstypSection({
  currentMa,
  bevorzugt,
  onToggle,
}: {
  currentMa: import('@/plugins/auslastung/types').AnonymerMitarbeiter | undefined;
  bevorzugt: AntragstypBucket[];
  onToggle: (bucket: AntragstypBucket) => void;
}): React.ReactElement {
  const overrideActive = currentMa ? hasPlOverride(currentMa) : false;
  const overrideValue = currentMa?.antragstypUeberschreibung ?? [];
  const bevorzugtSet = new Set(bevorzugt);

  return (
    <div className="flex flex-col gap-3">
      {overrideActive && (
        <div
          className="text-[12px] px-3 py-2 rounded-[var(--tf-radius)]"
          style={{
            background: 'var(--tf-warning-soft, #fef3c7)',
            border: '0.5px solid var(--tf-border)',
            color: 'var(--tf-text)',
          }}
        >
          <p className="font-medium mb-0.5">⚠ Aktuell vom PL eingeschränkt</p>
          <p className="text-[11.5px] text-[var(--tf-text-secondary)]">
            Du bekommst zur Zeit nur {overrideValue.join(', ')}-Anträge zugewiesen.
            Deine Präferenz unten ({bevorzugt.length > 0 ? bevorzugt.join(', ') : 'keine'})
            greift wieder, sobald der PL die Einschränkung aufhebt.
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {ALL_ANTRAGSTYP_BUCKETS.map(bucket => {
          const isActive = bevorzugtSet.has(bucket);
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => onToggle(bucket)}
              aria-pressed={isActive}
              className={
                isActive
                  ? 'inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md cursor-pointer'
                  : 'inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md cursor-pointer hover:bg-[var(--tf-bg-secondary)]'
              }
              style={
                isActive
                  ? {
                      background: 'var(--tf-primary-light)',
                      color: 'var(--tf-primary)',
                      border: '0.5px solid var(--tf-primary)',
                    }
                  : {
                      background: 'transparent',
                      color: 'var(--tf-text-tertiary)',
                      border: '0.5px solid var(--tf-border)',
                    }
              }
            >
              <span aria-hidden className={`text-[9px] leading-none ${isActive ? '' : 'invisible'}`}>✓</span>
              {bucket}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-[var(--tf-text-tertiary)] leading-snug">
        {bevorzugt.length === 0
          ? 'Nichts ausgewählt — du siehst alle Antragstypen deiner Hauptkategorie (Standard).'
          : `Auf der Home + im Matching werden nur ${bevorzugt.join(', ')}-Anträge angezeigt.`}
      </p>
    </div>
  );
}

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

/**
 * Toggle-Pill-Wand fuer die Auto-Tags. Pro Pill aktiv/inaktiv per Klick.
 * Layout-konstant: Hakenslot wird auch im Inaktiv-State gerendert
 * (`invisible`), damit kein horizontaler Shift entsteht (CLAUDE.md Pitfall
 * #14). Inaktiv-Variante ist outline-only mit blasserem Text — bewusst NICHT
 * `opacity-40`, weil das wie disabled wirkt.
 */
function AutoTagToggleWand({
  tags,
  excluded,
  onToggle,
}: {
  tags: string[];
  excluded: string[];
  onToggle: (tag: string) => void;
}): React.ReactElement {
  const excludedSet = new Set(excluded);
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tag => {
        const isExcluded = excludedSet.has(tag);
        const active = !isExcluded;
        const { short, truncated } = truncateWZ(tag);
        const button = (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            aria-pressed={active}
            aria-label={`${tag} — ${active ? 'aktiv im Team-Profil. Klicken zum Ausblenden.' : 'ausgeblendet. Klicken zum Aktivieren.'}`}
            className={
              active
                ? 'inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)] px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-[var(--tf-bg)] hover:text-[var(--tf-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40'
                : 'inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-tertiary)] bg-transparent px-2.5 py-1.5 rounded-md cursor-pointer hover:text-[var(--tf-text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40'
            }
            style={{
              border: active
                ? '0.5px solid transparent'
                : '0.5px solid var(--tf-border)',
              textDecoration: active ? 'none' : 'line-through',
            }}
          >
            <span aria-hidden className={`text-[9px] leading-none ${active ? '' : 'invisible'}`}>✓</span>
            <span>{short}</span>
          </button>
        );
        if (truncated) {
          return (
            <Tooltip key={tag} text={tag}>
              {button}
            </Tooltip>
          );
        }
        return button;
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
