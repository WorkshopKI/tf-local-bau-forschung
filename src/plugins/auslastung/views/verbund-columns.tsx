/**
 * Spalten-Definitionen für die Verbund-Klassifizierungs-Tabelle.
 *
 * Jede Spalte rendert in zwei Varianten:
 *  - `render(view)` für die Verbund-Header-Zeile (aggregierte Sicht).
 *  - `renderTV(tv, parent)` für die optionale TV-Sub-Zeile (eingerückt).
 *
 * Spalten ohne `renderTV` haben in der TV-Sub-Zeile eine leere Zelle.
 * Sort + Picker + Resize arbeiten auf Verbund-Ebene über `accessor(view)`.
 */
import { type ReactNode } from 'react';
import type { SortableColumn } from '@/components/data-table';
import type { Antrag } from '@/core/services/csv/types';
import { KategoriePill } from '../components/KategoriePill';
import { ConfidenceDot } from '../components/ConfidenceDot';
import { normalizeKuerzel } from '../services/anonym-map';
import type { VerbundKlassifizierungsView } from '../services/verbund-aggregation';
import {
  CANONICAL_BIB_KUERZ,
  CANONICAL_ANTRAGSDATUM,
  type UeberKategorie,
} from '../types';

export interface VerbundColumn extends SortableColumn<VerbundKlassifizierungsView> {
  renderTV?: (tv: Antrag, parent: VerbundKlassifizierungsView) => ReactNode;
}

export interface VerbundColumnsContext {
  kategorien: UeberKategorie[];
  onToggleVerbund: (view: VerbundKlassifizierungsView, kategorieId: string, add: boolean) => void;
  onFreigebeVerbund: (view: VerbundKlassifizierungsView) => void;
}

function topConfidenceScore(v: VerbundKlassifizierungsView): number {
  const vorgeschl = v.klassifizierung.vorgeschlageneKategorien;
  if (vorgeschl.length === 0) return 0;
  return vorgeschl.reduce((max, c) => (c.confidence > max ? c.confidence : max), 0);
}

function topVorschlagKey(v: VerbundKlassifizierungsView): string {
  const ids = v.klassifizierung.status === 'freigegeben'
    ? v.klassifizierung.freigegebeneKategorien
    : v.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId);
  return ids[0] ?? '';
}

function leadAntrag(v: VerbundKlassifizierungsView): Antrag {
  return v.tvs[0]!;
}

