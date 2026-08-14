/**
 * Gruppe „Unterprogramme" im Panel „Förderprogramme" — bis v4.35 der untere Teil
 * der Seite `/kuration/programme`. Sie haengt am AKTIVEN Programm; die Zeile
 * „Gilt fuer …" sagt das, weil die Tabelle sonst nicht verraet, welchen
 * Ausschnitt sie zeigt.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import {
  listUnterprogrammeByProgramm,
  saveUnterprogramm,
  logUnterprogrammChange,
} from '@/core/services/csv';
import type { Unterprogramm } from '@/core/services/csv/types';
import { SettingsGruppe, SettingsGruppenAktion, SettingsLeer } from '@/components/settings';
import { UnterprogrammRow } from './UnterprogrammRow';
import { AktivConfirmDialog } from './AktivConfirmDialog';
import { UnterprogrammXlsxImportDialog } from './UnterprogrammXlsxImportDialog';

interface Props {
  programmId: string;
  programmName?: string;
}

type SortKey = 'code' | 'name' | 'geplanter_zeitraum' | 'zeitraum_auto' | 'aktiv' | 'count';
type SortDir = 'asc' | 'desc';

function strCmp(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;  // undefined/leer immer ans Ende
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true });
}

function compareUp(a: Unterprogramm, b: Unterprogramm, key: SortKey): number {
  switch (key) {
    case 'code': return a.code.localeCompare(b.code, undefined, { numeric: true });
    case 'name': return strCmp(a.name, b.name);
    case 'geplanter_zeitraum': return strCmp(a.geplanter_zeitraum, b.geplanter_zeitraum);
    case 'zeitraum_auto': return strCmp(a.zeitraum_auto_von_cached, b.zeitraum_auto_von_cached);
    case 'aktiv': return Number(b.aktiv) - Number(a.aktiv);
    case 'count': return (a.antrag_count_cached ?? 0) - (b.antrag_count_cached ?? 0);
  }
}

export function UnterprogrammeGruppe({ programmId, programmName }: Props): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [ups, setUps] = useState<Unterprogramm[]>([]);
  const [pending, setPending] = useState<{ up: Unterprogramm; nextAktiv: boolean } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const refresh = useCallback(async () => {
    const list = await listUnterprogrammeByProgramm(storage.idb, programmId);
    setUps(list);
  }, [storage.idb, programmId]);

  const sortedUps = useMemo(() => {
    const list = [...ups];
    list.sort((a, b) => {
      const r = compareUp(a, b, sortKey);
      return sortDir === 'asc' ? r : -r;
    });
    return list;
  }, [ups, sortKey, sortDir]);

  const onHeaderClick = (key: SortKey): void => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  useEffect(() => { void refresh(); }, [refresh]);

  // Toast-artiges Flash-Banner; auto-dismiss nach 4s.
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 4000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const handleInlineEdit = async (up: Unterprogramm, patch: Partial<Unterprogramm>): Promise<void> => {
    const next = { ...up, ...patch };
    await saveUnterprogramm(storage.idb, {
      id: next.id,
      programm_id: next.programm_id,
      code: next.code,
      aktiv: next.aktiv,
      name: next.name,
      geplanter_zeitraum: next.geplanter_zeitraum,
    });
    await logUnterprogrammChange(
      storage.idb,
      'unterprogramm_edited',
      { code: up.code, patch },
      session.kuratorName ?? undefined,
    );
    await refresh();
  };

  const requestToggle = (up: Unterprogramm, nextAktiv: boolean): void => {
    setPending({ up, nextAktiv });
  };

  const confirmToggle = async (): Promise<void> => {
    if (!pending) return;
    const { up, nextAktiv } = pending;
    await saveUnterprogramm(storage.idb, {
      id: up.id,
      programm_id: up.programm_id,
      code: up.code,
      aktiv: nextAktiv,
      name: up.name,
      geplanter_zeitraum: up.geplanter_zeitraum,
    });
    await logUnterprogrammChange(
      storage.idb,
      nextAktiv ? 'unterprogramm_activated' : 'unterprogramm_deactivated',
      { code: up.code, name: up.name, previous_count: up.antrag_count_cached ?? 0 },
      session.kuratorName ?? undefined,
    );
    setPending(null);
    await refresh();
  };

  const totalActive = ups.filter(u => u.aktiv).length;
  const totalAntraege = ups.reduce((s, u) => s + (u.antrag_count_cached ?? 0), 0);

  const unterzeile = programmName
    ? `Gilt für „${programmName}" — ${totalActive} von ${ups.length} aktiv.`
    : `${totalActive} von ${ups.length} aktiv.`;

  return (
    <SettingsGruppe
      id="sec-unterprogramme"
      titel="Unterprogramme"
      unterzeile={unterzeile}
      hint="Unterprogramme entstehen beim CSV-Import automatisch aus der Spalte, die auf unterprogramm_id gemappt ist — angelegt wird hier keines. Kuratierbar sind Label, geplanter Zeitraum und das Aktiv-Häkchen; aktiv steuert, welche in Auswahllisten erscheinen."
      rechts={`${totalAntraege.toLocaleString('de-DE')} Anträge`}
      aktion={
        <SettingsGruppenAktion
          disabled={!session.isActive || ups.length === 0}
          onClick={() => setImportOpen(true)}
        >
          Labels aus XLSX …
        </SettingsGruppenAktion>
      }
    >
      {flash && (
        <div
          className="mt-1 mb-2 px-3 py-2 rounded-[var(--tf-radius)] text-[12.5px]"
          style={{ background: 'var(--tf-success-bg)', color: 'var(--tf-success-text)' }}
        >
          {flash}
        </div>
      )}

      {ups.length === 0 ? (
        <SettingsLeer>
          Noch keine Unterprogramme. Importiere eine Master-CSV mit Mapping auf{' '}
          <span className="font-mono">unterprogramm_id</span> — beim Import werden die
          gefundenen Unterprogramme automatisch registriert.
        </SettingsLeer>
      ) : (
        <div className="overflow-x-auto mt-1" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 10 }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                <SortableTh label="Code" sortKey="code" align="left" current={sortKey} dir={sortDir} onClick={onHeaderClick} />
                <SortableTh label="Label" sortKey="name" align="left" current={sortKey} dir={sortDir} onClick={onHeaderClick} />
                <SortableTh label="Geplanter Zeitraum" sortKey="geplanter_zeitraum" align="left" current={sortKey} dir={sortDir} onClick={onHeaderClick} />
                <SortableTh label="Zeitraum (aus Daten)" sortKey="zeitraum_auto" align="left" current={sortKey} dir={sortDir} onClick={onHeaderClick} />
                <SortableTh label="Aktiv" sortKey="aktiv" align="left" current={sortKey} dir={sortDir} onClick={onHeaderClick} />
                <SortableTh label="Anträge" sortKey="count" align="right" current={sortKey} dir={sortDir} onClick={onHeaderClick} />
              </tr>
            </thead>
            <tbody>
              {sortedUps.map(up => (
                <UnterprogrammRow
                  key={up.id}
                  up={up}
                  canEdit={session.isActive}
                  onEdit={patch => void handleInlineEdit(up, patch)}
                  onRequestToggle={next => requestToggle(up, next)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AktivConfirmDialog
        pending={pending}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmToggle()}
      />

      <UnterprogrammXlsxImportDialog
        open={importOpen}
        programmId={programmId}
        onClose={() => setImportOpen(false)}
        onApplied={({ written, nameWrites, zeitraumWrites }) => {
          setFlash(
            `${written} Unterprogramm${written === 1 ? '' : 'e'} aktualisiert ` +
            `(${nameWrites} Label, ${zeitraumWrites} Jahr).`,
          );
          void refresh();
        }}
      />
    </SettingsGruppe>
  );
}

interface SortableThProps {
  label: string;
  sortKey: SortKey;
  align: 'left' | 'right';
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
}

function SortableTh({ label, sortKey, align, current, dir, onClick }: SortableThProps): React.ReactElement {
  const active = current === sortKey;
  const arrow = active ? (dir === 'asc' ? '▲' : '▼') : '';
  return (
    <th className={`p-3 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--tf-text)] ${active ? 'text-[var(--tf-text)]' : ''}`}
        title={`Sortieren nach ${label}`}
      >
        <span>{label}</span>
        <span className="text-[8px] w-2">{arrow}</span>
      </button>
    </th>
  );
}
