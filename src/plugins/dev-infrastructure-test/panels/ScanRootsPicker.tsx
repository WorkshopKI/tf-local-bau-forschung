/**
 * Tree-Navigator zum Festlegen der zu scannenden Sub-Roots im Phase-2-Bulk-Scan.
 *
 * Persistiert die Auswahl in IDB (phase2_scan_config) — Bulk-Triage liest
 * von dort statt aus der Build-Config. Optional Export/Import via Daten-Share
 * (_intern/phase2/scan-config.json).
 *
 * Lazy-Loading pro Aufklapp-Klick: gross gewachsene Foerderprogramm-Roots
 * werden nicht beim Oeffnen einmal komplett gelesen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  dedupeWithInheritance,
  exportScanConfigToShare,
  findCoveringParent,
  getScanConfig,
  importScanConfigFromShare,
  listSubdirs,
  saveScanConfig,
  type SubdirEntry,
} from '@/phase2';
import {
  getDatenShareHandle,
  getDokumentenquelleHandle,
} from '@/core/services/infrastructure/smb-handle';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { DevRow, StatusPill } from './shared';

interface TreeNode {
  path: string;
  name: string;
  level: number;
  expanded: boolean;
  loaded: boolean;
  hasSubdirs: boolean;
}

interface ScanRootsPickerProps {
  idb: IDBStore;
  onSelectionChange?: (paths: string[]) => void;
  log: (s: string) => void;
}

function topLevelNodes(subs: SubdirEntry[]): TreeNode[] {
  return subs.map(s => ({
    path: s.path,
    name: s.name,
    level: 0,
    expanded: false,
    loaded: false,
    hasSubdirs: true,
  }));
}

function childNodes(subs: SubdirEntry[], parent: TreeNode): TreeNode[] {
  return subs.map(s => ({
    path: s.path,
    name: s.name,
    level: parent.level + 1,
    expanded: false,
    loaded: false,
    hasSubdirs: true,
  }));
}

export function ScanRootsPicker({
  idb,
  onSelectionChange,
  log,
}: ScanRootsPickerProps): React.ReactElement {
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Initial: Konfig aus IDB laden, Handle holen, Top-Level lesen
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await getScanConfig(idb);
        if (!cancelled && cfg) {
          setSelectedPaths(cfg.selected_paths);
          setSavedAt(cfg.updated_at);
          onSelectionChange?.(cfg.selected_paths);
        }
      } catch (e) {
        log(`Konfig-Lese-Fehler: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // onSelectionChange + log sind stabile Refs vom Caller; bewusst aus Deps weglassen
    // damit der Effekt nicht beim Tippen feuert
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idb]);

  const loadTopLevel = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const handle = await getDokumentenquelleHandle(idb);
      if (!handle) {
        log('Kein Dokumentenquelle-Handle. Erst SMB-Panel verbinden.');
        return;
      }
      setRootHandle(handle);
      const subs = await listSubdirs(handle, '');
      setNodes(topLevelNodes(subs));
      log(`Top-Level geladen: ${subs.length} Verzeichnisse.`);
    } catch (e) {
      log(`Tree-Load-Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [idb, log]);

  const toggleExpand = useCallback(async (node: TreeNode): Promise<void> => {
    if (!rootHandle) return;

    if (node.expanded) {
      // Collapse: alle direkten und transitiven Children entfernen
      setNodes(prev => {
        const idx = prev.findIndex(n => n.path === node.path);
        if (idx < 0) return prev;
        let endIdx = idx + 1;
        while (endIdx < prev.length && prev[endIdx]!.level > node.level) {
          endIdx++;
        }
        const next = [...prev];
        next.splice(idx + 1, endIdx - (idx + 1));
        next[idx] = { ...node, expanded: false };
        return next;
      });
      return;
    }

    // Expand: Subdirs lazy laden, ans Array nach dem Knoten einfuegen
    setLoadingPaths(prev => new Set(prev).add(node.path));
    try {
      const subs = await listSubdirs(rootHandle, node.path);
      setNodes(prev => {
        const idx = prev.findIndex(n => n.path === node.path);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = { ...node, expanded: true, loaded: true, hasSubdirs: subs.length > 0 };
        const children = childNodes(subs, node);
        next.splice(idx + 1, 0, ...children);
        return next;
      });
    } catch (e) {
      log(`Aufklapp-Fehler "${node.path}": ${(e as Error).message}`);
    } finally {
      setLoadingPaths(prev => {
        const next = new Set(prev);
        next.delete(node.path);
        return next;
      });
    }
  }, [rootHandle, log]);

  const persist = useCallback(async (paths: string[]): Promise<void> => {
    try {
      const entry = await saveScanConfig(idb, paths);
      setSavedAt(entry.updated_at);
    } catch (e) {
      log(`Speichern fehlgeschlagen: ${(e as Error).message}`);
    }
  }, [idb, log]);

  const toggleSelection = useCallback((path: string): void => {
    setSelectedPaths(prev => {
      const isCurrentlySelected = prev.includes(path);
      const raw = isCurrentlySelected
        ? prev.filter(p => p !== path)
        : [...prev, path];
      // Beim Aktivieren: Auto-Dedupe — wird ein Parent gewaehlt, fliegen
      // bereits drin liegende Children automatisch raus. Beim Deaktivieren
      // ist nur einer raus -> Dedupe ist ein No-Op aber kostet nichts.
      const next = dedupeWithInheritance(raw);
      void persist(next);
      onSelectionChange?.(next);
      return next;
    });
  }, [persist, onSelectionChange]);

  // O(1)-Lookup fuer Inheritance-Display.
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);

  const onExport = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const datenShare = await getDatenShareHandle(idb);
      if (!datenShare) {
        log('Kein Daten-Share-Handle.');
        return;
      }
      const r = await exportScanConfigToShare(idb, datenShare);
      log(`Konfig exportiert: ${r.paths} Pfade (${r.bytes} B) → ${r.path}`);
    } catch (e) {
      log(`Export-Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [idb, log]);

  const onImport = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const datenShare = await getDatenShareHandle(idb);
      if (!datenShare) {
        log('Kein Daten-Share-Handle.');
        return;
      }
      const r = await importScanConfigFromShare(idb, datenShare);
      setSelectedPaths(r.entry.selected_paths);
      setSavedAt(r.entry.updated_at);
      onSelectionChange?.(r.entry.selected_paths);
      log(`Konfig importiert: ${r.paths} Pfade aus ${r.path}`);
    } catch (e) {
      log(`Import-Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [idb, log, onSelectionChange]);

  return (
    <>
      <DevRow label="Bulk-Scan: Verzeichnisse waehlen">
        <Button size="xs" variant="outline" onClick={() => void loadTopLevel()} disabled={busy}>
          {busy && nodes.length === 0 ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Laedt…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <FolderTree className="h-3 w-3" />
              {nodes.length === 0 ? 'Verzeichnisse durchsuchen' : 'Top-Level neu laden'}
            </span>
          )}
        </Button>
        <StatusPill
          label={`${selectedPaths.length} Pfad${selectedPaths.length === 1 ? '' : 'e'} gewaehlt`}
          tone={selectedPaths.length > 0 ? 'ok' : 'neutral'}
        />
        {savedAt && (
          <span className="text-[10px] text-[var(--tf-text-tertiary)]">
            zuletzt gespeichert: {new Date(savedAt).toLocaleString('de-DE')}
          </span>
        )}
      </DevRow>

      {nodes.length > 0 && (
        <DevRow label="Verzeichnis-Baum">
          <div
            className="w-full max-h-[280px] overflow-y-auto rounded-md bg-[var(--tf-bg-secondary)] p-2"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {nodes.map(node => {
              const isLoading = loadingPaths.has(node.path);
              const isExplicit = selectedSet.has(node.path);
              const coveringParent = isExplicit
                ? null
                : findCoveringParent(node.path, selectedSet);
              const isInherited = coveringParent !== null;
              const isCovered = isExplicit || isInherited;
              const inheritedFromLabel = coveringParent === '' ? '(ganzer Handle)' : coveringParent;

              return (
                <div
                  key={node.path}
                  className="flex items-center gap-1.5 py-0.5 text-[11.5px] font-mono"
                  style={{ paddingLeft: `${node.level * 14 + 4}px` }}
                >
                  <button
                    type="button"
                    onClick={() => void toggleExpand(node)}
                    className="flex h-4 w-4 items-center justify-center rounded hover:bg-[var(--tf-hover)]"
                    title={node.expanded ? 'Zuklappen' : 'Aufklappen'}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : node.expanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <input
                    type="checkbox"
                    checked={isCovered}
                    disabled={isInherited}
                    onChange={() => toggleSelection(node.path)}
                    className={isInherited ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                    title={
                      isInherited
                        ? `geerbt von ${inheritedFromLabel} — wird automatisch mitgescannt`
                        : undefined
                    }
                  />
                  <span
                    className={
                      isExplicit
                        ? 'text-[var(--tf-text)] font-semibold'
                        : isInherited
                          ? 'text-[var(--tf-text-tertiary)] italic'
                          : 'text-[var(--tf-text-secondary)]'
                    }
                  >
                    {node.name}
                  </span>
                  {isExplicit && (
                    <span className="text-[10px] text-[var(--tf-text-tertiary)]">
                      ({node.path})
                    </span>
                  )}
                  {isInherited && (
                    <span className="text-[10px] text-[var(--tf-text-tertiary)]">
                      ⤷ via {inheritedFromLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </DevRow>
      )}

      {selectedPaths.length > 0 && (
        <DevRow label="Ausgewaehlte Pfade">
          {selectedPaths.map(p => (
            <span
              key={p || '__root__'}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--tf-bg-secondary)] px-2 py-0.5 text-[11px] font-mono"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              {p || '(ganzer Handle)'}
              <button
                type="button"
                onClick={() => toggleSelection(p)}
                className="ml-0.5 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
                title="Entfernen"
              >
                ×
              </button>
            </span>
          ))}
        </DevRow>
      )}

      <DevRow label="Konfig auf Share">
        <Button size="xs" variant="outline" onClick={() => void onExport()} disabled={busy}>
          Export → Share
        </Button>
        <Button size="xs" variant="outline" onClick={() => void onImport()} disabled={busy}>
          Import ← Share
        </Button>
        <span className="text-[10px] text-[var(--tf-text-tertiary)]">
          <code>_intern/phase2/scan-config.json</code> · pro Geraet eigene IDB-Konfig, Share nur bei Klick
        </span>
      </DevRow>
    </>
  );
}