function readString(a: Antrag, key: string): string {
  const v = (a as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
}

function readBib(a: Antrag): string | null {
  return normalizeKuerzel((a as Record<string, unknown>)[CANONICAL_BIB_KUERZ]);
}

function fkzRange(v: VerbundKlassifizierungsView): string {
  if (v.tvs.length === 1) return v.tvs[0]!.aktenzeichen;
  const first = v.tvs[0]!.aktenzeichen;
  const last = v.tvs[v.tvs.length - 1]!.aktenzeichen;
  return `${first} – ${last}`;
}

export function buildVerbundColumns(ctx: VerbundColumnsContext): VerbundColumn[] {
  const { kategorien, onToggleVerbund, onFreigebeVerbund } = ctx;

  return [
    {
      key: 'aktenzeichen',
      label: 'Aktz.',
      locked: true,
      defaultVisible: true,
      sortable: true,
      width: 150,
      wrap: false,
      accessor: v => leadAntrag(v).aktenzeichen,
      render: v => (
        <div className="font-mono text-[11.5px] leading-tight">
          <div>{fkzRange(v)}</div>
          {v.tvs.length > 1 && (
            <div className="text-[10px] text-[var(--tf-text-tertiary)] mt-0.5">
              {v.tvs.length} TVs
            </div>
          )}
        </div>
      ),
      renderTV: tv => (
        <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">
          {tv.aktenzeichen}
        </span>
      ),
    },
    {
      key: 'akronym',
      label: 'Akronym',
      defaultVisible: true,
      sortable: true,
      width: 120,
      wrap: false,
      accessor: v => v.akronym,
      render: v => v.akronym
        ? <span className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">{v.akronym}</span>
        : null,
      // TV-Row: leer (Akronym ist Verbund-Eigenschaft)
    },
    {
      key: 'verbund_titel',
      label: 'Verbund-Titel / TV-Titel',
      defaultVisible: true,
      sortable: true,
      width: 340,
      wrap: true,
      accessor: v => v.verbundTitel || '—',
      render: v => <span className="font-medium">{v.verbundTitel || '—'}</span>,
      renderTV: tv => {
        const tvTitel = readString(tv, 'titel');
        return tvTitel
          ? <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{tvTitel}</span>
          : null;
      },
    },
    {
      key: 'antragsteller',
      label: 'AST',
      defaultVisible: true,
      sortable: true,
      width: 180,
      wrap: true,
      accessor: v => leadAntrag(v).antragsteller ?? '',
      render: v => {
        const ast = leadAntrag(v).antragsteller ?? '';
        if (!ast) return null;
        const extra = v.tvs.length > 1 ? ` +${v.tvs.length - 1}` : '';
        return (
          <span className="text-[11.5px]" title={ast}>
            {ast}{extra && <span className="text-[var(--tf-text-tertiary)]">{extra}</span>}
          </span>
        );
      },
      renderTV: tv => {
        const ast = tv.antragsteller ?? '';
        return ast
          ? <span className="text-[11.5px] text-[var(--tf-text-secondary)]" title={ast}>{ast}</span>
          : null;
      },
    },
    {
      key: 'antragsdatum',
      label: 'Datum',
      defaultVisible: true,
      sortable: true,
      width: 110,
      wrap: false,
      accessor: v => readString(leadAntrag(v), CANONICAL_ANTRAGSDATUM),
      render: v => {
        const d = readString(leadAntrag(v), CANONICAL_ANTRAGSDATUM);
        return d ? <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">{d}</span> : null;
      },
      renderTV: tv => {
        const d = readString(tv, CANONICAL_ANTRAGSDATUM);
        return d ? <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">{d}</span> : null;
      },
    },
    {
      key: 'status',
      label: 'Status',
      defaultVisible: true,
      sortable: true,
      width: 140,
      wrap: true,
      accessor: v => (typeof leadAntrag(v).status === 'string' ? (leadAntrag(v).status as string) : ''),
      render: v => {
        const s = typeof leadAntrag(v).status === 'string' ? leadAntrag(v).status as string : '';
        return s ? <span className="text-[11.5px]" title={s}>{s}</span> : null;
      },
      renderTV: tv => {
        const s = typeof tv.status === 'string' ? tv.status as string : '';
        return s ? <span className="text-[11px] text-[var(--tf-text-tertiary)]" title={s}>{s}</span> : null;
      },
    },
    {
      key: 'bib_kuerz',
      label: 'BIB',
      defaultVisible: false,
      sortable: true,
      width: 80,
      wrap: false,
      accessor: v => readBib(leadAntrag(v)) ?? '',
      render: v => {
        const bib = readBib(leadAntrag(v));
        if (!bib) return null;
        return (
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{
              background: 'var(--tf-bg-secondary)',
              color: 'var(--tf-text-secondary)',
              border: '0.5px solid var(--tf-border)',
            }}
            title="Administrativer Bearbeiter (BIB)"
          >
            {bib}
          </span>
        );
      },
      renderTV: tv => {
        const bib = readBib(tv);
        return bib ? <span className="font-mono text-[10px] text-[var(--tf-text-tertiary)]">{bib}</span> : null;
      },
    },
    {
      key: 'vorschlag',
      label: 'Vorgeschlagen',
      defaultVisible: true,
      sortable: true,
      width: 220,
      wrap: true,
      accessor: v => topVorschlagKey(v),
      render: v => {
        const ids = new Set(
          v.klassifizierung.status === 'freigegeben'
            ? v.klassifizierung.freigegebeneKategorien
            : v.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId),
        );
        return (
          <div className="flex flex-wrap gap-1">
            {kategorien.map(k => {
              const active = ids.has(k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => onToggleVerbund(v, k.id, !active)}
                  className="cursor-pointer"
                  aria-pressed={active}
                  title={active ? `${k.name} entfernen` : `${k.name} hinzufügen`}
                >
                  <KategoriePill kategorie={k} active={active} />
                </button>
              );
            })}
          </div>
        );
      },
      // TV-Row: keine Pills (Verbund-State zählt für alle TVs)
    },
    {
      key: 'confidence',
      label: 'Conf.',
      defaultVisible: true,
      sortable: true,
      width: 70,
      wrap: false,
      accessor: v => topConfidenceScore(v),
      render: v => <ConfidenceDot confidence={v.confidence} />,
    },
    {
      key: 'aktion',
      label: 'Aktion',
      locked: true,
      defaultVisible: true,
      sortable: false,
      width: 130,
      wrap: false,
      accessor: () => '',
      render: v => {
        const freigegeben = v.klassifizierung.status === 'freigegeben';
        if (freigegeben) return <span className="text-[11.5px] text-emerald-700">✓ freigegeben</span>;
        const ids = v.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId);
        return (
          <button
            type="button"
            onClick={() => onFreigebeVerbund(v)}
            disabled={ids.length === 0}
            className="text-[11.5px] px-2 py-1 rounded cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            title="Verbund freigeben (alle TVs)"
          >
            Freigeben
          </button>
        );
      },
    },
  ];
}
