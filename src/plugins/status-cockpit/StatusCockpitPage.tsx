/**
 * Status-Cockpit — Vollbild-Seite: Statuswerte kuratieren und versionieren.
 *
 * Reine Darstellung über der `useStatusCockpit`-API: Seitenkopf + Export/Import,
 * Tab-Leiste (Katalog/Kürzel/To-dos), eine Versions-Sektion und eine
 * Speicher-Leiste, sobald der Entwurf von der aktiven Fassung abweicht.
 *
 * Die Simulations-Leiste (Phasenverteilung Aktiv→Entwurf, Konflikte,
 * Phasenwechsel-Diff) ist mit v2.385 entfallen: sie schätzte die Wirkung von
 * RANG-Änderungen ab, und die gibt es nicht mehr.
 */
import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { Download, Upload, History } from 'lucide-react';
import { useStatusCockpit, type StatusCockpitApi } from './useStatusCockpit';
import { KatalogTab } from './KatalogTab';
import { FelderTab } from './FelderTab';
import { RegelnTab } from './RegelnTab';
import { ReferenzdatenSektion } from './ReferenzdatenSektion';
import { feldStil, formatZeitpunkt } from './labels';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { isVorgangssystemEnabled } from '@/config/feature-flags';

type TabKey = 'katalog' | 'felder' | 'regeln';

function ExportImportButtons({ api }: { api: StatusCockpitApi }): React.ReactElement {
  const importieren = useAsyncAction(async () => { await api.importieren(); });
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" icon={Download} onClick={() => api.exportieren()} disabled={!api.aktiveVersion}>
        Exportieren
      </Button>
      <Button variant="ghost" size="sm" icon={Upload} disabled={importieren.busy} onClick={() => importieren.run()}>
        {importieren.busy ? 'Importiert …' : 'Importieren'}
      </Button>
      {importieren.error != null && (
        <span className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {importieren.error}</span>
      )}
    </div>
  );
}

/**
 * Der Katalog gilt team-weit — er liegt auf dem Daten-Share. Blieb eine Fassung
 * nur lokal, sieht sie niemand sonst; das muss dastehen statt eines stillen
 * Erfolgs (die Arbeit selbst ist gespeichert, nur eben nicht veröffentlicht).
 */
function NurLokalHinweis({ api }: { api: StatusCockpitApi }): React.ReactElement {
  const erneut = useAsyncAction(async () => { await api.erneutAufShare(); });
  return (
    <div className="mx-6 mt-3 rounded px-3 py-2 flex items-center gap-2 flex-wrap text-[12.5px] text-[var(--tf-warning-text)]" style={feldStil}>
      <span>
        Nur lokal gespeichert — der Daten-Share war nicht erreichbar. Diese Fassung gilt noch
        nicht für das Team.
      </span>
      <Button variant="ghost" size="sm" className="ml-auto" disabled={erneut.busy} onClick={() => erneut.run()}>
        {erneut.busy ? 'Versucht …' : 'Erneut veröffentlichen'}
      </Button>
    </div>
  );
}

function VersionsPanel({ api }: { api: StatusCockpitApi }): React.ReactElement {
  // Zu per Default, aber gemerkt — wer die Fassungen offen lässt, findet sie
  // beim nächsten Aufruf wieder offen.
  const [offen, toggleOffen] = useCollapsedSection(
    'status-cockpit:versionen', { defaultOpen: false },
  );
  const laden = useAsyncAction(async (version: number) => { await api.reaktivieren(version); });
  const versionen = [...api.versionen].sort((a, b) => b.version - a.version);
  const aktivNr = api.aktiveVersion?.version ?? null;

  return (
    <section className="mt-6 rounded" style={feldStil}>
      <button
        type="button"
        onClick={toggleOffen}
        aria-expanded={offen}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <History size={15} />
        Versionen ({versionen.length})
        <span className="ml-auto text-[11px] text-[var(--tf-text-tertiary)]">{offen ? 'einklappen' : 'ausklappen'}</span>
      </button>
      {offen && (
        <div className="flex flex-col divide-y divide-[var(--tf-border)] border-t border-[var(--tf-border)]">
          {versionen.map(v => {
            const istAktiv = v.version === aktivNr;
            return (
              <div key={v.version} className="flex items-center gap-2 px-3 py-2 flex-wrap">
                <span className="text-[12.5px] font-mono text-[var(--tf-text)]">v{v.version}</span>
                {istAktiv && <Badge variant="success">aktiv</Badge>}
                <span className="text-[12px] text-[var(--tf-text-secondary)]">{v.autor ?? '—'}</span>
                <span className="text-[11px] text-[var(--tf-text-tertiary)]">{formatZeitpunkt(v.zeitstempel)}</span>
                {v.kommentar && (
                  <span className="text-[12px] text-[var(--tf-text-secondary)] italic min-w-0 truncate">„{v.kommentar}"</span>
                )}
                {!istAktiv && (
                  <Button
                    variant="ghost" size="sm" className="ml-auto"
                    disabled={laden.busy} onClick={() => laden.run(v.version)}
                  >
                    Als Entwurf laden
                  </Button>
                )}
              </div>
            );
          })}
          {laden.error != null && (
            <p className="text-[11.5px] text-[var(--tf-danger-text)] px-3 py-1.5">⚠ {laden.error}</p>
          )}
        </div>
      )}
    </section>
  );
}

