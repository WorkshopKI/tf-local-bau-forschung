/**
 * KompetenzMatrixTable (v2.15) — editierbare, xlsx-ähnliche Kompetenz-Matrix.
 *
 * Spiegelt das Upload-Layout: 2-Zeilen-Header (Überkategorie-Gruppe über ihren
 * Unterkategorie-Spalten), davor Antragstyp-Kontingent (FuE/DS/DL/NW) + Abschlag,
 * eine Zeile pro MA. Level-Zellen per Klick durchschalten (leer→1→2→3→leer).
 *
 * Bearbeitung läuft über einen lokalen Draft pro MA; „Speichern" committet alle
 * geänderten Zeilen in EINEM Store-Batch (`applyKompetenzMatrixBatch` →
 * ein setState + ein persist, Pitfall #16/#20). Unbearbeitete Zeilen spiegeln
 * stets den Store (z.B. nach einem frischen Import).
 *
 * Datenschutz: Zeilen-ID ist die anonId; das Klartext-Kürzel erscheint nur unter
 * aktiver De-Anonymisierungs-Session.
 */
import { useMemo, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { isDeAnonymisierungEnabled } from '@/config/feature-flags';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useDeAnonSession } from '../hooks/useDeAnonSession';
import type { AnonymMap } from '../services/anonym-map';
import {
  ALL_ANTRAGSTYP_BUCKETS,
  type AntragstypBucket,
  type AnonymerMitarbeiter,
  type KompetenzLevel,
  type KompetenzMatrix,
  type KompetenzSchemaEntry,
} from '../types';

interface Props {
  schema: KompetenzSchemaEntry[];
  storage: StorageService;
  anonymMap: AnonymMap;
}

interface Draft {
  matrix: KompetenzMatrix;
  kontingent: Partial<Record<AntragstypBucket, number>>;
  abschlag: number;
}

const LEVEL_TITLE: Record<KompetenzLevel, string> = {
  1: '1 — Grundkenntnisse',
  2: '2 — vertiefte Kenntnisse',
  3: '3 — Expertenwissen',
};

function nextLevel(cur: KompetenzLevel | undefined): KompetenzLevel | undefined {
  return cur === undefined ? 1 : cur === 3 ? undefined : ((cur + 1) as KompetenzLevel);
}

function maToDraft(ma: AnonymerMitarbeiter): Draft {
  const matrix: KompetenzMatrix = {};
  for (const [ueber, cells] of Object.entries(ma.kompetenzMatrix ?? {})) {
    matrix[ueber as keyof KompetenzMatrix] = { ...cells };
  }
  return {
    matrix,
    kontingent: { ...(ma.jahresKapazitaetProTyp ?? {}) },
    abschlag: ma.abschlagProzent ?? 0,
  };
}

