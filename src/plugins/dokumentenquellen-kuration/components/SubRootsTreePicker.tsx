/**
 * Tree-Navigator zum Festlegen von Sub-Roots innerhalb eines beliebigen
 * `FileSystemDirectoryHandle`. Source-agnostisch — keine IDB-Persistierung,
 * keine Export/Import-Buttons. Caller verwaltet `value` + `onChange` selbst.
 *
 * Lazy-Loading pro Aufklapp-Klick: gross gewachsene Foerderprogramm-Roots
 * werden nicht beim Oeffnen einmal komplett gelesen.
 *
 * Extrahiert aus `dev-infrastructure-test/panels/ScanRootsPicker.tsx`
 * (v1.15) — die alte Datei wird entfernt, da Multi-Source-Pfade jetzt im
 * `dokumentenquellen-kuration`-Plugin verwaltet werden.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dedupeWithInheritance, findCoveringParent, listSubdirs, type SubdirEntry } from '@/phase2';

interface TreeNode {
  path: string;
  name: string;
  level: number;
  expanded: boolean;
  loaded: boolean;
  hasSubdirs: boolean;
}

export interface SubRootsTreePickerProps {
  /** Wurzel-Handle, dessen Inhalt durchsucht wird. `null` = Komponente blockiert "Verbinden"-Button. */
  handle: FileSystemDirectoryHandle | null;
  value: string[];
  onChange: (paths: string[]) => void;
  /** Wenn true: Tree-Toggle und Checkboxes sind disabled (nur Read-Only-Anzeige). */
  disabled?: boolean;
  /** Optionaler Logger-Hook fuer Tree-Lade-Fehler. */
  onError?: (msg: string) => void;
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

export function SubRootsTreePicker({
  handle,
  value,
  onChange,
  disabled = false,
  onError,
}: SubRootsTreePickerProps): React.ReactElement {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Bei Handle-Wechsel den Tree resetten — alte Nodes referenzieren ggf.
  // einen anderen Handle.
  useEffect(() => {
    setNodes([]);
    setLoadingPaths(new Set());
  }, [handle]);

  const loadTopLevel = useCallback(async (): Promise<void> => {
    if (!handle) return;
    setBusy(true);
    try {
      const subs = await listSubdirs(handle, '');
      setNodes(topLevelNodes(subs));
    } catch (e) {
      onError?.(`Tree-Load-Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [handle, onError]);

  const toggleExpand = useCallback(async (node: TreeNode): Promise<void> => {
    if (!handle || disabled) return;

    if (node.expanded) {
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

    setLoadingPaths(prev => new Set(prev).add(node.path));
    try {
      const subs = await listSubdirs(handle, node.path);
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
      onError?.(`Aufklapp-Fehler "${node.path}": ${(e as Error).message}`);
    } finally {
      setLoadingPaths(prev => {
        const next = new Set(prev);
        next.delete(node.path);
        return next;
      });
    }
  }, [handle, disabled, onError]);

  const toggleSelection = useCallback((path: string): void => {
    if (disabled) return;
    const isCurrentlySelected = value.includes(path);
    const raw = isCurrentlySelected
      ? value.filter(p => p !== path)
      : [...value, path];
    onChange(dedupeWithInheritance(raw));
  }, [value, onChange, disabled]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const noHandle = handle == null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="xs"
          variant="outline"
          onClick={() => void loadTopLevel()}
          disabled={busy || noHandle}
        >
          {busy && nodes.length === 0 ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Lädt…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <FolderTree className="h-3 w-3" />
              {nodes.length === 0 ? 'Verzeichnisse durchsuchen' : 'Top-Level neu laden'}
            </span>
          )}
        </Button>
        <span className="text-[11px] text-[var(--tf-text-secondary)]">
          {value.length} Pfad{value.length === 1 ? '' : 'e'} gewählt
          {value.length === 0 && ' (= ganzer Handle wird gescannt)'}
        </span>
      </div>

      {noHandle && (
        <p className="text-[12px] text-[var(--tf-text-tertiary)] italic">
          Erst eine Quelle verbinden, um Sub-Roots auszuwählen.
        </p>
      )}

      {!noHandle && nodes.length > 0 && (
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
                  disabled={disabled}
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
                  disabled={isInherited || disabled}
                  onChange={() => toggleSelection(node.path)}
                  className={
                    isInherited || disabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer'
                  }
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
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(p => (
            <span
              key={p || '__root__'}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--tf-bg-secondary)] px-2 py-0.5 text-[11px] font-mono"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              {p || '(ganzer Handle)'}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggleSelection(p)}
                  className="ml-0.5 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
                  title="Entfernen"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
