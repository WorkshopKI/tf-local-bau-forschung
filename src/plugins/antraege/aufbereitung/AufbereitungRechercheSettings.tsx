/**
 * Kurator-Einstellungen der Antrag-Aufbereitung-Recherche (Paket 5) — team-weit auf dem
 * Daten-Share (`_intern/aufbereitung-settings.json`). Drei Deep-Research-Ziel-URLs +
 * der „Marktzugang des KMU"-Schalter (Default AUS; identifizierendes Template).
 * Schreiben gegated über `requireOnline()` + `canWriteDatenShare()` (Pitfall #25).
 * Wird als Abschnitt im „Interne KI"-Panel gerendert (kein eigener Section-Rahmen hier).
 */
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { canWriteDatenShare, getAufbereitungDrUrls } from '@/config/feature-flags';
import { readAufbereitungSettingsFromShare, writeAufbereitungSettingsToShare } from './aufbereitung-settings';

export function AufbereitungRechercheSettings(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const defaults = getAufbereitungDrUrls();
  const isKurator = !!(profile?.is_kurator ?? profile?.is_admin);
  const canWrite = canWriteDatenShare(isKurator);

  const [chatgpt, setChatgpt] = useState('');
  const [claude, setClaude] = useState('');
  const [mistral, setMistral] = useState('');
  const [marktzugang, setMarktzugang] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await readAufbereitungSettingsFromShare(storage.idb);
      if (cancelled) return;
      setChatgpt(s?.chatgptUrl ?? '');
      setClaude(s?.claudeUrl ?? '');
      setMistral(s?.mistralUrl ?? '');
      setMarktzugang(s?.marktzugangAktiv === true);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  const speichern = useAsyncAction(async () => {
    if (!canWrite) throw new Error('Keine Schreibberechtigung für den Daten-Share (nur Kurator).');
    if (!useSmbStatus.getState().requireOnline()) throw new Error('Daten-Share offline — Speichern nicht möglich.');
    await writeAufbereitungSettingsToShare(
      storage.idb,
      {
        chatgptUrl: chatgpt.trim() || undefined,
        claudeUrl: claude.trim() || undefined,
        mistralUrl: mistral.trim() || undefined,
        marktzugangAktiv: marktzugang,
      },
      profile?.name ?? 'kurator',
    );
  }, { onSuccess: () => setJustSaved(true) });

  const feld = (id: string, label: string, wert: string, setWert: (v: string) => void, ph: string): React.ReactElement => (
    <div>
      <label htmlFor={id} className="block text-[12.5px] text-[var(--tf-text-secondary)] mb-1">{label}</label>
      <input
        id={id}
        type="url"
        value={wert}
        onChange={e => { setWert(e.target.value); setJustSaved(false); }}
        placeholder={ph}
        spellCheck={false}
        disabled={!canWrite}
        className="w-full px-3 py-2 text-[12px] font-mono rounded-[var(--tf-radius)] border border-[var(--tf-border)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-border-hover)] disabled:opacity-60"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[var(--tf-text-tertiary)]">
        Ziel-Seiten der „Kopieren &amp; … öffnen"-Buttons + Marktzugang-Schalter. Leer lassen = Standard-URL. Team-weit gespeichert.
      </p>
      {feld('aufb-chatgpt-url', 'ChatGPT', chatgpt, setChatgpt, defaults.chatgpt)}
      {feld('aufb-claude-url', 'Claude', claude, setClaude, defaults.claude)}
      {feld('aufb-mistral-url', 'Mistral', mistral, setMistral, defaults.mistral)}

      <div className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="text-[12.5px] text-[var(--tf-text)]">„Marktzugang des KMU" anbieten</div>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Bewusst identifizierendes Template (nennt den Firmennamen). Default AUS — nur mit klarem Bedarf aktivieren.
          </p>
        </div>
        <Switch checked={marktzugang} onCheckedChange={v => { setMarktzugang(v); setJustSaved(false); }} disabled={!canWrite} />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="button" variant="primary" size="sm" icon={Save} onClick={() => speichern.run()} loading={speichern.busy} disabled={!canWrite}>
          Speichern
        </Button>
        {!canWrite && <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Nur mit Kurator-Schreibrecht.</span>}
        {speichern.error && <span className="text-[11.5px] text-[var(--tf-danger-text)]">Fehler: {speichern.error}</span>}
        {justSaved && !speichern.error && <span className="text-[11.5px] text-[var(--tf-success-text)]">Team-weit gespeichert.</span>}
      </div>
    </div>
  );
}