export function KompetenzMatrixTable({ schema, storage, anonymMap }: Props): React.ReactElement {
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const applyBatch = useAuslastungData(s => s.applyKompetenzMatrixBatch);
  const deAnonActive = useDeAnonSession(s => s.isActive);
  const showKuerzel = isDeAnonymisierungEnabled() && deAnonActive;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const maList = useMemo(
    () => Object.values(mitarbeiter).sort((a, b) => a.anonId.localeCompare(b.anonId)),
    [mitarbeiter],
  );
  const totalSubCols = useMemo(() => schema.reduce((n, e) => n + e.subKategorien.length, 0), [schema]);

  const dirtyCount = Object.keys(drafts).length;

  function effective(ma: AnonymerMitarbeiter): Draft {
    return drafts[ma.anonId] ?? maToDraft(ma);
  }

  function update(anonId: string, mutate: (d: Draft) => Draft): void {
    setDrafts(prev => {
      const cur = prev[anonId] ?? maToDraft(mitarbeiter[anonId]!);
      return { ...prev, [anonId]: mutate(cur) };
    });
  }

  function cycleCell(anonId: string, ueber: string, label: string): void {
    update(anonId, cur => {
      const matrix: KompetenzMatrix = { ...cur.matrix };
      const sub = { ...(matrix[ueber as keyof KompetenzMatrix] ?? {}) };
      const nxt = nextLevel(sub[label]);
      if (nxt === undefined) delete sub[label]; else sub[label] = nxt;
      if (Object.keys(sub).length > 0) matrix[ueber as keyof KompetenzMatrix] = sub;
      else delete matrix[ueber as keyof KompetenzMatrix];
      return { ...cur, matrix };
    });
  }

  function setKontingent(anonId: string, bucket: AntragstypBucket, raw: string): void {
    update(anonId, cur => {
      const kontingent = { ...cur.kontingent };
      const v = Number(raw.trim().replace(',', '.'));
      if (raw.trim() === '' || !Number.isFinite(v) || v <= 0) delete kontingent[bucket];
      else kontingent[bucket] = v;
      return { ...cur, kontingent };
    });
  }

  function setAbschlag(anonId: string, raw: string): void {
    update(anonId, cur => {
      const v = Number(raw.trim().replace(',', '.'));
      return { ...cur, abschlag: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0 };
    });
  }

  const save = useAsyncAction(async () => {
    const updates = Object.entries(drafts).map(([anonId, d]) => ({
      anonId,
      kompetenzMatrix: Object.keys(d.matrix).length > 0 ? d.matrix : undefined,
      jahresKapazitaetProTyp: Object.keys(d.kontingent).length > 0 ? d.kontingent : undefined,
      abschlagProzent: d.abschlag,
    }));
    await applyBatch(storage, updates);
    setDrafts({});
  });

  const th = 'px-2 py-1.5 text-[10.5px] font-medium text-[var(--tf-text-tertiary)] whitespace-nowrap';
  const stickyLeft: React.CSSProperties = { position: 'sticky', left: 0, background: 'var(--tf-bg)', zIndex: 2 };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {maList.length} MA · {totalSubCols} Unterkategorien · Level klicken zum Ändern (1 Grund · 2 vertieft · 3 Experte)
        </p>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <span className="text-[11.5px] text-amber-700">{dirtyCount} ungespeichert</span>
          )}
          <button
            type="button"
            onClick={() => save.run()}
            disabled={save.busy || dirtyCount === 0}
            className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer disabled:opacity-40"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            {save.busy ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      </div>

      {save.error && (
        <div className="rounded p-2.5 text-[12px]" style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>
          ⚠ Speichern fehlgeschlagen: <span className="font-mono">{save.error}</span>
        </div>
      )}

      <div className="overflow-auto rounded-[12px]" style={{ border: '0.5px solid var(--tf-border)', maxHeight: '70vh' }}>
        <table className="text-[12px] border-collapse">
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: 'var(--tf-bg)', zIndex: 3 }}>
              <th className={th} style={{ ...stickyLeft, zIndex: 4, borderBottom: '0.5px solid var(--tf-border)' }} rowSpan={2}>MA</th>
              <th className={th} style={{ borderBottom: '0.5px solid var(--tf-border)' }} colSpan={ALL_ANTRAGSTYP_BUCKETS.length}>Kontingent (Anträge/Jahr)</th>
              <th className={th} style={{ borderBottom: '0.5px solid var(--tf-border)' }} rowSpan={2}>Abschlag&nbsp;%</th>
              {schema.map(e => (
                <th key={e.ueberId} className={th} style={{ textAlign: 'center', borderLeft: '0.5px solid var(--tf-border)' }} colSpan={e.subKategorien.length}>
                  {e.label}
                </th>
              ))}
            </tr>
            <tr style={{ position: 'sticky', top: 24, background: 'var(--tf-bg)', zIndex: 3 }}>
              {ALL_ANTRAGSTYP_BUCKETS.map(b => (
                <th key={b} className={th} style={{ textAlign: 'center', borderBottom: '0.5px solid var(--tf-border)' }}>{b}</th>
              ))}
              {schema.map(e => e.subKategorien.map((label, i) => (
                <th
                  key={`${e.ueberId}-${i}`}
                  className={th}
                  style={{ borderBottom: '0.5px solid var(--tf-border)', borderLeft: i === 0 ? '0.5px solid var(--tf-border)' : undefined, maxWidth: 120 }}
                  title={label}
                >
                  <div className="truncate" style={{ maxWidth: 110 }}>{label}</div>
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {maList.map(ma => {
              const d = effective(ma);
              const kuerzel = showKuerzel ? anonymMap.toReal.get(ma.anonId) : undefined;
              return (
                <tr key={ma.anonId} style={{ borderTop: '0.5px solid var(--tf-border)', opacity: ma.aktiv ? 1 : 0.55 }}>
                  <td className="px-2 py-1" style={stickyLeft}>
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--tf-bg-secondary)]">{ma.anonId}</span>
                    {kuerzel && <span className="ml-1.5 text-[10.5px] text-[var(--tf-text-tertiary)]">{kuerzel}</span>}
                  </td>
                  {ALL_ANTRAGSTYP_BUCKETS.map(b => (
                    <td key={b} className="px-1 py-1 text-center">
                      <NumCell value={d.kontingent[b]} onChange={v => setKontingent(ma.anonId, b, v)} />
                    </td>
                  ))}
                  <td className="px-1 py-1 text-center">
                    <NumCell value={d.abschlag || undefined} onChange={v => setAbschlag(ma.anonId, v)} />
                  </td>
                  {schema.map(e => e.subKategorien.map((label, i) => (
                    <td key={`${e.ueberId}-${i}`} className="text-center" style={{ borderLeft: i === 0 ? '0.5px solid var(--tf-border)' : undefined }}>
                      <LevelCell level={d.matrix[e.ueberId]?.[label]} onCycle={() => cycleCell(ma.anonId, e.ueberId, label)} />
                    </td>
                  )))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LevelCell({ level, onCycle }: { level?: KompetenzLevel; onCycle: () => void }): React.ReactElement {
  const cls = level === 3 ? 'text-[var(--tf-text)] font-medium'
    : level === 2 ? 'text-[var(--tf-text-secondary)]'
    : level === 1 ? 'text-[var(--tf-text-tertiary)]'
    : 'text-[var(--tf-border-hover)]';
  return (
    <button
      type="button"
      onClick={onCycle}
      title={level ? LEVEL_TITLE[level] : 'leer — klicken für Level'}
      aria-label={level ? LEVEL_TITLE[level] : 'kein Level'}
      className={`w-7 h-7 my-0.5 text-[12px] rounded cursor-pointer hover:bg-[var(--tf-hover)] ${cls}`}
      style={level ? { background: 'var(--tf-bg-secondary)' } : undefined}
    >
      {level ?? '·'}
    </button>
  );
}

function NumCell({ value, onChange }: { value?: number; onChange: (v: string) => void }): React.ReactElement {
  return (
    <input
      type="number"
      min={0}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="w-12 text-center text-[12px] rounded px-1 py-0.5 bg-transparent"
      style={{ border: '0.5px solid var(--tf-border)' }}
    />
  );
}
