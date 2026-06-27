/**
 * MaInlineDetail (v2.6 + v2.14) — Inline-Expand-Bereich pro MA-Zeile.
 *
 * Zwei Tabs:
 *  - **Detail**: Verbund-Listen "Aktuelle Buchung" (Master-CSV) + "Eigene
 *    Eintragungen (pending)"
 *  - **Bearbeiten**: Form mit Kapazitaet, Haupt-/Nebenkategorien, Technologien,
 *    Abgemeldungen, Aktiv-Toggle. Speichern -> Tab zurueck auf Detail.
 *
 * v2.14: Source-Hint wandert aus einer eigenen Zeile in einen Info-Icon-
 * Tooltip in der Section-Headline (spart vertikalen Platz). Aktenzeichen-
 * Spalte bekommt feste Breite + separaten +N-Slot, damit Akronyme bei
 * gemischten Verbund-/Einzel-Antragen aligned bleiben.
 */
import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { KategoriePill } from '../components/KategoriePill';
import { AutoTagToggleWand } from '../components/AutoTagToggleWand';
import { TechChipInput } from '../components/TechChipInput';
import { ALL_ANTRAGSTYP_BUCKETS, type AnonymerMitarbeiter, type AntragstypBucket, type UeberKategorie } from '../types';
import { deriveAntragstypenFromKontingent, hasPlOverride } from '../services/kapazitaet';
import type { AuslastungVerbund, MaQuartalsAuslastung } from '../services/kapazitaet';
import { computeKapazitaetProTyp } from '../services/kapazitaet';
import type { MaAltlastBucket } from '../services/kapazitaet';
import { AltlastInlineList } from './AltlastInlineList';
import { TypKapazitaetBars } from './uebersicht/TypKapazitaetBars';
import { ZugangPasswortSection } from '../components/ZugangPasswortSection';

type Tab = 'detail' | 'edit';

interface Props {
  ma: AnonymerMitarbeiter;
  auslastung: MaQuartalsAuslastung;
  quartal: string;
  /** Offene Antraege aus den letzten 2 Quartalen — rein informativ (rechte Karte). */
  altlast?: MaAltlastBucket;
  /** True = MA hat KEINEN Eintrag in der Kürzel-Map (Phantom/manuell, kein
   *  echtes tib_kuerz). Nur dann ist „MA entfernen" erlaubt — CSV-MAs bleiben
   *  (würden eh re-auto-angelegt). */
  removable?: boolean;
  /** Nach erfolgreichem Save schliesst der Caller (MaRow) den Expand. */
  onSaved?: () => void;
}

