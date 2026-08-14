/**
 * Gruppe „Ordner" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 10).
 *
 * Die drei Orte, aus denen die App liest und in die sie schreibt: Datenordner,
 * persönlicher Ordner, CSV-Quellen. Je Zeile Statusbadge, Aktion und — wo es
 * hilft — eine Meta-Zeile; die Erklärungen stehen im ⓘ.
 *
 * Der lokale Arbeitsverlauf hängt als Klappe darunter: er beschreibt, was von
 * der eigenen Arbeit auf diesem Gerät liegt, wird aber selten gebraucht.
 *
 * Aus `SpeicherTab` herausgelöst (v4.30) — die Handler bleiben unverändert,
 * inklusive der Regel, dass Ordner-Picker OHNE `await` davor laufen müssen
 * (User-Activation unter `file://`).
 */
import { useEffect, useState } from 'react';
import { Database, FolderHeart, FolderInput, FolderOpen, History, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/ListItem';
import { PfadKopierZeile } from '@/components/ui/PfadKopierZeile';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { canWriteDatenShare, dataConfig, isCsvAutoRefreshEnabled, isKuratorMenusEnabled } from '@/config/feature-flags';
import {
  clearDatenShareHandle,
  clearPersoenlichHandle,
  getDatenShareHandle,
  getPersoenlichHandle,
  pickAndStoreDatenShareHandle,
  pickAndStorePersoenlichHandle,
  refreshAllPermissions,
} from '@/core/services/infrastructure/smb-handle';
import { useConnectionState } from '@/core/services/connection-status';
import {
  clearCsvSourceDirHandle,
  getCsvSourceDirHandle,
  pickAndLinkCsvFolder,
  queryCsvSourceDirPermission,
} from '@/plugins/csv-sources-kuration/csv-source-handle';
import { listProgramme, listSchemas } from '@/core/services/csv';
import { bumpCsvSourcesSignal } from '@/core/services/csv/csv-sources-signal';
import { runDataUpdate } from '@/plugins/csv-sources-kuration/services/data-update';
import { beschreibeDatenUpdate } from '@/plugins/csv-sources-kuration/services/datenUpdateMeldung';
import type { CsvSchema } from '@/core/services/csv/types';
import {
  clearArbeitskontextLog,
  listeArbeitskontext,
  type ArbeitskontextEintrag,
  type ArbeitskontextTyp,
} from '@/core/services/personal-storage/arbeitskontext-log';
import { SettingsFileRow } from '../_shared/settings-primitives';
import { SettingsGruppe, SettingsKlappe, SettingsLeer } from '@/components/settings';

const HINT_DATENORDNER =
  'Geteilter Ordner auf dem Netzlaufwerk mit Anträgen, Suchindex und Sync-Stand. Wird beim Start automatisch auf neuere Exporte geprüft.';
const HINT_PERSOENLICH =
  'Speichert Profil, Filter-Presets und Feedback-Outbox. Bleibt über Browser-Wechsel und Citrix-Sessions hinweg erhalten.';
const HINT_CSV =
  'Ordner mit den CSV-Quelldateien für die automatische Aktualisierung. Eine Freigabe deckt alle Dateien darin ab — nach einem Neustart genügt ein „Zulassen".';
const HINT_VERLAUF =
  'Zuletzt bearbeitete Gutachten, Nachforderungen und Kurzfassungen — Quelle der „Weitermachen"-Karte auf der Startseite. Nur lokal auf diesem Gerät; wird nicht synchronisiert oder exportiert.';

const VERLAUF_TYP_LABEL: Record<ArbeitskontextTyp, string> = {
  gutachten: 'Gutachten',
  nachforderung: 'Nachforderungen',
  kurzfassung: 'Kurzfassung',
};

function formatVerlaufZeit(ts: string): string {
  try { return new Date(ts).toLocaleString('de-DE'); } catch { return ts; }
}

export function OrdnerGruppe(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const setPersoenlichAvailable = useConnectionState(s => s.setPersoenlichAvailable);
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  const dsConnected = useConnectionState(s => s.datenShareAvailable);
  const persoenlichAvailable = useConnectionState(s => s.persoenlichAvailable);
  const [fehler, setFehler] = useState('');

  const [persConnected, setPersConnected] = useState(false);
  const [persFolderName, setPersFolderName] = useState<string | null>(null);
  const [persBusy, setPersBusy] = useState(false);

  const [dsHandleExists, setDsHandleExists] = useState(false);
  const [dsFolderName, setDsFolderName] = useState<string | null>(null);
  const [dsBusy, setDsBusy] = useState(false);

  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const [verlauf, setVerlauf] = useState<ArbeitskontextEintrag[]>([]);
  const [verlaufBusy, setVerlaufBusy] = useState(false);

  // EIN Handle für alle CSV-Quelldateien (pl + kurator).
  const showCsvFolder = isCsvAutoRefreshEnabled() || isKuratorMenusEnabled();
  const [csvDirExists, setCsvDirExists] = useState(false);
  const [csvDirName, setCsvDirName] = useState<string | null>(null);
  const [csvDirOnline, setCsvDirOnline] = useState(false);
  const [csvSchemas, setCsvSchemas] = useState<CsvSchema[]>([]);
  const [csvBusy, setCsvBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pers, ds] = await Promise.all([
        getPersoenlichHandle(storage.idb).catch(() => null),
        getDatenShareHandle(storage.idb).catch(() => null),
      ]);
      if (cancelled) return;
      setPersConnected(!!pers);
      setPersFolderName(pers?.name ?? null);
      setDsHandleExists(!!ds);
      setDsFolderName(ds?.name ?? null);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  // CSV-Ordner-Handle + Status + alle CSV-Schemas vorab laden, damit der Picker
  // im Klick-Gesture OHNE await-davor läuft (file://-User-Activation).
  useEffect(() => {
    if (!showCsvFolder) return;
    let cancelled = false;
    (async () => {
      const handle = await getCsvSourceDirHandle(storage.idb).catch(() => null);
      let online = false;
      if (handle) {
        try { online = (await queryCsvSourceDirPermission(handle)) === 'granted'; } catch { online = false; }
      }
      const schemas: CsvSchema[] = [];
      try {
        for (const p of await listProgramme(storage.idb)) {
          schemas.push(...await listSchemas(storage.idb, p.id));
        }
      } catch { /* leer lassen */ }
      if (cancelled) return;
      setCsvDirExists(!!handle);
      setCsvDirName(handle?.name ?? null);
      setCsvDirOnline(online);
      setCsvSchemas(schemas);
    })();
    return () => { cancelled = true; };
  }, [storage, showCsvFolder]);

  useEffect(() => {
    let cancelled = false;
    void listeArbeitskontext(storage.idb)
      .then(list => { if (!cancelled) setVerlauf(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storage]);

  const handleClearVerlauf = async (): Promise<void> => {
    if (!window.confirm(
      'Arbeitsverlauf löschen? Die „Weitermachen"-Karte auf der Startseite wird geleert. '
      + 'Nur lokal auf diesem Gerät — Anträge, Gutachten und Nachforderungen bleiben unberührt.',
    )) return;
    setVerlaufBusy(true);
    try {
      await clearArbeitskontextLog(storage.idb);
      setVerlauf([]);
    } finally {
      setVerlaufBusy(false);
    }
  };

  const handleConnectPers = async (): Promise<void> => {
    setFehler('');
    setPersBusy(true);
    try {
      const res = await pickAndStorePersoenlichHandle(storage.idb);
      if (!res.ok) {
        if (res.reason !== 'aborted') {
          setFehler(res.message ?? 'Persönlicher Ordner konnte nicht verbunden werden.');
        }
        return;
      }
      setPersConnected(true);
      setPersFolderName(res.handle.name);
      setPersoenlichAvailable(true);
    } finally {
      setPersBusy(false);
    }
  };

  const handleDisconnectPers = async (): Promise<void> => {
    await clearPersoenlichHandle(storage.idb);
    setPersConnected(false);
    setPersFolderName(null);
    setPersoenlichAvailable(false);
  };

  // CSV-Ordner: Picker DIREKT (csvSchemas sind vorab geladen — kein await davor,
  // sonst verbrennt Chrome unter file:// die User-Activation).
  const handlePickCsvFolder = async (): Promise<void> => {
    setFehler('');
    try {
      const res = await pickAndLinkCsvFolder(storage.idb, csvSchemas);
      setCsvBusy(true);
      if (!res.linked) return;
      const handle = await getCsvSourceDirHandle(storage.idb);
      setCsvDirExists(!!handle);
      setCsvDirName(handle?.name ?? null);
      setCsvDirOnline(handle ? (await queryCsvSourceDirPermission(handle)) === 'granted' : false);
      // Auto-Refresh-Banner re-prüfen lassen, sonst wirkt das Verknüpfen erst
      // nach einem Browser-Reload (der Check läuft sonst nur 1x beim Mount).
      bumpCsvSourcesSignal();
      if (res.unmatched.length > 0) {
        setFehler(`Ordner verknüpft. Für diese Quellen wurde keine passende Datei im Ordner gefunden: ${res.unmatched.join(', ')}.`);
      }
    } catch (err) {
      setFehler((err as Error).message ?? 'CSV-Ordner konnte nicht verknüpft werden.');
    } finally {
      setCsvBusy(false);
    }
  };

  const handleDisconnectCsv = async (): Promise<void> => {
    await clearCsvSourceDirHandle(storage.idb);
    setCsvDirExists(false);
    setCsvDirName(null);
    setCsvDirOnline(false);
  };

  // Datenordner: Picker DIREKT (kein await davor — User-Gesture-Pattern).
  const handlePickDatenShare = async (): Promise<void> => {
    setFehler('');
    const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
    const mode = canWriteDatenShare(isKurator) ? 'readwrite' : 'read';
    const res = await pickAndStoreDatenShareHandle(storage.idb, { mode });
    setDsBusy(true);
    try {
      if (!res.ok) {
        if (res.reason !== 'aborted') {
          setFehler(res.message ?? 'Datenordner konnte nicht verbunden werden.');
        }
        return;
      }
      setDsHandleExists(true);
      setDsFolderName(res.handle.name);
      const refreshed = await refreshAllPermissions(storage.idb, { isKurator });
      applyRefreshResult(refreshed);
    } finally {
      setDsBusy(false);
    }
  };

  const handleReconnectDatenShare = async (): Promise<void> => {
    setFehler('');
    setDsBusy(true);
    try {
      const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
      const result = await refreshAllPermissions(storage.idb, { isKurator });
      applyRefreshResult(result);
    } finally {
      setDsBusy(false);
    }
  };

  // Manueller Aufruf DESSELBEN Orchestrator-Pfads wie beim Start: Datenbestand
  // (Snapshot) prüfen+laden, dann verknüpfte Export-CSVs prüfen+importieren.
  const handleRunDataUpdate = async (): Promise<void> => {
    setFehler('');
    setUpdateMsg(null);
    setUpdateBusy(true);
    try {
      const handle = await getDatenShareHandle(storage.idb);
      if (!handle) {
        setFehler('Datenordner nicht verbunden.');
        return;
      }
      const r = await runDataUpdate(storage.idb, handle, {});
      bumpCsvSourcesSignal();
      setUpdateMsg(beschreibeDatenUpdate(r));
      // „Letzter CSV-Import" sofort frisch zeigen — last_imported_at neu einlesen,
      // statt auf einen Browser-Reload zu warten.
      try {
        const schemas: CsvSchema[] = [];
        for (const p of await listProgramme(storage.idb)) schemas.push(...(await listSchemas(storage.idb, p.id)));
        setCsvSchemas(schemas);
      } catch { /* Anzeige best-effort */ }
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleDisconnectDatenShare = async (): Promise<void> => {
    if (!window.confirm('Datenordner trennen? Ohne verbundenen Datenordner laufen Anträge, Suche und Synchronisierung nicht. Die Auswahl muss anschließend neu getroffen werden.')) {
      return;
    }
    await clearDatenShareHandle(storage.idb);
    setDsHandleExists(false);
    setDsFolderName(null);
    const prev = useConnectionState.getState();
    applyRefreshResult({
      datenShare: 'missing',
      persoenlich: prev.persoenlichAvailable ? 'granted' : 'missing',
      userFoldersRoots: {},
      dmsSources: {},
    });
  };

  // „Letzter CSV-Import" — jüngstes last_imported_at über alle CSV-Schemas
  // (ISO-Strings sortieren chronologisch). Leer in prod (keine CSV-Schemas).
  const importIsos = csvSchemas
    .map(s => s.last_imported_at)
    .filter((x): x is string => !!x)
    .sort();
  const lastCsvImport = importIsos.length > 0
    ? new Date(importIsos[importIsos.length - 1]!).toLocaleString('de-DE')
    : null;

  return (
    <SettingsGruppe id="sec-speicher" titel="Ordner">
      <SettingsFileRow
        first
        icon={<Database size={15} strokeWidth={1.5} />}
        name="Datenordner"
        value={dsHandleExists ? (dsFolderName ?? 'Verbunden') : undefined}
        connected={dsHandleExists && dsConnected}
        hint={HINT_DATENORDNER}
        meta={dsHandleExists ? (
          <>
            {lastCsvImport
              ? <>Letzter CSV-Import <span className="font-medium text-[var(--tf-text-secondary)]">{lastCsvImport}</span> · prüft beim Start automatisch</>
              : <>Prüft beim Start automatisch auf neuere Exporte</>}
            {!dsConnected && ' · offline'}
            {updateMsg && <> · {updateMsg}</>}
          </>
        ) : 'Noch nicht verbunden — Ordner auf dem Netzlaufwerk wählen'}
        actions={
          <>
            {dsHandleExists ? (
              dsConnected ? (
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleRunDataUpdate} disabled={updateBusy}>
                  {updateBusy ? 'Aktualisiere…' : 'Aktualisieren'}
                </Button>
              ) : (
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleReconnectDatenShare} disabled={dsBusy}>
                  {dsBusy ? 'Aktualisiere…' : 'Erneut verbinden'}
                </Button>
              )
            ) : (
              <Button variant="secondary" size="sm" icon={FolderOpen} onClick={handlePickDatenShare} disabled={dsBusy}>
                Verbinden
              </Button>
            )}
            {dsHandleExists && (
              <button onClick={handleDisconnectDatenShare} className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer" title="Trennen" disabled={dsBusy}>
                <Trash2 size={13} />
              </button>
            )}
          </>
        }
      />

      <SettingsFileRow
        icon={<FolderHeart size={15} strokeWidth={1.5} />}
        name="Persönlicher Ordner"
        value={persConnected ? (persFolderName ?? 'Verbunden') : undefined}
        connected={persConnected && persoenlichAvailable}
        hint={HINT_PERSOENLICH}
        meta={!persConnected ? 'Noch nicht verbunden' : (!persoenlichAvailable ? 'Offline' : undefined)}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={FolderOpen} onClick={handleConnectPers} disabled={persBusy}>
              {persConnected ? 'Ändern' : 'Verbinden'}
            </Button>
            {persConnected && (
              <button onClick={handleDisconnectPers} className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer" title="Trennen" disabled={persBusy}>
                <Trash2 size={13} />
              </button>
            )}
          </>
        }
      />

      {showCsvFolder && (
        <SettingsFileRow
          icon={<FolderInput size={15} strokeWidth={1.5} />}
          name="CSV-Quellen"
          value={csvDirExists ? (csvDirName ?? 'Verknüpft') : undefined}
          connected={csvDirExists && csvDirOnline}
          hint={HINT_CSV}
          meta={
            dataConfig.fixedCsvImportPfad
              ? <>Vorgabepfad <span className="font-medium text-[var(--tf-text-secondary)]">{dataConfig.fixedCsvImportPfad}</span></>
              : (!csvDirExists ? 'Noch nicht verknüpft' : (!csvDirOnline ? 'Offline' : undefined))
          }
          actions={
            <>
              <Button variant="secondary" size="sm" icon={FolderOpen} onClick={handlePickCsvFolder} disabled={csvBusy}>
                {csvBusy ? 'Wähle…' : (csvDirExists ? 'Ändern' : 'Verknüpfen')}
              </Button>
              {csvDirExists && (
                <button onClick={handleDisconnectCsv} className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer" title="Trennen" disabled={csvBusy}>
                  <Trash2 size={13} />
                </button>
              )}
            </>
          }
        />
      )}

      {/* Der Import-Ordner liegt ausserhalb des Datenordners und ist beim ersten
          Verknüpfen schwer zu finden. Die File System Access API erlaubt keine
          Vorauswahl — also anzeigen und kopierbar machen. Kopieren und Picken
          bleiben bewusst zwei Knöpfe (User-Activation). */}
      {showCsvFolder && dataConfig.fixedCsvImportPfad && (
        <div className="pb-2 pl-[42px]">
          <PfadKopierZeile pfad={dataConfig.fixedCsvImportPfad} />
        </div>
      )}

      <SettingsKlappe
        id="sec-arbeitsverlauf"
        label="Arbeitsverlauf"
        storageKey="teamflow_settings_arbeitsverlauf_collapsed"
        zaehler={`${verlauf.length} ${verlauf.length === 1 ? 'Eintrag' : 'Einträge'}`}
      >
        <p className="text-[12px] leading-[1.5] text-[var(--tf-text-tertiary)] mb-2">{HINT_VERLAUF}</p>
        {verlauf.length === 0 ? (
          <SettingsLeer>Noch nichts bearbeitet — der Verlauf füllt sich beim Arbeiten an Anträgen.</SettingsLeer>
        ) : (
          <>
            <div className="rounded-[var(--tf-radius)] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
              {verlauf.map((e, i) => (
                <ListItem
                  key={`${e.typ}:${e.verbundKey}`}
                  icon={<History size={14} className="text-[var(--tf-text-tertiary)]" />}
                  title={VERLAUF_TYP_LABEL[e.typ]}
                  subtitle={e.verbundKey}
                  meta={<span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">{formatVerlaufZeit(e.ts)}</span>}
                  last={i === verlauf.length - 1}
                />
              ))}
            </div>
            <div className="mt-2">
              <Button variant="secondary" size="sm" icon={Trash2} onClick={handleClearVerlauf} disabled={verlaufBusy}>
                {verlaufBusy ? 'Lösche…' : 'Verlauf löschen'}
              </Button>
            </div>
          </>
        )}
      </SettingsKlappe>

      {fehler && <p className="text-[12px] text-[var(--tf-danger-text)] pt-2">{fehler}</p>}
    </SettingsGruppe>
  );
}
