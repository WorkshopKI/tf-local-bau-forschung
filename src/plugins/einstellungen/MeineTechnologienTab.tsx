// TODO(refactor v2.4+): mischt Profil-Hydration/Auto-Save-Logik mit mehreren Settings-Sektionen (Kategorien/Antragstyp/Auto-Tags/Chips) — entlang dieser Grenzen aufteilen (opportunistisch beim nächsten Anfassen).
// Vorschlag: AutoTagSection.tsx + CategoriesSection.tsx + ChipsInput.tsx extrahieren, Aggregations-Logik in eigenen Hook.
/**
 * "Meine Technologien" — User-sichtbarer Settings-Tab.
 *
 * Sections (Design-Handoff `_design/handoff/einstellungen-technologien/`):
 *  1. Programmkennung — Avatar + Name + Programm-Pill (anonyme MA-ID)
 *  2. Meine Kategorien (1.17) — Hauptkategorie (Single-Select, dunkler `ToggleChip`)
 *     + Ergänzende Erfahrungen (Multi-Select-`ToggleChip`)
 *  3. Aus deinen bisherigen Anträgen — Auto-Tag-`ToggleChip`s (aktiv ⇔ nicht
 *     ausgeblendet), auf ~10 gekürzt mit „+ N weitere"; lange Tags abgekürzt,
 *     Volltext per `title`-Tooltip
 *  4. Zusätzliche Kompetenzen — Chip-Input (Enter/Komma → neuer Chip,
 *     Backspace im leeren Input → letzten Chip entfernen, × pro Chip)
 *
 * Alle Toggle-Gruppen nutzen das gemeinsame `ToggleChip` (DESIGN_GUIDE Kap. 5 /
 * Pitfall #14): kein Durchstreichen, kein `opacity-40`, konstante Breite.
 *
 * Save-Row separiert mit Hairline. Persistiert in localStorage UND in
 * `auslastung.json` (via `useAuslastungData`, gegen die anonyme MA-ID).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { useAntraegeCache } from '@/plugins/auslastung/hooks/useAntraegeCache';
import { resolveAnonIdForUser } from '@/plugins/auslastung/services/identitaet';
import { aggregateMaProfileFromLookup } from '@/plugins/auslastung/services/identitaet';
import {
  loadAuslastungProfil,
  writeAuslastungProfil,
} from '@/plugins/auslastung/services/identitaet';
import { hasPlOverride } from '@/plugins/auslastung/services/kapazitaet';
import type { PersoenlichesAuslastungProfil } from '@/plugins/auslastung/types';
import { truncateWZ } from '@/plugins/auslastung/components/AutoTagToggleWand';
import { TechChipInput } from '@/plugins/auslastung/components/TechChipInput';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { computeAutoTagVisibility } from './autoTagVisibility';
import { ALL_ANTRAGSTYP_BUCKETS, type AntragstypBucket } from '@/plugins/auslastung/types';
import {
  SettingsRow,
  SettingsRowGroup,
  SettingsRowSeparator,
  Avatar,
  InfoHint,
  SettingsSectionHeader,
} from './_shared/settings-primitives';

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
  const meinKuerzel = useMeinKuerzel();
  const data = useAuslastungData(s => s.data);
  const config = useAuslastungData(s => s.data.config);
  const load = useAuslastungData(s => s.load);
  const cache = useAntraegeCache();

  const [manualTags, setManualTags] = useState<string[]>([]);
  const [excludedAutoTags, setExcludedAutoTags] = useState<string[]>([]);
  const [hauptKategorie, setHauptKategorie] = useState<string>('');
  const [nebenKategorien, setNebenKategorien] = useState<string[]>([]);
  const [antragstypBevorzugt, setAntragstypBevorzugt] = useState<AntragstypBucket[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /** null = noch nicht geladen, true = persoenliches Profil existierte (autoritativ),
   *  false = keins → Fallback-Hydration aus auslastung.json erlaubt. */
  const [hasPersonalProfil, setHasPersonalProfil] = useState<boolean | null>(null);

  // Cross-Browser-Hydration: das eigene Profil aus dem persoenlichen Ordner
  // (Source-of-Truth) bzw. dem IDB-Cache laden. Hat Vorrang vor dem aus
  // auslastung.json abgeleiteten Record (der erst nach PL-Aggregation aktuell ist).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      const profil = await loadAuslastungProfil(storage.idb, persHandle);
      if (cancelled) return;
      if (profil) {
        setManualTags(profil.manuelleTechnologien ?? []);
        setExcludedAutoTags(profil.ausgeblendeteAutoTags ?? []);
        setHauptKategorie(profil.hauptKategorie ?? '');
        setNebenKategorien(profil.nebenKategorien ?? []);
        setAntragstypBevorzugt(profil.antragstypBevorzugt ?? []);
      }
      setHasPersonalProfil(!!profil);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  useEffect(() => { void load(storage); }, [storage, load]);

  const myAnonId = resolveAnonIdForUser(meinKuerzel, cache.anonymMap);
  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  // Fallback-Hydration aus `auslastung.json` — NUR wenn kein persoenliches
  // Profil existiert (hasPersonalProfil === false). Sonst ist das persoenliche
  // Profil autoritativ (Cross-Browser-Source-of-Truth) und darf nicht vom
  // ggf. veralteten auslastung.json-Record ueberschrieben werden.
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (hasPersonalProfil !== false) return;  // null = lädt noch, true = Profil hat Vorrang
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
  }, [myAnonId, data.mitarbeiter, hasPersonalProfil]);

  const automatic = useMemo(() => {
    if (!meinKuerzel) return [];
    return aggregateMaProfileFromLookup(cache.antraege, cache.deskriptorenByAz, meinKuerzel);
  }, [cache.antraege, cache.deskriptorenByAz, meinKuerzel]);

  // Auto-Save: dirtyRef wird NUR von User-Mutatoren gesetzt (nicht von der
  // Hydration), damit Laden/Browser-Wechsel keinen Save triggert.
  const dirtyRef = useRef(false);
  const markDirty = (): void => { dirtyRef.current = true; };

  const toggleAutoTag = (tag: string): void => {
    markDirty();
    setExcludedAutoTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  const toggleNebenKategorie = (id: string): void => {
    // Wenn die ID gerade Hauptkategorie ist → kein Toggle (sonst wuerde sie
    // Haupt UND Neben sein, was inkonsistent waere). User muss erst die
    // Hauptkategorie wechseln.
    if (id === hauptKategorie) return;
    markDirty();
    setNebenKategorien(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const setHauptUndBereinige = (id: string): void => {
    // Wenn neue Hauptkategorie schon in Neben war → aus Neben entfernen.
    markDirty();
    setHauptKategorie(id);
    setNebenKategorien(prev => prev.filter(x => x !== id));
  };

  const toggleAntragstyp = (bucket: AntragstypBucket): void => {
    markDirty();
    setAntragstypBevorzugt(prev =>
      prev.includes(bucket) ? prev.filter(b => b !== bucket) : [...prev, bucket],
    );
  };

  // Speichern schreibt das Selbst-Profil in den persoenlichen Ordner (immer
  // readwrite). Direktschreiben nach auslastung.json scheitert fuer Nicht-
  // Kuratoren am v2.0-Read-Only-Daten-Share — die PL sammelt die Profile
  // ueber den User-Folders-Root ein. `useAsyncAction` macht Rejections
  // sichtbar (Pitfall #15) statt sie unter file:// still zu schlucken.
  const saveAction = useAsyncAction(async () => {
    const kuerzel = meinKuerzel?.trim();
    if (!kuerzel || kuerzel.toLowerCase() === 'alle') {
      throw new Error('Kein Bearbeiter-Kürzel hinterlegt — bitte zuerst im Tab "Profil" eintragen bzw. anmelden.');
    }
    const profil: PersoenlichesAuslastungProfil = {
      version: 1,
      kuerzel,
      manuelleTechnologien: manualTags,
      ausgeblendeteAutoTags: excludedAutoTags,
      hauptKategorie,
      nebenKategorien,
      antragstypBevorzugt,
      updatedAt: new Date().toISOString(),
    };
    const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
    await writeAuslastungProfil(storage.idb, persHandle, profil);
    setHasPersonalProfil(true);
    setSavedAt(new Date().toISOString());
  });

  // Stabiler Save-Aufruf über Ref — vermeidet Stale-Closure + Dep-Churn im
  // Debounce-Effect (saveAction.run-Identität ändert sich pro Render).
  const saveRef = useRef<() => void>(() => {});
  saveRef.current = () => { void saveAction.run(); };
  const pendingRef = useRef(false);

  // Debounced Auto-Save (~800 ms nach der letzten Eingabe). Feuert nur wenn der
  // User wirklich etwas geändert hat (dirtyRef), nicht bei der Hydration.
  useEffect(() => {
    if (!dirtyRef.current) return;
    pendingRef.current = true;
    const t = setTimeout(() => { pendingRef.current = false; saveRef.current(); }, 800);
    return () => clearTimeout(t);
  }, [manualTags, excludedAutoTags, hauptKategorie, nebenKategorien, antragstypBevorzugt]);

  // Flush beim Verlassen des Tabs: ausstehenden Debounce sofort schreiben, damit
  // die letzte Eingabe bei schnellem Tab-Wechsel nicht verloren geht.
  useEffect(() => () => { if (pendingRef.current) saveRef.current(); }, []);

  return (
    <div className="flex flex-col">
      {/* Auto-Save-Status — immer sichtbar, kein Scrollen nötig */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <p className="text-[12px] leading-relaxed text-[var(--tf-text-secondary)] whitespace-nowrap">
          Änderungen werden automatisch gespeichert — andere im Team sehen deine{' '}
          <span className="font-medium text-[var(--tf-text)]">Technologien</span> dort.
        </p>
        <SaveStatus
          busy={saveAction.busy}
          error={saveAction.error}
          savedAt={savedAt}
        />
      </div>

      {/* Section 1 — Programmkennung */}
      <section id="sec-programm" className="scroll-mt-20">
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
      <section id="sec-kategorien" className="mt-8 scroll-mt-20">
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
        <section id="sec-antragstypen" className="mt-8 scroll-mt-20">
          <SettingsSectionHeader label="Welche Antragstypen bearbeite ich?" hint={TOOLTIP_ANTRAGSTYP} />
          <AntragstypSection
            currentMa={data.mitarbeiter[myAnonId]}
            bevorzugt={antragstypBevorzugt}
            onToggle={toggleAntragstyp}
          />
        </section>
      )}

      {/* Section 4 — Auto-Tags */}
      <section id="sec-themen" className="mt-8 scroll-mt-20">
        <SettingsSectionHeader
          label="Aus deinen bisherigen Anträgen"
          count={automatic.length}
          hint={TOOLTIP_AUTO}
          right={
            automatic.length > 0
              ? `${automatic.filter(t => !excludedAutoTags.includes(t)).length} gewählt`
              : undefined
          }
        />
        {automatic.length > 0 ? (
          <AutoTagChips
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
      <section id="sec-kompetenzen" className="mt-8 scroll-mt-20">
        <SettingsSectionHeader label="Zusätzliche Kompetenzen" hint={TOOLTIP_MANUAL} />
        <TechChipInput
          tags={manualTags}
          onChange={(t) => { markDirty(); setManualTags(t); }}
          maxChips={MAX_CHIPS}
          maxChipLen={MAX_CHIP_LEN}
          placeholder="Stichwort eintippen, Enter zum Hinzufügen…"
        />
      </section>
    </div>
  );
}

/**
 * Auto-Save-Status oben im Tab. Reihenfolge: laufender Save > Fehler > zuletzt
 * gespeichert > Default-Hint. Fehler nutzt die Warn-Tokens (sichtbar, nicht
 * still — Pitfall #15).
 */
function SaveStatus({
  busy,
  error,
  savedAt,
}: {
  busy: boolean;
  error: string | null;
  savedAt: string | null;
}): React.ReactElement {
  if (busy) {
    return <span className="text-[11px] text-[var(--tf-text-tertiary)] whitespace-nowrap">Speichert…</span>;
  }
  if (error) {
    return (
      <span
        className="rounded-md px-3 py-1.5 text-[12px] leading-relaxed max-w-md"
        style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }}
      >
        {error}
      </span>
    );
  }
  if (savedAt) {
    return (
      <span className="text-[11px] text-[var(--tf-text-tertiary)] whitespace-nowrap">
        Gespeichert ✓ {new Date(savedAt).toLocaleTimeString('de-DE')}
      </span>
    );
  }
  return <span className="text-[11px] text-[var(--tf-text-tertiary)] whitespace-nowrap">Automatisch gespeichert</span>;
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
      {/* Hauptkategorie — Single-Select, dunkel voll gefüllt zur Unterscheidung */}
      <div>
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-1.5">
          Hauptkategorie · <span className="text-[var(--tf-text-tertiary)]">ein Bereich</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {kategorien.map(k => {
            const isHaupt = haupt === k.id;
            return (
              <ToggleChip
                key={k.id}
                label={k.id}
                selected={isHaupt}
                variant="dark"
                onToggle={() => { if (!isHaupt) onSetHaupt(k.id); }}
                title={isHaupt ? `${k.name} (aktuelle Hauptkategorie)` : `${k.name} als Hauptkategorie wählen`}
              />
            );
          })}
        </div>
        {!haupt && (
          <p className="text-[11px] text-amber-700 mt-1.5">
            Noch keine Hauptkategorie gesetzt — bis dahin erscheinen keine neuen Anträge auf deiner Home-Page.
          </p>
        )}
      </div>

      {/* Ergänzende Erfahrungen — Multi-Select-Toggle */}
      <div>
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mb-1.5 inline-flex items-center gap-1.5">
          Ergänzende Erfahrungen · <span className="text-[var(--tf-text-tertiary)]">mehrere möglich</span>
          <InfoHint text={TOOLTIP_NEBEN} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {kategorien.map(k => {
            const isHaupt = haupt === k.id;
            const isNeben = nebenSet.has(k.id);
            return (
              <ToggleChip
                key={k.id}
                label={k.id}
                selected={isNeben}
                disabled={isHaupt}
                onToggle={() => onToggleNeben(k.id)}
                title={
                  isHaupt ? `${k.name} ist deine Hauptkategorie — kann nicht zusätzlich als Aspekt gesetzt werden.`
                  : isNeben ? `${k.name} als Aspekt entfernen`
                  : `${k.name} als Aspekt hinzufügen`
                }
              />
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
 * Auto-Tag-Chip-Wand mit Kürzung: gewählte (aktive) Chips sind IMMER sichtbar;
 * ungewählte werden auf ~10 Gesamt-Chips gekürzt, der Rest hinter „+ N weitere".
 * Datenmodell unverändert — aktiv ⇔ NICHT in `excluded`; Klick toggelt die
 * Ausblendung (`ausgeblendeteAutoTags`). Kein Durchstreichen mehr (Aus = Outline).
 */
const AUTO_TAG_CAP = 10;

function AutoTagChips({
  tags,
  excluded,
  onToggle,
}: {
  tags: string[];
  excluded: string[];
  onToggle: (tag: string) => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const excludedSet = new Set(excluded);
  const { sichtbar, versteckt } = computeAutoTagVisibility(tags, excludedSet, AUTO_TAG_CAP, expanded);

  return (
    <div className="flex flex-wrap gap-1.5">
      {sichtbar.map(tag => {
        const aktiv = !excludedSet.has(tag);
        const { short } = truncateWZ(tag);
        return (
          <ToggleChip
            key={tag}
            label={short}
            selected={aktiv}
            onToggle={() => onToggle(tag)}
            title={tag}
          />
        );
      })}
      {(versteckt > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="inline-flex items-center px-3 py-1 rounded-full text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40"
          style={{ background: 'transparent', border: '0.5px solid var(--tf-border)' }}
        >
          {expanded ? 'weniger anzeigen' : `+ ${versteckt} weitere`}
        </button>
      )}
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
        {ALL_ANTRAGSTYP_BUCKETS.map(bucket => (
          <ToggleChip
            key={bucket}
            label={bucket}
            selected={bevorzugtSet.has(bucket)}
            onToggle={() => onToggle(bucket)}
            title={
              bevorzugtSet.has(bucket)
                ? `${bucket}-Anträge nicht mehr bevorzugen`
                : `${bucket}-Anträge bevorzugen`
            }
          />
        ))}
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