export function MaInlineDetail({ ma, auslastung, quartal, altlast, removable, onSaved }: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('detail');

  return (
    <div className="px-4 py-3 flex flex-col gap-3"
      style={{ background: 'var(--tf-bg-secondary)', borderTop: '0.5px solid var(--tf-border)' }}>
      {/* Tabs */}
      <div className="flex items-center gap-1 text-[12px]">
        <TabButton active={tab === 'detail'} onClick={() => setTab('detail')}>Detail</TabButton>
        <TabButton active={tab === 'edit'} onClick={() => setTab('edit')}>Bearbeiten</TabButton>
      </div>

      {tab === 'detail' && (
        <DetailTab ma={ma} auslastung={auslastung} quartal={quartal} altlast={altlast} />
      )}
      {tab === 'edit' && (
        <EditTab
          ma={ma}
          removable={removable}
          onSaved={() => { setTab('detail'); onSaved?.(); }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md cursor-pointer ${active ? 'font-medium' : ''}`}
      style={{
        background: active ? 'var(--tf-bg)' : 'transparent',
        color: active ? 'var(--tf-text)' : 'var(--tf-text-secondary)',
        border: active ? '0.5px solid var(--tf-border)' : '0.5px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

// ─── Detail-Tab ───────────────────────────────────────────────────────────

function DetailTab({ ma, auslastung, quartal, altlast }: {
  ma: AnonymerMitarbeiter;
  auslastung: MaQuartalsAuslastung;
  quartal: string;
  altlast?: MaAltlastBucket;
}): React.ReactElement {
  // v2.16: per-Antragstyp-Auslastung als primäres Kapazitätsmodell (oben).
  const stundenProTV = useAuslastungData(s => Math.max(1, s.data.config.stundenProTV ?? 9));
  // v2.31: per-Typ-Stunden-Faktoren (z.B. DS 4,5 h) für die Pro-Typ-Bars.
  const stundenProTVProTyp = useAuslastungData(s => s.data.config.stundenProTVProTyp);
  const kapTyp = computeKapazitaetProTyp(ma, auslastung, stundenProTV, stundenProTVProTyp);
  const showTyp = kapTyp.hatKontingent || kapTyp.verbrauchGesamt > 0;
  return (
    <div className="flex flex-col gap-3">
      {showTyp && (
        <div className="rounded-[8px] p-3" style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
            Auslastung pro Antragstyp — {quartal}
          </div>
          <TypKapazitaetBars view={kapTyp} variant="detail" />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <VerbundSection
        label={`Aktuelle Buchung — ${quartal}`}
        verbuende={auslastung.fest.verbuende}
        empty="Keine festen Buchungen im Quartal."
        hint="Quelle: tib_kuerz in der Master-CSV mit Antragsdatum im Quartal."
      />
      <VerbundSection
        label={`Eigene Eintragungen (pending) — ${quartal}`}
        verbuende={auslastung.pending.verbuende}
        empty="Keine offenen Selbsteintragungen."
        hint="Werden in die Kapazität gerechnet, bis der PL das Kürzel in die CSV einträgt."
        footer={<AltlastInlineList altlast={altlast} />}
      />
      </div>
    </div>
  );
}

function VerbundSection({ label, verbuende, empty, hint, footer }: {
  label: string;
  verbuende: readonly AuslastungVerbund[];
  empty: string;
  hint: string;
  /** Optionaler Zusatz-Block am Fuss der Karte (z.B. Altanträge-Liste). */
  footer?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-[8px] p-3" style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
          {label} ({verbuende.length})
        </span>
        <span
          className="text-[var(--tf-text-tertiary)] cursor-help opacity-70 hover:opacity-100 inline-flex"
          title={hint}
          aria-label={hint}
        >
          <Info size={11} aria-hidden />
        </span>
      </div>
      {verbuende.length === 0 ? (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {verbuende.map((v, i) => {
            const extra = v.aktenzeichen.length - 1;
            const allAz = v.aktenzeichen.join(', ');
            return (
              <li
                key={`${v.verbundId ?? v.aktenzeichen[0] ?? i}`}
                className="flex items-baseline gap-2 text-[11.5px] py-1"
                style={{ borderBottom: i < verbuende.length - 1 ? '0.5px dashed var(--tf-border)' : 'none' }}
              >
                {/* Aktenzeichen + optional +N als kombinierte Fix-Breite-Box.
                 *  Inhalt linksbündig, +N direkt am Aktenzeichen — Akronym startet
                 *  immer bei `width`. Sparsamer Whitespace gegenüber zwei Slots. */}
                <div
                  className="shrink-0 flex items-baseline"
                  style={{ width: 105, gap: 4 }}
                  title={extra > 0 ? allAz : (v.aktenzeichen[0] ?? '')}
                >
                  <span className="font-mono text-[var(--tf-text-secondary)]">
                    {v.aktenzeichen[0]}
                  </span>
                  {extra > 0 && (
                    <span className="font-mono text-[var(--tf-text-tertiary)]">
                      +{extra}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {v.akronym && <span className="font-medium">{v.akronym}</span>}
                  {v.akronym && v.titel && <span className="text-[var(--tf-text-tertiary)]"> · </span>}
                  {v.titel && <span className="text-[var(--tf-text-secondary)]">{v.titel}</span>}
                </div>
                <span className="text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0 tabular-nums">
                  {v.tvCount} TVs
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {footer}
    </div>
  );
}

// ─── Edit-Tab ─────────────────────────────────────────────────────────────

function EditTab({ ma, removable, onSaved }: {
  ma: AnonymerMitarbeiter;
  removable?: boolean;
  onSaved: () => void;
}): React.ReactElement {
  const storage = useStorage();
  const upsert = useAuslastungData(s => s.upsertMitarbeiter);
  const removeMa = useAuslastungData(s => s.removeMitarbeiter);
  const kategorien = useAuslastungData(s => s.data.config.ueberKategorien);
  const cache = useAntraegeCache();

  const initialHaupt = ma.hauptKategorie;
  const initialNeben = ma.nebenKategorien;

  const [abschlag, setAbschlag] = useState(ma.abschlagProzent ?? 0);
  const [hauptKat, setHauptKat] = useState<string>(initialHaupt);
  const [nebenKats, setNebenKats] = useState<Set<string>>(new Set(initialNeben));
  // v2.x: 1:1-Spiegelung des Selbst-Service-Tabs „Meine Technologien" — der PL
  // kann das MA-Technologie-Profil vorbelegen, falls der MA es selbst noch nicht
  // gepflegt hat (Anträge müssen trotzdem verteilt werden). Wird beim „Team-
  // Profile einsammeln" durch das MA-eigene Profil ersetzt (selfFields).
  const [manualTags, setManualTags] = useState<string[]>(ma.manuelleTechnologien ?? []);
  const [excludedAutoTags, setExcludedAutoTags] = useState<string[]>(ma.ausgeblendeteAutoTags ?? []);
  const [abgRaw, setAbgRaw] = useState(ma.abgemeldet.join(', '));
  const [aktiv, setAktiv] = useState(ma.aktiv);

  // Auto-Tags aus den historischen Anträgen des MA — die im Cache pro anonId
  // vorab aggregierten Deskriptoren (rein intern, das Klartext-Kürzel wird NICHT
  // angezeigt → ohne De-Anon-Session nutzbar). Identische Quelle wie der Selbst-
  // Service-Tab „Meine Technologien".
  const automatic = cache.historischeDeskriptorenByAnon.get(ma.anonId) ?? [];
  function toggleAutoTag(tag: string): void {
    setExcludedAutoTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  }
  // Antragstyp-Vorbelegung: schreibt in die MA-Praeferenz (antragstypBevorzugt),
  // NICHT das PL-Override. Wird beim "Team-Profile einsammeln" durch die MA-
  // eigene Eingabe ersetzt — echte einmalige Ueberbrueckung.
  const [antragstypen, setAntragstypen] = useState<Set<AntragstypBucket>>(
    () => new Set(ma.antragstypBevorzugt ?? []),
  );
  function toggleTyp(b: AntragstypBucket): void {
    setAntragstypen(prev => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });
  }

  function toggleNeben(id: string): void {
    if (id === hauptKat) return;  // Haupt kann nicht zusaetzlich neben sein
    setNebenKats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function pickHaupt(id: string): void {
    // Falls die neue Hauptkategorie bisher Nebenkat war → aus neben entfernen.
    setNebenKats(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setHauptKat(id);
  }

  const saveAction = useAsyncAction(async () => {
    const neben = [...nebenKats];
    await upsert(storage, {
      ...ma,
      abschlagProzent: abschlag,
      hauptKategorie: hauptKat,
      nebenKategorien: neben,
      manuelleTechnologien: manualTags,
      // PL-Eingabe markieren → im Matching höher gewichtet (bis der MA sein
      // eigenes Profil einsammeln lässt, dann kippt die Quelle auf 'ma').
      technologienQuelle: manualTags.length > 0 ? 'pl' : ma.technologienQuelle,
      ausgeblendeteAutoTags: excludedAutoTags,
      abgemeldet: abgRaw.split(',').map(s => s.trim()).filter(Boolean),
      aktiv,
      antragstypBevorzugt: [...antragstypen],
    });
    onSaved();
  });

  const removeAction = useAsyncAction(async () => {
    const ok = window.confirm(
      `„${ma.anonId}" entfernen?\n\nDieser MA hat kein Kürzel in der Kürzel-Map ` +
      `(Phantom- oder manueller Eintrag, kein echtes Bearbeiter-Kürzel). Echte ` +
      `CSV-MAs lassen sich nicht entfernen. Die Aktion kann nicht rückgängig gemacht werden.`,
    );
    if (!ok) return;
    await removeMa(storage, ma.anonId);
    onSaved();
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Linke Spalte: Abschlag + Aktiv + Abgemeldet.
       *  Kapazität (Jahresstunden + Typ-Kontingent) wird ausschließlich in der
       *  Kompetenz-Matrix gepflegt — hier bewusst keine Kapazitäts-Felder mehr. */}
      <div className="flex flex-col gap-3">
        <FormRow label="Abschlag (%)" subtitle="Reduziert die Quartals-Kapazität (z.B. 25 für QS-Anteil)">
          <input
            type="number"
            min={0}
            max={100}
            value={abschlag}
            onChange={e => setAbschlag(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            className="text-[12.5px] px-2 py-1 rounded outline-none w-full"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </FormRow>
        <FormRow label="Status">
          <label className="flex items-center gap-2 text-[12px] cursor-pointer">
            <input type="checkbox" checked={aktiv} onChange={e => setAktiv(e.target.checked)} />
            <span>{aktiv ? 'Aktiv' : 'Inaktiv'}</span>
          </label>
        </FormRow>
        <FormRow label="Abgemeldete Quartale" subtitle="Komma-getrennt, z.B. 2026-Q3, 2026-Q4">
          <input
            value={abgRaw}
            onChange={e => setAbgRaw(e.target.value)}
            className="text-[12.5px] px-2 py-1 rounded outline-none font-mono w-full"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </FormRow>
      </div>

      {/* Rechte Spalte: Kategorien + Technologien */}
      <div className="flex flex-col gap-3">
        <FormRow label="Hauptkategorie" subtitle="Bestimmt den Match-Pool im Zuweisungs-Cockpit">
          <div className="flex flex-wrap gap-1.5">
            {kategorien.map((k: UeberKategorie) => (
              <button
                key={k.id}
                type="button"
                onClick={() => pickHaupt(k.id)}
                className="cursor-pointer"
                aria-pressed={hauptKat === k.id}
              >
                <KategoriePill kategorie={k} mode={hauptKat === k.id ? 'primaer' : 'inactive'} />
              </button>
            ))}
          </div>
        </FormRow>
        <FormRow label="Nebenkategorien" subtitle="Aspekt-Match-Bonus im Matching">
          <div className="flex flex-wrap gap-1.5">
            {kategorien.map((k: UeberKategorie) => {
              const isHaupt = k.id === hauptKat;
              const isNeben = nebenKats.has(k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => toggleNeben(k.id)}
                  disabled={isHaupt}
                  className="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-pressed={isNeben}
                  title={isHaupt ? 'Bereits Hauptkategorie' : k.name}
                >
                  <KategoriePill kategorie={k} mode={isNeben ? 'aspekt' : 'inactive'} />
                </button>
              );
            })}
          </div>
        </FormRow>
        <FormRow label="Manuelle Technologien" subtitle="Enter oder Komma fügt ein Stichwort hinzu · PL-Eingaben werden im Matching höher gewichtet, bis der MA sie selbst pflegt">
          <TechChipInput
            tags={manualTags}
            onChange={setManualTags}
            maxChips={20}
            maxChipLen={60}
            placeholder="Stichwort eintippen, Enter zum Hinzufügen…"
          />
        </FormRow>
        <FormRow
          label="Antragstypen (Vorbelegung)"
          subtitle="Wird ersetzt, sobald der MA seine Antragstypen im eigenen Profil setzt. Leer = keine Einschränkung."
        >
          <div className="flex flex-wrap gap-1.5">
            {ALL_ANTRAGSTYP_BUCKETS.map(b => {
              const isActive = antragstypen.has(b);
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleTyp(b)}
                  aria-pressed={isActive}
                  className="text-[11.5px] px-2 py-0.5 rounded cursor-pointer"
                  style={
                    isActive
                      ? { background: 'var(--tf-primary-light)', color: 'var(--tf-primary)', border: '0.5px solid var(--tf-primary)' }
                      : { background: 'transparent', color: 'var(--tf-text-tertiary)', border: '0.5px solid var(--tf-border)' }
                  }
                >
                  {isActive ? '✓ ' : ''}{b}
                </button>
              );
            })}
          </div>
          {hasPlOverride(ma) && (
            <p className="text-[10.5px] leading-snug" style={{ color: 'var(--tf-warning-text, #92400e)' }}>
              Hinweis: Für diesen MA ist ein PL-Override aktiv ({ma.antragstypUeberschreibung?.join(', ')})
              — es hat im Matching Vorrang vor dieser Vorbelegung.
            </p>
          )}
          {antragstypen.size === 0 && !hasPlOverride(ma) && (() => {
            const abgeleitet = deriveAntragstypenFromKontingent(ma);
            if (!abgeleitet) return null;
            return (
              <p className="text-[10.5px] leading-snug text-[var(--tf-text-tertiary)] flex flex-wrap items-center gap-1.5">
                <span>
                  Automatisch aus Stunden-Kontingent: <strong>{abgeleitet.join(', ')}</strong>
                  {' '}— greift, solange keine Vorbelegung gesetzt ist.
                </span>
                <button
                  type="button"
                  onClick={() => setAntragstypen(new Set(abgeleitet))}
                  className="px-1.5 py-0.5 rounded cursor-pointer"
                  style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
                >
                  Übernehmen
                </button>
              </p>
            );
          })()}
        </FormRow>
      </div>

      {/* Auto-Tags aus den bisherigen Anträgen — Full-Width, weil die Pill-Wand
          viele Tags haben kann. Spiegelt Sektion „Aus deinen bisherigen Anträgen"
          aus dem Selbst-Service-Tab; Ausblenden schreibt `ausgeblendeteAutoTags`. */}
      <div className="md:col-span-2">
        <FormRow
          label="Aus bisherigen Anträgen"
          subtitle="Automatisch erkannte Technologien — Klick blendet einen Tag aus dem Team-Profil aus."
        >
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
        </FormRow>
      </div>

      {/* Kapazität (Typ-Stunden) wird in der Kompetenz-Matrix gepflegt — hier
          bewusst kein Kontingent-Editor mehr. */}

      {/* v2.11: PL erzeugt/erneuert das MA-Login-Passwort (nur maVerwaltungPasswort
          + aktive De-Anon-Session). Komponente rendert null wenn Flag aus. */}
      <ZugangPasswortSection anonId={ma.anonId} />

      {/* Entfernen (nur Phantom/manuell) · Save / Cancel — spannt ueber beide Spalten */}
      <div className="md:col-span-2 flex items-center gap-2 pt-1">
        {removable && (
          <button
            type="button"
            onClick={() => removeAction.run()}
            disabled={removeAction.busy || saveAction.busy}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
            style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-danger-text)' }}
            title="Dieser MA hat keinen Eintrag in der Kürzel-Map (Phantom/manuell) und kann entfernt werden."
          >
            {removeAction.busy ? 'Entferne…' : 'MA entfernen'}
          </button>
        )}
        {(saveAction.error || removeAction.error) && (
          <span className="text-[11.5px] text-[var(--tf-danger-text)] self-center">
            {saveAction.error ?? removeAction.error}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onSaved}
            disabled={saveAction.busy}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
            style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
          >
            Abbrechen
          </button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => saveAction.run()}
            loading={saveAction.busy}
          >
            Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, subtitle, children }: {
  label: string;
  subtitle?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
        {label}
      </label>
      {children}
      {subtitle && (
        <p className="text-[10.5px] text-[var(--tf-text-tertiary)] leading-snug">{subtitle}</p>
      )}
    </div>
  );
}
