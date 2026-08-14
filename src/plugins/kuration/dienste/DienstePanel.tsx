/**
 * „Dienste" — Einstellungen an externen Gegenstellen, die das Team gemeinsam
 * nutzt. Heute genau eine: die URL des ZIM-FAQ-Assistenten.
 *
 * Bis v4.34 war das eine eigene Sidebar-Seite („E-Mail Anfragen:
 * Einstellungen") mit Seitenkopf, Hilfe-Knopf und einer einzigen Sektion — ein
 * Menuepunkt fuer ein Textfeld. Die Seite war laut eigenem Docstring als
 * Sektionsliste angelegt, damit weitere Einstellungen dazukommen koennen; das
 * Panel ist ihr Zuhause, auch wenn es heute duenn ist.
 *
 * Geschrieben wird auf den Daten-Share, also gated ueber `requireOnline()` +
 * `canWriteDatenShare()` (Pitfall #25).
 */
import { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { canWriteDatenShare, getAnfragenDashboardUrl } from '@/config/feature-flags';
import {
  readAnfragenSettingsFromShare,
  writeAnfragenSettingsToShare,
} from '@/plugins/anfragen/settings';
import {
  SettingsBlock,
  SettingsGruppe,
  SettingsTrustZeile,
  SettingsZweiSpalten,
} from '@/components/settings';
import { Globe } from 'lucide-react';

export function DienstePanel(): React.ReactElement {
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
    <SettingsZweiSpalten
      haupt={
        <SettingsGruppe
          id="sec-anfragen"
          titel="ZIM FAQ-Assistent"
          unterzeile="Wohin das Modul Anfragen seine anonymisierten Fragen schickt."
          hint="Der Assistent läuft außerhalb dieser App (Claude-Artifact). Die App anonymisiert die Anfrage vorher und setzt die echten Angaben nach der Antwort wieder ein — die Gegenstelle sieht keine Klarnamen."
        >
          <SettingsBlock
            id="sec-anfragen-url"
            label="URL des Assistenten"
            zusatz={url.trim() ? undefined : 'Standard aus dem Build'}
          >
            <input
              id="anfragen-dashboard-url"
              type="url"
              value={url}
              onChange={e => onChange(e.target.value)}
              placeholder={defaultUrl}
              spellCheck={false}
              disabled={!canWrite}
              aria-label="URL des externen ZIM-FAQ-Assistenten"
              className="w-full px-3 py-2 text-[12.5px] font-mono rounded-[var(--tf-radius)] border border-[var(--tf-border)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-border-hover)] disabled:opacity-60"
            />
            <p className="mt-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
              Aktuell wirksam:{' '}
              <span className="font-mono break-all text-[var(--tf-text-secondary)]">{effektiv}</span>
            </p>

            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Save}
                onClick={() => speichern.run()}
                loading={speichern.busy}
                disabled={!canWrite || !dirty}
              >
                Speichern
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={RotateCcw}
                onClick={() => onChange('')}
                disabled={!canWrite || !url.trim()}
              >
                Auf Standard zurücksetzen
              </Button>
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
          </SettingsBlock>
        </SettingsGruppe>
      }
      neben={
        <SettingsGruppe titel="Wo das gilt">
          <SettingsTrustZeile icon={<Globe size={14} />}>
            Die URL liegt auf dem Daten-Share und gilt für alle — nicht nur für dieses Gerät.
          </SettingsTrustZeile>
        </SettingsGruppe>
      }
    />
  );
}
