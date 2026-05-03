/**
 * Phase-2 Triage-Test-Panel.
 *
 * Erlaubt es, einzelne Dokumente per File-Picker durch die volle
 * Triage-Pipeline zu schicken und das resultierende Manifest-Objekt
 * inspizierbar zu machen. Außerdem: Skip-List + Pending-Antrag-Bucket-
 * Inhalte einsehen und DMS-CSV-Index aus dem Daten-Share laden.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { getSmbHandle } from '@/core/services/infrastructure/smb-handle';
import {
  loadDmsCsvFromShare,
  triageFile,
  listAllSkipEntries,
  listAllPending,
  cleanDocId,
  type ScanFile,
  type ManifestEntry,
} from '@/phase2';
import type { AktenplanLookup, DmsEntry } from '@/phase2/types';
import { DevLog, DevRow, StatusPill } from './shared';

export function TriagePanel(): React.ReactElement {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const programme = useActiveProgramm(s => s.programme);
  const activeProgrammName = programme.find(p => p.id === activeProgrammId)?.name ?? null;
  const [dmsMap, setDmsMap] = useState<Map<string, DmsEntry> | null>(null);
  const [aktenplan, setAktenplan] = useState<Map<string, AktenplanLookup> | null>(null);
  const [dmsSource, setDmsSource] = useState<'shared' | 'absent' | null>(null);
  const [lastManifest, setLastManifest] = useState<ManifestEntry | null>(null);
  const [skipCount, setSkipCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lookupQuery, setLookupQuery] = useState<string>('');

  const log = useCallback((s: string) => {
    setLogLines(prev => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${s}`]);
  }, []);

  const refreshCounts = useCallback(async () => {
    const skip = await listAllSkipEntries(storage.idb);
    setSkipCount(skip.length);
    const pending = await listAllPending(storage.idb);
    setPendingCount(pending.length);
  }, [storage.idb]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  const onLoadDmsIndex = async (): Promise<void> => {
    setBusy(true);
    try {
      const handle = await getSmbHandle(storage.idb);
      if (!handle) {
        log('Kein Daten-Share-Handle. Erst SMB-Panel verbinden.');
        return;
      }
      const r = await loadDmsCsvFromShare(handle);
      setDmsMap(r.entries);
      setAktenplan(r.aktenplan);
      setDmsSource(r.source);
      log(`DMS-Index geladen: ${r.entries.size} Einträge (source=${r.source}).`);
    } catch (e) {
      log(`Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onPickAndTriage = async (): Promise<void> => {
    if (!activeProgrammId) {
      log('Kein aktives Programm — bitte erst eines im Sidebar-Switcher auswählen.');
      return;
    }
    setBusy(true);
    try {
      const win = window as unknown as {
        showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
      };
      if (!win.showOpenFilePicker) {
        log('File System Access API nicht verfügbar.');
        return;
      }
      const [fh] = await win.showOpenFilePicker({
        types: [{ description: 'PDF / DOCX', accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }],
        multiple: false,
      });
      if (!fh) return;
      const file = await fh.getFile();
      const scanFile: ScanFile = {
        filename: file.name,
        filepath: file.name,
        size_bytes: file.size,
        mtime: new Date(file.lastModified).toISOString(),
      };

      const map = dmsMap ?? new Map<string, DmsEntry>();
      const ak = aktenplan ?? new Map<string, AktenplanLookup>();
      const r = await triageFile(
        {
          idb: storage.idb,
          programmId: activeProgrammId,
          dmsMap: map,
          aktenplan: ak,
          llmTransport: null,    // Stage 3 hier nicht aktiv — Dev-Test kann LLM-Endpoint später optional einhängen
        },
        scanFile,
        async () => file,
      );
      setLastManifest(r.manifest);
      log(`Triage abgeschlossen: ${r.manifest.doc_type} / ${r.manifest.triage_state} (Stage ${r.manifest.triage_stage}, Source ${r.manifest.triage_source})`);
      await refreshCounts();
    } catch (e) {
      log(`Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onShowSkipList = async (): Promise<void> => {
    const items = await listAllSkipEntries(storage.idb);
    log(`Skip-Liste: ${items.length} Einträge`);
    items.slice(0, 10).forEach(e => log(`  - ${e.filename} → ${e.doc_type} (${e.reason})`));
    setSkipCount(items.length);
  };

  const onShowPending = async (): Promise<void> => {
    const items = await listAllPending(storage.idb);
    log(`Pending-Antraege: ${items.length} Einträge`);
    items.slice(0, 10).forEach(e => log(`  - ${e.filename} (akronym=${e.akronym ?? '–'}, fkz=${e.fkz_candidate ?? '–'})`));
    setPendingCount(items.length);
  };

  const onLookupDocId = (): void => {
    const raw = lookupQuery;
    if (!raw.trim()) {
      log('Bitte DocID eingeben.');
      return;
    }
    if (!dmsMap || dmsMap.size === 0) {
      log('Index nicht geladen. Erst „Index laden" klicken.');
      return;
    }
    const cleaned = cleanDocId(raw);
    const lookupKey = cleaned.toLowerCase();
    const codes = Array.from(raw).map(ch => ch.charCodeAt(0));
    log(`Lookup für "${raw}" (clean → "${cleaned}", lookup-key "${lookupKey}", char-codes [${codes.join(',')}])`);
    log(`  map.size: ${dmsMap.size}`);

    const hit = dmsMap.get(lookupKey);
    if (hit) {
      log(`  HIT:`);
      log(`    docId        = ${hit.docId}`);
      log(`    bezeichnung  = ${hit.bezeichnung}`);
      log(`    aktenplan    = ${hit.aktenplan || '(leer)'}`);
      log(`    typ          = ${hit.typ || '(leer)'}`);
      log(`    von          = ${hit.von ?? '(null)'}`);
      log(`    extractedFkz = ${hit.extractedFkz ?? '(null)'}`);
      return;
    }

    log(`  MISS — kein exakter Lookup-Hit.`);
    // Substring-Suche: alle Map-Keys, die `cleaned.toLowerCase()` als
    // Substring enthalten. Bei MISS auf der ganzen DocID auch nach den
    // ersten 8 Zeichen suchen (typisch der DocID-Stamm ohne Endung).
    const stem = lookupKey.replace(/\.[^.]+$/, '').slice(0, 12);
    const needle = stem.length >= 4 ? stem : lookupKey;
    let found = 0;
    for (const k of dmsMap.keys()) {
      if (k.includes(needle)) {
        log(`  ähnlicher key: "${k}"`);
        found++;
        if (found >= 5) break;
      }
    }
    if (found === 0) {
      log(`  Auch keine Substring-Treffer für "${needle}" — DocID ist nicht in der Map.`);
      // Als Sanity: erste 3 Map-Keys ausgeben, damit der User sieht was generell
      // im Index liegt
      const samples: string[] = [];
      for (const k of dmsMap.keys()) {
        samples.push(k);
        if (samples.length >= 3) break;
      }
      log(`  Beispiel-Keys aus dem Index: ${samples.join(', ')}`);
    }
  };

  return (
    <>
      <DevRow label="DMS-CSV-Index">
        <Button size="xs" variant="outline" onClick={() => void onLoadDmsIndex()} disabled={busy}>Index laden</Button>
        {dmsMap && <StatusPill label={`${dmsMap.size} Einträge`} tone="ok" />}
        {dmsSource === 'absent' && <StatusPill label="dms-index-filtered.csv fehlt" tone="warn" />}
      </DevRow>

      <DevRow label="Aktives Programm (für Akronym-Lookup)">
        {activeProgrammId
          ? <StatusPill label={activeProgrammName ?? activeProgrammId} tone="ok" />
          : <StatusPill label="kein Programm aktiv — Switcher in der Sidebar" tone="warn" />
        }
      </DevRow>

      <DevRow label="DocID nachschlagen (Diagnose)">
        <Input
          value={lookupQuery}
          onChange={e => setLookupQuery(e.target.value)}
          placeholder="z.B. GMKZSZ01.docx"
          className="h-7 text-[12px] flex-1 min-w-[160px]"
          onKeyDown={e => { if (e.key === 'Enter') onLookupDocId(); }}
        />
        <Button size="xs" variant="outline" onClick={onLookupDocId} disabled={!dmsMap}>
          Suchen
        </Button>
      </DevRow>

      <DevRow label="Datei testen">
        <Button size="xs" variant="default" onClick={() => void onPickAndTriage()} disabled={busy}>
          Datei wählen + Triage
        </Button>
      </DevRow>

      <DevRow label="Stores">
        <Button size="xs" variant="outline" onClick={() => void onShowSkipList()}>Skip-Liste</Button>
        <StatusPill label={`${skipCount}`} tone="neutral" />
        <Button size="xs" variant="outline" onClick={() => void onShowPending()}>Pending</Button>
        <StatusPill label={`${pendingCount}`} tone="neutral" />
      </DevRow>

      {lastManifest && (
        <DevRow label="Letztes Triage-Manifest">
          <pre
            className="w-full overflow-x-auto rounded-md bg-[var(--tf-bg-secondary)] p-2 font-mono text-[10.5px] leading-snug text-[var(--tf-text-secondary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {JSON.stringify(lastManifest, null, 2)}
          </pre>
        </DevRow>
      )}

      <DevRow label="Log">
        <DevLog lines={logLines} />
      </DevRow>
    </>
  );
}
