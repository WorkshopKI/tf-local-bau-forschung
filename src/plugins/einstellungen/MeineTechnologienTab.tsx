/**
 * "Meine Technologien" — User-sichtbare Section im Einstellungs-Bereich.
 *
 * Zwei Bereiche:
 *  1. Automatisch erkannt (read-only) aus historischen Antraegen des MAs.
 *  2. Manuell ergaenzt — Tag-Input, persistiert in localStorage UND in
 *     `auslastung.json` (gegen die anonyme MA-ID).
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { useAntraegeCache } from '@/plugins/auslastung/hooks/useAntraegeCache';
import { resolveAnonIdForUser } from '@/plugins/auslastung/services/anonym-map';
import { aggregateMaProfile } from '@/plugins/auslastung/services/profil-aggregator';
import { TechnologieTags } from '@/plugins/auslastung/components/TechnologieTags';
import { AnonymIdBadge } from '@/plugins/auslastung/components/AnonymIdBadge';

const LS_KEY = 'teamflow-meineTechnologien';

export function MeineTechnologienTab(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const data = useAuslastungData(s => s.data);
  const load = useAuslastungData(s => s.load);
  const upsertMitarbeiter = useAuslastungData(s => s.upsertMitarbeiter);
  const createMitarbeiter = useAuslastungData(s => s.createMitarbeiter);
  const cache = useAntraegeCache();

  const [manualRaw, setManualRaw] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Initial-Load: aus localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setManualRaw(parsed.join(', '));
      }
    } catch { /* ignore */ }
  }, []);

  // Auslastung-Daten initial laden, falls noch nicht
  useEffect(() => { void load(storage); }, [storage, load]);

  const myAnonId = resolveAnonIdForUser(profile?.bearbeiter_kuerzel, cache.anonymMap);
  const automatic = useMemo(() => {
    if (!profile?.bearbeiter_kuerzel) return [];
    return aggregateMaProfile(cache.antraege, profile.bearbeiter_kuerzel);
  }, [cache.antraege, profile?.bearbeiter_kuerzel]);

  const manualTags = useMemo(
    () => manualRaw.split(',').map(s => s.trim()).filter(Boolean),
    [manualRaw],
  );

  async function speichern(): Promise<void> {
    setSaving(true);
    try {
      const tags = manualTags;
      try { localStorage.setItem(LS_KEY, JSON.stringify(tags)); } catch { /* ignore */ }
      // Sync in auslastung.json
      if (myAnonId) {
        const existing = data.mitarbeiter[myAnonId];
        if (existing) {
          await upsertMitarbeiter(storage, { ...existing, manuelleTechnologien: tags });
        } else {
          await createMitarbeiter(storage, { manuelleTechnologien: tags, onboardingAbgeschlossen: true });
        }
      } else {
        // Kein anonId noch -> versuche neu anzulegen (haben kein Kuerzel -> reine localStorage)
      }
      setSavedAt(new Date().toISOString());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Identitaet */}
      <div className="flex items-center gap-3 text-[12.5px] text-[var(--tf-text-secondary)]">
        {myAnonId ? (
          <>Du bist in diesem Programm <AnonymIdBadge anonId={myAnonId} /></>
        ) : (
          <span className="text-[var(--tf-text-tertiary)]">
            Kein Bearbeiter-Kürzel im Profil hinterlegt oder Kürzel taucht nicht in den Anträgen auf.
          </span>
        )}
      </div>

      {/* Aus Anträgen */}
      <div>
        <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
          Aus deinen bisherigen Anträgen ({automatic.length})
        </div>
        {automatic.length > 0 ? (
          <TechnologieTags tags={automatic} />
        ) : (
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">
            Keine historischen Anträge mit Deskriptoren gefunden.
          </p>
        )}
      </div>

      {/* Manuell */}
      <div>
        <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
          Zusätzliche Kompetenzen
        </div>
        <textarea
          value={manualRaw}
          onChange={e => setManualRaw(e.target.value)}
          rows={4}
          placeholder="Komma-separiert, z.B. Bauwerksmonitoring, FEM-Simulation, Quantum Computing"
          className="w-full text-[12.5px] px-2 py-1.5 rounded outline-none resize-none"
          style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
        />
        {manualTags.length > 0 && (
          <div className="mt-2">
            <TechnologieTags tags={manualTags} />
          </div>
        )}
        <div className="flex items-center justify-between mt-3">
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            Wird beim Speichern in das Team-Auslastungs-Profil übernommen.
          </p>
          <button
            type="button"
            onClick={() => void speichern()}
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            {saving ? 'Speichere…' : 'Speichern & teilen'}
          </button>
        </div>
        {savedAt && (
          <p className="text-[10.5px] text-emerald-700 mt-1">
            ✓ Gespeichert {new Date(savedAt).toLocaleTimeString('de-DE')}
          </p>
        )}
      </div>
    </div>
  );
}
