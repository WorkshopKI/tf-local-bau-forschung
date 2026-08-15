import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Search, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { saveSchema } from '@/core/services/csv';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { getCanonicalLabel } from '@/core/services/csv/constants';
import type { CsvSchema, ColumnMapping, ColumnMappingEntry } from '@/core/services/csv/types';
import { NewColumnRow } from './NewColumnRow';
import { decisionFromEntry, applyDecisionToEntry } from './services/new-column-mapping';
import {
  buildSchemaConfigExport,
  parseSchemaConfig,
  applyConfigToSchema,
  SchemaConfigParseError,
} from './services/schema-config-transfer';
import type { PerColumnDecision } from './wizard/useCsvWizardState';

/** Dateiname-Slug für den Konfig-Export (kein DOM). */
function slugifySchemaName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'schema';
}

interface Props {
  schema: CsvSchema;
  onClose: () => void;
  /** v2.12: nach erfolgreichem Mapping-Edit — Parent kann die Schema-Liste refreshen. */
  onSaved?: () => void;
}

interface GroupBucket {
  key: string;
  label: string;
  columns: string[];
}

const NO_GROUP_KEY = '__none__';
const NO_GROUP_LABEL = 'Ohne Gruppierung';

/**
 * Warum ein Knopf hier grau ist. Steht als sichtbarer Text neben ihm, nicht in
 * seinem `title`: ein `disabled`-Button empfängt keine Mausereignisse, sein
 * Tooltip erscheint also nie — und der Seiten-Banner, der dasselbe sagt, liegt
 * hinter diesem Dialog.
 */
const KURATOR_NOETIG =
  'Nur mit Kurator-Sitzung — freischalten in Einstellungen → Mein Profil → Zusatz-Module.';

type DisplayMode = 'canonical' | 'custom' | 'ignore';

function detectMode(entry: ColumnMappingEntry): DisplayMode {
  if (entry.ignore) return 'ignore';
  if (entry.canonical) return 'canonical';
  return 'custom';
}

