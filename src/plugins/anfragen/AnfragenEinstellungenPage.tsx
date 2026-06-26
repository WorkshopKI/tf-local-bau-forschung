/**
 * Kuration-Seite „Anfragen" — team-weite Modul-Einstellungen (auf dem Daten-Share).
 *
 * Erste Sektion: die URL des externen ZIM-FAQ-Assistenten. Bewusst als
 * Sektionen-Liste aufgebaut, damit künftige Anfragen-Einstellungen einfach als
 * weitere `<section>` ergänzt werden können. Schreiben ist gegated über
 * `requireOnline()` + `canWriteDatenShare()` (Pitfall #25).
 */
import { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { canWriteDatenShare, getAnfragenDashboardUrl } from '@/config/feature-flags';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { readAnfragenSettingsFromShare, writeAnfragenSettingsToShare } from './settings';

export function AnfragenEinstellungenPage(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const [url, setUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const defaultUrl = getAnfragenDashboardUrl();
  const isKurator = !!(profile?.is_kurator ?? profile?.is_admin);
  const canWrite = canWriteDatenShare(isKurator);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await readAnfragenSettingsFromShare(storage.idb);
      if (cancelled) return;
      const u = s?.dashboardUrl ?? '';
      setUrl(u);
      setSavedUrl(u);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  const speichern = useAsyncAction(async () => {
    if (!canWrite) throw new Error('Keine Schreibberechtigung für den Daten-Share (nur Kurator).');
    if (!useSmbStatus.getState().requireOnline()) throw new Error('Daten-Share offline — Speichern nicht möglich.');
    const merged = await writeAnfragenSettingsToShare(
      storage.idb,
      { dashboardUrl: url.trim() || undefined },
      profile?.name ?? 'kurator',
    );
    const u = merged.dashboardUrl ?? '';
    setUrl(u);
    setSavedUrl(u);
  }, { onSuccess: () => setJustSaved(true) });

  const onChange = (v: string): void => { setUrl(v); setJustSaved(false); };
  const dirty = url.trim() !== savedUrl.trim();
  const effektiv = url.trim() || defaultUrl;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-[20px] font-semibold text-[var(--tf-text)] mb-1">Anfragen</h1>
      <p className="text-[13px] text-[var(--tf-text-tertiary)] mb-8">
        Modul-Einstellungen für „Anfragen" — team-weit auf dem Daten-Share gespeichert.
      </p>

      <section className="mb-8">
        <SectionHeader label="ZIM FAQ-Assistent" />
        <label htmlFor="anfragen-dashboard-url" className="block text-[12.5px] text-[var(--tf-text-secondary)] mb-1.5">
          URL des externen ZIM-FAQ-Assistenten (Claude-Artifact)
        </label>
        <input
          id="anfragen-dashboard-url"
          type="url"
          value={url}
          onChange={e => onChange(e.target.value)}
          placeholder={defaultUrl}
          spellCheck={false}
          disabled={!canWrite}
          className="w-full px-3 py-2 text-[12.5px] font-mono rounded-[var(--tf-radius)] border border-[var(--tf-border)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-border-hover)] disabled:opacity-60"
        />
        <p className="mt-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
          Leer lassen = Standard-URL aus dem Build verwenden. Aktuell wirksam:{' '}
          <span className="font-mono break-all text-[var(--tf-text-secondary)]">{effektiv}</span>
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => speichern.run()}
            disabled={!canWrite || !dirty || speichern.busy}
            className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-text)] text-[var(--tf-bg)] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:opacity-90 transition-opacity"
          >
            <Save size={12} /> {speichern.busy ? 'Speichere…' : 'Speichern'}
          </button>
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={!canWrite || !url.trim()}
            className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] border border-[var(--tf-border)] text-[var(--tf-text)] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-[var(--tf-hover)] transition-colors"
          >
            <RotateCcw size={12} /> Auf Standard zurücksetzen
          </button>
        </div>

        {!canWrite && (
          <p className="mt-2 text-[12px] text-[var(--tf-text-tertiary)]">
            Nur mit Kurator-Schreibrecht editierbar.
          </p>
        )}
        {speichern.error && (
          <p className="mt-2 text-[12px] text-[var(--tf-danger-text)]">Fehler: {speichern.error}</p>
        )}
        {justSaved && !dirty && !speichern.error && (
          <p className="mt-2 text-[12px] text-[var(--tf-success-text)]">Team-weit gespeichert.</p>
        )}
      </section>
    </div>
  );
}