function SaveBar({ api }: { api: StatusCockpitApi }): React.ReactElement {
  const [kommentar, setKommentar] = useState('');
  const speichern = useAsyncAction(async () => {
    await api.speichern(kommentar);
    setKommentar('');
  });
  const busy = speichern.busy || api.speichernBusy;
  const fehler = api.speichernFehler ?? speichern.error;
  return (
    <div className="shrink-0 border-t border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-6 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text-secondary)]">Entwurf weicht ab.</span>
        <input
          value={kommentar} placeholder="Kommentar (optional)"
          className="flex-1 min-w-[200px] max-w-[420px] text-[12.5px] rounded px-2.5 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
          style={feldStil}
          onChange={e => setKommentar(e.target.value)}
        />
        <Button variant="primary" size="sm" disabled={busy} onClick={() => speichern.run()}>
          {busy ? 'Speichert …' : 'Für das Team speichern'}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => api.verwerfen()}>
          Verwerfen
        </Button>
      </div>
      {fehler != null && <p className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {fehler}</p>}
    </div>
  );
}

export function StatusCockpitPage(): React.ReactElement {
  const api = useStatusCockpit();
  const [tab, setTab] = useState<TabKey>('katalog');

  if (api.laden) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="px-6 pt-5 pb-3">
          <PageHeader title="Status-Katalog" subtitle="Statuswerte kuratieren und versionieren" />
        </div>
        <div className="flex-1 grid place-items-center text-[13px] text-[var(--tf-text-tertiary)]">Lädt …</div>
      </div>
    );
  }

  const werteCount = api.entwurf?.werte.length ?? 0;
  const felderCount = api.entwurf?.felder.length ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 pt-5 pb-3 flex flex-col gap-3 border-b border-[var(--tf-border)]">
        <PageHeader
          title="Status-Katalog"
          subtitle="Statuswerte kuratieren und versionieren"
          actions={
            <div className="flex items-center gap-2">
              <ExportImportButtons api={api} />
              <SeitenHilfeButton pluginId="status-cockpit" />
            </div>
          }
        />
        <ScopeTabs
          variant="tabs"
          aria-label="Bereich"
          activeKey={tab}
          onChange={k => setTab(k as TabKey)}
          items={[
            { key: 'katalog', label: 'Katalog', count: werteCount },
            { key: 'felder', label: 'Kürzel', count: felderCount },
            { key: 'regeln', label: 'To-dos', count: api.entwurf?.todoRegeln?.length ?? 0 },
          ]}
        />
      </div>

      {api.fehler != null && (
        <div className="mx-6 mt-3 rounded px-3 py-2 text-[12.5px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">
          ⚠ {api.fehler}
        </div>
      )}

      {api.nurLokal && <NurLokalHinweis api={api} />}


      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        {tab === 'katalog' && <KatalogTab api={api} />}
        {tab === 'felder' && <FelderTab api={api} />}
        {tab === 'regeln' && <RegelnTab api={api} />}
        {isVorgangssystemEnabled() && (
          <>
            <ReferenzdatenSektion api={api} />
          </>
        )}
        <VersionsPanel api={api} />
      </div>

      {api.geaendert && <SaveBar api={api} />}
    </div>
  );
}