export function CsvSchemaDetailDialog({ schema: initialSchema, onClose, onSaved }: Props): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [schema, setSchema] = useState<CsvSchema>(initialSchema);
  const [editing, setEditing] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, PerColumnDecision>>({});
  const [savedHint, setSavedHint] = useState(false);
  const [filterTerm, setFilterTerm] = useState('');
  const [configMsg, setConfigMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const columnMapping = schema.column_mapping;

  const hasGroups = useMemo(
    () => Object.values(columnMapping).some(e => (e.group_path?.length ?? 0) > 0),
    [columnMapping],
  );

  const buckets: GroupBucket[] = useMemo(() => {
    const cols = Object.keys(columnMapping);
    if (!hasGroups) {
      return [{ key: NO_GROUP_KEY, label: NO_GROUP_LABEL, columns: cols }];
    }
    const order: string[] = [];
    const map = new Map<string, GroupBucket>();
    for (const col of cols) {
      const path = columnMapping[col]?.group_path ?? [];
      const key = path.length === 0 ? NO_GROUP_KEY : path.join(' › ');
      const label = path.length === 0 ? NO_GROUP_LABEL : key;
      if (!map.has(key)) {
        map.set(key, { key, label, columns: [] });
        order.push(key);
      }
      map.get(key)!.columns.push(col);
    }
    const ordered = order.filter(k => k !== NO_GROUP_KEY).map(k => map.get(k)!);
    const none = map.get(NO_GROUP_KEY);
    if (none) ordered.push(none);
    return ordered;
  }, [columnMapping, hasGroups]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string): void =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const searchActive = filterTerm.trim().length > 0;

  // Such-Filter über CSV-Spaltenname, Label, Custom-Feldname und Standardfeld
  // (Schlüssel + lesbares Label). Greift in beiden Modi; leere Gruppen fallen weg.
  const filteredBuckets = useMemo(() => {
    const term = filterTerm.trim().toLowerCase();
    if (!term) return buckets;
    const matches = (col: string): boolean => {
      if (col.toLowerCase().includes(term)) return true;
      const e = columnMapping[col];
      if (e?.label && e.label.toLowerCase().includes(term)) return true;
      if (e?.custom && e.custom.toLowerCase().includes(term)) return true;
      if (e?.canonical) {
        const c = String(e.canonical);
        if (c.toLowerCase().includes(term) || getCanonicalLabel(c).toLowerCase().includes(term)) return true;
      }
      // Im Edit-Modus auch gegen die noch nicht gespeicherte Entscheidung matchen.
      const d = decisions[col];
      if (d?.custom && d.custom.toLowerCase().includes(term)) return true;
      if (d?.canonical && (d.canonical.toLowerCase().includes(term) || getCanonicalLabel(d.canonical).toLowerCase().includes(term))) return true;
      return false;
    };
    return buckets
      .map(b => ({ ...b, columns: b.columns.filter(matches) }))
      .filter(b => b.columns.length > 0);
  }, [buckets, filterTerm, columnMapping, decisions]);

  const totals = useMemo(() => {
    let standard = 0;
    let custom = 0;
    let ignore = 0;
    for (const e of Object.values(columnMapping)) {
      const m = detectMode(e);
      if (m === 'canonical') standard++;
      else if (m === 'ignore') ignore++;
      else custom++;
    }
    return { standard, custom, ignore, total: standard + custom + ignore };
  }, [columnMapping]);

  function startEdit(): void {
    const init: Record<string, PerColumnDecision> = {};
    for (const [col, e] of Object.entries(columnMapping)) init[col] = decisionFromEntry(e);
    setDecisions(init);
    setSavedHint(false);
    setEditing(true);
  }

  function updateDecision(col: string, patch: Partial<PerColumnDecision>): void {
    setDecisions(prev => {
      const base: PerColumnDecision = prev[col] ?? { mode: 'ignore' };
      return { ...prev, [col]: { ...base, ...patch } };
    });
  }

  // Canonical doppelt belegt unter den Entscheidungen → Warnung (last-wins beim Import).
  const conflictCanonicals = useMemo(() => {
    const used = new Map<string, number>();
    for (const d of Object.values(decisions)) {
      if (d.mode === 'canonical' && d.canonical) used.set(d.canonical, (used.get(d.canonical) ?? 0) + 1);
    }
    const set = new Set<string>();
    for (const [c, n] of used) if (n > 1) set.add(c);
    return set;
  }, [decisions]);

  const save = useAsyncAction(async () => {
    const merged: ColumnMapping = {};
    for (const [col, e] of Object.entries(columnMapping)) {
      merged[col] = applyDecisionToEntry(col, e, decisions[col] ?? decisionFromEntry(e));
    }
    const updated: CsvSchema = { ...schema, column_mapping: merged };
    await saveSchema(storage.idb, updated);
    await logAudit(storage.idb, {
      action: 'csv_schema_mapping_edited',
      user: session.kuratorName ?? undefined,
      details: { schemaId: schema.id, columns: Object.keys(merged).length },
    });
    setSchema(updated);
    setEditing(false);
    setSavedHint(true);
    onSaved?.();
  });

  // Konfiguration exportieren: Name + Mapping (inkl. Labels) + Merge-Parameter als
  // JSON herunterladen. Instanz-Felder (id, source_file_name, checksum …) bleiben
  // draußen (siehe schema-config-transfer.ts).
  function exportConfig(): void {
    setConfigMsg(null);
    const exp = buildSchemaConfigExport(schema, new Date().toISOString());
    const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugifySchemaName(schema.csv_source_name)}.schema.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    void logAudit(storage.idb, {
      action: 'csv_schema_config_exported',
      user: session.kuratorName ?? undefined,
      details: { schemaId: schema.id },
    }).catch(() => undefined);
  }

  // Konfiguration importieren: in DIESES bestehende Schema übernehmen (ID bleibt),
  // nur Name + Mapping ersetzen. Danach ist ein Re-Import nötig.
  const importConfig = useAsyncAction(async (file: File) => {
    setConfigMsg(null);
    const text = await file.text();
    let parsed;
    try {
      parsed = parseSchemaConfig(text);
    } catch (e) {
      if (e instanceof SchemaConfigParseError) {
        setConfigMsg({ kind: 'err', text: e.message });
        return;
      }
      throw e;
    }
    const updated = applyConfigToSchema(schema, parsed.config);
    await saveSchema(storage.idb, updated);
    await logAudit(storage.idb, {
      action: 'csv_schema_config_imported',
      user: session.kuratorName ?? undefined,
      details: {
        schemaId: schema.id,
        sourceSchemaId: parsed.sourceSchemaId,
        columns: Object.keys(parsed.config.column_mapping).length,
      },
    });
    setSchema(updated);
    setEditing(false);
    const cols = Object.keys(parsed.config.column_mapping).length;
    const masterMismatch = parsed.config.is_master !== schema.is_master;
    setConfigMsg({
      kind: 'ok',
      text: `Konfiguration „${parsed.config.csv_source_name}" übernommen (${cols} Spalten).`
        + (masterMismatch ? ' Hinweis: Das Master-Flag der Quelle wich ab und wurde bewusst NICHT übernommen.' : '')
        + ' Damit die Änderung auf den bereits importierten Anträgen greift, die Quelle einmal neu importieren („CSV neu wählen").',
    });
    onSaved?.();
  });

  function onPickConfigFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = ''; // erlaubt erneutes Wählen derselben Datei
    if (file) void importConfig.run(file);
  }

  const lastImported = schema.last_imported_at
    ? new Date(schema.last_imported_at).toLocaleString('de-DE')
    : '—';

  const searchBox = (
    <div className="relative mb-2">
      <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
      <Input
        value={filterTerm}
        onChange={e => setFilterTerm(e.target.value)}
        placeholder="CSV-Spalte, Label oder Feldname suchen …"
        className="h-8 pl-7 text-[12px]"
      />
    </div>
  );

  const noMatch = searchActive && filteredBuckets.length === 0 ? (
    <div className="py-4 text-center text-[12px] text-[var(--tf-text-tertiary)]">
      Keine Spalte passt zu „{filterTerm.trim()}".
    </div>
  ) : null;

  return (
    <Dialog
      open={true}
      onClose={onClose}
      className="max-w-[960px] self-start"
      title={
        <span className="flex items-center gap-2">
          <span className="truncate">{schema.csv_source_name}</span>
          {schema.is_master ? (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-800">
              Master
            </span>
          ) : null}
          <span className="ml-1 text-[12px] font-normal text-[var(--tf-text-tertiary)]">
            {editing ? '· Mapping bearbeiten' : '· Mapping (read-only)'}
          </span>
        </span>
      }
      footer={
        editing ? (
          <div className="flex w-full items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={save.busy}>
              Abbrechen
            </Button>
            <Button variant="default" size="sm" onClick={() => save.run()} disabled={save.busy}>
              {save.busy ? 'Speichern…' : 'Speichern'}
            </Button>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Schließen
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              {/* Der Grund steht SICHTBAR daneben, nicht im `title` des Knopfes:
                  ein deaktivierter Button empfängt keine Mausereignisse, sein
                  Tooltip erscheint also nie. Der Dialog verdeckt zudem den
                  Seiten-Banner, der sonst dasselbe sagt — hier war der Knopf
                  grau und stumm. */}
              {!session.isActive && (
                <span className="min-w-0 text-right text-[11.5px] leading-tight text-[var(--tf-text-tertiary)]">
                  {KURATOR_NOETIG}
                </span>
              )}
              <Button variant="default" size="sm" onClick={startEdit} disabled={!session.isActive}>
                <Pencil size={13} /> Mapping bearbeiten
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4 pb-4 text-[13px]">
        <section>
          <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
            Metadaten
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-y-1">
            <div className="text-[var(--tf-text-secondary)]">Schema-ID</div>
            <div className="font-mono text-[12px]">{schema.id}</div>
            <div className="text-[var(--tf-text-secondary)]">Join-Key</div>
            <div>{schema.join_key}</div>
            <div className="text-[var(--tf-text-secondary)]">Master</div>
            <div>{schema.is_master ? 'ja' : 'nein'}</div>
            <div className="text-[var(--tf-text-secondary)]">Priority</div>
            <div>{schema.priority}</div>
            <div className="text-[var(--tf-text-secondary)]">Encoding</div>
            <div>{schema.encoding ?? 'UTF-8'}</div>
            <div className="text-[var(--tf-text-secondary)]">Separator</div>
            <div className="font-mono">{schema.separator ?? ','}</div>
            {typeof schema.label_xlsx_header_rows === 'number' ? (
              <>
                <div className="text-[var(--tf-text-secondary)]">Label-XLS-Header</div>
                <div>{schema.label_xlsx_header_rows} Zeilen</div>
              </>
            ) : null}
            <div className="text-[var(--tf-text-secondary)]">Letzter Import</div>
            <div>{lastImported}</div>
            <div className="text-[var(--tf-text-secondary)]">Zeilen</div>
            <div>
              {typeof schema.last_row_count === 'number'
                ? schema.last_row_count.toLocaleString('de-DE')
                : '—'}
            </div>
          </div>

          {!editing ? (
            <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
              <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
                Konfiguration übertragen
              </div>
              <p className="text-[11.5px] text-[var(--tf-text-secondary)] mb-2 leading-relaxed">
                Exportiert Name, Spalten-Mapping (inkl. Labels) und Merge-Parameter als JSON — z.B. um eine
                kuratierte Konfiguration aus einer anderen Umgebung in <strong>dieses</strong> Schema zu
                übernehmen. Beim Import bleibt die Schema-ID unverändert; nur Name + Mapping werden ersetzt.
                Danach die Quelle einmal neu importieren, damit es auf den Anträgen greift.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportConfig}>
                  <Download size={13} /> Konfiguration exportieren
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!session.isActive || importConfig.busy}
                >
                  <Upload size={13} /> {importConfig.busy ? 'Importiere…' : 'Konfiguration importieren'}
                </Button>
                {!session.isActive && (
                  <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{KURATOR_NOETIG}</span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={onPickConfigFile}
                />
              </div>
              {configMsg ? (
                <div
                  className={`mt-2 rounded-md border-[0.5px] p-2.5 text-[12px] ${
                    configMsg.kind === 'ok'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-red-300 bg-red-50 text-red-800'
                  }`}
                >
                  {configMsg.kind === 'ok' ? '✓ ' : ''}
                  {configMsg.text}
                </div>
              ) : null}
              {importConfig.error ? (
                <div className="mt-2 text-[12px] text-red-700">Fehler: {importConfig.error}</div>
              ) : null}
            </div>
          ) : null}
        </section>

        {savedHint ? (
          <div className="rounded-md border-[0.5px] border-emerald-300 bg-emerald-50 p-2.5 text-[12px] text-emerald-800">
            ✓ Mapping gespeichert. Damit die Änderung auf den bereits importierten Anträgen greift, muss die
            Quelle <strong>neu importiert</strong> werden — nutze „CSV Daten aktualisieren" oder „CSV neu wählen"
            in der Quellen-Liste.
          </div>
        ) : null}

        {editing ? (
          <section>
            <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
              Mapping bearbeiten ({Object.keys(columnMapping).length} Spalten)
            </div>
            <p className="text-[12px] text-[var(--tf-text-secondary)] mb-2 leading-relaxed">
              Stelle pro Spalte ein, ob sie als <strong>Standardfeld</strong>, <strong>Eigenes Feld</strong> oder{' '}
              <strong>Ignoriert</strong> übernommen wird. Label-/Gruppen-Infos aus dem Label-XLS bleiben erhalten.
              Die Änderung greift auf den Anträgen erst nach dem nächsten Import.
            </p>
            {save.error ? (
              <div className="mb-2 text-[12px] text-red-700">Fehler: {save.error}</div>
            ) : null}
            {conflictCanonicals.size > 0 ? (
              <div className="mb-2 rounded-md border-[0.5px] border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900">
                <span className="font-medium">⚠ Standardfeld doppelt belegt: </span>
                {Array.from(conflictCanonicals).map(c => getCanonicalLabel(c)).join(', ')} — beim Import gewinnt
                die Spalte, die in dieser Zuordnungs-Liste weiter unten steht; die CSV-Reihenfolge
                entscheidet nicht.
              </div>
            ) : null}
            {searchBox}
            <div className="max-h-[50vh] overflow-y-auto flex flex-col gap-2">
              {noMatch ?? filteredBuckets.map(bucket => (
                <EditBucketSection
                  key={bucket.key}
                  bucket={bucket}
                  isGroupedView={hasGroups}
                  collapsed={searchActive ? false : !!collapsed[bucket.key]}
                  onToggle={() => toggleGroup(bucket.key)}
                  decisions={decisions}
                  conflictCanonicals={conflictCanonicals}
                  onChange={updateDecision}
                />
              ))}
            </div>
          </section>
        ) : (
          <section>
            <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
              Mapping ({totals.total} Spalten — {totals.standard} Standard · {totals.custom} Eigen ·{' '}
              {totals.ignore} Ignore)
            </div>
            {searchBox}
            <div className="flex flex-col gap-2">
              {noMatch ?? filteredBuckets.map(bucket => (
                <BucketSection
                  key={bucket.key}
                  bucket={bucket}
                  isGroupedView={hasGroups}
                  collapsed={searchActive ? false : !!collapsed[bucket.key]}
                  onToggle={() => toggleGroup(bucket.key)}
                  columnMapping={columnMapping}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
}

interface BucketProps {
  bucket: GroupBucket;
  isGroupedView: boolean;
  collapsed: boolean;
  onToggle: () => void;
  columnMapping: Record<string, ColumnMappingEntry>;
}

function BucketSection({
  bucket,
  isGroupedView,
  collapsed,
  onToggle,
  columnMapping,
}: BucketProps): React.ReactElement {
  const counts = { standard: 0, custom: 0, ignore: 0 };
  for (const col of bucket.columns) {
    const m = detectMode(columnMapping[col] ?? {});
    if (m === 'canonical') counts.standard++;
    else if (m === 'ignore') counts.ignore++;
    else counts.custom++;
  }
  const counterParts: string[] = [];
  if (counts.standard > 0) counterParts.push(`${counts.standard} Standard`);
  if (counts.custom > 0) counterParts.push(`${counts.custom} Eigen`);
  if (counts.ignore > 0) counterParts.push(`${counts.ignore} Ignore`);

  return (
    <div style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
      {isGroupedView ? (
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--tf-bg-secondary)]"
          style={{ borderBottom: collapsed ? undefined : '0.5px solid var(--tf-border)' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{bucket.label}</span>
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">
            ({bucket.columns.length}
            {counterParts.length > 0 ? ` — ${counterParts.join(' · ')}` : ''})
          </span>
        </button>
      ) : null}

      {!collapsed ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                <th className="text-left p-2">CSV-Spalte</th>
                {isGroupedView ? <th className="text-left p-2">Label</th> : null}
                <th className="text-left p-2">Übernehmen als</th>
                <th className="text-left p-2">Feldname</th>
                <th className="text-left p-2">Typ</th>
                <th className="text-left p-2">Historie</th>
              </tr>
            </thead>
            <tbody>
              {bucket.columns.map(col => {
                const entry = columnMapping[col] ?? {};
                const mode = detectMode(entry);
                const rowStyle: React.CSSProperties = {
                  borderTop: '0.5px solid var(--tf-border)',
                  borderLeft:
                    mode === 'canonical' ? '3px solid var(--tf-primary)' : '3px solid transparent',
                  opacity: mode === 'ignore' ? 0.6 : 1,
                };
                return (
                  <tr key={col} style={rowStyle}>
                    <td className="p-2 font-mono text-[11.5px] text-[var(--tf-text)]">{col}</td>
                    {isGroupedView ? (
                      <td className="p-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
                        {entry.label && entry.label !== col ? (
                          entry.label
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="p-2">
                      <ModeBadge mode={mode} />
                    </td>
                    <td className="p-2">
                      {mode === 'canonical' ? (
                        <div className="flex flex-col">
                          <span className="text-[var(--tf-text)]">
                            {getCanonicalLabel(String(entry.canonical))}
                          </span>
                          <span className="font-mono text-[10.5px] text-[var(--tf-text-tertiary)]">
                            {String(entry.canonical)}
                          </span>
                        </div>
                      ) : mode === 'custom' ? (
                        <span className="font-mono text-[11.5px] text-[var(--tf-text)]">
                          {entry.custom ?? '—'}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="p-2 text-[11.5px] text-[var(--tf-text-secondary)]">
                      {mode === 'ignore' ? '—' : entry.type ?? 'string'}
                    </td>
                    <td className="p-2 text-[11.5px]">
                      {entry.trackHistory ? (
                        <span className="text-amber-700" title="Wird in Historie versioniert">
                          🕒
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

interface EditBucketProps {
  bucket: GroupBucket;
  isGroupedView: boolean;
  collapsed: boolean;
  onToggle: () => void;
  decisions: Record<string, PerColumnDecision>;
  conflictCanonicals: Set<string>;
  onChange: (col: string, patch: Partial<PerColumnDecision>) => void;
}

/** Edit-Pendant zu `BucketSection`: gleiche kollabierbare Gruppen-Köpfe (group_path),
 *  aber editierbare `NewColumnRow`-Zeilen statt der read-only-Tabelle. Zähler aus
 *  den noch nicht gespeicherten Entscheidungen, damit sie live mitlaufen. */
function EditBucketSection({
  bucket,
  isGroupedView,
  collapsed,
  onToggle,
  decisions,
  conflictCanonicals,
  onChange,
}: EditBucketProps): React.ReactElement {
  const counts = { standard: 0, custom: 0, ignore: 0 };
  for (const col of bucket.columns) {
    const m = decisions[col]?.mode ?? 'ignore';
    if (m === 'canonical') counts.standard++;
    else if (m === 'ignore') counts.ignore++;
    else counts.custom++;
  }
  const counterParts: string[] = [];
  if (counts.standard > 0) counterParts.push(`${counts.standard} Standard`);
  if (counts.custom > 0) counterParts.push(`${counts.custom} Eigen`);
  if (counts.ignore > 0) counterParts.push(`${counts.ignore} Ignore`);

  return (
    <div style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
      {isGroupedView ? (
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--tf-bg-secondary)]"
          style={{ borderBottom: collapsed ? undefined : '0.5px solid var(--tf-border)' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{bucket.label}</span>
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">
            ({bucket.columns.length}
            {counterParts.length > 0 ? ` — ${counterParts.join(' · ')}` : ''})
          </span>
        </button>
      ) : null}

      {!collapsed ? (
        <div className="px-3 py-1">
          {bucket.columns.map(col => (
            <NewColumnRow
              key={col}
              column={col}
              decision={decisions[col] ?? { mode: 'ignore' }}
              conflict={
                decisions[col]?.mode === 'canonical' &&
                !!decisions[col]?.canonical &&
                conflictCanonicals.has(decisions[col].canonical as string)
              }
              onChange={patch => onChange(col, patch)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ModeBadge({ mode }: { mode: DisplayMode }): React.ReactElement {
  if (mode === 'canonical') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-800">
        Standardfeld
      </span>
    );
  }
  if (mode === 'ignore') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]">
        Ignoriert
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
      Eigenes Feld
    </span>
  );
}
